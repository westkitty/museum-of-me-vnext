import { HUD } from '../ui/HUD';
import { MapPanel } from '../ui/MapPanel';
import { JournalPanel } from '../ui/JournalPanel';
import { DeepPanel } from '../ui/DeepPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { DiagnosticsOverlay } from '../ui/DiagnosticsOverlay';
import { DomMirror } from '../accessibility/DomMirror';
import { savePreferences, type VisitorPreferences } from '../state/Preferences';
import type { App } from './App';
import type { QualityTier } from '../render/QualityTiers';

/**
 * Assembles every DOM surface and binds it to the app. Kept out of App itself so
 * the composition root stays about systems rather than markup.
 */
export class UILayer {
  readonly hud: HUD;
  readonly map: MapPanel;
  readonly journal: JournalPanel;
  readonly deep: DeepPanel;
  readonly settings: SettingsPanel;
  readonly diagnostics: DiagnosticsOverlay;
  readonly mirror: DomMirror;

  private readonly unbind: (() => void)[] = [];

  constructor(private readonly app: App) {
    const { uiRoot, a11yRoot, input, interaction } = app;

    this.hud = new HUD(() => input.requestPointerLock());
    this.map = new MapPanel(
      app.journal,
      () => [app.player.position.x, app.player.position.y, app.player.position.z],
      () => app.zoneLabel,
    );
    this.deep = new DeepPanel(app.journal);
    this.journal = new JournalPanel(app.journal, (id) => this.deep.openFor(id));
    this.settings = new SettingsPanel({
      get: () => app.preferences,
      setQuality: (tier: QualityTier | 'auto') => app.setQuality(tier),
      update: (patch: Partial<VisitorPreferences>) => this.applyPreferences(patch),
    });
    this.diagnostics = new DiagnosticsOverlay(app.diagnostics);
    this.mirror = new DomMirror(a11yRoot, app.streaming, (id) => this.deep.openFor(id));

    uiRoot.append(
      this.hud.root,
      this.map.root,
      this.journal.root,
      this.deep.root,
      this.settings.root,
      this.diagnostics.root,
    );

    // A panel takes over input while it is open; movement stops and the mouse
    // is released so the visitor can actually use it.
    for (const panel of [this.map, this.journal, this.deep, this.settings]) {
      const originalOpen = panel.open.bind(panel);
      panel.open = () => {
        input.releasePointerLock();
        input.uiCaptured = true;
        app.player.setFrozen(true);
        originalOpen();
      };
      this.unbind.push(panel.onClose(() => this.releaseCapture()));
    }

    this.unbind.push(
      input.on('map', () => this.map.toggle()),
      input.on('journal', () => this.journal.toggle()),
      input.on('settings', () => this.settings.toggle()),
      input.on('diagnostics', () => this.diagnostics.toggle()),
      input.on('accessibility', () => this.mirror.focus()),
      interaction.onFocusChange((focus) => {
        this.hud.setFocus(focus);
        this.mirror.setCurrentExhibit(focus?.exhibitId ?? null);
      }),
      this.map.onTargetChange((exhibitId) => {
        app.wayfinding.setTarget(exhibitId);
        if (exhibitId) {
          this.hud.announce('Wayfinding set. A line on the floor points the way; it clears when you arrive.');
        }
      }),
      app.onAnnounce((exhibitId, message) => {
        if (app.preferences.subtitles) this.hud.announce(message);
        this.mirror.announce(message);
        this.mirror.setCurrentExhibit(exhibitId);
        this.mirror.refreshState();
      }),
    );

    this.unbind.push(
      input.on('interact', () => {
        const focus = interaction.currentFocus;
        if (focus) this.mirror.setCurrentExhibit(focus.exhibitId);
      }),
    );

    this.app.renderer.canvas.addEventListener('touchend', this.onTouchInteract);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    this.applyPreferences({});
  }

  private readonly onTouchInteract = (e: TouchEvent): void => {
    if (this.anyPanelOpen) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    if (Math.hypot(touch.clientX - cx, touch.clientY - cy) > 90) return;
    if (this.app.interaction.activate()) {
      const focus = this.app.interaction.currentFocus;
      if (focus) this.app.journal.markVisited(focus.exhibitId);
      this.app.audio.start();
      this.app.audio.tick();
    }
  };

  private readonly onPointerLock = (): void => {
    const locked = document.pointerLockElement === this.app.renderer.canvas;
    this.hud.setPointerLocked(locked);
    if (locked) {
      this.app.audio.start();
      this.app.audio.setZone(this.app.currentZone);
    }
  };

  private releaseCapture(): void {
    const anyOpen = [this.map, this.journal, this.deep, this.settings].some((p) => p.isOpen);
    if (anyOpen) return;
    this.app.input.uiCaptured = false;
    this.app.player.setFrozen(false);
  }

  /** Apply a preference patch immediately, then persist it. */
  applyPreferences(patch: Partial<VisitorPreferences>): void {
    Object.assign(this.app.preferences, patch);
    const p = this.app.preferences;

    document.documentElement.style.setProperty('--ui-scale', String(p.uiScale));
    document.documentElement.dataset.contrast = p.highContrast ? 'high' : 'normal';
    // The explicit in-app reduced-motion switch governs DOM transitions too;
    // the CSS media query remains a second independent system-level safeguard.
    document.documentElement.dataset.motion = p.reducedMotion ? 'reduced' : 'full';
    this.app.camera.fov = p.fieldOfView;
    this.app.camera.updateProjectionMatrix();
    this.app.audio.setVolumes(p.masterVolume, p.ambienceVolume);
    savePreferences(p);
  }

  /** Once per frame from the single loop. */
  update(dt: number): void {
    this.hud.setTouchMode(this.app.input.touchActive);
    this.hud.update(dt);
    this.hud.setLocation(this.app.currentZone);
    this.diagnostics.update(dt, {
      quality: this.app.renderer.quality.tier,
      controls: this.app.interaction.controlCount,
      audio: this.app.audio.isRunning ? 'on' : 'off',
      loads: this.app.streaming.telemetry.pendingLoads,
    });
  }

  get anyPanelOpen(): boolean {
    return [this.map, this.journal, this.deep, this.settings].some((p) => p.isOpen);
  }

  dispose(): void {
    this.app.renderer.canvas.removeEventListener('touchend', this.onTouchInteract);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    for (const off of this.unbind) off();
    this.hud.dispose();
    this.map.dispose();
    this.journal.dispose();
    this.deep.dispose();
    this.settings.dispose();
    this.diagnostics.dispose();
    this.mirror.dispose();
  }
}
