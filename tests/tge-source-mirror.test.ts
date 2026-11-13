import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import index from '../src/workshop/catalog-data/tge-index.json';
import { tgeSourceFetch } from '../scripts/tge-source';

const MIRROR = 'tests/fixtures/tge-mirror';
const PREFIX = `https://raw.githubusercontent.com/Hidencod/tge-assets/${index.sourceRevision}/`;
const model = index.models.find((entry) => entry.id === 'blocky-characters/character-b')!;
const blob = (path: string) => execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim();

describe('pinned TGE source mirror', () => {
  it('holds only exact pinned CC0 source files', () => {
    const byPath = new Map<string, { gitBlob: string; license: string }>();
    for (const entry of index.models) {
      byPath.set(entry.file, { gitBlob: entry.gitBlob, license: entry.license });
      byPath.set(entry.thumbnail, { gitBlob: entry.thumbnailGitBlob, license: entry.license });
    }
    const root = `${MIRROR}/${index.sourceRevision}/`;
    const files = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard', root], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) {
      const pinned = byPath.get(file.slice(root.length));
      expect(pinned, `${file} is not a pinned source path`).toBeTruthy();
      expect(pinned!.license).toBe('CC0-1.0');
      expect(blob(file), file).toBe(pinned!.gitBlob);
    }
  });

  it('mirrors every model the Workshop browser tests click or import', () => {
    const root = `${MIRROR}/${index.sourceRevision}/`;
    for (const id of ['blocky-characters/character-a', 'blocky-characters/character-b', 'blaster-kit/blaster-a']) {
      const entry = index.models.find((item) => item.id === id)!;
      expect(existsSync(root + entry.thumbnail), `${id} thumbnail`).toBe(true);
    }
    for (const id of ['blocky-characters/character-b', 'blaster-kit/blaster-a']) {
      expect(existsSync(root + index.models.find((item) => item.id === id)!.file), `${id} model`).toBe(true);
    }
  });

  it('serves mirrored source files and never falls back to the network', async () => {
    const request = tgeSourceFetch({ MUSEUM_TGE_SOURCE_MIRROR: MIRROR });
    const hit = await request(PREFIX + model.file);
    expect(hit.status).toBe(200);
    expect((await hit.arrayBuffer()).byteLength).toBe(model.bytes);
    expect((await request(`${PREFIX}packs/blocky-characters/not-mirrored.glb`)).status).toBe(404);
    expect((await request('https://example.com/anything')).status).toBe(404);
  });

  it('refuses paths that escape the mirror', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tge-mirror-'));
    mkdirSync(join(root, 'inner'));
    writeFileSync(join(root, 'secret.txt'), 'outside');
    const request = tgeSourceFetch({ MUSEUM_TGE_SOURCE_MIRROR: join(root, 'inner') });
    expect((await request(`${PREFIX}../secret.txt`)).status).toBe(404);
    expect((await request(`${PREFIX}%2e%2e/secret.txt`)).status).toBe(404);
  });

  it('uses the real network fetch when no mirror is configured', () => {
    expect(tgeSourceFetch({})).toBe(fetch);
  });
});
