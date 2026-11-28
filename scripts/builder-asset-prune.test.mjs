import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pruneUnreferencedBuilderAssets, referencedBuilderPaths } from './builder-asset-prune.mjs';

const catalog = {
  models: [{ id: 'openlife:bench', path: 'builder-assets/openlife/bench.glb' }, { id: 'openlife:lamp', path: 'builder-assets/openlife/lamp.glb' }],
  textures: [{ id: 'openlife:grass', path: 'builder-assets/openlife/grass.png' }, { id: 'openlife:road', path: 'builder-assets/openlife/road.png' }],
};

function out() {
  const dir = mkdtempSync(join(tmpdir(), 'museum-prune-'));
  mkdirSync(join(dir, 'builder-assets/openlife'), { recursive: true });
  for (const f of ['bench.glb', 'lamp.glb', 'grass.png', 'road.png', 'LICENSE.txt']) writeFileSync(join(dir, 'builder-assets/openlife', f), 'x');
  return dir;
}

test('keeps exactly the catalog files the placements reference, and the licence', async () => {
  const dir = out();
  const manifest = { objects: [{ assetId: 'openlife:bench' }, { image: 'workshop-media/a.webp' }], surfaceOverrides: [{ texture: 'openlife:grass' }] };
  assert.deepEqual([...referencedBuilderPaths(manifest, catalog)].sort(), ['builder-assets/openlife/bench.glb', 'builder-assets/openlife/grass.png']);
  const removed = await pruneUnreferencedBuilderAssets(dir, manifest, catalog);
  assert.deepEqual(removed, ['builder-assets/openlife/lamp.glb', 'builder-assets/openlife/road.png']);
  assert.deepEqual(readdirSync(join(dir, 'builder-assets/openlife')).sort(), ['LICENSE.txt', 'bench.glb', 'grass.png']);
  rmSync(dir, { recursive: true, force: true });
});

test('with no placements every catalog binary goes and the licence stays', async () => {
  const dir = out();
  await pruneUnreferencedBuilderAssets(dir, { objects: [] }, catalog);
  assert.deepEqual(readdirSync(join(dir, 'builder-assets/openlife')), ['LICENSE.txt']);
  rmSync(dir, { recursive: true, force: true });
});

test('a build without the catalog folder is left alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'museum-prune-'));
  assert.deepEqual(await pruneUnreferencedBuilderAssets(dir, { objects: [] }, catalog), []);
  rmSync(dir, { recursive: true, force: true });
});
