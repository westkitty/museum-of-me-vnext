import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { WINGS, faceDirection, place, type Vec3, type WingSpec } from './layout';
import { PaletteSet } from './palette';

/**
 * Wing-specific furniture/sculptural dressing.
 *
 * Existing hall plants and pedestals provide density; this layer gives every
 * wing its own object vocabulary so identity is carried by form as well as
 * colour. These objects are deliberately non-colliding and live against the
 * hall edges, leaving the validated visitor route untouched.
 */
export class WingFurnishings {
  readonly group = new THREE.Group();
  private readonly palettes: PaletteSet;
  private readonly glass: THREE.MeshStandardMaterial;
  private readonly dark: THREE.MeshStandardMaterial;

  constructor(private readonly scope: ResourceScope) {
    this.group.name = 'wing-specific-furnishings';
    this.palettes = new PaletteSet(scope);
    this.glass = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0xd9eff6,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.3,
    }));
    this.dark = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0x252b2e,
      roughness: 0.58,
      metalness: 0.18,
    }));
  }

  build(): THREE.Group {
    for (const wing of WINGS) this.buildWing(wing);
    return this.group;
  }

  private buildWing(wing: WingSpec): void {
    const d = faceDirection(wing.face);
    const angle = Math.atan2(d[0], d[2]);
    const palette = this.palettes.get(wing.id);
    const span = wing.hallTo - wing.hallFrom;

    for (const [index, fraction, side] of [
      [0, 0.29, -1],
      [1, 0.66, 1],
    ] as const) {
      const along = wing.hallFrom + span * fraction;
      const at = place(d, along, side * (wing.hallHalfWidth - 1.05), wing.floorY);
      const furnishing = new THREE.Group();
      furnishing.name = `wing-furnishing:${wing.id}`;
      furnishing.position.set(at[0], at[1], at[2]);
      furnishing.rotation.y = angle + (side > 0 ? Math.PI : 0);
      furnishing.scale.setScalar(wing.level === 1 ? 0.82 : 1);
      this.group.add(furnishing);

      switch (wing.id) {
        case 'north':
          this.northThreadSpindle(furnishing, palette.accent, palette.trim, index);
          break;
        case 'east':
          this.eastSystemsConsole(furnishing, palette.accent, palette.trim, index);
          break;
        case 'south':
          this.southPlayStack(furnishing, palette.accent, palette.trim, index);
          break;
        case 'west':
          this.westArchiveVitrine(furnishing, palette.accent, palette.trim, index);
          break;
        case 'media':
          this.mediaWaveStation(furnishing, palette.accent, palette.trim, index);
          break;
        case 'infra':
          this.infraLocalRack(furnishing, palette.accent, palette.trim, index);
          break;
      }
    }
  }

  private northThreadSpindle(parent: THREE.Group, accent: THREE.Material, trim: THREE.Material, index: number): void {
    this.localBox(parent, [0, 0.22, 0], [0.72, 0.22, 0.72], trim);
    const spine = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.09, 0.12, 2.7, 8)), this.dark);
    spine.position.y = 1.55;
    parent.add(spine);
    for (const [y, radius] of [[0.9, 0.62], [1.55, 0.85], [2.2, 0.58]] as const) {
      const ring = new THREE.Mesh(this.scope.track(new THREE.TorusGeometry(radius, 0.06, 6, 28)), accent);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2 + index * 0.18;
      parent.add(ring);
    }
    const star = new THREE.Mesh(this.scope.track(new THREE.OctahedronGeometry(0.34, 0)), accent);
    star.name = 'north-thread-star';
    star.position.y = 3.0;
    star.rotation.y = index * 0.7;
    parent.add(star);
  }

  private eastSystemsConsole(parent: THREE.Group, accent: THREE.Material, trim: THREE.Material, index: number): void {
    this.localBox(parent, [0, 0.42, 0], [1.55, 0.42, 0.56], this.dark);
    const screen = this.localBox(parent, [0, 1.28, -0.22], [1.3, 0.62, 0.08], accent);
    screen.rotation.x = -0.22;
    this.localBox(parent, [-1.1, 1.02, 0.2], [0.12, 0.72, 0.12], trim);
    this.localBox(parent, [1.1, 1.02, 0.2], [0.12, 0.72, 0.12], trim);
    for (let i = 0; i < 3; i++) {
      const node = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.12 + i * 0.025, 10, 7)), i === index ? trim : accent);
      node.position.set(-0.55 + i * 0.55, 1.25 + (i % 2) * 0.2, -0.34);
      parent.add(node);
    }
  }

  private southPlayStack(parent: THREE.Group, accent: THREE.Material, trim: THREE.Material, index: number): void {
    this.localBox(parent, [0, 0.18, 0], [1.45, 0.18, 0.8], trim);
    for (let i = 0; i < 3; i++) {
      const block = this.localBox(
        parent,
        [(-0.55 + i * 0.55), 0.65 + i * 0.42, (i % 2) * 0.18],
        [0.48, 0.28, 0.48],
        i % 2 === 0 ? accent : trim,
      );
      block.rotation.y = (i - 1) * 0.24 + index * 0.12;
    }
    const ring = new THREE.Mesh(this.scope.track(new THREE.TorusGeometry(0.55, 0.12, 8, 24)), accent);
    ring.name = 'south-play-ring';
    ring.position.set(0.72, 2.08, 0);
    ring.rotation.set(Math.PI / 2.3, 0.35, 0.2);
    parent.add(ring);
  }

  private westArchiveVitrine(parent: THREE.Group, accent: THREE.Material, trim: THREE.Material, index: number): void {
    this.localBox(parent, [0, 0.28, 0], [1.45, 0.28, 0.72], trim);
    const caseMesh = this.localBox(parent, [0, 1.38, 0], [1.25, 0.88, 0.58], this.glass);
    caseMesh.name = 'west-archive-case';
    for (let i = 0; i < 3; i++) {
      const slab = this.localBox(
        parent,
        [-0.58 + i * 0.58, 1.15 + i * 0.16, -0.02],
        [0.23, 0.48, 0.36],
        i === index ? accent : this.dark,
      );
      slab.rotation.z = (-0.12 + i * 0.12);
    }
  }

  private mediaWaveStation(parent: THREE.Group, accent: THREE.Material, trim: THREE.Material, index: number): void {
    this.localBox(parent, [0, 0.2, 0], [1.5, 0.2, 0.68], trim);
    for (let i = 0; i < 4; i++) {
      const wave = new THREE.Mesh(
        this.scope.track(new THREE.TorusGeometry(0.38 + i * 0.16, 0.055, 6, 28, Math.PI * 1.25)),
        i % 2 === 0 ? accent : trim,
      );
      wave.name = 'media-wave-sculpture';
      wave.position.set((i - 1.5) * 0.35, 1.0 + i * 0.32, 0);
      wave.rotation.set(Math.PI / 2, index * 0.18, -0.45);
      parent.add(wave);
    }
  }

  private infraLocalRack(parent: THREE.Group, accent: THREE.Material, trim: THREE.Material, index: number): void {
    const rack = this.localBox(parent, [0, 1.2, 0], [1.0, 1.2, 0.58], this.dark);
    rack.name = 'infra-local-rack';
    this.localBox(parent, [0, 0.18, 0], [1.22, 0.18, 0.72], trim);
    for (let i = 0; i < 5; i++) {
      this.localBox(parent, [0, 0.48 + i * 0.38, -0.6], [0.78, 0.055, 0.055], i === index + 1 ? trim : accent);
    }
    for (const x of [-0.58, 0.58]) {
      const node = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 8)), accent);
      node.position.set(x, 2.58, 0);
      parent.add(node);
    }
  }

  private localBox(parent: THREE.Object3D, center: Vec3, half: Vec3, material: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.scope.track(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2)),
      material,
    );
    mesh.position.set(center[0], center[1], center[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
}
