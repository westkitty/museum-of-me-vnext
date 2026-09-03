import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourceScope } from '../assets/ResourceScope';

export interface MergeReport {
  readonly before: number;
  readonly after: number;
  readonly merged: number;
}

/** Marks an object and its subtree as never to be merged. */
export const NO_MERGE = 'noMerge';

/**
 * Collapse static architecture into one mesh per material.
 *
 * The museum's detailing produces hundreds of small meshes — pilasters, jambs,
 * cornices, benches, signage frames — that never move and share a handful of
 * materials. Each one is a draw call, and profiling put the entrance at 986 of
 * them, which is the single largest runtime cost in the building.
 *
 * Merging is safe here precisely because this geometry is static: it is built
 * once from `layout.ts` and never transformed again. Anything that does move,
 * and every exhibit mount, is excluded.
 */
export function mergeStatic(root: THREE.Object3D, scope: ResourceScope): MergeReport {
  const byMaterial = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  let before = 0;

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    before++;

    // Skip anything explicitly excluded, anything under an exhibit mount, and
    // anything with a material array (merging those needs group support).
    if (isExcluded(mesh)) return;
    const material = mesh.material;
    if (Array.isArray(material) || !material) return;
    if (!mesh.geometry || !mesh.geometry.getAttribute('position')) return;
    // Instanced and skinned meshes are already batched or animated.
    if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) return;

    const entry = byMaterial.get(material) ?? { geometries: [], meshes: [] };
    entry.meshes.push(mesh);
    byMaterial.set(material, entry);
  });

  let merged = 0;
  for (const [material, entry] of byMaterial) {
    // A single mesh is already one draw call; merging it saves nothing.
    if (entry.meshes.length < 2) continue;

    for (const mesh of entry.meshes) {
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      // mergeGeometries requires identical attribute sets.
      stripToCommon(geometry);
      entry.geometries.push(geometry);
    }

    const combined = mergeGeometries(entry.geometries, false);
    for (const geometry of entry.geometries) geometry.dispose();
    if (!combined) continue;

    const mergedMesh = new THREE.Mesh(scope.track(combined), material);
    mergedMesh.name = `merged:${material.uuid.slice(0, 8)}`;
    mergedMesh.matrixAutoUpdate = false;
    mergedMesh.receiveShadow = true;
    root.add(mergedMesh);

    for (const mesh of entry.meshes) {
      mesh.removeFromParent();
      // The geometry is owned by the museum's scope and may be shared between
      // meshes, so it is not disposed here — the scope handles it on teardown.
    }
    merged += entry.meshes.length;
  }

  let after = 0;
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) after++;
  });

  return { before, after, merged };
}

function isExcluded(mesh: THREE.Mesh): boolean {
  let node: THREE.Object3D | null = mesh;
  while (node) {
    if (node.userData?.[NO_MERGE]) return true;
    if (typeof node.name === 'string' && node.name.startsWith('exhibit:')) return true;
    if (typeof node.name === 'string' && node.name.startsWith('exhibit-content:')) return true;
    node = node.parent;
  }
  return false;
}

/** Keep only the attributes every mesh in the museum shares. */
function stripToCommon(geometry: THREE.BufferGeometry): void {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') {
      geometry.deleteAttribute(name);
    }
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  if (!geometry.getAttribute('uv')) {
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
}
