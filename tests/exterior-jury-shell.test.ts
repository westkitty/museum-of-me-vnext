import { describe, expect, it, vi } from 'vitest';

// Replays the island path layout from before the 2026-11-12 reroute, in which
// paths 1, 2, 3 and 5 crossed the museum shell. The jury must still refuse it.
vi.mock('../src/world/exterior/IslandSiteLayout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/world/exterior/IslandSiteLayout')>();
  return { ...actual, PATH_CENTERLINES: [
    [[0, 184], [18, 165], [42, 146], [50, 118], [44, 86], [36, 54]],
    [[36, 54], [46, 38], [47, 22], [46, 4], [43, -16], [36, -38], [10, -70]],
    [[10, -70], [-23, -85], [-59, -83], [-84, -68], [-104, -48]],
    [[-104, -60], [-133, -25], [-145, 8], [-133, 43], [-100, 70], [-62, 82]],
    [[-62, 82], [-22, 92], [20, 83], [48, 59], [36, 54]],
  ] };
});

const { buildMuseumSceneIndex } = await import('../src/workshop/SceneIndex');
const { exteriorJury } = await import('../src/workshop/VisitorJury');
const { ExteriorWorld } = await import('../src/world/exterior/ExteriorWorld');

describe('Virtual Visitor Jury — exterior, legacy path layout', () => {
  it('fails every path that runs through the museum, naming an exterior collider, and passes the one that does not', () => {
    const world = new ExteriorWorld('low');
    const m = { schemaVersion: 2 as const, objects: [] };
    const report = exteriorJury(buildMuseumSceneIndex(m, { exterior: world.collision }), m, world.collision);
    const status = Object.fromEntries(report.routes.map((route) => [route.id, route.status]));
    expect(status).toMatchObject({ 'exterior:arrival': 'PASS', 'exterior:pier': 'PASS', 'exterior:path-4': 'PASS' });
    for (const id of ['exterior:path-2', 'exterior:path-3', 'exterior:path-5']) {
      const route = report.routes.find((item) => item.id === id)!;
      expect(route.status).toBe('FAIL');
      expect(route.affected.some((item) => item.kind === 'collider' && /exterior collider/.test(item.label))).toBe(true);
    }
    expect(report.status).toBe('FAIL');
  });
});
