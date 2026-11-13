import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { addEmptyRegion, latestDecision, recordDecision, removeEmptyRegion, setLocked } from '../src/workshop/CuratorMemory';
import { WorkshopHistory } from '../src/workshop/history';
import {
  downgradeWorkshopManifestToV1, validateWorkshopManifest, type WorkshopPlacementManifest, type WorkshopPlacementRecord,
} from '../src/workshop/schema';

const record = (id: string, x = 250): WorkshopPlacementRecord => ({ id, label: id, prefab: 'sculpture-sphere', anchor: 'floor',
  position: [x, 0, 250], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior' });
const base: WorkshopPlacementManifest = { schemaVersion: 2, objects: [record('bench-a'), record('bench-b', 254)] };
const remembered = () => addEmptyRegion(
  recordDecision(setLocked(base, 'bench-a', true), { kind: 'walkway-move', objectId: 'bench-b', outcome: 'rejected',
    position: [254, 0, 250], at: new Date('2026-11-12T10:00:00Z') }),
  { id: 'quiet-corner', label: 'Quiet corner', worldId: 'exterior', min: [260, 260], max: [264, 264] });

describe("Curator's Memory", () => {
  it('validates, canonicalizes and round-trips through the schema', () => {
    const parsed = validateWorkshopManifest(JSON.parse(JSON.stringify(remembered())));
    expect(parsed.errors).toEqual([]);
    expect(parsed.value?.curator).toEqual({
      locks: ['bench-a'],
      decisions: [{ kind: 'walkway-move', objectId: 'bench-b', outcome: 'rejected', at: '2026-11-12T10:00:00.000Z', position: [254, 0, 250] }],
      emptyRegions: [{ id: 'quiet-corner', label: 'Quiet corner', worldId: 'exterior', min: [260, 260], max: [264, 264] }],
    });
  });

  it('rejects malformed memory instead of discarding it', () => {
    const bad = (curator: unknown) => validateWorkshopManifest({ ...base, curator }).ok;
    expect(bad({ locks: ['missing'], decisions: [], emptyRegions: [] })).toBe(false);
    expect(bad({ locks: [], decisions: [{ kind: 'walkway-move', objectId: 'bench-a', outcome: 'maybe', at: '2026-11-12T10:00:00Z', position: [0, 0, 0] }], emptyRegions: [] })).toBe(false);
    expect(bad({ locks: [], decisions: [], emptyRegions: [{ id: 'r', label: 'x', worldId: 'interior', min: [2, 2], max: [1, 3] }] })).toBe(false);
    expect(bad({ locks: [], decisions: [], emptyRegions: [], extra: true })).toBe(false);
    expect(validateWorkshopManifest({ schemaVersion: 1, objects: [record('bench-a')], curator: { locks: [], decisions: [], emptyRegions: [] } }).ok).toBe(false);
  });

  it('keeps one current decision per object and kind', () => {
    const first = recordDecision(base, { kind: 'walkway-move', objectId: 'bench-b', outcome: 'rejected', position: [254, 0, 250] });
    const second = recordDecision(first, { kind: 'walkway-move', objectId: 'bench-b', outcome: 'approved', position: [255, 0, 250] });
    expect(second.curator?.decisions).toHaveLength(1);
    expect(latestDecision(second, 'walkway-move', 'bench-b')?.outcome).toBe('approved');
    expect(removeEmptyRegion(remembered(), 'quiet-corner').curator?.emptyRegions).toEqual([]);
  });

  it('refuses a v1 downgrade that would discard memory', () => {
    const result = downgradeWorkshopManifestToV1(validateWorkshopManifest(remembered()).value!);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("Curator's Memory");
  });

  it('survives placement edits, drops only the lock of a deleted object, and undoes with history', () => {
    const placements = new MuseumPlacements(remembered());
    placements.setRecord({ ...record('bench-b', 255) });
    expect(placements.captureManifest().curator?.locks).toEqual(['bench-a']);
    const before = placements.captureManifest();
    const after = placements.removeRecord('bench-a');
    expect(after.curator?.locks).toEqual([]);
    expect(after.curator?.decisions).toHaveLength(1);
    expect(after.curator?.emptyRegions).toHaveLength(1);
    const history = new WorkshopHistory();
    history.push('Delete bench-a', before, after);
    expect(history.undo()?.manifest.curator?.locks).toEqual(['bench-a']);
    placements.dispose();
  });

  it('persists through the real local save path and reloads intact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-curator-'));
    const target = join(directory, 'workshop-placements.json');
    try {
      await writeFile(target, '{"schemaVersion":1,"objects":[]}\n');
      const saved = await writeWorkshopManifest(remembered(), target);
      expect(saved.errors ?? []).toEqual([]);
      const reloaded = validateWorkshopManifest(JSON.parse(await readFile(target, 'utf8')));
      expect(reloaded.value?.curator).toEqual(validateWorkshopManifest(remembered()).value?.curator);
      // Repeated loads see the same intent.
      const placements = new MuseumPlacements(reloaded.value);
      expect(placements.captureManifest().curator).toEqual(reloaded.value?.curator);
      placements.dispose();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
