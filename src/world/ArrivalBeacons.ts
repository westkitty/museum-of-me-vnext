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
      color: 0xffca92, transparent: true, opacity: 0.045,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      fog: false,
    }));
    const baseGeometry = scope.track(new THREE.CylinderGeometry(1.25, 1.65, 3.6, 8));
    const crownGeometry = scope.track(new THREE.CylinderGeometry(0.48, 0.58, 0.18, 12));
    const beamGeometry = scope.track(new THREE.CylinderGeometry(1.35, 0.42, 32, 12, 1, true));
    // Visual-review correction: give the visitor a clear axial view of the
    // museum facade and dome. Flanking stones remain outside the raised
    // terrace; no full-width beam crosses the entrance sightline.
    const gatewayStone = scope.track(new THREE.MeshStandardMaterial({
      color: 0x10151d, roughness: 0.86, metalness: 0.14,
    }));
    const inlay = scope.track(new THREE.MeshBasicMaterial({
      color: 0xd68a52, toneMapped: false,
    }));
    const pierGeometry = scope.track(new THREE.BoxGeometry(2.2, 9.8, 2.2));
    const capGeometry = scope.track(new THREE.BoxGeometry(6.4, 0.65, 2.65));
    const lineGeometry = scope.track(new THREE.BoxGeometry(5.8, 0.15, 0.16));
    const gatewayZ = VESTIBULE_TO + 4;
    // Keep the legacy inspector name, but make it a pair of side capstones
    // rather than one visual wall spanning the visitor's central axis.
    const lintel = new THREE.Group();
    lintel.name = 'monumental-arrival-lintel';
    lintel.userData.visualRole = 'split-arrival-caps-open-sightline';
    lintel.position.z = gatewayZ;
    for (const side of [-1, 1]) {
      const x = side * 35.5;
      const pier = new THREE.Mesh(pierGeometry, gatewayStone);
      pier.position.set(x, 4.9, gatewayZ);
      pier.name = 'monumental-arrival-pier';
      this.group.add(pier);
      const cap = new THREE.Mesh(capGeometry, gatewayStone);
      cap.name = `arrival-flanking-capstone-${side}`;
      cap.position.set(x, 9.85, 0);
      lintel.add(cap);
      const lightLine = new THREE.Mesh(lineGeometry, inlay);
      lightLine.name = `arrival-flanking-inlay-${side}`;
      lightLine.position.set(x, 9.45, 1.37);
      lintel.add(lightLine);
    }
    this.group.add(lintel);

    for (const side of [-1, 1]) {
      // Both rows must be in front of the north-facing plaza spawn (+10).
      for (const distance of [4, 9]) {
        const marker = new THREE.Group();
        marker.name = 'ceremonial-searchlight';
        marker.position.set(side * 25, 0, VESTIBULE_TO + distance);
        const plinth = new THREE.Mesh(baseGeometry, bronze);
        plinth.position.y = 1.8;
        const crown = new THREE.Mesh(crownGeometry, amber);
        crown.position.y = 3.65;
        const shaft = new THREE.Mesh(beamGeometry, beam);
        shaft.position.y = 19.65;
        shaft.rotation.z = side * 0.055;
        shaft.renderOrder = 2;
        marker.add(plinth, crown, shaft);
        this.group.add(marker);
      }
    }
  }
}
