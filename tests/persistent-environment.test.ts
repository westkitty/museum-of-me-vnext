import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PersistentEnvironment } from '../src/world/PersistentEnvironment';

/**
 * Phase 12 guard for the always-resident visual layer.
 *
 * The architectural shell already has its own budget. This closes the gap for
 * post-shell refinement systems, which otherwise could quietly accumulate until
 * every visitor pays their cost for the entire session.
 */
describe('persistent environment budget and lifecycle', () => {
  it('keeps the complete always-resident refinement layer bounded', () => {
    const scope = new ResourceScope('persistent-environment-test');
    const root = new PersistentEnvironment(scope).build();

    expect(root.name).toBe('persistent-environment');
    expect(root.children).toHaveLength(8);

    let meshes = 0;
    let triangles = 0;
    let lights = 0;
    const materials = new Set<THREE.Material>();

    root.traverse((node) => {
      if ((node as THREE.Light).isLight) lights++;
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      const geometry = mesh.geometry;
      if (geometry.index) triangles += geometry.index.count / 3;
      else {
        const position = geometry.getAttribute('position');
        if (position) triangles += position.count / 3;
      }
      const material = mesh.material;
      if (Array.isArray(material)) for (const item of material) materials.add(item);
      else if (material) materials.add(material);
    });

    // The ceilings sit above the current post-bake layer counts while still
    // failing loudly if the static bake stops running. The paired profile
    // snapshots report whole-scene counters, not an isolated layer breakdown.
    expect(meshes, `persistent mesh count ${meshes}`).toBeLessThan(420);
    expect(triangles, `persistent triangle count ${Math.round(triangles)}`).toBeLessThan(500_000);
    expect(materials.size, `persistent material count ${materials.size}`).toBeLessThan(220);
    expect(lights, 'decorative environment added unmanaged scene lights').toBe(0);
    expect(scope.size, 'persistent layer resource scope grew beyond budget').toBeLessThan(3000);

    scope.dispose();
    expect(scope.size, 'persistent environment leaked tracked resources').toBe(0);
  });
});
