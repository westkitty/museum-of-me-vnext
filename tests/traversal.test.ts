import { describe, it, expect } from 'vitest';
import { buildMuseum, walkRoute, walkSegment } from './helpers/walk';
import { canonicalRoute } from '../src/world/route';
import {
  PLACEMENTS, WINGS, zoneAt, ZONES,
  SANCTUARY_DIR, SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_FLOOR_Y,
  SANCTUARY_CENTER, GROUND_Y, place,
} from '../src/world/layout';
import { START_POSITION } from '../src/world/start';
import { COLLECTION } from '../src/content/collection.generated';

const built = buildMuseum();

describe('museum architecture', () => {
  it('builds a mount point for all 35 exhibits', () => {
    expect(built.mounts.size).toBe(35);
    for (const e of COLLECTION.exhibits) {
      expect(built.mounts.has(e.id), `${e.id} has no mount`).toBe(true);
    }
  });

  it('places every exhibit inside its own wing', () => {
    expect(PLACEMENTS).toHaveLength(35);
    for (const p of PLACEMENTS) {
      const exhibit = COLLECTION.exhibits.find((e) => e.id === p.exhibitId)!;
      expect(exhibit.wing, `${p.exhibitId}`).toBe(p.wing);
    }
  });

  it('gives every exhibit bay a distinct anchor', () => {
    const seen = new Set<string>();
    for (const p of PLACEMENTS) {
      const key = `${p.anchor[0].toFixed(2)},${p.anchor[2].toFixed(2)}`;
      expect(seen.has(key), `${p.exhibitId} overlaps another bay`).toBe(false);
      seen.add(key);
    }
  });

  it('has substantial collision geometry', () => {
    expect(built.collision.size).toBeGreaterThan(500);
  });

  it('supports the visitor at the exterior start point', () => {
    const support = built.collision.supportHeight(START_POSITION[0], START_POSITION[2], 2, 3);
    expect(support).not.toBeNull();
    expect(Math.abs(support! - START_POSITION[1])).toBeLessThan(0.6);
  });
});

describe('mandatory traversal', () => {
  const route = canonicalRoute();

  it('starts outside before the visitor chooses to enter', () => {
    expect(route[0].label).toBe('arrival plaza');
    expect(route[0].at).toEqual(START_POSITION);
    expect(zoneAt([START_POSITION[0], START_POSITION[1] + 1, START_POSITION[2]])).toBe('plaza');
  });

  it('has a route that visits every wing, the upper level and the Sanctuary', () => {
    const labels = route.map((w) => w.label).join(' | ');
    for (const w of WINGS) expect(labels).toContain(`${w.id}: hall entry`);
    expect(labels).toContain('dexter sanctuary');
    expect(labels).toContain('stair head');
    expect(labels).toContain('main entrance');
  });

  it('reaches every one of the 35 exhibits on the route', () => {
    const reached = new Set(route.filter((w) => w.exhibitId).map((w) => w.exhibitId!));
    expect(reached.size).toBe(35);
  });

  it('walks exterior → entrance → every wing → upper floor → Sanctuary → entrance without a break', () => {
    const failures = walkRoute(built.collision, route);
    const message = failures.map((f) => `${f.label}: ${f.reason} at ${f.at.map((n) => n.toFixed(1))}`).join('\n');
    expect(failures, `\n${message}`).toHaveLength(0);
  });

  it('lets the visitor step into and back out of every exhibit bay', () => {
    const failures: string[] = [];
    for (const p of PLACEMENTS) {
      const inbound = walkSegment(built.collision, { from: p.doorway, to: p.visitorSpot, label: `into ${p.exhibitId}` });
      if (inbound) failures.push(`${inbound.label}: ${inbound.reason}`);
      const outbound = walkSegment(built.collision, { from: p.visitorSpot, to: p.doorway, label: `out of ${p.exhibitId}` });
      if (outbound) failures.push(`${outbound.label}: ${outbound.reason}`);
    }
    expect(failures, `\n${failures.join('\n')}`).toHaveLength(0);
  });
});

describe('zones', () => {
  it('resolves every zone centre to itself', () => {
    for (const z of ZONES) {
      expect(zoneAt(z.center), `${z.id}`).toBe(z.id);
    }
  });

  it('puts the start point on the arrival plaza', () => {
    expect(zoneAt([START_POSITION[0], START_POSITION[1] + 1, START_POSITION[2]])).toBe('plaza');
  });

  it('puts the rotunda centre in the rotunda', () => {
    expect(zoneAt([0, 1, 0])).toBe('rotunda');
  });
});


describe('the Dexter Sanctuary is reachable on foot (regression)', () => {
  // Runtime QA found the Sanctuary physically unreachable: the exterior ground
  // collider ran across the whole site at GROUND_Y - 0.5, and `supportHeight`
  // stands the visitor on the HIGHEST surface at or below their step-up, so the
  // visitor walked over the descending ramp instead of down it. Nothing caught
  // it because the automated routes never walked the ramp against collision.
  it('has no flat surface roofing the ramp', () => {
    // The defect: the exterior ground ran across the whole site at
    // GROUND_Y - 0.5, above the descending ramp, so `supportHeight` always
    // chose the ground and the visitor never went down. The ramp collider is
    // a padded, segmented approximation, so the assertion is not that support
    // matches the ideal slope — it is that nothing flat sits on top of it.
    const world = built.collision;
    const ground = GROUND_Y - 0.5;
    for (let a = SANCTUARY_RAMP_FROM + 8; a <= SANCTUARY_RAMP_TO; a += 1) {
      const p = place(SANCTUARY_DIR, a);
      const support = world.supportHeight(p[0], p[2], GROUND_Y + 0.55);
      expect(support, `no support on the ramp at along ${a}`).not.toBeNull();
      expect(support!, `along ${a} is roofed by a flat surface at ${support}`)
        .toBeLessThan(ground);
    }
  });

  it('descends continuously from the rotunda to the sanctuary floor', () => {
    const world = built.collision;
    // Follow the ramp axis and require the support height to fall to the floor.
    let previous = GROUND_Y;
    let lowest = GROUND_Y;
    for (let a = SANCTUARY_RAMP_FROM; a <= SANCTUARY_RAMP_TO + 8; a += 0.5) {
      const p = place(SANCTUARY_DIR, a);
      const support = world.supportHeight(p[0], p[2], previous + 0.55);
      expect(support, `no support at along ${a}`).not.toBeNull();
      // Never a step down bigger than a person can take without falling far.
      expect(previous - support!, `drop at along ${a}`).toBeLessThan(1.2);
      previous = support!;
      lowest = Math.min(lowest, support!);
    }
    expect(lowest).toBeLessThanOrEqual(SANCTUARY_FLOOR_Y + 0.01);
  });

  it('walks the real route from the rotunda into the sanctuary', () => {
    const failures = walkRoute(built.collision, [
      { label: 'rotunda centre', at: [0, GROUND_Y, 0] as const },
      { label: 'ramp mouth', at: place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM - 1, 0, GROUND_Y) },
      { label: 'foot of the ramp', at: place(SANCTUARY_DIR, SANCTUARY_RAMP_TO, 0, SANCTUARY_FLOOR_Y) },
      { label: 'sanctuary centre', at: [SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y, SANCTUARY_CENTER[2]] as const },
    ]);
    expect(failures.map((f) => `${f.label}: ${f.reason}`)).toEqual([]);
  });

  it('keeps solid ground everywhere outside the ramp trench', () => {
    const world = built.collision;
    for (const [x, z] of [[0, 60], [60, 0], [-60, 0], [0, -60], [80, 80], [-80, 80], [80, -80], [-120, -120], [-25, 25]]) {
      expect(world.supportHeight(x, z, GROUND_Y + 0.55), `hole in the ground at ${x},${z}`).not.toBeNull();
    }
  });
});
