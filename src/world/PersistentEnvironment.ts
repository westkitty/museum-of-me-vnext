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
import { mergeStatic, NO_MERGE } from './MergeStatic';
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
  private readonly dressing: EnvironmentDressing;
  private readonly colorFields: ExhibitColorFields;
  private visibilityKey = '';

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'persistent-environment';
    this.dressing = new EnvironmentDressing(scope);
    this.colorFields = new ExhibitColorFields(scope);
  }

  build(): THREE.Group {
    const layers = [
      this.dressing.build(),
      new ExteriorIdentity(this.scope).build(),
      new MonumentalRotunda(this.scope).build(),
      new RotundaWayfinding(this.scope).build(),
      new WingIdentity(this.scope).build(),
      new WingAtmosphere(this.scope).build(),
      new WingFurnishings(this.scope).build(),
      new ExhibitThresholds(this.scope).build(),
      this.colorFields.build(),
    ];
    this.group.add(...layers);

    // Workshop-owned scene roots must retain their identity and transforms.
    // Everything else in these layers is immutable after construction,
    // so collapse repeated-material meshes inside each layer to cut draw calls
    // without flattening the layer hierarchy itself.
    for (const item of this.dressing.authorableSceneRoots()) {
      item.root.userData[NO_MERGE] = true;
    }
    for (const layer of layers) {
      const report = mergeStatic(layer, this.scope, { cellSize: 1000 });
      this.mergeReport.before += report.before;
      this.mergeReport.after += report.after;
      this.mergeReport.merged += report.merged;
    }
    return this.group;
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
