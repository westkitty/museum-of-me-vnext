import { HUD } from '../ui/HUD';
import { MapPanel } from '../ui/MapPanel';
import { JournalPanel } from '../ui/JournalPanel';
import { DeepPanel } from '../ui/DeepPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { DiagnosticsOverlay } from '../ui/DiagnosticsOverlay';
import { QACapture } from '../ui/QACapture';
import { DomMirror } from '../accessibility/DomMirror';
import { savePreferences, isSafeMode, type VisitorPreferences } from '../state/Preferences';
import { CuratorPanel } from '../ui/CuratorPanel';
import { StudyPanel } from '../ui/StudyPanel';
import { CommandPalette } from '../ui/CommandPalette';
import { FullWeaselPanel } from '../ui/FullWeaselPanel';
import { MuseumGuidePanel } from '../ui/MuseumGuidePanel';
import { VisitThreadPanel } from '../ui/VisitThreadPanel';
import { DeterministicMuseumGuide } from '../guide/DeterministicMuseumGuide';
import { SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, SOURCE_VISITORS } from '../content/sourceParity';
import { EXHIBITS_BY_ID, COLLECTION } from '../content/collection.generated';
import type { App } from './App';
import type { QualityTier } from '../render/QualityTiers';
import type { WingId } from '../content/types';
import { WINGS_BY_ID } from '../content/collection.generated';

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
  readonly qaCapture: QACapture | null;
  readonly mirror: DomMirror;
  readonly curator: CuratorPanel;
  readonly study: StudyPanel;
  readonly command: CommandPalette;
  readonly fullWeasel: FullWeaselPanel;
  readonly dexgptGuide: MuseumGuidePanel;
  readonly visitThread: VisitThreadPanel;

  private readonly unbind: (() => void)[] = [];
  private lastThreadStop: string | null = null;

  constructor(private readonly app: App) {
    const { uiRoot, a11yRoot, input, interaction } = app;
    const qaEnabled = new URLSearchParams(window.location.search).get('qa') === '1';

    this.hud = new HUD(() => input.requestPointerLock(), () => this.visitThread.open());
    this.map = new MapPanel(
      app.journal,
      () => [app.player.position.x, app.player.position.y, app.player.position.z],
      () => app.zoneLabel,
      () => app.visitThread.active,
      () => app.player.yaw,
      () => app.preferences,
      () => [
        ...app.sourceVisitors.positions(),
        ...app.visitors.positions(),
      ],
    );
    this.deep = new DeepPanel(app.journal);
    this.journal = new JournalPanel(app.journal, (id) => this.deep.openFor(id), () => this.visitThread.open());
    this.settings = new SettingsPanel({
      get: () => app.preferences,
      setQuality: (tier: QualityTier | 'auto') => app.setQuality(tier),
      update: (patch: Partial<VisitorPreferences>) => this.applyPreferences(patch),
    });
    this.diagnostics = new DiagnosticsOverlay(app.diagnostics);
    this.qaCapture = qaEnabled ? new QACapture(app) : null;
    this.mirror = new DomMirror(a11yRoot, app.streaming, (id) => this.deep.openFor(id), () => this.visitThread.open());
    this.curator = new CuratorPanel(app.journal, {
      guideTo: (id) => this.mapGuide(id),
      captureView: () => this.captureView(),
      copyLocation: () => this.copyLocation(),
      nextUnvisited: () => {
        const next = app.journal.nextUnvisited(COLLECTION.exhibits.map((e) => e.id));
        if (next) this.mapGuide(next);
        else this.hud.announce('Every exhibit in this visit journal has been opened.');
      },
      restorePrevious: () => app.journal.restorePrevious(),
      exportSession: () => this.exportSession(),
      importSession: (file) => this.importSession(file),
    });
    this.study = new StudyPanel(
      app.study,
      () => [
        ...SOURCE_INSTALLATIONS.map((i) => i.id),
        ...SOURCE_SUPPLEMENTARY.map((s) => s.id),
        ...SOURCE_VISITORS.map((v) => v.id),
        ...COLLECTION.exhibits.map((e) => e.id),
      ],
      (id) => EXHIBITS_BY_ID.get(id)?.copy.plaque
        ?? SOURCE_INSTALLATIONS.find((i) => i.id === id)?.summary
        ?? SOURCE_SUPPLEMENTARY.find((s) => s.id === id)?.summary
        ?? SOURCE_VISITORS.find((v) => v.id === id)?.lines.join(' ')
        ?? id,
    );
    this.command = new CommandPalette(
      (id) => this.mapGuide(id),
      () => [
        ...(app.currentZone === 'plaza' ? [] : [{ id: 'open-dexgpt-guide', label: 'Talk to DexGPT', detail: 'Local museum guide', keywords: 'guide project exhibit controls wings', run: () => this.openDexGPTGuide() }]),
        { id: 'open-map', label: 'Open map', detail: 'Wayfinding', keywords: 'guide walk', run: () => this.map.open() },
        { id: 'open-journal', label: 'Open journal', detail: 'Visit record', run: () => this.journal.open() },
        { id: 'open-curator', label: 'Open Curator Desk', detail: 'Records and recovery', run: () => this.curator.open() },
        { id: 'open-study', label: 'Open Study Lab', detail: 'Collections and comparison', run: () => this.study.open() },
        { id: 'open-thread', label: 'Open Visit Thread', detail: 'Local self-guided itinerary', keywords: 'tour route itinerary highlights systems making play', run: () => this.visitThread.open() },
        { id: 'next-unvisited', label: 'Guide to next unvisited', detail: 'Journal', run: () => {
          const next = app.journal.nextUnvisited(COLLECTION.exhibits.map((e) => e.id));
          if (next) this.mapGuide(next);
        } },
        { id: 'clear-guide', label: 'Clear guide', detail: 'Wayfinding', run: () => this.mapGuide(null) },
      ],
    );
    this.fullWeasel = new FullWeaselPanel();
    this.dexgptGuide = new MuseumGuidePanel(new DeterministicMuseumGuide(app.journal, app.visitThread), (id) => this.mapGuide(id));
    this.visitThread = new VisitThreadPanel(
      app.visitThread,
      app.journal,
      () => WINGS_BY_ID.has(app.currentZone as WingId) ? app.currentZone as WingId : null,
      (id) => this.mapGuide(id),
      (message) => this.hud.announce(message),
    );
    this.lastThreadStop = app.visitThread.currentStopId;
    // Thread state is user-visible UI state, not a frame-loop concern. Subscribe
    // directly so start/pause/skip/import/cross-tab reconciliation updates the
    // HUD and floor guide immediately even when rendering is suspended.
    this.unbind.push(app.visitThread.subscribe(() => this.syncVisitThread()));
    this.syncVisitThread();

    uiRoot.append(
      this.hud.root,
      this.map.root,
      this.journal.root,
      this.deep.root,
      this.settings.root,
      this.diagnostics.root,
      this.curator.root,
      this.study.root,
      this.command.root,
      this.fullWeasel.root,
      this.dexgptGuide.root,
      this.visitThread.root,
    );
    if (this.qaCapture) uiRoot.append(this.qaCapture.root);

    // ?qa=1 is a recording aid, not a different museum mode: it opens the
    // read-only diagnostics and manual evidence recorder without changing the
    // museum's world, movement, content, streaming, audio, or visitor state.
    if (qaEnabled) this.diagnostics.setVisible(true);

    // A panel takes over input while it is open; movement stops and the mouse
    // is released so the visitor can actually use it.
    for (const panel of [this.map, this.journal, this.deep, this.settings, this.curator, this.study, this.command, this.fullWeasel, this.dexgptGuide, this.visitThread]) {
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
      input.on('curator', () => this.curator.toggle()),
      input.on('study', () => this.study.toggle()),
      input.on('thread', () => this.visitThread.toggle()),
      input.on('command', () => this.command.toggle()),
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
    window.addEventListener('message', this.onEmbeddedMessage);
    window.addEventListener('storage', this.onVisitThreadStorage);
    this.applyPreferences({});
  }

  /** Called only by the E27 control through its bounded ExhibitContext hook. */
  openFullWeasel(): void {
    this.fullWeasel.open();
  }

  /** Wire the development-only Workshop affordance through the HUD. */
  setBuildModeControl(onToggle: (() => void) | null): void {
    this.hud.setBuildModeControl(onToggle);
  }

  setBuildModeActive(active: boolean): void {
    this.hud.setBuildModeActive(active);
  }

  openDexGPTGuide(): void {
    if (this.app.currentZone === 'plaza') {
      this.hud.announce('DexGPT becomes available once you enter the museum.');
      return;
    }
    this.dexgptGuide.open();
  }

  private readonly onEmbeddedMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== this.fullWeasel.frameWindow) return;
    if ((event.data as { type?: unknown } | null)?.type === 'full-weasel:close') {
      this.fullWeasel.close();
    }
  };

  private readonly onTouchInteract = (e: TouchEvent): void => {
    if (this.anyPanelOpen) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    if (Math.hypot(touch.clientX - cx, touch.clientY - cy) > 90) return;
    if (this.app.interaction.activate()) {
      const focus = this.app.interaction.currentFocus;
      if (focus) {
        this.app.journal.markVisited(focus.exhibitId);
        this.app.visitThread.recordVisit(focus.exhibitId);
      }
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

  private mapGuide(id: string | null): void {
    this.map.setTargetPublic(id);
    this.app.wayfinding.setTarget(id);
    this.app.journal.setGuideTarget(id ? { kind: 'exhibit', id } : undefined);
    if (id) this.hud.announce('Wayfinding set. A line on the floor points the way; it clears when you arrive.');
    else this.hud.announce('Guide cleared.');
  }

  private captureView(): void {
    const canvas = this.app.renderer.canvas;
    try {
      const data = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = data;
      a.download = `reliquary-view-${Date.now()}.png`;
      a.click();
      const sidecar = {
        at: new Date().toISOString(),
        position: this.app.player.position,
        exhibit: this.app.currentExhibitId,
      };
      const blob = new Blob([JSON.stringify(sidecar, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const meta = document.createElement('a');
      meta.href = url;
      meta.download = `reliquary-view-${Date.now()}.json`;
      meta.click();
      URL.revokeObjectURL(url);
      this.hud.announce('View captured with metadata sidecar.');
    } catch {
      this.hud.announce('View capture failed in this browser context.');
    }
  }

  private async copyLocation(): Promise<void> {
    const p = this.app.player.position;
    const fragment = `#x=${p.x.toFixed(2)}&y=${p.y.toFixed(2)}&z=${p.z.toFixed(2)}`;
    const href = `${location.href.split('#')[0]}${fragment}`;
    try {
      await navigator.clipboard.writeText(href);
      this.hud.announce('Location copied. A local-file fragment is also in the address bar.');
    } catch {
      this.hud.announce(`Clipboard unavailable. Location fragment: ${fragment}`);
    }
    history.replaceState(null, '', fragment);
  }

  private exportSession(): void {
    const payload = {
      format: 'reliquary-session',
      journal: this.app.journal.exportPayload(),
      study: this.app.study.state,
      preferences: this.app.preferences,
      visitThread: this.app.visitThread.exportPayload(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reliquary-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async importSession(file: File): Promise<string> {
    if (file.size > 512 * 1024) return 'Import is too large.';
    try {
      const parsed = JSON.parse(await file.text()) as { journal?: unknown; study?: unknown; visitThread?: unknown };
      const preview = window.confirm('Replace the current journal with this import? This can be undone via Restore previous save.');
      if (!preview) return 'Import cancelled.';
      const ok = parsed.journal ? this.app.journal.importPayload(parsed.journal, { replace: true }) : false;
      if (parsed.study) {
        const result = this.app.study.importRaw(JSON.stringify(parsed.study));
        if (result.ok && result.preview) this.app.study.applyImport(result.preview);
      }
      if (parsed.visitThread) {
        const result = this.app.visitThread.previewImport(JSON.stringify(parsed.visitThread));
        if (result.ok && result.state) this.app.visitThread.applyImport(result.state);
      }
      return ok ? 'Session imported. Use Restore previous save if this was a mistake.' : 'Journal import failed integrity or shape checks.';
    } catch {
      return 'Import is not valid JSON.';
    }
  }


  private syncVisitThread(): void {
    const active = this.app.visitThread.active;
    const current = this.app.visitThread.currentStopId;
    if (!active) {
      this.hud.setVisitThreadStatus(null);
      this.lastThreadStop = null;
      return;
    }
    const label = active.status === 'complete'
      ? `THREAD · ${active.title} · complete`
      : `THREAD · ${active.cursor + 1}/${active.stopIds.length} · ${EXHIBITS_BY_ID.get(current ?? '')?.title ?? 'paused'}`;
    this.hud.setVisitThreadStatus(label);
    if (current !== this.lastThreadStop) {
      if (active.status === 'active' && current) {
        this.mapGuide(current);
        this.hud.announce(`Visit Thread advanced. Next: ${EXHIBITS_BY_ID.get(current)?.title ?? current}.`);
      } else if (active.status === 'complete') {
        this.mapGuide(null);
        this.hud.announce('Visit Thread complete. The museum remains entirely open.');
      }
      this.lastThreadStop = current;
    }
  }

  private readonly onVisitThreadStorage = (event: StorageEvent): void => {
    if (event.key !== 'museum-of-me:visit-thread:v1' || !event.newValue) return;
    if (this.app.visitThread.reconcileExternal(event.newValue)) {
      this.hud.announce('Visit Thread reconciled with another tab.');
    }
  };

  private releaseCapture(): void {
    // Closing one panel must not hand input back while another is still open.
    if (this.anyPanelOpen) return;
    this.app.input.uiCaptured = false;
    this.app.player.setFrozen(false);
  }

  /** Apply a preference patch immediately, then persist it. */
  applyPreferences(patch: Partial<VisitorPreferences>): void {
    Object.assign(this.app.preferences, patch);
    const p = this.app.preferences;

    document.documentElement.style.setProperty('--ui-scale', String(p.uiScale));
    document.documentElement.style.setProperty('--hud-opacity', String(p.hudOpacity));
    document.documentElement.dataset.contrast = p.highContrast ? 'high' : 'normal';
    document.documentElement.dataset.transparency = p.reducedTransparency ? 'reduced' : 'normal';
    document.documentElement.dataset.density = p.interfaceDensity;
    document.documentElement.dataset.safe = isSafeMode() ? '1' : '0';
    const cap = p.frameCap;
    this.app.loop.setFrameCap(cap === '30' ? 30 : cap === '60' ? 60 : 0);
    void this.app.lifecycle?.syncWakeLock();
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

    if (!this.diagnostics.root.hidden) {
      const extra: Record<string, string | number> = {
        quality: this.app.renderer.quality.tier,
        controls: this.app.interaction.controlCount,
        audio: this.app.audio.isRunning ? 'on' : 'off',
        pointer: this.app.input.pointerLocked ? 'locked' : 'free',
        loads: this.app.streaming.telemetry.pendingLoads,
        exhibit: this.app.currentExhibitId ?? '—',
      };
      this.diagnostics.update(dt, extra);
    }
  }

  /**
   * Every modal surface, including the restored Curator, Study and command
   * panels. This is the single source of truth for "the UI owns input right
   * now": a touch or a pointer-lock request must never reach the world behind
   * an open panel, and capture must not be released while any panel is still
   * open.
   */
  get anyPanelOpen(): boolean {
    return this.modalPanels.some((p) => p.isOpen);
  }

  private get modalPanels(): { isOpen: boolean }[] {
    return [this.map, this.journal, this.deep, this.settings, this.curator, this.study, this.command, this.fullWeasel, this.dexgptGuide, this.visitThread];
  }

  dispose(): void {
    this.app.renderer.canvas.removeEventListener('touchend', this.onTouchInteract);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    window.removeEventListener('message', this.onEmbeddedMessage);
    window.removeEventListener('storage', this.onVisitThreadStorage);
    for (const off of this.unbind) off();
    this.hud.dispose();
    this.map.dispose();
    this.journal.dispose();
    this.deep.dispose();
    this.settings.dispose();
    this.diagnostics.dispose();
    this.qaCapture?.dispose();
    this.mirror.dispose();
    this.curator.dispose();
    this.study.dispose();
    this.command.dispose();
    this.fullWeasel.dispose();
    this.dexgptGuide.dispose();
    this.visitThread.dispose();
  }
}
