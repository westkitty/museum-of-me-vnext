import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { installExhibits, scaffoldedExhibitIds } from '../src/exhibits';
import { createExhibit, definitionFor, registeredExhibitIds } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { StreamingManager } from '../src/exhibits/StreamingManager';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import { PLACEMENT_BY_EXHIBIT, type Vec3 } from '../src/world/layout';
import { buildMuseum } from './helpers/walk';

installExhibits();

const interaction = new InteractionManager();
const services = {
  addControl: (id: string, c: Parameters<InteractionManager['register']>[1]) => interaction.register(id, c),
  announce: () => {},
  reducedMotion: () => false,
  detailScale: () => 1,
};

function makeHost(id: string): ExhibitHost {
  const module = createExhibit(id)!;
  return new ExhibitHost(module, EXHIBITS_BY_ID.get(id)!, services);
}

/** The five deliberately different exhibits named by the plan's vertical slice. */
const SLICE = ['E01', 'E10', 'E19', 'E25', 'E13'];

describe('exhibit registry', () => {
  it('registers an implementation for all 35 exhibits', () => {
    expect(registeredExhibitIds()).toHaveLength(35);
  });

  it('derives every definition from the frozen mapping and the layout', () => {
    for (const record of EXHIBITS_BY_ID.values()) {
      const def = definitionFor(record.id);
      const placement = PLACEMENT_BY_EXHIBIT.get(record.id)!;
      expect(def.projectIds).toEqual(record.projectIds);
      expect(def.wing).toBe(record.wing);
      expect(def.anchor).toEqual(placement.anchor);
      expect(def.budgetMB).toBe({ A: 15, B: 8, C: 4 }[record.tier]);
    }
  });
});

describe('exhibit lifecycle (Phase 3 gate)', () => {
  beforeEach(() => interaction.dispose());

  it('takes five different exhibits through the full lifecycle independently', async () => {
    for (const id of SLICE) {
      const host = makeHost(id);
      expect(host.currentState, `${id} initial`).toBe('unloaded');

      await host.preload();
      expect(host.currentState, `${id} after preload`).toBe('loaded');

      host.mount();
      expect(host.currentState, `${id} after mount`).toBe('mounted');
      expect(host.group.children.length, `${id} built nothing`).toBeGreaterThan(0);
      expect(host.resourceCount, `${id} tracked nothing`).toBeGreaterThan(0);

      host.activate(0);
      expect(host.currentState, `${id} after activate`).toBe('active');
      expect(host.group.visible).toBe(true);

      host.update(1 / 60, [0, 1.6, 0], 0.5);

      host.deactivate();
      expect(host.currentState, `${id} after deactivate`).toBe('mounted');
      expect(host.group.visible).toBe(false);

      host.unmount();
      expect(host.currentState, `${id} after unmount`).toBe('loaded');
      expect(host.lastLeakCount, `${id} leaked resources`).toBe(0);
      expect(host.resourceCount, `${id} scope not drained`).toBe(0);
      expect(host.group.children.length, `${id} left objects behind`).toBe(0);

      host.dispose();
      expect(host.currentState, `${id} after dispose`).toBe('unloaded');
    }
  });

  it('reloads cleanly after a full unload, three times over', async () => {
    for (const id of SLICE) {
      const host = makeHost(id);
      let firstCount = 0;
      for (let cycle = 0; cycle < 3; cycle++) {
        await host.preload();
        host.mount();
        host.activate(0);
        host.update(1 / 60, [0, 1.6, 0], 0.1);
        const count = host.resourceCount;
        if (cycle === 0) firstCount = count;
        // Rebuilding must allocate the same amount each time, not accumulate.
        expect(count, `${id} cycle ${cycle} allocated ${count} vs ${firstCount}`).toBe(firstCount);
        host.unmount();
        expect(host.resourceCount, `${id} cycle ${cycle} drain`).toBe(0);
      }
      host.dispose();
    }
  });

  it('resets deterministically to the just-activated state', async () => {
    for (const id of SLICE) {
      const host = makeHost(id);
      await host.preload();
      host.mount();
      host.activate(0);
      const initial = host.module.getAccessibleContent().state;

      // Disturb it: run time forward and fire every control.
      for (let i = 0; i < 120; i++) host.update(1 / 60, [3, 1.6, 3], i / 60);
      interaction.update(cameraLookingAt(host));
      interaction.activate();
      for (let i = 0; i < 60; i++) host.update(1 / 60, [3, 1.6, 3], 2 + i / 60);

      host.reset();
      host.reset(); // idempotent
      expect(host.module.getAccessibleContent().state, `${id} reset`).toBe(initial);
      host.dispose();
    }
  });

  it('refuses illegal lifecycle transitions', () => {
    const host = makeHost('E01');
    expect(() => host.mount()).toThrow(/cannot mount/);
    expect(() => host.activate(0)).toThrow(/cannot activate/);
    // update on an inactive exhibit is a no-op, not a crash
    expect(() => host.update(1 / 60, [0, 0, 0], 0)).not.toThrow();
    host.dispose();
  });

  it('gives every exhibit accessible content with real interpretation', async () => {
    for (const record of EXHIBITS_BY_ID.values()) {
      const host = makeHost(record.id);
      await host.preload();
      host.mount();
      host.activate(0);
      const content = host.module.getAccessibleContent();
      expect(content.heading).toContain(record.title);
      expect(content.plaque.length).toBeGreaterThan(20);
      expect(content.body.length).toBeGreaterThanOrEqual(4);
      expect(content.controls.length, `${record.id} has no controls`).toBeGreaterThan(0);
      host.dispose();
    }
  });
});

describe('streaming', () => {
  it('loads exhibits on approach and releases them on departure', async () => {
    const built = buildMuseum();
    const streaming = new StreamingManager(built.mounts, services, {
      loadRadius: 30,
      unloadRadius: 42,
      activateRadius: 16,
      mountsPerFrame: 8,
    });
    streaming.initialise();
    expect(streaming.hosts.size).toBe(35);

    const target = PLACEMENT_BY_EXHIBIT.get('E01')!;
    const near: Vec3 = [target.anchor[0], target.anchor[1] + 1.6, target.anchor[2] + 2];
    const far: Vec3 = [500, 1.6, 500];

    // Approach: several frames so the queue drains under its per-frame budget.
    for (let i = 0; i < 12; i++) {
      streaming.evaluate(near, 1 / 60, 'north');
      await Promise.resolve();
      await Promise.resolve();
    }
    const host = streaming.get('E01')!;
    expect(host.currentState, 'E01 should be active when the visitor is beside it').toBe('active');
    expect(streaming.telemetry.resident).toBeGreaterThan(0);

    // Depart the wing entirely.
    for (let i = 0; i < 6; i++) streaming.evaluate(far, 1 / 60, 'plaza');
    expect(host.currentState, 'E01 should be released when the visitor leaves').toBe('loaded');
    expect(host.resourceCount, 'E01 should hold no resources when released').toBe(0);

    // Return: it must come back without a leak.
    for (let i = 0; i < 12; i++) {
      streaming.evaluate(near, 1 / 60, 'north');
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(host.currentState).toBe('active');
    expect(host.lastLeakCount).toBe(0);

    streaming.dispose();
    expect(streaming.totalResourceCount()).toBe(0);
  });

  it('never mounts more than its per-frame budget', async () => {
    const built = buildMuseum();
    const streaming = new StreamingManager(built.mounts, services, {
      loadRadius: 400,
      unloadRadius: 500,
      activateRadius: 400,
      mountsPerFrame: 2,
    });
    streaming.initialise();
    // The rotunda adjoins all four ground wings, so their exhibits are relevant.
    streaming.evaluate([0, 1.6, 0], 1 / 60, 'rotunda');
    await Promise.resolve();
    await Promise.resolve();
    streaming.evaluate([0, 1.6, 0], 1 / 60, 'rotunda');
    expect(streaming.telemetry.totalMounts).toBeLessThanOrEqual(4);
    expect(streaming.telemetry.totalMounts).toBeGreaterThan(0);
    streaming.dispose();
  });
});

describe('construction status', () => {
  it('reports which exhibits are still scaffolded', () => {
    // This is expected to shrink to zero by the Phase 9 content gate.
    expect(scaffoldedExhibitIds().length).toBeLessThanOrEqual(35);
  });
});

function cameraLookingAt(host: ExhibitHost): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(65, 1, 0.1, 100);
  const anchor = host.module.def.anchor;
  cam.position.set(anchor[0], anchor[1] + 1.6, anchor[2] + 3);
  cam.lookAt(anchor[0], anchor[1] + 1.6, anchor[2]);
  cam.updateMatrixWorld(true);
  return cam;
}
