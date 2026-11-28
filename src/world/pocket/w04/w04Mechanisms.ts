import * as THREE from 'three';
import type { Wall } from '../../CollisionWorld';
import type { PocketWorldContext } from '../types';
import { easeInOut, inRect } from '../kit/worldKit';
import {
  BRIDGE, BRIDGE_SEGMENTS, EQ_BARS, EQ_SETTLE_SECONDS, eqBarRect, eqTarget, type EqPreset, SEGMENT_RISE_SECONDS, segmentRect,
} from './w04Layout';

function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Wall {
  return { kind: 'wall', minX, maxX, minY, maxY, minZ, maxZ };
}

export interface BeatMaterials {
  readonly deck: THREE.Material;
  readonly glow: (hex: number) => THREE.MeshStandardMaterial;
}

/**
 * Act I: the Sequencer Bridge. Each recorded beat raises two bridge segments
 * out of the void. A segment supports the visitor only once fully risen, and
 * every missing segment is walled at both ends, so a gap can never be walked
 * into. Recording is one-way (a beat cannot be un-recorded under a visitor).
 */
export function buildSequencerBridge(ctx: PocketWorldContext, mats: BeatMaterials) {
  const { scope, collision, root } = ctx;
  const rise = new Array<number>(BRIDGE_SEGMENTS).fill(0);
  const raising = new Array<boolean>(BRIDGE_SEGMENTS).fill(false);
  const segGeo = scope.track(new THREE.BoxGeometry(BRIDGE.maxX - BRIDGE.minX, 0.5, 1.92));
  const stripGeo = scope.track(new THREE.BoxGeometry(BRIDGE.maxX - BRIDGE.minX - 0.3, 0.04, 0.16));
  const segMeshes = Array.from({ length: BRIDGE_SEGMENTS }, (_, k) => {
    const r = segmentRect(k);
    const g = new THREE.Group();
    const slab = new THREE.Mesh(segGeo, mats.deck);
    slab.position.y = -0.25;
    const strip = new THREE.Mesh(stripGeo, mats.glow(k % 2 ? 0xff4fd8 : 0x38e8ff));
    strip.position.y = 0.02;
    g.add(slab, strip);
    g.position.set(0, -6, (r.minZ + r.maxZ) / 2);
    g.visible = false;
    root.add(g);
    return g;
  });
  // Bridge rails stand from the start: they frame the gap the beats will fill.
  collision.add(box(BRIDGE.minX - 0.3, BRIDGE.minX, -1, 1.2, BRIDGE.minZ, BRIDGE.maxZ));
  collision.add(box(BRIDGE.maxX, BRIDGE.maxX + 0.3, -1, 1.2, BRIDGE.minZ, BRIDGE.maxZ));

  const apply = () => {
    for (let k = 0; k < BRIDGE_SEGMENTS; k++) {
      const r = segmentRect(k);
      const up = rise[k] >= 1;
      collision.setDynamicFloor(`w04-seg-${k}`, up ? { kind: 'floor', ...r, y: 0 } : null);
      collision.setDynamicWall(`w04-seg-${k}-near`, up ? null : box(r.minX, r.maxX, -1, 2.5, r.maxZ - 0.3, r.maxZ));
      collision.setDynamicWall(`w04-seg-${k}-far`, up ? null : box(r.minX, r.maxX, -1, 2.5, r.minZ, r.minZ + 0.3));
    }
  };
  apply();

  return {
    record(pad: number, reducedMotion: boolean): void {
      for (const k of [pad * 2, pad * 2 + 1]) {
        raising[k] = true;
        if (reducedMotion) rise[k] = 1;
      }
      apply();
    },
    get segmentsUp() { return rise.filter((r) => r >= 1).length; },
    get complete() { return rise.every((r) => r >= 1); },
    fixedUpdate(dt: number): void {
      let changed = false;
      for (let k = 0; k < BRIDGE_SEGMENTS; k++) {
        if (!raising[k] || rise[k] >= 1) continue;
        rise[k] = Math.min(1, rise[k] + dt / SEGMENT_RISE_SECONDS);
        if (rise[k] >= 1) changed = true;
      }
      if (changed) apply();
    },
    syncVisuals(pulse: number): void {
      segMeshes.forEach((g, k) => {
        g.visible = raising[k];
        g.position.y = -6 * (1 - easeInOut(rise[k]));
        const strip = g.children[1] as THREE.Mesh;
        (strip.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + pulse * 0.9;
      });
    },
    dispose(): void {
      for (let k = 0; k < BRIDGE_SEGMENTS; k++) {
        collision.setDynamicFloor(`w04-seg-${k}`, null);
        collision.setDynamicWall(`w04-seg-${k}-near`, null);
        collision.setDynamicWall(`w04-seg-${k}-far`, null);
      }
    },
  };
}

/**
 * Act II: the EQ Stair. Twelve equalizer bars between the Deck and the
 * Mezzanine take their heights from a preset. Each bar is a moving floor that
 * carries anyone standing on it, with a solid column below its top so a taller
 * bar is a wall, never a hole. Only the `rise` preset forms 0.5 m steps.
 */
export function buildEqStair(ctx: PocketWorldContext, mats: BeatMaterials) {
  const { scope, collision, root, player } = ctx;
  let preset: EqPreset = 'flat';
  const from = new Array<number>(EQ_BARS).fill(0);
  const height = new Array<number>(EQ_BARS).fill(0);
  let settle = 1;
  const barGeo = scope.track(new THREE.BoxGeometry(EQ_X_WIDTH, 1, 1.12));
  barGeo.translate(0, -0.5, 0);
  const capGeo = scope.track(new THREE.BoxGeometry(EQ_X_WIDTH - 0.2, 0.06, 1.0));
  const bars = Array.from({ length: EQ_BARS }, (_, i) => {
    const r = eqBarRect(i);
    const column = new THREE.Mesh(barGeo, mats.deck);
    const cap = new THREE.Mesh(capGeo, mats.glow(new THREE.Color().setHSL(0.52 + i * 0.03, 0.9, 0.55).getHex()));
    const g = new THREE.Group();
    g.position.set((r.minX + r.maxX) / 2, 0, (r.minZ + r.maxZ) / 2);
    g.add(column, cap);
    root.add(g);
    return { g, column, cap };
  });
  // Channel walls either side of the stair, full height (speaker-stack sides).
  const first = eqBarRect(0), last = eqBarRect(EQ_BARS - 1);
  collision.add(box(first.minX - 0.4, first.minX, -10, 8, last.minZ, first.maxZ));
  collision.add(box(first.maxX, first.maxX + 0.4, -10, 8, last.minZ, first.maxZ));

  const apply = () => {
    for (let i = 0; i < EQ_BARS; i++) {
      const r = eqBarRect(i);
      const h = height[i];
      collision.setDynamicFloor(`w04-eq-${i}`, { kind: 'floor', ...r, y: h });
      // The column top sits exactly one step-up (0.55 m) below the bar top: anyone
      // low enough not to step onto the bar is blocked by it; anyone high enough is supported.
      collision.setDynamicWall(`w04-eq-${i}-column`, h - 0.55 > -10 ? box(r.minX, r.maxX, -10, h - 0.55, r.minZ, r.maxZ) : null);
    }
  };
  apply();

  return {
    get preset() { return preset; },
    get settled() { return settle >= 1; },
    heights: () => [...height],
    setPreset(next: EqPreset, reducedMotion: boolean): void {
      preset = next;
      for (let i = 0; i < EQ_BARS; i++) from[i] = height[i];
      settle = reducedMotion ? 1 : 0;
      if (reducedMotion) {
        const p = player.position;
        for (let i = 0; i < EQ_BARS; i++) {
          const target = eqTarget(preset, i);
          if (player.grounded && inRect(eqBarRect(i), p.x, p.z) && Math.abs(p.y - height[i]) < 0.3) player.shift(0, target - height[i], 0);
          height[i] = target;
        }
        apply();
      }
    },
    fixedUpdate(dt: number): void {
      if (settle >= 1) return;
      const p = player.position;
      let rider = -1;
      if (player.grounded) {
        for (let i = 0; i < EQ_BARS; i++) if (inRect(eqBarRect(i), p.x, p.z) && Math.abs(p.y - height[i]) < 0.3) rider = i;
      }
      settle = Math.min(1, settle + dt / EQ_SETTLE_SECONDS);
      const e = easeInOut(settle);
      for (let i = 0; i < EQ_BARS; i++) {
        const next = from[i] + (eqTarget(preset, i) - from[i]) * e;
        if (i === rider) player.shift(0, next - height[i], 0);
        height[i] = next;
      }
      apply();
    },
    syncVisuals(pulse: number, drop: number): void {
      bars.forEach(({ g, column, cap }, i) => {
        const h = height[i];
        column.scale.y = h + 10;
        g.position.y = h;
        (cap.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + pulse * (0.5 + drop * 0.8) * (0.6 + 0.4 * Math.sin(i * 0.7));
      });
    },
    dispose(): void {
      for (let i = 0; i < EQ_BARS; i++) {
        collision.setDynamicFloor(`w04-eq-${i}`, null);
        collision.setDynamicWall(`w04-eq-${i}-column`, null);
      }
    },
  };
}

const EQ_X_WIDTH = 4;
