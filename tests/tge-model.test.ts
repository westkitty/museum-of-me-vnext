import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCachedTgeModel, importTgeModel, safeSourceGlb } from '../scripts/tge-model';
import { hasValidLocalGLB } from '../scripts/workshop-save-plugin';

describe('pinned model import', () => {
  it('rejects external extension references and unverified required extensions', () => {
    const glb = (doc: object): Buffer => {
      const json = Buffer.from(JSON.stringify(doc));
      const padding = (4 - json.length % 4) % 4;
      const body = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
      const header = Buffer.alloc(20);
      header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
      header.writeUInt32LE(20 + body.length, 8); header.writeUInt32LE(body.length, 12);
      header.write('JSON', 16);
      return Buffer.concat([header, body]);
    };
    expect(safeSourceGlb(glb({ asset: { version: '2.0' }, extensions: { example: { uri: 'https://example.invalid/data' } } }), hasValidLocalGLB)).toBe(false);
    expect(safeSourceGlb(glb({ asset: { version: '2.0' }, extensionsRequired: ['unverified'] }), hasValidLocalGLB)).toBe(false);
    expect(safeSourceGlb(glb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_texture_transform'] }), hasValidLocalGLB)).toBe(true);
    expect(safeSourceGlb(glb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_materials_unlit'] }), hasValidLocalGLB)).toBe(true);
    expect(safeSourceGlb(glb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] }), hasValidLocalGLB)).toBe(false);
    expect(safeSourceGlb(glb({ asset: { version: '2.0' }, extensionsRequired: [7] }), hasValidLocalGLB)).toBe(false);
  });
  it('verifies source identity, stores the model and records provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tge-model-'));
    try {
      const fixture = await readFile('tests/fixtures/tge/blaster-a.glb');
      const source = (async () => new Response(new Uint8Array(fixture))) as typeof fetch;
      const imported = await importTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB, source);
      expect(await findCachedTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB)).toEqual(imported);
      const hash = createHash('sha256').update(fixture).digest('hex');
      expect(imported.assetId).toBe(`workshop-models/${hash}.glb`);
      expect(await readFile(join(root, 'public', imported.assetId))).toEqual(fixture);
      const directory = join(root, '.asset-sources/tge-provenance');
      const files = await readdir(directory);
      const provenance = JSON.parse(await readFile(join(directory, files[0]), 'utf8')) as Record<string, string>;
      expect(provenance).toMatchObject({ sourceId: 'blaster-kit/blaster-a', sha256: hash,
        gitBlob: '826731460c39648b81ebcdd58532f6f30e21c4b6', license: 'CC0-1.0' });
      const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
      expect(await importTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB, offline)).toEqual(imported);
      const altered = Buffer.from(fixture);
      altered[altered.length - 1] ^= 1;
      await writeFile(join(root, 'public', imported.assetId), altered);
      expect(await findCachedTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB)).toBeNull();
      await expect(importTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB, offline)).rejects.toThrow('offline');
      expect(await readFile(join(root, 'public', imported.assetId))).toEqual(altered);
      await expect(importTgeModel('../../other', root, hasValidLocalGLB, source)).rejects.toThrow('Unknown');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects altered source bytes before writing a model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tge-model-invalid-'));
    try {
      const fixture = await readFile('tests/fixtures/tge/blaster-a.glb');
      fixture[fixture.length - 1] ^= 1;
      const source = (async () => new Response(new Uint8Array(fixture))) as typeof fetch;
      await expect(importTgeModel('blaster-kit/blaster-a', root, hasValidLocalGLB, source)).rejects.toThrow('integrity');
      await expect(readdir(join(root, 'public/workshop-models'))).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
