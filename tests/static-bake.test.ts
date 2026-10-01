import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import {
  bakeStatic, internMaterials, materialKey, mergeStatic, NO_MERGE, protectSubtree,
} from '../src/world/MergeStatic';
import { PersistentEnvironment } from '../src/world/PersistentEnvironment';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { buildMuseum } from './helpers/walk';
import { InteractionManager } from '../src/interaction/InteractionManager';

function countMeshes(root: THREE.Object3D): number {
  let meshes = 0;
  root.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes++; });
  return meshes;
}

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (!geometry) return;
    if (geometry.index) triangles += geometry.index.count / 3;
    else triangles += (geometry.getAttribute('position')?.count ?? 0) / 3;
  });
  return triangles;
}

function materialSignatures(root: THREE.Object3D): string[] {
  const out: string[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || Array.isArray(mesh.material)) return;
    out.push(materialKey(mesh.material as THREE.Material));
  });
  return out.sort();
}

describe('material interning', () => {
  it('describes equal materials equally and different materials differently', () => {
    const a = new THREE.MeshStandardMaterial({ color: 0x2b5f8a, roughness: 0.4, metalness: 0.2 });
    const b = new THREE.MeshStandardMaterial({ color: 0x2b5f8a, roughness: 0.4, metalness: 0.2 });
    const c = new THREE.MeshStandardMaterial({ color: 0x2b5f8b, roughness: 0.4, metalness: 0.2 });
    const d = new THREE.MeshStandardMaterial({ color: 0x2b5f8a, roughness: 0.41, metalness: 0.2 });
    const transparent = new THREE.MeshStandardMaterial({
      color: 0x2b5f8a, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.5,
    });

    expect(materialKey(a)).not.toBe('');
    expect(materialKey(b)).toBe(materialKey(a));
    expect(materialKey(c)).not.toBe(materialKey(a));
    expect(materialKey(d)).not.toBe(materialKey(a));
    expect(materialKey(transparent)).not.toBe(materialKey(a));
  });

  it('refuses to describe state it cannot compare exactly', () => {
    const shader = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } } });
    expect(materialKey(shader)).toBe('');

    const patched = new THREE.MeshStandardMaterial({ color: 0xffffff });
    patched.onBeforeCompile = (shaderSource) => { void shaderSource; };
    expect(materialKey(patched)).toBe('');
  });

  it('fuses value-identical materials without changing what any mesh renders', () => {
    const scope = new ResourceScope('intern');
    const root = new THREE.Group();
    const geometry = scope.track(new THREE.BoxGeometry(1, 1, 1));
    for (let i = 0; i < 12; i++) {
      const material = scope.track(
        new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.6, metalness: 0.1 }),
      );
      root.add(new THREE.Mesh(geometry, material));
    }
    // A different colour must survive as its own material.
    const distinct = scope.track(new THREE.MeshStandardMaterial({ color: 0x224488 }));
    root.add(new THREE.Mesh(geometry, distinct));
    const opaque = scope.track(
      new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.6, metalness: 0.1, flatShading: true }),
    );
    root.add(new THREE.Mesh(geometry, opaque));

    const before = materialSignatures(root);
    const fused = internMaterials(root, scope);
    const after = materialSignatures(root);

    expect(fused).toBe(11);
    expect(after).toEqual(before);
    const unique = new Set<THREE.Material>();
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material)) unique.add(mesh.material as THREE.Material);
    });
    expect(unique.size).toBe(3);
    // The replaced materials leave the scope rather than sitting in it dead:
    // one geometry plus the three survivors out of fifteen tracked resources.
    expect(scope.size).toBe(1 + 3);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

describe('static merge', () => {
  it('merges a group that mixes indexed and non-indexed geometry', () => {
    const scope = new ResourceScope('mixed');
    const material = scope.track(new THREE.MeshStandardMaterial({ color: 0x111111 }));
    const root = new THREE.Group();
    // BoxGeometry is indexed; a hand-built triangle fan is not. The old
    // stripToCommon left the two shapes incompatible, mergeGeometries refused
    // the whole group, and every mesh in it kept its own draw call.
    root.add(new THREE.Mesh(scope.track(new THREE.BoxGeometry(1, 1, 1)), material));
    const fan = new THREE.BufferGeometry();
    fan.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 1,
    ]), 3));
    fan.computeVertexNormals();
    root.add(new THREE.Mesh(scope.track(fan), material));

    const report = mergeStatic(root, scope);
    expect(report.merged).toBe(2);
    expect(report.after).toBe(1);
    expect(countTriangles(root)).toBe(14);
    scope.dispose();
  });

  it('preserves cast and receive shadow flags instead of averaging a mixed group', () => {
    const scope = new ResourceScope('shadows');
    const material = scope.track(new THREE.MeshStandardMaterial({ color: 0x556644 }));
    const geometry = scope.track(new THREE.BoxGeometry(1, 1, 1));
    const root = new THREE.Group();

    const casters = new THREE.Group();
    const receiversOnly = new THREE.Group();
    const neither = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const caster = new THREE.Mesh(geometry, material);
      caster.castShadow = true;
      caster.receiveShadow = false;
      casters.add(caster);

      const receiver = new THREE.Mesh(geometry, material);
      receiver.castShadow = false;
      receiver.receiveShadow = true;
      receiversOnly.add(receiver);

      neither.add(new THREE.Mesh(geometry, material));
    }
    root.add(casters, receiversOnly, neither);

    const report = mergeStatic(root, scope);
    expect(report.merged).toBe(9);
    // Three flag combinations, so three meshes -- and each one carries the
    // flags its own sources carried.
    expect(countMeshes(root)).toBe(3);

    const merged: THREE.Mesh[] = [];
    root.traverse((node) => { if ((node as THREE.Mesh).isMesh) merged.push(node as THREE.Mesh); });
    expect(merged).toHaveLength(3);
    expect(merged.filter((m) => m.castShadow && !m.receiveShadow)).toHaveLength(1);
    expect(merged.filter((m) => !m.castShadow && m.receiveShadow)).toHaveLength(1);
    expect(merged.filter((m) => !m.castShadow && !m.receiveShadow)).toHaveLength(1);
    scope.dispose();
  });

  it('never bakes an object the interaction manager addresses individually', () => {
    const scope = new ResourceScope('interactive');
    const interaction = new InteractionManager();
    const material = scope.track(new THREE.MeshStandardMaterial({ color: 0x333333 }));
    const root = new THREE.Group();
    const geometry = scope.track(new THREE.BoxGeometry(1, 1, 1));

    const target = new THREE.Mesh(geometry, material);
    target.name = 'lectern-hit';
    root.add(target);
    interaction.register('E01', { object: target, label: 'Lectern', activate: () => {} });
    for (let i = 0; i < 4; i++) root.add(new THREE.Mesh(geometry, material));

    mergeStatic(root, scope);
    expect(root.getObjectByName('lectern-hit'), 'a focus target was merged away').toBeTruthy();
    expect(interaction.controlCount).toBe(1);
    interaction.dispose();
    scope.dispose();
  });

  it('honours an explicit protection flag on a subtree', () => {
    const scope = new ResourceScope('protected');
    const material = scope.track(new THREE.MeshStandardMaterial({ color: 0x444444 }));
    const geometry = scope.track(new THREE.BoxGeometry(1, 1, 1));
    const root = new THREE.Group();
    const group = new THREE.Group();
    group.name = 'authorable-plant';
    protectSubtree(group, [NO_MERGE]);
    for (let i = 0; i < 5; i++) group.add(new THREE.Mesh(geometry, material));
    root.add(group);
    for (let i = 0; i < 5; i++) root.add(new THREE.Mesh(geometry, material));

    const report = mergeStatic(root, scope);
    expect(report.merged).toBe(5);
    expect(root.getObjectByName('authorable-plant')).toBeTruthy();
    expect(countMeshes(root.getObjectByName('authorable-plant')!)).toBe(5);
    scope.dispose();
  });
});

describe('always-resident layer draw-call budget', () => {
  it('holds the refinement layer, the garden and the shell inside a measured ceiling', () => {
    const scope = new ResourceScope('bake-budget');
    const built = buildMuseum();
    const environment = new PersistentEnvironment(scope).build();
    const garden = new ArrivalGarden(scope, built.collision).build();

    const shellMeshes = countMeshes(built.root);
    const environmentMeshes = countMeshes(environment);
    const gardenMeshes = countMeshes(garden);

    // Regression ceilings, deliberately above the current measured counts: a
    // normal art addition should pass, while a broken bake that leaves hundreds
    // of small pieces behind should fail. Whole-scene before/after measurements
    // live in the dated profile snapshots rather than this unit assertion.
    expect(shellMeshes, `shell meshes ${shellMeshes}`).toBeLessThan(400);
    expect(environmentMeshes, `environment meshes ${environmentMeshes}`).toBeLessThan(420);
    expect(gardenMeshes, `garden meshes ${gardenMeshes}`).toBeLessThan(60);
    expect(shellMeshes + environmentMeshes + gardenMeshes).toBeLessThan(760);

    // Baking changes how many draws the layer takes, never how much is drawn.
    expect(countTriangles(environment)).toBeGreaterThan(30_000);
    expect(countTriangles(garden)).toBeGreaterThan(4_000);
    scope.dispose();
    expect(scope.size, 'the bake leaked tracked resources').toBe(0);
  });

  it('keeps the Workshoppable roots and the named garden features addressable', () => {
    const scope = new ResourceScope('bake-identity');
    const built = buildMuseum();
    const environment = new PersistentEnvironment(scope);
    const root = environment.build();
    const gardenBuilder = new ArrivalGarden(scope, built.collision);
    const garden = gardenBuilder.build();

    // The development Workshop attaches a transform gizmo to each of these by
    // object identity, so each must still be its own object with its own
    // transform after the bake.
    const roots = [...environment.authorableSceneRoots(), ...gardenBuilder.authorableSceneRoots()];
    expect(roots.length).toBeGreaterThan(8);
    for (const { id, root: node } of roots) {
      expect(node.parent, `${id} was removed by the bake`).not.toBeNull();
      expect(node.userData.noMerge, `${id} is not protected`).toBe(true);
      expect(countMeshes(node), `${id} lost its own meshes`).toBeGreaterThan(0);
    }

    // Scene features other systems and tests address by name.
    for (const name of ['night-island-water', 'night-island-terrain', 'night-island-shoreline']) {
      expect(garden.getObjectByName(name), `${name} was merged away`).toBeTruthy();
    }
    expect(root.children).toHaveLength(8);
    scope.dispose();
  });

  it('reports what it collapsed so the bake is never a silent change', () => {
    const scope = new ResourceScope('bake-report');
    const environment = new PersistentEnvironment(scope);
    environment.build();
    expect(environment.bake).toHaveLength(8);
    const merged = environment.bake.reduce((total, entry) => total + entry.merge.merged, 0);
    expect(merged, 'the static bake collapsed nothing').toBeGreaterThan(400);
    scope.dispose();
  });
});

describe('bakeStatic', () => {
  it('interns before merging so equal-valued materials actually group', () => {
    const scope = new ResourceScope('bake-order');
    const root = new THREE.Group();
    const geometry = scope.track(new THREE.BoxGeometry(1, 1, 1));
    for (let i = 0; i < 8; i++) {
      root.add(new THREE.Mesh(geometry, scope.track(
        new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.5 }),
      )));
    }
    const report = bakeStatic(root, scope);
    expect(report.interned).toBe(7);
    expect(report.merge.merged).toBe(8);
    expect(countMeshes(root)).toBe(1);
    scope.dispose();
  });
});
