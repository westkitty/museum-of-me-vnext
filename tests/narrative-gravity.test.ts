import { describe, expect, it } from 'vitest';
import { buildMuseumSceneIndex, type SceneIndexRuntime } from '../src/workshop/SceneIndex';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import { latestDecision, setLocked } from '../src/workshop/CuratorMemory';
import {
  NARRATIVE_GRAVITY_PILOTS, applyGravitySuggestions, narrativeGravity, rejectGravitySuggestion, type NarrativeGravityPilot,
} from '../src/workshop/NarrativeGravity';
import { validateWorkshopManifest, type WorkshopPlacementManifest, type WorkshopPlacementRecord, type WorkshopVec3 } from '../src/workshop/schema';
import { PLACEMENTS } from '../src/world/layout';
import { buildMuseum } from './helpers/walk';

/** Each record is a 0.8 m wide, 1.8 m tall box standing at its position; `unknown` ids have no bounds yet. */
function runtime(manifest: WorkshopPlacementManifest, unknown: readonly string[] = []): SceneIndexRuntime {
  const byId = new Map(manifest.objects.map((record) => [record.id, record]));
  return { placements: {
    isResident: () => true,
    sceneEntries: () => [],
    placementBounds: (id) => {
      const record = byId.get(id);
      if (!record || unknown.includes(id)) return null;
      const [x, y, z] = record.position;
      return { min: { x: x - 0.4, y, z: z - 0.4 }, max: { x: x + 0.4, y: y + 1.8, z: z + 0.4 } };
    },
  } };
}
const object = (id: string, position: WorkshopVec3): WorkshopPlacementRecord => ({
  id, label: id, prefab: 'sculpture-sphere', anchor: 'floor', position, rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'interior',
});
const manifest = (...objects: WorkshopPlacementRecord[]): WorkshopPlacementManifest => ({ schemaVersion: 2, objects });
const museum = buildMuseum();
const gravity = (m: WorkshopPlacementManifest, exhibit: NarrativeGravityPilot, unknown: readonly string[] = []) =>
  narrativeGravity(buildMuseumSceneIndex(m, { interior: museum.collision }, runtime(m, unknown)), m, exhibit);

/** A point part-way along the canonical view from the visitor position to the hero. */
function onSightline(exhibit: NarrativeGravityPilot, t = 0.5): WorkshopVec3 {
  const bay = PLACEMENTS.find((placement) => placement.exhibitId === exhibit)!;
  const lerp = (k: 0 | 2) => bay.visitorSpot[k] + (bay.anchor[k] - bay.visitorSpot[k]) * t;
  return [lerp(0), bay.anchor[1], lerp(2)];
}

describe('Narrative Gravity', () => {
  it('returns NO CHANGE for both pilots as built, proposing nothing and naming what it preserves', () => {
    expect([...NARRATIVE_GRAVITY_PILOTS]).toEqual(['E03', 'E13']);
    for (const exhibit of NARRATIVE_GRAVITY_PILOTS) {
      const report = gravity(manifest(), exhibit);
      expect(report.verdict).toBe('NO CHANGE');
      expect(report.suggestions).toEqual([]);
      expect(report.competing).toEqual([]);
      expect(report.sightline.blockers).toEqual([]);
      expect(report.preserved.join(' ')).toContain(`${exhibit} hero object`);
    }
  });

  it('ignores placements outside the pilot bay', () => {
    const elsewhere = PLACEMENTS.find((placement) => placement.exhibitId === 'E30')!;
    const m = manifest(object('far-plinth', [elsewhere.anchor[0], elsewhere.anchor[1], elsewhere.anchor[2]]));
    expect(gravity(m, 'E03').verdict).toBe('NO CHANGE');
    expect(gravity(m, 'E13').verdict).toBe('NO CHANGE');
  });

  it.each(NARRATIVE_GRAVITY_PILOTS)('moves a sightline blocker in %s sideways to a conservation-safe spot, and only on approval', (exhibit) => {
    const bay = PLACEMENTS.find((placement) => placement.exhibitId === exhibit)!;
    const m = manifest(object('blocker', onSightline(exhibit)));
    // The blocker is exactly what conservation forbids: the visitor's read zone.
    expect(validateWorkshopManifestForMuseum(m, []).errors.join(' ')).toContain(`${exhibit} interaction/read zone`);
    const report = gravity(m, exhibit);
    expect(report.verdict).toBe('SUGGESTIONS');
    expect(report.sightline.blockers).toEqual(['blocker']);
    expect(report.suggestions).toHaveLength(1);
    const [suggestion] = report.suggestions;
    // Same floor, inside its own bay, and the distance to the hero is unchanged (a sideways move).
    expect(suggestion.to[1]).toBe(suggestion.from[1]);
    const { c, h } = bay.bounds;
    expect(Math.abs(suggestion.to[0] - c[0])).toBeLessThan(h[0]);
    expect(Math.abs(suggestion.to[2] - c[2])).toBeLessThan(h[2]);

    // Nothing changes until the curator approves.
    expect(applyGravitySuggestions(m, report.suggestions, new Set())).toEqual(m);
    const approved = applyGravitySuggestions(m, report.suggestions, new Set(['blocker']), new Date('2026-11-12T00:00:00Z'));
    expect(approved.objects[0].position).toEqual(suggestion.to);
    expect(validateWorkshopManifest(approved).ok).toBe(true);
    expect(validateWorkshopManifestForMuseum(approved, []).ok).toBe(true);
    expect(latestDecision(approved, 'gravity-move', 'blocker')?.outcome).toBe('approved');
    expect(gravity(approved, exhibit).verdict).toBe('NO CHANGE');
  });

  it('respects rejection and locks: the blocker stays, reported for review, with the reason', () => {
    const m = manifest(object('blocker', onSightline('E03', 0.4)));
    const [suggestion] = gravity(m, 'E03').suggestions;
    const rejected = rejectGravitySuggestion(m, suggestion, new Date('2026-11-12T00:00:00Z'));
    expect(rejected.objects).toEqual(m.objects);
    const afterReject = gravity(rejected, 'E03');
    expect(afterReject.verdict).toBe('REVIEW');
    expect(afterReject.suggestions).toEqual([]);
    expect(afterReject.unresolved[0].reason).toContain('rejected by the curator');

    const locked = gravity(setLocked(m, 'blocker', true), 'E03');
    expect(locked.verdict).toBe('REVIEW');
    expect(locked.unresolved[0].reason).toContain('Locked');
  });

  it('does not guess when bounds are unknown', () => {
    const m = manifest(object('blocker', onSightline('E13')));
    const report = gravity(m, 'E13', ['blocker']);
    expect(report.suggestions).toEqual([]);
    expect(report.unresolved[0].reason).toContain('not yet known');
    expect(report.verdict).toBe('UNKNOWN');
  });
});
