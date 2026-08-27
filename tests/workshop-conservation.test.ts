import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  appendWorkshopCheckpoint,
  createWorkshopCheckpoint,
  diffWorkshopManifests,
  readWorkshopLedger,
  readWorkshopManifestOrEmpty,
} from '../scripts/workshop-conservation-ledger';
import { WorkshopSpatialXRay } from '../src/workshop/WorkshopSpatialXRay';
import {
  WORKSHOP_SCHEMA_VERSION,
  serializeWorkshopManifest,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
} from '../src/workshop/schema';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function record(id: string, x: number): WorkshopPlacementRecord {
  return {
    id,
    label: id,
    prefab: 'museum-bench',
    anchor: 'floor',
    position: [x, 0, 40],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

function manifest(objects: readonly WorkshopPlacementRecord[]): WorkshopPlacementManifest {
  return { schemaVersion: WORKSHOP_SCHEMA_VERSION, objects };
}

describe('Workshop conservation ledger', () => {
  it('classifies added, removed and changed placement IDs deterministically', () => {
    const before = manifest([record('remove-me', 30), record('change-me', 32)]);
    const after = manifest([record('change-me', 33), record('add-me', 35)]);
    expect(diffWorkshopManifests(before, after)).toEqual({
      added: ['add-me'],
      removed: ['remove-me'],
      changed: ['change-me'],
    });
  });

  it('creates a PASS checkpoint with stable manifest fingerprints', () => {
    const before = manifest([]);
    const after = manifest([record('bench-one', 35)]);
    const checkpoint = createWorkshopCheckpoint(before, after, '2026-08-27T12:00:00.000Z');
    expect(checkpoint.conservation).toBe('PASS');
    expect(checkpoint.diff.added).toEqual(['bench-one']);
    expect(checkpoint.beforeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(checkpoint.afterHash).toMatch(/^[a-f0-9]{64}$/);
    expect(checkpoint.beforeHash).not.toBe(checkpoint.afterHash);
    expect(checkpoint.id).toContain(checkpoint.afterHash.slice(0, 10));
  });

  it('persists and rereads bounded checkpoints without mutating the placement source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'museum-conservation-'));
    tempRoots.push(root);
    const placementPath = join(root, 'workshop-placements.json');
    const ledgerPath = join(root, 'workshop-conservation-ledger.json');
    const before = manifest([]);
    const after = manifest([record('bench-one', 35)]);
    await writeFile(placementPath, serializeWorkshopManifest(after), 'utf8');

    const checkpoint = createWorkshopCheckpoint(before, after, '2026-08-27T12:00:00.000Z');
    await appendWorkshopCheckpoint(ledgerPath, checkpoint);

    const ledger = await readWorkshopLedger(ledgerPath);
    expect(ledger.checkpoints).toHaveLength(1);
    expect(ledger.checkpoints[0]?.afterHash).toBe(checkpoint.afterHash);
    expect(await readFile(placementPath, 'utf8')).toBe(serializeWorkshopManifest(after));
  });

  it('refuses to reinterpret a malformed existing placement source as empty history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'museum-conservation-invalid-'));
    tempRoots.push(root);
    const placementPath = join(root, 'workshop-placements.json');
    await writeFile(placementPath, '{"schemaVersion":1,"objects":"wrong"}', 'utf8');
    await expect(readWorkshopManifestOrEmpty(placementPath)).rejects.toThrow('Existing Workshop placement source is invalid');
  });
});

describe('Workshop Spatial X-Ray', () => {
  it('samples the existing conservation authority into separate protected/open clouds', () => {
    const scene = new THREE.Scene();
    const xray = new WorkshopSpatialXRay(scene);
    expect(xray.isEnabled).toBe(false);
    xray.setEnabled(true);
    expect(xray.isEnabled).toBe(true);
    expect(xray.group.visible).toBe(true);
    expect(xray.group.getObjectByName('workshop-xray-protected-space')).toBeInstanceOf(THREE.Points);
    expect(xray.group.getObjectByName('workshop-xray-open-space')).toBeInstanceOf(THREE.Points);
    expect(xray.summary).toMatch(/protected samples \/ .*open samples/);
    xray.dispose();
    expect(scene.getObjectByName('museum-workshop-spatial-xray')).toBeUndefined();
  });
});
