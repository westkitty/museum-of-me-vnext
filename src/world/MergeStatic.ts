import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourceScope } from '../assets/ResourceScope';

interface MergeGroup {
  readonly geometries: THREE.BufferGeometry[];
  readonly meshes: THREE.Mesh[];
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
}

export interface MergeReport {
  readonly before: number;
  readonly after: number;
  readonly merged: number;
}

export interface BakeReport {
  /** Materials replaced by an identical-value canonical instance. */
  readonly interned: number;
  readonly merge: MergeReport;
}

/** Marks an object and its subtree as never to be merged. */
export const NO_MERGE = 'noMerge';
/** Marks an object and its subtree as never to have its materials interned. */
export const NO_INTERN = 'noIntern';

/**
 * Collapse static architecture into one mesh per material.
 *
 * The museum's detailing produces hundreds of small meshes — pilasters, jambs,
 * cornices, benches, signage frames — that never move and share a handful of
 * materials. Each one can add a draw submission. The paired whole-scene profile
 * documents the measured change; it does not isolate this subsystem's runtime
 * cost or attribute every before/after delta to the bake.
 *
 * The scene geometry is static: it is built once from `layout.ts` and never
 * transformed again. Anything that does move, and every exhibit mount, is
 * excluded. Merging also changes object-level draw sorting, so an
 * order-sensitive alpha-blended subtree must be marked `NO_MERGE`; automated
 * geometry/material checks do not prove pixel-identical output.
 */
export function mergeStatic(root: THREE.Object3D, scope: ResourceScope): MergeReport {
  // Grouped by material *and* by the two shadow flags, because a merged mesh
  // carries one of each: collapsing a material group that mixed casters with
  // non-casters would either invent shadows or delete them. Splitting the group
  // instead costs one extra draw call and is exactly faithful.
  const byMaterial = new Map<THREE.Material, Map<string, MergeGroup>>();
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

    const flags = `${mesh.castShadow ? 'c' : '-'}${mesh.receiveShadow ? 'r' : '-'}`;
    let byFlags = byMaterial.get(material);
    if (!byFlags) {
      byFlags = new Map<string, MergeGroup>();
      byMaterial.set(material, byFlags);
    }
    const entry = byFlags.get(flags) ?? { geometries: [], meshes: [], castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow };
    entry.meshes.push(mesh);
    byFlags.set(flags, entry);
  });

  let merged = 0;
  for (const [material, byFlags] of byMaterial) {
    for (const entry of byFlags.values()) {
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
      mergedMesh.receiveShadow = entry.receiveShadow;
      mergedMesh.castShadow = entry.castShadow;
      root.add(mergedMesh);

      for (const mesh of entry.meshes) {
        mesh.removeFromParent();
        // The geometry is owned by the museum's scope and may be shared between
        // meshes, so it is not disposed here — the scope handles it on teardown.
      }
      merged += entry.meshes.length;
    }
  }

  let after = 0;
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) after++;
  });

  return { before, after, merged };
}

/**
 * Replace every mesh material with a canonical instance that is *provably
 * identical*, so that `mergeStatic` — which groups by material identity, not by
 * material value — can actually collapse meshes that are drawn with equal
 * settings.
 *
 * The museum builds hundreds of `MeshStandardMaterial` instances that differ
 * only in the object that holds them. Without interning, each one is its own
 * merge group and therefore its own draw call.
 *
 * Safety rules:
 * - two materials are fused only when every own property that affects the
 *   rendered result compares equal by value (textures by identity);
 * - any material carrying a property this cannot describe exactly — a function,
 *   an opaque object, custom `defines` or `uniforms` — is left alone;
 * - a subtree marked `NO_INTERN` is left alone entirely.
 *
 * Interning therefore cannot change what any single mesh renders. It can only
 * make two meshes share one uniform block. It is only safe for subtrees that
 * never mutate a material at runtime, which is why the museum's static bake —
 * `bakeStatic` — is the only intended caller.
 */
export function internMaterials(root: THREE.Object3D, owner?: ResourceScope): number {
  const canonical = new Map<string, THREE.Material>();
  const replaced: THREE.Material[] = [];
  let count = 0;

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const material = mesh.material;
    if (Array.isArray(material)) return;
    if (isProtected(mesh, NO_INTERN)) return;
    const key = materialKey(material);
    if (key === '') return;

    const existing = canonical.get(key);
    if (!existing) {
      canonical.set(key, material);
      return;
    }
    if (existing === material) return;
    mesh.material = existing;
    replaced.push(material);
    count++;
  });

  // A replaced material is no longer referenced by the scene. Leaving it
  // tracked would leave a dead entry behind on every replacement, which is
  // exactly what ResourceScope.untrack() exists for, so the lifecycle
  // assertions built on `scope.size` keep their meaning.
  for (const material of replaced) {
    material.dispose();
    owner?.untrack(material);
  }
  return count;
}

/** Interning plus merging, in the order that actually collapses draw calls. */
export function bakeStatic(root: THREE.Object3D, scope: ResourceScope): BakeReport {
  const interned = internMaterials(root, scope);
  return { interned, merge: mergeStatic(root, scope) };
}

/** Mark an object and its whole subtree as immutable for the static bake. */
export function protectSubtree(root: THREE.Object3D, flags: readonly string[] = [NO_MERGE]): void {
  for (const flag of flags) root.userData[flag] = true;
}

/**
 * A string that changes if and only if the material's rendered result changes.
 * Returns `''` for any material this cannot describe exhaustively; callers must
 * then leave that material alone.
 */
export function materialKey(material: THREE.Material): string {
  // Anything with custom shader state (uniforms, defines, GLSL) is not
  // interchangeable, even when the numbers happen to match.
  const type = material.type;
  if (type === 'ShaderMaterial' || type === 'RawShaderMaterial') return '';
  if (typeof (material as THREE.Material).onBeforeCompile === 'function'
    && (material as unknown as { onBeforeCompile?: unknown }).onBeforeCompile
      !== THREE.Material.prototype.onBeforeCompile) {
    return '';
  }
  if ((material as unknown as { customProgramCacheKey?: unknown }).customProgramCacheKey
    !== THREE.Material.prototype.customProgramCacheKey) {
    return '';
  }

  const record = material as unknown as Record<string, unknown>;
  const parts: string[] = [type];
  for (const name of Object.keys(record).sort()) {
    if (SKIPPED_KEYS.has(name)) continue;
    const described = describe(name, record[name]);
    // `null` means "state this cannot prove equal", so the material is not a
    // candidate for interning at all. An empty string means "nothing to say".
    if (described === null) return '';
    if (described !== '') parts.push(described);
  }
  return parts.join('|');
}

/**
 * A stable description of one material property, `''` when the property carries
 * nothing, and `null` when it carries anything this cannot describe exactly.
 */
function describe(name: string, value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return `${name}=${String(value)}`;
  }
  if ((value as THREE.Color).isColor) {
    const c = value as THREE.Color;
    return `${name}=${c.r},${c.g},${c.b}`;
  }
  if ((value as THREE.Texture).isTexture) return `${name}=${(value as THREE.Texture).uuid}`;
  if ((value as THREE.Euler).isEuler) {
    const e = value as THREE.Euler;
    return `${name}=${e.x},${e.y},${e.z},${e.order}`;
  }
  if ((value as THREE.Quaternion).isQuaternion) {
    return `${name}=${(value as THREE.Quaternion).toArray().join(',')}`;
  }
  if ((value as THREE.Vector2).isVector2) {
    return `${name}=${(value as THREE.Vector2).toArray().join(',')}`;
  }
  if ((value as THREE.Vector3).isVector3) {
    return `${name}=${(value as THREE.Vector3).toArray().join(',')}`;
  }
  if ((value as THREE.Vector4).isVector4) {
    return `${name}=${(value as THREE.Vector4).toArray().join(',')}`;
  }
  if (value instanceof THREE.Matrix3 || value instanceof THREE.Matrix4) {
    return `${name}=${value.elements.join(',')}`;
  }
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) {
    return `${name}=${value.join(',')}`;
  }
  // `defines` and the event-listener map are plain objects. An empty one says
  // nothing about the draw; a populated one is program state this refuses to
  // compare by accident.
  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '';
    if (entries.every(([, v]) => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string')) {
      return `${name}={${entries
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}:${String(v)}`)
        .join(',')}}`;
    }
    return null;
  }
  return null;
}

function isPlainObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Identity, cosmetic and bookkeeping fields that never affect a draw. */
const SKIPPED_KEYS = new Set(['uuid', 'id', 'name', 'version', 'userData', 'type', 'needsUpdate']);

function isProtected(mesh: THREE.Mesh, flag: string): boolean {
  let node: THREE.Object3D | null = mesh;
  while (node) {
    if (node.userData?.[flag]) return true;
    node = node.parent;
  }
  return false;
}

function isExcluded(mesh: THREE.Mesh): boolean {
  let node: THREE.Object3D | null = mesh;
  while (node) {
    if (node.userData?.[NO_MERGE]) return true;
    // Registered interaction controls are raycast individually. Baking one into
    // a merged mesh would remove the exact object the visitor's focus ray
    // resolves against, so anything the interaction manager owns is protected
    // by the same flag that already marks it as interactive.
    if (node.userData?.interactive === true) return true;
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
  // mergeGeometries() refuses a group that mixes indexed and non-indexed
  // geometry, and it used to fail the whole group silently: a material whose
  // meshes came from both `BoxGeometry` (indexed) and an already-merged
  // geometry (also indexed) plus an `ExtrudeGeometry` produced by hand kept
  // every one of its draw calls. Giving a non-indexed geometry a trivial
  // sequential index changes nothing about how it draws and makes the group
  // mergeable.
  if (!geometry.index) {
    const count = geometry.getAttribute('position').count;
    const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
  }
}
