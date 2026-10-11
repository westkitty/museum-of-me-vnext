import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import {
  DOME_SPRING_Y, LEVEL_1_Y, OCTAGON_FACES, ROTUNDA_APOTHEM,
  faceDirection, place, type Vec3,
} from './layout';

/**
 * A full-height architectural crown for the existing octagonal Rotunda.
 *
 * All surfaces sit against the upper drum, well clear of the ground-floor
 * circulation, upper-wing threshold openings, and central flight column.
 * The original geometry/collision/wayfinding retains complete authority.
 * One shared cube geometry and three materials merge into a few draw calls
 * through PersistentEnvironment, with no extra scene lights or render loop.
 */
export class MonumentalRotunda {
  readonly group = new THREE.Group();
  private readonly cube: THREE.BoxGeometry;
  private readonly marble: THREE.MeshStandardMaterial;
  private readonly bronze: THREE.MeshStandardMaterial;
  private readonly luminous: THREE.MeshBasicMaterial;

  constructor(scope: ResourceScope) {
    this.group.name = 'monumental-rotunda';
    this.cube = scope.track(new THREE.BoxGeometry(1, 1, 1));
    this.marble = scope.track(new THREE.MeshStandardMaterial({
      color: 0xe5dfd4, roughness: 0.81, metalness: 0.08,
    }));
    this.bronze = scope.track(new THREE.MeshStandardMaterial({
      color: 0x947659, roughness: 0.44, metalness: 0.54,
    }));
    this.luminous = scope.track(new THREE.MeshBasicMaterial({
      color: 0xffd3a2, toneMapped: false,
    }));
  }

  build(): THREE.Group {
    const faceLength = 2 * ROTUNDA_APOTHEM * Math.tan(Math.PI / 8);
    const drumHeight = DOME_SPRING_Y - LEVEL_1_Y;

    for (const face of OCTAGON_FACES) {
      const d = faceDirection(face);
      const angle = Math.atan2(d[0], d[2]) + Math.PI;
      const crown = place(d, ROTUNDA_APOTHEM - 0.55, 0, 0);

      this.box(
        `rotunda-crown-architrave:${face}`,
        [crown[0], DOME_SPRING_Y - 0.48, crown[2]],
        [faceLength - 0.55, 0.69, 0.55], this.marble, angle,
      );
      this.box(
        `rotunda-crown-bronze-line:${face}`,
        [crown[0], DOME_SPRING_Y - 1.04, crown[2] + d[2] * -0.12],
        [faceLength - 1.1, 0.13, 0.58], this.bronze, angle,
      );
      this.box(
        `rotunda-crown-light-line:${face}`,
        [crown[0] - d[0] * 0.30, DOME_SPRING_Y - 1.18, crown[2] - d[2] * 0.30],
        [faceLength - 1.25, 0.055, 0.08], this.luminous, angle,
      );

      for (const side of [-1, 1]) {
        const at = place(d, ROTUNDA_APOTHEM - 0.82, side * (faceLength / 2 - 0.78), 0);
        this.box(
          `rotunda-upper-pier:${face}`,
          [at[0], LEVEL_1_Y + drumHeight / 2, at[2]],
          [0.58, drumHeight - 0.72, 0.48], this.marble, angle,
        );
        this.box(
          `rotunda-upper-pier-glint:${face}`,
          [at[0] - d[0] * 0.29, LEVEL_1_Y + drumHeight / 2, at[2] - d[2] * 0.29],
          [0.065, drumHeight - 1.6, 0.07], this.bronze, angle,
        );
      }
    }
    return this.group;
  }

  private box(
    name: string, at: Vec3, dimensions: Vec3,
    material: THREE.Material, angle: number,
  ): void {
    const mesh = new THREE.Mesh(this.cube, material);
    mesh.name = name;
    mesh.position.set(at[0], at[1], at[2]);
    mesh.scale.set(dimensions[0], dimensions[1], dimensions[2]);
    mesh.rotation.y = angle;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);
  }
}
