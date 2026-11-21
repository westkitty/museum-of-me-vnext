import type { Page } from '@playwright/test';
import type { Passage } from '../../../src/world/passages';

/**
 * Movement-based passage proof in the real application.
 *
 * Each lane is walked with the real keyboard forward key held, the real
 * PlayerController and the world's assembled CollisionWorld (architecture,
 * source installations, dressing and dynamic colliders), advanced through the
 * app's own fixedUpdate/variableUpdate. Only the facing is steered between
 * authored waypoints. A teleport places the visitor at a lane's start (a test
 * fixture), never across the passage being proved; the return walk starts
 * from wherever the outbound walk actually ended.
 */

export type LaneVerdict = 'PASS' | 'FAIL';

export interface LaneResult {
  readonly offset: number;
  readonly inbound: LaneVerdict;
  readonly outbound: LaneVerdict;
  readonly reason: string | null;
  /** Where the visitor stopped on failure (or arrived on success). */
  readonly end: readonly number[];
  readonly floorOk: boolean;
  readonly headroomOk: boolean;
  /** Smallest headroom sampled along the lane (m). */
  readonly minHeadroom: number;
  /** Visible, solid-looking meshes the capsule penetrated by at least 0.12 m. */
  readonly walkedThrough: readonly string[];
  /** Shallower contact (< 0.12 m): decor standing slightly proud of its collider. */
  readonly touched: readonly string[];
  /** Colliders touching the capsule where it was blocked. */
  readonly blockers: readonly string[];
  readonly ticks: number;
}

export interface PassageResult {
  readonly id: string;
  readonly status: 'PASS' | 'FAIL';
  readonly lanes: readonly LaneResult[];
  readonly interactionReached?: boolean;
}

export async function walkPassagesInPage(page: Page, passages: readonly Passage[]): Promise<PassageResult[]> {
  await page.keyboard.down('w');
  try {
    return await page.evaluate(async (passages) => {
      const app = window.__museum!;
      const RADIUS = 0.35;
      const HEIGHT = 1.78;
      const SPEED_BUDGET = 3.4;
      const Raycaster = (app.interaction as unknown as { raycaster: { constructor: new () => {
        set(o: unknown, d: unknown): void; far: number; near: number;
        intersectObject(o: unknown, r: boolean): Array<{ object: { name: string; visible: boolean; material: unknown; parent: unknown; type: string } ; distance: number; point: { y: number }; face?: { a: number; b: number; c: number } }>;
      } } }).raycaster.constructor;
      const V3 = app.player.position.constructor as new (x?: number, y?: number, z?: number) => { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };
      const caster = new Raycaster();
      const origin = new V3();
      const direction = new V3();
      const tick = async (i: number) => {
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
        if (i % 90 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      };
      const world = () => (app.activeWorld === 'interior' ? app.interiorWorld!.collision : app.exteriorWorld.collision);
      const root = () => (app.activeWorld === 'interior' ? app.interiorWorld!.root : app.exteriorWorld.root);

      // A mesh "looks solid" when it is visible, opaque, and not a points cloud,
      // line or interaction-only proxy.
      // People are not walls: the 17 authored source visitors and the ambient
      // visitors are deliberately non-solid figures at protected positions.
      const PEOPLE = /^(source-visitors|ambient-visitors)/;
      const looksSolid = (object: { visible: boolean; material: unknown; type: string; parent: unknown }): boolean => {
        let node: { visible: boolean; parent: unknown; name?: string } | null = object;
        while (node) {
          if (!node.visible) return false;
          if (node.name && PEOPLE.test(node.name)) return false;
          node = node.parent as typeof node;
        }
        if (object.type !== 'Mesh' && object.type !== 'InstancedMesh') return false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        return materials.some((m: { transparent?: boolean; opacity?: number; visible?: boolean; depthWrite?: boolean }) =>
          m && m.visible !== false && (!m.transparent || (m.opacity ?? 1) >= 0.6) && m.depthWrite !== false);
      };

      // Cast short horizontal rays out of the capsule at knee, chest and head
      // height in four directions: anything solid-looking within the capsule
      // radius is geometry the visitor's body is inside.
      const label = (object: { name: string; type: string; parent: unknown }): string => {
        const names: string[] = [];
        let node: { name: string; parent: unknown } | null = object;
        while (node && names.length < 4) { if (node.name) names.push(node.name); node = node.parent as typeof node; }
        return names.join(' < ') || `(unnamed ${object.type})`;
      };
      // Records the deepest penetration (m) of the capsule into each object.
      let stepGeometryAllowed = false;
      const insideVisible = (out: Map<string, { depth: number; at: number[] }>) => {
        const p = app.player.position;
        for (const h of [0.45, 1.0, 1.55]) {
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            origin.set(p.x, p.y + h, p.z);
            direction.set(dx, 0, dz);
            caster.set(origin, direction);
            caster.near = 0;
            caster.far = RADIUS;
            for (const hit of caster.intersectObject(root(), true)) {
              if (!looksSolid(hit.object)) continue;
              // On a grand stair the visible treads sit over a smooth collision
              // ramp. With a 0.417 m rise per ~0.35 m going, the capsule's front
              // edge passes nosings up to one step plus radius × slope (~0.84 m)
              // above the feet.
              if (stepGeometryAllowed && hit.point.y <= p.y + 0.9 && hit.face) {
                const pos = (hit.object as unknown as { geometry: { attributes: { position: { getY(i: number): number } } }; matrixWorld: { elements: number[] } });
                const e = pos.matrixWorld.elements;
                const top = Math.max(...[hit.face.a, hit.face.b, hit.face.c].map((i) => pos.geometry.attributes.position.getY(i) * e[5] + e[13]));
                if (top <= p.y + 0.9) continue;
              }
              const key = label(hit.object);
              const depth = Math.round((RADIUS - hit.distance) * 100) / 100;
              const prev = out.get(key);
              if (!prev || depth > prev.depth) out.set(key, { depth, at: [p.x, p.y + h, p.z].map((n) => Math.round(n * 100) / 100) });
            }
          }
        }
      };

      const blockersAt = (): string[] => {
        const p = app.player.position;
        const near: string[] = [];
        for (const c of world().snapshot()) {
          if (c.kind !== 'wall') continue;
          if (p.y + HEIGHT <= c.minY || p.y >= c.maxY) continue;
          const dx = Math.max(c.minX - p.x, 0, p.x - c.maxX);
          const dz = Math.max(c.minZ - p.z, 0, p.z - c.maxZ);
          if (Math.hypot(dx, dz) <= RADIUS + 0.2) {
            near.push(`${c.id} [${c.minX.toFixed(2)}..${c.maxX.toFixed(2)} × ${c.minZ.toFixed(2)}..${c.maxZ.toFixed(2)} y${c.minY.toFixed(1)}..${c.maxY.toFixed(1)}]${'oriented' in c && c.oriented ? ' oriented' : ''}`);
          }
        }
        return near.slice(0, 6);
      };

      type Probe = { ok: boolean; reason: string | null; floorOk: boolean; minHeadroom: number; ticks: number };
      const walkTo = async (target: number[], probe: Probe, through: Map<string, { depth: number; at: number[] }>, opts: { untilWorld?: string } = {}): Promise<boolean> => {
        const start = { x: app.player.position.x, z: app.player.position.z };
        const distance = Math.hypot(target[0] - start.x, target[2] - start.z);
        const budget = Math.ceil((distance / SPEED_BUDGET) * 60 * 1.8) + 240;
        let best = Infinity;
        let sinceProgress = 0;
        let airborne = 0;
        for (let i = 0; i < budget; i++, probe.ticks++) {
          if (opts.untilWorld && app.activeWorld === opts.untilWorld) return true;
          const p = app.player.position;
          const dx = target[0] - p.x;
          const dz = target[2] - p.z;
          const d = Math.hypot(dx, dz);
          if (!opts.untilWorld && d < 0.45) return true;
          app.player.yaw = opts.untilWorld ? (target[2] < p.z ? 0 : Math.PI) : Math.atan2(-dx, -dz);
          await tick(i);
          if (i % 6 === 0) insideVisible(through);
          const c = world();
          const ceiling = c.ceilingHeight(p.x, p.z, p.y);
          if (Number.isFinite(ceiling)) probe.minHeadroom = Math.min(probe.minHeadroom, ceiling - p.y);
          airborne = app.player.grounded ? 0 : airborne + 1;
          if (airborne > 45) { probe.floorOk = false; probe.reason = `no floor support at (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`; return false; }
          if (p.y < -12) { probe.floorOk = false; probe.reason = 'fell through the building'; return false; }
          if (d < best - 0.02) { best = d; sinceProgress = 0; } else if (++sinceProgress > 120) {
            probe.reason = `blocked ${d.toFixed(2)} m short of (${target.map((n) => n.toFixed(2)).join(', ')})`;
            return false;
          }
        }
        probe.reason = `ran out of time ${best.toFixed(2)} m short`;
        return false;
      };

      const results = [];
      for (const passage of passages) {
        // Each passage starts in its own world. A world seam crossing is
        // carried by the real WorldDirector; every other passage stays put.
        const wantWorld = passage.world;
        if (app.activeWorld !== wantWorld) {
          if (wantWorld === 'interior') await app.switchToInterior(); else app.worldDirector.switchToExterior();
        }
        const laneResults = [];
        stepGeometryAllowed = passage.kind === 'stair';
        for (const lane of passage.lanes) {
          if (app.activeWorld !== wantWorld) {
            if (wantWorld === 'interior') await app.switchToInterior(); else app.worldDirector.switchToExterior();
          }
          const path = lane.path as unknown as number[][];
          const seam = passage.kind === 'world-seam';
          app.player.teleport(path[0] as [number, number, number],
            Math.atan2(-(path[1][0] - path[0][0]), -(path[1][2] - path[0][2])));
          for (let i = 0; i < 20; i++) await tick(i); // settle onto the floor
          const probe: Probe = { ok: true, reason: null, floorOk: true, minHeadroom: Infinity, ticks: 0 };
          const through = new Map<string, { depth: number; at: number[] }>();
          let inbound = true;
          if (seam) {
            inbound = await walkTo([path[0][0], 0, path[0][2] - 10], probe, through, { untilWorld: 'interior' })
              && await walkTo(path[1], probe, through);
          } else {
            for (let k = 1; k < path.length && inbound; k++) inbound = await walkTo(path[k], probe, through);
          }
          const inboundReason = probe.reason;
          const inboundEnd = app.player.position.toArray();
          const inboundBlockers = inbound ? [] : blockersAt();
          let outbound = false;
          let outboundBlockers: string[] = [];
          if (inbound) {
            // Turn around and walk back from where the visitor actually is.
            if (seam) {
              outbound = await walkTo([path[1][0], 0, path[1][2] + 10], probe, through, { untilWorld: 'exterior' })
                && await walkTo(path[0], probe, through);
            } else {
              outbound = true;
              for (let k = path.length - 2; k >= 0 && outbound; k--) outbound = await walkTo(path[k], probe, through);
            }
            if (!outbound) outboundBlockers = blockersAt();
          }
          laneResults.push({
            offset: lane.offset,
            inbound: (inbound ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
            outbound: (outbound ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
            reason: inbound ? (outbound ? null : `return: ${probe.reason}`) : inboundReason,
            end: (inbound ? app.player.position.toArray() : inboundEnd).map((n: number) => Math.round(n * 100) / 100),
            floorOk: probe.floorOk,
            headroomOk: probe.minHeadroom >= HEIGHT,
            minHeadroom: Number.isFinite(probe.minHeadroom) ? Math.round(probe.minHeadroom * 100) / 100 : 99,
            walkedThrough: [...through].filter(([, v]) => v.depth >= 0.12).map(([name, v]) => `${name} (${v.depth} m at ${v.at.join(',')})`),
            touched: [...through].filter(([, v]) => v.depth < 0.12).map(([name, v]) => `${name} (${v.depth} m at ${v.at.join(',')})`),
            blockers: [...inboundBlockers, ...outboundBlockers],
            ticks: probe.ticks,
          });
        }
        let interactionReached: boolean | undefined;
        if (passage.interaction) {
          // From the passage's far side, walk the centre lane on to the
          // standing position used to engage the exhibit or kiosk, and back.
          const centre = passage.lanes[0].path as unknown as number[][];
          if (app.activeWorld !== wantWorld) {
            if (wantWorld === 'interior') await app.switchToInterior(); else app.worldDirector.switchToExterior();
          }
          app.player.teleport(centre[0] as [number, number, number], 0);
          for (let i = 0; i < 20; i++) await tick(i);
          const probe: Probe = { ok: true, reason: null, floorOk: true, minHeadroom: Infinity, ticks: 0 };
          const through = new Map<string, { depth: number; at: number[] }>();
          let ok = true;
          for (let k = 1; k < centre.length && ok; k++) ok = await walkTo(centre[k], probe, through);
          if (ok) ok = await walkTo(passage.interaction as unknown as number[], probe, through);
          if (ok) ok = await walkTo(centre[0], probe, through);
          interactionReached = ok;
        }
        const pass = laneResults.every((lane) => lane.inbound === 'PASS' && lane.outbound === 'PASS'
          && lane.floorOk && lane.headroomOk) && interactionReached !== false;
        results.push({ id: passage.id, status: (pass ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL', lanes: laneResults, interactionReached });
      }
      return results;
    }, passages as unknown as Passage[]);
  } finally {
    await page.keyboard.up('w');
  }
}
