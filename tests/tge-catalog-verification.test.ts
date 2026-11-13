import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import index from '../src/workshop/catalog-data/tge-index.json';
import report from '../src/workshop/catalog-data/tge-verification.json';
import { classifySourceGlb, verifyTgeCatalog } from '../scripts/tge-catalog-verify';
import { hasValidLocalGLB, writeWorkshopManifest } from '../scripts/workshop-save-plugin';
import { filterSourceCatalog, sourceAvailability } from '../src/workshop/sourceCatalog';
import { validateWorkshopManifest } from '../src/workshop/schema';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';

const blob = (bytes: Buffer): string => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const glb = (doc: object): Buffer => {
  const json = Buffer.from(JSON.stringify(doc));
  const body = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + body.length, 8); header.writeUInt32LE(body.length, 12);
  header.write('JSON', 16);
  return Buffer.concat([header, body]);
};

describe('pinned source catalog verification', () => {
  it('classifies size, blob, extension and structure failures with the import validation', async () => {
    const fixture = await readFile('tests/fixtures/tge/blaster-a.glb');
    const model = index.models.find((entry) => entry.id === 'blaster-kit/blaster-a')!;
    expect(classifySourceGlb(model, fixture, hasValidLocalGLB).status).toBe('verified');
    expect(classifySourceGlb(model, fixture.subarray(0, -4), hasValidLocalGLB).status).toBe('size-mismatch');
    const altered = Buffer.from(fixture); altered[altered.length - 1] ^= 1;
    expect(classifySourceGlb(model, altered, hasValidLocalGLB).status).toBe('blob-mismatch');
    const unlit = glb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_materials_unlit', 'KHR_texture_transform'] });
    expect(classifySourceGlb({ bytes: unlit.length, gitBlob: blob(unlit) }, unlit, hasValidLocalGLB))
      .toMatchObject({ status: 'unsupported-extension', extensions: ['KHR_materials_unlit'] });
    const external = glb({ asset: { version: '2.0' }, buffers: [{ uri: 'https://example.invalid/a.bin' }] });
    expect(classifySourceGlb({ bytes: external.length, gitBlob: blob(external) }, external, hasValidLocalGLB).status).toBe('invalid-glb');
  });

  it('caches verified bytes, resumes offline and never marks a fetch failure as verified', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tge-verify-'));
    try {
      const fixture = await readFile('tests/fixtures/tge/blaster-a.glb');
      const thumb = await readFile('tests/fixtures/tge/blaster-a.webp');
      const urls: string[] = [];
      const online = (async (url: string | URL | Request) => {
        urls.push(String(url));
        if (String(url).endsWith('blaster-a.glb')) return new Response(new Uint8Array(fixture));
        if (String(url).endsWith('blaster-a.webp')) return new Response(new Uint8Array(thumb));
        return new Response('missing', { status: 404 });
      }) as typeof fetch;
      const ids = ['blaster-kit/blaster-a', 'blaster-kit/blaster-b'];
      const first = await verifyTgeCatalog({ root, validate: hasValidLocalGLB, request: online, retries: 0, ids });
      expect(urls.every((url) => url.startsWith(`https://raw.githubusercontent.com/Hidencod/tge-assets/${index.sourceRevision}/packs/`))).toBe(true);
      expect(first.verified).toEqual(['blaster-kit/blaster-a']);
      expect(first.rejected).toEqual([{ id: 'blaster-kit/blaster-b', status: 'fetch-failed', detail: 'HTTP 404' }]);
      expect(first.counts.unchecked).toBe(index.models.length - 2);
      expect(first.complete).toBe(false);
      expect(first.thumbnails).toMatchObject({ verified: 1, failed: 1, failedIds: ['blaster-kit/blaster-b'] });
      const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
      const resumed = await verifyTgeCatalog({ root, validate: hasValidLocalGLB, request: offline, retries: 0,
        ids: ['blaster-kit/blaster-a'] });
      expect(resumed.verified).toEqual(['blaster-kit/blaster-a']);
      expect(resumed.thumbnails.verified).toBe(1);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('commits a report that accounts for every pinned model exactly once', () => {
    expect(report.sourceRevision).toBe(index.sourceRevision);
    expect(report.catalogGitBlob).toBe(index.catalogGitBlob);
    expect(report.total).toBe(1883);
    const ids = [...report.verified, ...report.rejected.map((entry) => entry.id), ...report.unchecked];
    expect(ids).toHaveLength(1883);
    expect(new Set(ids)).toEqual(new Set(index.models.map((model) => model.id)));
    const counts = report.counts as Record<string, number>;
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1883);
    expect(counts.verified).toBe(report.verified.length);
    for (const status of ['size-mismatch', 'blob-mismatch', 'unsupported-extension', 'invalid-glb', 'fetch-failed']) {
      expect(counts[status]).toBe(report.rejected.filter((entry) => entry.status === status).length);
    }
    expect(report.complete).toBe(counts.unchecked === 0 && counts['fetch-failed'] === 0);
  });
});

describe('Builder source catalog filters across all 1,883 records', () => {
  const availability = sourceAvailability(report);
  const none = { query: '', featuredOnly: false, pack: '', wing: '', availability: '' as const };

  it('partitions the whole catalog by import status and by pack', () => {
    expect(filterSourceCatalog(index.models, none, availability)).toHaveLength(1883);
    const states = (['importable', 'unsupported', 'unchecked'] as const)
      .map((state) => filterSourceCatalog(index.models, { ...none, availability: state }, availability));
    expect(states.reduce((sum, list) => sum + list.length, 0)).toBe(1883);
    expect(states[0]!.map((model) => model.id).sort()).toEqual([...report.verified].sort());
    const packs = [...new Set(index.models.map((model) => model.pack))];
    expect(packs.reduce((sum, pack) => sum + filterSourceCatalog(index.models, { ...none, pack }, availability).length, 0)).toBe(1883);
    expect(filterSourceCatalog(index.models, { ...none, featuredOnly: true }, availability)).toHaveLength(200);
  });

  it('marks rejected models with a reason and never as importable', () => {
    for (const entry of report.rejected) {
      const info = availability(entry.id);
      expect(info.state).not.toBe('importable');
      expect(info.reason.length).toBeGreaterThan(10);
      if (entry.status === 'unsupported-extension') expect(info.reason).toContain('extension');
    }
    expect(sourceAvailability(null)('blaster-kit/blaster-a').state).toBe('unchecked');
  });

  it('matches every term across name, ID, pack, author and featured fields', () => {
    for (const model of index.models) {
      expect(filterSourceCatalog([model], { ...none, query: model.id }, availability)).toHaveLength(1);
      expect(filterSourceCatalog([model], { ...none, query: `${model.packName} ${model.name}` }, availability)).toHaveLength(1);
    }
    const kenney = filterSourceCatalog(index.models, { ...none, query: 'kenney' }, availability);
    expect(kenney.length).toBe(index.models.filter((model) => model.author.toLowerCase().includes('kenney')
      || model.name.toLowerCase().includes('kenney') || model.packName.toLowerCase().includes('kenney')).length);
    expect(filterSourceCatalog(index.models, { ...none, query: 'no-such-model-anywhere' }, availability)).toHaveLength(0);
  });
});

describe('imported catalog placement save and reload', () => {
  it('persists an imported catalog placement through the real save path and reloads it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tge-save-'));
    try {
      const fixture = await readFile('tests/fixtures/tge/blaster-a.glb');
      const { importTgeModel } = await import('../scripts/tge-model');
      const imported = await importTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB,
        (async () => new Response(new Uint8Array(fixture))) as typeof fetch);
      const record = { id: 'catalog-model-01', label: 'Blaster a', prefab: 'catalog-model', assetId: imported.assetId,
        anchor: 'floor', position: [260, 0, 240], rotation: [0, 0.75, 0], scale: [1.5, 1.5, 1.5],
        worldId: 'exterior', collision: 'none' };
      const target = join(root, 'data/workshop-placements.json');
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(root, 'data'), { recursive: true });
      await writeFile(target, '{"schemaVersion":1,"objects":[]}\n');
      const saved = await writeWorkshopManifest({ schemaVersion: 2, objects: [record] }, target);
      expect(saved.ok).toBe(true);
      const reloaded = validateWorkshopManifest(JSON.parse(await readFile(target, 'utf8')) as unknown);
      expect(reloaded.ok).toBe(true);
      const placements = new MuseumPlacements(reloaded.value);
      expect(placements.getRecord('catalog-model-01')).toMatchObject({ assetId: imported.assetId,
        rotation: [0, 0.75, 0], scale: [1.5, 1.5, 1.5], worldId: 'exterior' });
      expect(placements.captureManifest().objects).toHaveLength(1);
      const corrupt = Buffer.from(fixture); corrupt[corrupt.length - 1] ^= 1;
      await writeFile(join(root, 'public', imported.assetId), corrupt);
      expect((await writeWorkshopManifest({ schemaVersion: 2, objects: [record] }, target)).ok).toBe(false);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
