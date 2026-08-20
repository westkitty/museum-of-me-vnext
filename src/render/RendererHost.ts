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
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
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
    this.renderer.dispose();
  }
}
