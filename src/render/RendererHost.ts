import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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
  private readonly environmentTarget: THREE.WebGLRenderTarget;
  private readonly onResize = () => this.resize();
  private readonly onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    console.warn('[RendererHost] WebGL context lost');
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    console.warn('[RendererHost] WebGL context restored');
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

    // One small PMREM gives every Standard/Physical material coherent reflected
    // light without a runtime reflection pass or network HDR dependency.
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.42;
    room.dispose();
    pmrem.dispose();

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
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
