import { expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { COLLECTION, EXHIBITS_BY_ID } from '../src/content/collection.generated';
import { EXHIBIT_DOORWAY_LINES } from '../src/content/exhibitDoorways';
import { installExhibits } from '../src/exhibits';
import { ExhibitHost } from '../src/exhibits/ExhibitHost';
import { resolveExhibitLabel, type ExhibitControl } from '../src/exhibits/contract';
import { createExhibit } from '../src/exhibits/registry';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { FoyerPreview } from '../src/world/FoyerPreview';

installExhibits();

async function mountExhibit(id: string) {
  const controls: ExhibitControl[] = [];
  const messages: string[] = [];
  const host = new ExhibitHost(createExhibit(id)!, EXHIBITS_BY_ID.get(id)!, {
    addControl: (_id, control) => { controls.push(control); return () => {}; },
    announce: (_id, message) => messages.push(message),
    reducedMotion: () => true,
    detailScale: () => 1,
    loadAsset: async () => new THREE.Group(),
  });
  await host.preload();
  host.mount();
  host.activate(0);

  function control(label: string): ExhibitControl {
    const found = controls.find((candidate) => resolveExhibitLabel(candidate.label) === label);
    if (!found) throw new Error(`Missing control: ${label}`);
    return found;
  }

  return { host, control, messages };
}

it('covers each existing doorway with a distinct invitation', () => {
  expect(Object.keys(EXHIBIT_DOORWAY_LINES).sort()).toEqual(COLLECTION.exhibits.map((exhibit) => exhibit.id).sort());
  expect(new Set(Object.values(EXHIBIT_DOORWAY_LINES)).size).toBe(35);
});

it('keeps the dismantling clock in step with the signed month and restores it on reset', async () => {
  const { host, control, messages } = await mountExhibit('E03');
  try {
    const sign = host.group.getObjectByName('orbital-tomb-month-label') as THREE.Mesh;
    const start = sign.material;
    const dial = control('Turn the dismantling clock');
    for (let i = 0; i < 3; i++) dial.activate();
    expect(sign.material).not.toBe(start);
    expect(messages.at(-1)).toContain('Month Three');
    expect(host.module.getAccessibleContent().state).toContain('the sky is visible through the frame');
    const monthThree = sign.material;
    host.reset();
    expect(sign.material).not.toBe(monthThree);
    expect(host.module.getAccessibleContent().state).toContain('Month Zero');
  } finally { host.dispose(); }
});

it('teaches the first planet action at its console and changes the readout after activation', async () => {
  const { host, control, messages } = await mountExhibit('E07');
  try {
    const readout = host.group.getObjectByName('drakken-planet-readout') as THREE.Mesh;
    const action = control('Heat the planet');
    const before = readout.material;
    action.activate();
    expect(readout.material).not.toBe(before);
    expect(messages.at(-1)).toContain('Heat applied · change 1');
    expect(resolveExhibitLabel(action.label)).toBe('Cool the planet');
    host.reset();
    expect(resolveExhibitLabel(action.label)).toBe('Heat the planet');
  } finally { host.dispose(); }
});

it('undoes the committed aftermath type even after the next type is selected', async () => {
  const { host, control, messages } = await mountExhibit('E30');
  try {
    const cast = control('Cast or advance the semantic ability');
    cast.activate();
    for (let step = 0; step < 4; step++) {
      cast.activate();
      for (let frame = 0; frame < 60; frame++) host.update(1 / 60, [0, 1.65, 2], frame / 60);
    }
    expect(messages.at(-1)).toContain('scorch');
    control('Choose what’s left behind').activate();
    expect(messages.at(-1)).toContain('frost');
    control('Remove the last mark').activate();
    expect(messages.at(-1)).toBe('Removed the last scorch mark.');
    expect(host.module.getAccessibleContent().state).toContain('0 persistent mutations');
  } finally { host.dispose(); }
});

it('offers a reachable, reversible foyer preview using the standard interaction manager', () => {
  const scope = new ResourceScope('foyer-signage');
  const interaction = new InteractionManager();
  const messages: string[] = [];
  const preview = new FoyerPreview(scope, interaction, (message) => messages.push(message));
  try {
    const window = preview.group.getObjectByName('foyer-star-window')!;
    const stars = preview.group.getObjectByName('foyer-stars-that-disappear')!;
    const target = window.getWorldPosition(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.65, 125);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const labels: Array<string | undefined> = [];
    interaction.onFocusChange((focus) => labels.push(focus?.label));
    interaction.update(camera);
    expect(interaction.currentFocus?.label).toBe('Watch stars disappear');
    expect(interaction.activate()).toBe(true);
    expect(stars.visible).toBe(false);
    expect(messages.at(-1)).toContain('A patch of the sky is empty now');
    expect(interaction.currentFocus?.label).toBe('Bring the stars back');
    expect(interaction.activate()).toBe(true);
    expect(stars.visible).toBe(true);
    expect(labels).toEqual(['Watch stars disappear', 'Bring the stars back', 'Watch stars disappear']);
  } finally {
    preview.dispose();
    expect(interaction.controlCount).toBe(0);
    scope.dispose();
  }
});
