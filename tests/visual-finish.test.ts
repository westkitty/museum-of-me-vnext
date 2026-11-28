import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { buildLampGlow, softenBeam } from '../src/render/SoftLight';
import { GalleryDust, buildFireflies, scatterAround } from '../src/render/AirMotes';
import { applyLandscape, landscapeDetail } from '../src/render/LandscapeShading';

describe('lightweight visual finish', () => {
  it('draws every lamp halo and pool in two draws and adds no light', () => {
    const scope = new ResourceScope('glow-test');
    const lamps = Array.from({ length: 40 }, (_, i) => ({ x: i, y: -0.4, z: 0, size: 1.5, color: 0xffb466, pool: { y: -0.44, radius: 3 } }));
    const glow = buildLampGlow(scope, lamps, 'glow');
    const drawables: THREE.Object3D[] = [];
    let lights = 0;
    glow.traverse((node) => {
      if ((node as THREE.Mesh).isMesh || (node as THREE.Points).isPoints) drawables.push(node);
      if ((node as THREE.Light).isLight) lights++;
    });
    expect(drawables).toHaveLength(2);
    expect(lights).toBe(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('keeps particles to one draw each, unpickable, and scaled by quality', () => {
    const scope = new ResourceScope('motes-test');
    const dust = new GalleryDust(scope);
    dust.setDetail(0.4);
    expect(dust.points.geometry.drawRange.count).toBeLessThan(dust.points.geometry.getAttribute('position').count);
    const hits: THREE.Intersection[] = [];
    dust.points.raycast(new THREE.Raycaster(), hits);
    expect(hits).toHaveLength(0);
    const sites = scatterAround([{ x: 0, z: 0 }, { x: 10, z: 5 }], 3, -0.5);
    expect(sites).toHaveLength(6);
    expect(buildFireflies(scope, sites).geometry.getAttribute('position').count).toBe(6);
    scope.dispose();
  });

  it('patches existing materials in place with stable program keys', () => {
    const beam = softenBeam(new THREE.MeshBasicMaterial({ transparent: true }), 2, 'top');
    expect(beam.customProgramCacheKey()).toBe('museum-soft-beam-1:top');
    const grass = applyLandscape(new THREE.MeshStandardMaterial(), 'grass');
    const rock = applyLandscape(new THREE.MeshStandardMaterial(), 'rock');
    const leaf = applyLandscape(new THREE.MeshStandardMaterial(), 'foliage');
    // Ground kinds share one program (the kind is a uniform); foliage keeps its
    // own, so its discard never reaches the ground surfaces.
    expect(grass.customProgramCacheKey()).toBe(rock.customProgramCacheKey());
    expect(grass.defines?.LAND_KIND).toBe(rock.defines?.LAND_KIND);
    expect(leaf.customProgramCacheKey()).not.toBe(grass.customProgramCacheKey());
    expect(leaf.defines?.LAND_KIND).toBe(0);
    expect(grass.userData.landscapeKind).toBe('grass');
    expect([0, 1]).toContain(landscapeDetail.value);
  });
});
