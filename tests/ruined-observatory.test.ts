import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import {
  LAND_SUPPORT_Y,
  OBSERVATORY_APPROACH_PATH,
  OBSERVATORY_CENTER,
  isSiteLand,
} from '../src/world/exterior/IslandSiteLayout';
import { OBSERVATORY_FLOOR_Y } from '../src/world/exterior/ExteriorObservatory';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player/PlayerController';
import type { Vec3 } from '../src/world/layout';
import { walkRoute } from './helpers/walk';

const [OX, , OZ] = OBSERVATORY_CENTER;

describe('ISLAND-02B southern wooded ruined observatory', () => {
  it('stands on valid southern woodland ground well separated from the southwest sundial', () => {
    expect(isSiteLand(OX, OZ)).toBe(true);
    for (const [x, z] of OBSERVATORY_APPROACH_PATH) {
      expect(isSiteLand(x, z), `observatory path (${x}, ${z})`).toBe(true);
    }
    // Southwest sundial is at [-34, -0.48, 134]; ruined observatory must remain distinct.
    expect(Math.hypot(OX - (-34), OZ - 134)).toBeGreaterThan(100);
  });

  it('provides a continuous walkable route from Path 1 up the wooded hill, around the orrery and telescope, and back down', () => {
    const world = new ExteriorWorld('low');
    const ascentWaypoints: Vec3[] = [
      ...OBSERVATORY_APPROACH_PATH.map(([x, z]): Vec3 => [x, LAND_SUPPORT_Y, z]),
      [OX - 6.5, OBSERVATORY_FLOOR_Y, OZ],          // inside west entrance on terrace
      [OX - 3.2, OBSERVATORY_FLOOR_Y, OZ],          // west side facing broken orrery
      [OX - 2.6, OBSERVATORY_FLOOR_Y, OZ - 3.0],    // near north-west constellation chart
      [OX + 2.2, OBSERVATORY_FLOOR_Y, OZ - 4.4],    // approaching weathered telescope
      [OX + 4.4, OBSERVATORY_FLOOR_Y, OZ + 2.2],    // east-south promenade
      [OX - 2.6, OBSERVATORY_FLOOR_Y, OZ + 3.4],    // south-west constellation chart
      [OX - 3.2, OBSERVATORY_FLOOR_Y, OZ],          // back to west entrance axis
    ];

    expect(walkRoute(
      world.collision,
      ascentWaypoints.map((at, i) => ({ label: `obs-ascent-${i}`, at })),
    )).toEqual([]);

    expect(walkRoute(
      world.collision,
      [...ascentWaypoints].reverse().map((at, i) => ({ label: `obs-descent-${i}`, at })),
    )).toEqual([]);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('guards ruined terrace perimeter walls and ramp edges against falling off the knoll', () => {
    const world = new ExteriorWorld('medium');
    expect(world.collision.resolveHorizontal({ x: OX, y: OBSERVATORY_FLOOR_Y, z: OZ - 7.6 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: OX + 7.6, y: OBSERVATORY_FLOOR_Y, z: OZ }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: OX, y: OBSERVATORY_FLOOR_Y, z: OZ + 7.6 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: OX - 7.6, y: OBSERVATORY_FLOOR_Y, z: OZ - 5.0 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('keeps zero THREE.Light objects, exposes the dormant W09 orrery interactable, and honors reducedMotion', () => {
    const world = new ExteriorWorld('high');
    const lights: THREE.Light[] = [];
    world.root.traverse((obj) => {
      if ((obj as THREE.Light).isLight) lights.push(obj as THREE.Light);
    });
    expect(lights).toHaveLength(0);

    expect(world.root.getObjectByName('southern-ruined-observatory')).toBeTruthy();
    expect(world.root.getObjectByName('ruined-observatory-dome-fragment')).toBeTruthy();
    expect(world.root.getObjectByName('observatory-weathered-telescope')).toBeTruthy();
    expect(world.root.getObjectByName('observatory-zodiac-floor')).toBeTruthy();
    const orreryAnchor = world.root.getObjectByName('observatory-orrery-w09-anchor');
    expect(orreryAnchor).toBeTruthy();

    const middleRing = orreryAnchor!.children[0]?.children[3];
    expect(middleRing).toBeTruthy();
    const initialRot = middleRing!.rotation.y;
    world.variableUpdate(0.8, [OX - 3, OBSERVATORY_FLOOR_Y + 1.64, OZ], 'plaza', true);
    expect(middleRing!.rotation.y).toBe(initialRot);
    world.variableUpdate(0.8, [OX - 3, OBSERVATORY_FLOOR_Y + 1.64, OZ], 'plaza', false);
    expect(middleRing!.rotation.y).not.toBe(initialRot);

    const announcements: string[] = [];
    const control = world.observatory.getOrreryControl((msg) => announcements.push(msg));
    const before = typeof control.label === 'function' ? control.label() : control.label;
    expect(before).toContain('Inspect Broken Orrery');
    control.activate();
    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toContain('W09');
    const after = typeof control.label === 'function' ? control.label() : control.label;
    expect(after).toContain('dormant');

    world.dispose();
    expect(world.scope.size).toBe(0);
  });
});
