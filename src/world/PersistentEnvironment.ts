import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { bakeStatic, protectSubtree, type BakeReport } from './MergeStatic';
import { EnvironmentDressing } from './EnvironmentDressing';
import { ExhibitColorFields } from './ExhibitColorFields';
import { ExhibitThresholds } from './ExhibitThresholds';
import { ExteriorIdentity } from './ExteriorIdentity';
import { RotundaWayfinding } from './RotundaWayfinding';
import { WingAtmosphere } from './WingAtmosphere';
import { WingFurnishings } from './WingFurnishings';
import { WingIdentity } from './WingIdentity';

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
  /** What the static bake collapsed, one entry per layer, in layer order. */
  readonly bake: BakeReport[] = [];
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

    // Static bake. Every system above is built once and never transformed or
    // material-mutated again — none of them has an update() — so their hundreds
    // of small meshes can be collapsed by material, and their value-identical
    // materials interned first so that collapse actually groups. Nothing about
    // what is drawn changes; only how many draws it takes.
    //
    // Authorable roots stay whole: the development Workshop attaches a
    // transform gizmo to each by identity, and a merged mesh has no position of
    // its own left to move.
    for (const { root } of this.dressing.authorableSceneRoots()) protectSubtree(root);
    this.bake.length = 0;
    for (const layer of layers) this.bake.push(bakeStatic(layer, this.scope));
    return this.group;
  }

  authorableSceneRoots(): readonly { readonly id: string; readonly root: THREE.Object3D }[] {
    return this.dressing.authorableSceneRoots();
  }
}
