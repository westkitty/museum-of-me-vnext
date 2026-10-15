import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * Tileable, entirely local architectural surface finish.
 *
 * One small deterministic texture is shared by the building and the thirty-five
 * exhibit galleries. Large flat-colour planes pick up a honed mineral grain
 * without fetching assets, adding draw calls, baking light, or changing the
 * palette/geometry/collision authority. No random state or canvas required.
 */
const SIZE = 128;
const FINISH_BY_SCOPE = new WeakMap<ResourceScope, THREE.DataTexture>();

function hash(x: number, y: number): number {
  let n = (Math.imul((x & (SIZE - 1)) + 1, 374761393)
    + Math.imul((y & (SIZE - 1)) + 1, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function noise(x: number, y: number, cells: number): number {
  const sx = x * cells / SIZE;
  const sy = y * cells / SIZE;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;
  const tx = fx * fx * (3 - 2 * fx);
  const ty = fy * fy * (3 - 2 * fy);
  const a = hash(ix * (SIZE / cells), iy * (SIZE / cells));
  const b = hash((ix + 1) * (SIZE / cells), iy * (SIZE / cells));
  const c = hash(ix * (SIZE / cells), (iy + 1) * (SIZE / cells));
  const d = hash((ix + 1) * (SIZE / cells), (iy + 1) * (SIZE / cells));
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export function architecturalStoneFinish(scope: ResourceScope): THREE.DataTexture {
  const cached = FINISH_BY_SCOPE.get(scope);
  if (cached) return cached;

  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const mineral = noise(x, y, 8) * 0.6 + noise(x, y, 32) * 0.4;
      const grain = hash(x, y) - 0.5;
      // Restrained coursing reads as craft close up, never as a printed grid.
      const joint = ((x + 13) % 32 === 0 || (y + 7) % 32 === 0) ? 0.035 : 0;
      const shade = Math.max(0.79, Math.min(1,
        0.958 + (mineral - 0.5) * 0.12 + grain * 0.065 - joint,
      ));
      const value = Math.round(shade * 255);
      const i = (y * SIZE + x) * 4;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  }

  const texture = scope.track(new THREE.DataTexture(pixels, SIZE, SIZE, THREE.RGBAFormat));
  texture.name = 'museum-honed-stone-grain';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  FINISH_BY_SCOPE.set(scope, texture);
  return texture;
}
