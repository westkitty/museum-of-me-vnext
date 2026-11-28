import { describe, expect, it } from 'vitest';
import { SOURCE_VISITORS } from '../src/content/sourceParity';
import { bakedVisitorGeometry, bakedVisitorGeometryAvailable } from '../src/world/VisitorGeometryBake';
import { createVisitorGeometry } from '../src/world/VisitorVisuals';

// The committed bytes must equal what the live composer produces. If this
// fails, a visitor record or VisitorVisuals changed: run `npm run build:collection`.
describe.skipIf(!bakedVisitorGeometryAvailable())('baked visitor geometry', () => {
  it('is byte-identical to the live composer for all geometries, bounds and layout', () => {
    const live = createVisitorGeometry(SOURCE_VISITORS);
    const baked = bakedVisitorGeometry()!;
    try {
      expect(Object.keys(baked)).toEqual(Object.keys(live));
      expect(Object.keys(baked)).toHaveLength(78);
      for (const key of Object.keys(live)) {
        const a = live[key];
        const b = baked[key];
        expect(Object.keys(b.attributes), key).toEqual(Object.keys(a.attributes));
        for (const name of Object.keys(a.attributes)) {
          const x = a.getAttribute(name);
          const y = b.getAttribute(name);
          expect(y.itemSize).toBe(x.itemSize);
          expect(y.count).toBe(x.count);
          expect(Buffer.from(y.array.buffer, y.array.byteOffset, y.array.byteLength)
            .equals(Buffer.from(x.array.buffer, x.array.byteOffset, x.array.byteLength)), `${key}:${name}`).toBe(true);
        }
        expect(b.getIndex()!.array.constructor).toBe(a.getIndex()!.array.constructor);
        expect(Buffer.from(b.getIndex()!.array.buffer, b.getIndex()!.array.byteOffset, b.getIndex()!.array.byteLength)
          .equals(Buffer.from(a.getIndex()!.array.buffer, a.getIndex()!.array.byteOffset, a.getIndex()!.array.byteLength)), `${key}:index`).toBe(true);
        a.computeBoundingBox();
        a.computeBoundingSphere();
        expect(b.boundingBox!.equals(a.boundingBox!), `${key}:bbox`).toBe(true);
        expect(b.boundingSphere!.equals(a.boundingSphere!), `${key}:sphere`).toBe(true);
      }
    } finally {
      for (const geometry of [...Object.values(live), ...Object.values(baked)]) geometry.dispose();
    }
  });

  it('decodes fresh independent buffers on every call (no shared mutable state)', () => {
    const first = bakedVisitorGeometry()!;
    const second = bakedVisitorGeometry()!;
    try {
      const key = Object.keys(first)[0];
      first[key].getAttribute('position').array[0] += 1;
      expect(second[key].getAttribute('position').array[0]).not.toBe(first[key].getAttribute('position').array[0]);
    } finally {
      for (const geometry of [...Object.values(first), ...Object.values(second)]) geometry.dispose();
    }
  });
});

describe('decoder paths', () => {
  it('without native Uint8Array.fromBase64 the baked path declines and the composer output is identical', async () => {
    const original = (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64;
    if (!original) return; // runtime already lacks it: nothing to remove
    const composedBefore = createVisitorGeometry(SOURCE_VISITORS);
    delete (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64;
    try {
      expect(bakedVisitorGeometryAvailable()).toBe(false);
      expect(bakedVisitorGeometry()).toBeNull();
      // The paced fallback used by InteriorWorld and the synchronous default in SourceVisitors still complete,
      // and produce exactly what the composer always produced.
      const { prepareVisitorGeometry } = await import('../src/world/VisitorVisuals');
      const paced = await prepareVisitorGeometry(SOURCE_VISITORS, async () => {});
      const { SourceVisitors } = await import('../src/world/SourceVisitors');
      const { ResourceScope } = await import('../src/assets/ResourceScope');
      const { CollisionWorld } = await import('../src/world/CollisionWorld');
      const { InteractionManager } = await import('../src/interaction/InteractionManager');
      const scope = new ResourceScope('fallback');
      const world = new CollisionWorld();
      world.addFloor(-500, 500, -500, 500, 0);
      const visitors = new SourceVisitors(scope, world, new InteractionManager(), () => {});
      try {
        expect(visitors.count).toBe(17);
        expect(visitors.batch.instanceCount).toBe(327);
        for (const key of Object.keys(composedBefore)) {
          expect(Buffer.from(paced[key].getAttribute('position').array.buffer).equals(
            Buffer.from(composedBefore[key].getAttribute('position').array.buffer)), key).toBe(true);
        }
      } finally {
        visitors.dispose();
        scope.dispose();
        for (const geometry of Object.values(paced)) geometry.dispose();
      }
    } finally {
      (Uint8Array as unknown as { fromBase64?: unknown }).fromBase64 = original;
      for (const geometry of Object.values(composedBefore)) geometry.dispose();
    }
    expect(bakedVisitorGeometryAvailable()).toBe(true);
  });

  it('with the native decoder, a default SourceVisitors batch equals one built from procedural geometry', async () => {
    const { SourceVisitors } = await import('../src/world/SourceVisitors');
    const { ResourceScope } = await import('../src/assets/ResourceScope');
    const { CollisionWorld } = await import('../src/world/CollisionWorld');
    const { InteractionManager } = await import('../src/interaction/InteractionManager');
    const make = (kit?: Record<string, import('three').BufferGeometry>) => {
      const scope = new ResourceScope('s');
      const world = new CollisionWorld();
      world.addFloor(-500, 500, -500, 500, 0);
      return { scope, visitors: new SourceVisitors(scope, world, new InteractionManager(), () => {}, kit) };
    };
    const baked = make();
    const composed = make(createVisitorGeometry(SOURCE_VISITORS));
    try {
      const a = baked.visitors.batch.geometry;
      const b = composed.visitors.batch.geometry;
      for (const name of Object.keys(a.attributes)) {
        expect(Buffer.from(a.getAttribute(name).array.buffer).equals(Buffer.from(b.getAttribute(name).array.buffer)), name).toBe(true);
      }
      expect(Buffer.from(a.getIndex()!.array.buffer).equals(Buffer.from(b.getIndex()!.array.buffer))).toBe(true);
      expect(baked.visitors.snapshot()).toEqual(composed.visitors.snapshot());
      expect(baked.visitors.positions()).toEqual(composed.visitors.positions());
    } finally {
      baked.visitors.dispose(); composed.visitors.dispose(); baked.scope.dispose(); composed.scope.dispose();
    }
  });
});
