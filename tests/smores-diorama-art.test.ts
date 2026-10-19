import { expect, it } from 'vitest';
import * as THREE from 'three';
import { installExhibits } from '../src/exhibits';
import { createExhibit } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import type { ExhibitControl } from '../src/exhibits/contract';

it('keeps S’mores rolling and collecting while sharing its miniature-town draw resources', async () => {
  installExhibits();
  const module = createExhibit('E32')!;
  const controls: ExhibitControl[] = [];
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get('E32')!, {
    addControl: (_id, control) => { controls.push(control); return () => {}; },
    announce: () => {},
    reducedMotion: () => false,
    detailScale: () => 1,
    loadAsset: async () => new THREE.Group(),
  });
  for (let cycle = 0; cycle < 2; cycle++) {
    await host.preload();
    host.mount();
    host.activate(0);
    const group = host.group;
    const houses = group.getObjectByName('smores-town-houses') as THREE.InstancedMesh;
    const roofs = group.getObjectByName('smores-town-roofs') as THREE.InstancedMesh;
    const windows = group.getObjectByName('smores-town-windows') as THREE.InstancedMesh;
    const roads = group.getObjectByName('smores-town-road-markings') as THREE.InstancedMesh;
    expect(houses.isInstancedMesh).toBe(true);
    expect(houses.count).toBe(26);
    expect(roofs.count).toBe(26);
    expect(windows.count).toBe(52);
    expect(roads.count).toBe(36);
    const pickups: THREE.InstancedMesh[] = [];
    group.traverse((node) => {
      const mesh = node as THREE.InstancedMesh;
      if (mesh.isInstancedMesh && mesh.name.startsWith('smores-pickup-batch:')) pickups.push(mesh);
    });
    expect(pickups.length).toBeGreaterThanOrEqual(4);
    expect(pickups.length).toBeLessThanOrEqual(5);
    expect(pickups.reduce((count, pickup) => count + pickup.count, 0)).toBe(54);
    expect(new Set(pickups.map((pickup) => pickup.geometry.name)).size).toBeGreaterThan(3);
    expect(pickups.every((pickup) => pickup.instanceMatrix.usage === THREE.DynamicDrawUsage)).toBe(true);
    expect(group.getObjectByName('smores-layered-katamari-ball')?.children).toHaveLength(3);
    const roll = controls.find((c) => c.label === 'Roll the ball');
    expect(roll).toBeDefined();
    const before = module.getAccessibleContent().state;
    // The test deliberately puts one real collectible on the authored
    // figure-eight so collection and the GPU instance both have to move.
    const runtime = module as unknown as {
      items: THREE.Vector3[];
      itemTier: number[];
      itemBatchSlots: number[];
      pickupBatches: Array<THREE.InstancedMesh | null>;
      collected: boolean[];
    };
    const capIndex = runtime.itemTier.indexOf(0);
    expect(capIndex).toBeGreaterThanOrEqual(0);
    runtime.items[capIndex].set(0, 0.09, 0);
    roll!.activate();
    for (let i = 0; i < 120; i++) host.update(1 / 60, [0, 1.6, 4], i / 60);
    expect(runtime.collected[capIndex]).toBe(true);
    const capMatrix = new THREE.Matrix4();
    runtime.pickupBatches[0]!.getMatrixAt(runtime.itemBatchSlots[capIndex], capMatrix);
    expect(new THREE.Vector3().setFromMatrixPosition(capMatrix).distanceTo(runtime.items[capIndex])).toBeLessThan(0.0001);
    expect(module.getAccessibleContent().state).not.toBe(before);
    host.reset();
    expect(runtime.collected[capIndex]).toBe(false);
    runtime.pickupBatches[0]!.getMatrixAt(runtime.itemBatchSlots[capIndex], capMatrix);
    expect(new THREE.Vector3().setFromMatrixPosition(capMatrix).distanceTo(runtime.items[capIndex])).toBeLessThan(0.0001);
    host.unmount();
    expect(host.resourceCount).toBe(0);
    expect(host.group.children).toHaveLength(0);
    controls.length = 0;
  }
  host.dispose();
});
