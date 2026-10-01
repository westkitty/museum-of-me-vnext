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
  private readonly onResize = () => this.resize();
  private readonly onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    console.warn('[RendererHost] WebGL context lost');
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    console.warn('[RendererHost] WebGL context restored');
    // The context took the shadow map's render target with it, so the map has
    // to be drawn again even though nothing in the scene moved.
    this.requestShadowRefresh();
    this.resize();
  };

  /**
   * Frames still owed a shadow-map redraw.
   *
   * The museum's only shadow-casting light is a fixed directional moonlight and
   * every shadow caster in the building is static — architecture is built with
   * `castShadow = false`; environment/wing dressing, garden dressing, exterior
   * identity panels and Workshop placements are the authored casters.
   * Re-rendering a 2048² depth map
   * plus a second full scene traversal every frame therefore buys nothing.
   * `shadowMap.autoUpdate` is off and the map is refreshed for a couple of
   * frames after boot, on a quality change, on context restore, and whenever a
   * caller adds new shadow-casting geometry.
   */
  private shadowRefreshFrames = 0;

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
    this.renderer.shadowMap.autoUpdate = false;
    this.applyShadowSettings();
    // The scene is still being assembled when this runs, so the first frames
    // are owed a refresh regardless of what is added afterwards.
    this.requestShadowRefresh();

    this.scene = new THREE.Scene();
    this.scene.name = 'museum';

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

  /**
   * Redraw the shadow map. Call after adding anything that casts a shadow, after
   * a quality change, and after the WebGL context comes back.
   */
  requestShadowRefresh(frames = 3): void {
    if (!this.settings.shadows) return;
    this.shadowRefreshFrames = Math.max(this.shadowRefreshFrames, Math.max(1, frames));
  }

  get shadowRefreshPending(): boolean {
    return this.shadowRefreshFrames > 0;
  }

  private applyShadowSettings(): void {
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.requestShadowRefresh();
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
    if (this.shadowRefreshFrames > 0) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowRefreshFrames--;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer.dispose();
  }
}
