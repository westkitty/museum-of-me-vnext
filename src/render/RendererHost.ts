import * as THREE from 'three';
import { QUALITY, type QualitySettings, type QualityTier } from './QualityTiers';

/**
 * Owns the WebGL renderer, the camera, and the scene root.
 * Nothing else constructs a renderer. Resize, DPR capping, and context-loss
 * handling live here so no other system has to think about them.
 */
export class RendererHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;

  private settings: QualitySettings;
  private resolutionScale = 1;
  private contextLost = false;
  private disposed = false;
  private environmentWarmupStarted = false;
  private environmentWarmupPromise: Promise<void> | null = null;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  readonly warmTelemetry = {
    objects: 0, textures: 0, lastTextureInitCpuMs: 0, lastCompileWallMs: 0,
    /** Whole-world warm-ups: shader variants compiled one at a time, then geometry uploaded in batches. */
    worldPrograms: 0, worldUploadsPending: 0, worldUploaded: 0, lastWorldWarmMs: 0, lastWorldScanMs: 0, longestUploadMs: 0,
  };
  /** Shader programs compiled while drawing a visible frame (each one stalls that frame). */
  readonly frameTelemetry = { compilesInFrame: 0, framesWithCompile: 0 };
  private readonly frameWaiters: (() => void)[] = [];
  /** Drawables waiting for their first GPU upload, a few per frame (see uploadBatch). */
  private readonly uploadQueue: { object: THREE.Object3D; world: THREE.Object3D }[] = [];
  private readonly uploadCamera = new THREE.PerspectiveCamera();
  private uploadLightsLayered = false;
  private readonly uploadViewport = new THREE.Vector4();
  private readonly uploadScissor = new THREE.Vector4();
  private readonly onResize = () => this.resize();
  private readonly onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    console.warn('[RendererHost] WebGL context lost');
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    console.warn('[RendererHost] WebGL context restored');
    this.applyShadowSettings();
    this.resize();
  };

  constructor(canvas: HTMLCanvasElement, tier: QualityTier) {
    this.canvas = canvas;
    this.settings = QUALITY[tier];

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.settings.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.applyShadowSettings();

    this.scene = new THREE.Scene();
    this.scene.name = 'museum';
    this.scene.fog = new THREE.FogExp2(0x08121e, 0.00155);

    // PBR environment quality is preserved, but its addon parse + PMREM bake
    // are deferred until after the first frame so startup is not blocked by it.
    this.scene.environmentIntensity = 0.42;

    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 600);
    this.camera.name = 'visitor-camera';

    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  get quality(): QualitySettings {
    return this.settings;
  }

  get isContextLost(): boolean {
    return this.contextLost;
  }

  setQuality(tier: QualityTier): void {
    this.settings = QUALITY[tier];
    this.resolutionScale = 1;
    this.applyShadowSettings();
    this.resize();
  }

  /** Pixel budget can change without changing simulation, geometry or assets. */
  setResolutionScale(scale: number): void {
    const next = Math.max(0.75, Math.min(1, Number.isFinite(scale) ? scale : 1));
    if (Math.abs(next - this.resolutionScale) < 0.025) return;
    this.resolutionScale = next;
    this.resize();
  }

  /** Device pixel ratio after the quality cap, before adaptive scaling. */
  get basePixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);
  }

  get effectivePixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio) * this.resolutionScale;
  }

  private applyShadowSettings(): void {
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Every production shadow caster is static. Bake once, then refresh only
    // when quality/context changes or the development Workshop edits geometry.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = this.settings.shadows;
  }

  /** Development authoring can move static shadow casters; refresh on demand. */
  requestShadowUpdate(): void {
    if (this.settings.shadows) this.renderer.shadowMap.needsUpdate = true;
  }

  private warmEnvironment(): Promise<void> {
    if (this.environmentWarmupPromise) return this.environmentWarmupPromise;
    if (this.disposed) return Promise.resolve();

    this.environmentWarmupStarted = true;
    this.environmentWarmupPromise = (async () => {
      try {
        const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
        if (this.disposed) return;
        const room = new RoomEnvironment();
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const target = pmrem.fromScene(room, 0.04);
        room.dispose();
        pmrem.dispose();
        if (this.disposed) {
          target.dispose();
          return;
        }
        this.environmentTarget = target;
        // Switching scene.environment changes the shader variant of every lit
        // material, so assigning it straight away recompiled the whole visible
        // world inside one frame (~0.75 s on an M1). Compile the new variants in
        // short slices first, with the environment set only around each compile
        // call, so visible frames keep their existing programs until then.
        await this.precompileWithEnvironment(target.texture);
        if (this.disposed) return;
        this.scene.environment = target.texture;
      } catch (error) {
        console.error('[RendererHost] deferred environment warmup failed', error);
      }
    })();
    return this.environmentWarmupPromise;
  }

  private async precompileWithEnvironment(environment: THREE.Texture): Promise<void> {
    const seen = new Set<string>();
    const representatives: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (!drawable.isMesh && !(object as THREE.Points).isPoints && !(object as THREE.Line).isLine) return;
      const raw = drawable.material;
      for (const material of Array.isArray(raw) ? raw : raw ? [raw] : []) {
        const key = `${material.type}:${material.uuid}:${(object as THREE.InstancedMesh).isInstancedMesh ? 'i' : ''}${(object as THREE.SkinnedMesh).isSkinnedMesh ? 's' : ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        representatives.push(object);
      }
    });
    let sliceStart = performance.now();
    for (const object of representatives) {
      if (this.disposed || this.contextLost) return;
      const previous = this.scene.environment;
      this.scene.environment = environment;
      try {
        this.renderer.compile(object, this.camera, this.scene);
      } finally {
        this.scene.environment = previous;
      }
      if (performance.now() - sliceStart > this.warmSliceMs) { await this.nextFrame(); sliceStart = performance.now(); }
    }
    for (let frames = 0; frames < 600; frames++) {
      const programs = (this.renderer.info.programs ?? []) as unknown as { isReady?: () => boolean }[];
      if (programs.every((program) => program.isReady?.() !== false)) break;
      await this.nextFrame();
    }
  }

  /**
   * Prepare an object for first visibility without rendering it. This is the
   * r62 GPU-warm seam used by exhibit streaming under the title/plaza window.
   */
  async prewarmObject(root: THREE.Object3D): Promise<boolean> {
    if (this.disposed || this.contextLost) return false;

    // Shader programs depend on scene lighting/environment, so compile only
    // after the deferred PMREM environment has reached its canonical state.
    await this.warmEnvironment();
    if (this.disposed || this.contextLost) return false;

    const textures = new Set<THREE.Texture>();
    const collectTexture = (value: unknown): void => {
      if (!value) return;
      if ((value as THREE.Texture).isTexture) {
        textures.add(value as THREE.Texture);
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) collectTexture(item);
      }
    };

    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh && !(object as THREE.Points).isPoints && !(object as THREE.Line).isLine) return;
      const raw = (mesh as THREE.Mesh).material;
      const materials = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const material of materials) {
        for (const value of Object.values(material)) collectTexture(value);
        const uniforms = (material as THREE.ShaderMaterial).uniforms;
        if (uniforms) {
          for (const uniform of Object.values(uniforms)) collectTexture(uniform.value);
        }
      }
    });

    const textureStart = performance.now();
    for (const texture of textures) this.renderer.initTexture(texture);
    this.warmTelemetry.lastTextureInitCpuMs = performance.now() - textureStart;
    const compileStart = performance.now();
    await this.renderer.compileAsync(root, this.camera, this.scene);
    this.warmTelemetry.lastCompileWallMs = performance.now() - compileStart;
    if (this.disposed || this.contextLost) return false;
    this.warmTelemetry.textures += textures.size;
    this.warmTelemetry.objects += 1;
    return true;
  }

  /**
   * Prepares a whole hidden world before the visitor sees it, without one long
   * stall: every distinct shader variant is compiled on its own with a frame in
   * between, textures are uploaded, and then geometry is queued for upload a few
   * meshes per frame. Compiling against the live scene means the variants match
   * the lights and fog the world will actually be drawn with.
   */
  async warmWorld(root: THREE.Object3D): Promise<void> {
    const started = performance.now();
    await this.warmEnvironment();
    if (this.disposed || this.contextLost) return;
    const seenMaterials = new Set<string>();
    const representatives: THREE.Object3D[] = [];
    const textures = new Set<THREE.Texture>();
    const drawables: THREE.Object3D[] = [];
    const scanStarted = performance.now();
    root.traverse((object) => {
      const drawable = object as THREE.Mesh;
      if (!drawable.isMesh && !(object as THREE.Points).isPoints && !(object as THREE.Line).isLine && !(object as THREE.Sprite).isSprite) return;
      drawables.push(object);
      const raw = drawable.material;
      const materials = Array.isArray(raw) ? raw : raw ? [raw] : [];
      let novel = false;
      for (const material of materials) {
        // A program depends on the material and on how the object draws it.
        const key = `${material.uuid}:${(object as THREE.InstancedMesh).isInstancedMesh ? 'i' : ''}${(object as THREE.SkinnedMesh).isSkinnedMesh ? 's' : ''}${drawable.morphTargetInfluences ? 'm' : ''}`;
        if (!seenMaterials.has(key)) { seenMaterials.add(key); novel = true; }
        for (const value of Object.values(material)) {
          if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
        }
      }
      if (novel) representatives.push(object);
    });
    this.warmTelemetry.lastWorldScanMs = performance.now() - scanStarted;
    await this.nextFrame();

    let sliceStart = performance.now();
    for (const texture of textures) {
      this.renderer.initTexture(texture);
      if (performance.now() - sliceStart > this.warmSliceMs) { await this.nextFrame(); sliceStart = performance.now(); }
    }
    // Many materials share one program (every caption plate, for instance), so
    // compile synchronously in short slices and yield a frame only when the
    // slice is spent; parallel shader compilation keeps each call cheap.
    sliceStart = performance.now();
    for (const object of representatives) {
      if (this.disposed || this.contextLost) return;
      const before = this.renderer.info.programs?.length ?? 0;
      this.renderer.compile(object, this.camera, this.scene);
      this.warmTelemetry.worldPrograms += Math.max(0, (this.renderer.info.programs?.length ?? 0) - before);
      if (performance.now() - sliceStart > this.warmSliceMs) { await this.nextFrame(); sliceStart = performance.now(); }
    }
    // Wait, a frame at a time, until the driver reports every program linked.
    // (A final compileAsync(root) would re-walk the whole world in one task.)
    for (let frames = 0; frames < 600; frames++) {
      const programs = (this.renderer.info.programs ?? []) as unknown as { isReady?: () => boolean }[];
      if (programs.every((program) => program.isReady?.() !== false)) break;
      await this.nextFrame();
    }
    for (const object of drawables) this.uploadQueue.push({ object, world: root });
    this.warmTelemetry.worldUploadsPending = this.uploadQueue.length;
    while (this.uploadQueue.length && !this.disposed && !this.contextLost) await this.nextFrame();
    this.warmTelemetry.lastWorldWarmMs = performance.now() - started;
  }

  /** Queues a model (in the scene or detached) for its first GPU upload and waits for it. */
  async uploadObject(root: THREE.Object3D): Promise<void> {
    root.traverse((object) => {
      if ((object as THREE.Mesh).isMesh || (object as THREE.Points).isPoints || (object as THREE.Line).isLine) {
        this.uploadQueue.push({ object, world: root });
      }
    });
    while (this.uploadQueue.some((entry) => entry.world === root) && !this.disposed && !this.contextLost) await this.nextFrame();
  }

  /**
   * Draws a handful of queued meshes into a 1 px corner just before the real
   * frame, which uploads their buffers to the GPU. The real frame then clears
   * and covers that pixel. A dedicated layer keeps every other object out.
   */
  private uploadBatch(): void {
    const UPLOAD_LAYER = 31;
    if (!this.uploadLightsLayered) {
      this.scene.traverse((object) => { if ((object as THREE.Light).isLight) object.layers.enable(UPLOAD_LAYER); });
      this.uploadCamera.layers.set(UPLOAD_LAYER);
      this.uploadLightsLayered = true;
    }
    // Budget by bytes, not count: one merged architecture mesh can hold more
    // data than a hundred small props, and its upload is what takes the time.
    let bytes = 0;
    let take = 0;
    while (take < this.uploadQueue.length && take < 48 && (take === 0 || bytes < UPLOAD_BYTES_PER_FRAME)) {
      bytes += geometryBytes(this.uploadQueue[take].object);
      take++;
    }
    const uploadStarted = performance.now();
    const batch = this.uploadQueue.splice(0, take);
    const culled: boolean[] = [];
    const worlds = new Map<THREE.Object3D, boolean>();
    const detached: THREE.Object3D[] = [];
    for (const { world } of batch) {
      // A detached prototype (never drawn itself) is attached for this one pass.
      if (!world.parent && world !== this.scene && !detached.includes(world)) {
        this.scene.add(world);
        detached.push(world);
      }
    }
    for (const { object, world } of batch) {
      object.layers.enable(UPLOAD_LAYER);
      culled.push(object.frustumCulled);
      object.frustumCulled = false;
      if (!worlds.has(world)) { worlds.set(world, world.visible); world.visible = true; }
    }
    const autoClear = this.renderer.autoClear;
    this.renderer.getViewport(this.uploadViewport);
    this.renderer.getScissor(this.uploadScissor);
    const scissorTest = this.renderer.getScissorTest();
    this.renderer.autoClear = false;
    this.renderer.setViewport(0, 0, 1, 1);
    this.renderer.setScissor(0, 0, 1, 1);
    this.renderer.setScissorTest(true);
    try {
      this.renderer.render(this.scene, this.uploadCamera);
    } finally {
      this.renderer.setScissorTest(scissorTest);
      this.renderer.setScissor(this.uploadScissor);
      this.renderer.setViewport(this.uploadViewport);
      this.renderer.autoClear = autoClear;
      batch.forEach(({ object }, index) => {
        object.layers.disable(UPLOAD_LAYER);
        object.frustumCulled = culled[index];
      });
      for (const [world, visible] of worlds) world.visible = visible;
      for (const world of detached) this.scene.remove(world);
      this.warmTelemetry.worldUploaded += batch.length;
      this.warmTelemetry.longestUploadMs = Math.max(this.warmTelemetry.longestUploadMs, performance.now() - uploadStarted);
      this.warmTelemetry.worldUploadsPending = this.uploadQueue.length;
    }
  }

  resize(): void {
    // A hidden or not-yet-laid-out surface can report zero, which would produce
    // a zero-size drawing buffer and a NaN aspect ratio. Hold the last good
    // size instead of rendering into nothing.
    const w = Math.max(1, window.innerWidth || this.canvas.clientWidth || 1);
    const h = Math.max(1, window.innerHeight || this.canvas.clientHeight || 1);
    this.renderer.setPixelRatio(this.effectivePixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Resolves after the next frame the single app loop draws (the only frame loop). */
  /**
   * Warm-up work per frame: 6 ms, or half the time the last awaited frame took
   * when frames are slow (capped), so slow devices still finish warming.
   */
  private warmSliceMs = 6;

  private nextFrame(): Promise<void> {
    const waitStarted = performance.now();
    return new Promise<void>((resolve) => this.frameWaiters.push(resolve)).then(() => {
      this.warmSliceMs = Math.min(250, Math.max(6, (performance.now() - waitStarted) * 0.5));
    });
  }

  render(): void {
    if (this.frameWaiters.length) {
      const waiters = this.frameWaiters.splice(0);
      // Resolve after this frame's work, so warm-up continues in the next task.
      queueMicrotask(() => { for (const resolve of waiters) resolve(); });
    }
    if (this.contextLost) return;
    if (this.uploadQueue.length) this.uploadBatch();
    const programsBefore = this.renderer.info.programs?.length ?? 0;
    this.renderer.render(this.scene, this.camera);
    // A program created inside the visible frame is a stall the visitor sees.
    const compiled = (this.renderer.info.programs?.length ?? 0) - programsBefore;
    if (compiled > 0) {
      this.frameTelemetry.compilesInFrame += compiled;
      this.frameTelemetry.framesWithCompile++;
    }
    if (!this.environmentWarmupStarted) void this.warmEnvironment();
  }

  dispose(): void {
    this.disposed = true;
    this.uploadQueue.length = 0;
    for (const resolve of this.frameWaiters.splice(0)) resolve();
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.renderer.dispose();
  }
}

const UPLOAD_BYTES_PER_FRAME = 1_500_000;

function geometryBytes(object: THREE.Object3D): number {
  const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
  if (!geometry) return 0;
  let bytes = geometry.index?.array.byteLength ?? 0;
  for (const attribute of Object.values(geometry.attributes)) {
    bytes += (attribute as THREE.BufferAttribute).array?.byteLength ?? 0;
  }
  return bytes;
}

