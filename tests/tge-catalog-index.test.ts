import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface Entry {
  id: string; file: string; bytes: number; gitBlob: string; thumbnail: string;
  thumbnailBytes: number; thumbnailGitBlob: string; license: string;
  featured?: { index: number; target: string; wing: string; role: string };
}

describe('pinned external Builder catalog index', () => {
  it('retains all source records, thumbnail identities and exact featured assignments', async () => {
    const index = JSON.parse(await readFile('src/workshop/catalog-data/tge-index.json', 'utf8')) as {
      schemaVersion: number; sourceRevision: string; candidateLedgerGitBlob: string; models: Entry[];
    };
    expect(index.schemaVersion).toBe(1);
    expect(index.sourceRevision).toBe('3ddcc695adbba9fb918cf31b7c139b3f95b76910');
    expect(index.candidateLedgerGitBlob).toBe('d3a464f11c9acf58fcca5b0219af0881730753db');
    expect(index.models).toHaveLength(1883);
    expect(new Set(index.models.map((model) => model.id)).size).toBe(1883);
    for (const model of index.models) {
      expect(model.file).toBe(`packs/${model.id}.glb`);
      const [pack, name] = model.id.split('/');
      expect(model.thumbnail).toBe(`packs/${pack}/thumbs/${name}.webp`);
      expect(model.gitBlob).toMatch(/^[a-f0-9]{40}$/);
      expect(model.thumbnailGitBlob).toMatch(/^[a-f0-9]{40}$/);
      expect(model.bytes).toBeGreaterThan(0);
      expect(model.thumbnailBytes).toBeGreaterThan(0);
      expect(model.license).toBe('CC0-1.0');
    }
    const featured = index.models.filter((model) => model.featured).sort((a, b) => a.featured!.index - b.featured!.index);
    expect(featured).toHaveLength(200);
    const assignments = featured.map((model) => {
      const item = model.featured!;
      return `${item.index}|${model.id}|${item.target}|${item.wing}|${item.role}`;
    }).join('\n');
    expect(createHash('sha256').update(assignments).digest('hex'))
      .toBe('54603369338999ac2c0b0c1088d53d370cd702d1fc5fb2b271b3df3cb109a5e2');
  });
});
