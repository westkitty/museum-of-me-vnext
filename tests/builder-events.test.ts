import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWorkshopActivation } from '../src/workshop/BuilderEvents';
import { validateWorkshopManifest, type WorkshopPlacementRecord } from '../src/workshop/schema';

const base: WorkshopPlacementRecord = {
  id: 'sculpture-sphere-01',
  label: 'The Witness',
  prefab: 'sculpture-sphere',
  anchor: 'floor',
  position: [250, 0, 250],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  collision: 'none',
  worldId: 'exterior',
};

function validate(record: unknown) {
  return validateWorkshopManifest({ schemaVersion: 1, objects: [record] });
}

describe('Museum Builder safe events', () => {
  it('allows bounded literal messages and target colors without evaluating code', () => {
    expect(validate({ ...base, event: 'message', eventMessage: 'Look behind the sculpture.' }).ok).toBe(true);
    expect(validate({ ...base, event: 'toggle-glow', eventColor: '#C0FFEE' }).value?.objects[0]).toMatchObject({
      event: 'toggle-glow', eventColor: '#c0ffee',
    });
    expect(validate({ ...base, event: 'toggle-tint', eventColor: '#c0ffee' }).ok).toBe(true);
    expect(validate({ ...base, event: 'script', eventMessage: 'alert(1)' }).ok).toBe(false);
    expect(validate({ ...base, event: 'message' }).ok).toBe(false);
    expect(validate({ ...base, event: 'message', eventMessage: ' '.repeat(20) }).ok).toBe(false);
    expect(validate({ ...base, event: 'message', eventMessage: 'x'.repeat(161) }).ok).toBe(false);
    expect(validate({ ...base, event: 'toggle-glow', eventColor: 'javascript:alert(1)' }).ok).toBe(false);
    expect(validate({ ...base, event: 'none', eventMessage: 'orphan' }).ok).toBe(false);
    expect(validate({ ...base, event: 'announce', eventColor: '#fafafa' }).ok).toBe(false);
  });

  it('shows the author-provided message literally without touching geometry or materials', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: '#eeeeee' });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const output: string[] = [];
    const action = createWorkshopActivation(
      { ...base, event: 'message', eventMessage: '<script>Never execute</script>' },
      root, (m) => m, (message) => output.push(message),
    );
    action();
    expect(output).toEqual(['<script>Never execute</script>']);
    expect((root.children[0] as THREE.Mesh).material).toBe(material);
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    material.dispose();
  });

  it('toggles and restores a glow with independently cloned emissive materials', () => {
    const shared = new THREE.MeshStandardMaterial({
      color: '#456789', emissive: '#110011', emissiveIntensity: 0.22,
    });
    const root = new THREE.Group();
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.5), shared);
    root.add(target);
    const unrelated = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const output: string[] = [], cloned: THREE.Material[] = [];
    const action = createWorkshopActivation(
      { ...base, event: 'toggle-glow', eventColor: '#ff3355', eventMessage: 'The Witness awakens.' },
      root, (material) => { cloned.push(material); return material; },
      (message) => output.push(message),
    );

    action();
    expect(cloned).toHaveLength(1);
    expect(target.material).not.toBe(shared);
    expect((target.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('ff3355');
    expect((target.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.8);
    expect((unrelated.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('110011');
    expect(shared.emissiveIntensity).toBe(0.22);

    action();
    expect((target.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('110011');
    expect((target.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.22);
    expect(output).toEqual(['The Witness awakens.', 'The Witness awakens.']);
    target.geometry.dispose();
    unrelated.geometry.dispose();
    for (const material of cloned) material.dispose();
    shared.dispose();
  });

  it('reversibly tints one mesh, supports material arrays and never changes siblings', () => {
    const original = new THREE.MeshBasicMaterial({ color: '#123456' });
    const root = new THREE.Group();
    const target = new THREE.Mesh(new THREE.BoxGeometry(), [original, original]);
    root.add(target);
    const neighbor = new THREE.Mesh(new THREE.BoxGeometry(), original);
    const clones: THREE.Material[] = [];
    const action = createWorkshopActivation(
      { ...base, event: 'toggle-tint', eventColor: '#ff0077' },
      root, (material) => { clones.push(material); return material; }, () => {},
    );
    action();
    expect(clones).toHaveLength(2);
    expect((target.material as THREE.MeshBasicMaterial[]).every(m => m.color.getHexString() === 'ff0077')).toBe(true);
    expect((neighbor.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('123456');
    action();
    expect((target.material as THREE.MeshBasicMaterial[]).every(m => m.color.getHexString() === '123456')).toBe(true);
    target.geometry.dispose();
    neighbor.geometry.dispose();
    clones.forEach(m => m.dispose());
    original.dispose();
  });

  it('finds GLB child meshes added after the interaction was registered', () => {
    const root = new THREE.Group();
    const clones: THREE.Material[] = [];
    const action = createWorkshopActivation(
      { ...base, event: 'toggle-glow' }, root,
      (material) => { clones.push(material); return material; }, () => {},
    );
    const late = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshStandardMaterial({ color: '#222222' }));
    root.add(late);
    action();
    expect(clones).toHaveLength(1);
    expect((late.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('ffc96b');
    action();
    expect((late.material as THREE.MeshStandardMaterial).emissive.getHexString()).toBe('000000');
    late.geometry.dispose();
    clones.forEach(m => m.dispose());
  });
});
