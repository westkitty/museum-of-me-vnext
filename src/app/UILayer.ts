import { HUD } from '../ui/HUD';
import { VisitorMenuPanel } from '../ui/VisitorMenuPanel';
import { applyVisitorSession, exportVisitorSession, previewVisitorSession, restoreVisitorSession, SESSION_MAX_BYTES } from '../state/VisitorSession';
import { SECRETS } from '../content/secrets';
import { museumLink } from '../content/collectionLinks';
import { MUSEUM_ENTRANCE_TARGET } from '../world/Wayfinding';
import { CenterTapTracker } from './CenterTapTracker';
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
import { CinemaConsole, CinemaCuratorPanel, CinemaProgrammePanel, type ExternalConsent } from '../ui/CinemaPanel';
import { CINEMA_PROGRAMME_DATA, type Programme } from '../cinema/programme';
import { CinemaDrafts, type DraftEntry } from '../cinema/curatorDraft';
import { MuseumGuidePanel } from '../ui/MuseumGuidePanel';
import { VisitThreadPanel } from '../ui/VisitThreadPanel';
import { PassportPanel } from '../ui/PassportPanel';
import { PocketTransition } from '../ui/PocketTransition';
import { PASSPORT_KEY } from '../state/Passport';
import { JOURNAL_KEY } from '../state/Journal';
import { persistenceHealth } from '../state/PersistenceHealth';
import { DeterministicMuseumGuide } from '../guide/DeterministicMuseumGuide';
import { SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, SOURCE_VISITORS } from '../content/sourceParity';
import { EXHIBITS_BY_ID, COLLECTION } from '../content/collection.generated';
import type { App } from './App';
import type { QualityTier } from '../render/QualityTiers';
import type { WingId } from '../content/types';
import { WINGS_BY_ID } from '../content/collection.generated';
import { GROUND_Y, LEVEL_1_Y, PLACEMENT_BY_EXHIBIT, WING_BY_ID } from '../world/layout';
import { exhibitWalkDistance } from '../world/visitorRoute';
import { mapLevelForY } from '../ui/MapPanel';

/**
 * Assembles every DOM surface and binds it to the app. Kept out of App itself so
 * the composition root stays about systems rather than markup.
 */
export class UILayer {
  readonly hud: HUD;
  readonly passport: PassportPanel;
  readonly pocketTransition: PocketTransition;
  readonly map: MapPanel;
  readonly visitorMenu: VisitorMenuPanel;
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
  readonly cinemaProgramme: CinemaProgrammePanel;
  readonly cinemaConsole: CinemaConsole;
  readonly cinemaCurator: CinemaCuratorPanel;
  /** This browser's YouTube drafts (never the published programme). */
  readonly cinemaDrafts: CinemaDrafts;
  /** The visitor's acceptance of the YouTube notice, for this visit (session). */
  readonly youtubeConsent: ExternalConsent;
  private youtubeConsentGiven = readSessionFlag(YOUTUBE_CONSENT_KEY);
  private hudElapsed = 1 / 30;
  private embeddedPaused = false;
  private disposing = false;
  readonly dexgptGuide: MuseumGuidePanel;
  readonly visitThread: VisitThreadPanel;

  private readonly unbind: (() => void)[] = [];
  private lastThreadStop: string | null = null;
  private readonly centerTap = new CenterTapTracker();

  constructor(private readonly app: App) {
    const { uiRoot, a11yRoot, input, interaction } = app;
    const qaEnabled = new URLSearchParams(window.location.search).get('qa') === '1';

    this.hud = new HUD((touch) => {
      if (!app.enterArrival()) return false;
      if (touch) input.touchActive = true;
      else input.requestPointerLock();
      return true;
    }, () => this.visitThread.open(),
    () => { app.issueTicket(); },
    () => window.location.reload(),
    () => app.worldDirector.dismissThresholdPrompt(),
    () => this.visitorMenu.open(),
    () => this.openPassport(),
    () => app.pocketHost.exit());
    this.passport = new PassportPanel(app.passport, app.pocketRegistry,
      () => app.pocketHost.isActive, () => app.pocketHost.activeDefinition?.title ?? null,
      () => app.pocketHost.exit());
    this.pocketTransition = new PocketTransition({
      camera: app.camera, input, player: app.player, reducedMotion: () => app.preferences.reducedMotion,
    });
    this.unbind.push(app.passport.subscribe(() => this.syncPocketState()));
    this.syncPocketState();
    this.hud.setArrivalReadiness(app.arrivalReady);
    this.map = new MapPanel(
      app.journal,
      () => [app.player.position.x, app.player.position.y, app.player.position.z],
      () => app.zoneLabel,
      () => app.visitThread.active,
      () => app.player.yaw,
      () => app.preferences,
      () => [
        ...(app.sourceVisitors?.positions() ?? []),
        ...(app.visitors?.positions() ?? []),
      ],
      () => app.isOutside,
      () => app.isOutside ? app.exteriorWorld.collision : app.interiorWorld?.collision,
    );
    this.deep = new DeepPanel(app.journal, (id) => this.guideToExhibit(id), (id) => exhibitLocation(app, id));
    this.journal = new JournalPanel(app.journal, (id) => this.deep.openFor(id), () => this.visitThread.open(), {
      secrets: SECRETS,
      isFound: (id) => app.secretsLog.has(id),
    });
    this.settings = new SettingsPanel({
      get: () => app.preferences,
      setQuality: (tier: QualityTier | 'auto') => app.setQuality(tier),
      update: (patch: Partial<VisitorPreferences>) => this.applyPreferences(patch),
    });
    this.diagnostics = new DiagnosticsOverlay(app.diagnostics);
    this.qaCapture = qaEnabled ? new QACapture(app) : null;
    this.mirror = new DomMirror(a11yRoot, () => app.streaming, (id) => this.deep.openFor(id), () => this.visitThread.open());
    this.curator = new CuratorPanel(app.journal, {
      guideTo: (id) => this.mapGuide(id),
      captureView: () => this.captureView(),
      copyExhibitLink: () => this.copyExhibitLink(),
      nextUnvisited: () => {
        const next = app.journal.nextUnvisited(COLLECTION.exhibits.map((e) => e.id));
        if (next) this.mapGuide(next);
        else this.hud.announce('Every exhibit in this visit journal has been opened.');
      },
      restorePrevious: () => app.journal.restorePrevious(),
      restoreSession: () => this.restoreSession(),
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
      (id) => this.deep.openFor(id),
    );
    this.command = new CommandPalette(
      (id) => this.mapGuide(id),
      () => [
        ...(app.isOutside ? [] : [{ id: 'open-dexgpt-guide', label: 'Talk to DexGPT', detail: 'Local museum guide', keywords: 'guide project exhibit controls wings', run: () => this.openDexGPTGuide() }]),
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
    this.cinemaDrafts = new CinemaDrafts(safeLocalStorage(), () => CINEMA_PROGRAMME_DATA);
    this.youtubeConsent = {
      given: () => this.youtubeConsentGiven,
      accept: () => {
        this.youtubeConsentGiven = true;
        writeSessionFlag(YOUTUBE_CONSENT_KEY);
        const player = app.interiorWorld?.cinema?.playback;
        if (player) player.externalConsent = true;
      },
    };
    this.cinemaProgramme = new CinemaProgrammePanel(
      () => this.cinemaProgrammeNow(),
      (filmId) => { void app.interiorWorld?.cinema?.choose(filmId); },
      () => app.interiorWorld?.cinema?.playback.film?.id ?? null,
      this.youtubeConsent,
      () => this.cinemaCurator.open(),
    );
    this.cinemaCurator = new CinemaCuratorPanel({
      drafts: this.cinemaDrafts,
      published: () => this.cinemaProgrammeNow(),
      consent: this.youtubeConsent,
      promote: import.meta.env.DEV ? promoteCinemaDrafts : null,
    });
    this.cinemaConsole = new CinemaConsole({
      programme: () => this.openCinemaProgramme(),
      toggle: () => { void app.interiorWorld?.cinema?.playback.toggle(); },
      restart: () => app.interiorWorld?.cinema?.playback.restart(),
      skip: (seconds) => app.interiorWorld?.cinema?.playback.skip(seconds),
      seek: (seconds) => app.interiorWorld?.cinema?.playback.seek(seconds),
      captions: (on) => app.interiorWorld?.cinema?.playback.setCaptions(on),
      sound: (on) => app.interiorWorld?.cinema?.playback.setSound(on),
      stand: () => app.interiorWorld?.cinema?.stand(),
      providerControls: (on) => app.interiorWorld?.cinema?.overlay?.setInteractive(on),
    });
    this.fullWeasel = new FullWeaselPanel();
    this.unbind.push(this.fullWeasel.onClose(() => {
      if (this.disposing) return;
      this.app.streaming?.setBackgroundPaused(false);
      if (!this.embeddedPaused) return;
      this.embeddedPaused = false;
      this.app.resumeFromEmbedded();
    }));
    this.dexgptGuide = new MuseumGuidePanel(new DeterministicMuseumGuide(app.journal, app.visitThread, () => ({
      exhibitId: app.currentExhibitId, zoneLabel: app.zoneLabel,
      position: app.isOutside ? null : [app.player.position.x, app.player.position.y, app.player.position.z] as const,
    })), (id) => this.mapGuide(id), () => guideContextQuestion(app));
    this.visitThread = new VisitThreadPanel(
      app.visitThread,
      app.journal,
      () => !app.isOutside && WINGS_BY_ID.has(app.currentZone as WingId) ? app.currentZone as WingId : null,
      (id) => this.mapGuide(id),
      (message) => this.hud.announce(message),
    );
    // Touch visitors have no keyboard: every tool the hint line names by key
    // (H contents, C curator, clearing the floor line) needs a button here.
    this.visitorMenu = new VisitorMenuPanel(() => [
      { label: 'Map', open: () => this.map.open() },
      { label: 'Journal', open: () => this.journal.open() },
      ...(app.passport.unlockedUi ? [{ label: 'Passport', open: () => this.openPassport() }] : []),
      app.isOutside
        ? { label: 'Guide to the entrance', open: () => this.mapGuide(MUSEUM_ENTRANCE_TARGET) }
        : { label: 'Guide', open: () => this.openDexGPTGuide() },
      ...(app.wayfinding.currentTarget ? [{ label: 'Clear the floor line', open: () => this.mapGuide(null) }] : []),
      { label: 'Visit Thread', open: () => this.visitThread.open() },
      { label: 'Read every exhibit (text)', open: () => this.mirror.focus() },
      { label: 'Curator Desk', open: () => this.curator.open() },
      { label: 'Settings', open: () => this.settings.open() },
    ]);
    this.lastThreadStop = null;
    // Thread state is user-visible UI state, not a frame-loop concern. Subscribe
    // directly so start/pause/skip/import/cross-tab reconciliation updates the
    // HUD and floor guide immediately even when rendering is suspended.
    this.unbind.push(app.visitThread.subscribe(() => this.syncVisitThread()));

    uiRoot.append(
      this.hud.root,
      this.passport.root,
      this.pocketTransition.root,
      this.visitorMenu.root,
      this.map.root,
      this.journal.root,
      this.deep.root,
      this.settings.root,
      this.diagnostics.root,
      this.curator.root,
      this.study.root,
      this.command.root,
      this.fullWeasel.root,
      this.cinemaProgramme.root,
      this.cinemaCurator.root,
      this.cinemaConsole.root,
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
    for (const panel of [this.map, this.journal, this.deep, this.settings, this.curator, this.study, this.command, this.fullWeasel, this.cinemaProgramme, this.cinemaCurator, this.dexgptGuide, this.visitThread, this.visitorMenu, this.passport]) {
      const originalOpen = panel.open.bind(panel);
      panel.open = () => {
        if (app.pocketHost.isActive && panel !== this.passport) return;
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
      input.on('passport', () => {
        if (this.passport.isOpen) this.passport.close();
        else this.openPassport();
      }),
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
        const guide = exhibitId && EXHIBITS_BY_ID.has(exhibitId) ? { kind: 'exhibit' as const, id: exhibitId } : undefined;
        if (app.journal.guideTarget?.id !== guide?.id) app.journal.setGuideTarget(guide);
        if (exhibitId === MUSEUM_ENTRANCE_TARGET) this.hud.announce('Follow the path to the front door.');
        else if (guide) this.hud.announce(guideStartAnnouncement(app, guide.id), 8);
        else this.hud.announce('Guide cleared.');
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

    this.app.renderer.canvas.addEventListener('touchstart', this.onTouchStart);
    this.app.renderer.canvas.addEventListener('touchmove', this.onTouchMove);
    this.app.renderer.canvas.addEventListener('touchcancel', this.onTouchCancel);
    this.app.renderer.canvas.addEventListener('touchend', this.onTouchInteract);
    document.addEventListener('pointerlockchange', this.onPointerLock);
    window.addEventListener('message', this.onEmbeddedMessage);
    window.addEventListener('storage', this.onVisitThreadStorage);
    // uplift2(E): say once, in plain words, when this device stops keeping the visitor's records.
    this.unbind.push(persistenceHealth.onChange((message) => { if (message) this.hud.announce(message, 12); }));
    const savedGuide = app.journal.guideTarget;
    if (savedGuide?.kind === 'exhibit' && EXHIBITS_BY_ID.has(savedGuide.id)) {
      this.mapGuide(savedGuide.id);
      this.lastThreadStop = app.visitThread.active?.status === 'active' ? app.visitThread.currentStopId : null;
    }
    this.syncVisitThread();
    this.applyPreferences({});
  }

  /** Called only by the E27 control through its bounded ExhibitContext hook. */
  openFullWeasel(): void {
    if (this.fullWeasel.isOpen) return;
    this.fullWeasel.open();
    this.app.streaming?.setBackgroundPaused(true);
    if (this.app.loop.isRunning) {
      this.embeddedPaused = true;
      this.app.stop();
    }
  }

  /** The published programme plus this browser's drafts, validated together. */
  cinemaProgrammeNow(): Programme {
    return this.cinemaDrafts.programme();
  }

  /** The cinema programme: from the lobby board, a seat, or the seated controls. */
  openCinemaProgramme(): void {
    if (this.cinemaProgramme.isOpen) return;
    this.cinemaProgramme.open();
  }

  /** Wire the development-only Workshop affordance through the HUD. */
  setBuildModeControl(onToggle: (() => void) | null): void {
    this.hud.setBuildModeControl(onToggle);
  }

  setBuildModeActive(active: boolean): void {
    this.hud.setBuildModeActive(active);
  }

  openDexGPTGuide(): void {
    if (this.app.isOutside) {
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

  private readonly onTouchStart = (e: TouchEvent): void => {
    this.centerTap.start(e.changedTouches, e.touches.length, window.innerWidth, window.innerHeight);
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    this.centerTap.move(e.changedTouches, e.touches.length);
  };

  private readonly onTouchCancel = (): void => { this.centerTap.cancel(); };

  private readonly onTouchInteract = (e: TouchEvent): void => {
    const tap = this.centerTap.end(e.changedTouches);
    if (!tap || this.anyPanelOpen || this.app.input.uiCaptured) return;
    if (this.app.interaction.activate()) {
      this.app.recordInteractionVisit();
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

  guideToExhibit(id: string): void {
    this.mapGuide(id);
  }

  private mapGuide(id: string | null): void {
    if (this.map.currentTarget !== id) this.map.setTargetPublic(id);
  }

  clearGuideOnArrival(target?: string | null): void {
    this.map.clearTargetOnArrival();
    if (this.app.journal.guideTarget?.kind === 'exhibit') this.app.journal.setGuideTarget(undefined);
    this.hud.announce(arrivalAnnouncement(target ?? null));
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

  private async copyExhibitLink(): Promise<string> {
    const id = this.app.currentExhibitId ?? this.map.currentTarget;
    if (!id || !EXHIBITS_BY_ID.has(id)) return 'Choose an exhibit on the map or walk up to one to copy its link.';
    const href = museumLink({ exhibit: id });
    try {
      await navigator.clipboard.writeText(href);
      return 'Exhibit link copied.';
    } catch {
      return href;
    }
  }

  private exportSession(): void {
    const blob = new Blob([exportVisitorSession(this.app)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reliquary-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async importSession(file: File): Promise<string> {
    if (file.size > SESSION_MAX_BYTES) return 'Session file is too large.';
    try {
      const preview = previewVisitorSession(await file.text(), this.app);
      if (!window.confirm(`Import ${preview.description}? The museum will reload. You can undo the entire import from Curator Desk.`)) {
        return 'Import cancelled.';
      }
      applyVisitorSession(window.localStorage, preview.values);
      window.location.reload();
      return 'Session imported.';
    } catch (error) {
      if (error instanceof SyntaxError) return 'Session file is not valid JSON.';
      return error instanceof Error ? error.message : 'Session import failed.';
    }
  }

  private restoreSession(): string {
    if (!window.confirm('Restore the whole session from before your last import? The museum will reload.')) {
      return 'Restore cancelled.';
    }
    try {
      if (!restoreVisitorSession(window.localStorage)) return 'No previous session import is available.';
      window.location.reload();
      return 'Previous session restored.';
    } catch (error) {
      return error instanceof Error ? error.message : 'Session restore failed.';
    }
  }

  private syncVisitThread(): void {
    const active = this.app.visitThread.active;
    const current = active?.status === 'active' ? this.app.visitThread.currentStopId : null;
    if (!active) this.hud.setVisitThreadStatus(null);
    else {
      const status = active.status === 'active'
        ? `${active.cursor + 1}/${active.stopIds.length} · ${EXHIBITS_BY_ID.get(current ?? '')?.title ?? ''}`
        : active.status;
      this.hud.setVisitThreadStatus(`THREAD · ${active.title} · ${status}`);
    }
    if (current === this.lastThreadStop) return;

    const previous = this.lastThreadStop;
    this.lastThreadStop = current;
    if (current) this.mapGuide(current);
    else if (previous && this.map.currentTarget === previous) this.mapGuide(null);
  }

  private openPassport(): void {
    if (this.app.passport.unlockedUi && !this.pocketTransition.isPromptOpen) this.passport.open();
  }

  syncPocketState(): void {
    const { passport, pocketHost } = this.app;
    this.hud.setPassportStatus(passport.unlockedUi, passport.earnedCount, passport.totalStamps);
    this.hud.setPocketWorldState(pocketHost.isActive);
    if (pocketHost.isActive) {
      this.hud.setThresholdStatus(false, '');
      this.hud.showTicket(null);
    }
  }

  private readonly onVisitThreadStorage = (event: StorageEvent): void => {
    // uplift2(E): another tab wrote the journal — fold it in so neither tab's visits are lost.
    if (event.key === JOURNAL_KEY) {
      this.app.journal.reconcileExternal(event.newValue);
      return;
    }
    if (event.key === PASSPORT_KEY) {
      this.app.passport.reconcileExternal(event.newValue);
      return;
    }
    if (event.key !== 'museum-of-me:visit-thread:v1' || !event.newValue) return;
    if (this.app.visitThread.reconcileExternal(event.newValue)) {
      this.hud.announce('Visit Thread reconciled with another tab.');
    }
  };

  private releaseCapture(): void {
    // These booleans belong to the built-in modal group. External modals hold
    // independent ownership tokens; retaining our booleans for them would leak
    // this group's capture after its last panel closes.
    if (this.modalPanels.some(panel => panel.isOpen)) return;
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
    this.hudElapsed += dt;
    if (this.hudElapsed < 1 / 30) return;
    const elapsed = this.hudElapsed;
    this.hudElapsed = 0;
    this.hud.setTouchMode(this.app.input.touchActive);
    this.hud.setArrivalReadiness(this.app.arrivalReady);
    this.hud.update(elapsed);
    const pocketTitle = this.app.pocketHost.activeDefinition?.title;
    this.hud.setLocation(this.app.currentZone, pocketTitle ?? (this.app.isOutside ? this.app.zoneLabel : undefined),
      pocketTitle ? 'Pocket world' : undefined);

    if (!this.diagnostics.root.hidden) {
      const extra: Record<string, string | number> = {
        world: this.app.activeWorld,
        phase: this.app.worldDirector.phase,
        quality: this.app.renderer.quality.tier,
        controls: this.app.interaction.controlCount,
        audio: this.app.audio.isRunning ? 'on' : 'off',
        pointer: this.app.input.pointerLocked ? 'locked' : 'free',
        loads: this.app.streaming?.telemetry.pendingLoads ?? 0,
        mountMs: (this.app.streaming?.telemetry.lastMountMs ?? 0).toFixed(1),
        warmMs: (this.app.streaming?.telemetry.lastWarmMs ?? 0).toFixed(1),
        shaderMs: this.app.renderer.warmTelemetry.lastCompileWallMs.toFixed(1),
        textureMs: this.app.renderer.warmTelemetry.lastTextureInitCpuMs.toFixed(1),
        dpr: this.app.renderer.effectivePixelRatio.toFixed(2),
        longFrames: this.app.longFrames.summary(),
        exhibit: this.app.currentExhibitId ?? '—',
      };
      this.diagnostics.update(elapsed, extra);
    }
  }

  /**
   * Every modal surface, including the restored Curator, Study and command
   * panels. This is the single source of truth for "the UI owns input right
   * now": a touch or a pointer-lock request must never reach the world behind
   * an open panel, and capture must not be released while any panel is still
   * open.
   */
  private readonly externalPanels = new Set<{ isOpen: boolean }>();

  registerModal(panel: { isOpen: boolean }): () => void {
    this.externalPanels.add(panel);
    return () => { this.externalPanels.delete(panel); };
  }

  get anyPanelOpen(): boolean {
    return this.pocketTransition.isPromptOpen || [...this.modalPanels, ...this.externalPanels].some((p) => p.isOpen);
  }

  private get modalPanels(): { isOpen: boolean }[] {
    return [this.map, this.journal, this.deep, this.settings, this.curator, this.study, this.command, this.fullWeasel, this.cinemaProgramme, this.cinemaCurator, this.dexgptGuide, this.visitThread, this.visitorMenu, this.passport];
  }

  dispose(): void {
    this.disposing = true;
    this.app.renderer.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.app.renderer.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.app.renderer.canvas.removeEventListener('touchcancel', this.onTouchCancel);
    this.app.renderer.canvas.removeEventListener('touchend', this.onTouchInteract);
    document.removeEventListener('pointerlockchange', this.onPointerLock);
    window.removeEventListener('message', this.onEmbeddedMessage);
    window.removeEventListener('storage', this.onVisitThreadStorage);
    for (const off of this.unbind) off();
    this.pocketTransition.dispose();
    this.passport.dispose();
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
    this.cinemaProgramme.dispose();
    this.cinemaCurator.dispose();
    this.cinemaConsole.root.remove();
    this.dexgptGuide.dispose();
    this.visitThread.dispose();
    this.visitorMenu.dispose();
  }
}

/** What the floor line says when it is done: where the visitor now stands and
 * what to do next, instead of a bare "You have arrived." */
export function arrivalAnnouncement(target: string | null): string {
  if (target === MUSEUM_ENTRANCE_TARGET) return 'You have arrived at the museum entrance. Walk on through the doors.';
  const record = target ? EXHIBITS_BY_ID.get(target) : undefined;
  if (!record) return 'You have arrived.';
  return `You have arrived at ${record.id} · ${record.title}. Step inside the bay; press F at the lectern or anything that lights up.`;
}

/** Where a room is relative to the visitor, in walking terms. */
export function exhibitLocation(
  app: Pick<App, 'isOutside' | 'player' | 'currentExhibitId'>, exhibitId: string,
): string | null {
  const placement = PLACEMENT_BY_EXHIBIT.get(exhibitId);
  if (!placement) return null;
  const floor = (WING_BY_ID.get(placement.wing)?.level ?? 0) === 1 ? 'upper floor' : 'ground floor';
  if (app.isOutside) return `Inside the museum, on the ${floor}. Walk in through the main doors.`;
  if (app.currentExhibitId === exhibitId) return `You are in this room, on the ${floor}.`;
  const p = app.player.position;
  const metres = exhibitWalkDistance([p.x, p.y, p.z], exhibitId);
  const here = mapLevelForY(p.y);
  const level = (WING_BY_ID.get(placement.wing)?.level ?? 0);
  const stairs = here !== level ? (level === 1 ? ', up a grand stair' : ', down a grand stair') : '';
  return Number.isFinite(metres) && metres > 0
    ? `On the ${floor}: about ${Math.max(5, Math.round(metres / 5) * 5)} m on foot from here${stairs}.`
    : `On the ${floor}.`;
}

export function guideStartAnnouncement(
  app: Pick<App, 'isOutside' | 'player' | 'currentExhibitId'>, target: string,
): string {
  if (target === MUSEUM_ENTRANCE_TARGET) return 'Follow the path to the front door.';
  const record = EXHIBITS_BY_ID.get(target);
  if (!record) return 'Follow the floor lights.';
  const where = exhibitLocation(app, target);
  return `Follow the floor lights to ${record.title}.${where ? ` ${where}` : ''}`;
}

/** The DexGPT suggestion that fits where the visitor stands. */
export function guideContextQuestion(app: Pick<App, 'isOutside' | 'player'>): string | null {
  if (app.isOutside) return null;
  const y = app.player.position.y;
  if (y >= LEVEL_1_Y - 2) return 'How do I get downstairs?';
  if (y < GROUND_Y - 1) return 'How do I get back to the Rotunda?';
  return 'How do I get upstairs?';
}

const YOUTUBE_CONSENT_KEY = 'museum-of-me:cinema-youtube-consent';

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readSessionFlag(key: string): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Storage refused: the answer still holds for this page.
  }
}

/**
 * Development server only (tree-shaken from production builds; the release
 * verifier checks the route never ships): promote drafts into
 * data/cinema/programme.json through scripts/cinema-programme-plugin.ts.
 */
async function promoteCinemaDrafts(drafts: readonly DraftEntry[]): Promise<{ ok: boolean; message: string }> {
  if (!import.meta.env.DEV) return { ok: false, message: 'Saving is available only on the development server.' };
  try {
    const response = await fetch('/__museum-cinema/programme', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drafts }),
    });
    const body = await response.json() as { ok?: boolean; added?: string[]; errors?: string[]; error?: string };
    if (response.ok && body.ok) {
      return { ok: true, message: `Saved ${body.added?.length ?? 0} screening(s) to data/cinema/programme.json after checking them with YouTube. Commit that file to publish them.` };
    }
    return { ok: false, message: `Not saved: ${(body.errors ?? [body.error ?? `HTTP ${response.status}`]).join('; ')}` };
  } catch (error) {
    return { ok: false, message: `Not saved: ${error instanceof Error ? error.message : 'the development server did not answer'}` };
  }
}
