import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_FEEL_LIMITS, CameraFeel } from '../src/player/CameraFeel';

const still = { velocity: { x: 0, y: 0, z: 0 }, yaw: 0, grounded: true, enabled: true };

describe('camera feel', () => {
  it('is exactly at rest for a visitor standing still', () => {
    const feel = new CameraFeel();
    for (let i = 0; i < 120; i++) feel.update(1 / 60, still);
    expect(feel.isResting).toBe(true);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 2, 3);
    feel.apply(camera);
    expect(camera.position.toArray()).toEqual([1, 2, 3]);
    expect(camera.rotation.z).toBe(0);
    expect(camera.zoom).toBe(1);
  });

  it('keeps walking, sprinting and landing offsets inside comfortable limits', () => {
    const feel = new CameraFeel();
    let low = 0;
    let high = 0;
    for (let i = 0; i < 600; i++) {
      feel.update(1 / 60, { ...still, velocity: { x: 15.5, y: 0, z: -3 } });
      low = Math.min(low, feel.offsetY);
      high = Math.max(high, feel.offsetY);
    }
    expect(low).toBeGreaterThanOrEqual(-CAMERA_FEEL_LIMITS.bob - 1e-9);
    expect(high).toBeLessThanOrEqual(1e-9);
    for (let i = 0; i < 30; i++) feel.update(1 / 60, { ...still, grounded: false, velocity: { x: 0, y: -14, z: 0 } });
    for (let i = 0; i < 240; i++) {
      feel.update(1 / 60, still);
      expect(feel.offsetY).toBeGreaterThanOrEqual(-CAMERA_FEEL_LIMITS.dip - CAMERA_FEEL_LIMITS.bob);
    }
    expect(feel.isResting).toBe(true);
  });

  it('switches off at once when disabled (reduced motion, panels, flight, pocket worlds)', () => {
    const feel = new CameraFeel();
    for (let i = 0; i < 60; i++) feel.update(1 / 60, { ...still, velocity: { x: 9, y: 0, z: 9 } });
    expect(feel.isResting).toBe(false);
    feel.update(1 / 60, { ...still, velocity: { x: 9, y: 0, z: 9 }, enabled: false });
    expect(feel.isResting).toBe(true);
  });
});
