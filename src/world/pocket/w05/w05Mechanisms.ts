import * as THREE from 'three';
import type { Wall } from '../../CollisionWorld';
import type { PocketWorldContext } from '../types';
import { easeInOut, inRect, paintVertices } from '../kit/worldKit';
import {
  ATRIUM, CISTERN, DECK, GALLERY, GROW_SECONDS, LILY_PADS, LILY_RADIUS, POND_WATER_Y, RAFT, RAFT_SECONDS, RAFT_TOP,
  RAFT_VALVE_XZ,
} from './w05Layout';

function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Wall {
  return { kind: 'wall', minX, maxX, minY, maxY, minZ, maxZ };
}

/** Bank openings onto the pond: narrow enough that every point is over pad 0 / pad 2. */
export const BANK_GAP: readonly [number, number] = [-1, 1.8];
const NOTCH_HALF = 0.16;

/** The notch of pad i points away from the walking line (east for x > 0, west otherwise). */
function notchBearing(i: number): number {
  return LILY_PADS[i][0] > 0 ? 0 : Math.PI;
}

/** Whether (x, z) is on grown pad i (inside the circle, outside the classic lily notch). */
export function onLilySurface(i: number, x: number, z: number): boolean {
  const [cx, cz] = LILY_PADS[i];
  const dx = x - cx, dz = z - cz;
  const r = Math.hypot(dx, dz);
  if (r > LILY_RADIUS) return false;
  if (r < 0.5) return true;
  const a = Math.atan2(dz, dx) - notchBearing(i);
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > NOTCH_HALF;
}

export interface PondMaterials {
  readonly leaf: THREE.Material;
}

/**
 * Act I: the Lily Pond. Light from the Sun Mirror starts a seed pod growing;
 * growth, once begun, always completes (it never shrinks under a visitor). A
 * pad supports only when fully grown, and each bank opening is walled until
 * the pad that meets it has grown.
 */
export function buildLilyPond(ctx: PocketWorldContext, mats: PondMaterials) {
  const { scope, collision, root } = ctx;
  const growth = LILY_PADS.map(() => 0);
  const lit = LILY_PADS.map(() => false);

  const pads = LILY_PADS.map(([cx, cz], i) => {
    const shape = new THREE.Shape();
    const n = 56;
    const bearing = notchBearing(i);
    shape.moveTo(0, 0);
    for (let k = 0; k <= n; k++) {
      const a = bearing + NOTCH_HALF + (k / n) * (Math.PI * 2 - NOTCH_HALF * 2);
      const wobble = 1 + 0.015 * Math.sin(a * 7 + i);
      shape.lineTo(Math.cos(a) * LILY_RADIUS * wobble, Math.sin(a) * LILY_RADIUS * wobble);
    }
    shape.closePath();
    const geo = scope.track(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 4 }));
    // Shape (x, y) -> world (x, z); extrude thickness hangs below the top.
    geo.rotateX(Math.PI / 2);
    paintVertices(geo, (x, _y, z, out) => {
      const r = Math.hypot(x, z) / LILY_RADIUS;
      const ang = Math.atan2(z, x);
      const vein = Math.pow(Math.abs(Math.cos(ang * 9)), 18) * (0.4 + r * 0.6);
      out.setHSL(0.27 + r * 0.04, 0.55, 0.2 + r * 0.08 + vein * 0.12);
    });
    const mesh = new THREE.Mesh(geo, mats.leaf);
    mesh.position.set(cx, POND_WATER_Y, cz);
    mesh.scale.setScalar(0.04);
    root.add(mesh);
    return mesh;
  });

  // Bank rails: low iron rails along both banks, open only over pad 0 / pad 2.
  for (const z of [ATRIUM.minZ, DECK.maxZ]) {
    collision.add(box(-8, BANK_GAP[0], -1, 1.1, z - 0.15, z + 0.15));
    collision.add(box(BANK_GAP[1], 8, -1, 1.1, z - 0.15, z + 0.15));
  }

  const apply = () => {
    LILY_PADS.forEach(([cx, cz], i) => {
      const grown = growth[i] >= 1;
      collision.setDynamicFloor(`w05-lily-${i}`, grown
        ? { kind: 'floor', minX: cx - LILY_RADIUS, maxX: cx + LILY_RADIUS, minZ: cz - LILY_RADIUS, maxZ: cz + LILY_RADIUS, y: 0, contains: (x, z) => onLilySurface(i, x, z) }
        : null);
    });
    // The bank openings stay closed until the pad that meets them is whole.
    collision.setDynamicWall('w05-bank-south', growth[0] >= 1 ? null : box(BANK_GAP[0], BANK_GAP[1], -1, 2.5, ATRIUM.minZ - 0.15, ATRIUM.minZ + 0.15));
    collision.setDynamicWall('w05-bank-north', growth[2] >= 1 ? null : box(BANK_GAP[0], BANK_GAP[1], -1, 2.5, DECK.maxZ - 0.15, DECK.maxZ + 0.15));
  };
  apply();

  return {
    light(i: number, reducedMotion: boolean): boolean {
      if (lit[i]) return false;
      lit[i] = true;
      if (reducedMotion) { growth[i] = 1; apply(); }
      return true;
    },
    isLit: (i: number) => lit[i],
    growth: () => [...growth],
    get grownCount() { return growth.filter((g) => g >= 1).length; },
    get complete() { return growth.every((g) => g >= 1); },
    fixedUpdate(dt: number): void {
      let changed = false;
      for (let i = 0; i < growth.length; i++) {
        if (!lit[i] || growth[i] >= 1) continue;
        growth[i] = Math.min(1, growth[i] + dt / GROW_SECONDS);
        if (growth[i] >= 1) changed = true;
      }
      if (changed) apply();
    },
    syncVisuals(): void {
      pads.forEach((mesh, i) => {
        const e = easeInOut(growth[i]);
        mesh.visible = lit[i];
        mesh.scale.setScalar(0.04 + 0.96 * e);
        mesh.position.y = POND_WATER_Y + (0 - POND_WATER_Y) * e;
        mesh.rotation.y = (1 - e) * 1.2;
      });
    },
    dispose(): void {
      LILY_PADS.forEach((_, i) => collision.setDynamicFloor(`w05-lily-${i}`, null));
      collision.setDynamicWall('w05-bank-south', null);
      collision.setDynamicWall('w05-bank-north', null);
    },
  };
}

export interface CisternMaterials {
  readonly leaf: THREE.Material;
  readonly iron: THREE.Material;
  readonly brass: THREE.Material;
  readonly water: THREE.Material;
}

/**
 * Act II: the Cistern. Opening the raft valve floods the cistern and lifts the
 * leaf raft (and anyone on it) from the Fern Hall to the Vine Gallery.
 * Each landing's opening is gated whenever the raft is not level with it, so
 * nobody can step into the shaft or under the raft. The raft collider fills
 * the whole shaft so it meets both landings without a seam.
 */
export function buildCistern(ctx: PocketWorldContext, mats: CisternMaterials) {
  const { scope, collision, root, player } = ctx;
  let y = 0;
  let target = 0;

  // Shaft walls (stone) either side, full height.
  collision.add(box(CISTERN.minX - 0.6, CISTERN.minX, -4, GALLERY.y + 1.2, CISTERN.minZ, CISTERN.maxZ));
  collision.add(box(CISTERN.maxX, CISTERN.maxX + 0.6, -4, GALLERY.y + 1.2, CISTERN.minZ, CISTERN.maxZ));

  const raft = new THREE.Group();
  const leafShape = new THREE.Shape();
  const hw = (RAFT.maxX - RAFT.minX) / 2, hd = (RAFT.maxZ - RAFT.minZ) / 2;
  const n = 48;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    // Superellipse: a broad leaf that fills the shaft's rectangle.
    const c = Math.cos(a), s = Math.sin(a);
    const px = Math.sign(c) * Math.pow(Math.abs(c), 0.35) * hw;
    const pz = Math.sign(s) * Math.pow(Math.abs(s), 0.35) * hd;
    if (k === 0) leafShape.moveTo(px, pz); else leafShape.lineTo(px, pz);
  }
  const leafGeo = scope.track(new THREE.ExtrudeGeometry(leafShape, { depth: 0.18, bevelEnabled: false }));
  leafGeo.rotateX(Math.PI / 2);
  paintVertices(leafGeo, (x, _y, z, out) => {
    const midrib = Math.exp(-x * x * 18);
    const vein = Math.pow(Math.abs(Math.sin(z * 2.2 + Math.abs(x) * 1.6)), 14);
    out.setHSL(0.29, 0.5, 0.17 + midrib * 0.12 + vein * 0.06);
  });
  raft.add(new THREE.Mesh(leafGeo, mats.leaf));
  // Valve post and wheel, riding the raft.
  const post = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.12, 0.16, 0.95, 10)), mats.iron);
  post.position.set(RAFT_VALVE_XZ[0] - (RAFT.minX + RAFT.maxX) / 2, 0.47, RAFT_VALVE_XZ[1] - (RAFT.minZ + RAFT.maxZ) / 2);
  const wheel = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.38, 0.05, 8, 24)), mats.brass);
  wheel.position.set(post.position.x, 1.0, post.position.z);
  wheel.rotation.x = Math.PI / 2;
  const valve = new THREE.Group();
  valve.add(post, wheel);
  raft.add(valve);
  raft.position.set((RAFT.minX + RAFT.maxX) / 2, 0, (RAFT.minZ + RAFT.maxZ) / 2);
  root.add(raft);

  const water = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(CISTERN.maxX - CISTERN.minX, CISTERN.maxZ - CISTERN.minZ)), mats.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.3, (CISTERN.minZ + CISTERN.maxZ) / 2);
  root.add(water);

  // Iron gate bars that read as "closed" at each landing edge.
  const barGeo = scope.track(new THREE.BoxGeometry(CISTERN.maxX - CISTERN.minX, 0.08, 0.08));
  const gateBars = [DECK.minZ, GALLERY.maxZ].map((z, gi) => {
    const g = new THREE.Group();
    for (const h of [0.55, 1.05]) {
      const bar = new THREE.Mesh(barGeo, mats.brass);
      bar.position.y = h;
      g.add(bar);
    }
    g.position.set(0, gi === 0 ? DECK.y : GALLERY.y, z);
    root.add(g);
    return g;
  });

  const atBottom = () => y <= 0.001;
  const atTop = () => y >= RAFT_TOP - 0.001;
  const apply = () => {
    collision.setDynamicFloor('w05-raft', { kind: 'floor', ...CISTERN, y });
    collision.setDynamicWall('w05-gate-deck', atBottom() ? null : box(CISTERN.minX, CISTERN.maxX, -4, GALLERY.y + 2, DECK.minZ - 0.3, DECK.minZ));
    collision.setDynamicWall('w05-gate-gallery', atTop() ? null : box(CISTERN.minX, CISTERN.maxX, -4, GALLERY.y + 2, GALLERY.maxZ, GALLERY.maxZ + 0.3));
    const [vx, vz] = RAFT_VALVE_XZ;
    collision.setDynamicWall('w05-raft-valve', box(vx - 0.25, vx + 0.25, y, y + 1.1, vz - 0.25, vz + 0.25));
  };
  apply();

  const riding = () => {
    const p = player.position;
    return player.grounded && inRect(CISTERN, p.x, p.z) && Math.abs(p.y - y) < 0.3;
  };
  const moveTo = (next: number) => {
    if (next === y) return;
    if (riding()) player.shift(0, next - y, 0);
    y = next;
    apply();
  };

  return {
    valveObject: valve,
    get y() { return y; },
    get target() { return target; },
    get atTop() { return atTop(); },
    get atBottom() { return atBottom(); },
    get moving() { return y !== target; },
    riding,
    /** Flood (rise) or drain (sink), toggling the current direction. */
    toggle(reducedMotion: boolean): 'rising' | 'sinking' {
      target = target === 0 ? RAFT_TOP : 0;
      if (reducedMotion) moveTo(target);
      return target === 0 ? 'sinking' : 'rising';
    },
    call(reducedMotion: boolean): void {
      target = 0;
      if (reducedMotion) moveTo(0);
    },
    fixedUpdate(dt: number): void {
      if (y === target) return;
      const step = (RAFT_TOP / RAFT_SECONDS) * dt;
      moveTo(target > y ? Math.min(target, y + step) : Math.max(target, y - step));
    },
    syncVisuals(time: number, reducedMotion: boolean): void {
      raft.position.y = y + (reducedMotion || y !== target ? 0 : Math.sin(time * 0.9) * 0.015);
      water.position.y = y - 0.3;
      gateBars[0].visible = !atBottom();
      gateBars[1].visible = !atTop();
      if (!reducedMotion && y !== target) wheel.rotation.z += 0.04 * (target > y ? 1 : -1);
    },
    dispose(): void {
      collision.setDynamicFloor('w05-raft', null);
      collision.setDynamicWall('w05-gate-deck', null);
      collision.setDynamicWall('w05-gate-gallery', null);
      collision.setDynamicWall('w05-raft-valve', null);
    },
  };
}
