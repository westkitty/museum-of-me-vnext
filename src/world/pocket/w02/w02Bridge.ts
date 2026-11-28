import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { easeInOut } from '../kit/worldKit';
import {
  BRIDGE, BRIDGE_GROW_SECONDS, BRIDGE_PLANKS, BRIDGE_Y, GORGE_EAST, GORGE_WEST,
} from './w02Layout';

/**
 * The Veiled Gorge root bridge.
 *
 * Root cables visibly grow west→east (tube draw range), then woven root
 * planks unfold in sequence. The floor collider covers ONLY planks that are
 * fully grown, and a growth-front wall stops the visitor at the last grown
 * plank, so no frame ever offers an invisible floor or an unsupported edge.
 * Reduced motion jumps straight to the identical final state.
 */

export const BRIDGE_FLOOR_ID = 'w02-root-bridge';
const FRONT_WALL_ID = 'w02-bridge-front';
const WEST_LIP_ID = 'w02-west-lip';
const RAIL_N_ID = 'w02-bridge-rail-n';
const RAIL_S_ID = 'w02-bridge-rail-s';
const PLANK_W = (GORGE_EAST - GORGE_WEST) / BRIDGE_PLANKS;
/** Cables lead the planks: plank k starts once the cables pass its far edge. */
const CABLE_SHARE = 0.55;

export interface RootBridge {
  readonly growth: number;
  readonly open: boolean;
  readonly complete: boolean;
  /** Eastmost x the collider supports (GORGE_WEST when nothing is grown). */
  readonly supportedMaxX: number;
  readonly group: THREE.Group;
  grow(reducedMotion: boolean): void;
  fixedUpdate(dt: number): void;
}

export function buildRootBridge(ctx: PocketWorldContext, rootMaterial: THREE.Material): RootBridge {
  const { scope, collision } = ctx;
  const group = new THREE.Group();
  group.name = 'w02-root-bridge';
  ctx.root.add(group);

  const cables: THREE.Mesh[] = [];
  const cableIndexCounts: number[] = [];
  const zs = [BRIDGE.minZ + 0.3, BRIDGE.minZ + 2.2, (BRIDGE.minZ + BRIDGE.maxZ) / 2, BRIDGE.maxZ - 2.2, BRIDGE.maxZ - 0.3];
  const RADIAL = 7;
  zs.forEach((z, i) => {
    const sag = i === 2 ? 0.55 : 0.35;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(GORGE_WEST - 3.2, BRIDGE_Y - 1.4, z + 0.6),
      new THREE.Vector3(GORGE_WEST - 0.4, BRIDGE_Y - 0.45, z),
      new THREE.Vector3((GORGE_WEST + GORGE_EAST) / 2, BRIDGE_Y - 0.45 - sag, z + Math.sin(i) * 0.3),
      new THREE.Vector3(GORGE_EAST + 0.4, BRIDGE_Y - 0.45, z),
      new THREE.Vector3(GORGE_EAST + 3.2, BRIDGE_Y - 1.4, z - 0.6),
    ]);
    const geometry = scope.track(new THREE.TubeGeometry(curve, 48, i === 2 ? 0.42 : 0.3, RADIAL, false));
    const cable = new THREE.Mesh(geometry, rootMaterial);
    cable.castShadow = ctx.quality.shadows;
    group.add(cable);
    cables.push(cable);
    cableIndexCounts.push(geometry.index?.count ?? 0);
  });
  // Handrail roots, grown last.
  const rails: THREE.Mesh[] = [];
  for (const z of [BRIDGE.minZ - 0.05, BRIDGE.maxZ + 0.05]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(GORGE_WEST - 1.5, BRIDGE_Y - 0.2, z), new THREE.Vector3(GORGE_WEST + 1, BRIDGE_Y + 1.05, z),
      new THREE.Vector3((GORGE_WEST + GORGE_EAST) / 2, BRIDGE_Y + 0.85, z), new THREE.Vector3(GORGE_EAST - 1, BRIDGE_Y + 1.05, z),
      new THREE.Vector3(GORGE_EAST + 1.5, BRIDGE_Y - 0.2, z),
    ]);
    const geometry = scope.track(new THREE.TubeGeometry(curve, 40, 0.17, 6, false));
    const rail = new THREE.Mesh(geometry, rootMaterial);
    group.add(rail);
    rails.push(rail);
    cableIndexCounts.push(geometry.index?.count ?? 0);
  }

  // Woven plank sections: a flat-topped deck whose top is exactly BRIDGE_Y.
  const plankMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.88, flatShading: true }));
  const leafMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x6fb36a, roughness: 0.8, side: THREE.DoubleSide }));
  const plankGeo = scope.track(new THREE.BoxGeometry(PLANK_W * 0.98, 0.36, BRIDGE.maxZ - BRIDGE.minZ));
  const strandGeo = scope.track(new THREE.CylinderGeometry(0.11, 0.11, BRIDGE.maxZ - BRIDGE.minZ, 6));
  const leafGeo = scope.track(new THREE.ConeGeometry(0.28, 0.7, 4));
  const planks: THREE.Group[] = [];
  for (let k = 0; k < BRIDGE_PLANKS; k++) {
    const plank = new THREE.Group();
    // Pivot at the plank's west edge so it unfolds outward across the gorge.
    plank.position.set(GORGE_WEST + k * PLANK_W, BRIDGE_Y, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
    const deck = new THREE.Mesh(plankGeo, plankMat);
    deck.position.set(PLANK_W / 2, -0.18, 0);
    deck.receiveShadow = true;
    plank.add(deck);
    for (const dx of [0.18, PLANK_W - 0.18]) {
      const strand = new THREE.Mesh(strandGeo, rootMaterial);
      strand.rotation.x = Math.PI / 2;
      strand.position.set(dx, 0.02, 0);
      plank.add(strand);
    }
    for (const dz of [-3.2, 3.4]) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(PLANK_W * 0.5, 0.28, dz);
      leaf.rotation.z = (k % 2 ? 1 : -1) * 0.5;
      plank.add(leaf);
    }
    plank.visible = false;
    group.add(plank);
    planks.push(plank);
  }

  // Before activation a root lip guards the shelf's gorge edge.
  collision.setDynamicWall(WEST_LIP_ID, {
    kind: 'wall', minX: GORGE_WEST - 0.3, maxX: GORGE_WEST, minY: BRIDGE_Y - 0.6, maxY: BRIDGE_Y + 1.2,
    minZ: BRIDGE.minZ, maxZ: BRIDGE.maxZ,
  });
  const lipMesh = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.28, 0.32, BRIDGE.maxZ - BRIDGE.minZ, 7)), rootMaterial);
  lipMesh.rotation.x = Math.PI / 2;
  lipMesh.position.set(GORGE_WEST - 0.2, BRIDGE_Y + 0.3, (BRIDGE.minZ + BRIDGE.maxZ) / 2);
  ctx.root.add(lipMesh);

  for (const cable of [...cables, ...rails]) cable.geometry.setDrawRange(0, 0);

  let open = false;
  let growth = 0;
  let supportedPlanks = 0;
  let complete = false;

  const plankProgress = (k: number) => {
    const start = CABLE_SHARE * ((k + 1) / BRIDGE_PLANKS);
    const span = (1 - CABLE_SHARE) / BRIDGE_PLANKS * 2.2;
    return Math.min(1, Math.max(0, (growth - start) / span));
  };

  const apply = () => {
    const cableT = Math.min(1, growth / CABLE_SHARE);
    const all = [...cables, ...rails];
    all.forEach((mesh, i) => {
      const t = i < cables.length ? cableT : Math.max(0, (growth - 0.75) / 0.25);
      const unit = RADIAL * 6;
      const count = Math.round((cableIndexCounts[i] / unit) * easeInOut(t)) * unit;
      mesh.geometry.setDrawRange(0, count);
      mesh.visible = count > 0;
    });
    let grownPlanks = 0;
    planks.forEach((plank, k) => {
      const t = plankProgress(k);
      plank.visible = t > 0;
      const e = easeInOut(t);
      plank.scale.set(Math.max(0.02, e), 0.4 + 0.6 * e, 0.6 + 0.4 * e);
      plank.rotation.z = (1 - e) * 0.9;
      if (t >= 1 && grownPlanks === k) grownPlanks = k + 1;
    });
    if (grownPlanks !== supportedPlanks) {
      supportedPlanks = grownPlanks;
      collision.setDynamicFloor(BRIDGE_FLOOR_ID, supportedPlanks === 0 ? null : {
        kind: 'floor', minX: GORGE_WEST, maxX: GORGE_WEST + supportedPlanks * PLANK_W,
        minZ: BRIDGE.minZ, maxZ: BRIDGE.maxZ, y: BRIDGE_Y,
      });
    }
    // Complete only when every plank AND the handrail roots are visibly grown.
    const nowComplete = supportedPlanks === BRIDGE_PLANKS && growth >= 1;
    if (open && !nowComplete) {
      // The growth front: the visitor can follow the bridge but never step past it.
      const front = GORGE_WEST + supportedPlanks * PLANK_W;
      collision.setDynamicWall(WEST_LIP_ID, null);
      lipMesh.visible = false;
      collision.setDynamicWall(FRONT_WALL_ID, {
        kind: 'wall', minX: front, maxX: front + 0.3, minY: BRIDGE_Y - 0.6, maxY: BRIDGE_Y + 1.6,
        minZ: BRIDGE.minZ, maxZ: BRIDGE.maxZ,
      });
    }
    if (nowComplete && !complete) {
      complete = true;
      collision.setDynamicWall(FRONT_WALL_ID, null);
      collision.setDynamicWall(WEST_LIP_ID, null);
      lipMesh.visible = false;
      collision.setDynamicWall(RAIL_N_ID, { kind: 'wall', minX: GORGE_WEST, maxX: GORGE_EAST, minY: BRIDGE_Y - 0.6, maxY: BRIDGE_Y + 1.2, minZ: BRIDGE.minZ - 0.3, maxZ: BRIDGE.minZ });
      collision.setDynamicWall(RAIL_S_ID, { kind: 'wall', minX: GORGE_WEST, maxX: GORGE_EAST, minY: BRIDGE_Y - 0.6, maxY: BRIDGE_Y + 1.2, minZ: BRIDGE.maxZ, maxZ: BRIDGE.maxZ + 0.3 });
    }
  };

  return {
    get growth() { return growth; },
    get open() { return open; },
    get complete() { return complete; },
    get supportedMaxX() { return GORGE_WEST + supportedPlanks * PLANK_W; },
    group,
    grow(reducedMotion: boolean) {
      if (open) return;
      open = true;
      growth = reducedMotion ? 1 : 0;
      apply();
    },
    fixedUpdate(dt: number) {
      if (!open || growth >= 1) return;
      growth = Math.min(1, growth + dt / BRIDGE_GROW_SECONDS);
      apply();
    },
  };
}
