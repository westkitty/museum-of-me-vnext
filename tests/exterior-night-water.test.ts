import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { ISLAND_OUTLINE, isSiteLand } from '../src/world/exterior/IslandSiteLayout';

describe('exterior S2 night water and coastline', () => {
  it('creates one indexed, broken, noncolliding surf asset outside the real coast', () => {
    const scope = new ResourceScope('exterior-s2-surf');
    const collision = new CollisionWorld();
    const root = new ArrivalGarden(scope, collision).build();
    const surf = root.getObjectByName('night-island-broken-surf') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    expect(surf).toBeInstanceOf(THREE.Mesh);
    expect(surf.userData.visualRole).toBe('broken-site-aligned-surf');
    expect(surf.material.transparent).toBe(true);
    expect(surf.material.depthWrite).toBe(false);
    expect(surf.geometry.boundingSphere).toBeTruthy();
    const positions = surf.geometry.getAttribute('position');
    const indices = surf.geometry.getIndex();
    expect(positions.count).toBeGreaterThan(ISLAND_OUTLINE.length * 4);
    expect(positions.count).toBeLessThan(600);
    expect(indices).toBeTruthy();
    expect(indices!.count).toBe(positions.count / 4 * 6);
    for (let i = 0; i < positions.count; i++) {
      expect(isSiteLand(positions.getX(i), positions.getZ(i))).toBe(false);
      expect(positions.getY(i)).toBeLessThan(-0.65);
    }
    expect(root.getObjectByName('night-island-shoreline')).toBeTruthy();
    expect(root.getObjectByName('night-island-tidal-fringe')).toBeTruthy();
    expect(root.getObjectByName('night-island-coastal-skirt')).toBeTruthy();
    expect(collision.size).toBeGreaterThan(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('keeps ring-wave physics and separates lagoon water from fountain water', () => {
    const scope = new ResourceScope('exterior-s2-materials');
    const root = new ArrivalGarden(scope, new CollisionWorld()).build();
    const ocean = root.getObjectByName('night-island-water') as THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
    expect(ocean.geometry.type).toBe('RingGeometry');
    expect(ocean.geometry.parameters.innerRadius).toBe(164);
    expect(ocean.material.vertexShader).toContain('accumulateWave');
    expect(ocean.material.fragmentShader).toContain('vec3(0.008, 0.030, 0.060)');
    const lagoon = root.getObjectByName('east-sheltered-lagoon') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(lagoon.material.opacity).toBeCloseTo(0.76);
    expect(lagoon.material.depthWrite).toBe(false);
    expect(lagoon.material.emissiveIntensity).toBeCloseTo(0.24);
    const bed = root.getObjectByName('east-lagoon-bed') as THREE.Mesh<THREE.BufferGeometry>;
    expect(lagoon.geometry).toBe(bed.geometry);
    expect(lagoon.position.y).toBeGreaterThan(bed.position.y);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
