import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { Museum, type MuseumBuildResult } from './Museum';
import { DexterSanctuary } from '../exhibits/sanctuary/DexterSanctuary';
import { AmbientVisitors } from './AmbientVisitors';
import { FlightPadAtmosphere } from './FlightPadAtmosphere';
import { installExhibits } from '../exhibits';
import { StreamingManager } from '../exhibits/StreamingManager';
import { SourceArtwork } from './SourceArtwork';
import { SourceVisitors } from './SourceVisitors';
import { prepareVisitorGeometry } from './VisitorVisuals';
import { bakedVisitorGeometry } from './VisitorGeometryBake';
import { SOURCE_VISITORS } from '../content/sourceParity';
import { SupplementaryCases } from './SupplementaryCases';
import { SourceInstallations, INSTALLATION_HELD_CODES } from './SourceInstallations';
import { PersistentEnvironment } from './PersistentEnvironment';
import { EventLoopYieldBudget, yieldToEventLoop } from '../util/yieldToEventLoop';
import type { App } from '../app/App';
import { CinemaVenue } from '../cinema/CinemaVenue';
import { CINEMA_PROGRAMME } from '../cinema/programme';
import { ATRIUM_DEPTH, ATRIUM_FRONT_Z, ENTRANCE_PORTAL_Z, type ZoneId } from './layout';

/**
 * Autonomous Interior World context.
 * Owns the full interior architectural museum building (Rotunda, all 6 wings,
 * Sanctuary, balcony, stairs), the 35 exhibit mount anchors, exhibit streaming,
 * the 14 primary source installations, 17 authored source visitors, ambient visitors,
 * Dexter Sanctuary, and interior persistent environment dressing.
 *
 * Lazily instantiated on demand or approach. Never executed during cold exterior boot.
 */
export class InteriorWorld {
  runtimeState: 'retained' | 'active' = 'retained';
  readonly id = 'interior' as const;
  readonly scope: ResourceScope;
  readonly root = new THREE.Group();
  museum!: Museum;
  built!: MuseumBuildResult;
  sanctuary!: DexterSanctuary;
  visitors!: AmbientVisitors;
  flightPadAtmosphere!: FlightPadAtmosphere;
  streaming!: StreamingManager;
  sourceArtwork!: SourceArtwork;
  sourceVisitors!: SourceVisitors;
  supplementary!: SupplementaryCases;
  sourceInstallations!: SourceInstallations;
  persistentEnvironment!: PersistentEnvironment;
  /** The Museum Cinema's runtime (seats, programme, house lights, playback). */
  cinema: CinemaVenue | null = null;

  private lightingResidencyRevision = -1;

  constructor(private readonly app: App) {
    this.scope = new ResourceScope('interior-world');
    this.root.name = 'interior-world';
    this.root.visible = false;
  }

  /** Build the dormant interior in bounded frame-paced slices while the exterior stays playable. */
  async buildCooperatively(): Promise<void> {
    const yieldOnce = (): Promise<void> => (this.app.loop.isRunning
      ? this.app.renderer.waitForNextFrame(() => this.app.loop.isRunning && !this.scope.isDisposed)
      : yieldToEventLoop());
    const yieldBudget = new EventLoopYieldBudget(3, 250, yieldOnce);
    this.museum = this.measureBuildStage('museum.constructor', () => new Museum(this.scope));
    this.built = await this.measureBuildStageAsync('museum.build', () =>
      this.museum.buildCooperatively(() => yieldBudget.checkpoint()));
    for (const [name, duration] of Object.entries(this.museum.buildStageMs)) {
      this.app.interiorLoadTelemetry.buildStageMs[`museum.${name}`] = duration;
    }
    this.root.add(this.built.root);
    await yieldBudget.checkpoint();

    if (this.museum.cinema) {
      const app = this.app;
      this.cinema = this.measureBuildStage('cinema-venue', () => new CinemaVenue({
        interaction: app.interaction,
        player: app.player,
        input: app.input,
        reducedMotion: () => app.preferences.reducedMotion
          || Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
        announce: (message) => { app.ui?.hud.announce(message); app.ui?.mirror.announce(message); },
        openProgramme: () => app.ui?.openCinemaProgramme(),
        get console() { return app.ui?.cinemaConsole ?? null; },
        filmUnavailable: (id, reason) => app.ui?.cinemaProgramme.markUnavailable(id, reason),
        overlayParent: app.uiRoot,
      }, this.museum.cinema!, () => app.ui?.cinemaProgrammeNow() ?? CINEMA_PROGRAMME));
      this.cinema.playback.externalConsent = app.ui?.youtubeConsent.given() ?? false;
    }

    this.sanctuary = this.measureBuildStage('sanctuary', () => new DexterSanctuary(this.scope));
    this.root.add(this.sanctuary.group);
    await yieldBudget.checkpoint();

    await yieldBudget.checkpoint();

    this.visitors = this.measureBuildStage('ambient-visitors', () =>
      new AmbientVisitors(this.scope, this.app.renderer.quality.ambientVisitors));
    this.root.add(this.visitors.group);
    await yieldBudget.checkpoint();

    this.flightPadAtmosphere = this.measureBuildStage('flight-pad-atmosphere', () => new FlightPadAtmosphere(this.scope));
    this.root.add(this.flightPadAtmosphere.group);
    await yieldBudget.checkpoint();

    this.measureBuildStage('exhibit-registration', () => installExhibits());
    await yieldBudget.checkpoint();
    this.streaming = this.measureBuildStage('streaming-manager', () => new StreamingManager(
      this.built.exhibitMounts,
      {
        addControl: (id, control) => this.app.interaction.register(id, control),
        announce: (id, message) => this.app.announce(id, message),
        reducedMotion: () => this.app.preferences.reducedMotion,
        detailScale: () => this.app.renderer.quality.detailScale,
        loadAsset: async (assetId, scope, detail) =>
          (await this.app.assets.load(assetId, scope, { detail })).object,
        warmObject: (object) => this.app.renderer.prewarmObject(object),
        openEmbeddedExperience: (id) => {
          if (id === 'full-weasel') this.app.ui?.openFullWeasel();
        },
      },
      {
        loadRadius: this.app.renderer.quality.exhibitStreamRadius + 14,
        unloadRadius: this.app.renderer.quality.exhibitStreamRadius + 30,
        activateRadius: this.app.renderer.quality.exhibitStreamRadius,
        mountsPerFrame: 1,
        mountBudgetMs: 6,
        warmupsPerFrame: 1,
        activationsPerFrame: 1,
        activationBudgetMs: 3,
      },
    ));
    this.measureBuildStage('streaming-initialise', () => this.streaming.initialise());
    this.streaming.beginEntrancePrewarm();
    await yieldBudget.checkpoint();

    this.sourceArtwork = this.measureBuildStage('source-artwork', () =>
      new SourceArtwork(this.scope, this.built.exhibitMounts));
    this.root.add(this.sourceArtwork.group);
    await yieldBudget.checkpoint();

    // The 78 visitor geometries are a pure function of the authored records.
    // Prefer the build-time bytes (decoded in about a millisecond); where the
    // browser cannot decode them natively, compose procedurally in frame-paced
    // slices. 'source-visitors.kit' is the summed synchronous kit time (not wall
    // time), '.kit-longest' the longest single slice, '.kit-baked' 1 or 0.
    let kitTotal = 0;
    let kitLongest = 0;
    const decodeStarted = performance.now();
    const baked = bakedVisitorGeometry();
    let kit: Record<string, THREE.BufferGeometry>;
    if (baked) {
      kit = baked;
      kitTotal = kitLongest = performance.now() - decodeStarted;
    } else {
      kit = await prepareVisitorGeometry(SOURCE_VISITORS, () => yieldBudget.checkpoint(), (ms) => {
        kitTotal += ms;
        kitLongest = Math.max(kitLongest, ms);
      });
    }
    this.app.interiorLoadTelemetry.buildStageMs['source-visitors.kit'] = kitTotal;
    this.app.interiorLoadTelemetry.buildStageMs['source-visitors.kit-longest'] = kitLongest;
    this.app.interiorLoadTelemetry.buildStageMs['source-visitors.kit-baked'] = baked ? 1 : 0;
    this.sourceVisitors = this.measureBuildStage('source-visitors', () => SourceVisitors.fromKit(
      this.scope,
      this.built.collision,
      this.app.interaction,
      (visitor, line, thought) => {
        this.app.journal.hearVisitor(visitor.id);
        this.app.journal.recordHistory({ kind: 'visitor', id: visitor.id }, visitor.title);
        const message = thought ? `${line} (${thought})` : line;
        this.app.announce(`visitor:${visitor.id}`, `${visitor.title}: ${message}`);
      },
      kit,
    ));
    this.root.add(this.sourceVisitors.group);
    await yieldBudget.checkpoint();

    this.supplementary = this.measureBuildStage('supplementary-cases', () => new SupplementaryCases(
      this.scope,
      this.app.interaction,
      this.app.journal,
      (id, title, summary) => this.app.announce(`supplementary:${id}`, `${title}. ${summary}`),
    ));
    this.root.add(this.supplementary.group);
    await yieldBudget.checkpoint();

    this.sourceInstallations = this.measureBuildStage('source-installations', () => new SourceInstallations(
      this.scope,
      this.built.collision,
      this.app.interaction,
      this.app.journal,
      (id, message) => this.app.announce(id, message),
      undefined,
      true,
    ));
    await yieldBudget.checkpoint();
    await this.measureBuildStageAsync('source-installations.build', () =>
      this.sourceInstallations.buildCooperatively(() => yieldBudget.checkpoint()));
    for (const [id, duration] of Object.entries(this.sourceInstallations.buildStageMs)) {
      this.app.interiorLoadTelemetry.buildStageMs[`installation.${id}`] = duration;
    }
    this.root.add(this.sourceInstallations.group);
    if (this.sourceInstallations.store.recoveryNotice) {
      this.app.journal.recoveryNotice = this.sourceInstallations.store.recoveryNotice;
    }
    await yieldBudget.checkpoint();

    this.persistentEnvironment = this.measureBuildStage('persistent-environment', () => new PersistentEnvironment(this.scope));
    await yieldBudget.checkpoint();
    const envGroup = await this.measureBuildStageAsync('persistent-environment.build', () =>
      this.persistentEnvironment.buildCooperatively(() => yieldBudget.checkpoint()));
    for (const [name, duration] of Object.entries(this.persistentEnvironment.buildStageMs)) {
      this.app.interiorLoadTelemetry.buildStageMs[`environment.${name}`] = duration;
    }
    // Nothing below tracks a resource, so a disposal during the last stage must be caught here.
    if (this.scope.isDisposed) throw new Error('InteriorWorld disposed during preparation');
    this.root.add(envGroup);

    this.app.input.setCodeCapture((code, down, repeat) => {
      // Seated in the cinema, its playback keys come first (never while walking).
      if (this.cinema?.handleKey(code, down, repeat)) return true;
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

    if (this.app.sceneRegistry) {
      for (const item of this.persistentEnvironment.authorableSceneRoots()) {
        try {
          this.app.sceneRegistry.register(item.id, item.root);
        } catch {
          // Ignore if already registered
        }
      }
    }
  }

  get collision() {
    return this.built.collision;
  }

  private measureBuildStage<T>(name: string, build: () => T): T {
    const started = performance.now();
    try {
      return build();
    } finally {
      this.app.interiorLoadTelemetry.buildStageMs[name] = performance.now() - started;
    }
  }

  private async measureBuildStageAsync<T>(name: string, build: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      return await build();
    } finally {
      this.app.interiorLoadTelemetry.buildStageMs[name] = performance.now() - started;
    }
  }

  setActive(active: boolean): void {
    this.runtimeState = active ? 'active' : 'retained';
    // Leaving the museum returns the atrium to darkness for the next entry.
    if (!active) this.museum?.resetAtrium();
    // Leaving the interior ends any screening and frees its media.
    if (!active) this.cinema?.leave();
    this.streaming?.setWorldActive(active);
  }

  /** Keep only the entrance streaming lane progressing while this world is hidden. */
  prepareUpdate(dt: number, eye: readonly [number, number, number], zone: ZoneId): void {
    if (this.runtimeState !== 'retained') return;
    this.museum.updateVisibility(
      zone,
      eye[0],
      eye[2],
      this.app.isRoomCullingEnabled,
      this.app.player.yaw,
      this.app.preferences.fieldOfView,
    );
    this.persistentEnvironment.updateVisibility(zone, true, this.museum.visibleWingIds);
    this.sourceInstallations.prepareVisibility(zone);
    this.streaming.evaluate(eye, dt, zone);
  }

  fixedUpdate(dt: number, fixedEye: readonly [number, number, number], currentZone: ZoneId): void {
    if (this.runtimeState !== 'active') return;
    this.streaming.updateActive(dt, fixedEye);
    if (currentZone === 'sanctuary') {
      this.sanctuary.update(dt, this.app.preferences.reducedMotion);
    }
    this.visitors.update(
      dt,
      this.app.preferences.reducedMotion,
      this.app.player.position.x,
      this.app.player.position.z,
    );
    this.flightPadAtmosphere.update(
      dt,
      this.app.renderer.quality.detailScale,
      this.app.preferences.reducedMotion,
      this.app.player.position.x,
      this.app.player.position.z,
    );
    this.sourceVisitors.update(
      dt,
      this.app.preferences.reducedMotion,
      this.app.player.position.x,
      this.app.player.position.z,
    );
    this.sourceInstallations.update(dt, this.app.preferences.reducedMotion, fixedEye, currentZone);
  }

  variableUpdate(
    dt: number,
    eye: readonly [number, number, number],
    zone: ZoneId,
    roomCullingEnabled: boolean,
  ): { deep: boolean; visibleWingIds: ReadonlySet<string> } {
    if (this.runtimeState !== 'active') return { deep: false, visibleWingIds: this.museum.visibleWingIds };
    this.sourceArtwork.update(eye[0], eye[2], dt);
    // The impossible atrium reveals itself through actual walking distance.
    // The exterior sphere and the interior never share a visible scene root.
    const inAtrium = zone === 'plaza' && eye[2] >= ENTRANCE_PORTAL_Z && eye[2] < ATRIUM_FRONT_Z;
    const progress = Math.max(0, Math.min(1, (ATRIUM_FRONT_Z - eye[2]) / ATRIUM_DEPTH));
    this.museum.updateAtrium(dt, this.app.preferences.reducedMotion, inAtrium, progress);
    this.supplementary.update(eye[0], eye[2], dt);
    const deep = this.museum.updateVisibility(
      zone,
      eye[0],
      eye[2],
      roomCullingEnabled,
      this.app.player.yaw,
      this.app.preferences.fieldOfView,
    );
    this.persistentEnvironment.updateVisibility(zone, deep, this.museum.visibleWingIds);
    this.streaming.evaluate(eye, dt, zone);
    this.cinema?.update(dt, zone, this.museum.zoneGroups.get('cinema')?.visible ?? false);

    if (this.lightingResidencyRevision !== this.streaming.residencyRevision) {
      this.lightingResidencyRevision = this.streaming.residencyRevision;
      for (const [id, host] of this.streaming.hosts) {
        this.app.lighting.setBayLight(id, host.currentState === 'active' || host.currentState === 'mounted');
      }
    }
    return { deep, visibleWingIds: this.museum.visibleWingIds };
  }

  dispose(): void {
    this.cinema?.dispose();
    this.cinema = null;
    this.streaming?.dispose();
    this.sourceInstallations?.dispose();
    // The cast (17) and the supplementary cases (15) register interaction proxies
    // outside the scope; unbind them so a failed or abandoned build cannot leave
    // dead targets behind for the retry.
    this.sourceVisitors?.dispose();
    this.supplementary?.dispose();
    this.scope.dispose();
  }
}
