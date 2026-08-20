import * as THREE from 'three';
import { Loop, type LoopCallbacks } from './Loop';
import { Diagnostics } from './Diagnostics';
import { RendererHost } from '../render/RendererHost';
import { detectQualityTier, type QualityTier } from '../render/QualityTiers';
import { loadPreferences, savePreferences, type VisitorPreferences } from '../state/Preferences';
import { Journal } from '../state/Journal';
import { ResourceScope } from '../assets/ResourceScope';

export interface AppOptions {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  a11yRoot: HTMLElement;
}

/**
 * Composition root. Owns every subsystem, wires them to the single Loop, and is
 * the only place where subsystem construction order is decided.
 */
export class App implements LoopCallbacks {
  readonly renderer: RendererHost;
  readonly loop: Loop;
  readonly diagnostics = new Diagnostics();
  readonly journal: Journal;
  readonly scope = new ResourceScope('app');

  readonly uiRoot: HTMLElement;
  readonly a11yRoot: HTMLElement;

  preferences: VisitorPreferences;

  private disposed = false;

  constructor(opts: AppOptions) {
    this.uiRoot = opts.uiRoot;
    this.a11yRoot = opts.a11yRoot;

    this.preferences = loadPreferences();
    this.journal = new Journal();

    const tier: QualityTier =
      this.preferences.quality === 'auto' ? detectQualityTier() : this.preferences.quality;

    this.renderer = new RendererHost(opts.canvas, tier);
    this.renderer.camera.fov = this.preferences.fieldOfView;
    this.renderer.camera.updateProjectionMatrix();

    document.documentElement.style.setProperty('--ui-scale', String(this.preferences.uiScale));

    this.loop = new Loop(this);
  }

  get scene(): THREE.Scene {
    return this.renderer.scene;
  }

  get camera(): THREE.PerspectiveCamera {
    return this.renderer.camera;
  }

  setQuality(tier: QualityTier | 'auto'): void {
    this.preferences.quality = tier;
    this.renderer.setQuality(tier === 'auto' ? detectQualityTier() : tier);
    savePreferences(this.preferences);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  // ── LoopCallbacks ─────────────────────────────────────────────────────────

  fixedUpdate(_dt: number): void {
    // Phase 3 wires player + collision + active exhibits here.
  }

  variableUpdate(_dt: number): void {
    // Phase 3 wires audio zones, streaming and interaction focus here.
  }

  render(_alpha: number): void {
    this.renderer.render();
    this.diagnostics.sample(this.renderer.renderer, this.loop.fps);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.scope.dispose();
    this.renderer.dispose();
  }
}
