import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { VESTIBULE_TO } from './layout';

/**
 * Exterior-only, non-colliding architectural beacons.
 * Cheap transparent geometry replaces expensive volumetric light passes.
 * Placement is outside the central approach; no gameplay or collision changes.
 */
export class ArrivalBeacons {
  readonly group = new THREE.Group();

  constructor(scope: ResourceScope) {
    this.group.name = 'arrival-monumental-beacons';
    const bronze = scope.track(new THREE.MeshStandardMaterial({
      color: 0x211b1a, metalness: 0.72, roughness: 0.35,
    }));
    const amber = scope.track(new THREE.MeshBasicMaterial({
      color: 0xffbb76, toneMapped: false,
    }));
    const beam = scope.track(new THREE.MeshBasicMaterial({
      color: 0xffca92, transparent: true, opacity: 0.085,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      fog: false,
    }));
    const baseGeometry = scope.track(new THREE.CylinderGeometry(1.25, 1.65, 3.6, 8));
    const crownGeometry = scope.track(new THREE.CylinderGeometry(0.48, 0.58, 0.18, 12));
    const beamGeometry = scope.track(new THREE.CylinderGeometry(2.6, 0.42, 105, 12, 1, true));
    for (const side of [-1, 1]) {
      for (const distance of [9, 24]) {
        const marker = new THREE.Group();
        marker.name = 'ceremonial-searchlight';
        marker.position.set(side * 25, 0, VESTIBULE_TO + distance);
        const plinth = new THREE.Mesh(baseGeometry, bronze);
        plinth.position.y = 1.8;
        const crown = new THREE.Mesh(crownGeometry, amber);
        crown.position.y = 3.65;
        const shaft = new THREE.Mesh(beamGeometry, beam);
        shaft.position.y = 56.2;
        shaft.rotation.z = side * 0.055;
        shaft.renderOrder = 2;
        marker.add(plinth, crown, shaft);
        this.group.add(marker);
      }
    }
  }
}
