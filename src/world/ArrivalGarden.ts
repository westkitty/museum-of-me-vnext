import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import {
  GROUND_Y, PLAZA_DEPTH, VESTIBULE_TO,
  faceDirection, place, type Vec3,
} from './layout';

/**
 * Exterior Layer-2 dressing for the visitor's first view of the museum.
 * All placements are authored and deterministic; the central approach remains
 * deliberately clear so decoration can never turn the required route into an
 * obstacle course.
 */
export class ArrivalGarden {
  readonly group = new THREE.Group();

  private readonly stone: THREE.MeshStandardMaterial;
  private readonly lawn: THREE.MeshStandardMaterial;
  private readonly leaf: THREE.MeshStandardMaterial;
  private readonly leafLight: THREE.MeshStandardMaterial;
  private readonly bark: THREE.MeshStandardMaterial;
  private readonly flower: THREE.MeshStandardMaterial;
  private readonly metal: THREE.MeshStandardMaterial;
  private readonly water: THREE.MeshStandardMaterial;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'arrival-garden';
    this.stone = this.mat(0xe5e0d3, 0.92);
    this.lawn = this.mat(0x4f7b45, 1);
    this.leaf = this.mat(0x315f36, 0.94);
    this.leafLight = this.mat(0x6f954f, 0.96);
    this.bark = this.mat(0x604733, 1);
    this.flower = this.mat(0xd79870, 0.86);
    this.metal = this.mat(0x3e4545, 0.5, 0.18);
    this.water = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x80b7c7,
      roughness: 0.18,
      metalness: 0,
      transparent: true,
      opacity: 0.68,
    }));
  }

  build(): THREE.Group {
    const south = faceDirection('s');
    const nearZ = place(south, VESTIBULE_TO)[2];
    const farZ = place(south, VESTIBULE_TO + PLAZA_DEPTH)[2];
    const z0 = Math.min(nearZ, farZ);
    const z1 = Math.max(nearZ, farZ);
    const midZ = (z0 + z1) / 2;

    this.box('garden-main-walk', [0, GROUND_Y + 0.025, midZ], [5.4, 0.025, PLAZA_DEPTH / 2], this.stone);

    for (const side of [-1, 1]) {
      this.box(
        `garden-lawn-${side < 0 ? 'west' : 'east'}`,
        [side * 19, GROUND_Y + 0.035, midZ],
        [11.5, 0.035, PLAZA_DEPTH / 2 - 1.8],
        this.lawn,
      );
    }

    const trees: readonly Vec3[] = [
      [-27, GROUND_Y, z0 + 6], [27, GROUND_Y, z0 + 6],
      [-25, GROUND_Y, midZ + 5], [25, GROUND_Y, midZ + 5],
      [-29, GROUND_Y, z1 - 3], [29, GROUND_Y, z1 - 3],
    ];
    trees.forEach((p, i) => this.tree(p, 4.6 + (i % 2) * 0.6));

    for (const side of [-1, 1]) {
      for (const z of [z0 + 5, midZ, z1 - 5]) {
        this.shrub([side * 14.5, GROUND_Y, z], 1.45);
        this.shrub([side * 20.5, GROUND_Y, z + 2.2], 1.1);
      }
      for (const z of [z0 + 8, midZ + 3.5, z1 - 7]) {
        this.flowerCluster([side * 17.5, GROUND_Y, z]);
      }
    }

    this.bench([-10.5, GROUND_Y, midZ - 3], Math.PI / 2);
    this.bench([10.5, GROUND_Y, midZ + 4], -Math.PI / 2);
    this.fountain([18.5, GROUND_Y, midZ - 1]);
    this.arrivalMarker([-7.5, GROUND_Y, z1 - 4]);
    this.arrivalMarker([7.5, GROUND_Y, z1 - 4]);

    return this.group;
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
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private tree([x, y, z]: Vec3, height: number): void {
    const trunkRadius = 0.48;
    const trunk = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.18, height, 10)),
      this.bark,
    );
    trunk.name = 'garden-tree-trunk';
    trunk.position.set(x, y + height / 2, z);
    trunk.castShadow = true;
    this.group.add(trunk);
    this.collision.addBox([x, y + height / 2, z], [0.58, height / 2, 0.58]);

    const crownGeo = this.scope.track(new THREE.IcosahedronGeometry(2.4, 1));
    const crown = new THREE.Mesh(crownGeo, this.leaf);
    crown.name = 'garden-tree-crown';
    crown.scale.set(1.25, 1.05, 1.1);
    crown.position.set(x, y + height + 1.25, z);
    crown.castShadow = true;
    this.group.add(crown);

    const crown2 = new THREE.Mesh(this.scope.track(new THREE.IcosahedronGeometry(1.65, 1)), this.leafLight);
    crown2.position.set(x + 1.15, y + height + 0.8, z - 0.55);
    crown2.castShadow = true;
    this.group.add(crown2);
  }

  private shrub([x, y, z]: Vec3, radius: number): void {
    const shrub = new THREE.Mesh(
      this.scope.track(new THREE.IcosahedronGeometry(radius, 1)),
      this.leafLight,
    );
    shrub.name = 'garden-shrub';
    shrub.scale.y = 0.72;
    shrub.position.set(x, y + radius * 0.62, z);
    shrub.castShadow = true;
    this.group.add(shrub);
  }

  private flowerCluster([x, y, z]: Vec3): void {
    for (const [dx, dz] of [[-0.7, -0.3], [0.15, 0.35], [0.7, -0.15], [-0.15, 0.75]] as const) {
      const stem = new THREE.Mesh(
        this.scope.track(new THREE.CylinderGeometry(0.035, 0.045, 0.62, 5)),
        this.leaf,
      );
      stem.position.set(x + dx, y + 0.31, z + dz);
      this.group.add(stem);
      const head = new THREE.Mesh(
        this.scope.track(new THREE.SphereGeometry(0.16, 7, 5)),
        this.flower,
      );
      head.position.set(x + dx, y + 0.68, z + dz);
      this.group.add(head);
    }
  }

  private bench([x, y, z]: Vec3, rotationY: number): void {
    const bench = new THREE.Group();
    bench.name = 'garden-bench';
    bench.position.set(x, y, z);
    bench.rotation.y = rotationY;
    this.group.add(bench);

    const seat = this.localBox(bench, [0, 0.55, 0], [2.2, 0.12, 0.55], this.metal);
    seat.castShadow = true;
    this.localBox(bench, [0, 1.18, 0.45], [2.2, 0.7, 0.12], this.metal);
    for (const sx of [-1.7, 1.7]) this.localBox(bench, [sx, 0.27, 0], [0.1, 0.27, 0.42], this.metal);

    const halfX = Math.abs(Math.cos(rotationY)) * 2.35 + Math.abs(Math.sin(rotationY)) * 0.7;
    const halfZ = Math.abs(Math.sin(rotationY)) * 2.35 + Math.abs(Math.cos(rotationY)) * 0.7;
    this.collision.addBox([x, y + 0.7, z], [halfX, 0.7, halfZ]);
  }

  private fountain([x, y, z]: Vec3): void {
    const base = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(3.1, 3.4, 0.55, 28)),
      this.stone,
    );
    base.name = 'garden-fountain';
    base.position.set(x, y + 0.28, z);
    base.castShadow = true;
    this.group.add(base);
    this.collision.addBox([x, y + 0.28, z], [3.4, 0.28, 3.4]);

    const pool = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(2.55, 2.55, 0.08, 28)),
      this.water,
    );
    pool.position.set(x, y + 0.59, z);
    this.group.add(pool);

    const column = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.36, 0.58, 2.2, 12)),
      this.stone,
    );
    column.position.set(x, y + 1.55, z);
    this.group.add(column);
    const bowl = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(1.15, 0.85, 0.22, 18)),
      this.water,
    );
    bowl.position.set(x, y + 2.6, z);
    this.group.add(bowl);
  }

  private arrivalMarker([x, y, z]: Vec3): void {
    const marker = this.box('garden-arrival-marker', [x, y + 1.3, z], [0.55, 1.3, 0.55], this.stone);
    marker.castShadow = true;
    const cap = new THREE.Mesh(
      this.scope.track(new THREE.SphereGeometry(0.32, 12, 8)),
      this.flower,
    );
    cap.position.set(x, y + 2.78, z);
    this.group.add(cap);
  }

  private localBox(
    parent: THREE.Object3D,
    center: Vec3,
    half: Vec3,
    material: THREE.Material,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.position.set(center[0], center[1], center[2]);
    parent.add(mesh);
    return mesh;
  }
}
