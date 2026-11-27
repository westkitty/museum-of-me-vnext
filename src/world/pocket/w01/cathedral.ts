import * as THREE from 'three';
import type { ResourceScope } from '../../../assets/ResourceScope';
import type { CollisionWorld } from '../../CollisionWorld';
import type { Vec3 } from '../../layout';
import type { W01CathedralPhase } from './types';

export const CONDUCTOR_PLATFORM_SPOT: Vec3 = [0, 6, -44];

/**
 * Monumental Coral Cathedral:
 * Three distant towering coral-arch wings converge smoothly when activated by
 * the visitor after awakening all three musicians. Once locked in place, it
 * registers static walkable colliders creating a genuine new ascending passage
 * from the Central Current Station ([0, 0, -11]) up to the Conductor's Platform
 * ([0, 6, -46]).
 */
export class CoralCathedralSystem {
  readonly group = new THREE.Group();
  readonly conductorPodium: THREE.Group;

  private readonly wings: {
    readonly group: THREE.Group;
    readonly startPos: THREE.Vector3;
    readonly endPos: THREE.Vector3;
  }[] = [];
  private readonly passageGroup = new THREE.Group();
  private readonly podiumOrbMat: THREE.MeshStandardMaterial;

  private phase: W01CathedralPhase = 'apart';
  private progress = 0;
  private readonly assemblyDuration = 4.2;

  constructor(
    scope: ResourceScope,
    private readonly collision: CollisionWorld,
  ) {
    this.group.name = 'w01-coral-cathedral';

    const wingColors = [0x38e4ae, 0x67d4ff, 0xffca6b] as const;
    const starts: readonly Vec3[] = [[-52, 2, -38], [52, 2, -38], [0, 8, -86]];
    const ends: readonly Vec3[] = [[-8.5, 0, -30], [8.5, 0, -30], [0, 0, -46]];

    for (let i = 0; i < 3; i++) {
      const wing = new THREE.Group();
      wing.name = `w01-cathedral-wing-${i}`;
      const archMat = scope.track(new THREE.MeshStandardMaterial({
        color: 0x265b75,
        emissive: wingColors[i],
        emissiveIntensity: 0.35,
        roughness: 0.48,
      }));
      const pillarGeo = scope.track(new THREE.CylinderGeometry(1.1, 1.5, 16, 10));
      const ribGeo = scope.track(new THREE.TorusGeometry(6.5, 0.72, 8, 22, Math.PI));
      const spireA = new THREE.Mesh(pillarGeo, archMat);
      spireA.position.set(0, 8, -5);
      const spireB = new THREE.Mesh(pillarGeo, archMat);
      spireB.position.set(0, 8, 5);
      const rib = new THREE.Mesh(ribGeo, archMat);
      rib.position.set(0, 14, 0);
      rib.rotation.y = Math.PI / 2;
      wing.add(spireA, spireB, rib);
      wing.position.set(starts[i][0], starts[i][1], starts[i][2]);
      this.group.add(wing);
      this.wings.push({
        group: wing,
        startPos: new THREE.Vector3(...starts[i]),
        endPos: new THREE.Vector3(...ends[i]),
      });
    }

    // Traversable ascending nave + Conductor's Platform (hidden until assembled)
    this.passageGroup.name = 'w01-cathedral-passage';
    this.passageGroup.visible = false;

    const bridgeMat = scope.track(new THREE.MeshStandardMaterial({
      color: 0x295f75,
      emissive: 0x164e63,
      emissiveIntensity: 0.3,
      roughness: 0.68,
    }));
    const trimMat = scope.track(new THREE.MeshStandardMaterial({
      color: 0x9ef7ff,
      emissive: 0x3edbf0,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    }));

    // 16 wide stepped coral treads from z = -12 (y = 0) up to z = -38 (y = 6)
    const stepGeo = scope.track(new THREE.BoxGeometry(8.2, 0.6, 2.2));
    for (let s = 0; s < 16; s++) {
      const y = (s + 1) * 0.375;
      const z = -12.5 - s * 1.6;
      const tread = new THREE.Mesh(stepGeo, bridgeMat);
      tread.position.set(0, y - 0.3, z);
      this.passageGroup.add(tread);
    }

    // Conductor's Platform ([0, 6, -46], 16 m x 16 m)
    const plat = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(8.8, 9.8, 1.8, 24)), bridgeMat);
    plat.position.set(0, 5.1, -46);
    const platRim = new THREE.Mesh(scope.track(new THREE.TorusGeometry(8.5, 0.24, 8, 32)), trimMat);
    platRim.rotation.x = Math.PI / 2;
    platRim.position.set(0, 6.05, -46);
    this.passageGroup.add(plat, platRim);

    // Conductor's Podium at [0, 6, -48]
    this.conductorPodium = new THREE.Group();
    this.conductorPodium.name = 'w01-conductor-podium';
    this.conductorPodium.position.set(0, 6, -48);
    const ped = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.65, 0.9, 1.3, 12)), bridgeMat);
    ped.position.y = 0.65;
    this.podiumOrbMat = scope.track(new THREE.MeshStandardMaterial({
      color: 0xffe89e,
      emissive: 0xffc857,
      emissiveIntensity: 1.25,
      roughness: 0.2,
    }));
    const orb = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.48, 1)), this.podiumOrbMat);
    orb.position.y = 1.75;
    this.conductorPodium.add(ped, orb);
    this.passageGroup.add(this.conductorPodium);

    this.group.add(this.passageGroup);
  }

  get currentPhase(): W01CathedralPhase {
    return this.phase;
  }

  get currentProgress(): number {
    return this.progress;
  }

  beginAssembly(reducedMotion: boolean): boolean {
    if (this.phase !== 'apart') return false;
    if (reducedMotion) {
      this.progress = 1;
      this.applyWingPositions(1);
      this.lockInAssembledPassage();
      return true;
    }
    this.phase = 'assembling';
    this.progress = 0;
    return true;
  }

  markCompleted(): void {
    this.phase = 'completed';
    this.podiumOrbMat.emissiveIntensity = 2.0;
  }

  update(dt: number, reducedMotion: boolean): boolean {
    if (this.phase !== 'assembling') return false;
    if (reducedMotion) {
      this.progress = 1;
      this.applyWingPositions(1);
      this.lockInAssembledPassage();
      return true;
    }
    this.progress = Math.min(1, this.progress + Math.max(0, dt) / this.assemblyDuration);
    const eased = this.progress * this.progress * (3 - 2 * this.progress);
    this.applyWingPositions(eased);
    if (this.progress >= 1) {
      this.lockInAssembledPassage();
      return true;
    }
    return false;
  }

  dispose(): void {
    this.clearDynamicColliders();
  }

  private applyWingPositions(t: number): void {
    for (const w of this.wings) {
      w.group.position.lerpVectors(w.startPos, w.endPos, t);
    }
  }

  private lockInAssembledPassage(): void {
    this.phase = 'assembled';
    this.passageGroup.visible = true;
    // Register static walkable colliders only after assembly locks in.
    for (let s = 0; s < 16; s++) {
      const y = (s + 1) * 0.375;
      const z = -12.5 - s * 1.6;
      this.collision.setDynamicFloor(`w01-cathedral-step-${s}`, {
        kind: 'floor',
        minX: -4.1,
        maxX: 4.1,
        minZ: z - 1.15,
        maxZ: z + 1.15,
        y,
      });
    }
    this.collision.setDynamicFloor('w01-cathedral-conductor-platform', {
      kind: 'floor',
      minX: -8.6,
      maxX: 8.6,
      minZ: -54.6,
      maxZ: -37.4,
      y: 6,
      contains: (x, z) => x * x + (z + 46) * (z + 46) <= 8.5 * 8.5,
    });
  }

  private clearDynamicColliders(): void {
    for (let s = 0; s < 16; s++) {
      this.collision.setDynamicFloor(`w01-cathedral-step-${s}`, null);
    }
    this.collision.setDynamicFloor('w01-cathedral-conductor-platform', null);
  }
}
