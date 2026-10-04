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
  private contextLost = false;
  private disposed = false;
  private environmentWarmupStarted = false;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
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
    this.applyShadowSettings();
    this.resize();
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

  private async warmEnvironment(): Promise<void> {
    if (this.environmentWarmupStarted || this.disposed) return;
    this.environmentWarmupStarted = true;
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
      this.scene.environment = target.texture;
    } catch (error) {
      console.error('[RendererHost] deferred environment warmup failed', error);
    }
  }

  resize(): void {
    // A hidden or not-yet-laid-out surface can report zero, which would produce
    // a zero-size drawing buffer and a NaN aspect ratio. Hold the last good
    // size instead of rendering into nothing.
    const w = Math.max(1, window.innerWidth || this.canvas.clientWidth || 1);
    const h = Math.max(1, window.innerHeight || this.canvas.clientHeight || 1);
    const dpr = Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    if (this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
    if (!this.environmentWarmupStarted) void this.warmEnvironment();
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
    this.renderer.dispose();
  }
}
