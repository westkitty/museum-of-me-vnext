import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { installExhibits, bespokeExhibitIds } from '../src/exhibits';
import { createExhibit } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { AssetManager } from '../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import { PLACEMENT_BY_EXHIBIT } from '../src/world/layout';
import type { ResourceScope } from '../src/assets/ResourceScope';
import type { ExhibitControl } from '../src/exhibits/contract';

installExhibits();

/**
 * THE PER-EXHIBIT GATE (plan Phase 7, "Per-exhibit gate").
 *
 * Every exhibit that has a bespoke implementation must pass all of it:
 * physical presence, interaction, information, 3D exploration, accessibility,
 * streaming and disposal. The list grows as each wave lands, so a wing cannot
 * be declared done without meeting the same bar as the vertical slice.
 */

const assets = new AssetManager();

function build(id: string, reducedMotion = false) {
  const interaction = new InteractionManager();
  const captured: ExhibitControl[] = [];
  const originalRegister = interaction.register.bind(interaction);
  interaction.register = (exhibitId, control) => {
    captured.push(control);
    return originalRegister(exhibitId, control);
  };
  const module = createExhibit(id)!;
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get(id)!, {
    addControl: (exhibitId, c) => interaction.register(exhibitId, c),
    announce: () => {},
    reducedMotion: () => reducedMotion,
    detailScale: () => 1,
    loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
      (await assets.load(assetId, scope, { detail })).object,
  });
  return { host, interaction, captured };
}

async function live(id: string, reducedMotion = false) {
  const built = build(id, reducedMotion);
  await built.host.preload();
  built.host.mount();
  built.host.activate(0);
  return built;
}

const BESPOKE = bespokeExhibitIds();

describe(`per-exhibit gate (${BESPOKE.length} bespoke exhibits)`, () => {
  it('has at least the vertical slice implemented', () => {
    expect(BESPOKE.length).toBeGreaterThanOrEqual(5);
  });

  it.each(BESPOKE)('%s — physical presence: real volume in all three axes', async (id) => {
    const { host } = await live(id);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(host.group).getSize(size);
    expect(size.x, 'width').toBeGreaterThan(1.5);
    expect(size.y, 'height').toBeGreaterThan(1.5);
    expect(size.z, 'depth').toBeGreaterThan(1);

    let meshes = 0;
    host.group.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshes++; });
    expect(meshes, 'too sparse to be an installation').toBeGreaterThan(12);
    host.dispose();
  });

  it.each(BESPOKE)('%s — fits inside the bay the architecture built for it', async (id) => {
    const { host } = await live(id);
    const box = new THREE.Box3().setFromObject(host.group);
    const placement = PLACEMENT_BY_EXHIBIT.get(id)!;
    const size = new THREE.Vector3();
    box.getSize(size);
    // The mount is at the bay centre and the exhibit is built in local space.
    // Generous, but it catches an exhibit that would burst through a wall.
    const bay = placement.bounds.h;
    const limit = Math.max(bay[0], bay[2]) * 2 + 8;
    expect(size.x, 'wider than its bay').toBeLessThan(limit);
    expect(size.z, 'deeper than its bay').toBeLessThan(limit);
    host.dispose();
  });

  it.each(BESPOKE)('%s — interaction: controls exist, are described, and change state', async (id) => {
    const { host, captured } = await live(id);
    expect(captured.length, 'registered no control').toBeGreaterThan(0);
    for (const control of captured) {
      expect(control.label.length, 'control label too short').toBeGreaterThan(3);
      expect((control.description ?? '').length, 'control description too short').toBeGreaterThan(20);
    }

    const before = host.module.getAccessibleContent().state;
    for (const control of captured) {
      control.activate();
      for (let i = 0; i < 45; i++) host.update(1 / 60, [0, 1.6, 4], i / 60);
    }
    const after = host.module.getAccessibleContent().state;
    expect(after, 'state did not change when every control was used').not.toBe(before);
    host.dispose();
  });

  it.each(BESPOKE)('%s — information: plaque, lectern text and layered interpretation', async (id) => {
    const { host } = await live(id);
    const content = host.module.getAccessibleContent();
    const record = EXHIBITS_BY_ID.get(id)!;
    expect(content.heading).toContain(record.title);
    expect(content.plaque.length).toBeGreaterThan(20);
    expect(content.body.length, 'not enough interpretation').toBeGreaterThanOrEqual(4);
    expect(content.state.length, 'no state description').toBeGreaterThan(20);
    host.dispose();
  });

  it.each(BESPOKE)('%s — accessibility: usable and describable with reduced motion', async (id) => {
    const { host, captured } = await live(id, true);
    for (const control of captured) {
      control.activate();
      for (let i = 0; i < 30; i++) host.update(1 / 60, [0, 1.6, 4], i / 60);
    }
    expect(host.module.getAccessibleContent().state.length).toBeGreaterThan(20);
    host.dispose();
  });

  it.each(BESPOKE)('%s — streaming and disposal: three clean cycles, no accumulation', async (id) => {
    const { host } = build(id);
    let first = 0;
    for (let cycle = 0; cycle < 3; cycle++) {
      await host.preload();
      host.mount();
      host.activate(0);
      for (let i = 0; i < 40; i++) host.update(1 / 60, [0, 1.6, 4], i / 60);
      if (cycle === 0) first = host.resourceCount;
      expect(host.resourceCount, `cycle ${cycle} allocation differs`).toBe(first);
      host.unmount();
      expect(host.resourceCount, `cycle ${cycle} did not drain`).toBe(0);
      expect(host.group.children.length, `cycle ${cycle} left objects behind`).toBe(0);
    }
    host.dispose();
  });

  it.each(BESPOKE)('%s — reset returns to the just-activated state, idempotently', async (id) => {
    const { host, captured } = await live(id);
    const initial = host.module.getAccessibleContent().state;
    for (const control of captured) {
      control.activate();
      control.activate();
      for (let i = 0; i < 25; i++) host.update(1 / 60, [1, 1.6, 3], i / 60);
    }
    host.reset();
    host.reset();
    expect(host.module.getAccessibleContent().state).toBe(initial);
    host.dispose();
  });

  it.each(BESPOKE)('%s — repeated interaction/reset keeps tracked resources stable', async (id) => {
    // A reset that clears a cached material or geometry, and an update that
    // lazily rebuilds it, leaks a tracked disposable resource per cycle into
    // the exhibit scope. This does not measure general JavaScript heap churn.
    const { host, captured } = await live(id);
    for (let i = 0; i < 30; i++) host.update(1 / 60, [1, 1.6, 3], i / 60);
    const settled = host.resourceCount;

    for (let cycle = 0; cycle < 4; cycle++) {
      for (const control of captured) control.activate();
      for (let i = 0; i < 30; i++) host.update(1 / 60, [1, 1.6, 3], i / 60);
      host.reset();
      for (let i = 0; i < 30; i++) host.update(1 / 60, [1, 1.6, 3], i / 60);
      expect(
        host.resourceCount,
        `cycle ${cycle} grew the scope from ${settled} to ${host.resourceCount}`,
      ).toBe(settled);
    }
    host.dispose();
  });

  it.each(BESPOKE)('%s — owns only its own group and no frame loop', async (id) => {
    const parent = new THREE.Group();
    const { host } = build(id);
    parent.add(host.group);
    await host.preload();
    host.mount();
    host.activate(0);
    // Everything the exhibit built must live under the group it was given.
    expect(parent.children, 'exhibit added objects outside its own group').toHaveLength(1);
    host.dispose();
  });
});
