import * as THREE from 'three';
import { ResourceScope } from '../assets/ResourceScope';
import { Museum, type MuseumBuildResult } from './Museum';
import { DexterSanctuary } from '../exhibits/sanctuary/DexterSanctuary';
import { Wayfinding } from './Wayfinding';
import { AmbientVisitors } from './AmbientVisitors';
import { FlightPadAtmosphere } from './FlightPadAtmosphere';
import { installExhibits } from '../exhibits';
import { StreamingManager } from '../exhibits/StreamingManager';
import { SourceArtwork } from './SourceArtwork';
import { SourceVisitors } from './SourceVisitors';
import { SupplementaryCases } from './SupplementaryCases';
import { SourceInstallations, INSTALLATION_HELD_CODES } from './SourceInstallations';
import { PersistentEnvironment } from './PersistentEnvironment';
import { EventLoopYieldBudget } from '../util/yieldToEventLoop';
import type { App } from '../app/App';
import type { ZoneId } from './layout';

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
  wayfinding!: Wayfinding;
  visitors!: AmbientVisitors;
  flightPadAtmosphere!: FlightPadAtmosphere;
  streaming!: StreamingManager;
  sourceArtwork!: SourceArtwork;
  sourceVisitors!: SourceVisitors;
  supplementary!: SupplementaryCases;
  sourceInstallations!: SourceInstallations;
  persistentEnvironment!: PersistentEnvironment;

  private lightingResidencyRevision = -1;

  constructor(private readonly app: App) {
    this.scope = new ResourceScope('interior-world');
    this.root.name = 'interior-world';
    this.root.visible = false;
  }

  /** Build the dormant interior in bounded event-loop slices while the exterior stays playable. */
  async buildCooperatively(): Promise<void> {
    const yieldBudget = new EventLoopYieldBudget(8);
    this.museum = this.measureBuildStage('museum.constructor', () => new Museum(this.scope));
    this.built = await this.measureBuildStageAsync('museum.build', () =>
      this.museum.buildCooperatively(() => yieldBudget.checkpoint()));
    for (const [name, duration] of Object.entries(this.museum.buildStageMs)) {
      this.app.interiorLoadTelemetry.buildStageMs[`museum.${name}`] = duration;
    }
    this.root.add(this.built.root);

    this.sanctuary = this.measureBuildStage('sanctuary', () => new DexterSanctuary(this.scope));
    this.root.add(this.sanctuary.group);

    this.wayfinding = this.measureBuildStage('wayfinding', () => new Wayfinding(this.scope));
    this.root.add(this.wayfinding.group);

    this.visitors = this.measureBuildStage('ambient-visitors', () =>
      new AmbientVisitors(this.scope, this.app.renderer.quality.ambientVisitors));
    this.root.add(this.visitors.group);

    this.flightPadAtmosphere = this.measureBuildStage('flight-pad-atmosphere', () => new FlightPadAtmosphere(this.scope));
    this.root.add(this.flightPadAtmosphere.group);

    this.measureBuildStage('exhibit-registration', () => installExhibits());
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

    this.sourceArtwork = this.measureBuildStage('source-artwork', () =>
      new SourceArtwork(this.scope, this.built.exhibitMounts));
    this.root.add(this.sourceArtwork.group);

    this.sourceVisitors = this.measureBuildStage('source-visitors', () => new SourceVisitors(
      this.scope,
      this.built.collision,
      this.app.interaction,
      (visitor, line, thought) => {
        this.app.journal.hearVisitor(visitor.id);
        this.app.journal.recordHistory({ kind: 'visitor', id: visitor.id }, visitor.title);
        const message = thought ? `${line} (${thought})` : line;
        this.app.announce(`visitor:${visitor.id}`, `${visitor.title}: ${message}`);
      },
    ));
    this.root.add(this.sourceVisitors.group);

    this.supplementary = this.measureBuildStage('supplementary-cases', () => new SupplementaryCases(
      this.scope,
      this.app.interaction,
      this.app.journal,
      (id, title, summary) => this.app.announce(`supplementary:${id}`, `${title}. ${summary}`),
    ));
    this.root.add(this.supplementary.group);

    this.sourceInstallations = this.measureBuildStage('source-installations', () => new SourceInstallations(
      this.scope,
      this.built.collision,
      this.app.interaction,
      this.app.journal,
      (id, message) => this.app.announce(id, message),
      undefined,
      true,
    ));
    await this.measureBuildStageAsync('source-installations.build', () =>
      this.sourceInstallations.buildCooperatively(() => yieldBudget.checkpoint()));
    for (const [id, duration] of Object.entries(this.sourceInstallations.buildStageMs)) {
      this.app.interiorLoadTelemetry.buildStageMs[`installation.${id}`] = duration;
    }
    this.root.add(this.sourceInstallations.group);
    if (this.sourceInstallations.store.recoveryNotice) {
      this.app.journal.recoveryNotice = this.sourceInstallations.store.recoveryNotice;
    }

    this.persistentEnvironment = this.measureBuildStage('persistent-environment', () => new PersistentEnvironment(this.scope));
    const envGroup = await this.measureBuildStageAsync('persistent-environment.build', () =>
      this.persistentEnvironment.buildCooperatively(() => yieldBudget.checkpoint()));
    for (const [name, duration] of Object.entries(this.persistentEnvironment.buildStageMs)) {
      this.app.interiorLoadTelemetry.buildStageMs[`environment.${name}`] = duration;
    }
    this.root.add(envGroup);

    this.app.input.setCodeCapture((code, down, repeat) => {
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

    if (this.lightingResidencyRevision !== this.streaming.residencyRevision) {
      this.lightingResidencyRevision = this.streaming.residencyRevision;
      for (const [id, host] of this.streaming.hosts) {
        this.app.lighting.setBayLight(id, host.currentState === 'active' || host.currentState === 'mounted');
      }
    }
    return { deep, visibleWingIds: this.museum.visibleWingIds };
  }

  dispose(): void {
    this.streaming?.dispose();
    this.sourceInstallations?.dispose();
    this.scope.dispose();
  }
}
