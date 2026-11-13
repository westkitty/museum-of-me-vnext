import { describe, expect, it } from 'vitest';
import { museumHealth } from '../src/workshop/MuseumHealth';
import { buildMuseumSceneIndex } from '../src/workshop/SceneIndex';
import { exteriorJury, exteriorJuryAffected } from '../src/workshop/VisitorJury';
import type { WorkshopPlacementManifest, WorkshopPlacementRecord } from '../src/workshop/schema';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import { LAND_SUPPORT_Y, PATH_CENTERLINES, PIER_CENTERLINE } from '../src/world/exterior/IslandSiteLayout';

const world = new ExteriorWorld('low');
const manifest = (...objects: WorkshopPlacementRecord[]): WorkshopPlacementManifest => ({ schemaVersion: 2, objects });
const run = (m: WorkshopPlacementManifest) => exteriorJury(buildMuseumSceneIndex(m, { exterior: world.collision }), m, world.collision);
const route = (report: ReturnType<typeof run>, id: string) => report.routes.find((item) => item.id === id)!;
/** The museum shell's long east and west outer walls in the exterior world (x = ±37.2–38.8, z = −98…98). */
const isShellWall = (position: readonly number[] | null | undefined) => Boolean(position && Math.abs(Math.abs(position[0]) - 38) < 1 && Math.abs(position[2]) < 1);

describe('Virtual Visitor Jury — exterior', () => {
  const clean = run(manifest());

  it('walks the arrival from the pier to the museum door and back, and the whole pier', () => {
    expect(route(clean, 'exterior:arrival').status).toBe('PASS');
    expect(route(clean, 'exterior:pier').status).toBe('PASS');
    expect(clean.routes).toHaveLength(2 + PATH_CENTERLINES.length);
    expect(clean.walked.legs).toBeGreaterThan(20);
    expect(clean.walked.metres).toBeGreaterThan(500);
  });

  it('reports island paths that run through the museum building, naming its shell wall, and never hides them', () => {
    // The authored path ribbons pass inside the building footprint (e.g. the junction at
    // (36, 54) is inside the east wall); the visitor cannot follow them there.
    const paths = clean.routes.filter((item) => item.id.startsWith('exterior:path-'));
    for (const path of paths) {
      if (path.status === 'PASS') continue;
      expect(path.status).toBe('FAIL');
      expect(path.affected.length).toBeGreaterThan(0);
      expect(path.affected.some((item) => item.kind === 'collider' && (isShellWall(item.position) || /exterior collider/.test(item.label)))).toBe(true);
    }
    expect(clean.status).toBe(paths.some((item) => item.status === 'FAIL') ? 'FAIL' : 'PASS');
    expect(clean.summary).toContain('exterior routes');
  });

  it('fails the arrival and names a solid placement blocking the pier', () => {
    const [x, z] = PIER_CENTERLINE[1];
    const blocker: WorkshopPlacementRecord = { id: 'pier-gate', label: 'Pier gate', prefab: 'partition-wall', anchor: 'floor',
      position: [x, LAND_SUPPORT_Y, z], rotation: [0, 0, 0], scale: [3, 1, 1], worldId: 'exterior', collision: 'solid' };
    const report = run(manifest(blocker));
    const arrival = route(report, 'exterior:arrival');
    expect(arrival.status).toBe('FAIL');
    expect(arrival.affected.map((item) => item.id)).toContain('pier-gate');
    expect(exteriorJuryAffected(report).map((item) => item.id)).toContain('pier-gate');
    // An interior placement never blocks the exterior.
    expect(route(run(manifest({ ...blocker, worldId: 'interior' })), 'exterior:arrival').status).toBe('PASS');
  });

  it('is NOT TESTED without an exterior world, and Museum Health keeps it separate from the interior jury', () => {
    const m = manifest();
    const none = exteriorJury(buildMuseumSceneIndex(m), m, null);
    expect(none.status).toBe('NOT TESTED');
    expect(none.routes.every((item) => item.status === 'NOT TESTED')).toBe(true);
    const index = buildMuseumSceneIndex(m, { exterior: world.collision });
    expect(museumHealth(index, m).checks.find((check) => check.id === 'exterior-jury')!.status).toBe('NOT TESTED');
    const fed = museumHealth(index, m, { exteriorJury: clean }).checks.find((check) => check.id === 'exterior-jury')!;
    expect(fed.status).toBe(clean.status);
    expect(fed.affected.every((subject) => subject.world === 'exterior')).toBe(true);
  });
});
