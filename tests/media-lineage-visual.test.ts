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

async function live(reducedMotion = false) {
  const interaction = new InteractionManager();
  const captured: ExhibitControl[] = [];
  const originalRegister = interaction.register.bind(interaction);
  interaction.register = (exhibitId, control) => {
    captured.push(control);
    return originalRegister(exhibitId, control);
  };

  const module = createExhibit('E16')!;
  const host = new ExhibitHost(module, EXHIBITS_BY_ID.get('E16')!, {
    addControl: (exhibitId, c) => interaction.register(exhibitId, c),
    announce: () => {},
    reducedMotion: () => reducedMotion,
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
  if (!found) throw new Error(`missing E16 control: ${label}`);
  return found;
}

function advanceFrames(host: ExhibitHost, frames = 30): void {
  for (let i = 0; i < frames; i++) host.update(1 / 60, [0, 1.6, 4], i / 60);
}

describe('E16 visible transformation contract', () => {
  it('changes the visible character representation without replacing the performance fixture', async () => {
    const { host, captured } = await live();
    const a = host.group.getObjectByName('E16 character reference A')!;
    const b = host.group.getObjectByName('E16 character reference B')!;
    const source = host.group.getObjectByName('E16 source performer')!;

    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
    expect(source.visible).toBe(true);

    control(captured, 'Change character representation').activate();

    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    expect(source.visible).toBe(true);
    host.dispose();
  });

  it('changes the visible background independently from character and source motion', async () => {
    const { host, captured } = await live();
    const studio = host.group.getObjectByName('E16 background studio')!;
    const night = host.group.getObjectByName('E16 background night museum')!;
    const character = host.group.getObjectByName('E16 character reference A')!;
    const source = host.group.getObjectByName('E16 source performer')!;

    expect(studio.visible).toBe(true);
    expect(night.visible).toBe(false);

    control(captured, 'Change composite background').activate();

    expect(studio.visible).toBe(false);
    expect(night.visible).toBe(true);
    expect(character.visible).toBe(true);
    expect(source.visible).toBe(true);
    host.dispose();
  });

  it('reveals portable-state, matte, and verification layers as the pipeline advances', async () => {
    const { host, captured } = await live(true);
    const advance = control(captured, 'Advance the performance/media pipeline');
    const marker = host.group.children.find((child) => child instanceof THREE.Mesh && child.geometry.type === 'SphereGeometry' && child.position.x === -2.05 && child.position.y === 2.38) as THREE.Mesh | undefined;
    const matte = host.group.getObjectByName('E16 soft alpha matte') as THREE.Mesh;
    const lamp = host.group.getObjectByName('E16 verification lamp 1') as THREE.Mesh;

    expect(marker?.visible).toBe(false);
    expect(matte.visible).toBe(false);

    advance.activate(); advanceFrames(host);
    expect(marker?.visible).toBe(true);

    advance.activate(); advanceFrames(host);
    advance.activate(); advanceFrames(host);
    expect(matte.visible).toBe(true);

    advance.activate(); advanceFrames(host);
    advance.activate(); advanceFrames(host);
    expect((lamp.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(1);
    host.dispose();
  });
});
