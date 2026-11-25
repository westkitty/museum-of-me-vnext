import { floorLabelForZone } from '../ui/HUD';
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
import { registerIslandVisitorAssets } from '../assets/islandVisitorAssets';
import { registerHotDogManAssets } from '../assets/hotDogManAssets';
import { registerQuaterniusAssets } from '../assets/quaterniusAssets';
import { registerFullWeaselArtifact } from '../assets/fullWeaselArtifact';
import { registerCinemaAssets } from '../assets/cinemaAssets';
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
import { InputManager, touchLookGain } from '../player/Input';
import { PlayerController } from '../player/PlayerController';
import { zoneAtXYZ, ZONE_BY_ID, isOnFlightPad, exteriorLocationLabel, EXTERIOR_PLAZA_LABEL, ENTRANCE_PORTAL_Z, type ZoneId } from '../world/layout';
import { TICKET_KIOSK_ID } from '../world/exterior/TicketKiosk';
import { LIGHTHOUSE_LENS_ID } from '../world/exterior/ExteriorLighthouse';
import { OBSERVATORY_ORRERY_ID } from '../world/exterior/ExteriorObservatory';
import { ROOTBOUND_RELIC_ID } from '../world/exterior/ExteriorRootboundHollow';
import { GREENHOUSE_FLOWER_ID, ROOF_FLIGHT_PAD_II_TELEPORT_ID, isOnRooftopFlightPad, ROOF_FLIGHT_PAD_II_LAUNCH_SPEED } from '../world/exterior/rooftopLayout';
import { isInsideObsidianChamber } from '../world/exterior/ObsidianSphereEntrance';
import { START_POSITION } from '../world/start';
import type { StreamingManager } from '../exhibits/StreamingManager';

const TITLE_PREWARM_MIN_DWELL_MS = 4_000;
import { InteractionManager } from '../interaction/InteractionManager';
import { AudioManager } from '../audio/AudioManager';
import { AssetManager } from '../assets/AssetManager';
import type { DexterSanctuary } from '../exhibits/sanctuary/DexterSanctuary';
import { Sky } from '../world/Sky';
import { Wayfinding } from '../world/Wayfinding';
import type { AmbientVisitors } from '../world/AmbientVisitors';
import type { FlightPadAtmosphere } from '../world/FlightPadAtmosphere';
import { UILayer } from './UILayer';
import { ExteriorWorld } from '../world/exterior/ExteriorWorld';
import type { InteriorWorld } from '../world/InteriorWorld';
import { LongFrameRecorder } from './LongFrameRecorder';
import { SECRETS } from '../content/secrets';
import { SecretsLog } from '../state/Secrets';
import { SecretSpots, isSecretControlId, type SecretFind } from '../world/SecretSpots';
import { Passport } from '../state/Passport';
import { PocketWorldHost } from '../world/pocket/PocketWorldHost';
import { PocketWorldRegistry } from '../world/pocket/PocketWorldRegistry';
import { isPocketPortalControlId, type HostWorldId } from '../world/pocket/types';
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
  readonly wayfinding = new Wayfinding(this.scope);

  readonly exteriorWorld: ExteriorWorld;
  interiorWorld: InteriorWorld | null = null;
  readonly worldDirector: WorldDirector;
  readonly passport = new Passport();
  readonly pocketRegistry = new PocketWorldRegistry();
  readonly pocketHost: PocketWorldHost;
  /** Frames over 50 ms, with the world and phase they happened in (local only). */
  readonly longFrames = new LongFrameRecorder(() => ({ world: this.activeWorld, phase: this.worldDirector?.phase ?? 'starting' }));
  sceneRegistry: AuthorableSceneRegistry | null = null;

  readonly lighting: Lighting;
  readonly atmosphere: AtmosphereDirector;
  readonly input: InputManager;
  readonly player: PlayerController;
  readonly interaction = new InteractionManager();
  readonly audio = new AudioManager();
  /** Hidden things to find; saved on this device. */
  readonly secretsLog = new SecretsLog();
  readonly secrets = new SecretSpots(SECRETS, this.secretsLog, (find) => this.presentSecret(find));
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
  private museumPlacementsRoot: THREE.Object3D | null = null;
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
  /** The interior being built, before it becomes interiorWorld; dispose() stops it. */
  private buildingInterior: InteriorWorld | null = null;
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

  /**
   * The visitor's admission ticket. Admission replaces the old "Enter the
   * museum" button: the interior is prepared while the ticket prints, so the
   * load is hidden behind the kiosk. `?qa=1`/`?edit` sessions start holding
   * one so automated walks are not blocked; set it to null to test the gate.
   */
  ticket: { readonly number: string; readonly date: string; readonly issuedAtMs: number } | null = null;

  get isRoomCullingEnabled(): boolean {
    return this.roomCullingEnabled;
  }

  constructor(opts: AppOptions) {
    this.uiRoot = opts.uiRoot;
    this.a11yRoot = opts.a11yRoot;
    const query = new URLSearchParams(window.location.search);
    this.cinematicArrivalEnabled = !query.has('qa') && !query.has('edit');
    if (!this.cinematicArrivalEnabled) this.ticket = App.printTicket();
    // Workshop must see all authorable objects even when editing far-away bays.
    const workshopMode = import.meta.env.DEV && query.has('edit');
    this.roomCullingEnabled = !workshopMode;

    registerCuratedAssets();
    registerQuaterniusAssets();
    registerHotDogManAssets();
    registerIslandVisitorAssets();
    registerFullWeaselArtifact();
    registerCinemaAssets();
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--reliquary-shell', `url(${shellUrl})`);
      document.documentElement.style.setProperty('--reliquary-entrance', `url(${entranceUrl})`);
      document.documentElement.classList.add('reliquary-shell');
    }
    const loaded = loadPreferencesResult();
    this.preferences = loaded.preferences;
    this.audio.setVolumes(this.preferences.masterVolume, this.preferences.ambienceVolume, this.preferences.musicVolume);
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
    this.exteriorWorld = new ExteriorWorld(this.renderer.quality.tier, this.assets);
    this.renderer.scene.add(this.exteriorWorld.root);
    this.exteriorWorld.root.add(this.wayfinding.group);
    this.secrets.attachObjects('exterior', this.exteriorWorld.root, this.exteriorWorld.scope,
      (id, control) => this.interaction.register(id, control));
    const kiosk = this.exteriorWorld.ticketKiosk.build(() => this.issueTicket(), () => Boolean(this.ticket));
    this.exteriorWorld.root.add(kiosk.group);
    this.interaction.register(TICKET_KIOSK_ID, kiosk.control);
    if (this.ticket) this.exteriorWorld.ticketKiosk.markIssued();
    this.interaction.register(
      ROOTBOUND_RELIC_ID,
      this.exteriorWorld.rootboundHollow.getRelicControl((message) => this.ui.hud.announce(message, 8)),
    );

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
    this.pocketHost = new PocketWorldHost({
      registry: this.pocketRegistry, passport: this.passport, worldDirector: this.worldDirector,
      scene: this.scene, camera: this.camera, sky: this.sky, lighting: this.lighting,
      getMuseumPlacementsRoot: () => this.museumPlacementsRoot,
      exteriorWorld: this.exteriorWorld, getInteriorWorld: () => this.interiorWorld,
      player: this.player, input: this.input, interaction: this.interaction, audio: this.audio,
      assets: this.assets, getQuality: () => this.renderer.quality,
      isContextLost: () => this.renderer.isContextLost,
      canEnter: () => !workshopMode && (!this.cinematicArrivalEnabled || this.arrivalEntered),
      getCurrentZone: () => this.currentZone,
      setCurrentZone: (zone) => { this.currentZone = zone; },
      reducedMotion: () => this.preferences.reducedMotion,
      announce: (message, seconds) => this.ui?.hud.announce(message, seconds),
      getTransitionController: () => this.ui?.pocketTransition ?? null,
      onPocketStateChange: () => this.ui?.syncPocketState(),
    });
    this.registerPocketAnchors();
    this.longFrames.start();
    this.adaptiveResolution.setBasePixelRatio(this.renderer.basePixelRatio);

    // File-backed loaders
    this.assets.attachRenderer(this.renderer.renderer);

    this.input.on('interact', () => {
      if (!this.input.uiCaptured && this.interaction.activate()) {
        this.recordInteractionVisit();
        if (this.preferences.masterVolume > 0) this.audio.start();
        this.audio.tick();
      }
    });

    this.loop = new Loop(this);
    const cap = this.preferences.frameCap;
    this.loop.setFrameCap(cap === '30' ? 30 : cap === '60' ? 60 : 0);
    this.ui = new UILayer(this);
    this.lifecycle = new Lifecycle(this.loop, this.input, this.renderer, () => this.preferences, (message) => {
      this.ui.hud.announce(message);
    }, () => !this.ui.fullWeasel.isOpen, (reason) => {
      this.pocketHost.abortPendingEntry();
      if (reason === 'contextlost') this.pocketHost.exit({ reason: 'abort', viaVhsRewind: false });
      if (reason !== 'hidden' || this.preferences.autoPauseOnBlur) {
        this.audio.suspendForLifecycle(reason);
      }
    }, (reason) => {
      this.audio.resumeFromLifecycle(reason);
    });
  }

  private registerPocketAnchors(): void {
    const announce = (message: string) => this.ui.hud.announce(message, 8);
    const register = (id: string, world: 'L01' | 'W09' | 'W05', control: import('../exhibits/contract').ExhibitControl) => {
      this.interaction.register(id, this.pocketHost.createAnchorControl(world, control.object, {
        dormantLabel: control.label, dormantDescription: control.description,
        dormantActivate: control.activate,
      }));
    };
    register(LIGHTHOUSE_LENS_ID, 'L01', this.exteriorWorld.lighthouse.getLensControl(announce));
    register(OBSERVATORY_ORRERY_ID, 'W09', this.exteriorWorld.observatory.getOrreryControl(announce));
    for (const [id, control] of this.exteriorWorld.rooftop.getControls(announce)) {
      if (id === GREENHOUSE_FLOWER_ID) register(id, 'W05', control);
      else if (id === ROOF_FLIGHT_PAD_II_TELEPORT_ID) this.interaction.register(id, {
        ...control,
        label: () => this.pocketRegistry.isPlayable('W10', this.passport) ? 'Enter Breath of the Weasel' : 'Inspect Flight Pad II Console',
        activate: () => {
          if (this.pocketRegistry.isPlayable('W10', this.passport)) void this.pocketHost.requestEntry('W10');
          else if (this.pocketRegistry.isPlayable('W06', this.passport)) void this.pocketHost.requestEntry('W06');
          else control.activate();
        },
      });
      else this.interaction.register(id, control);
    }
  }

  recordInteractionVisit(): void {
    const id = this.interaction.currentFocus?.exhibitId;
    // Cinema seats, boards, dormant world anchors, the Rootbound relic, and rooftop interactables are not exhibits: keep out of visit journal.
    if (
      !id
      || isSecretControlId(id)
      || id === TICKET_KIOSK_ID
      || this.pocketHost.isActive
      || isPocketPortalControlId(id)
      || id === ROOTBOUND_RELIC_ID
      || id.startsWith('cinema-')
      || id.startsWith('rooftop-')
    ) return;
    this.journal.markVisited(id);
    this.visitThread.recordVisit(id);
  }

  /**
   * Dynamically loads and builds the interior museum world context.
   * Safe to call multiple times; returns the existing promise or instance.
   */
  async ensureInteriorLoaded(): Promise<InteriorWorld> {
    if (this.interiorWorld) return this.interiorWorld;
    if (this.interiorLoadingPromise) return this.interiorLoadingPromise;
    this.assertNotDisposed();
    this.worldDirector.interiorImportStarted = true;
    const telemetry = this.interiorLoadTelemetry;
    telemetry.requestedAtMs = performance.now();
    telemetry.buildStageMs = {};
    telemetry.lastFailure = null;
    const load = (async () => {
      let interior: InteriorWorld | null = null;
      try {
        const { InteriorWorld } = await import('../world/InteriorWorld');
        this.assertNotDisposed();
        telemetry.moduleLoadedAtMs = performance.now();
        telemetry.buildStartedAtMs = performance.now();
        interior = new InteriorWorld(this);
        this.buildingInterior = interior;
        await interior.buildCooperatively();
        this.assertNotDisposed();
        telemetry.buildCompletedAtMs = performance.now();
        this.interiorWorld = interior;
        interior.root.visible = this.activeWorld === 'interior';
        interior.setActive(this.activeWorld === 'interior');
        this.renderer.scene.add(interior.root);
        this.interiorWorldWarmed = false;
        this.interiorWarmPromise = this.renderer.warmWorld(interior.root)
          .catch((error) => console.warn('[App] interior warm-up incomplete', error))
          .finally(() => { this.interiorWorldWarmed = true; });
        this.worldDirector.interiorConstructed = true;
        this.scheduleAmbientPopulation(true);
        return interior;
      } catch (error) {
        interior?.dispose();
        telemetry.lastFailure = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.buildingInterior = null;
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

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('App disposed during interior preparation');
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

  /** Museum-only editor and navigation consumers retain their two-world contract. */
  get museumWorld(): HostWorldId {
    return this.worldDirector.museumWorld;
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

  private static printTicket(): { number: string; date: string; issuedAtMs: number } {
    const number = String(1000 + Math.floor(Math.random() * 9000));
    const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    return { number, date, issuedAtMs: performance.now() };
  }

  /**
   * Take a ticket at the kiosk. Printing starts the interior's preparation,
   * so by the time the visitor reaches the doors the galleries are open.
   */
  issueTicket(): boolean {
    if (this.ticket) return false;
    this.ticket = App.printTicket();
    this.exteriorWorld.ticketKiosk.markIssued();
    this.audio.tick(880);
    void this.worldDirector.prepareInterior().catch(() => undefined);
    return true;
  }

  /** Close the welcome without the readiness gate: the ticket now carries it. */
  dismissArrival(): void {
    this.cinematicArrivalEntered = true;
    this.cinematicCameraCancelled = true;
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

  /**
   * The exterior shares X/Z with the interior plan, so outside the visitor is
   * told which side of the building they are on, never an interior zone.
   */
  /** Floor named in the last spoken location, so a floor change is said aloud. */
  private announcedFloor: string | null = null;

  private updateLocationAnnouncement(eye: readonly [number, number, number], zoneChanged: boolean): void {
    const outside = this.isOutside;
    const worldChanged = outside !== this.zoneWasOutside;
    this.zoneWasOutside = outside;
    if (outside) {
      const label = exteriorLocationLabel(eye[0], this.player.position.y + 0.1, eye[2]);
      if (label === this.exteriorLabel && !worldChanged) return;
      this.exteriorLabel = label;
      this.ui?.mirror.announce(worldChanged ? `Entering ${label}.` : `${label}.`);
    } else if (zoneChanged || worldChanged) {
      const floor = floorLabelForZone(this.currentZone);
      this.ui?.mirror.announce(locationAnnouncement(this.zoneLabel, floor, this.announcedFloor));
      this.announcedFloor = floor;
    }
  }

  private presentSecret({ secret, found, total }: SecretFind): void {
    const quiet = Boolean(secret.quiet);
    this.ui?.hud.showSecret(secret.title, secret.line, found, total, quiet);
    this.ui?.mirror.announce(`${quiet ? 'Found' : 'Secret found'}: ${secret.title}. ${secret.line} ${found} of ${total} secrets found.`);
    if (!quiet) this.audio.secretChime();
  }

  private interiorWarmPromise: Promise<void> | null = null;
  private ambientPreloadPromise: Promise<void> | null = null;

  private yieldForAmbient(): Promise<void> {
    return this.renderer.waitForNextFrame(() => this.loop.isRunning && !this.disposed);
  }

  /** Begin off-screen ambient visitor preloading only after entering the interior. */
  onInteriorEntered(): void {
    const target = this.interiorWorld;
    if (!target || this.ambientPreloadPromise) return;
    this.ambientPreloadPromise = (async () => {
      await this.interiorWarmPromise;
      if (this.disposed || this.interiorWorld !== target) return;
      await this.preloadAmbientVisitors(target);
    })();
  }

  private async preloadAmbientVisitors(interior: InteriorWorld): Promise<void> {
    if (this.renderer.quality.ambientVisitors <= 0) return;
    try {
      const yieldFrame = () => this.yieldForAmbient();
      for (const prototype of await interior.visitors.preloadPrototypes(this.assets, yieldFrame)) {
        if (this.disposed || this.interiorWorld !== interior) return;
        await this.renderer.prewarmObject(prototype);
        if (this.disposed || this.interiorWorld !== interior) return;
        await this.renderer.uploadObject(prototype);
        await yieldFrame();
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
      const safeToPopulate = this.interiorWorldWarmed && (Boolean(allEntranceTargetsWarm)
        || (interiorVisible && titleWindowSpent));

      if (!interiorVisible || !this.interiorWorldWarmed || (!safeToPopulate && now < fallbackDeadline)) {
        this.ambientLoadTimer = window.setTimeout(tryPopulate, interiorVisible ? 200 : 500);
        return;
      }
      this.ambientLoadTimer = null;
      const target = this.interiorWorld;
      if (target && interiorVisible) {
        const yieldFrame = () => this.yieldForAmbient();
        this.onInteriorEntered();
        void (this.ambientPreloadPromise ?? Promise.resolve())
          .then(() => {
            if (this.disposed || this.interiorWorld !== target || this.activeWorld !== 'interior') return;
            return target.visitors.setPopulation(this.assets, this.renderer.quality.ambientVisitors, yieldFrame);
          })
          .catch((error) => {
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

  attachMuseumPlacements(root: THREE.Object3D): void {
    this.museumPlacementsRoot = root;
    this.scene.add(root);
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
      && !this.player.isSeated
      && !this.input.uiCaptured
      && this.player.grounded
    ) {
      if (
        this.activeWorld === 'interior'
        && isOnFlightPad(this.player.position.x, this.player.position.z, this.player.position.y)
      ) {
        this.player.enterFlight();
        this.ui?.hud.announce('Launched. Fly with W/A/S/D and look. Shift for speed. Land to walk again.');
      } else if (
        this.activeWorld === 'exterior'
        && !this.preferences.reducedMotion
        && isOnRooftopFlightPad(this.player.position.x, this.player.position.y, this.player.position.z)
      ) {
        this.player.enterFlight(ROOF_FLIGHT_PAD_II_LAUNCH_SPEED);
        this.ui?.hud.announce('Launched from Flight Pad II. Fly with W/A/S/D and look. Shift for speed. Land to walk again.');
      }
    }
    if (this.pocketHost.isActive) {
      this.player.fixedUpdate(dt);
      this.pocketHost.fixedUpdate(dt, this.player.writeEyePosition(this.eyePositionScratch));
      return;
    }
    // The obsidian chamber slows the visitor as if wading (eased, both ways).
    this.player.setInWater(this.activeWorld === 'exterior'
      && isInsideObsidianChamber(this.player.position.x, this.player.position.z));
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
    // uplift2(D): touch look follows its own sensitivity setting.
    const touchGain = touchLookGain(this.preferences.touchSensitivity, this.preferences.mouseSensitivity);
    this.player.applyLook(
      this.input.mouseDeltaX + this.input.touchDeltaX * touchGain + keyboardLook.dx,
      this.input.mouseDeltaY + this.input.touchDeltaY * touchGain + keyboardLook.dy,
      this.preferences.mouseSensitivity,
      this.preferences.invertY,
    );

    this.ui?.pocketTransition.update(dt);
    this.audio.update(dt);
    if (this.pocketHost.isActive) {
      if (this.pocketHost.usesMuseumSky) this.sky.follow(this.camera);
      this.interaction.update(this.camera, dt);
      this.pocketHost.variableUpdate(dt, this.player.writeEyePosition(this.eyePositionScratch));
      this.ui?.update(dt);
      this.input.endFrame();
      return;
    }

    if (this.cinematicArrivalEnabled && !this.cinematicCameraCancelled) {
      const moved = Math.abs(this.player.position.x - START_POSITION[0]) > 0.05
        || Math.abs(this.player.position.z - START_POSITION[2]) > 0.05;
      if (moved || this.input.pointerLocked || this.input.touchActive
        || this.currentZone !== 'plaza') {
        this.cinematicCameraCancelled = true;
      }
    }

    // Switch worlds first: a door crossing can carry the visitor across the
    // seam (SEAM_OFFSET_Z), and zone, culling and audio must see where they are now.
    this.worldDirector.update(this.player.position);
    const eye = this.player.writeEyePosition(this.eyePositionScratch);
    // currentZone is spatial: culling, streaming and atmosphere key off it in
    // both worlds. What the visitor is told is decided after the world switch.
    const zone = zoneAtXYZ(eye[0], this.player.position.y + 0.1, eye[2]);
    const zoneChanged = zone !== this.currentZone;
    if (zoneChanged) {
      this.currentZone = zone;
      this.audio.setZone(zone);
    }

    this.atmosphere.update(zone, dt, this.preferences.reducedMotion);
    this.interaction.update(this.camera, dt);
    this.workshopUpdate?.();
    this.developmentTool?.update(dt);
    this.developerOverlay?.update();

    this.updateLocationAnnouncement(eye, zoneChanged);
    this.secrets.update(this.isOutside ? 'exterior' : 'interior', this.player.position, this.currentZone);

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
    this.updateTicketCard();

    this.lighting.update(eye);

    this.diagnostics.stats.activeExhibits = this.streaming?.telemetry.active ?? 0;
    this.diagnostics.stats.streamingResident = this.streaming?.telemetry.resident ?? 0;

    const diagnosticPosition = this.diagnostics.stats.playerPosition;
    diagnosticPosition[0] = Math.round(this.player.position.x * 10) / 10;
    diagnosticPosition[1] = Math.round(this.player.position.y * 10) / 10;
    diagnosticPosition[2] = Math.round(this.player.position.z * 10) / 10;
    this.diagnostics.stats.wing = this.zoneLabel;

    const activeRoot = this.activeWorld === 'interior' ? this.interiorWorld?.root : this.exteriorWorld.root;
    if (activeRoot && this.wayfinding.group.parent !== activeRoot) activeRoot.add(this.wayfinding.group);
    const targetBeforeUpdate = this.wayfinding.currentTarget;
    this.wayfinding.updateXYZ(
      dt,
      this.player.position.x,
      this.player.position.y,
      this.player.position.z,
      this.preferences.reducedMotion,
      this.museumWorld,
      this.isOutside ? this.exteriorWorld.collision : this.interiorWorld?.collision,
    );
    if (targetBeforeUpdate && !this.wayfinding.currentTarget) this.ui.clearGuideOnArrival(targetBeforeUpdate);
    this.arrivalGarden.update(dt, this.preferences.reducedMotion);
    this.sky.follow(this.camera);

    this.ui?.update(dt);
    this.input.endFrame();
  }

  private updateTicketCard(): void {
    const hud = this.ui?.hud;
    if (!hud) return;
    // The card is shown on the forecourt only, and not in QA sessions that
    // begin with a ticket.
    if (!this.ticket || this.activeWorld !== 'exterior' || !this.cinematicArrivalEnabled
      || this.player.position.z < ENTRANCE_PORTAL_Z - 1 || this.player.position.z > ENTRANCE_PORTAL_Z + 60) {
      hud.showTicket(null);
      return;
    }
    const director = this.worldDirector;
    const failed = director.phase === 'PREPARATION_FAILED';
    const ready = this.interiorLoadTelemetry.entranceReadyAtMs !== null;
    hud.showTicket(this.ticket, failed ? 'The galleries could not be opened.'
      : ready ? 'Doors open. Walk on in.' : 'Printing… the galleries are opening.');
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
    // A YouTube screening is laid over the cinema screen as this frame's camera sees it.
    if (this.activeWorld === 'interior') this.interiorWorld?.cinema?.afterRender(this.camera, this.renderer.canvas);
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
    this.secrets.dispose();
    this.developmentTool?.dispose();
    this.developmentTool = null;
    this.developerOverlay?.dispose();
    this.developerOverlay = null;
    this.workshopUpdate = null;
    this.arrivalUpdate = null;
    this.environmentVisibility = null;
    if (this.ambientLoadTimer !== null) window.clearTimeout(this.ambientLoadTimer);
    this.ambientLoadTimer = null;
    this.pocketHost.dispose();
    this.ui?.dispose();
    this.audio.dispose();
    this.assets.dispose();
    this.exteriorWorld.dispose();
    this.interiorWorld?.dispose();
    this.buildingInterior?.dispose();
    this.sanctuary?.dispose();
    this.wayfinding.dispose();
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

/** Spoken location line. The floor is named whenever it changes, so screen-reader
 * visitors hear what the HUD shows visually ("Upper floor · …"). */
export function locationAnnouncement(zoneLabel: string, floor: string | null, previousFloor: string | null): string {
  return floor && floor !== previousFloor ? `Entering ${zoneLabel}, ${floor.toLocaleLowerCase()}.` : `Entering ${zoneLabel}.`;
}
