import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { EnvironmentDressing } from './EnvironmentDressing';
import { MonumentalRotunda } from './MonumentalRotunda';
import { ExhibitColorFields } from './ExhibitColorFields';
import { ExhibitThresholds } from './ExhibitThresholds';
import { ExteriorIdentity } from './ExteriorIdentity';
import { RotundaWayfinding } from './RotundaWayfinding';
import { WingAtmosphere } from './WingAtmosphere';
import { WingFurnishings } from './WingFurnishings';
import { WingIdentity } from './WingIdentity';
import { mergeStatic, mergeStaticCooperatively, NO_MERGE } from './MergeStatic';
import type { ZoneId } from './layout';

/**
 * Owns the always-resident visual refinement layer added after the architectural
 * shell. Keeping these systems behind one builder makes their aggregate resource
 * footprint measurable and prevents main.ts from becoming an unbounded list of
 * permanent scene additions.
 *
 * Everything shares the app ResourceScope. No layer may create a render loop,
 * dynamic scene light, collision object, or exhibit-owned lifecycle resource.
 */
export class PersistentEnvironment {
  readonly group = new THREE.Group();
  readonly mergeReport = { before: 0, after: 0, merged: 0 };
  readonly buildStageMs: Record<string, number> = {};
  private readonly dressing: EnvironmentDressing;
  private readonly colorFields: ExhibitColorFields;
  private visibilityKey = '';

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'persistent-environment';
    this.dressing = new EnvironmentDressing(scope);
    this.colorFields = new ExhibitColorFields(scope);
  }

  build(): THREE.Group {
    const layers = this.buildLayerDefinitions().map(({ name, build }) => ({ name, group: this.buildLayer(name, build) }));
    this.attachAndProtect(layers);
    for (const layer of layers) this.mergeLayer(layer.name, layer.group);
    return this.group;
  }

  /** Lazy interior path: yield between each measured layer and merge. */
  async buildCooperatively(yieldControl: () => Promise<void>): Promise<THREE.Group> {
    const layers: { name: string; group: THREE.Group }[] = [];
    for (const { name, build, steps } of this.buildLayerDefinitions()) {
      if (!steps) {
        layers.push({ name, group: this.buildLayer(name, build) });
        await yieldControl();
        continue;
      }
      // Large layers build in steps; time only the work, not the pauses.
      const generator = steps();
      let elapsed = 0;
      for (;;) {
        const started = performance.now();
        const next = generator.next();
        elapsed += performance.now() - started;
        if (next.done) {
          layers.push({ name, group: next.value });
          break;
        }
        await yieldControl();
      }
      this.buildStageMs[`layer:${name}`] = elapsed;
      await yieldControl();
    }
    this.attachAndProtect(layers);
    for (const layer of layers) {
      await this.mergeLayerCooperatively(layer.name, layer.group, yieldControl);
      await yieldControl();
    }
    return this.group;
  }

  private buildLayerDefinitions(): { name: string; build: () => THREE.Group; steps?: () => Generator<void, THREE.Group> }[] {
    return [
      { name: 'dressing', build: () => this.dressing.build(), steps: () => this.dressing.buildSteps() },
      { name: 'exterior-identity', build: () => new ExteriorIdentity(this.scope).build() },
      { name: 'monumental-rotunda', build: () => new MonumentalRotunda(this.scope).build() },
      { name: 'rotunda-wayfinding', build: () => new RotundaWayfinding(this.scope).build() },
      { name: 'wing-identity', build: () => new WingIdentity(this.scope).build() },
      { name: 'wing-atmosphere', build: () => new WingAtmosphere(this.scope).build() },
      { name: 'wing-furnishings', build: () => new WingFurnishings(this.scope).build(), steps: () => new WingFurnishings(this.scope).buildSteps() },
      { name: 'exhibit-thresholds', build: () => new ExhibitThresholds(this.scope).build() },
      { name: 'exhibit-color-fields', build: () => this.colorFields.build() },
    ];
  }

  private buildLayer(name: string, build: () => THREE.Group): THREE.Group {
    const started = performance.now();
    try {
      return build();
    } finally {
      this.buildStageMs[`layer:${name}`] = performance.now() - started;
    }
  }

  private attachAndProtect(layers: readonly { name: string; group: THREE.Group }[]): void {
    this.group.add(...layers.map(({ group }) => group));
    for (const item of this.dressing.authorableSceneRoots()) item.root.userData[NO_MERGE] = true;
  }

  private mergeLayer(name: string, group: THREE.Group): void {
    const started = performance.now();
    const report = mergeStatic(group, this.scope, { cellSize: 1000 });
    this.buildStageMs[`merge:${name}`] = performance.now() - started;
    this.mergeReport.before += report.before;
    this.mergeReport.after += report.after;
    this.mergeReport.merged += report.merged;
  }

  private async mergeLayerCooperatively(
    name: string,
    group: THREE.Group,
    yieldControl: () => Promise<void>,
  ): Promise<void> {
    const started = performance.now();
    let cpuMs = 0;
    for (const child of [...group.children]) {
      const mergeStarted = performance.now();
      let waited = 0;
      const report = await mergeStaticCooperatively(group, this.scope, { cellSize: 1000, preserveTopLevel: true, onlyTopLevel: child }, async () => {
        const pause = performance.now();
        await yieldControl();
        waited += performance.now() - pause;
      });
      cpuMs += performance.now() - mergeStarted - waited;
      this.mergeReport.before += report.before;
      this.mergeReport.after += report.after;
      this.mergeReport.merged += report.merged;
      await yieldControl();
    }
    // Report CPU spent merging, excluding cooperative waits.
    this.buildStageMs[`merge:${name}`] = cpuMs;
    this.buildStageMs[`mergeWall:${name}`] = performance.now() - started;
  }

  /** Retain one material draw while excluding wing accents behind portals. */
  updateVisibility(zone: ZoneId, deep: boolean, visibleWings?: ReadonlySet<string>): void {
    // Shared setup tests can invoke this without a scene visibility contract.
    const keep = visibleWings ?? (() => {
      if (!deep) return null;
      const opposite: Partial<Record<ZoneId, ZoneId>> = {
        north: 'south', south: 'north', east: 'west', west: 'east',
      };
      const proposed = new Set<string>([zone]);
      if (zone === 'plaza') { proposed.add('south'); proposed.add('north'); }
      const other = opposite[zone];
      if (other) proposed.add(other);
      if (zone !== 'sanctuary' && zone !== 'plaza') {
        proposed.add('media'); proposed.add('infra');
      }
      return proposed;
    })();
    const key = keep ? Array.from(keep).sort().join(',') : 'all';
    if (key === this.visibilityKey) return;
    this.visibilityKey = key;
    this.colorFields.setVisibleWings(keep);
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.dressing.authorableSceneRoots();
  }
}
