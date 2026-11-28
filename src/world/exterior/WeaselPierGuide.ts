import * as THREE from 'three';
import type { ResourceScope } from '../../assets/ResourceScope';
import { INTERACTION_ONLY_LAYER } from '../../interaction/InteractionManager';

export const WEASEL_PIER_GUIDE_ID = 'pocket-portal:w10-pier';

/** Original wind-guide figure at the southern pier. Only shown once W10 is playable. */
export class WeaselPierGuide {
  readonly group = new THREE.Group();
  readonly target = new THREE.Group();

  constructor(scope: ResourceScope) {
    this.group.name = 'southern-pier-wind-guide';
    this.group.position.set(4, -0.5, 195);
    this.group.visible = false;
    const coat = scope.track(new THREE.MeshStandardMaterial({ color: 0x355b59, roughness: 0.85 }));
    const brass = scope.track(new THREE.MeshStandardMaterial({ color: 0xc5a86c, metalness: 0.4, roughness: 0.5 }));
    const body = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.65, 2.3, 8)), coat);
    body.position.y = 1.15; this.group.add(body);
    const head = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.34, 12, 9)), brass);
    head.position.y = 2.45; this.group.add(head);
    const staff = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.06, 0.09, 3.3, 7)), brass);
    staff.position.set(0.7, 1.65, 0); this.group.add(staff);
    const pennant = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.43, 0.9, 3)), coat);
    pennant.position.set(0.7, 3.0, 0); pennant.rotation.z = -0.3; this.group.add(pennant);
    const hit = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.9, 0.9, 2.7, 10)), scope.track(new THREE.MeshBasicMaterial()));
    hit.layers.set(INTERACTION_ONLY_LAYER);
    hit.position.y = 1.4;
    this.target.add(hit); this.group.add(this.target);
  }
}
