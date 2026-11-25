import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildMuseum } from './helpers/walk';
import { PlayerController } from '../src/player/PlayerController';
import { CINEMA_PROGRAMME, isLocalMediaPath, parseProgramme, type LocalFilm } from '../src/cinema/programme';
import {
  ACCESSIBLE_POSITIONS, AUDITORIUM, CINEMA_FLOOR_Y, CINEMA_POINTS, CINEMA_SEATS, EXIT_PASSAGE, LOBBY, REAR_PLATFORM,
  SCREEN_FACING_YAW, SEATED_EYE_HEIGHT, TIER_RISE, tierY,
} from '../src/world/cinemaLayout';
import { LEVEL_1_Y, ROTUNDA_APOTHEM, STAIRS, stairApproach, stairArcPoint, stairLanding, zoneAtXYZ, type Vec3 } from '../src/world/layout';

/**
 * The Museum Cinema (docs/MUSEUM_CINEMA_2026-11-21.md): a real room in the real
 * building, walked with the real PlayerController and its collision.
 */

const built = buildMuseum();
const cinemaGroup = built.museum.zoneGroups.get('cinema')!;

function walker(start: Vec3, yaw = 0) {
  const held = new Set<string>();
  const input = { isDown: (a: string) => held.has(a), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
  const player = new PlayerController(built.collision, input as never);
  player.teleport(start, yaw);
  // Settle onto the floor.
  for (let i = 0; i < 30; i++) player.fixedUpdate(1 / 60);
  /** Walk with the held forward key, steering at the target; false on a stall. */
  const walkTo = (target: Vec3, seconds = 40): boolean => {
    held.add('forward');
    let best = Infinity;
    let since = 0;
    for (let i = 0; i < seconds * 60; i++) {
      const dx = target[0] - player.position.x;
      const dz = target[2] - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) { held.delete('forward'); return true; }
      player.yaw = Math.atan2(-dx, -dz);
      player.fixedUpdate(1 / 60);
      if (d < best - 0.01) { best = d; since = 0; } else if (++since > 90) break;
    }
    held.delete('forward');
    return false;
  };
  return { player, held, walkTo };
}

describe('cinema architecture', () => {
  it('is built into the museum as its own zone, with a screen, 252 seats and an entrance', () => {
    expect(built.museum.cinema).not.toBeNull();
    expect(cinemaGroup.getObjectByName('cinema-screen-picture')).toBeTruthy();
    expect(cinemaGroup.getObjectByName('cinema-marquee')).toBeTruthy();
    expect(cinemaGroup.getObjectByName('cinema-seats')!.children).toHaveLength(3);
    expect(CINEMA_SEATS).toHaveLength(252);
    expect(built.museum.cinema!.seatBlocks.map((b) => b.seats.length)).toEqual([126, 126]);
    expect(built.museum.cinema!.accessibleProxy.name).toBe('cinema-accessible-positions');
  });

  it('joins the balcony, threshold and lower lobby without overlapping floor faces', () => {
    const balcony = built.museum.zoneGroups.get('balcony')!;
    const drum = built.museum.zoneGroups.get('rotunda')!;
    built.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(undefined, new THREE.Vector3(0, -1, 0), 0, 0.4);

    // Off the carpet, where shallow camera angles exposed the coplanar slabs.
    for (const x of [ROTUNDA_APOTHEM - 0.1, ROTUNDA_APOTHEM + 0.1, LOBBY.minX - 0.1, LOBBY.minX + 0.1]) {
      ray.ray.origin.set(x, LEVEL_1_Y + 0.3, 2.12);
      const isThreshold = x > ROTUNDA_APOTHEM && x < LOBBY.minX;
      const surfaces = ray.intersectObjects(isThreshold ? [balcony, cinemaGroup, drum] : [balcony, cinemaGroup], true);
      expect(surfaces.length, `floor at x=${x}`).toBeGreaterThan(0);
      const top = surfaces[0].point.y;
      const visible = new Set(surfaces.filter(({ point }) => Math.abs(top - point.y) < 0.002).map(({ object }) => object));
      expect(visible.size, `roof or floor competing with the finish at x=${x}`).toBe(1);
      expect(Math.abs(top - LEVEL_1_Y)).toBeLessThan(0.03);
      expect(built.collision.supportHeight(x, 2.12, LEVEL_1_Y)).toBeCloseTo(top, 3);
    }
  });

  it('every room point reads as the cinema zone, and the balcony approach does not', () => {
    for (const [name, p] of Object.entries(CINEMA_POINTS)) {
      if (name === 'balconyApproach') continue;
      expect(zoneAtXYZ(p[0], p[1] + 0.1, p[2]), name).toBe('cinema');
    }
    const approach = CINEMA_POINTS.balconyApproach;
    expect(zoneAtXYZ(approach[0], approach[1] + 0.1, approach[2])).toBe('balcony');
    // Rooms below keep their own zones.
    expect(zoneAtXYZ(40, 1, 3)).toBe('east');
  });

  it('no other part of the building reaches into the cinema rooms', () => {
    // Every vertex and triangle centre of every non-cinema mesh stays out of the
    // lobby, auditorium and exit passage volumes.
    const rooms = [
      // The lobby's floor is at balcony height to the ramp, and 0.6 m higher beyond it.
      new THREE.Box3(new THREE.Vector3(LOBBY.minX, LEVEL_1_Y, LOBBY.minZ), new THREE.Vector3(LOBBY.rampFromX, LOBBY.ceilingY, LOBBY.maxZ)),
      new THREE.Box3(new THREE.Vector3(LOBBY.rampFromX, CINEMA_FLOOR_Y, LOBBY.minZ), new THREE.Vector3(LOBBY.maxX, LOBBY.ceilingY, LOBBY.maxZ)),
      new THREE.Box3(new THREE.Vector3(AUDITORIUM.minX, CINEMA_FLOOR_Y, AUDITORIUM.minZ), new THREE.Vector3(AUDITORIUM.maxX, AUDITORIUM.ceilingY, AUDITORIUM.maxZ)),
      new THREE.Box3(new THREE.Vector3(EXIT_PASSAGE.minX, CINEMA_FLOOR_Y, EXIT_PASSAGE.minZ), new THREE.Vector3(EXIT_PASSAGE.maxX, CINEMA_FLOOR_Y + 3.8, EXIT_PASSAGE.maxZ)),
    ].map((box) => box.expandByScalar(-0.05));
    const intruders = new Set<string>();
    const v = new THREE.Vector3();
    const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    built.root.updateMatrixWorld(true);
    built.root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
      let parent: THREE.Object3D | null = mesh;
      while (parent && parent !== cinemaGroup) parent = parent.parent;
      if (parent === cinemaGroup) return;
      const position = mesh.geometry.getAttribute('position');
      const index = mesh.geometry.getIndex();
      const count = index ? index.count : position.count;
      for (let i = 0; i < count; i += 3) {
        for (let k = 0; k < 3; k++) tri[k].fromBufferAttribute(position, index ? index.getX(i + k) : i + k).applyMatrix4(mesh.matrixWorld);
        v.copy(tri[0]).add(tri[1]).add(tri[2]).divideScalar(3);
        for (const point of [...tri, v]) {
          if (rooms.some((room) => room.containsPoint(point))) intruders.add(`${mesh.name || mesh.parent?.name} @ ${point.toArray().map((n) => n.toFixed(1))}`);
        }
      }
    });
    expect([...intruders].slice(0, 10)).toEqual([]);
  });
});

describe('walking into and around the cinema (real PlayerController)', () => {
  it('reaches the balcony by the grand stair, then walks through the threshold, lobby ramp and door into the auditorium', () => {
    const stair = STAIRS[0];
    const { player, walkTo } = walker(stairApproach(stair));
    // Up the curved flight by its own arc, then along the balcony ring to the east face.
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const a = stairArcPoint(stair, t);
      expect(walkTo(a), `stair t=${t.toFixed(2)}`).toBe(true);
    }
    expect(walkTo(stairLanding(stair))).toBe(true);
    expect(player.position.y).toBeCloseTo(LEVEL_1_Y, 1);
    const ringTo = (angle: number): Vec3 => [Math.cos(angle) * 13.5, LEVEL_1_Y, Math.sin(angle) * 13.5];
    const start = Math.atan2(player.position.z, player.position.x);
    for (let k = 1; k <= 8; k++) expect(walkTo(ringTo(start + (0 - start) * (k / 8))), `ring ${k}`).toBe(true);
    for (const name of ['balconyApproach', 'threshold', 'lobby', 'lobbyTurn', 'lightLock', 'lobbyEast', 'insideEntry', 'frontZone'] as const) {
      expect(walkTo(CINEMA_POINTS[name]), name).toBe(true);
    }
    expect(player.position.y).toBeCloseTo(CINEMA_FLOOR_Y, 2);
    expect(zoneAtXYZ(player.position.x, player.position.y + 0.1, player.position.z)).toBe('cinema');
  });

  it('the north aisle is a step-free ramp to the rear platform and its accessible positions', () => {
    const { player, walkTo } = walker(CINEMA_POINTS.insideEntry);
    expect(walkTo([33, CINEMA_FLOOR_Y, 1.45])).toBe(true);
    let lastY = player.position.y;
    let biggestStep = 0;
    const target = CINEMA_POINTS.northAisleTop;
    for (let i = 1; i <= 40; i++) {
      const x = 33 + ((target[0] - 33) * i) / 40;
      expect(walkTo([x, 0, 1.45]), `ramp ${i}`).toBe(true);
      biggestStep = Math.max(biggestStep, Math.abs(player.position.y - lastY));
      lastY = player.position.y;
    }
    expect(biggestStep).toBeLessThan(0.2); // a ramp, not steps
    expect(player.position.y).toBeCloseTo(REAR_PLATFORM.y, 1);
    for (const spot of ACCESSIBLE_POSITIONS) expect(walkTo(spot.position), spot.id).toBe(true);
  });

  it('stepped aisles: up the centre aisle row by row, across the rear, down the south aisle and out the exit loop', () => {
    const { player, walkTo } = walker(CINEMA_POINTS.frontZone);
    for (let row = 0; row < 9; row++) {
      expect(walkTo([35 + row * 2.1 + 1.0, 0, 12.4]), `centre aisle row ${row}`).toBe(true);
      expect(player.position.y).toBeCloseTo(tierY(row), 1);
    }
    expect(walkTo(CINEMA_POINTS.rearPlatform)).toBe(true);
    expect(walkTo([REAR_PLATFORM.minX + 1.0, 0, 23.35])).toBe(true);
    for (let row = 8; row >= 0; row--) expect(walkTo([35 + row * 2.1 + 1.0, 0, 23.35]), `south aisle row ${row}`).toBe(true);
    for (const name of ['southAisleFront', 'exitInside', 'exitPassageSouth', 'exitPassageNorth', 'lightLock', 'lobbyTurn', 'lobby', 'threshold', 'balconyApproach'] as const) {
      expect(walkTo(CINEMA_POINTS[name]), name).toBe(true);
    }
    expect(player.position.y).toBeCloseTo(LEVEL_1_Y, 1);
  });

  it('every seat is reached from its walkway; sitting faces the screen and standing returns exactly to the walkway', () => {
    for (const seat of [CINEMA_SEATS[0], CINEMA_SEATS[13], CINEMA_SEATS[14], CINEMA_SEATS[27], CINEMA_SEATS[126], CINEMA_SEATS[251]]) {
      const { player, walkTo, held } = walker(CINEMA_POINTS.frontZone);
      const aisle = 12.4;
      // Up the centre aisle to the seat's tier, then along its walkway.
      for (let row = 0; row <= seat.row; row++) expect(walkTo([35 + row * 2.1 + 0.55, 0, aisle])).toBe(true);
      expect(walkTo(seat.aisleSide), seat.id).toBe(true);
      const before = player.position.clone();
      expect(player.sit(seat.position, SCREEN_FACING_YAW, SEATED_EYE_HEIGHT)).toBe(true);
      expect(player.isSeated).toBe(true);
      expect(player.eyePosition[1]).toBeCloseTo(seat.position[1] + SEATED_EYE_HEIGHT, 5);
      // Seated: movement keys do not move the visitor.
      held.add('forward');
      for (let i = 0; i < 60; i++) player.fixedUpdate(1 / 60);
      held.delete('forward');
      expect(player.position.x).toBeCloseTo(seat.position[0], 6);
      expect(player.stand()).toBe(true);
      expect(player.position.distanceTo(before)).toBeLessThan(1e-9);
      expect(player.isSeated).toBe(false);
      for (let i = 0; i < 30; i++) player.fixedUpdate(1 / 60);
      expect(player.position.y).toBeCloseTo(seat.position[1], 1);
    }
  });

  it('seat rows are solid: a visitor cannot walk through a row of seats', () => {
    const { player, walkTo } = walker([35 + 4 * 2.1 + 0.55, tierY(4), 6]);
    // Walking straight toward the rear through row E's seats stops at the row.
    expect(walkTo([35 + 6 * 2.1 + 0.55, 0, 6], 6)).toBe(false);
    expect(player.position.x).toBeLessThan(35 + 5 * 2.1 - 0.9);
    expect(player.position.y).toBeCloseTo(tierY(4), 2);
    expect(TIER_RISE).toBeLessThan(0.55);
  });

  it('the screen faces the seats (yaw convention: forward is −x)', () => {
    expect(-Math.sin(SCREEN_FACING_YAW)).toBeCloseTo(-1, 6);
  });
});

describe('cinema programme (source-grounded)', () => {
  it('lists only real local media whose bytes match the recorded hashes', () => {
    expect(CINEMA_PROGRAMME.rejected).toEqual([]);
    const local = CINEMA_PROGRAMME.films.filter((f): f is LocalFilm => f.kind === 'local');
    expect(local).toHaveLength(8);
    for (const film of local) {
      const file = `public/${film.media.src}`;
      expect(existsSync(file), file).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.length).toBe(film.media.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(film.media.sha256);
      expect(film.poster).not.toBeNull();
      const poster = readFileSync(`public/${film.poster!.src}`);
      expect(createHash('sha256').update(poster).digest('hex')).toBe(film.poster!.sha256);
      // No captions are claimed where none exist, and the reason is stated.
      expect(film.captions).toBeNull();
      expect(film.captionsNote).toMatch(/no soundtrack/);
      expect(film.media.hasAudio).toBe(false);
    }
  });

  it('rejects malformed, remote and traversal entries instead of repairing them', () => {
    const film = (over: Record<string, unknown>) => ({
      id: 'x', source: 'local', title: 'X', description: 'd',
      media: { src: 'a/b.mp4', type: 'video/mp4', width: 1, height: 1, durationSeconds: 1 },
      ...over,
    });
    const parsed = parseProgramme({ films: [
      film({ id: 'ok' }),
      film({ id: 'remote', media: { src: 'https://example.com/a.mp4', type: 'video/mp4', width: 1, height: 1, durationSeconds: 1 } }),
      film({ id: 'up', media: { src: '../secret.mp4', type: 'video/mp4', width: 1, height: 1, durationSeconds: 1 } }),
      film({ id: 'ok' }),
      film({ id: 'audio', media: { src: 'a.mp3', type: 'audio/mpeg', width: 1, height: 1, durationSeconds: 1 } }),
      { id: 'bare' },
    ] });
    expect(parsed.films.map((f) => f.id)).toEqual(['ok']);
    expect(parsed.rejected.map((r) => r.id)).toEqual(['remote', 'up', 'ok', 'audio', 'bare']);
    expect(isLocalMediaPath('/abs.mp4')).toBe(false);
    expect(parseProgramme({}).films).toEqual([]);
  });
});


describe('cinema light lock', () => {
  it('no straight line runs from the auditorium through the entry door to the threshold', () => {
    // Sample sightlines from every seat row and the rear platform through the
    // door opening; each must meet a wall before reaching the drum's threshold.
    const blocked = (from: Vec3, to: Vec3) => {
      const steps = Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.05);
      for (let i = 1; i < steps; i++) {
        const x = from[0] + ((to[0] - from[0]) * i) / steps;
        const z = from[2] + ((to[2] - from[2]) * i) / steps;
        const p = { x, y: CINEMA_FLOOR_Y + 0.5, z };
        if (built.collision.resolveHorizontal(p, 0.01, 1)) return true;
      }
      return false;
    };
    let checked = 0;
    for (const z of [0.9, 2.7, 4.5]) {
      for (const eye of [CINEMA_POINTS.rearPlatform, ...CINEMA_SEATS.filter((_, i) => i % 7 === 0).map((s) => s.position)]) {
        // Extend the eye→door line out to the threshold plane (x = 16.6).
        const door: Vec3 = [LOBBY.maxX, CINEMA_FLOOR_Y, z];
        const t = (eye[0] - LOBBY.minX) / (eye[0] - door[0]);
        const far: Vec3 = [LOBBY.minX, CINEMA_FLOOR_Y, eye[2] + (door[2] - eye[2]) * t];
        if (Math.abs(far[2]) > 2.6) continue; // that line never reaches the threshold opening
        expect(blocked(door, far), `from ${eye.map((n) => n.toFixed(1))} via door z ${z}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});
