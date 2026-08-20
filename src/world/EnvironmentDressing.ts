import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { buildWingSign } from '../exhibits/Furniture';
import {
  GROUND_Y, LEVEL_1_Y, ROTUNDA_APOTHEM, VESTIBULE_FROM, VESTIBULE_TO,
  WINGS, faceDirection, place, rightOf, type Vec3,
} from './layout';

/**
 * High-level environmental furnishing that sits on top of the proven museum
 * architecture. It deliberately does not participate in collision: authored
 * circulation stays exactly as validated while the world gains visual density,
 * welcome furniture, planting and stronger spatial identity.
 */
export class EnvironmentDressing {
  readonly group = new THREE.Group();

  private readonly white: THREE.MeshStandardMaterial;
  private readonly ivory: THREE.MeshStandardMaterial;
  private readonly brass: THREE.MeshStandardMaterial;
  private readonly leaf: THREE.MeshStandardMaterial;
  private readonly leafLight: THREE.MeshStandardMaterial;
  private readonly planter: THREE.MeshStandardMaterial;
  private readonly darkMetal: THREE.MeshStandardMaterial;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'environment-dressing';
    this.white = this.mat(0xf8f7f2, 0.9);
    this.ivory = this.mat(0xe8e4da, 0.95);
    this.brass = this.mat(0xbca46f, 0.48, 0.3);
    this.leaf = this.mat(0x315f3a, 0.94);
    this.leafLight = this.mat(0x72945d, 0.96);
    this.planter = this.mat(0xd9d5cb, 0.94);
    this.darkMetal = this.mat(0x343c40, 0.52, 0.18);
  }

  build(): THREE.Group {
    this.buildFacade();
    this.buildNeutralVestibule();
    this.buildRotundaWelcome();
    this.buildWingFurnishings();
    return this.group;
  }

  private buildFacade(): void {
    const d = faceDirection('s');
    const r = rightOf(d);
    const facade = place(d, VESTIBULE_TO + 0.3, 0, GROUND_Y);

    // A pale entrance frame and canopy make the exterior legible as a museum
    // from the garden without changing the actual doorway geometry.
    this.box('facade-entablature', [facade[0], 9.4, facade[2]], [8.8, 0.7, 0.8], this.ivory);
    this.box('facade-canopy', place(d, VESTIBULE_TO + 2.4, 0, 6.1), [7.2, 0.22, 2.3], this.white);

    for (const side of [-1, 1]) {
      const p = place(d, VESTIBULE_TO + 0.5, side * 5.7, GROUND_Y);
      const column = new THREE.Mesh(
        this.scope.track(new THREE.CylinderGeometry(0.62, 0.78, 8.5, 18)),
        this.white,
      );
      column.name = 'facade-column';
      column.position.set(p[0], 4.25, p[2]);
      column.castShadow = true;
      this.group.add(column);

      const lampAt: Vec3 = [
        p[0] + r[0] * side * 1.4,
        4.1,
        p[2] + r[2] * side * 1.4,
      ];
      const lamp = new THREE.Mesh(
        this.scope.track(new THREE.SphereGeometry(0.24, 12, 8)),
        this.brass,
      );
      lamp.position.set(lampAt[0], lampAt[1], lampAt[2]);
      this.group.add(lamp);
    }

    const sign = buildWingSign(this.scope, 'Museum of Me', 'The Reliquary of Iterative Becoming');
    sign.scale.setScalar(1.25);
    sign.position.set(facade[0], 9.25, facade[2] + 0.85);
    sign.rotation.y = Math.PI;
    this.group.add(sign);
    this.scope.track(sign.geometry);
  }

  private buildNeutralVestibule(): void {
    const d = faceDirection('s');
    const from = place(d, VESTIBULE_FROM + 0.8, 0, GROUND_Y);
    const to = place(d, VESTIBULE_TO - 0.8, 0, GROUND_Y);
    const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const mid: Vec3 = [(from[0] + to[0]) / 2, GROUND_Y, (from[2] + to[2]) / 2];

    // Neutral overlays create a perceptual baseline before the coloured south
    // wing begins. They are slightly inset so the proven architecture remains.
    const floor = this.box('baseline-vestibule-floor', [mid[0], GROUND_Y + 0.04, mid[2]], [4.7, 0.035, length / 2], this.white);
    floor.rotation.y = Math.atan2(d[0], d[2]);

    for (const side of [-1, 1]) {
      const wallAt = place(d, (VESTIBULE_FROM + VESTIBULE_TO) / 2, side * 5.0, GROUND_Y);
      const wall = this.box(
        'baseline-vestibule-wall',
        [wallAt[0], 4.1, wallAt[2]],
        [0.06, 4.0, length / 2 - 0.7],
        this.white,
      );
      wall.rotation.y = Math.atan2(d[0], d[2]);
    }

    const welcome = buildWingSign(this.scope, 'Welcome', 'Begin here. The museum opens from the Rotunda.');
    welcome.scale.setScalar(0.86);
    const at = place(d, VESTIBULE_FROM + 2.2, 0, GROUND_Y);
    welcome.position.set(at[0], 4.6, at[2]);
    this.group.add(welcome);
    this.scope.track(welcome.geometry);

    this.indoorPlant(place(d, VESTIBULE_FROM + 3.6, -3.8, GROUND_Y), 1.2);
    this.indoorPlant(place(d, VESTIBULE_FROM + 3.6, 3.8, GROUND_Y), 1.2);
  }

  private buildRotundaWelcome(): void {
    // Welcome/information desk offset from the central installation so the
    // Rotunda remains open while still reading as an inhabited public space.
    const desk = new THREE.Group();
    desk.name = 'welcome-information-desk';
    desk.position.set(-6.7, GROUND_Y, 5.2);
    this.group.add(desk);
    this.localBox(desk, [0, 0.72, 0], [2.4, 0.72, 0.8], this.ivory);
    this.localBox(desk, [0, 1.43, -0.48], [2.4, 0.08, 0.34], this.brass);

    const deskSign = buildWingSign(this.scope, 'Information', 'Map · orientation · museum guide');
    deskSign.scale.setScalar(0.34);
    deskSign.position.set(-6.7, 2.45, 5.2);
    this.group.add(deskSign);
    this.scope.track(deskSign.geometry);

    // Plants occupy diagonal blind zones, leaving all radial routes unobstructed.
    for (const [x, z, s] of [
      [-11.2, 11.2, 1.5], [11.2, 11.2, 1.45],
      [-11.2, -11.2, 1.55], [11.2, -11.2, 1.4],
    ] as const) {
      this.indoorPlant([x, GROUND_Y, z], s);
    }

    // Small seating islands fill the room without competing with the centre.
    this.simpleBench([7.4, GROUND_Y, 6.6], -Math.PI / 4);
    this.simpleBench([-7.4, GROUND_Y, -6.6], -Math.PI / 4);
  }

  private buildWingFurnishings(): void {
    for (const wing of WINGS) {
      const d = faceDirection(wing.face);
      const r = rightOf(d);
      const y = wing.floorY;
      const span = wing.hallTo - wing.hallFrom;
      const count = Math.max(3, Math.floor(span / 15));

      for (let i = 0; i < count; i++) {
        const along = wing.hallFrom + ((i + 0.7) / count) * span;
        const side = i % 2 === 0 ? -1 : 1;
        const at = place(d, along, side * (wing.hallHalfWidth - 0.95), y);
        this.indoorPlant(at, wing.level === 1 ? 0.82 : 0.95);

        // A restrained sculptural pedestal on the opposite wall gives long
        // corridors a rhythm even between exhibit doors.
        const opposite = place(d, along + 2.8, -side * (wing.hallHalfWidth - 0.82), y);
        const pedestal = this.box('hall-pedestal', [opposite[0], y + 0.55, opposite[2]], [0.58, 0.55, 0.58], this.darkMetal);
        pedestal.rotation.y = Math.atan2(r[0], r[2]);
        const object = new THREE.Mesh(
          this.scope.track(new THREE.OctahedronGeometry(0.38, 0)),
          this.brass,
        );
        object.position.set(opposite[0], y + 1.48, opposite[2]);
        object.rotation.y = i * 0.7;
        this.group.add(object);
      }

      // Upper-level mezzanines receive smaller plants to preserve sightlines
      // through the Rotunda and down to the ground floor.
      if (wing.level === 1) {
        const threshold = place(d, ROTUNDA_APOTHEM + 4.2, wing.hallHalfWidth - 1.0, LEVEL_1_Y);
        this.indoorPlant(threshold, 0.72);
      }
    }
  }

  private indoorPlant([x, y, z]: Vec3, scale: number): void {
    const g = new THREE.Group();
    g.name = 'indoor-plant';
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    this.group.add(g);

    const pot = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.5, 0.66, 0.78, 12)),
      this.planter,
    );
    pot.position.y = 0.39;
    g.add(pot);

    const stem = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.08, 0.11, 1.45, 7)),
      this.darkMetal,
    );
    stem.position.y = 1.25;
    g.add(stem);

    for (const [dx, dy, dz, s] of [
      [0, 2.15, 0, 0.74], [-0.46, 1.84, 0.08, 0.55],
      [0.43, 1.72, -0.12, 0.5], [0.12, 2.52, 0.08, 0.48],
    ] as const) {
      const crown = new THREE.Mesh(
        this.scope.track(new THREE.IcosahedronGeometry(s, 1)),
        dy > 2.3 ? this.leafLight : this.leaf,
      );
      crown.scale.set(0.78, 1.1, 0.7);
      crown.position.set(dx, dy, dz);
      g.add(crown);
    }
  }

  private simpleBench([x, y, z]: Vec3, rotationY: number): void {
    const bench = new THREE.Group();
    bench.name = 'interior-bench';
    bench.position.set(x, y, z);
    bench.rotation.y = rotationY;
    this.group.add(bench);
    this.localBox(bench, [0, 0.48, 0], [1.8, 0.12, 0.52], this.darkMetal);
    this.localBox(bench, [0, 1.08, 0.42], [1.8, 0.58, 0.1], this.darkMetal);
  }

  private mat(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  }

  private box(name: string, center: Vec3, half: Vec3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.name = name;
    mesh.position.set(center[0], center[1], center[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private localBox(parent: THREE.Object3D, center: Vec3, half: Vec3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.position.set(center[0], center[1], center[2]);
    parent.add(mesh);
    return mesh;
  }
}
