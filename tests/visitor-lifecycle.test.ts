import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { SOURCE_VISITORS } from '../src/content/sourceParity';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { SourceVisitors } from '../src/world/SourceVisitors';
import { createVisitorGeometry, prepareVisitorGeometry } from '../src/world/VisitorVisuals';

const registrations = (im: InteractionManager) => (im as unknown as { controls: Map<unknown, unknown> }).controls.size;
const world = () => { const c = new CollisionWorld(); c.addFloor(-500, 500, -500, 500, 0); return c; };
const STEPS = SOURCE_VISITORS.length + 1; // shared kit + one step per visitor (pauses before the final step)
const rejections: unknown[] = [];
const onRejection = (reason: unknown) => { rejections.push(reason); };

beforeEach(() => { rejections.length = 0; process.on('unhandledRejection', onRejection); });
afterEach(() => { process.off('unhandledRejection', onRejection); });

describe('interrupted and repeated visitor preparation', () => {
  it('A: completes normally with every visitor registered once', async () => {
    const im = new InteractionManager();
    const scope = new ResourceScope('a');
    const kit = await prepareVisitorGeometry(SOURCE_VISITORS, async () => {});
    const v = SourceVisitors.fromKit(scope, world(), im, () => {}, kit);
    expect(v.count).toBe(17);
    expect(v.batch.instanceCount).toBe(327);
    expect(registrations(im)).toBe(17);
    v.dispose(); scope.dispose();
    expect(registrations(im)).toBe(0);
    expect(scope.size).toBe(0);
  });

  it('B/C: cancelled before the first step and halfway leaves nothing behind, and a later entry succeeds', async () => {
    for (const cancelAt of [1, Math.ceil(STEPS / 2)]) {
      let pauses = 0;
      await expect(prepareVisitorGeometry(SOURCE_VISITORS, async () => {
        if (++pauses >= cancelAt) throw new Error('cancelled');
      })).rejects.toThrow('cancelled');
    }
    const im = new InteractionManager();
    const scope = new ResourceScope('after-cancel');
    const kit = await prepareVisitorGeometry(SOURCE_VISITORS, async () => {});
    const v = SourceVisitors.fromKit(scope, world(), im, () => {}, kit);
    expect(v.count).toBe(17);
    expect(registrations(im)).toBe(17);
    v.dispose(); scope.dispose();
    expect(rejections).toEqual([]);
  });

  it('B/C: a cancelled preparation releases its templates and partial geometries', async () => {
    const created = new Set<THREE.BufferGeometry>();
    const disposed = new Set<THREE.BufferGeometry>();
    const proto = THREE.BufferGeometry.prototype;
    const originalDispose = proto.dispose;
    const originalSetAttribute = proto.setAttribute;
    proto.setAttribute = function (this: THREE.BufferGeometry, ...a: Parameters<typeof originalSetAttribute>) {
      created.add(this); return originalSetAttribute.apply(this, a);
    } as typeof originalSetAttribute;
    proto.dispose = function (this: THREE.BufferGeometry) { disposed.add(this); return originalDispose.call(this); };
    try {
      let pauses = 0;
      await expect(prepareVisitorGeometry(SOURCE_VISITORS, async () => {
        if (++pauses === 6) throw new Error('cancelled');
      })).rejects.toThrow('cancelled');
    } finally {
      proto.setAttribute = originalSetAttribute;
      proto.dispose = originalDispose;
    }
    expect(created.size).toBeGreaterThan(0);
    for (const geometry of created) expect(disposed.has(geometry), 'every geometry built before cancel is disposed').toBe(true);
  });

  it('D/E: a scope disposed before registration throws, releases the kit and registers nothing', async () => {
    const im = new InteractionManager();
    const scope = new ResourceScope('disposed-early');
    const kit = await prepareVisitorGeometry(SOURCE_VISITORS, async () => {});
    scope.dispose();
    const disposedKit: THREE.BufferGeometry[] = [];
    for (const geometry of Object.values(kit)) {
      const dispose = geometry.dispose.bind(geometry);
      geometry.dispose = () => { disposedKit.push(geometry); dispose(); };
    }
    expect(() => SourceVisitors.fromKit(scope, world(), im, () => {}, kit)).toThrow(/track\(\) after dispose/);
    expect(registrations(im)).toBe(0);
    expect(disposedKit).toHaveLength(Object.keys(kit).length);
  });

  it('D: a failure during hierarchy registration unbinds every visitor already registered', async () => {
    const im = new InteractionManager();
    const original = im.register.bind(im);
    let calls = 0;
    im.register = ((id: string, control: Parameters<typeof original>[1]) => {
      if (++calls === 9) throw new Error('registration failed');
      return original(id, control);
    }) as typeof im.register;
    const scope = new ResourceScope('d');
    const kit = createVisitorGeometry(SOURCE_VISITORS);
    expect(() => SourceVisitors.fromKit(scope, world(), im, () => {}, kit)).toThrow('registration failed');
    expect(registrations(im)).toBe(0);
    scope.dispose();
  });

  it('F: disposal right after construction is idempotent and stops updates and speech', () => {
    const im = new InteractionManager();
    const scope = new ResourceScope('f');
    const v = new SourceVisitors(scope, world(), im, () => {});
    const before = v.positions();
    v.dispose();
    v.dispose();
    scope.dispose();
    scope.dispose();
    v.update(1, false, 0, 0);
    expect(v.positions()).toEqual(before);
    expect(v.speak(SOURCE_VISITORS[0].id)).toBeNull();
    expect(registrations(im)).toBe(0);
    expect(scope.size).toBe(0);
  });

  it('G/H: rapid leave and re-enter never duplicates visitors or registrations; reduced motion still holds still', async () => {
    const im = new InteractionManager();
    let live: SourceVisitors | null = null;
    let scope: ResourceScope | null = null;
    for (let entry = 0; entry < 4; entry++) {
      live?.dispose(); scope?.dispose();
      scope = new ResourceScope(`entry-${entry}`);
      const kit = entry % 2 ? await prepareVisitorGeometry(SOURCE_VISITORS, async () => {}) : undefined;
      live = kit ? SourceVisitors.fromKit(scope, world(), im, () => {}, kit) : new SourceVisitors(scope, world(), im, () => {});
      expect(live.count).toBe(17);
      expect(registrations(im)).toBe(17);
    }
    const start = live!.positions();
    live!.update(1 / 60, true, 0, 0);
    expect(live!.positions()).toEqual(start);
    for (let i = 0; i < 90; i++) live!.update(1 / 60, false, 0, 0);
    expect(live!.positions()).not.toEqual(start);
    live!.dispose(); scope!.dispose();
    expect(registrations(im)).toBe(0);
    expect(rejections).toEqual([]);
  });
});
