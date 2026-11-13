import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { validateWorkshopManifestForMuseum } from '../src/workshop/conservation';
import {
  WORKSHOP_MAX_OBJECTS,
  WORKSHOP_SCHEMA_VERSION,
  WORKSHOP_V1_MAX_OBJECTS,
  downgradeWorkshopManifestToV1,
  serializeWorkshopManifest,
  validateWorkshopManifest,
  type WorkshopPlacementRecord,
} from '../src/workshop/schema';

/** Records distributed over the exterior island, away from protected architecture. */
function distributed(count: number): WorkshopPlacementRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bulk-${String(index).padStart(4, '0')}`,
    label: `Bulk ${index}`,
    prefab: 'sculpture-sphere',
    anchor: 'floor',
    position: [200 + (index % 50) * 2, 0, 200 + Math.floor(index / 50) * 2] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: [1, 1, 1] as [number, number, number],
    worldId: 'exterior',
  }));
}

describe('Workshop placement schema migration', () => {
  it('accepts a version-1 manifest and migrates it to the current version without changing records', () => {
    const objects = distributed(3);
    const parsed = validateWorkshopManifest({ schemaVersion: 1, objects });
    expect(parsed.ok).toBe(true);
    expect(parsed.migratedFrom).toBe(1);
    expect(parsed.value?.schemaVersion).toBe(WORKSHOP_SCHEMA_VERSION);
    expect(parsed.value?.objects).toEqual(objects);
    const current = validateWorkshopManifest({ schemaVersion: 2, objects });
    expect(current.migratedFrom).toBeUndefined();
    expect(current.value).toEqual(parsed.value);
  });

  it('still enforces the version-1 cap on version-1 files and rejects unknown versions', () => {
    const tooMany = validateWorkshopManifest({ schemaVersion: 1, objects: distributed(WORKSHOP_V1_MAX_OBJECTS + 1) });
    expect(tooMany.ok).toBe(false);
    expect(tooMany.errors.join(' ')).toContain('at most 256 records in schema version 1');
    expect(validateWorkshopManifest({ schemaVersion: 3, objects: [] }).ok).toBe(false);
    expect(validateWorkshopManifest({ schemaVersion: 2, objects: distributed(WORKSHOP_MAX_OBJECTS + 1) }).ok).toBe(false);
  });

  it('holds 2,000 distributed placements through museum conservation and a byte-stable round trip', () => {
    const objects = distributed(2000);
    const parsed = validateWorkshopManifestForMuseum({ schemaVersion: 2, objects }, []);
    expect(parsed.errors).toEqual([]);
    expect(parsed.value?.objects).toHaveLength(2000);
    const text = serializeWorkshopManifest(parsed.value!);
    const again = validateWorkshopManifest(JSON.parse(text));
    expect(serializeWorkshopManifest(again.value!)).toBe(text);
  });

  it('downgrades a small manifest to exact version-1 text and refuses to truncate a large one', () => {
    const small = validateWorkshopManifest({ schemaVersion: 2, objects: distributed(4) }).value!;
    const rolledBack = downgradeWorkshopManifestToV1(small);
    expect(rolledBack.ok).toBe(true);
    const v1 = JSON.parse(rolledBack.text!);
    expect(v1.schemaVersion).toBe(1);
    expect(validateWorkshopManifest(v1).value).toEqual(small);

    const large = validateWorkshopManifest({ schemaVersion: 2, objects: distributed(300) }).value!;
    const refused = downgradeWorkshopManifestToV1(large);
    expect(refused.ok).toBe(false);
    expect(refused.text).toBeNull();
    expect(large.objects).toHaveLength(300);
  });

  it('saves 2,000 records over a version-1 file only after preserving the exact version-1 bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'museum-workshop-migrate-'));
    const target = join(directory, 'workshop-placements.json');
    const original = `${JSON.stringify({ schemaVersion: 1, objects: distributed(2) }, null, 2)}\n`;
    try {
      await writeFile(target, original);
      const revision = createHash('sha256').update(original).digest('hex');
      const manifest = { schemaVersion: 2, objects: distributed(2000) };
      const saved = await writeWorkshopManifest(manifest, target, revision);
      expect(saved.errors ?? []).toEqual([]);
      expect(saved.ok).toBe(true);
      const written = JSON.parse(await readFile(target, 'utf8'));
      expect(written.schemaVersion).toBe(2);
      expect(written.objects).toHaveLength(2000);
      const backups = await readdir(join(directory, '.workshop-backups'));
      expect(backups).toEqual([`${revision}.json`]);
      expect(await readFile(join(directory, '.workshop-backups', backups[0]), 'utf8')).toBe(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
