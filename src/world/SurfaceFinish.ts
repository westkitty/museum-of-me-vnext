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
      // Quiet periodic mineral veining replaces the visibly printed joint grid.
      // Multi-scale noise wraps at every texture edge without extra GPU resources.
      const mineral = noise(x, y, 8) * 0.48
        + noise(x, y, 16) * 0.32
        + noise(x, y, 32) * 0.20;
      const warp = noise(x, y, 8) * 0.68 + noise(x, y, 16) * 0.22;
      const strata = Math.sin(2 * Math.PI * (x * 3 / SIZE + warp * 0.68));
      const vein = Math.pow(Math.max(0, 1 - Math.abs(strata) / 0.17), 3) * 0.037;
      const pore = hash(x + 47, y + 71) > 0.962 ? 0.018 : 0;
      const grain = (hash(x, y) - 0.5) * 0.058;
      const shade = Math.max(0.79, Math.min(1,
        0.958 + (mineral - 0.5) * 0.105 + grain - vein - pore,
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
