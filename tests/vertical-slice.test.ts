import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { installExhibits, bespokeCount, scaffoldedExhibitIds } from '../src/exhibits';
import { createExhibit } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { AssetManager } from '../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import type { ResourceScope } from '../src/assets/ResourceScope';

installExhibits();

/** The five named by the plan, and what each one is there to prove. */
const SLICE = [
  { id: 'E01', proves: 'large spatial sculpture' },
  { id: 'E10', proves: 'sequence and history' },
  { id: 'E19', proves: 'device interaction' },
  { id: 'E25', proves: 'a miniature game' },
  { id: 'E13', proves: 'audio' },
] as const;

const assets = new AssetManager();

function host(id: string, reducedMotion = false): { host: ExhibitHost; interaction: InteractionManager } {
  const interaction = new InteractionManager();
  const module = createExhibit(id)!;
  const h = new ExhibitHost(module, EXHIBITS_BY_ID.get(id)!, {
    addControl: (exhibitId, c) => interaction.register(exhibitId, c),
    announce: () => {},
    reducedMotion: () => reducedMotion,
    detailScale: () => 1,
    loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
      (await assets.load(assetId, scope, { detail })).object,
  });
  return { host: h, interaction };
}

async function live(id: string, reducedMotion = false) {
  const { host: h, interaction } = host(id, reducedMotion);
  await h.preload();
  h.mount();
  h.activate(0);
  return { h, interaction };
}

describe('vertical slice (Phase 5 gate)', () => {
  it('implements all five slice exhibits bespoke, not scaffolded', () => {
    expect(bespokeCount()).toBeGreaterThanOrEqual(5);
    const scaffolded = new Set(scaffoldedExhibitIds());
    for (const { id } of SLICE) {
      expect(scaffolded.has(id), `${id} is still scaffolded`).toBe(false);
    }
  });

  it('gives each slice exhibit real 3D presence, not planes', async () => {
    for (const { id, proves } of SLICE) {
      const { h } = await live(id);
      const box = new THREE.Box3().setFromObject(h.group);
      const size = new THREE.Vector3();
      box.getSize(size);
      expect(size.x, `${id} (${proves}) has no width`).toBeGreaterThan(1.5);
      expect(size.y, `${id} (${proves}) has no height`).toBeGreaterThan(1.5);
      expect(size.z, `${id} (${proves}) has no depth`).toBeGreaterThan(1);

      let meshes = 0;
      h.group.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshes++; });
      expect(meshes, `${id} is too sparse to be an installation`).toBeGreaterThan(12);
      h.dispose();
    }
  });

  it('gives each slice exhibit at least one meaningful interaction', async () => {
    for (const { id } of SLICE) {
      const { h, interaction } = await live(id);
      expect(interaction.controlCount, `${id} registered no control`).toBeGreaterThan(0);
      const content = h.module.getAccessibleContent();
      for (const control of content.controls) {
        expect(control.label.length, `${id} control label`).toBeGreaterThan(3);
        expect(control.description.length, `${id} control description`).toBeGreaterThan(20);
      }
      h.dispose();
    }
  });

  it('changes observable state when its controls are used', async () => {
    for (const { id } of SLICE) {
      const { h } = await live(id);
      const before = h.module.getAccessibleContent().state;

      // Fire every registered control, stepping time between them.
      const controls = h.module.getAccessibleContent().controls;
      expect(controls.length).toBeGreaterThan(0);
      const interaction = new InteractionManager();
      void interaction;

      // Reach the controls through the host's own service wiring by rebuilding
      // with a capturing interaction manager.
      const captured: { activate: () => void }[] = [];
      const fresh = host(id);
      await fresh.host.preload();
      const originalRegister = fresh.interaction.register.bind(fresh.interaction);
      fresh.interaction.register = (exhibitId, control) => {
        captured.push(control);
        return originalRegister(exhibitId, control);
      };
      fresh.host.mount();
      fresh.host.activate(0);

      for (const control of captured) {
        control.activate();
        for (let i = 0; i < 30; i++) fresh.host.update(1 / 60, [0, 1.6, 4], i / 60);
      }
      const after = fresh.host.module.getAccessibleContent().state;
      expect(after, `${id} state did not change when its controls were used`).not.toBe(before);

      fresh.host.dispose();
      h.dispose();
    }
  });

  it('stays usable with reduced motion on', async () => {
    for (const { id } of SLICE) {
      const { h } = await live(id, true);
      // Running with reduced motion must not throw and must still describe state.
      for (let i = 0; i < 120; i++) h.update(1 / 60, [0, 1.6, 4], i / 60);
      expect(h.module.getAccessibleContent().state.length).toBeGreaterThan(20);
      h.dispose();
    }
  });

  it('survives a full streaming cycle without accumulating', async () => {
    for (const { id } of SLICE) {
      const { host: h } = host(id);
      let first = 0;
      for (let cycle = 0; cycle < 3; cycle++) {
        await h.preload();
        h.mount();
        h.activate(0);
        for (let i = 0; i < 60; i++) h.update(1 / 60, [0, 1.6, 4], i / 60);
        if (cycle === 0) first = h.resourceCount;
        expect(h.resourceCount, `${id} cycle ${cycle}`).toBe(first);
        h.unmount();
        expect(h.resourceCount, `${id} drain ${cycle}`).toBe(0);
        expect(h.group.children.length, `${id} objects left ${cycle}`).toBe(0);
      }
      h.dispose();
    }
  });

  it('resets every slice exhibit to a deterministic starting state', async () => {
    for (const { id } of SLICE) {
      const captured: { activate: () => void }[] = [];
      const fresh = host(id);
      const originalRegister = fresh.interaction.register.bind(fresh.interaction);
      fresh.interaction.register = (exhibitId, control) => {
        captured.push(control);
        return originalRegister(exhibitId, control);
      };
      await fresh.host.preload();
      fresh.host.mount();
      fresh.host.activate(0);
      const initial = fresh.host.module.getAccessibleContent().state;

      for (const control of captured) {
        control.activate();
        control.activate();
        for (let i = 0; i < 20; i++) fresh.host.update(1 / 60, [1, 1.6, 3], i / 60);
      }
      fresh.host.reset();
      fresh.host.reset();
      expect(fresh.host.module.getAccessibleContent().state, `${id} reset`).toBe(initial);
      fresh.host.dispose();
    }
  });
});
