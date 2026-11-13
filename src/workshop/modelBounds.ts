import * as THREE from 'three';
import type { MeshBounds } from './modelDefects';

/**
 * World-space bounds of every mesh in a loaded model, with whether the mesh is
 * exactly its own bounding box (every vertex on a corner of the box).
 */
export function modelMeshBounds(root: THREE.Object3D): MeshBounds[] {
  root.updateMatrixWorld(true);
  const meshes: MeshBounds[] = [];
  const point = new THREE.Vector3();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const position = mesh.geometry.getAttribute('position');
    const size = box.getSize(new THREE.Vector3());
    const eps = 1e-4 + 1e-4 * Math.max(size.x, size.y, size.z);
    let boxy = true;
    for (let i = 0; i < position.count && boxy; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      for (const axis of ['x', 'y', 'z'] as const) {
        if (Math.abs(point[axis] - box.min[axis]) > eps && Math.abs(point[axis] - box.max[axis]) > eps) { boxy = false; break; }
      }
    }
    meshes.push({ name: mesh.name || `mesh-${meshes.length}`, min: box.min.toArray(), max: box.max.toArray(), boxy });
  });
  return meshes;
}
