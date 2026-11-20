import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { guideTargetLevel, mapLevelForY, routeForLevel } from '../src/ui/MapPanel';
import {
  BAY_BLADE_HEIGHT, Detailing, bladeAtlasUv, bayWayBackLine, rotundaHandFromBay, wingExhibitRange, wingThresholdSubtitle,
} from '../src/world/Detailing';
import { EnvironmentDressing } from '../src/world/EnvironmentDressing';
import {
  GROUND_Y, LEVEL_1_Y, PLACEMENTS, PLACEMENT_BY_EXHIBIT, STAIRS, WINGS, WING_BY_ID, faceDirection, isOverStairOpening,
  stairArcPoint, stairLanding,
} from '../src/world/layout';
import { PaletteSet } from '../src/world/palette';
import { RotundaWayfinding, balconyPromenadePath } from '../src/world/RotundaWayfinding';
import { BALCONY_WALK_FACES } from '../src/world/route';
import { MUSEUM_ENTRANCE_TARGET, planVisitorRoute } from '../src/world/visitorRoute';
import { Wayfinding, stairTreadTopY } from '../src/world/Wayfinding';
import { WingFurnishings } from '../src/world/WingFurnishings';
import { WingIdentity } from '../src/world/WingIdentity';
import { buildMuseum } from './helpers/walk';

/** Uplift 2, sub-agent C: interior wayfinding, map and architectural readability. */

const built = buildMuseum();

function detailingParents(): Map<string, THREE.Group> {
  const scope = new ResourceScope('uplift2-c');
  const parents = new Map<string, THREE.Group>();
  for (const id of ['rotunda', 'balcony', 'sanctuary', 'entrance-detail', ...WINGS.map((wing) => wing.id)]) parents.set(id, new THREE.Group());
  new Detailing(scope, new PaletteSet(scope)).applyAll(parents);
  for (const parent of parents.values()) parent.updateMatrixWorld(true);
  return parents;
}

function named(parents: Map<string, THREE.Group>, prefix: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  for (const parent of parents.values()) parent.traverse((node) => { if (node.name.startsWith(prefix)) found.push(node); });
  return found;
}

describe('C-D1 the floor line stays visible on the grand stairs', () => {
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  built.root.updateMatrixWorld(true);
  const stairMeshes: THREE.Object3D[] = [];
  built.museum.zoneGroups.get('rotunda')!.traverse((node) => { if ((node as THREE.Mesh).isMesh) stairMeshes.push(node); });

  it('puts every marker that lands on a flight on top of the visible tread, not inside it', () => {
    const scope = new ResourceScope('uplift2-c-wayfinding');
    const wayfinding = new Wayfinding(scope);
    wayfinding.setTarget('E35');
    let onStairs = 0;
    const foot = stairArcPoint(STAIRS[1], 0);
    // Walk up the real route from the foot of the SE stair, sampling markers.
    for (let step = 0; step <= 16; step++) {
      const at = stairArcPoint(STAIRS[1], step / 16);
      wayfinding.updateXYZ(0.2, step === 0 ? foot[0] : at[0], at[1], step === 0 ? foot[2] : at[2], true, 'interior', built.collision);
      for (const marker of wayfinding.group.children) {
        if (!marker.visible) continue;
        const { x, y, z } = marker.position;
        const tread = stairTreadTopY(x, z, y - 0.06);
        if (tread === null) continue;
        onStairs++;
        ray.set(new THREE.Vector3(x, y + 0.6, z), down);
        const hit = ray.intersectObjects(stairMeshes, false)[0];
        expect(hit, `marker over stair at ${x.toFixed(2)},${z.toFixed(2)}`).toBeDefined();
        // At or just above the surface the visitor sees, never buried in it.
        expect(y).toBeGreaterThanOrEqual(hit!.point.y - 0.01);
        expect(y - hit!.point.y).toBeLessThan(0.5);
      }
    }
    expect(onStairs).toBeGreaterThan(20);
    scope.dispose();
  });

  it('knows nothing about tread height away from the stairs', () => {
    expect(stairTreadTopY(0, 0, GROUND_Y)).toBeNull();
    const landing = stairLanding(STAIRS[0], 3);
    expect(stairTreadTopY(landing[0], landing[2] - 6, LEVEL_1_Y)).toBeNull();
    // A ground-floor point under the upper flight is not on that tread.
    const high = stairArcPoint(STAIRS[0], 0.9);
    expect(stairTreadTopY(high[0], high[2], GROUND_Y)).toBeNull();
  });
});

describe('C1/C2 the map draws the real planned route on each floor', () => {
  const from: [number, number, number] = [0, GROUND_Y, 8];
  const route = planVisitorRoute('interior', from, 'E35', built.collision);

  it('splits a two-floor route at one floor change, continuous across both plans', () => {
    const ground = routeForLevel(route, 0);
    const upper = routeForLevel(route, 1);
    expect(ground.lines.length).toBeGreaterThan(0);
    expect(upper.lines.length).toBeGreaterThan(0);
    expect(ground.changes).toHaveLength(1);
    expect(ground.changes[0]).toMatchObject({ from: 0, to: 1 });
    const change = ground.changes[0].at;
    const lastGround = ground.lines[ground.lines.length - 1];
    expect(lastGround[lastGround.length - 1]).toEqual(change);
    expect(upper.lines[0][0]).toEqual(change);
    for (const line of ground.lines) for (const p of line) if (p !== change) expect(mapLevelForY(p[1])).toBe(0);
    for (const line of upper.lines) for (const p of line) expect(mapLevelForY(p[1])).toBe(1);
    // The plan ends where the floor line ends: at the target's doorway.
    expect(upper.lines[upper.lines.length - 1].at(-1)).toEqual(PLACEMENT_BY_EXHIBIT.get('E35')!.doorway);
    // The change happens on a grand stair.
    expect(STAIRS.some((stair) => Math.abs(Math.hypot(change[0], change[2]) - stair.radius) < stair.halfWidth)).toBe(true);
  });

  it('keeps a same-floor route on its own plan with no floor change', () => {
    const sameFloor = planVisitorRoute('interior', from, 'E20', built.collision);
    expect(routeForLevel(sameFloor, 0).changes).toHaveLength(0);
    expect(routeForLevel(sameFloor, 1).lines).toHaveLength(0);
  });

  it('names the floor of every guide destination from the layout', () => {
    for (const placement of PLACEMENTS) expect(guideTargetLevel(placement.exhibitId)).toBe(WING_BY_ID.get(placement.wing)!.level);
    expect(guideTargetLevel(MUSEUM_ENTRANCE_TARGET)).toBe(0);
    expect(guideTargetLevel('E99')).toBeNull();
  });
});

describe('C5 wing threshold signs say which exhibits a wing holds', () => {
  it('derives each range from the layout order', () => {
    expect(wingExhibitRange(WING_BY_ID.get('east')!)).toBe('E17–E23');
    expect(wingExhibitRange(WING_BY_ID.get('infra')!)).toBe('E34–E35');
    expect(wingThresholdSubtitle(WING_BY_ID.get('north')!)).toMatch(/E01–E08 · 8 exhibits$/);
    const total = WINGS.reduce((sum, wing) => sum + Number(wingThresholdSubtitle(wing).match(/(\d+) exhibits?$/)![1]), 0);
    expect(total).toBe(35);
  });

  it('mounts one threshold sign per wing, on its own floor', () => {
    const signs = named(detailingParents(), 'wing-threshold-sign:');
    expect(signs.map((sign) => sign.name).sort()).toEqual(WINGS.map((wing) => `wing-threshold-sign:${wing.id}`).sort());
    for (const sign of signs) {
      const wing = WING_BY_ID.get(sign.name.split(':')[1] as never)!;
      expect(sign.position.y).toBeGreaterThan(wing.floorY + wing.archHeight);
    }
  });
});

describe('C6/C7 bay numbering along the hall and the way back from each bay', () => {
  const parents = detailingParents();
  const blades = named(parents, 'bay-number-blade:');
  const cues = named(parents, 'bay-way-back:');

  it('hangs a two-faced number blade for every exhibit, above head height and off the walking line', () => {
    expect(blades).toHaveLength(PLACEMENTS.length * 2);
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      const dir = faceDirection(wing.face);
      const pair = blades.filter((blade) => blade.name === `bay-number-blade:${placement.exhibitId}`);
      expect(pair).toHaveLength(2);
      const normals = pair.map((blade) => new THREE.Vector3(0, 0, 1).applyEuler(blade.rotation));
      // One face looks back toward the Rotunda, the other outward along the hall.
      expect(normals.map((n) => Math.sign(n.x * dir[0] + n.z * dir[2])).sort()).toEqual([-1, 1]);
      for (const blade of pair) {
        expect(blade.position.y - wing.floorY).toBeCloseTo(BAY_BLADE_HEIGHT, 6);
        const lateral = Math.abs(blade.position.x * -dir[2] + blade.position.z * dir[0]);
        expect(lateral).toBeGreaterThan(wing.hallHalfWidth - 1.05);
        expect(lateral).toBeLessThan(wing.hallHalfWidth);
        // Before the opening (Rotunda side), on solid wall, not over the gap.
        const along = blade.position.x * dir[0] + blade.position.z * dir[2];
        const centre = wing.hallFrom + wing.bayLead + placement.slot * wing.bayPitch;
        expect(along).toBeLessThan(centre - wing.bayOpening / 2 - 0.5);
        expect(along).toBeGreaterThan(wing.hallFrom);
      }
    }
  });

  it('shares one material across all blades, each face showing its own atlas cell', () => {
    expect(new Set(blades.map((blade) => (blade as THREE.Mesh).material)).size).toBe(1);
    const cells = new Set<string>();
    for (const placement of PLACEMENTS) {
      const geometry = new THREE.PlaneGeometry(1, 0.5);
      bladeAtlasUv(geometry, placement.exhibitId);
      const uv = geometry.getAttribute('uv');
      const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
      const vs = Array.from({ length: uv.count }, (_, i) => uv.getY(i));
      for (const v of [...us, ...vs]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      cells.add(`${Math.min(...us).toFixed(3)},${Math.min(...vs).toFixed(3)}`);
      geometry.dispose();
    }
    expect(cells.size).toBe(PLACEMENTS.length);
  });

  it('keeps blades clear of hall dressing, furnishings and pilasters', () => {
    const scope = new ResourceScope('uplift2-c-dressing');
    const dressing = new EnvironmentDressing(scope).build();
    const furnishings = new WingFurnishings(scope).build();
    const identity = new WingIdentity(scope).build();
    const boxes: THREE.Box3[] = [];
    for (const root of [dressing, furnishings, identity, ...parents.values()]) {
      root.updateMatrixWorld(true);
      root.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh || node.name.startsWith('bay-number-blade:') || node.name.startsWith('wing-')) return;
        boxes.push(new THREE.Box3().setFromObject(node));
      });
    }
    for (const blade of blades) {
      const box = new THREE.Box3().setFromObject(blade).expandByScalar(0.02);
      const hits = boxes.filter((other) => other.intersectsBox(box) && other.getSize(new THREE.Vector3()).length() < 6);
      expect(hits.map((hit) => hit.getCenter(new THREE.Vector3()).toArray().map((v) => v.toFixed(1))), blade.name).toEqual([]);
    }
    scope.dispose();
  });

  it('points every way-back cue at the Rotunda (and the exit in the entrance hall)', () => {
    expect(cues).toHaveLength(PLACEMENTS.length);
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      const dir = faceDirection(wing.face);
      const sign = placement.side === 'right' ? 1 : -1;
      // Independent check: stand in the bay facing the hall, step to the
      // named hand; the step must reduce distance to the Rotunda.
      const facing = new THREE.Vector3(-sign * -dir[2], 0, -sign * dir[0]);
      const hand = rotundaHandFromBay(wing, placement.side);
      const step = new THREE.Vector3().crossVectors(facing, new THREE.Vector3(0, 1, 0)).multiplyScalar(hand === 'right' ? 1 : -1);
      const doorway = new THREE.Vector3(...placement.doorway);
      expect(doorway.clone().add(step).setY(0).length()).toBeLessThan(doorway.clone().setY(0).length());
      const line = bayWayBackLine(wing, placement.side);
      expect(line).toContain(wing.level === 1 ? 'Balcony & stairs down' : 'Rotunda');
      expect(line).toContain(hand === 'left' ? '← ' : ' →');
      if (wing.id === 'south') expect(line).toContain('Exit');
      const cue = cues.find((node) => node.name === `bay-way-back:${placement.exhibitId}`)!;
      // Faces into the bay, so a visitor leaving the room reads it.
      const normal = new THREE.Vector3(0, 0, 1).applyEuler(cue.rotation);
      const intoBay = new THREE.Vector3(...placement.visitorSpot).sub(doorway).setY(0).normalize();
      expect(normal.dot(intoBay)).toBeGreaterThan(0.9);
      expect(cue.position.y).toBeGreaterThan(wing.floorY + wing.bayHeight * 0.72);
      expect(cue.position.y).toBeLessThan(wing.floorY + wing.bayHeight);
    }
  });
});

describe('C8 the walkable balcony arc is marked on the floor', () => {
  it('runs from landing to landing along the north arc, on balcony floor, never over a well', () => {
    const path = balconyPromenadePath();
    expect(path).toHaveLength(BALCONY_WALK_FACES.length + 2);
    const landings = STAIRS.map((stair) => stairLanding(stair));
    for (const landing of landings) expect(path.some((p) => p === landing || p.every((v, i) => Math.abs(v - landing[i]) < 1e-9))).toBe(true);
    for (let i = 1; i < path.length; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t;
        const z = path[i - 1][2] + (path[i][2] - path[i - 1][2]) * t;
        expect(isOverStairOpening(x, z)).toBe(false);
        expect(built.collision.supportHeight(x, z, LEVEL_1_Y)).toBe(LEVEL_1_Y);
      }
    }
    // North arc: nothing south of the stair landings.
    const southmost = Math.max(...landings.map((landing) => landing[2]));
    for (const p of path) expect(p[2]).toBeLessThanOrEqual(southmost + 1e-9);
  });

  it('builds the inlay and a medallion at each stair head', () => {
    const scope = new ResourceScope('uplift2-c-rotunda');
    const group = new RotundaWayfinding(scope).build();
    const strips = group.children.filter((node) => node.name === 'balcony-promenade-inlay');
    const medallions = group.children.filter((node) => node.name === 'balcony-promenade-stair-medallion');
    expect(strips).toHaveLength(BALCONY_WALK_FACES.length + 1);
    expect(medallions).toHaveLength(2);
    for (const node of [...strips, ...medallions]) expect(node.position.y).toBeLessThan(LEVEL_1_Y + 0.1);
    expect(scope.size).toBeGreaterThan(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
