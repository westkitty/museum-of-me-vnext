import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { installExhibits } from '../src/exhibits';
import { createExhibit } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { AssetManager } from '../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import type { ResourceScope } from '../src/assets/ResourceScope';

installExhibits();

const assets = new AssetManager();

function build(id: string) {
  const interaction = new InteractionManager();
  const module = createExhibit(id)!;
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get(id)!, {
    addControl: (exhibitId, c) => interaction.register(exhibitId, c),
    announce: () => {},
    reducedMotion: () => false,
    detailScale: () => 1,
    loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
      (await assets.load(assetId, scope, { detail })).object,
  });
  return { host, interaction };
}

async function live(id: string) {
  const built = build(id);
  await built.host.preload();
  built.host.mount();
  built.host.activate(0);
  return built;
}

const PLINTH_BOX = new THREE.Box3(
  new THREE.Vector3(-1.3, 0, -1.3),
  new THREE.Vector3(1.3, 0.9, 1.3),
);

interface IntersectingMeshInfo {
  name: string;
  type: string;
  box: { min: number[]; max: number[] };
}

function findPlinthIntersections(host: ExhibitHost): IntersectingMeshInfo[] {
  // Update matrices from host.group downward
  host.group.updateMatrixWorld(true);
  const groupInverse = host.group.matrixWorld.clone().invert();

  const intersecting: IntersectingMeshInfo[] = [];

  host.group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;

    const meshToGroup = mesh.matrixWorld.clone().premultiply(groupInverse);

    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      (mesh as THREE.InstancedMesh).computeBoundingBox();
      const instancedBox = (mesh as THREE.InstancedMesh).boundingBox;
      if (!instancedBox) return;
      const box = instancedBox.clone().applyMatrix4(meshToGroup);
      if (box.intersectsBox(PLINTH_BOX)) {
        intersecting.push({
          name: mesh.name || mesh.parent?.name || '(instanced mesh)',
          type: mesh.geometry.type,
          box: {
            min: [Number(box.min.x.toFixed(3)), Number(box.min.y.toFixed(3)), Number(box.min.z.toFixed(3))],
            max: [Number(box.max.x.toFixed(3)), Number(box.max.y.toFixed(3)), Number(box.max.z.toFixed(3))],
          },
        });
      }
      return;
    }

    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingBox) return;

    const box = mesh.geometry.boundingBox.clone().applyMatrix4(meshToGroup);

    if (box.intersectsBox(PLINTH_BOX)) {
      intersecting.push({
        name: mesh.name || mesh.parent?.name || '(unnamed mesh)',
        type: mesh.geometry.type,
        box: {
          min: [Number(box.min.x.toFixed(3)), Number(box.min.y.toFixed(3)), Number(box.min.z.toFixed(3))],
          max: [Number(box.max.x.toFixed(3)), Number(box.max.y.toFixed(3)), Number(box.max.z.toFixed(3))],
        },
      });
    }
  });

  return intersecting;
}

describe('exhibit bay plinth clearance', () => {
  it('verifies repaired exhibits E02, E07, E08, E11 have zero plinth intersections', async () => {
    const targets = ['E02', 'E07', 'E08', 'E11'];
    for (const id of targets) {
      const { host } = await live(id);
      const hits = findPlinthIntersections(host);
      expect(hits, `${id} has plinth intersections`).toHaveLength(0);
      host.dispose();
    }
  });
});
