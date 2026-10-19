import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * A single 64x64, locally generated soft disk shared by gallery uplight pools
 * and all authored-visitor contact shadows. No external assets or render pass.
 * Stored in the green channel because Three.js alphaMap reads that channel.
 */
const SIZE = 64;
const CACHE = new WeakMap<ResourceScope, THREE.DataTexture>();

export function radialFloorMask(scope: ResourceScope): THREE.DataTexture {
  const cached = CACHE.get(scope);
  if (cached) return cached;

  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = ((x + 0.5) / SIZE) * 2 - 1;
      const dy = ((y + 0.5) / SIZE) * 2 - 1;
      const radius = Math.hypot(dx, dy);
      const soft = Math.max(0, 1 - radius);
      const value = Math.round(255 * soft * soft * (3 - 2 * soft));
      const p = (y * SIZE + x) * 4;
      pixels[p] = pixels[p + 1] = pixels[p + 2] = value;
      pixels[p + 3] = 255;
    }
  }
  const texture = scope.track(new THREE.DataTexture(pixels, SIZE, SIZE, THREE.RGBAFormat));
  texture.name = 'museum-shared-soft-radial-mask';
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  CACHE.set(scope, texture);
  return texture;
}
