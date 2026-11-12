import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public build privacy boundary', () => {
  it('refuses a manifest referencing a private import without changing it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'museum-private-build-'));
    const source = JSON.stringify({ schemaVersion: 1, objects: [{ assetId: `workshop-models/${'a'.repeat(64)}.glb` }] });
    try {
      await mkdir(join(root, 'data'));
      const manifest = join(root, 'data/workshop-placements.json');
      await writeFile(manifest, source);
      const result = spawnSync(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build', '--config', resolve('vite.config.ts')],
        { cwd: root, encoding: 'utf8', timeout: 60_000 });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain('Public builds cannot include private Workshop imports');
      expect(await readFile(manifest, 'utf8')).toBe(source);
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 70_000);
});
