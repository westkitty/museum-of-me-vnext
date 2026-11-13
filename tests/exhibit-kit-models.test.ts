import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { builderModel } from '../src/workshop/builderAssetCatalog';
import { KIT_TEMPLATES, kitWorldTransform } from '../src/workshop/ExhibitKits';
import { STAR_CHART_SIZE } from '../src/workshop/StarChart';

/**
 * The kit templates are judged on the real bundled model files, not on their
 * nominal sizes: every part a visitor sees must rest on the floor or on
 * something, nothing may be sealed inside its own solid body, and no two kit
 * parts may occupy the same space unless one stands on the other.
 */
const TOUCH = 0.03;
const INSET = 0.005;
type Box = THREE.Box3;
const parts = new Map<string, { name: string; box: Box }[]>();

async function load(assetId: string) {
  const entry = builderModel(assetId);
  if (!entry) throw new Error(`unknown library model ${assetId}`);
  const bytes = readFileSync(`public/${entry.path}`);
  const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) =>
    new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
  gltf.scene.updateMatrixWorld(true);
  const meshes: { name: string; box: Box }[] = [];
  gltf.scene.traverse((object) => { if ((object as THREE.Mesh).isMesh) meshes.push({ name: object.name, box: new THREE.Box3().setFromObject(object) }); });
  return meshes;
}
const gap = (a: Box, b: Box) => Math.max(a.min.x - b.max.x, b.min.x - a.max.x, a.min.y - b.max.y, b.min.y - a.max.y, a.min.z - b.max.z, b.min.z - a.max.z, 0);
const sealedIn = (inner: Box, outer: Box) => inner.min.x > outer.min.x + INSET && inner.max.x < outer.max.x - INSET
  && inner.min.y > outer.min.y + INSET && inner.max.y < outer.max.y - INSET && inner.min.z > outer.min.z + INSET && inner.max.z < outer.max.z - INSET;

const slots = Object.values(KIT_TEMPLATES).flatMap((template) => template.slots.map((slot) => ({ template, slot })));

beforeAll(async () => {
  for (const { slot } of slots) if (slot.record.assetId && !parts.has(slot.record.assetId)) parts.set(slot.record.assetId, await load(slot.record.assetId));
});

describe('Exhibit Kit models as bundled', () => {
  it('uses only library models for every slot, apart from the star chart sheet', () => {
    for (const { template, slot } of slots) {
      const expected = slot.slot === 'star-chart' ? 'star-chart' : 'catalog-model';
      expect(`${template.id}/${slot.slot}:${slot.record.prefab}`).toBe(`${template.id}/${slot.slot}:${expected}`);
    }
  });

  it('mounts the star chart flush on the easel canvas, inside its edges', () => {
    const template = KIT_TEMPLATES['observatory-workstation'];
    const easelSlot = template.slots.find((slot) => slot.slot === 'chart-easel')!;
    const chartSlot = template.slots.find((slot) => slot.slot === 'star-chart')!;
    expect(chartSlot.record.collision).toBe('none');
    // The easel's canvas is its widest thin upright part (the white board).
    const canvas = parts.get(easelSlot.record.assetId!)!
      .filter((mesh) => mesh.box.max.x - mesh.box.min.x > 0.5 && mesh.box.max.z - mesh.box.min.z < 0.06 && mesh.box.max.y - mesh.box.min.y > 0.5)[0];
    expect(canvas, 'easel canvas part').toBeTruthy();
    // Express the chart's corners in the easel's own frame.
    const toMatrix = (slot: typeof easelSlot) => {
      const world = kitWorldTransform({ position: [0, 0, 0], rotationY: 0 }, slot);
      return new THREE.Matrix4().compose(new THREE.Vector3(...world.position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...world.rotation)), new THREE.Vector3(...world.scale));
    };
    const chartToEasel = toMatrix(easelSlot).invert().multiply(toMatrix(chartSlot));
    const { width, height, thickness } = STAR_CHART_SIZE;
    const sheet = new THREE.Box3(new THREE.Vector3(-width / 2, 0, 0), new THREE.Vector3(width / 2, height, thickness)).applyMatrix4(chartToEasel);
    const front = canvas.box.max.z;
    expect(sheet.min.z - front, 'gap between canvas face and chart back').toBeGreaterThanOrEqual(0);
    expect(sheet.min.z - front, 'gap between canvas face and chart back').toBeLessThanOrEqual(0.002);
    expect(sheet.min.x).toBeGreaterThanOrEqual(canvas.box.min.x);
    expect(sheet.max.x).toBeLessThanOrEqual(canvas.box.max.x);
    expect(sheet.min.y).toBeGreaterThanOrEqual(canvas.box.min.y);
    expect(sheet.max.y).toBeLessThanOrEqual(canvas.box.max.y);
  });

  it('has no hovering or detached part in any kit model: each part touches the model base or a part connected to it', () => {
    // The base is the model's lowest level (0 for floor models; desk height for the desk-top computer,
    // whose support is checked per kit below).
    const problems: string[] = [];
    for (const [assetId, meshes] of parts) {
      const base = Math.min(...meshes.map((mesh) => mesh.box.min.y));
      const connected = new Set(meshes.filter((mesh) => mesh.box.min.y <= base + TOUCH).map((mesh) => mesh.name));
      for (let grew = true; grew;) {
        grew = false;
        for (const mesh of meshes) if (!connected.has(mesh.name) && meshes.some((other) => connected.has(other.name) && gap(mesh.box, other.box) <= TOUCH)) { connected.add(mesh.name); grew = true; }
      }
      for (const mesh of meshes) if (!connected.has(mesh.name)) problems.push(`${assetId} part ${mesh.name} floats`);
    }
    expect(problems).toEqual([]);
  });

  it('seals no visible part inside another part of the same model', () => {
    const problems: string[] = [];
    for (const [assetId, meshes] of parts) for (const inner of meshes) for (const outer of meshes)
      if (inner !== outer && sealedIn(inner.box, outer.box)) problems.push(`${assetId}: ${inner.name} is hidden inside ${outer.name}`);
    expect(problems).toEqual([]);
  });

  it('stands every part on the floor, except one resting on the top of another part of the same kit', () => {
    for (const template of Object.values(KIT_TEMPLATES)) {
      const placed = template.slots.filter((slot) => slot.record.prefab === 'catalog-model').map((slot) => {
        const world = kitWorldTransform({ position: [0, 0, 0], rotationY: 0 }, slot);
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...world.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...world.rotation)), new THREE.Vector3(...world.scale));
        const box = new THREE.Box3();
        for (const mesh of parts.get(slot.record.assetId!)!) box.union(mesh.box.clone().applyMatrix4(matrix));
        return { slot: slot.slot, box };
      });
      for (const item of placed) {
        if (item.box.min.y <= TOUCH) continue;
        const support = placed.find((other) => other !== item && Math.abs(other.box.max.y - item.box.min.y) <= 0.06
          && item.box.min.x >= other.box.min.x && item.box.max.x <= other.box.max.x && item.box.min.z >= other.box.min.z && item.box.max.z <= other.box.max.z);
        expect({ kit: template.id, slot: item.slot, supportedBy: support?.slot ?? null }).not.toMatchObject({ supportedBy: null });
      }
      // Floor-standing parts do not interpenetrate one another.
      const floor = placed.filter((item) => item.box.min.y <= TOUCH);
      for (const a of floor) for (const b of floor) if (a !== b) {
        const overlap = a.box.clone().intersect(b.box);
        expect({ kit: template.id, pair: `${a.slot}/${b.slot}`, overlaps: !overlap.isEmpty() && overlap.max.x - overlap.min.x > 0.01 && overlap.max.z - overlap.min.z > 0.01 })
          .toMatchObject({ overlaps: false });
      }
    }
  });
});
