import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { COLLECTION, EXHIBITS_BY_ID, projectsForExhibit } from '../src/content/collection.generated';
import { PROJECT_STAGE_LABEL, projectNameWithStage, projectStage } from '../src/content/projectStage';
import { DeterministicMuseumGuide, type GuideLocation } from '../src/guide/DeterministicMuseumGuide';
import { Journal } from '../src/state/Journal';
import { relatedExhibits, stageSummary } from '../src/ui/ExhibitReading';
import { Detailing } from '../src/world/Detailing';
import { EnvironmentDressing, alongClearOfBayOpenings, BAY_OPENING_CLEARANCE } from '../src/world/EnvironmentDressing';
import {
  GROUND_Y, LEVEL_1_Y, PLACEMENTS, ROTUNDA_APOTHEM, STAIRS, WINGS, faceDirection, isOverStairOpening,
  stairArrivalFace, stairLanding,
} from '../src/world/layout';
import { PaletteSet } from '../src/world/palette';
import { BALCONY_WALK_FACES } from '../src/world/route';
import { planVisitorRoute } from '../src/world/visitorRoute';
import { buildMuseum } from './helpers/walk';

/**
 * Continuity uplift, 2026-11-20. Each block names the repair (D…) or
 * improvement (I…) it guards; see docs/CONTINUITY_UPLIFT_2026-11-20.md.
 */

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => { map.delete(key); },
    setItem: (key, value) => { map.set(key, String(value)); },
  };
}

describe('D03 grand stairs rise into open, railed wells', () => {
  const built = buildMuseum();

  it('lands each flight on the walkable balcony arc, not inside the cut-off south pocket', () => {
    for (const stair of STAIRS) {
      expect(BALCONY_WALK_FACES).toContain(stairArrivalFace(stair));
      const landing = stairLanding(stair);
      expect(isOverStairOpening(landing[0], landing[2])).toBe(false);
      expect(built.collision.supportHeight(landing[0], landing[2], LEVEL_1_Y)).toBe(LEVEL_1_Y);
    }
  });

  it('seals the well from the balcony pocket side: hugging the balustrade never squeezes a visitor into it', () => {
    for (const stair of STAIRS) {
      const d = faceDirection(stair.face);
      const span = stair.endAngle - stair.startAngle;
      const angle0 = Math.atan2(d[2], d[0]) + stair.startAngle + span * 0.45;
      const p = { x: Math.cos(angle0) * 11.65, y: LEVEL_1_Y, z: Math.sin(angle0) * 11.65 };
      for (let i = 0; i < 60; i++) {
        const a = Math.atan2(p.z, p.x) + Math.sign(span) * 0.02;
        p.x = Math.cos(a) * 11.65;
        p.z = Math.sin(a) * 11.65;
        built.collision.resolveHorizontal(p, 0.35, 1.78);
        expect(isOverStairOpening(p.x, p.z), `${stair.id} step ${i}`).toBe(false);
      }
    }
  });

  it('routes the guide down from an upper bay by the stairs, never across a well', () => {
    const from = PLACEMENTS.find((placement) => placement.exhibitId === 'E14')!.visitorSpot;
    const route = planVisitorRoute('interior', from, 'E27', built.collision);
    expect(route.length).toBeGreaterThan(4);
    for (let i = 1; i < route.length; i++) {
      const [ax, ay, az] = route[i - 1];
      const [bx, by, bz] = route[i];
      for (let t = 0; t <= 1; t += 0.05) {
        const y = ay + (by - ay) * t;
        if (y < LEVEL_1_Y - 0.01) continue;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        expect(isOverStairOpening(x, z) && Math.abs(y - LEVEL_1_Y) < 0.01, `leg ${i} crosses a well at balcony height`).toBe(false);
      }
    }
    expect(route[route.length - 1][1]).toBe(GROUND_Y);
  });
});

describe('D06 hall planting stays out of bay openings', () => {
  it('keeps every hall plant and pedestal clear of every doorway', () => {
    const scope = new ResourceScope('uplift-test');
    const dressing = new EnvironmentDressing(scope).build();
    dressing.updateMatrixWorld(true);
    const items: THREE.Vector3[] = [];
    dressing.traverse((node) => {
      if (node.name === 'indoor-plant' || node.name === 'hall-pedestal') items.push(node.getWorldPosition(new THREE.Vector3()));
    });
    expect(items.length).toBeGreaterThan(20);
    for (const placement of PLACEMENTS) {
      for (const item of items) {
        if (Math.abs(item.y - placement.doorway[1]) > 1.5) continue;
        const gap = Math.hypot(item.x - placement.doorway[0], item.z - placement.doorway[2]);
        expect(gap, `${placement.exhibitId} doorway vs dressing at ${item.toArray().map((v) => v.toFixed(1))}`).toBeGreaterThan(2.5);
      }
    }
    scope.dispose();
  });

  it('finds a wall position on the requested side for every hall', () => {
    for (const wing of WINGS) {
      for (const side of [-1, 1] as const) {
        const along = alongClearOfBayOpenings(wing, wing.hallFrom + wing.bayLead, side);
        const openings = PLACEMENTS.filter((p) => p.wing === wing.id && (p.side === 'right' ? 1 : -1) === side)
          .map((p) => wing.hallFrom + wing.bayLead + p.slot * wing.bayPitch);
        for (const centre of openings) expect(Math.abs(along - centre)).toBeGreaterThanOrEqual(wing.bayOpening / 2 + BAY_OPENING_CLEARANCE - 1e-9);
      }
    }
  });
});

describe('I2 physical stair signage (I3 hall-end signs removed by owner)', () => {
  it('signs both stair feet and both balcony landings, and puts no sign on a dead-end hall wall', () => {
    const scope = new ResourceScope('uplift-test');
    const palettes = new PaletteSet(scope);
    const parents = new Map<string, THREE.Group>();
    for (const id of ['rotunda', 'balcony', 'sanctuary', 'entrance-detail', ...WINGS.map((wing) => wing.id)]) parents.set(id, new THREE.Group());
    new Detailing(scope, palettes).applyAll(parents);
    const signs = new Map<string, THREE.Object3D>();
    for (const parent of parents.values()) parent.traverse((node) => {
      if (node.name.startsWith('stair-sign:') || node.name.startsWith('hall-return-sign:')) signs.set(node.name, node);
    });
    for (const stair of STAIRS) {
      const foot = signs.get(`stair-sign:${stair.id}:foot`)!;
      const landing = signs.get(`stair-sign:${stair.id}:landing`)!;
      expect(foot.position.y).toBeGreaterThan(GROUND_Y + 2.4);
      expect(foot.position.y).toBeLessThan(LEVEL_1_Y - 1);
      expect(landing.position.y).toBeGreaterThan(LEVEL_1_Y + 2);
      for (const sign of [foot, landing]) {
        // Mounted just inside the rotunda wall, facing the centre.
        expect(Math.hypot(sign.position.x, sign.position.z)).toBeLessThan(ROTUNDA_APOTHEM);
        const normal = new THREE.Vector3(0, 0, 1).applyEuler(sign.rotation);
        expect(normal.x * sign.position.x + normal.z * sign.position.z).toBeLessThan(0);
      }
    }
    // The dead-end "Back to the Rotunda" wall signs were removed at the
    // owner's request: on the far wall they read as a walled-off exit.
    expect([...signs.keys()].filter((name) => name.startsWith('hall-return-sign:'))).toEqual([]);
    scope.dispose();
  });
});

describe('I12/I21 project lifecycle stages', () => {
  it('classifies every current project status without rewriting it', () => {
    for (const project of COLLECTION.projects) {
      expect(projectStage(project.status), `${project.id}: ${project.status}`).not.toBeNull();
    }
    expect(projectStage('Superseded; absorbed into WorldsVault')).toBe('superseded');
    expect(projectStage('Active; paused between productions')).toBe('paused');
    expect(projectStage('Completed prototype; next phase planned')).toBe('completed');
    expect(projectStage('Experimental / paused')).toBe('paused');
    expect(projectStage('Abandoned')).toBe('abandoned');
    expect(projectStage('Active foundation')).toBe('active');
  });

  it('marks only non-active projects in index lists and summarises lineage rooms', () => {
    const superseded = COLLECTION.projects.find((project) => projectStage(project.status) === 'superseded')!;
    expect(projectNameWithStage(superseded)).toBe(`${superseded.name} (superseded)`);
    const active = COLLECTION.projects.find((project) => projectStage(project.status) === 'active')!;
    expect(projectNameWithStage(active)).toBe(active.name);
    const lineage = COLLECTION.exhibits.find((exhibit) => projectsForExhibit(exhibit.id).length >= 3)!;
    const summary = stageSummary(lineage)!;
    const total = summary.split(' · ').reduce((sum, part) => sum + Number(part.split(' ')[0]), 0);
    expect(total).toBe(projectsForExhibit(lineage.id).length);
    expect(Object.values(PROJECT_STAGE_LABEL).some((label) => summary.includes(label.toLocaleLowerCase()))).toBe(true);
  });
});

describe('I13 related rooms come only from shared project families', () => {
  it('links the Starsilk / Drakken rooms to each other and never to themselves', () => {
    const e01 = EXHIBITS_BY_ID.get('E01')!;
    const related = relatedExhibits(e01);
    expect(related.length).toBeGreaterThan(0);
    for (const { exhibit, family } of related) {
      expect(exhibit.id).not.toBe('E01');
      expect(projectsForExhibit(exhibit.id).some((project) => project.family === family)).toBe(true);
      expect(projectsForExhibit('E01').some((project) => project.family === family)).toBe(true);
    }
  });
});

describe('I15/I16 DexGPT gives stair directions from where the visitor stands', () => {
  const guideAt = (position: GuideLocation['position']) => new DeterministicMuseumGuide(
    new Journal(memoryStorage()), undefined, () => ({ exhibitId: null, zoneLabel: 'Test', position }),
  );

  it('sends an upper-floor visitor to the nearer stair head', () => {
    const east = guideAt([20, LEVEL_1_Y, -20]).answer('How do I get downstairs?').text;
    expect(east).toMatch(/upper floor/);
    expect(east).toMatch(/east end is nearer/);
    const west = guideAt([-20, LEVEL_1_Y, -20]).answer('how do i get down').text;
    expect(west).toMatch(/west end is nearer/);
  });

  it('sends a ground-floor visitor to the stair feet and keeps the general answer without a position', () => {
    expect(guideAt([5, GROUND_Y, 30]).answer('How do I get upstairs?').text).toMatch(/ground floor.*south-east one is on your side/);
    expect(guideAt([-30, -5, -30]).answer('How do I get back to the Rotunda?').text).toMatch(/lower level/);
    expect(guideAt(null).answer('where are the stairs').text).toMatch(/Reliquary Rotunda is the bright, neutral hub/);
  });
});

describe('uplift2 #40 spoken location names the floor when it changes', () => {
  it('adds the floor only on a floor change', async () => {
    const { locationAnnouncement } = await import('../src/app/App');
    expect(locationAnnouncement('Rotunda Balcony', 'Upper floor', 'Ground floor')).toBe('Entering Rotunda Balcony, upper floor.');
    expect(locationAnnouncement('Local Systems', 'Upper floor', 'Upper floor')).toBe('Entering Local Systems.');
    expect(locationAnnouncement('Dexter Sanctuary', 'Lower level', null)).toBe('Entering Dexter Sanctuary, lower level.');
  });
});

describe('owner fixes 2026-11-20: sprint speed and collision during flight', () => {
  it('sprints at 2.5x the earlier 6.2 m/s', async () => {
    const { RUN_SPEED, WALK_SPEED } = await import('../src/player/PlayerController');
    expect(RUN_SPEED).toBeCloseTo(6.2 * 2.5, 6);
    expect(RUN_SPEED).toBeGreaterThan(WALK_SPEED);
  });

  it('a flying visitor is stopped by walls instead of passing through them', async () => {
    const { PlayerController, PLAYER_RADIUS } = await import('../src/player/PlayerController');
    const built = buildMuseum();
    const held = new Set<string>(['forward']);
    const input = { isDown: (action: string) => held.has(action), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
    const player = new PlayerController(built.collision, input as never);
    // Inside the north hall at head height, flying north at the dead-end wall
    // (the hall ends at z = -96).
    player.teleport([0, 3, -88], 0);
    player.enterFlight();
    for (let i = 0; i < 240; i++) player.fixedUpdate(1 / 60);
    expect(player.flightMode).toBe(true);
    expect(player.position.z).toBeGreaterThan(-96 + 0.4 - PLAYER_RADIUS);
  });
});

describe('entrance atrium (2026-11-20): larger inside, ticketed, lit on entry', () => {
  async function walker(built: ReturnType<typeof buildMuseum>, held: string[]) {
    const { PlayerController } = await import('../src/player/PlayerController');
    const keys = new Set<string>(held);
    const input = { isDown: (action: string) => keys.has(action), uiCaptured: false, touchMoveX: 0, touchMoveY: 0, on: () => () => undefined };
    return new PlayerController(built.collision, input as never);
  }

  it('walks from the atrium front door through the inner portal into the south hall', async () => {
    const { INTERIOR_ENTRY_POSITION } = await import('../src/world/layout');
    const built = buildMuseum();
    const player = await walker(built, ['forward']);
    player.teleport(INTERIOR_ENTRY_POSITION, 0);
    for (let i = 0; i < 60 * 20; i++) player.fixedUpdate(1 / 60);
    expect(player.position.z).toBeLessThan(110);
    expect(Math.abs(player.position.y - GROUND_Y)).toBeLessThan(0.05);
  });

  it('is enclosed: its side walls and fountain basins stop the visitor', async () => {
    const { ATRIUM_HALF_WIDTH } = await import('../src/world/layout');
    const built = buildMuseum();
    const right = await walker(built, ['right']);
    right.teleport([15, 0, 142], 0);
    for (let i = 0; i < 240; i++) right.fixedUpdate(1 / 60);
    expect(right.position.x).toBeLessThan(ATRIUM_HALF_WIDTH);
    // Toward the middle fountain on the east side (centre x = 8.5).
    const toFountain = await walker(built, ['right']);
    toFountain.teleport([3, 0, 146], 0);
    for (let i = 0; i < 240; i++) toFountain.fixedUpdate(1 / 60);
    expect(toFountain.position.x).toBeLessThan(8.5 - 1.85);
  });

  it('guides inside to the atrium front door, and plans routes from it', async () => {
    const { ATRIUM_DOOR, ENTRANCE_DOOR } = await import('../src/world/layout');
    const { guideDestination, MUSEUM_ENTRANCE_TARGET } = await import('../src/world/visitorRoute');
    expect(guideDestination('interior', MUSEUM_ENTRANCE_TARGET)).toEqual(ATRIUM_DOOR);
    expect(guideDestination('exterior', MUSEUM_ENTRANCE_TARGET)).toEqual(ENTRANCE_DOOR);
    const route = planVisitorRoute('interior', ATRIUM_DOOR, PLACEMENTS[0].exhibitId);
    expect(route.length).toBeGreaterThan(2);
  });

  it('waits dark and lights up in order once the visitor steps in', () => {
    const built = buildMuseum();
    const runner = built.root.getObjectByName('atrium-runner') as THREE.Mesh | undefined;
    const mat = runner?.material as THREE.MeshStandardMaterial | undefined;
    expect(mat).toBeDefined();
    if (!mat) return;
    const dark = mat.color.getHSL({ h: 0, s: 0, l: 0 }).l;
    built.museum.updateAtrium(1, false, false);
    expect(mat.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeCloseTo(dark, 6); // not in the atrium yet
    built.museum.updateAtrium(1, false, true);
    expect(mat.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeCloseTo(dark, 6); // the floor lights last
    for (let i = 0; i < 8; i++) built.museum.updateAtrium(1, false, true);
    expect(mat.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(dark * 4);
    built.museum.resetAtrium();
    expect(mat.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeCloseTo(dark, 6);
  });
});
