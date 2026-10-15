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

export interface MergeOptions {
  /** Width/depth of one cullable static batch in metres. */
  readonly cellSize?: number;
  /** Keep original zone-root ownership and visibility. */
  readonly preserveTopLevel?: boolean;
}

interface Bucket {
  parent: THREE.Object3D;
  meshes: THREE.Mesh[];
  geometries: THREE.BufferGeometry[];
  key: string;
}

/**
 * Spatially bounded static geometry batching.
 *
 * The old implementation merged every mesh with the same material into one
 * world-scale buffer. That reduced submissions but could retain distant wings
 * whenever any part of a giant bounding sphere entered the camera frustum.
 * This partitions geometry into material + spatial cell + owning top-level
 * museum zone, retaining per-wing visibility and ordinary frustum culling.
 *
 * Collision remains authored before this rendering-only pass.
 */
export function mergeStatic(root: THREE.Object3D, scope: ResourceScope, options: MergeOptions = {}): MergeReport {
  const cellSize = options.cellSize ?? 192;
  const heightSize = 24;
  const byMaterial = new Map<THREE.Material, Map<string, Bucket>>();
  const centre = new THREE.Vector3();
  const bounds = new THREE.Box3();
  let before = 0;
  root.updateWorldMatrix(true, true);

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    before++;
    if (isExcluded(mesh)) return;
    const material = mesh.material;
    if (Array.isArray(material) || !material) return;
    if (!mesh.geometry || !mesh.geometry.getAttribute('position')) return;
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) return;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) return;

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return;
    bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    // Keep enormous floors, sky pieces and monolithic structural spans intact;
    // combining one with smaller pieces would produce an unhelpfully huge bound.
    const spanX = bounds.max.x - bounds.min.x;
    const spanY = bounds.max.y - bounds.min.y;
    const spanZ = bounds.max.z - bounds.min.z;
    if (spanX > cellSize * 1.5 || spanY > heightSize * 1.75 || spanZ > cellSize * 1.5) return;
    bounds.getCenter(centre);

    let parent: THREE.Object3D = root;
    if (options.preserveTopLevel) {
      let candidate: THREE.Object3D = mesh;
      while (candidate.parent && candidate.parent !== root) candidate = candidate.parent;
      if (candidate !== mesh && candidate.parent === root) parent = candidate;
    }
    const key = String(Math.floor(centre.x / cellSize))
      + ':' + String(Math.floor(centre.y / heightSize))
      + ':' + String(Math.floor(centre.z / cellSize))
      + ':' + (options.preserveTopLevel ? parent.uuid : 'all');
    let byCell = byMaterial.get(material);
    if (!byCell) {
      byCell = new Map();
      byMaterial.set(material, byCell);
    }
    let bucket = byCell.get(key);
    if (!bucket) {
      bucket = { parent, meshes: [], geometries: [], key };
      byCell.set(key, bucket);
    }
    bucket.meshes.push(mesh);
  });

  let merged = 0;
  for (const [material, cells] of byMaterial) {
    for (const entry of cells.values()) {
      if (entry.meshes.length < 2) continue;

      for (const mesh of entry.meshes) {
        mesh.updateWorldMatrix(true, false);
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        stripToCommon(geometry);
        entry.geometries.push(geometry);
      }

      const indexedCount = entry.geometries.reduce((count, geometry) => count + (geometry.index ? 1 : 0), 0);
      if (indexedCount > 0 && indexedCount < entry.geometries.length) {
        for (let i = 0; i < entry.geometries.length; i++) {
          const geometry = entry.geometries[i];
          if (!geometry.index) continue;
          const nonIndexed = geometry.toNonIndexed();
          geometry.dispose();
          entry.geometries[i] = nonIndexed;
        }
      }

      const combined = mergeGeometries(entry.geometries, false);
      for (const geometry of entry.geometries) geometry.dispose();
      if (!combined) continue;

      // Source geometry was converted to world-space before merging. Convert
      // back into the owning group so Workshop-safe zone visibility is retained.
      entry.parent.updateWorldMatrix(true, false);
      const inverseParent = entry.parent.matrixWorld.clone().invert();
      combined.applyMatrix4(inverseParent);
      combined.computeBoundingSphere();

      const mergedMesh = new THREE.Mesh(scope.track(combined), material);
      mergedMesh.name = 'merged:' + material.uuid.slice(0, 8) + ':' + entry.key;
      mergedMesh.userData.spatialBatch = true;
      mergedMesh.matrixAutoUpdate = false;
      mergedMesh.receiveShadow = true;
      mergedMesh.castShadow = false;
      entry.parent.add(mergedMesh);
      for (const mesh of entry.meshes) mesh.removeFromParent();
      merged += entry.meshes.length;
    }
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

function stripToCommon(geometry: THREE.BufferGeometry): void {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  if (!geometry.getAttribute('uv')) {
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
}
