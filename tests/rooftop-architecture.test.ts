import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import {
  DOME_CENTER,
  DOME_OUTER_RADIUS,
  GREENHOUSE_FLOWER_CENTER,
  GREENHOUSE_FLOWER_ID,
  HOT_DOG_STAND_CENTER,
  HOT_DOG_STAND_ID,
  PROTECTED_CINEMA_ENVELOPE,
  ROOF_ACCESSIBLE_BAYS,
  ROOF_CAFE_DECK,
  ROOF_CAFE_TABLES,
  ROOF_CAFE_TABLE_COLLIDER_HALF,
  ROOF_DECK_UNDERSIDE_Y,
  ROOF_DECK_Y,
  ROOF_FLIGHT_PAD_II_CENTER,
  ROOF_FLIGHT_PAD_II_DECK,
  ROOF_FLIGHT_PAD_II_LAUNCH_SPEED,
  ROOF_FLIGHT_PAD_II_RADIUS,
  ROOF_FLIGHT_PAD_II_TELEPORT_ID,
  ROOF_GREENHOUSE_DECK,
  ROOF_GREENHOUSE_DOOR,
  ROOF_GREENHOUSE_SHELL,
  ROOF_MID_LANDING_Y,
  ROOF_PROMENADE_DECK,
  ROOF_WAYPOINTS,
  WEST_ASCENT_ENTRY,
  isOnRooftopFlightPad,
  westBarrelPeakAtX,
} from '../src/world/exterior/rooftopLayout';
import { FLIGHT_PAD_CENTER, isOnFlightPad, type Vec3 } from '../src/world/layout';
import { FLIGHT_LAUNCH_SPEED, PLAYER_HEIGHT, PLAYER_RADIUS, PlayerController } from '../src/player/PlayerController';
import { walkRoute } from './helpers/walk';
import { JUMP_SPEED } from '../src/player/PlayerController';
import { ROOF_RAIL_COLLIDER_HEIGHT } from '../src/world/exterior/rooftopLayout';
import { AUDITORIUM, LOBBY, WALL_T, EXIT_PASSAGE } from '../src/world/cinemaLayout';

describe('ISLAND-03 rooftop architecture & west flank access', () => {
  it('derives the protected Cinema envelope from the real Cinema layout (envelope contains lobby, passage and auditorium)', () => {
    const cinema = {
      minX: Math.min(LOBBY.minX, EXIT_PASSAGE.minX),
      maxX: AUDITORIUM.maxX + WALL_T,
      minZ: Math.min(LOBBY.minZ, AUDITORIUM.minZ - WALL_T),
      maxZ: Math.max(LOBBY.maxZ, AUDITORIUM.maxZ + WALL_T),
      maxY: AUDITORIUM.ceilingY,
    };
    expect(PROTECTED_CINEMA_ENVELOPE.minX).toBeLessThanOrEqual(cinema.minX);
    expect(PROTECTED_CINEMA_ENVELOPE.maxX).toBeGreaterThanOrEqual(cinema.maxX);
    expect(PROTECTED_CINEMA_ENVELOPE.minZ).toBeLessThanOrEqual(cinema.minZ);
    expect(PROTECTED_CINEMA_ENVELOPE.maxZ).toBeGreaterThanOrEqual(cinema.maxZ);
    expect(PROTECTED_CINEMA_ENVELOPE.maxY).toBeGreaterThanOrEqual(cinema.maxY);
  });

  it('keeps rooftopLayout free of Three.js imports and clear of Cinema, Dome, and Barrel roof peaks', () => {
    const layoutSource = readFileSync('src/world/exterior/rooftopLayout.ts', 'utf8');
    expect(layoutSource).not.toMatch(/from\s+['"]three['"]/);
    expect(layoutSource).not.toMatch(/from\s+['"][^'"]*(InteriorWorld|Cinema|exhibits\/)/);

    // Every elevated rooftop deck sits strictly west of the protected Cinema envelope (minX = 15.08)
    const decks = [
      ROOF_CAFE_DECK,
      ROOF_PROMENADE_DECK,
      ROOF_GREENHOUSE_DECK,
      ROOF_FLIGHT_PAD_II_DECK,
    ];
    for (const deck of decks) {
      expect(deck.maxX).toBeLessThan(PROTECTED_CINEMA_ENVELOPE.minX);
      expect(ROOF_DECK_UNDERSIDE_Y).toBeGreaterThan(18.17);
    }

    // Cafe north edge stays strictly south of the Dome (R = 15.22 m)
    expect(ROOF_CAFE_DECK.minZ).toBeGreaterThan(DOME_CENTER[2] + DOME_OUTER_RADIUS);
    // Greenhouse east edge stays strictly west of the Dome
    expect(Math.abs(ROOF_GREENHOUSE_DECK.maxX - DOME_CENTER[0])).toBeGreaterThan(DOME_OUTER_RADIUS);

    // Every deck underside clears the west barrel wing peak (18.17 m at X = -25.5)
    for (let x = -37.5; x <= -14.0; x += 0.5) {
      const peak = westBarrelPeakAtX(x);
      if (peak !== null) {
        expect(ROOF_DECK_UNDERSIDE_Y, `barrel clearance at X=${x}`).toBeGreaterThan(peak);
      }
    }
  });

  it('connects Path 5 up the West Flank to Greenhouse, W05 Flower, Cafe, Hot Dog Stand, Flight Pad II & Pedestal — and back down', () => {
    const world = new ExteriorWorld('low');
    const ascent: { label: string; at: Vec3 }[] = [
      { label: 'path5-entry', at: WEST_ASCENT_ENTRY },
      { label: 'lower-ramp-foot', at: ROOF_WAYPOINTS.lowerRampFoot },
      { label: 'lower-ramp-mid', at: [-41.25, 4.5, 84.0] },
      { label: 'mid-landing', at: ROOF_WAYPOINTS.midLanding },
      { label: 'upper-ramp-mid', at: [-41.25, 14.05, 22.0] },
      { label: 'upper-ramp-top', at: ROOF_WAYPOINTS.upperRampTop },
      { label: 'upper-bridge-west', at: ROOF_WAYPOINTS.upperBridgeWest },
      { label: 'upper-bridge-east', at: ROOF_WAYPOINTS.upperBridgeEast },
      { label: 'west-walkway-mid', at: ROOF_WAYPOINTS.westWalkwayMid },
      { label: 'west-walkway-south', at: ROOF_WAYPOINTS.westWalkwaySouth },
      { label: 'greenhouse-door-approach', at: ROOF_WAYPOINTS.greenhouseDoorApproach },
      { label: 'greenhouse-door', at: ROOF_WAYPOINTS.greenhouseDoor },
      { label: 'greenhouse-flower-approach', at: ROOF_WAYPOINTS.greenhouseFlowerApproach },
      // Walk around the W05 exotic flower collar back out the 4 m south doorway
      { label: 'greenhouse-se-aisle', at: [-21.5, ROOF_DECK_Y, 13.5] },
      { label: 'greenhouse-east-side', at: [-21.5, ROOF_DECK_Y, 10.0] },
      { label: 'greenhouse-se-return', at: [-21.5, ROOF_DECK_Y, 13.5] },
      { label: 'greenhouse-door-exit', at: ROOF_WAYPOINTS.greenhouseDoor },
      { label: 'greenhouse-door-south', at: ROOF_WAYPOINTS.greenhouseDoorApproach },
      { label: 'promenade-mid', at: ROOF_WAYPOINTS.promenadeMid },
      { label: 'cafe-west-aisle', at: [-8.5, ROOF_DECK_Y, 29.0] },
      { label: 'cafe-accessible-dome-bay', at: ROOF_ACCESSIBLE_BAYS[0].center },
      { label: 'cafe-west-aisle-return', at: [-8.5, ROOF_DECK_Y, 29.0] },
      { label: 'cafe-center', at: ROOF_WAYPOINTS.cafeCenter },
      { label: 'hot-dog-counter', at: ROOF_WAYPOINTS.hotDogCounter },
      { label: 'cafe-east-south-aisle', at: [5.0, ROOF_DECK_Y, 38.5] },
      { label: 'cafe-accessible-horizon-bay', at: ROOF_ACCESSIBLE_BAYS[1].center },
      { label: 'cafe-south-aisle', at: ROOF_WAYPOINTS.cafeSouthAisle },
      { label: 'flight-pad-pedestal', at: ROOF_WAYPOINTS.flightPadPedestalSpot },
      { label: 'flight-pad-ii', at: ROOF_WAYPOINTS.flightPadII },
    ];

    expect(walkRoute(world.collision, ascent)).toEqual([]);

    const descent = [...ascent].reverse().map((step, i) => ({
      label: `return-${i}-${step.label}`,
      at: step.at,
    }));
    expect(walkRoute(world.collision, descent)).toEqual([]);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('guards every rooftop & ramp edge against falling off and protects Cinema/Dome/Aisles', () => {
    const world = new ExteriorWorld('medium');
    const blocked = (x: number, y: number, z: number) =>
      world.collision.resolveHorizontal({ x, y, z }, PLAYER_RADIUS, PLAYER_HEIGHT);

    // Perimeter guardrails block walking off the deck edges
    expect(blocked(0, ROOF_DECK_Y, ROOF_CAFE_DECK.minZ - 0.1)).toBe(true); // Cafe North (toward Dome)
    expect(blocked(ROOF_CAFE_DECK.maxX + 0.1, ROOF_DECK_Y, 30)).toBe(true); // Cafe East (toward Cinema)
    expect(blocked(ROOF_CAFE_DECK.minX - 0.1, ROOF_DECK_Y, 20)).toBe(true); // Cafe West north of Promenade
    expect(blocked(-11, ROOF_DECK_Y, ROOF_CAFE_DECK.maxZ + 0.1)).toBe(true); // Cafe South West wing
    expect(blocked(11, ROOF_DECK_Y, ROOF_CAFE_DECK.maxZ + 0.1)).toBe(true); // Cafe South East wing
    expect(blocked(ROOF_FLIGHT_PAD_II_DECK.minX - 0.1, ROOF_DECK_Y, 55)).toBe(true); // Pad II West
    expect(blocked(ROOF_FLIGHT_PAD_II_DECK.maxX + 0.1, ROOF_DECK_Y, 55)).toBe(true); // Pad II East
    expect(blocked(0, ROOF_DECK_Y, ROOF_FLIGHT_PAD_II_DECK.maxZ + 0.1)).toBe(true); // Pad II South
    expect(blocked(-25, ROOF_DECK_Y, ROOF_PROMENADE_DECK.maxZ + 0.1)).toBe(true); // Promenade South
    expect(blocked(-15.25, ROOF_DECK_Y, ROOF_PROMENADE_DECK.minZ - 0.1)).toBe(true); // Promenade-Cafe chasm gap
    expect(blocked(ROOF_GREENHOUSE_DECK.minX - 0.1, ROOF_DECK_Y, 10)).toBe(true); // Greenhouse West walkway outer
    expect(blocked(ROOF_GREENHOUSE_DECK.maxX + 0.1, ROOF_DECK_Y, 10)).toBe(true); // Greenhouse East deck edge
    expect(blocked(-25, ROOF_GREENHOUSE_DECK.y, ROOF_GREENHOUSE_DECK.minZ - 0.1)).toBe(true); // Greenhouse North
    expect(blocked(-43.1, ROOF_MID_LANDING_Y, 52)).toBe(true); // Mid Landing West
    expect(blocked(-39.4, ROOF_MID_LANDING_Y, 52)).toBe(true); // Mid Landing East
    expect(blocked(-43.1, 4.5, 84)).toBe(true); // Lower West Ramp West rail
    expect(blocked(-39.4, 4.5, 84)).toBe(true); // Lower West Ramp East rail

    // Solid colliders on Hot Dog Stand counter and W05 flower stone collar
    expect(blocked(HOT_DOG_STAND_CENTER[0], ROOF_DECK_Y, HOT_DOG_STAND_CENTER[2])).toBe(true);
    expect(blocked(GREENHOUSE_FLOWER_CENTER[0], ROOF_DECK_Y, GREENHOUSE_FLOWER_CENTER[2])).toBe(true);

    // Cafe table clusters preserve >= 1.8 m clear aisles & >= 2.4 m accessible bays
    for (let i = 0; i < ROOF_CAFE_TABLES.length; i++) {
      for (let j = i + 1; j < ROOF_CAFE_TABLES.length; j++) {
        const a = ROOF_CAFE_TABLES[i];
        const b = ROOF_CAFE_TABLES[j];
        const edgeGap = Math.max(
          Math.abs(a[0] - b[0]) - 2 * ROOF_CAFE_TABLE_COLLIDER_HALF,
          Math.abs(a[2] - b[2]) - 2 * ROOF_CAFE_TABLE_COLLIDER_HALF,
        );
        expect(edgeGap).toBeGreaterThanOrEqual(1.8);
      }
    }
    for (const bay of ROOF_ACCESSIBLE_BAYS) {
      expect(bay.clearHalf * 2).toBeGreaterThanOrEqual(2.4);
      for (const ox of [-1.0, 0, 1.0]) {
        for (const oz of [-1.0, 0, 1.0]) {
          expect(blocked(bay.center[0] + ox, bay.center[1], bay.center[2] + oz)).toBe(false);
        }
      }
    }

    // Greenhouse doorway is 4 m wide clear at Z = 22
    expect(ROOF_GREENHOUSE_DOOR.maxX - ROOF_GREENHOUSE_DOOR.minX).toBe(4.0);
    expect(blocked(-26.0, ROOF_DECK_Y, ROOF_GREENHOUSE_DOOR.z)).toBe(false);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('keeps zero THREE.Light, normal glass opacity, no giant roof plants, dormant interactables, and reducedMotion freeze', () => {
    const world = new ExteriorWorld('high');

    // 1. Zero THREE.Light objects anywhere in ExteriorWorld.root
    const lights: THREE.Light[] = [];
    world.root.traverse((obj) => {
      if ((obj as THREE.Light).isLight) lights.push(obj as THREE.Light);
    });
    expect(lights).toHaveLength(0);

    // 2. Signage & Greenhouse visual contracts
    expect(world.root.getObjectByName('rooftop-cafe-sign')).toBeTruthy();
    expect(world.root.getObjectByName('hot-dog-menu-sign')).toBeTruthy();
    expect(world.root.getObjectByName('greenhouse-flower-w05-anchor')).toBeTruthy();
    expect(world.root.getObjectByName('rooftop-flight-pad-ii-arc-w06')).toBeTruthy();
    expect(world.root.getObjectByName('rooftop-flight-pad-ii-arc-w10')).toBeTruthy();

    const glassWall = world.root.getObjectByName('greenhouse-glass-wall') as THREE.Mesh;
    const glassMat = glassWall.material as THREE.MeshStandardMaterial;
    expect(glassMat.transparent).toBe(true);
    expect(glassMat.opacity).toBeCloseTo(0.24, 2);
    expect(glassMat.depthWrite).toBe(false);
    expect(ROOF_GREENHOUSE_SHELL.ridgeY).toBeCloseTo(25.4, 2);

    // Potted perimeter ferns stay small (no giant plants on the roof); W05 exotic flower is ~3.4 m tall
    const ferns = world.root.getObjectByName('greenhouse-perimeter-potted-ferns') as THREE.InstancedMesh;
    const fernBox = new THREE.Box3().setFromObject(ferns);
    expect(fernBox.max.y - ROOF_DECK_Y).toBeLessThan(1.5);

    const flowerAnchor = world.root.getObjectByName('greenhouse-flower-w05-anchor')!;
    const flowerBox = new THREE.Box3().setFromObject(flowerAnchor);
    const flowerHeight = flowerBox.max.y - ROOF_DECK_Y;
    expect(flowerHeight).toBeGreaterThan(2.9);
    expect(flowerHeight).toBeLessThan(4.1);

    // 3. Dormant interactables announce safely
    const announcements: string[] = [];
    const controls = new Map(world.rooftop.getControls((msg) => announcements.push(msg)));
    expect([...controls.keys()]).toEqual([
      HOT_DOG_STAND_ID,
      GREENHOUSE_FLOWER_ID,
      ROOF_FLIGHT_PAD_II_TELEPORT_ID,
    ]);
    for (const [id, ctrl] of controls) {
      ctrl.activate();
      expect(announcements.at(-1), id).toBeTruthy();
    }
    expect(announcements[0]).toContain('Service is unavailable');
    expect(announcements[1]).toContain('W05');
    expect(announcements[2]).toContain('W06');
    expect(announcements[2]).toContain('W10');

    // 4. reducedMotion pauses pollen & flight pad II motion
    const blossom = world.root.getObjectByName('greenhouse-flower-blossom')!;
    const padGlyphs = world.root.getObjectByName('rooftop-flight-pad-ii-glyphs')!;
    const pollen = world.root.getObjectByName('greenhouse-flower-pollen-motes') as THREE.InstancedMesh;
    const padMotes = world.root.getObjectByName('rooftop-flight-pad-ii-motes') as THREE.InstancedMesh;

    const blossomRot0 = blossom.rotation.y;
    const glyphRot0 = padGlyphs.rotation.y;
    const pollenArr0 = Array.from(pollen.instanceMatrix.array);
    const padArr0 = Array.from(padMotes.instanceMatrix.array);

    world.variableUpdate(1.0, [-10, 20, 30], 'plaza', true);
    expect(blossom.rotation.y).toBe(blossomRot0);
    expect(padGlyphs.rotation.y).toBe(glyphRot0);
    expect(Array.from(pollen.instanceMatrix.array)).toEqual(pollenArr0);
    expect(Array.from(padMotes.instanceMatrix.array)).toEqual(padArr0);

    world.variableUpdate(1.0, [-10, 20, 30], 'plaza', false);
    expect(blossom.rotation.y).not.toBe(blossomRot0);
    expect(padGlyphs.rotation.y).not.toBe(glyphRot0);
    expect(Array.from(pollen.instanceMatrix.array)).not.toEqual(pollenArr0);
    expect(Array.from(padMotes.instanceMatrix.array)).not.toEqual(padArr0);

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('distinguishes Rotunda Flight Pad I from Rooftop Flight Pad II by elevation and launch speed', () => {
    expect(isOnFlightPad(FLIGHT_PAD_CENTER[0], FLIGHT_PAD_CENTER[2])).toBe(true);
    expect(isOnFlightPad(0, 0, FLIGHT_PAD_CENTER[1])).toBe(true);
    expect(isOnFlightPad(0, 0, ROOF_DECK_Y)).toBe(false);

    expect(isOnRooftopFlightPad(0, ROOF_DECK_Y, ROOF_FLIGHT_PAD_II_CENTER[2])).toBe(true);
    expect(isOnRooftopFlightPad(ROOF_FLIGHT_PAD_II_RADIUS - 0.1, ROOF_DECK_Y, ROOF_FLIGHT_PAD_II_CENTER[2])).toBe(true);
    expect(isOnRooftopFlightPad(0, 0.5, ROOF_FLIGHT_PAD_II_CENTER[2])).toBe(false);
    expect(isOnRooftopFlightPad(0, ROOF_DECK_Y, 0)).toBe(false);

    expect(ROOF_FLIGHT_PAD_II_LAUNCH_SPEED).toBeGreaterThan(FLIGHT_LAUNCH_SPEED);

    const input = { isDown: () => false, uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
    const world = new ExteriorWorld('low');
    const padIPlayer = new PlayerController(world.collision, input as never);
    padIPlayer.teleport([0, ROOF_DECK_Y, 54]);
    padIPlayer.enterFlight();

    const padIIPlayer = new PlayerController(world.collision, input as never);
    padIIPlayer.teleport([0, ROOF_DECK_Y, 54]);
    padIIPlayer.enterFlight(ROOF_FLIGHT_PAD_II_LAUNCH_SPEED);

    for (let i = 0; i < 60; i++) {
      padIPlayer.fixedUpdate(1 / 60);
      padIIPlayer.fixedUpdate(1 / 60);
    }
    expect(padIIPlayer.position.y).toBeGreaterThan(padIPlayer.position.y + 4);

    world.dispose();
  });

  it('keeps a running, repeatedly jumping visitor on the roof in every direction (rail colliders clear the jump apex)', () => {
    // Analytic apex v^2 / 2g with g = 22 m/s^2 is ~1.18 m; colliders must clear it with margin.
    expect(ROOF_RAIL_COLLIDER_HEIGHT).toBeGreaterThan((JUMP_SPEED * JUMP_SPEED) / (2 * 22) + 0.15);
    const world = new ExteriorWorld('low');
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -3 * Math.PI / 4]) {
      let jump = null as (() => void) | null;
      const input = {
        isDown: (action: string) => action === 'forward' || action === 'run',
        uiCaptured: false, touchMoveX: 0, touchMoveY: 0,
        on: (name: string, cb: () => void) => { if (name === 'jump') jump = cb; return () => undefined; },
      };
      const player = new PlayerController(world.collision, input as never);
      player.teleport([0, ROOF_DECK_Y, 30], yaw);
      let lowest = Infinity;
      for (let i = 0; i < 60 * 5; i++) {
        if (player.grounded) jump?.();
        player.fixedUpdate(1 / 60);
        lowest = Math.min(lowest, player.position.y);
      }
      expect(lowest, `yaw ${yaw.toFixed(2)}`).toBeGreaterThan(ROOF_DECK_Y - 1);
    }
    world.dispose();
  });
});
