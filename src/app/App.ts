import * as THREE from 'three';
import { Loop, type LoopCallbacks } from './Loop';
import { Diagnostics } from './Diagnostics';
import { RendererHost } from '../render/RendererHost';
import { AdaptiveResolution } from '../render/AdaptiveResolution';
import { detectQualityTier, type QualityTier } from '../render/QualityTiers';
import { loadPreferencesResult, savePreferences, type VisitorPreferences } from '../state/Preferences';
import { Journal } from '../state/Journal';
import { Study } from '../state/Study';
import { VisitThread } from '../state/VisitThread';
import { Lifecycle } from './Lifecycle';
import type { SourceVisitors } from '../world/SourceVisitors';
import type { SupplementaryCases } from '../world/SupplementaryCases';
import type { SourceInstallations } from '../world/SourceInstallations';
import type { SourceArtwork } from '../world/SourceArtwork';
import { registerCuratedAssets, shellUrl, entranceUrl } from '../assets/curatedAssets';
import { registerQuaterniusAssets } from '../assets/quaterniusAssets';
import { registerFullWeaselArtifact } from '../assets/fullWeaselArtifact';
import {
  SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, SOURCE_VISITORS,
} from '../content/sourceParity';
import { EXHIBITS_BY_ID } from '../content/collection.generated';
import { ResourceScope } from '../assets/ResourceScope';
import type { Museum } from '../world/Museum';
import { getMuseumBuildCount } from '../world/museumBuildTracker';
import type { ArrivalGarden } from '../world/ArrivalGarden';
import { canEnterArrival, sampleArrivalCamera } from '../world/ArrivalCamera';
import { Lighting } from '../render/Lighting';
import { AtmosphereDirector } from '../render/AtmosphereDirector';
import { InputManager } from '../player/Input';
import { PlayerController } from '../player/PlayerController';
import { zoneAtXYZ, ZONE_BY_ID, isOnFlightPad, exteriorLocationLabel, EXTERIOR_PLAZA_LABEL, type ZoneId } from '../world/layout';
import { START_POSITION } from '../world/start';
import type { StreamingManager } from '../exhibits/StreamingManager';

const TITLE_PREWARM_MIN_DWELL_MS = 4_000;
import { InteractionManager } from '../interaction/InteractionManager';
import { AudioManager } from '../audio/AudioManager';
import { AssetManager } from '../assets/AssetManager';
import type { DexterSanctuary } from '../exhibits/sanctuary/DexterSanctuary';
import { Sky } from '../world/Sky';
import type { Wayfinding } from '../world/Wayfinding';
import type { AmbientVisitors } from '../world/AmbientVisitors';
import type { FlightPadAtmosphere } from '../world/FlightPadAtmosphere';
import { UILayer } from './UILayer';
import { ExteriorWorld } from '../world/exterior/ExteriorWorld';
import type { InteriorWorld } from '../world/InteriorWorld';
import { LongFrameRecorder } from './LongFrameRecorder';
import { WorldDirector, type WorldId } from './WorldDirector';
import type { AuthorableSceneRegistry } from '../workshop/AuthorableSceneRegistry';

export interface AppOptions {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  a11yRoot: HTMLElement;
}

/**
 * Composition root. Owns every shared subsystem, wires them to the single Loop,
 * and maintains the active world context seam.
 *
 * Cold startup is strictly EXTERIOR-FIRST: the island, terrain, shoreline, waters,
 * sky, and outdoor lighting initialize into a real playable world. Interior museum
 * construction (Museum.build(), 35 exhibit mount anchors, installations, visitors)
 * is dynamically deferred and loaded on approach or intent without freezing the app.
 */
export class App implements LoopCallbacks {
  readonly renderer: RendererHost;
  readonly loop: Loop;
  readonly diagnostics = new Diagnostics();
  private readonly adaptiveResolution = new AdaptiveResolution();
  readonly journal: Journal;
  readonly scope = new ResourceScope('app');

  readonly exteriorWorld: ExteriorWorld;
  interiorWorld: InteriorWorld | null = null;
  readonly worldDirector: WorldDirector;
  /** Frames over 50 ms, with the world and phase they happened in (local only). */
  readonly longFrames = new LongFrameRecorder(() => ({ world: this.activeWorld, phase: this.worldDirector?.phase ?? 'starting' }));
  sceneRegistry: AuthorableSceneRegistry | null = null;

  readonly lighting: Lighting;
  readonly atmosphere: AtmosphereDirector;
  readonly input: InputManager;
  readonly player: PlayerController;
  readonly interaction = new InteractionManager();
  readonly audio = new AudioManager();
  readonly assets = new AssetManager();
  readonly sky: Sky;
  readonly study: Study;
  readonly visitThread: VisitThread;
  lifecycle!: Lifecycle;
  ui!: UILayer;

  /** Zone the visitor is currently standing in. Drives audio and streaming. */
  currentZone: ZoneId = 'plaza';
  /** False while the interior's shaders and geometry are still being prepared off-screen. */
  interiorWorldWarmed: boolean | undefined;
  private exteriorLabel = EXTERIOR_PLAZA_LABEL;
  private zoneWasOutside = true;

  readonly uiRoot: HTMLElement;
  readonly a11yRoot: HTMLElement;

  preferences: VisitorPreferences;

  private disposed = false;
  private developmentTool: { update(dt: number): void; dispose(): void } | null = null;
  private developerOverlay: { update(): void; dispose(): void } | null = null;
  private workshopUpdate: (() => void) | null = null;
  private workshopCameraOverride: (() => void) | null = null;
  private environmentVisibility: ((zone: ZoneId, deep: boolean, wings: ReadonlySet<string>) => void) | null = null;
  private readonly roomCullingEnabled: boolean;
  private arrivalUpdate: (() => void) | null = null;
  private ambientLoadTimer: number | null = null;
  private diagnosticSampleElapsed = 0.1;
  private readonly eyePositionScratch: [number, number, number] = [0, 0, 0];
  private readonly cinematicArrivalEnabled: boolean;
  private readonly cinematicArrivalStartMs = performance.now();
  private cinematicArrivalEntered = false;
  private cinematicCameraCancelled = false;
  private interiorLoadingPromise: Promise<InteriorWorld> | null = null;
  readonly interiorLoadTelemetry = {
    requestedAtMs: null as number | null,
    moduleLoadedAtMs: null as number | null,
    buildStartedAtMs: null as number | null,
    buildCompletedAtMs: null as number | null,
    buildStageMs: {} as Record<string, number>,
    entranceReadyAtMs: null as number | null,
    transitionCommittedAtMs: null as number | null,
    firstInteriorFrameAtMs: null as number | null,
    lastFailure: null as string | null,
  };

  get isRoomCullingEnabled(): boolean {
    return this.roomCullingEnabled;
  }

  constructor(opts: AppOptions) {
    this.uiRoot = opts.uiRoot;
    this.a11yRoot = opts.a11yRoot;
    const query = new URLSearchParams(window.location.search);
    this.cinematicArrivalEnabled = !query.has('qa') && !query.has('edit');
    // Workshop must see all authorable objects even when editing far-away bays.
    this.roomCullingEnabled = !(import.meta.env.DEV && query.has('edit'));

    registerCuratedAssets();
    registerQuaterniusAssets();
    registerFullWeaselArtifact();
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--reliquary-shell', `url(${shellUrl})`);
      document.documentElement.style.setProperty('--reliquary-entrance', `url(${entranceUrl})`);
      document.documentElement.classList.add('reliquary-shell');
    }
    const loaded = loadPreferencesResult();
    this.preferences = loaded.preferences;
    this.audio.setVolumes(this.preferences.masterVolume, this.preferences.ambienceVolume);
    this.journal = new Journal();
    this.visitThread = new VisitThread();
    this.study = new Study(() => new Set([
      ...SOURCE_INSTALLATIONS.map((i) => i.id),
      ...SOURCE_SUPPLEMENTARY.map((s) => s.id),
      ...SOURCE_VISITORS.map((v) => v.id),
      ...EXHIBITS_BY_ID.keys(),
    ]));
    if (loaded.notice) this.journal.recoveryNotice = loaded.notice;

    const tier: QualityTier =
      this.preferences.quality === 'auto' ? detectQualityTier() : this.preferences.quality;

    this.renderer = new RendererHost(opts.canvas, tier);
    this.renderer.camera.fov = this.preferences.fieldOfView;
    this.renderer.camera.updateProjectionMatrix();

    document.documentElement.style.setProperty('--ui-scale', String(this.preferences.uiScale));

    // Exterior world context: island terrain, shoreline, water, lanterns, and outdoor collider
    this.exteriorWorld = new ExteriorWorld(this.renderer.quality.tier);
    this.renderer.scene.add(this.exteriorWorld.root);

    this.sky = new Sky(this.scope);
    this.renderer.scene.add(this.sky.mesh);

    this.lighting = new Lighting(this.scope, this.renderer.quality);
    this.renderer.scene.add(this.lighting.group);

    // Fog color matches the sky's horizon
    this.renderer.scene.fog = new THREE.Fog(this.sky.horizon.getHex(), 70, 300);
    this.atmosphere = new AtmosphereDirector(this.renderer.scene, this.renderer.renderer);

    this.input = new InputManager(opts.canvas);
    this.player = new PlayerController(this.exteriorWorld.collision, this.input);
    this.player.teleport(this.exteriorWorld.spawnPosition, this.exteriorWorld.spawnYaw);

    this.worldDirector = new WorldDirector(this);
    this.longFrames.start();
    this.adaptiveResolution.setBasePixelRatio(this.renderer.basePixelRatio);

    // File-backed loaders
    this.assets.attachRenderer(this.renderer.renderer);

    this.input.on('interact', () => {
      if (this.interaction.activate()) {
        const focus = this.interaction.currentFocus;
        if (focus) {
          this.journal.markVisited(focus.exhibitId);
          this.visitThread.recordVisit(focus.exhibitId);
        }
        this.audio.tick();
      }
    });

    this.loop = new Loop(this);
    const cap = this.preferences.frameCap;
    this.loop.setFrameCap(cap === '30' ? 30 : cap === '60' ? 60 : 0);
    this.ui = new UILayer(this);
    this.lifecycle = new Lifecycle(this.loop, this.input, this.renderer, () => this.preferences, (message) => {
      this.ui.hud.announce(message);
    }, () => !this.ui.fullWeasel.isOpen);
  }

  /**
   * Dynamically loads and builds the interior museum world context.
   * Safe to call multiple times; returns the existing promise or instance.
   */
  async ensureInteriorLoaded(): Promise<InteriorWorld> {
    if (this.interiorWorld) return this.interiorWorld;
    if (this.interiorLoadingPromise) return this.interiorLoadingPromise;
    this.worldDirector.interiorImportStarted = true;
    const telemetry = this.interiorLoadTelemetry;
    telemetry.requestedAtMs = performance.now();
    telemetry.buildStageMs = {};
    telemetry.lastFailure = null;
    const load = (async () => {
      let interior: InteriorWorld | null = null;
      try {
        const { InteriorWorld } = await import('../world/InteriorWorld');
        telemetry.moduleLoadedAtMs = performance.now();
        telemetry.buildStartedAtMs = performance.now();
        interior = new InteriorWorld(this);
        await interior.buildCooperatively();
        telemetry.buildCompletedAtMs = performance.now();
        this.interiorWorld = interior;
        interior.root.visible = this.activeWorld === 'interior';
        interior.setActive(this.activeWorld === 'interior');
        this.renderer.scene.add(interior.root);
        this.interiorWorldWarmed = false;
        const warmed = this.renderer.warmWorld(interior.root)
          .catch((error) => console.warn('[App] interior warm-up incomplete', error))
          .finally(() => { this.interiorWorldWarmed = true; });
        // Visitors join only once the visitor is inside; parse and compile their
        // models now so that moment is not a stall. The doorway does not wait for it.
        void warmed.then(() => this.preloadAmbientVisitors(interior!));
        this.worldDirector.interiorConstructed = true;
        this.scheduleAmbientPopulation(true);
        return interior;
      } catch (error) {
        interior?.dispose();
        telemetry.lastFailure = error instanceof Error ? error.message : String(error);
        throw error;
      }
    })();
    this.interiorLoadingPromise = load;
    try {
      return await load;
    } catch (error) {
      if (this.interiorLoadingPromise === load) this.interiorLoadingPromise = null;
      throw error;
    }
  }

  // ── Backward-compatible property accessors ────────────────────────────────

  get museum(): Museum | undefined {
    return this.interiorWorld?.museum;
  }

  get streaming(): StreamingManager | undefined {
    return this.interiorWorld?.streaming;
  }

  get sanctuary(): DexterSanctuary | undefined {
    return this.interiorWorld?.sanctuary;
  }

  get wayfinding(): Wayfinding | undefined {
    return this.interiorWorld?.wayfinding;
  }

  get visitors(): AmbientVisitors | undefined {
    return this.interiorWorld?.visitors;
  }

  get flightPadAtmosphere(): FlightPadAtmosphere | undefined {
    return this.interiorWorld?.flightPadAtmosphere;
  }

  get sourceVisitors(): SourceVisitors | undefined {
    return this.interiorWorld?.sourceVisitors;
  }

  get supplementary(): SupplementaryCases | undefined {
    return this.interiorWorld?.supplementary;
  }

  get sourceInstallations(): SourceInstallations | undefined {
    return this.interiorWorld?.sourceInstallations;
  }

  get sourceArtwork(): SourceArtwork | undefined {
    return this.interiorWorld?.sourceArtwork;
  }

  get arrivalGarden(): ArrivalGarden {
    return this.exteriorWorld.arrivalGarden;
  }

  // ── Active World & Telemetry Accessors ────────────────────────────────────

  get activeWorld(): WorldId {
    return this.worldDirector.activeWorld;
  }

  set activeWorld(val: WorldId) {
    this.worldDirector.activeWorld = val;
  }

  async switchToInterior(): Promise<boolean> {
    return this.worldDirector.switchToInterior();
  }

  switchToExterior(): boolean {
    return this.worldDirector.switchToExterior();
  }

  get interiorConstructed(): boolean {
    return this.worldDirector.interiorConstructed;
  }

  get interiorImportStarted(): boolean {
    return this.worldDirector.interiorImportStarted;
  }

  get exteriorReady(): boolean {
    return this.worldDirector.exteriorReady;
  }

  get firstExteriorInteractiveMs(): number {
    return this.worldDirector.firstExteriorInteractiveMs;
  }

  get museumBuildCount(): number {
    return getMuseumBuildCount();
  }

  /** Human-readable name of the space the visitor is in. */
  get zoneLabel(): string {
    if (this.isOutside) return this.exteriorLabel;
    return ZONE_BY_ID.get(this.currentZone)?.label ?? this.currentZone;
  }

  /** True while the visitor is in the exterior world. Interior zones are never reported then. */
  get isOutside(): boolean {
    return this.worldDirector.activeWorld === 'exterior';
  }

  /** The exhibit the visitor is currently standing in, if any. */
  get currentExhibitId(): string | null {
    const focus = this.interaction.currentFocus;
    if (focus) return focus.exhibitId;
    return this.streaming?.nearestActiveId(this.player.writeEyePosition(this.eyePositionScratch), 100) ?? null;
  }

  get scene(): THREE.Scene {
    return this.renderer.scene;
  }

  get camera(): THREE.PerspectiveCamera {
    return this.renderer.camera;
  }

  get titlePrewarmStatus() {
    return {
      minimumDwellMs: TITLE_PREWARM_MIN_DWELL_MS,
      ...(this.interiorWorld?.streaming?.entrancePrewarmStatus ?? {
        ready: true,
        ids: ['E32', 'E33', 'E30', 'E31'],
        total: 4,
        criticalTotal: 2,
        startedAtMs: this.cinematicArrivalStartMs,
      }),
    };
  }

  get arrivalReady(): boolean {
    if (!this.cinematicArrivalEnabled || this.cinematicArrivalEntered) return true;
    const status = this.titlePrewarmStatus;
    const elapsed = Math.max(0, performance.now() - (status.startedAtMs ?? this.cinematicArrivalStartMs));
    return canEnterArrival(elapsed, status.minimumDwellMs, status.ready);
  }

  get arrivalEntered(): boolean {
    return this.cinematicArrivalEntered;
  }

  enterArrival(): boolean {
    if (!this.arrivalReady) return false;
    this.cinematicArrivalEntered = true;
    this.cinematicCameraCancelled = true;
    return true;
  }

  setQuality(tier: QualityTier | 'auto'): void {
    this.preferences.quality = tier;
    this.renderer.setQuality(tier === 'auto' ? detectQualityTier() : tier);
    this.adaptiveResolution.reset();
    this.adaptiveResolution.setBasePixelRatio(this.renderer.basePixelRatio);
    const radius = this.renderer.quality.exhibitStreamRadius;
    this.streaming?.setRadii(radius + 14, radius + 30, radius);
    this.exteriorWorld.setQuality(this.renderer.quality.tier);
    this.scheduleAmbientPopulation(false);
    savePreferences(this.preferences);
  }

  private async preloadAmbientVisitors(interior: InteriorWorld): Promise<void> {
    if (this.renderer.quality.ambientVisitors <= 0) return;
    try {
      for (const prototype of await interior.visitors.preloadPrototypes(this.assets)) {
        await this.renderer.prewarmObject(prototype);
        await this.renderer.uploadObject(prototype);
      }
    } catch (error) {
      // setPopulation reports a real failure when it runs; this is only a head start.
      console.warn('[App] ambient visitor preload skipped', error);
    }
  }

  private scheduleAmbientPopulation(announceFailure: boolean): void {
    if (!this.interiorWorld) return;
    if (this.ambientLoadTimer !== null) window.clearTimeout(this.ambientLoadTimer);

    const started = performance.now();
    const titleWindowEnds = started + TITLE_PREWARM_MIN_DWELL_MS;
    const fallbackDeadline = titleWindowEnds + 4_000;
    const tryPopulate = (): void => {
      const now = performance.now();
      const prewarm = this.streaming?.telemetry;
      const allEntranceTargetsWarm = prewarm
        && prewarm.prewarmTotal > 0 && prewarm.prewarmWarmed === prewarm.prewarmTotal;
      const titleWindowSpent = now >= titleWindowEnds;
      const interiorVisible = this.activeWorld === 'interior';
      const safeToPopulate = Boolean(allEntranceTargetsWarm)
        || (interiorVisible && titleWindowSpent);

      if (!safeToPopulate && (now < fallbackDeadline || !interiorVisible)) {
        this.ambientLoadTimer = window.setTimeout(tryPopulate, interiorVisible ? 200 : 500);
        return;
      }
      this.ambientLoadTimer = null;
      if (this.interiorWorld && interiorVisible) {
        void this.interiorWorld.visitors.setPopulation(this.assets, this.renderer.quality.ambientVisitors).catch((error) => {
          console.error('Ambient visitors unavailable; no placeholder crowd was created.', error);
          if (announceFailure) this.ui.hud.announce('Ambient visitors are unavailable on this device.');
        });
      }
    };

    this.ambientLoadTimer = window.setTimeout(tryPopulate, 250);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  resumeFromEmbedded(): void {
    if (this.disposed || typeof document !== 'undefined' && document.hidden
      || this.renderer.isContextLost || this.lifecycle?.isSuspended) return;
    this.loop.start();
  }

  setArrivalUpdate(update: (() => void) | null): void {
    this.arrivalUpdate = update;
  }

  setWorkshopCameraOverride(update: (() => void) | null): void {
    this.workshopCameraOverride = update;
  }

  setWorkshopUpdate(update: (() => void) | null): void {
    this.workshopUpdate = update;
  }

  setDevelopmentTool(tool: { update(dt: number): void; dispose(): void }): void {
    if (this.disposed) { tool.dispose(); return; }
    this.developmentTool?.dispose();
    this.developmentTool = tool;
  }

  setDeveloperOverlay(tool: { update(): void; dispose(): void }): void {
    if (this.disposed) { tool.dispose(); return; }
    this.developerOverlay?.dispose();
    this.developerOverlay = tool;
  }

  setDevSkyTimeOfDay(hour: number | null): void {
    const preview = this.sky.setTimeOfDay(hour);
    this.lighting.setSkyPreview(preview);
    if (this.renderer.scene.fog instanceof THREE.Fog) {
      this.renderer.scene.fog.color.copy(this.sky.horizon);
    }
    this.renderer.requestShadowUpdate();
  }

  setEnvironmentVisibility(update: ((zone: ZoneId, deep: boolean, wings: ReadonlySet<string>) => void) | null): void {
    this.environmentVisibility = update;
  }

  // ── LoopCallbacks ─────────────────────────────────────────────────────────

  lastAnnouncement = '';

  announce(exhibitId: string, message: string): void {
    this.lastAnnouncement = message;
    for (const fn of this.announceListeners) fn(exhibitId, message);
  }

  private readonly announceListeners = new Set<(exhibitId: string, message: string) => void>();

  onAnnounce(fn: (exhibitId: string, message: string) => void): () => void {
    this.announceListeners.add(fn);
    return () => this.announceListeners.delete(fn);
  }

  fixedUpdate(dt: number): void {
    if (
      !this.player.flightMode
      && !this.player.isFrozen
      && !this.input.uiCaptured
      && this.player.grounded
      && isOnFlightPad(this.player.position.x, this.player.position.z)
    ) {
      this.player.enterFlight();
      this.ui?.hud.announce('Launched. Fly with W/A/S/D and look. Shift for speed. Land to walk again.');
    }
    this.player.fixedUpdate(dt);
    const fixedEye = this.player.writeEyePosition(this.eyePositionScratch);

    if (this.activeWorld === 'interior' && this.interiorWorld) {
      this.interiorWorld.fixedUpdate(dt, fixedEye, this.currentZone);
    }
    if (this.activeWorld === 'exterior') {
      this.exteriorWorld.fixedUpdate(dt);
    }
  }

  variableUpdate(dt: number): void {
    this.arrivalUpdate?.();
    if (this.activeWorld === 'exterior' && this.worldDirector.firstExteriorInteractiveMs === 0
      && (this.input.isDown('forward') || this.input.isDown('back')
        || this.input.isDown('left') || this.input.isDown('right'))) {
      this.worldDirector.firstExteriorInteractiveMs = performance.now();
    }
    const keyboardLook = this.input.keyboardLookReusable(dt, this.preferences.mouseSensitivity);
    this.player.applyLook(
      this.input.mouseDeltaX + this.input.touchDeltaX * 1.6 + keyboardLook.dx,
      this.input.mouseDeltaY + this.input.touchDeltaY * 1.6 + keyboardLook.dy,
      this.preferences.mouseSensitivity,
      this.preferences.invertY,
    );

    if (this.cinematicArrivalEnabled && !this.cinematicCameraCancelled) {
      const moved = Math.abs(this.player.position.x - START_POSITION[0]) > 0.05
        || Math.abs(this.player.position.z - START_POSITION[2]) > 0.05;
      if (moved || this.input.pointerLocked || this.input.touchActive
        || this.currentZone !== 'plaza') {
        this.cinematicCameraCancelled = true;
      }
    }

    const eye = this.player.writeEyePosition(this.eyePositionScratch);
    // The exterior shares X/Z with the interior plan: outside, the visitor is
    // always in the exterior ('plaza') zone, labelled by side of the building.
    const outside = this.isOutside;
    const zone = outside ? 'plaza' : zoneAtXYZ(eye[0], this.player.position.y + 0.1, eye[2]);
    if (outside) {
      const label = exteriorLocationLabel(eye[0], this.player.position.y + 0.1, eye[2]);
      if (label !== this.exteriorLabel) {
        this.exteriorLabel = label;
        if (this.currentZone === zone) this.ui?.mirror.announce(`${label}.`);
      }
    }
    if (zone !== this.currentZone || outside !== this.zoneWasOutside) {
      this.currentZone = zone;
      this.zoneWasOutside = outside;
      this.audio.setZone(zone);
      this.ui?.mirror.announce(`Entering ${this.zoneLabel}.`);
    }

    this.atmosphere.update(zone, dt, this.preferences.reducedMotion);
    this.interaction.update(this.camera, dt);
    this.workshopUpdate?.();
    this.developmentTool?.update(dt);
    this.developerOverlay?.update();

    this.worldDirector.update(this.player.position);

    if (this.interiorWorld) {
      if (this.activeWorld === 'interior') {
        const vis = this.interiorWorld.variableUpdate(dt, eye, zone, this.roomCullingEnabled);
        this.environmentVisibility?.(zone, vis.deep, vis.visibleWingIds);
      } else {
        this.interiorWorld.prepareUpdate(dt, eye, zone);
      }
    }
    if (this.activeWorld === 'exterior') {
      this.exteriorWorld.variableUpdate(dt, eye, zone, this.preferences.reducedMotion);
    }

    this.lighting.update(eye);

    this.diagnostics.stats.activeExhibits = this.streaming?.telemetry.active ?? 0;
    this.diagnostics.stats.streamingResident = this.streaming?.telemetry.resident ?? 0;

    const diagnosticPosition = this.diagnostics.stats.playerPosition;
    diagnosticPosition[0] = Math.round(this.player.position.x * 10) / 10;
    diagnosticPosition[1] = Math.round(this.player.position.y * 10) / 10;
    diagnosticPosition[2] = Math.round(this.player.position.z * 10) / 10;
    this.diagnostics.stats.wing = this.zoneLabel;

    if (this.wayfinding) {
      this.wayfinding.updateXYZ(
        dt,
        this.player.position.x,
        this.player.position.y,
        this.player.position.z,
        this.preferences.reducedMotion,
      );
    }
    this.arrivalGarden.update(dt, this.preferences.reducedMotion);
    this.sky.follow(this.camera);

    this.ui?.update(dt);
    this.input.endFrame();
  }

  render(alpha: number): void {
    this.player.applyToCamera(this.camera, alpha);
    if (this.cinematicArrivalEnabled && !this.cinematicArrivalEntered
      && !this.cinematicCameraCancelled && !this.preferences.reducedMotion
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const prewarm = this.titlePrewarmStatus;
      const elapsed = performance.now() - (prewarm.startedAtMs ?? this.cinematicArrivalStartMs);
      const offset = sampleArrivalCamera(elapsed, prewarm.minimumDwellMs);
      this.camera.position.y += offset.rise;
      this.camera.position.z += offset.retreat;
      this.camera.rotation.x += offset.pitch;
      this.sky.follow(this.camera);
    }
    this.workshopCameraOverride?.();
    this.renderer.render();
    if (!this.renderer.isContextLost && this.activeWorld === 'interior'
      && this.interiorLoadTelemetry.firstInteriorFrameAtMs === null) {
      this.interiorLoadTelemetry.firstInteriorFrameAtMs = performance.now();
    }
    this.diagnosticSampleElapsed += this.loop.frameTimeMs / 1000;
    if (this.diagnosticSampleElapsed >= 0.1) {
      this.diagnosticSampleElapsed = 0;
      this.diagnostics.sample(this.renderer.renderer, this.loop.fps, this.loop.wallFrameTimeMs);
    }
  }

  afterFrame(wallMs: number, fixedMs: number, variableMs: number, renderCpuMs: number, fixedSteps: number): void {
    this.diagnostics.recordFrame(wallMs, fixedMs, variableMs, renderCpuMs, fixedSteps);
    if (this.preferences.quality === 'auto' && this.preferences.frameCap !== '30'
      && this.loop.isRunning && !this.ui?.fullWeasel.isOpen) {
      const next = this.adaptiveResolution.update(wallMs, fixedMs + variableMs + renderCpuMs);
      if (next !== null) this.renderer.setResolutionScale(next);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.longFrames.stop();
    this.developmentTool?.dispose();
    this.developmentTool = null;
    this.developerOverlay?.dispose();
    this.developerOverlay = null;
    this.workshopUpdate = null;
    this.arrivalUpdate = null;
    this.environmentVisibility = null;
    if (this.ambientLoadTimer !== null) window.clearTimeout(this.ambientLoadTimer);
    this.ambientLoadTimer = null;
    this.ui?.dispose();
    this.audio.dispose();
    this.assets.dispose();
    this.exteriorWorld.dispose();
    this.interiorWorld?.dispose();
    this.sanctuary?.dispose();
    this.wayfinding?.dispose();
    this.visitors?.dispose();
    this.flightPadAtmosphere?.dispose();
    this.sourceVisitors?.dispose();
    this.supplementary?.dispose();
    this.sourceArtwork?.dispose();
    this.sourceInstallations?.dispose();
    this.lifecycle?.dispose();
    this.streaming?.dispose();
    this.interaction.dispose();
    this.input.dispose();
    this.lighting.dispose();
    this.scope.dispose();
    this.renderer.dispose();
  }
}
