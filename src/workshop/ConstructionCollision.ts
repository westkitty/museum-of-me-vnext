import * as THREE from 'three';
import type { Floor, Wall } from '../world/CollisionWorld';
import { defaultOpening, wallOpeningSegments } from './WallOpenings';
import type { WorkshopPlacementRecord } from './schema';

export type ConstructionCollider = { id: string; collider: Wall | Floor };

/** Compile authored construction collision from its definition and transform, without a mesh. */
export function constructionColliders(record: WorkshopPlacementRecord, matrix?: THREE.Matrix4): ConstructionCollider[] {
  if (record.prefab !== 'floor-slab' && record.prefab !== 'partition-wall') return [];
  const transform = matrix?.clone() ?? new THREE.Matrix4().compose(
    new THREE.Vector3(...record.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...record.rotation)),
    new THREE.Vector3(...record.scale),
  );
  if (record.prefab === 'floor-slab') {
    const box = new THREE.Box3(new THREE.Vector3(-1, -0.16, -1), new THREE.Vector3(1, 0, 1))
      .applyMatrix4(transform);
    const inverse = transform.clone().invert();
    const point = new THREE.Vector3();
    return [{ id: record.id, collider: {
      kind: 'floor', minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, y: box.max.y,
      contains: (x, z) => {
        point.set(x, box.max.y, z).applyMatrix4(inverse);
        return Math.abs(point.x) <= 1.0001 && Math.abs(point.z) <= 1.0001;
      },
    } }];
  }
  const kind = record.opening ?? 'none';
  const fallback = defaultOpening(kind);
  const segments = wallOpeningSegments(kind, {
    width: record.openingWidth ?? fallback.width,
    height: record.openingHeight ?? fallback.height,
    sill: record.openingSill ?? fallback.sill,
  });
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  transform.decompose(position, quaternion, scale);
  const yaw = Math.atan2(-transform.elements[2], transform.elements[0]);
  return segments.map((segment, index) => {
    const center = new THREE.Vector3(segment.centerX, segment.centerY, 0).applyMatrix4(transform);
    const bounds = new THREE.Box3(
      new THREE.Vector3(segment.centerX - segment.width / 2, segment.centerY - segment.height / 2, -0.075),
      new THREE.Vector3(segment.centerX + segment.width / 2, segment.centerY + segment.height / 2, 0.075),
    ).applyMatrix4(transform);
    return { id: `${record.id}:segment-${index}`, collider: {
      kind: 'wall' as const, minX: bounds.min.x, maxX: bounds.max.x, minY: bounds.min.y, maxY: bounds.max.y,
      minZ: bounds.min.z, maxZ: bounds.max.z,
      oriented: { centerX: center.x, centerZ: center.z, halfX: Math.abs(segment.width * scale.x) / 2,
        halfZ: Math.abs(0.15 * scale.z) / 2, yaw },
    } };
  });
}
