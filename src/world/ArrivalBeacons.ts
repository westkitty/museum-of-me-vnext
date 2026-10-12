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
    // Frame the actual north-facing visitor view: the gateway must be between
    // the plaza spawn (+10) and the museum entrance (0), not behind the camera.
    // Supports sit beyond the plaza parapets; its lintel clears the visitor.
    const gatewayStone = scope.track(new THREE.MeshStandardMaterial({
      color: 0x10151d, roughness: 0.86, metalness: 0.14,
    }));
    const inlay = scope.track(new THREE.MeshBasicMaterial({
      color: 0xd68a52, toneMapped: false,
    }));
    const pierGeometry = scope.track(new THREE.BoxGeometry(4.5, 29, 4.5));
    const lintelGeometry = scope.track(new THREE.BoxGeometry(76, 4.5, 5));
    const lineGeometry = scope.track(new THREE.BoxGeometry(76, 0.15, 0.24));
    const gatewayZ = VESTIBULE_TO + 4;
    for (const side of [-1, 1]) {
      const pier = new THREE.Mesh(pierGeometry, gatewayStone);
      pier.position.set(side * 36, 14.5, gatewayZ);
      pier.name = 'monumental-arrival-pier';
      this.group.add(pier);
    }
    const lintel = new THREE.Mesh(lintelGeometry, gatewayStone);
    lintel.position.set(0, 29, gatewayZ);
    lintel.name = 'monumental-arrival-lintel';
    this.group.add(lintel);
    const lightLine = new THREE.Mesh(lineGeometry, inlay);
    lightLine.position.set(0, 26.68, gatewayZ + 2.53);
    this.group.add(lightLine);

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
