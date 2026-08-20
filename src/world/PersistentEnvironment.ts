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

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'persistent-environment';
  }

  build(): THREE.Group {
    this.group.add(
      new EnvironmentDressing(this.scope).build(),
      new ExteriorIdentity(this.scope).build(),
      new RotundaWayfinding(this.scope).build(),
      new WingIdentity(this.scope).build(),
      new WingAtmosphere(this.scope).build(),
      new WingFurnishings(this.scope).build(),
      new ExhibitThresholds(this.scope).build(),
      new ExhibitColorFields(this.scope).build(),
    );
    return this.group;
  }
}
