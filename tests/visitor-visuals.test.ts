import * as THREE from 'three';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { SourceVisitors } from '../src/world/SourceVisitors';
import { buildMuseum } from './helpers/walk';
import { describe, expect, it } from 'vitest';
import { SOURCE_VISITORS, visitorRouteForVNext } from '../src/content/sourceParity';
import { createVisitorGeometry, prepareVisitorGeometry } from '../src/world/VisitorVisuals';

describe('authored visitor silhouettes and props', () => {
  it('gives each source visitor a distinct, bounded render kit inside the shared batch', () => {
    const geometries = createVisitorGeometry(SOURCE_VISITORS);
    try {
      const wardrobes = new Set<string>();
      for (const visitor of SOURCE_VISITORS) {
        const parts = ['torso', 'head', 'hair', 'prop'].map((part) => geometries[visitor.id + ':' + part]);
        for (const geometry of parts) {
          const vertices = geometry.getAttribute('position').count;
          expect(geometry.getAttribute('color').count).toBe(vertices);
          expect(geometry.getIndex()!.count / 3).toBeLessThan(900);
        }
        wardrobes.add(parts.map((part) => Array.from(part.getAttribute('position').array).join(',')).join('|'));
      }
      expect(wardrobes.size).toBe(SOURCE_VISITORS.length);
    } finally {
      for (const geometry of Object.values(geometries)) geometry.dispose();
    }
  });

  it('prepares the same kits cooperatively in bounded steps and can be abandoned cleanly', async () => {
    const reference = createVisitorGeometry(SOURCE_VISITORS);
    const slices: number[] = [];
    let pauses = 0;
    const prepared = await prepareVisitorGeometry(SOURCE_VISITORS, async () => { pauses++; }, (ms) => slices.push(ms));
    try {
      // One shared-kit step and one step per visitor, each followed by a pause,
      // then the final step that returns the finished kit.
      expect(slices).toHaveLength(SOURCE_VISITORS.length + 2);
      expect(pauses).toBe(SOURCE_VISITORS.length + 1);
      expect(Object.keys(prepared)).toEqual(Object.keys(reference));
      for (const key of Object.keys(reference)) {
        for (const name of ['position', 'normal', 'uv', 'color']) {
          expect(prepared[key].getAttribute(name).array, `${key}:${name}`)
            .toEqual(reference[key].getAttribute(name).array);
        }
        expect(prepared[key].getIndex()!.array, key).toEqual(reference[key].getIndex()!.array);
      }
    } finally {
      for (const geometry of [...Object.values(prepared), ...Object.values(reference)]) geometry.dispose();
    }
    // A rejected checkpoint (interior prep cancelled) propagates and leaves nothing running.
    await expect(prepareVisitorGeometry(SOURCE_VISITORS, async () => { throw new Error('cancelled'); }))
      .rejects.toThrow('cancelled');
  });

  it('builds an identical batch from pre-prepared kits and from its own synchronous kit', async () => {
    const make = async (prepare: boolean) => {
      const { collision, scope } = buildMuseum();
      const kit = prepare ? await prepareVisitorGeometry(SOURCE_VISITORS, async () => {}) : undefined;
      const visitors = new SourceVisitors(scope, collision, new InteractionManager(), () => {}, kit);
      return { visitors, scope };
    };
    const a = await make(false);
    const b = await make(true);
    try {
      expect(b.visitors.batch.instanceCount).toBe(a.visitors.batch.instanceCount);
      expect(b.visitors.batch.instanceCount).toBe(327);
      expect(b.visitors.positions()).toEqual(a.visitors.positions());
      expect(b.visitors.snapshot()).toEqual(a.visitors.snapshot());
      expect(b.scope.size).toBe(a.scope.size);
      expect(Array.from(b.visitors.batch.geometry.getAttribute('position').array))
        .toEqual(Array.from(a.visitors.batch.geometry.getAttribute('position').array));
    } finally {
      a.visitors.dispose(); b.visitors.dispose(); a.scope.dispose(); b.scope.dispose();
    }
  });

  it('packs a rotated camera lens with the original normals, UVs and rebased indices', () => {
    const visitor = SOURCE_VISITORS.find(({ id }) => id === 'visitor-katamari')!;
    const kit = createVisitorGeometry([visitor]);
    const camera = kit[visitor.id + ':prop'];
    const body = new THREE.BoxGeometry(1, 1, 1);
    const lens = new THREE.CylinderGeometry(1, 1, 1, 7)
      .scale(0.053, 0.07, 0.053)
      .rotateX(Math.PI / 2).rotateY(0).rotateZ(0)
      .translate(0, -0.012, 0.048);
    try {
      const startVertex = body.getAttribute('position').count;
      const startIndex = body.getIndex()!.count;
      for (const name of ['position', 'normal', 'uv']) {
        const expected = lens.getAttribute(name);
        const start = startVertex * expected.itemSize;
        expect(camera.getAttribute(name).array.slice(start, start + expected.array.length)).toEqual(expected.array);
      }
      const index = camera.getIndex()!.array;
      const lensIndex = lens.getIndex()!.array;
      expect(index.slice(startIndex, startIndex + lensIndex.length)).toEqual(
        Uint16Array.from(lensIndex, (entry) => entry + startVertex),
      );
      const [r, g, b] = new THREE.Color(0x565b61).toArray().map(Math.fround);
      expect(Array.from(camera.getAttribute('color').array.slice(startVertex * 3, (startVertex + 1) * 3)))
        .toEqual([r, g, b]);
    } finally {
      lens.dispose();
      body.dispose();
      for (const geometry of Object.values(kit)) geometry.dispose();
    }
  });

  it('retains independent buffers and palette colors for identical head shapes', () => {
    const actors = ['visitor-katamari', 'visitor-myth'];
    const kit = createVisitorGeometry(SOURCE_VISITORS.filter(({ id }) => actors.includes(id)));
    const [first, second] = actors.map((id) => kit[id + ':head']);
    try {
      for (const name of ['position', 'normal']) {
        const firstArray = first.getAttribute(name).array;
        const secondArray = second.getAttribute(name).array;
        expect(firstArray).toEqual(secondArray);
        expect(firstArray.buffer).not.toBe(secondArray.buffer);
      }
      expect(first.getAttribute('color').array[0]).not.toBe(second.getAttribute('color').array[0]);
    } finally {
      for (const geometry of Object.values(kit)) geometry.dispose();
    }
  });

  it('keeps the close-cropped hair above the scalp across the crown', () => {
    const visitors = SOURCE_VISITORS.filter(({ id }) => ['visitor-analyst', 'guard', 'student-b'].includes(id));
    const geometries = createVisitorGeometry(visitors);
    const material = new THREE.MeshBasicMaterial();
    const ray = new THREE.Raycaster();
    try {
      for (const { id } of visitors) {
        const scalp = new THREE.Mesh(geometries[id + ':head'], material);
        const crop = new THREE.Mesh(geometries[id + ':hair'], material);
        for (const [x, z] of [[0, -0.06], [0.22, 0.15], [-0.22, 0.15], [0, -0.28]]) {
          ray.ray.origin.set(x, 2, z);
          ray.ray.direction.set(0, -1, 0);
          const scalpDistance = ray.intersectObject(scalp)[0]!.distance;
          const hairDistance = ray.intersectObject(crop)[0]!.distance;
          expect(hairDistance, `${id} crown at ${x},${z}`).toBeLessThan(scalpDistance);
        }
      }
    } finally {
      material.dispose();
      for (const geometry of Object.values(geometries)) geometry.dispose();
    }
  });

  it('gives the cane and the sketcher’s stool geometry extending to the floor', () => {
    const geometries = createVisitorGeometry(SOURCE_VISITORS);
    try {
      const cane = geometries['visitor-access:prop'];
      const chair = geometries['sketcher-seat'];
      for (const geometry of [cane, chair]) geometry.computeBoundingBox();

      // The ferrule reaches the full grip height. The stool spans from the
      // seated pelvis to the floor, with its seat below the hips.
      expect(cane.boundingBox!.min.y).toBeCloseTo(-0.766, 3);
      expect(chair.boundingBox!.min.y).toBeCloseTo(-0.65, 2);
      expect(chair.boundingBox!.max.y).toBeLessThan(0.175);
    } finally {
      for (const geometry of Object.values(geometries)) geometry.dispose();
    }
  });
});

it('lets a reduced-motion visitor focus each authored person at first entry', () => {
  const { collision, scope } = buildMuseum();
  const interaction = new InteractionManager();
  const visitors = new SourceVisitors(scope, collision, interaction, () => {});
  const camera = new THREE.PerspectiveCamera();
  try {
    const original = visitors.positions();
    visitors.update(1 / 60, true, 0, 0);
    expect(visitors.positions()).toEqual(original);
    visitors.group.updateMatrixWorld(true);
    const unavailable: string[] = [];
    for (const person of original) {
      const actor = visitors.group.getObjectByName(`visitor:${person.id}`)!;
      const hit = actor.children.find((child) => child.userData.kind === 'visitor')!;
      const destination = new THREE.Vector3(person.x, person.y + hit.position.y, person.z);
      const approach = visitorRouteForVNext(person.id)[0];
      expect(collision.supportHeight(person.x, person.z, person.y, 0.075), person.id).toBeCloseTo(person.y, 1);
      expect(Math.hypot(person.x - approach[0], person.z - approach[2])).toBeLessThan(6);
      let reached = false;
      for (let i = 0; i < 8 && !reached; i++) {
        const angle = (i * Math.PI) / 4;
        camera.position.set(person.x + 1.8 * Math.cos(angle), person.y + 1.64, person.z + 1.8 * Math.sin(angle));
        camera.lookAt(destination);
        camera.updateMatrixWorld(true);
        interaction.update(camera);
        reached = interaction.currentFocus?.exhibitId === `visitor:${person.id}`;
      }
      if (!reached) unavailable.push(person.id);
    }
    expect(unavailable).toEqual([]);
  } finally {
    visitors.dispose();
    interaction.dispose();
    scope.dispose();
  }
});
