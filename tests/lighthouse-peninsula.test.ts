import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import {
  LAND_SUPPORT_Y,
  LIGHTHOUSE_APPROACH_PATH,
  LIGHTHOUSE_PENINSULA_CENTER,
  isSiteLand,
  sitePolygonsAreValid,
} from '../src/world/exterior/IslandSiteLayout';
import {
  LIGHTHOUSE_GALLERY_Y,
  LIGHTHOUSE_TERRACE_Y,
} from '../src/world/exterior/ExteriorLighthouse';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player/PlayerController';
import type { Vec3 } from '../src/world/layout';
import { walkRoute } from './helpers/walk';

const [TX, , TZ] = LIGHTHOUSE_PENINSULA_CENTER;

describe('ISLAND-02A coastal lighthouse peninsula', () => {
  it('extends valid island land support onto the southeast peninsula', () => {
    expect(sitePolygonsAreValid()).toBe(true);
    expect(isSiteLand(TX, TZ)).toBe(true);
    for (const [x, z] of LIGHTHOUSE_APPROACH_PATH) {
      expect(isSiteLand(x, z), `approach point (${x}, ${z})`).toBe(true);
    }
    for (const dx of [-15, 0, 15]) {
      for (const dz of [-15, 0, 15]) {
        expect(isSiteLand(TX + dx, TZ + dz), `headland (${TX + dx}, ${TZ + dz})`).toBe(true);
      }
    }
  });

  it('provides a continuous collision-backed walk up the headland, stairs, gallery, and into the Fresnel lens room — and back down', () => {
    const world = new ExteriorWorld('low');
    const ascentWaypoints: Vec3[] = [
      ...LIGHTHOUSE_APPROACH_PATH.map(([x, z]): Vec3 => [x, LAND_SUPPORT_Y, z]),
      [TX - 13, LIGHTHOUSE_TERRACE_Y, TZ],
      [TX - 8, LIGHTHOUSE_TERRACE_Y, TZ + 3.2],
      [TX - 3.2, LIGHTHOUSE_TERRACE_Y, TZ + 3.2],       // L0 SW
      [TX - 3.2, 2.75, TZ - 3.2],                        // L1 NW
      [TX + 3.2, 4.0, TZ - 3.2],                         // L2 NE
      [TX + 3.2, 5.25, TZ + 3.2],                        // L3 SE
      [TX - 3.2, 6.5, TZ + 3.2],                         // L4 SW
      [TX - 3.2, 7.75, TZ - 3.2],                        // L5 NW
      [TX + 3.2, 9.0, TZ - 3.2],                         // L6 NE
      [TX + 3.2, 10.25, TZ + 3.2],                       // L7 SE
      [TX - 3.2, LIGHTHOUSE_GALLERY_Y, TZ + 3.2],        // SW stairhead exit
      [TX - 5.7, LIGHTHOUSE_GALLERY_Y, TZ + 3.2],        // West gallery
      [TX - 5.7, LIGHTHOUSE_GALLERY_Y, TZ - 5.7],        // NW gallery
      [TX + 5.7, LIGHTHOUSE_GALLERY_Y, TZ - 5.7],        // NE gallery
      [TX + 5.7, LIGHTHOUSE_GALLERY_Y, TZ + 5.7],        // SE gallery
      [TX - 5.7, LIGHTHOUSE_GALLERY_Y, TZ + 5.7],        // SW gallery
      [TX - 5.7, LIGHTHOUSE_GALLERY_Y, TZ],              // West gallery opposite door
      [TX - 1.4, LIGHTHOUSE_GALLERY_Y, TZ],              // Inside lantern room facing Fresnel lens
    ];

    const ascentSteps = ascentWaypoints.map((at, i) => ({
      label: `ascent-${i}`,
      at,
    }));
    expect(walkRoute(world.collision, ascentSteps)).toEqual([]);

    const descentWaypoints = [...ascentWaypoints].reverse();
    const descentSteps = descentWaypoints.map((at, i) => ({
      label: `descent-${i}`,
      at,
    }));
    expect(walkRoute(world.collision, descentSteps)).toEqual([]);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('guards cliffs, outer gallery edges, stairhead shaft, and tower walls against escape or clipping', () => {
    const world = new ExteriorWorld('medium');
    // Headland terrace north/east/south cliff parapets block stepping off
    expect(world.collision.resolveHorizontal({ x: TX, y: LIGHTHOUSE_TERRACE_Y, z: TZ - 14.0 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: TX + 14.0, y: LIGHTHOUSE_TERRACE_Y, z: TZ }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    // Solid tower wall blocks walking into drum away from doorway (North face)
    expect(world.collision.resolveHorizontal({ x: TX, y: LIGHTHOUSE_TERRACE_Y, z: TZ - 6.5 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    // Top gallery railings and stairhead shaft parapets are solid
    expect(world.collision.resolveHorizontal({ x: TX, y: LIGHTHOUSE_GALLERY_Y, z: TZ - 7.1 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: TX + 4.3, y: LIGHTHOUSE_GALLERY_Y, z: TZ + 1.0 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    expect(world.collision.resolveHorizontal({ x: TX + 1.0, y: LIGHTHOUSE_GALLERY_Y, z: TZ + 4.3 }, PLAYER_RADIUS, PLAYER_HEIGHT)).toBe(true);
    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('keeps zero THREE.Light objects, exposes a dormant L01 lens interactable, and honors reducedMotion', () => {
    const world = new ExteriorWorld('high');
    const lights: THREE.Light[] = [];
    world.root.traverse((obj) => {
      if ((obj as THREE.Light).isLight) lights.push(obj as THREE.Light);
    });
    expect(lights).toHaveLength(0);

    expect(world.root.getObjectByName('lighthouse-peninsula-tower')).toBeTruthy();
    expect(world.root.getObjectByName('lighthouse-lens-l01-anchor')).toBeTruthy();
    const turret = world.root.getObjectByName('lighthouse-fresnel-turret')!;
    const startAngle = turret.rotation.y;
    world.variableUpdate(1.0, [TX, LIGHTHOUSE_GALLERY_Y + 1.64, TZ], 'plaza', true);
    expect(turret.rotation.y).toBe(startAngle);
    world.variableUpdate(1.0, [TX, LIGHTHOUSE_GALLERY_Y + 1.64, TZ], 'plaza', false);
    expect(turret.rotation.y).not.toBe(startAngle);

    const announcements: string[] = [];
    const control = world.lighthouse.getLensControl((m) => announcements.push(m));
    const beforeLabel = typeof control.label === 'function' ? control.label() : control.label;
    expect(beforeLabel).toContain('Inspect Lighthouse Lens');
    control.activate();
    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toContain('L01');
    const afterLabel = typeof control.label === 'function' ? control.label() : control.label;
    expect(afterLabel).toContain('dormant');

    world.dispose();
    expect(world.scope.size).toBe(0);
  });
});
