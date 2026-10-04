import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { EnvironmentDressing } from './EnvironmentDressing';
import { ExhibitColorFields } from './ExhibitColorFields';
import { ExhibitThresholds } from './ExhibitThresholds';
import { ExteriorIdentity } from './ExteriorIdentity';
import { RotundaWayfinding } from './RotundaWayfinding';
import { WingAtmosphere } from './WingAtmosphere';
import { WingFurnishings } from './WingFurnishings';
import { WingIdentity } from './WingIdentity';
import { mergeStatic, NO_MERGE } from './MergeStatic';

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

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'persistent-environment';
    this.dressing = new EnvironmentDressing(scope);
  }

  build(): THREE.Group {
    const layers = [
      this.dressing.build(),
      new ExteriorIdentity(this.scope).build(),
      new RotundaWayfinding(this.scope).build(),
      new WingIdentity(this.scope).build(),
      new WingAtmosphere(this.scope).build(),
      new WingFurnishings(this.scope).build(),
      new ExhibitThresholds(this.scope).build(),
      new ExhibitColorFields(this.scope).build(),
    ];
    this.group.add(...layers);

    // Workshop-owned scene roots must retain their identity and transforms.
    // Everything else in these eight layers is immutable after construction,
    // so collapse repeated-material meshes inside each layer to cut draw calls
    // without flattening the layer hierarchy itself.
    for (const item of this.dressing.authorableSceneRoots()) {
      item.root.userData[NO_MERGE] = true;
    }
    for (const layer of layers) {
      const report = mergeStatic(layer, this.scope);
      this.mergeReport.before += report.before;
      this.mergeReport.after += report.after;
      this.mergeReport.merged += report.merged;
    }
    return this.group;
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.dressing.authorableSceneRoots();
  }
}
