import * as THREE from 'three';
import { Loop, type LoopCallbacks } from './Loop';
import { Diagnostics } from './Diagnostics';
import { RendererHost } from '../render/RendererHost';
import { detectQualityTier, type QualityTier } from '../render/QualityTiers';
import { loadPreferencesResult, savePreferences, type VisitorPreferences } from '../state/Preferences';
import { Journal } from '../state/Journal';
import { Study } from '../state/Study';
import { VisitThread } from '../state/VisitThread';
import { Lifecycle } from './Lifecycle';
import { SourceVisitors } from '../world/SourceVisitors';
import { SupplementaryCases } from '../world/SupplementaryCases';
import { SourceInstallations, INSTALLATION_HELD_CODES } from '../world/SourceInstallations';
import { SourceArtwork } from '../world/SourceArtwork';
import { registerCuratedAssets, shellUrl, entranceUrl } from '../assets/curatedAssets';
import { registerQuaterniusAssets } from '../assets/quaterniusAssets';
import { registerFullWeaselArtifact } from '../assets/fullWeaselArtifact';
import {
  SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, SOURCE_VISITORS,
} from '../content/sourceParity';
import { EXHIBITS_BY_ID } from '../content/collection.generated';
import { ResourceScope } from '../assets/ResourceScope';
import { Museum } from '../world/Museum';
import { ArrivalGarden } from '../world/ArrivalGarden';
import { Lighting } from '../render/Lighting';
import { InputManager } from '../player/Input';
import { PlayerController } from '../player/PlayerController';
import { zoneAtXYZ, ZONE_BY_ID, isOnFlightPad, type ZoneId } from '../world/layout';
import { START_POSITION, START_YAW } from '../world/start';
import { installExhibits } from '../exhibits';
import { StreamingManager } from '../exhibits/StreamingManager';
import { InteractionManager } from '../interaction/InteractionManager';
import { AudioManager } from '../audio/AudioManager';
import { AssetManager } from '../assets/AssetManager';
import { DexterSanctuary } from '../exhibits/sanctuary/DexterSanctuary';
import { Sky } from '../world/Sky';
import { Wayfinding } from '../world/Wayfinding';
import { AmbientVisitors } from '../world/AmbientVisitors';
import { FlightPadAtmosphere } from '../world/FlightPadAtmosphere';
import { UILayer } from './UILayer';

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
  readonly museum: Museum;
  readonly arrivalGarden: ArrivalGarden;
  readonly lighting: Lighting;
  readonly input: InputManager;
  readonly player: PlayerController;
  readonly interaction = new InteractionManager();
  readonly streaming: StreamingManager;
  readonly audio = new AudioManager();
  readonly assets = new AssetManager();
  /** Outside the 35. Dexter is not a project and this is not an exhibit. */
  readonly sanctuary: DexterSanctuary;
  readonly sky: Sky;
  readonly wayfinding: Wayfinding;
  readonly visitors: AmbientVisitors;
  readonly flightPadAtmosphere: FlightPadAtmosphere;
  readonly sourceVisitors: SourceVisitors;
  readonly supplementary: SupplementaryCases;
  readonly sourceInstallations: SourceInstallations;
  readonly sourceArtwork: SourceArtwork;
  readonly study: Study;
  readonly visitThread: VisitThread;
  lifecycle!: Lifecycle;
  ui!: UILayer;
  /** Zone the visitor is currently standing in. Drives audio and streaming. */
  currentZone: ZoneId = 'plaza';

  readonly uiRoot: HTMLElement;
  readonly a11yRoot: HTMLElement;

  preferences: VisitorPreferences;

  private disposed = false;
  private workshopUpdate: (() => void) | null = null;
  private ambientLoadTimer: number | null = null;
  private diagnosticSampleElapsed = 0.1;
  private lightingResidencyRevision = -1;
  private readonly eyePositionScratch: [number, number, number] = [0, 0, 0];

  constructor(opts: AppOptions) {
    this.uiRoot = opts.uiRoot;
    this.a11yRoot = opts.a11yRoot;

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

    this.museum = new Museum(this.scope);
    const built = this.museum.build();
    this.renderer.scene.add(built.root);

    this.arrivalGarden = new ArrivalGarden(this.scope, built.collision);
    this.renderer.scene.add(this.arrivalGarden.build());

    this.sanctuary = new DexterSanctuary(this.scope);
    this.renderer.scene.add(this.sanctuary.group);

    this.sky = new Sky(this.scope);
    this.renderer.scene.add(this.sky.mesh);

    this.wayfinding = new Wayfinding(this.scope);
    this.renderer.scene.add(this.wayfinding.group);

    this.visitors = new AmbientVisitors(this.scope, this.renderer.quality.ambientVisitors);
    this.renderer.scene.add(this.visitors.group);

    this.flightPadAtmosphere = new FlightPadAtmosphere(this.scope);
    this.renderer.scene.add(this.flightPadAtmosphere.group);

    this.lighting = new Lighting(this.scope, this.renderer.quality);
    this.renderer.scene.add(this.lighting.group);

    // The fog's colour is the sky's horizon, so distance reads as air rather
    // than as the building fading into a void.
    this.renderer.scene.fog = new THREE.Fog(this.sky.horizon.getHex(), 70, 300);

    this.input = new InputManager(opts.canvas);
    this.player = new PlayerController(built.collision, this.input);
    this.player.teleport(START_POSITION, START_YAW);

    // File-backed loaders are wired even though the museum ships procedural
    // assets, so an authentic project artifact can be carried in at any point.
    this.assets.attachRenderer(this.renderer.renderer);

    installExhibits();
    this.streaming = new StreamingManager(
      built.exhibitMounts,
      {
        addControl: (id, control) => this.interaction.register(id, control),
        announce: (id, message) => this.announce(id, message),
        reducedMotion: () => this.preferences.reducedMotion,
        detailScale: () => this.renderer.quality.detailScale,
        loadAsset: async (assetId, scope, detail) =>
          (await this.assets.load(assetId, scope, { detail })).object,
        openEmbeddedExperience: (id) => {
          if (id === 'full-weasel') this.ui?.openFullWeasel();
        },
      },
      {
        loadRadius: this.renderer.quality.exhibitStreamRadius + 14,
        unloadRadius: this.renderer.quality.exhibitStreamRadius + 30,
        activateRadius: this.renderer.quality.exhibitStreamRadius,
        mountsPerFrame: 1,
      },
    );
    this.streaming.initialise();

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

    this.sourceArtwork = new SourceArtwork(this.scope, built.exhibitMounts);
    this.renderer.scene.add(this.sourceArtwork.group);

    this.sourceVisitors = new SourceVisitors(
      this.scope,
      built.collision,
      this.interaction,
      (visitor, line, thought) => {
        this.journal.hearVisitor(visitor.id);
        this.journal.recordHistory({ kind: 'visitor', id: visitor.id }, visitor.title);
        const message = thought ? `${line} (${thought})` : line;
        this.announce(`visitor:${visitor.id}`, `${visitor.title}: ${message}`);
      },
    );
    this.renderer.scene.add(this.sourceVisitors.group);

    this.supplementary = new SupplementaryCases(
      this.scope,
      this.interaction,
      this.journal,
      (id, title, summary) => this.announce(`supplementary:${id}`, `${title}. ${summary}`),
    );
    this.renderer.scene.add(this.supplementary.group);

    // The fourteen source primary installations: real objects with the source
    // keyed state machines, interpretive lecterns, collision and persistence.
    this.sourceInstallations = new SourceInstallations(
      this.scope,
      built.collision,
      this.interaction,
      this.journal,
      (id, message) => this.announce(id, message),
    );
    this.renderer.scene.add(this.sourceInstallations.group);
    if (this.sourceInstallations.store.recoveryNotice) {
      this.journal.recoveryNotice = this.sourceInstallations.store.recoveryNotice;
    }
    // While an installation is engaged its own source control codes take
    // priority; Escape steps back, which is the source's own contract.
    this.input.setCodeCapture((code, down, repeat) => {
      const active = this.sourceInstallations.activeId;
      if (!active) return false;
      if (code === 'Escape') {
        if (down) this.sourceInstallations.disengage();
        return true;
      }
      this.sourceInstallations.hold(code, down);
      if (!down || repeat) return INSTALLATION_HELD_CODES.has(code);
      return this.sourceInstallations.key(active, code) || INSTALLATION_HELD_CODES.has(code);
    });

    this.loop = new Loop(this);
    const cap = this.preferences.frameCap;
    this.loop.setFrameCap(cap === '30' ? 30 : cap === '60' ? 60 : 0);
    this.ui = new UILayer(this);
    this.scheduleAmbientPopulation(true);
    this.lifecycle = new Lifecycle(this.loop, this.input, this.renderer, () => this.preferences, (message) => {
      this.ui.hud.announce(message);
    });
  }

  /** Human-readable name of the space the visitor is in. */
  get zoneLabel(): string {
    return ZONE_BY_ID.get(this.currentZone)?.label ?? this.currentZone;
  }

  /** The exhibit the visitor is currently standing in, if any. */
  get currentExhibitId(): string | null {
    const focus = this.interaction.currentFocus;
    if (focus) return focus.exhibitId;
    return this.streaming.nearestActiveId(this.player.writeEyePosition(this.eyePositionScratch), 100);
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
    this.scheduleAmbientPopulation(false);
    savePreferences(this.preferences);
  }

  private scheduleAmbientPopulation(announceFailure: boolean): void {
    if (this.ambientLoadTimer !== null) window.clearTimeout(this.ambientLoadTimer);
    // Let the shell render and accept input before parsing the multi-megabyte crowd GLBs.
    this.ambientLoadTimer = window.setTimeout(() => {
      this.ambientLoadTimer = null;
      void this.visitors.setPopulation(this.assets, this.renderer.quality.ambientVisitors).catch((error) => {
        console.error('Ambient visitors unavailable; no placeholder crowd was created.', error);
        if (announceFailure) this.ui.hud.announce('Ambient visitors are unavailable on this device.');
      });
    }, 250);
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  /** Development-only Workshop cue hook; the editor remains dynamically loaded. */
  setWorkshopUpdate(update: (() => void) | null): void {
    this.workshopUpdate = update;
  }

  // ── LoopCallbacks ─────────────────────────────────────────────────────────

  /** Latest announcement, surfaced by the HUD subtitle line and the DOM mirror. */
  lastAnnouncement = '';

  private announce(exhibitId: string, message: string): void {
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
    this.streaming.updateActive(dt, fixedEye);
    if (this.currentZone === 'sanctuary') {
      this.sanctuary.update(dt, this.preferences.reducedMotion);
    }
    this.visitors.update(
      dt,
      this.preferences.reducedMotion,
      this.player.position.x,
      this.player.position.z,
    );
    this.flightPadAtmosphere.update(
      dt,
      this.renderer.quality.detailScale,
      this.preferences.reducedMotion,
      this.player.position.x,
      this.player.position.z,
    );
    this.sourceVisitors.update(
      dt,
      this.preferences.reducedMotion,
      this.player.position.x,
      this.player.position.z,
    );
    this.sourceInstallations.update(dt, this.preferences.reducedMotion, fixedEye, this.currentZone);
  }

  variableUpdate(dt: number): void {
    // Mouse, touch and keyboard all feed the same look, so the museum is fully
    // usable with any one of them alone.
    const keyboardLook = this.input.keyboardLookReusable(dt, this.preferences.mouseSensitivity);
    this.player.applyLook(
      this.input.mouseDeltaX + this.input.touchDeltaX * 1.6 + keyboardLook.dx,
      this.input.mouseDeltaY + this.input.touchDeltaY * 1.6 + keyboardLook.dy,
      this.preferences.mouseSensitivity,
      this.preferences.invertY,
    );

    const eye = this.player.writeEyePosition(this.eyePositionScratch);
    const zone = zoneAtXYZ(eye[0], this.player.position.y + 0.1, eye[2]);
    if (zone !== this.currentZone) {
      this.currentZone = zone;
      this.audio.setZone(zone);
      const label = ZONE_BY_ID.get(zone)?.label;
      if (label) this.ui?.mirror.announce(`Entering ${label}.`);
    }

    this.streaming.evaluate(eye, dt, zone);
    this.interaction.update(this.camera, dt);
    this.workshopUpdate?.();

    // Bay-light residency changes only on mount/unmount. Avoid scanning all 35
    // hosts on every rendered frame when streaming state is unchanged.
    if (this.lightingResidencyRevision !== this.streaming.residencyRevision) {
      this.lightingResidencyRevision = this.streaming.residencyRevision;
      for (const [id, host] of this.streaming.hosts) {
        this.lighting.setBayLight(id, host.currentState === 'active' || host.currentState === 'mounted');
      }
    }
    this.lighting.update(eye);

    this.diagnostics.stats.activeExhibits = this.streaming.telemetry.active;
    this.diagnostics.stats.streamingResident = this.streaming.telemetry.resident;

    const diagnosticPosition = this.diagnostics.stats.playerPosition;
    diagnosticPosition[0] = Math.round(this.player.position.x * 10) / 10;
    diagnosticPosition[1] = Math.round(this.player.position.y * 10) / 10;
    diagnosticPosition[2] = Math.round(this.player.position.z * 10) / 10;
    this.diagnostics.stats.wing = ZONE_BY_ID.get(this.currentZone as never)?.label ?? this.currentZone;

    this.wayfinding.updateXYZ(
      dt,
      this.player.position.x,
      this.player.position.y,
      this.player.position.z,
      this.preferences.reducedMotion,
    );
    this.arrivalGarden.update(dt, this.preferences.reducedMotion);
    this.sky.follow(this.camera);

    this.ui?.update(dt);
    this.input.endFrame();
  }

  render(alpha: number): void {
    this.player.applyToCamera(this.camera, alpha);
    this.renderer.render();
    this.diagnosticSampleElapsed += this.loop.frameTimeMs / 1000;
    if (this.diagnosticSampleElapsed >= 0.1) {
      this.diagnosticSampleElapsed = 0;
      this.diagnostics.sample(this.renderer.renderer, this.loop.fps, this.loop.frameTimeMs);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.workshopUpdate = null;
    if (this.ambientLoadTimer !== null) window.clearTimeout(this.ambientLoadTimer);
    this.ambientLoadTimer = null;
    this.ui?.dispose();
    this.audio.dispose();
    this.assets.dispose();
    this.sanctuary.dispose();
    this.wayfinding.dispose();
    this.visitors.dispose();
    this.flightPadAtmosphere.dispose();
    this.sourceVisitors.dispose();
    this.supplementary.dispose();
    this.sourceInstallations.dispose();
    this.lifecycle?.dispose();
    this.streaming.dispose();
    this.interaction.dispose();
    this.input.dispose();
    this.lighting.dispose();
    this.scope.dispose();
    this.renderer.dispose();
  }
}
