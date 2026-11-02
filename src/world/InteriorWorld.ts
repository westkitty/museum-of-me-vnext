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
  readonly id = 'interior' as const;
  readonly scope: ResourceScope;
  readonly root = new THREE.Group();
  readonly museum: Museum;
  readonly built: MuseumBuildResult;
  readonly sanctuary: DexterSanctuary;
  readonly wayfinding: Wayfinding;
  readonly visitors: AmbientVisitors;
  readonly flightPadAtmosphere: FlightPadAtmosphere;
  readonly streaming: StreamingManager;
  readonly sourceArtwork: SourceArtwork;
  readonly sourceVisitors: SourceVisitors;
  readonly supplementary: SupplementaryCases;
  readonly sourceInstallations: SourceInstallations;
  readonly persistentEnvironment: PersistentEnvironment;

  private lightingResidencyRevision = -1;

  constructor(private readonly app: App) {
    this.scope = new ResourceScope('interior-world');
    this.root.name = 'interior-world';

    this.museum = new Museum(this.scope);
    this.built = this.museum.build();
    this.root.add(this.built.root);

    this.sanctuary = new DexterSanctuary(this.scope);
    this.root.add(this.sanctuary.group);

    this.wayfinding = new Wayfinding(this.scope);
    this.root.add(this.wayfinding.group);

    this.visitors = new AmbientVisitors(this.scope, app.renderer.quality.ambientVisitors);
    this.root.add(this.visitors.group);

    this.flightPadAtmosphere = new FlightPadAtmosphere(this.scope);
    this.root.add(this.flightPadAtmosphere.group);

    installExhibits();
    this.streaming = new StreamingManager(
      this.built.exhibitMounts,
      {
        addControl: (id, control) => app.interaction.register(id, control),
        announce: (id, message) => app.announce(id, message),
        reducedMotion: () => app.preferences.reducedMotion,
        detailScale: () => app.renderer.quality.detailScale,
        loadAsset: async (assetId, scope, detail) =>
          (await app.assets.load(assetId, scope, { detail })).object,
        warmObject: (object) => app.renderer.prewarmObject(object),
        openEmbeddedExperience: (id) => {
          if (id === 'full-weasel') app.ui?.openFullWeasel();
        },
      },
      {
        loadRadius: app.renderer.quality.exhibitStreamRadius + 14,
        unloadRadius: app.renderer.quality.exhibitStreamRadius + 30,
        activateRadius: app.renderer.quality.exhibitStreamRadius,
        mountsPerFrame: 1,
        mountBudgetMs: 6,
        warmupsPerFrame: 1,
        activationsPerFrame: 1,
        activationBudgetMs: 3,
      },
    );
    this.streaming.initialise();
    this.streaming.beginEntrancePrewarm();

    this.sourceArtwork = new SourceArtwork(this.scope, this.built.exhibitMounts);
    this.root.add(this.sourceArtwork.group);

    this.sourceVisitors = new SourceVisitors(
      this.scope,
      this.built.collision,
      app.interaction,
      (visitor, line, thought) => {
        app.journal.hearVisitor(visitor.id);
        app.journal.recordHistory({ kind: 'visitor', id: visitor.id }, visitor.title);
        const message = thought ? `${line} (${thought})` : line;
        app.announce(`visitor:${visitor.id}`, `${visitor.title}: ${message}`);
      },
    );
    this.root.add(this.sourceVisitors.group);

    this.supplementary = new SupplementaryCases(
      this.scope,
      app.interaction,
      app.journal,
      (id, title, summary) => app.announce(`supplementary:${id}`, `${title}. ${summary}`),
    );
    this.root.add(this.supplementary.group);

    this.sourceInstallations = new SourceInstallations(
      this.scope,
      this.built.collision,
      app.interaction,
      app.journal,
      (id, message) => app.announce(id, message),
    );
    this.root.add(this.sourceInstallations.group);
    if (this.sourceInstallations.store.recoveryNotice) {
      app.journal.recoveryNotice = this.sourceInstallations.store.recoveryNotice;
    }

    app.input.setCodeCapture((code, down, repeat) => {
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

    this.persistentEnvironment = new PersistentEnvironment(this.scope);
    const envGroup = this.persistentEnvironment.build();
    this.root.add(envGroup);

    if (app.sceneRegistry) {
      for (const item of this.persistentEnvironment.authorableSceneRoots()) {
        try {
          app.sceneRegistry.register(item.id, item.root);
        } catch {
          // Ignore if already registered
        }
      }
    }
  }

  get collision() {
    return this.built.collision;
  }

  fixedUpdate(dt: number, fixedEye: readonly [number, number, number], currentZone: ZoneId): void {
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
    this.scope.dispose();
  }
}
