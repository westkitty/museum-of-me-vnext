import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { BUILDER_MODELS } from '../src/workshop/builderAssetCatalog';
import { modelMeshBounds } from '../src/workshop/modelBounds';
import { findModelDefects, type MeshBounds } from '../src/workshop/modelDefects';

const REPORT = 'src/workshop/catalog-data/builder-model-defects.json';

const PLANS = JSON.parse(readFileSync('scripts/openlife-repair-plan.json', 'utf8')) as Record<string, { floating?: Record<string, string> }>;

async function meshBounds(file: string): Promise<MeshBounds[]> {
  const bytes = readFileSync(file);
  const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) =>
    new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
  return modelMeshBounds(gltf.scene);
}

const floatingFor = (id: string) => ({ floating: Object.keys(PLANS[id.replace('openlife:', '')]?.floating ?? {}) });

describe('bundled Builder library models', () => {
  it('match the committed defect report (regenerate with npm run lint:models)', async () => {
    const defects: Record<string, string[]> = {};
    for (const model of BUILDER_MODELS) {
      const found = findModelDefects(await meshBounds(`public/${model.path}`), floatingFor(model.id));
      if (found.length) defects[model.id] = found;
    }
    const current = { generatedBy: 'npm run lint:models', checked: BUILDER_MODELS.length, defects };
    const serialized = JSON.stringify(current, null, 2) + '\n';
    if (process.env.UPDATE_MODEL_DEFECTS === '1') writeFileSync(REPORT, serialized);
    expect(JSON.parse(readFileSync(REPORT, 'utf8'))).toEqual(current);
  }, 120_000);

  it('finds the hand-found defects in the pinned sources, and none after repair', async () => {
    const source = async (id: string) => findModelDefects(await meshBounds(`assets-source/openlife/${id}.glb`), floatingFor(id)).join(' ');
    expect(await source('bookshelf_basic')).toMatch(/hidden inside/);
    expect(await source('dining_chair')).toMatch(/floats/);
    expect(await source('telescope_basic')).toMatch(/floats/);
    const report = JSON.parse(readFileSync(REPORT, 'utf8')) as { defects: Record<string, string[]> };
    expect(report.defects).toEqual({});
  }, 60_000);

  it('judges a hovering part and a sealed part correctly', () => {
    const leg = { name: 'leg', min: [0, 0, 0], max: [0.1, 0.4, 0.1] } as const;
    expect(findModelDefects([leg, { name: 'seat', min: [0, 0.42, 0], max: [0.5, 0.45, 0.5] }])).toEqual([]);
    expect(findModelDefects([leg, { name: 'seat', min: [0, 0.6, 0], max: [0.5, 0.65, 0.5] }])).toEqual(['part seat floats, detached from the rest of the model']);
    expect(findModelDefects([{ name: 'box', min: [0, 0, 0], max: [1, 1, 1] }, { name: 'book', min: [0.2, 0.2, 0.2], max: [0.3, 0.5, 0.4] }]))
      .toEqual(['part book is hidden inside box']);
  });
});
