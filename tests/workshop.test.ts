import placementManifest from '../data/workshop-placements.json';
import { describe, expect, it } from 'vitest';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { WorkshopHistory } from '../src/workshop/history';
import {
  EMPTY_WORKSHOP_MANIFEST,
  serializeWorkshopManifest,
  validateWorkshopManifest,
  type WorkshopPlacementManifest,
} from '../src/workshop/schema';

const sample: WorkshopPlacementManifest = {
  schemaVersion: 1,
  objects: [
    {
      id: 'bench-01',
      label: 'Bench 01',
      prefab: 'museum-bench',
      anchor: 'floor',
      position: [1.234567, 0, -2],
      rotation: [0, 0.5, 0],
      scale: [1, 1, 1],
    },
  ],
};

describe('Museum Workshop schema', () => {
  it('keeps the checked-in build placement manifest valid', () => {
    expect(validateWorkshopManifest(placementManifest).ok).toBe(true);
  });

  it('accepts the empty canonical manifest', () => {
    const result = validateWorkshopManifest(EMPTY_WORKSHOP_MANIFEST);
    expect(result.ok).toBe(true);
    expect(result.value?.objects).toHaveLength(0);
  });

  it('rejects duplicate ids, unsupported prefabs and invalid scales', () => {
    const result = validateWorkshopManifest({
      schemaVersion: 1,
      objects: [
        sample.objects[0],
        { ...sample.objects[0], prefab: 'not-real' },
        { ...sample.objects[0], id: 'tiny', scale: [0, 1, 1] },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/duplicate|prefab|scale/i);
  });

  it('serializes deterministically and rounds transform noise', () => {
    const text = serializeWorkshopManifest({
      schemaVersion: 1,
      objects: [
        { ...sample.objects[0], id: 'z-last' },
        { ...sample.objects[0], id: 'a-first', position: [1.234567, -0, 3] },
      ],
    });
    expect(text.indexOf('a-first')).toBeLessThan(text.indexOf('z-last'));
    expect(text).toContain('1.2346');
    expect(text).not.toContain('-0');
  });
});

describe('MuseumPlacements', () => {
  it('builds authorable roots and captures transformed values', () => {
    const placements = new MuseumPlacements(sample);
    expect(placements.objectCount).toBe(1);
    const object = placements.getObject('bench-01');
    expect(object).not.toBeNull();
    object!.position.x = 9.5;
    const captured = placements.captureManifest();
    expect(captured.objects[0]?.position[0]).toBe(9.5);
    placements.dispose();
  });

  it('replaces, removes and releases placement objects deterministically', () => {
    const placements = new MuseumPlacements(sample);
    placements.removeRecord('bench-01');
    expect(placements.objectCount).toBe(0);
    placements.replaceManifest(sample);
    expect(placements.objectCount).toBe(1);
    placements.dispose();
  });
});

describe('WorkshopHistory', () => {
  it('treats one edit as one undo/redo command', () => {
    const history = new WorkshopHistory();
    const after: WorkshopPlacementManifest = {
      schemaVersion: 1,
      objects: [{ ...sample.objects[0], position: [5, 0, 0] }],
    };
    expect(history.push('Move Bench 01', sample, after)).toBe(true);
    expect(history.undo()?.manifest.objects[0]?.position[0]).toBeCloseTo(1.2346);
    expect(history.redo()?.manifest.objects[0]?.position[0]).toBe(5);
  });
});
