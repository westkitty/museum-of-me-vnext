import * as THREE from 'three';
import { VISITOR_GEOMETRY_BASE64, VISITOR_GEOMETRY_LAYOUT } from './visitorGeometry.generated';

/**
 * The 78 composed visitor geometries are a pure function of the authored
 * visitor records and VisitorVisuals. scripts/build-visitor-geometry.ts runs
 * that composer at build time and embeds the result, so entering the museum
 * decodes bytes instead of re-running the composer (templates, five transform
 * passes per piece, index rebasing, bounds). Regenerate with
 * `npm run build:collection`; tests/visitor-geometry-bake.test.ts fails if the
 * committed data differs from the live composer by a single byte.
 *
 * Decoding needs the native Uint8Array.fromBase64. Where it is missing, a JS
 * base64 loop costs more than composing, so this returns null and the caller
 * composes procedurally. Both paths produce identical geometry.
 */
export function bakedVisitorGeometryAvailable(): boolean {
  return typeof (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64 === 'function';
}

/** Returns CPU-only geometries (the caller owns and disposes them), or null when unsupported. */
export function bakedVisitorGeometry(): Record<string, THREE.BufferGeometry> | null {
  if (!bakedVisitorGeometryAvailable()) return null;
  const bytes = (Uint8Array as unknown as { fromBase64(s: string): Uint8Array }).fromBase64(VISITOR_GEOMETRY_BASE64);
  const { vertices, indices, entries } = VISITOR_GEOMETRY_LAYOUT;
  // Sections are laid out position, normal, uv, color (Float32), then index (Uint16).
  const f32 = new Float32Array(bytes.buffer, bytes.byteOffset, vertices * 11);
  const positions = f32.subarray(0, vertices * 3);
  const normals = f32.subarray(vertices * 3, vertices * 6);
  const uvs = f32.subarray(vertices * 6, vertices * 8);
  const colors = f32.subarray(vertices * 8, vertices * 11);
  const index = new Uint16Array(bytes.buffer, bytes.byteOffset + vertices * 44, indices);
  const geometries: Record<string, THREE.BufferGeometry> = {};
  for (const [key, v, vc, i, ic, b] of entries) {
    const geometry = new THREE.BufferGeometry()
      .setIndex(new THREE.BufferAttribute(index.subarray(i, i + ic), 1))
      .setAttribute('position', new THREE.BufferAttribute(positions.subarray(v * 3, (v + vc) * 3), 3))
      .setAttribute('normal', new THREE.BufferAttribute(normals.subarray(v * 3, (v + vc) * 3), 3))
      .setAttribute('uv', new THREE.BufferAttribute(uvs.subarray(v * 2, (v + vc) * 2), 2))
      .setAttribute('color', new THREE.BufferAttribute(colors.subarray(v * 3, (v + vc) * 3), 3));
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(b[6], b[7], b[8]), b[9]);
    geometries[key] = geometry;
  }
  return geometries;
}
