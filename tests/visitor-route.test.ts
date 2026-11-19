import { afterAll, describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { AUTHORED_TOURS } from '../src/content/authoredTours';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player/PlayerController';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { ENTRANCE_DOOR, INTERIOR_ENTRY_POSITION, LEVEL_1_Y, PLACEMENT_BY_EXHIBIT, PLACEMENTS, WING_BY_ID, faceDirection, place, type Vec3 } from '../src/world/layout';
import { START_POSITION } from '../src/world/start';
import { MUSEUM_ENTRANCE_TARGET, Wayfinding } from '../src/world/Wayfinding';
import { ISLAND_LANDMARKS, planVisitorRoute } from '../src/world/visitorRoute';
import { buildMuseum, walkRoute, walkSegment } from './helpers/walk';

const museum = buildMuseum();
const exterior = new ExteriorWorld('low');
afterAll(() => {
  museum.scope.dispose();
  exterior.dispose();
});

const steps = (route: readonly Vec3[]) => route.map((at) => ({ label: at.map((n) => n.toFixed(2)).join(', '), at }));

describe('visitor guide routes', () => {
  it('follows the pier and terrace through the actual entrance', () => {
    const route = planVisitorRoute('exterior', START_POSITION, 'E34');
    expect(route.at(-1)).toEqual(ENTRANCE_DOOR);
    expect(walkRoute(exterior.collision, steps(route))).toEqual([]);
  });

  it('takes the east path around the lagoon and back to the door', () => {
    const route = planVisitorRoute('exterior', [46, -0.5, -40], MUSEUM_ENTRANCE_TARGET);
    expect(route.at(-1)).toEqual(ENTRANCE_DOOR);
    expect(route.length).toBeGreaterThan(5);
    expect(walkRoute(exterior.collision, steps(route))).toEqual([]);
    expect(ISLAND_LANDMARKS.map(({ name }) => name)).toEqual(['Museum entrance', 'Arrival pier', 'East lagoon']);
  });

  it('leads from the entry to all bays on their proper levels', () => {
    for (const exhibit of PLACEMENTS) {
      const route = planVisitorRoute('interior', INTERIOR_ENTRY_POSITION, exhibit.exhibitId);
      expect(route.at(-1), exhibit.exhibitId).toEqual(exhibit.doorway);
      expect(walkRoute(museum.collision, steps(route)), exhibit.exhibitId).toEqual([]);
      if (exhibit.doorway[1] === LEVEL_1_Y) expect(route.some((point) => point[1] > 0 && point[1] < LEVEL_1_Y)).toBe(true);
    }
  });

  it('takes the balcony ring between upper bays and descends to lower bays', () => {
    const infrared = PLACEMENT_BY_EXHIBIT.get('E34')!;
    for (const destination of ['E14', 'E20']) {
      const route = planVisitorRoute('interior', infrared.visitorSpot, destination);
      expect(route.at(-1)).toEqual(PLACEMENT_BY_EXHIBIT.get(destination)?.doorway);
      expect(walkRoute(museum.collision, steps(route))).toEqual([]);
    }
  });

  it.each([
    ['E01', [-20.8, 0, -25.7]],
    ['E10', [-25.7, 0, -19.799999999999997]],
    ['E14', [-7.77817459305203, 10, -32.8097546470558]],
    ['E34', [15.839191898578658, 10, -45.396255352176354]],
    ['E35', [45.39625535217635, 10, -15.839191898578667]],
  ] as const)('exits reachable %s corner through its own doorway and floor', (id, from) => {
    const room = PLACEMENT_BY_EXHIBIT.get(id)!;
    const route = planVisitorRoute('interior', from, 'E08', museum.collision);
    const exit = route.findIndex((point) => point.every((value, axis) => Math.abs(value - room.visitorSpot[axis]) < 0.015));
    expect(exit).toBeGreaterThan(0);
    expect(route.slice(exit, exit + 2)).toEqual([room.visitorSpot, room.doorway]);
    expect(route.slice(0, exit + 2).every((point) => point[1] === from[1])).toBe(true);
    expect(route.at(-1)).toEqual(PLACEMENT_BY_EXHIBIT.get('E08')?.doorway);
    expect(walkRoute(museum.collision, steps(route))).toEqual([]);
  });

  it('rejoins the island path around scenery from the northwest coast', () => {
    const from: Vec3 = [-144, -0.5, -112];
    const route = planVisitorRoute('exterior', from, MUSEUM_ENTRANCE_TARGET, exterior.collision);
    expect(route.at(-1)).toEqual(ENTRANCE_DOOR);
    expect(walkRoute(exterior.collision, steps(route))).toEqual([]);
  });

  it('leaves reachable near and far corners through each bay’s own opening', () => {
    let checked = 0;
    for (const room of PLACEMENTS) {
      const wing = WING_BY_ID.get(room.wing)!;
      const dir = faceDirection(wing.face);
      const sign = room.side === 'right' ? 1 : -1;
      const centre = wing.hallFrom + wing.bayLead + room.slot * wing.bayPitch;
      const destination = room.exhibitId === 'E08' ? 'E34' : 'E08';
      for (const side of [-1, 1]) {
        for (const depth of [1.1, wing.bayDepth - 1.75]) {
          const from = place(dir, centre + side * (wing.bayHalfAlong - 1.75), sign * (wing.hallHalfWidth + depth), wing.floorY);
          const probe = { x: from[0], y: from[1], z: from[2] };
          if (museum.collision.resolveHorizontal(probe, PLAYER_RADIUS, PLAYER_HEIGHT)
            || museum.collision.supportHeight(probe.x, probe.z, probe.y) !== probe.y) continue;
          const approach = planVisitorRoute('interior', from, room.exhibitId);
          const entry = approach.findIndex((point) => point === room.visitorSpot);
          const direct = walkSegment(museum.collision, { label: room.exhibitId, from: room.visitorSpot, to: from });
          const aroundPlinth = entry < 0 || walkRoute(museum.collision, steps(approach.slice(0, entry + 1).reverse())).length > 0;
          // The real collision walker must be able to reach this pose from
          // inside its own bay. Rectangles alone include inaccessible pockets.
          if (direct && aroundPlinth) continue;
          const route = planVisitorRoute('interior', from, destination, museum.collision);
          checked++;
          const exit = route.findIndex((point) => point.every((value, axis) => Math.abs(value - room.visitorSpot[axis]) < 0.015));
          expect(exit, room.exhibitId).toBeGreaterThan(0);
          expect(route.slice(exit, exit + 2), room.exhibitId).toEqual([room.visitorSpot, room.doorway]);
          expect(walkRoute(museum.collision, steps(route)), `${room.exhibitId} to ${destination} from ${from}`).toEqual([]);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(125);
  });

  it('provides walkable legs to every authored tour stop in order', () => {
    for (const tour of AUTHORED_TOURS) {
      let from = INTERIOR_ENTRY_POSITION;
      for (const { exhibitId } of tour.stops) {
        const route = planVisitorRoute('interior', from, exhibitId);
        const placement = PLACEMENT_BY_EXHIBIT.get(exhibitId)!;
        expect(route.at(-1)).toEqual(placement.doorway);
        expect(walkRoute(museum.collision, steps([...route, placement.visitorSpot])), `${tour.title} · ${exhibitId}`).toEqual([]);
        from = placement.visitorSpot;
      }
    }
  });

  it('holds an exhibit target at the exterior door and clears only on the correct floor', () => {
    const scope = new ResourceScope('visitor-guide-test');
    const wayfinding = new Wayfinding(scope);
    const upper = PLACEMENT_BY_EXHIBIT.get('E34')!.doorway;
    wayfinding.setTarget('E34');
    wayfinding.update(1 / 60, ENTRANCE_DOOR, true, 'exterior');
    expect(wayfinding.currentTarget).toBe('E34');
    wayfinding.update(1 / 60, INTERIOR_ENTRY_POSITION, true, 'interior');
    expect(wayfinding.group.visible).toBe(true);
    expect(wayfinding.currentTarget).toBe('E34');
    wayfinding.update(1 / 60, [upper[0], 0, upper[2]], true, 'interior');
    expect(wayfinding.currentTarget).toBe('E34');
    wayfinding.update(1 / 60, upper, true, 'interior');
    expect(wayfinding.currentTarget).toBeNull();
    expect(wayfinding.group.visible).toBe(false);
    scope.dispose();
  });
});
