import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOOM_BACK, BOOM_CLEARANCE, BOOM_MIN, BOOM_PIVOT_UP, BOOM_UP, ThirdPersonBoom } from '../src/world/pocket/thirdPersonBoom';

const IDEAL = Math.hypot(BOOM_BACK, BOOM_UP - BOOM_PIVOT_UP);

function world(...walls: { z: number; transparent?: boolean; visible?: boolean }[]): THREE.Group {
  const g = new THREE.Group();
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 0.2), new THREE.MeshBasicMaterial({ transparent: w.transparent ?? false }));
    m.position.set(0, 0, w.z);
    m.visible = w.visible ?? true;
    g.add(m);
  }
  g.updateMatrixWorld(true);
  return g;
}

describe('third-person camera boom', () => {
  const target = new THREE.Vector3(0, 0, 0);

  it('keeps the original 5 m behind, 3.3 m up placement when nothing is in the way', () => {
    const camera = new THREE.PerspectiveCamera();
    new ThirdPersonBoom().place(camera, target, 0, world(), 1 / 60);
    expect(camera.position.x).toBeCloseTo(0, 6);
    expect(camera.position.y).toBeCloseTo(BOOM_UP, 6);
    expect(camera.position.z).toBeCloseTo(BOOM_BACK, 6);
  });

  it('stops in front of a wall behind the character at once', () => {
    const camera = new THREE.PerspectiveCamera();
    const boom = new ThirdPersonBoom();
    boom.place(camera, target, 0, world({ z: 2.5 }), 1 / 60);
    expect(camera.position.z).toBeLessThan(2.5);
    expect(boom.currentLength).toBeLessThan(IDEAL - BOOM_CLEARANCE);
    expect(boom.currentLength).toBeGreaterThanOrEqual(BOOM_MIN);
  });

  it('ignores transparent and hidden surfaces', () => {
    const camera = new THREE.PerspectiveCamera();
    const boom = new ThirdPersonBoom();
    boom.place(camera, target, 0, world({ z: 2, transparent: true }, { z: 3, visible: false }), 1 / 60);
    expect(boom.currentLength).toBeCloseTo(IDEAL, 6);
  });

  it('never comes closer than the minimum, and eases back out when the wall clears', () => {
    const camera = new THREE.PerspectiveCamera();
    const boom = new ThirdPersonBoom();
    boom.place(camera, target, 0, world({ z: 0.3 }), 1 / 60);
    expect(boom.currentLength).toBe(BOOM_MIN);
    const open = world();
    boom.place(camera, target, 0, open, 0.1);
    expect(boom.currentLength).toBeGreaterThan(BOOM_MIN);
    expect(boom.currentLength).toBeLessThan(IDEAL);
    for (let i = 0; i < 20; i++) boom.place(camera, target, 0, open, 0.1);
    expect(boom.currentLength).toBeCloseTo(IDEAL, 6);
  });

  it('turns with the character', () => {
    const camera = new THREE.PerspectiveCamera();
    new ThirdPersonBoom().place(camera, target, Math.PI / 2, world(), 1 / 60);
    expect(camera.position.x).toBeCloseTo(BOOM_BACK, 6);
    expect(camera.position.z).toBeCloseTo(0, 6);
  });
});
