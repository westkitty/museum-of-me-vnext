import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { BUILDER_MODELS } from '../src/workshop/builderAssetCatalog';
import { findModelDefects, type MeshBounds } from '../src/workshop/modelDefects';

const REPORT = 'src/workshop/catalog-data/builder-model-defects.json';

async function meshBounds(path: string): Promise<MeshBounds[]> {
  const bytes = readFileSync(`public/${path}`);
  const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) =>
    new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
  gltf.scene.updateMatrixWorld(true);
  const meshes: MeshBounds[] = [];
  gltf.scene.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const box = new THREE.Box3().setFromObject(object);
    meshes.push({ name: object.name || `mesh-${meshes.length}`, min: box.min.toArray(), max: box.max.toArray() });
  });
  return meshes;
}

describe('bundled Builder library models', () => {
  it('match the committed defect report (regenerate with npm run lint:models)', async () => {
    const defects: Record<string, string[]> = {};
    for (const model of BUILDER_MODELS) {
      const found = findModelDefects(await meshBounds(model.path));
      if (found.length) defects[model.id] = found;
    }
    const current = { generatedBy: 'npm run lint:models', checked: BUILDER_MODELS.length, defects };
    const serialized = JSON.stringify(current, null, 2) + '\n';
    if (process.env.UPDATE_MODEL_DEFECTS === '1') writeFileSync(REPORT, serialized);
    expect(JSON.parse(readFileSync(REPORT, 'utf8'))).toEqual(current);
  }, 120_000);

  it('flags the three defects found by hand in the Exhibit Kit review', async () => {
    const report = JSON.parse(readFileSync(REPORT, 'utf8')) as { defects: Record<string, string[]> };
    expect(report.defects['openlife:bookshelf_basic']?.join(' ')).toMatch(/hidden inside/);
    expect(report.defects['openlife:dining_chair']?.join(' ')).toMatch(/floats/);
    expect(report.defects['openlife:telescope_basic']?.join(' ')).toMatch(/floats/);
    // Models the kits rely on are clean, including the desk-top computer.
    for (const id of ['openlife:desk_basic', 'openlife:computer_basic', 'openlife:easel_basic', 'openlife:dresser_basic', 'openlife:park_bench', 'openlife:dining_table']) {
      expect(report.defects[id], id).toBeUndefined();
    }
  });

  it('judges a hovering part and a sealed part correctly', () => {
    const leg = { name: 'leg', min: [0, 0, 0], max: [0.1, 0.4, 0.1] } as const;
    expect(findModelDefects([leg, { name: 'seat', min: [0, 0.42, 0], max: [0.5, 0.45, 0.5] }])).toEqual([]);
    expect(findModelDefects([leg, { name: 'seat', min: [0, 0.6, 0], max: [0.5, 0.65, 0.5] }])).toEqual(['part seat floats, detached from the rest of the model']);
    expect(findModelDefects([{ name: 'box', min: [0, 0, 0], max: [1, 1, 1] }, { name: 'book', min: [0.2, 0.2, 0.2], max: [0.3, 0.5, 0.4] }]))
      .toEqual(['part book is hidden inside box']);
  });
});
