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

  const module = createExhibit('E11')!;
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get('E11')!, {
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
  if (!found) throw new Error(`missing E11 control: ${label}`);
  return found;
}

function station(host: ExhibitHost, index: number): THREE.Mesh {
  return host.group.getObjectByName(`E11 recovery station ${index}`) as THREE.Mesh;
}

describe('E11 He-Maker recovery visualization', () => {
  it('moves the recovery packet through four visibly distinct stages', async () => {
    const { host, captured } = await live();
    const advance = control(captured, 'Advance the He-Maker recovery case');
    const token = host.group.getObjectByName('E11 recovery token') as THREE.Mesh;
    const initialX = token.position.x;

    expect((station(host, 0).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1.2);
    expect((station(host, 1).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.08);
    expect(host.module.getAccessibleContent().state).toContain('Loose files');

    advance.activate();
    host.update(1 / 60, [0, 1.6, 4], 0);
    expect(token.position.x).toBeGreaterThan(initialX);
    expect((station(host, 0).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.42);
    expect((station(host, 1).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1.2);
    expect(host.module.getAccessibleContent().state).toContain('Repository');

    advance.activate();
    host.update(1 / 60, [0, 1.6, 4], 1 / 60);
    expect(host.module.getAccessibleContent().state).toContain('Intent & history');

    advance.activate();
    host.update(1 / 60, [0, 1.6, 4], 2 / 60);
    expect((station(host, 3).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1.2);
    expect(host.module.getAccessibleContent().state).toContain('Durable record');
    host.dispose();
  });

  it('resets the recovery case to loose files without disturbing the authority desk contract', async () => {
    const { host, captured } = await live();
    const advance = control(captured, 'Advance the He-Maker recovery case');

    advance.activate();
    advance.activate();
    host.update(1 / 60, [0, 1.6, 4], 0);
    host.reset();

    expect(host.module.getAccessibleContent().state).toContain('Loose files');
    expect(host.module.getAccessibleContent().state).toContain('observed record');
    expect((station(host, 0).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1.2);
    expect((station(host, 1).material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.08);
    host.dispose();
  });
});
