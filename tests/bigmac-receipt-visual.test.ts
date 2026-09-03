import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { installExhibits } from '../src/exhibits';
import { createExhibit } from '../src/exhibits/registry';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { AssetManager } from '../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import type { ResourceScope } from '../src/assets/ResourceScope';
import { resolveExhibitLabel, type ExhibitControl } from '../src/exhibits/contract';

installExhibits();

const assets = new AssetManager();

async function live() {
  const interaction = new InteractionManager();
  const captured: ExhibitControl[] = [];
  const originalRegister = interaction.register.bind(interaction);
  interaction.register = (exhibitId, control) => {
    captured.push(control);
    return originalRegister(exhibitId, control);
  };

  const module = createExhibit('E34')!;
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get('E34')!, {
    addControl: (exhibitId, c) => interaction.register(exhibitId, c),
    announce: () => {},
    reducedMotion: () => true,
    detailScale: () => 1,
    loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
      (await assets.load(assetId, scope, { detail })).object,
  });

  await host.preload();
  host.mount();
  host.activate(0);
  return { host, captured };
}

function control(captured: ExhibitControl[], label: string): ExhibitControl {
  const found = captured.find((c) => resolveExhibitLabel(c.label) === label);
  if (!found) throw new Error(`missing E34 control: ${label}`);
  return found;
}

function lamp(host: ExhibitHost, state: string): THREE.MeshStandardMaterial {
  const mesh = host.group.getObjectByName(`E34 receipt ${state}`) as THREE.Mesh;
  return mesh.material as THREE.MeshStandardMaterial;
}

describe('E34 visible evidence receipt contract', () => {
  it('keeps read-only requested, attempted and verified distinct without inventing a changed state', async () => {
    const { host, captured } = await live();
    control(captured, 'Select Inspect project').activate();

    expect(lamp(host, 'requested').emissiveIntensity).toBeGreaterThan(1);
    expect(lamp(host, 'attempted').emissiveIntensity).toBeLessThan(0.1);

    control(captured, 'Execute selected registered operation').activate();
    expect(lamp(host, 'attempted').emissiveIntensity).toBeGreaterThan(1);
    expect(lamp(host, 'changed').emissiveIntensity).toBeLessThan(0.1);
    expect(lamp(host, 'verified').emissiveIntensity).toBeLessThan(0.1);

    host.update(0.25, [0, 1.6, 4], 0);
    expect(lamp(host, 'verified').emissiveIntensity).toBeGreaterThan(1);
    expect(lamp(host, 'changed').emissiveIntensity).toBeLessThan(0.1);
    expect(host.module.getAccessibleContent().state).toContain('requested → attempted → verified');
    host.dispose();
  });

  it('blocks consequential work without preview, then records changed separately when the previewed route verifies', async () => {
    const { host, captured } = await live();
    const select = control(captured, 'Select Restart registered service');
    const execute = control(captured, 'Execute selected registered operation');
    const preview = control(captured, 'Preview the selected operation');

    select.activate();
    execute.activate();
    expect(lamp(host, 'requested').emissiveIntensity).toBeGreaterThan(1);
    expect(lamp(host, 'attempted').emissiveIntensity).toBeGreaterThan(1);
    expect(lamp(host, 'changed').emissiveIntensity).toBeLessThan(0.1);
    expect(lamp(host, 'verified').emissiveIntensity).toBeLessThan(0.1);

    preview.activate();
    execute.activate();
    for (let i = 0; i < 4; i++) host.update(0.25, [0, 1.6, 4], i * 0.25);

    expect(lamp(host, 'changed').emissiveIntensity).toBeGreaterThan(1);
    expect(lamp(host, 'verified').emissiveIntensity).toBeGreaterThan(1);
    expect(host.module.getAccessibleContent().state).toContain('requested → attempted → changed → verified');
    host.dispose();
  });
});
