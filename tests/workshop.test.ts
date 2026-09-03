import placementManifest from '../data/workshop-placements.json';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { INSTALLATION_PLACEMENTS } from '../src/world/installationPlacement';
import { PLACEMENT_BY_EXHIBIT, SANCTUARY_DIR, SANCTUARY_RAMP_FROM, place } from '../src/world/layout';
import { writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { validateWorkshopManifestForMuseum, validateWorkshopConservation } from '../src/workshop/conservation';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { WorkshopHistory } from '../src/workshop/history';
import { AuthorableSceneRegistry } from '../src/workshop/AuthorableSceneRegistry';
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
      position: [30.234567, 0, 42],
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

describe('Museum Workshop conservation', () => {
  const at = (position: readonly [number, number, number]): WorkshopPlacementManifest => ({
    schemaVersion: 1,
    objects: [{ ...sample.objects[0]!, position: [...position] as [number, number, number] }],
  });

  it('accepts an ordinary safe placement outside authoritative paths', () => {
    const result = validateWorkshopManifestForMuseum(at([30, 0, 42]));
    expect(result.ok).toBe(true);
  });

  it('accepts the browser journey safe placement after its position edit', () => {
    const result = validateWorkshopManifestForMuseum(at([12.5, 0, 134]));
    expect(result.ok).toBe(true);
  });

  it('constructs the two-object browser-authored manifest', () => {
    const first = { ...sample.objects[0]!, id: 'display-plinth-01', prefab: 'display-plinth' as const, label: 'Display plinth', position: [12.5, 0, 134] as [number, number, number] };
    const second = { ...first, id: 'display-plinth-02', label: 'Display plinth copy', position: [13.3, 0, 134.8] as [number, number, number] };
    const placements = new MuseumPlacements({ schemaVersion: 1, objects: [first, second] });
    expect(placements.objectCount).toBe(2);
    placements.dispose();
  });

  it('rejects the protected Rotunda circulation and names the rule', () => {
    const result = validateWorkshopConservation(at([10, 0, 0]));
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatchObject({
      placementId: 'bench-01',
      placementLabel: 'Bench 01',
      protectedArea: 'Rotunda circulation floor',
      rule: 'rotunda-circulation',
    });
  });

  it('rejects the Dexter Sanctuary access geometry', () => {
    const point = place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 10, 0, 0);
    const result = validateWorkshopConservation(at(point));
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('sanctuary-access');
  });

  it('rejects an exhibit interaction/read zone from authoritative placement data', () => {
    const spot = PLACEMENT_BY_EXHIBIT.get('E24')!.visitorSpot;
    const result = validateWorkshopConservation(at(spot));
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('exhibit-read-zone:E24');
  });

  it('rejects a source installation interaction/read zone from authoritative placement data', () => {
    const spot = INSTALLATION_PLACEMENTS[0]!.interactionPoint;
    const result = validateWorkshopConservation(at(spot));
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toMatch(/^source-installation-/);
  });

  it('rejects a manually corrupted source before constructing runtime objects', () => {
    const raw = at([10, 0, 0]);
    expect(validateWorkshopManifestForMuseum(raw).ok).toBe(false);
    expect(() => new MuseumPlacements(raw)).toThrow(/Rotunda circulation floor/);
  });

  it('rejects invalid saves without changing the target bytes and accepts a valid save', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-'));
    const target = join(directory, 'workshop-placements.json');
    const original = '{"schemaVersion":1,"objects":[]}\n';
    try {
      await writeFile(target, original, 'utf8');
      const rejected = await writeWorkshopManifest(at([10, 0, 0]), target);
      expect(rejected.ok).toBe(false);
      expect(rejected.violations?.[0]).toMatchObject({
        placementId: 'bench-01',
        protectedArea: 'Rotunda circulation floor',
        rule: 'rotunda-circulation',
      });
      expect(await readFile(target, 'utf8')).toBe(original);

      const rejectedScene = await writeWorkshopManifest({
        schemaVersion: 1,
        objects: [],
        sceneOverrides: [{ id: 'rotunda-information-counter', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
      }, target);
      expect(rejectedScene.ok).toBe(false);
      expect(rejectedScene.violations?.[0]?.placementId).toBe('rotunda-information-counter');
      expect(await readFile(target, 'utf8')).toBe(original);

      const accepted = await writeWorkshopManifest(at([30, 0, 42]), target);
      expect(accepted.ok).toBe(true);
      expect(await readFile(target, 'utf8')).toBe(serializeWorkshopManifest(at([30, 0, 42])));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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

  it('applies existing-scene overrides through the explicit registry', () => {
    const root = new THREE.Group();
    const registry = new AuthorableSceneRegistry([{ id: 'arrival-garden-shrub-01', root }]);
    const placements = new MuseumPlacements({
      schemaVersion: 1,
      objects: [],
      sceneOverrides: [{ id: 'arrival-garden-shrub-01', position: [30, 0, 42], rotation: [0, 0.2, 0], scale: [1, 1, 1] }],
    }, registry);
    expect(root.position.toArray()).toEqual([30, 0, 42]);
    expect(placements.captureManifest().sceneOverrides?.[0]?.rotation[1]).toBe(0.2);
    root.position.x = 31;
    expect(placements.captureManifest().sceneOverrides?.[0]?.position[0]).toBe(31);
    placements.setRecord(sample.objects[0]!);
    expect(placements.captureManifest().sceneOverrides?.[0]?.position[0]).toBe(31);
    placements.dispose();
  });

  it('rejects an existing-scene override that enters protected circulation', () => {
    const result = validateWorkshopManifestForMuseum({
      schemaVersion: 1,
      objects: [],
      sceneOverrides: [{ id: 'rotunda-information-counter', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('rotunda-information-counter');
    expect(result.errors[0]).toContain('Rotunda flight-pad operating area');
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
    expect(history.undo()?.manifest.objects[0]?.position[0]).toBeCloseTo(30.2346);
    expect(history.redo()?.manifest.objects[0]?.position[0]).toBe(5);
  });
});
