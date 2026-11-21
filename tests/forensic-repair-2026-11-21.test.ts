import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildMuseum } from './helpers/walk';
import { PlayerController } from '../src/player/PlayerController';
import {
  DOME_APEX_Y, LEVEL_1_Y, SANCTUARY_DIR, SANCTUARY_FLOOR_Y, SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, place,
} from '../src/world/layout';

/**
 * Forensic repair, 2026-11-21 (docs/FORENSIC_REPAIR_2026-11-21.md): flight
 * respects slabs and the dome; the Sanctuary ramp is walked where it is seen.
 */

const built = buildMuseum();

function flyer(keys: string[]) {
  const held = new Set(keys);
  const input = { isDown: (a: string) => held.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
  return { player: new PlayerController(built.collision, input as never), held };
}

describe('flight keeps to the architecture', () => {
  it('climbing straight up stops under the dome and never leaves the rotunda', () => {
    const { player } = flyer(['forward', 'run']);
    player.teleport([0, 0.5, 0], 0);
    player.enterFlight();
    player.pitch = 1.45;
    for (let i = 0; i < 60 * 8; i++) player.fixedUpdate(1 / 60);
    expect(player.flightMode).toBe(true);
    expect(player.position.y + 1.78).toBeLessThan(DOME_APEX_Y);
  });

  it('cannot rise through the balcony slab from below', () => {
    const { player } = flyer(['forward', 'run']);
    // Under the south balcony ring, flying up and outward.
    player.teleport([0, 2, 12.5], Math.PI);
    player.enterFlight();
    player.pitch = 1.2;
    for (let i = 0; i < 60 * 4; i++) player.fixedUpdate(1 / 60);
    // Still below the slab's underside (top at LEVEL_1_Y, 0.6 m deep).
    expect(player.position.y + 1.78).toBeLessThanOrEqual(LEVEL_1_Y - 0.6 + 1e-6);
  });

  it('flying level into a slab edge is refused, and flight still lands', () => {
    const { player, held } = flyer([]);
    player.teleport([0, 0.5, 0], Math.PI);
    player.enterFlight();
    for (let i = 0; i < 60 * 3; i++) player.fixedUpdate(1 / 60); // the launch pop dies away; flight hovers
    // In the open well at the balcony slab's height (top y = 10, 0.6 m deep),
    // then straight out toward the ring.
    // Head (y + 1.78) inside the slab's 0.6 m thickness but below the
    // balustrade, which starts at the slab top and blocks on its own.
    player.position.set(0, 7.9, 0);
    player.fixedUpdate(1 / 60);
    held.add('forward');
    player.pitch = 0;
    for (let i = 0; i < 60 * 4; i++) player.fixedUpdate(1 / 60);
    // Stopped at the ring's inner edge (apothem 11), not inside the slab.
    expect(Math.hypot(player.position.x, player.position.z)).toBeLessThan(11.5);
    expect(player.flightMode).toBe(true);
    // Dive and land: walking resumes.
    player.pitch = -1.4;
    for (let i = 0; i < 60 * 6 && player.flightMode; i++) player.fixedUpdate(1 / 60);
    expect(player.flightMode).toBe(false);
  });

  it('the launch still rises from the pad', () => {
    const { player } = flyer([]);
    player.teleport([0, 0.5, 0], 0);
    player.enterFlight();
    for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
    expect(player.position.y).toBeGreaterThan(2);
    expect(player.flightMode).toBe(true);
  });
});

describe('Dexter Sanctuary descent', () => {
  it('the ramp is walked on its visible surface', () => {
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const along = SANCTUARY_RAMP_FROM + (SANCTUARY_RAMP_TO - SANCTUARY_RAMP_FROM) * t;
      const p = place(SANCTUARY_DIR, along, 0, 0);
      const expected = SANCTUARY_FLOOR_Y * t;
      const support = built.collision.supportHeight(p[0], p[2], expected + 0.3, 0.55);
      expect(support, `t=${t}`).not.toBeNull();
      expect(Math.abs(support! - expected), `t=${t}`).toBeLessThan(0.05);
    }
  });

  it('no ground plane lies across the trench above the ramp', () => {
    built.root.updateMatrixWorld(true);
    const caster = new THREE.Raycaster();
    for (const t of [0.15, 0.3, 0.45]) {
      const along = SANCTUARY_RAMP_FROM + (SANCTUARY_RAMP_TO - SANCTUARY_RAMP_FROM) * t;
      const p = place(SANCTUARY_DIR, along, 0, 0);
      caster.set(new THREE.Vector3(p[0], 3, p[2]), new THREE.Vector3(0, -1, 0));
      const ground = built.root.getObjectByName('interior-site-ground')!;
      expect(caster.intersectObject(ground, false), `t=${t}`).toEqual([]);
    }
  });
});
