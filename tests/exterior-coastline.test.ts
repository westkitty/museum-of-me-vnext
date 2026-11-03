import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { ISLAND_OUTLINE, LAND_SUPPORT_Y } from '../src/world/exterior/IslandSiteLayout';

describe('authored coast / ocean continuity', () => {
  it('covers the entire island and pier with water below the supported land', () => {
    const scope = new ResourceScope('coastal-water-test');
    const garden = new ArrivalGarden(scope, new CollisionWorld());
    const root = garden.build();
    const water = root.getObjectByName('night-island-water') as THREE.Mesh<THREE.RingGeometry, THREE.ShaderMaterial>;
    const land = root.getObjectByName('night-island-terrain') as THREE.Mesh;
    expect(water).toBeTruthy();
    expect(land).toBeTruthy();
    expect(water.geometry.type).toBe('RingGeometry');
    expect(water.geometry.parameters.innerRadius).toBe(0);
    expect(water.geometry.parameters.outerRadius).toBe(330);
    expect(land.position.y).toBe(LAND_SUPPORT_Y);
    // Total wave amplitude = .16 + .095 + .052 + .028 = .335 m.
    expect(water.position.y + 0.335).toBeLessThan(land.position.y - 0.05);
    expect(water.material.fragmentShader).not.toContain('shoreRadius');
    expect(water.material.fragmentShader).not.toContain('shoreDistance');
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('seals every polygon edge with a rock bank and shoreline-aligned fringe', () => {
    const scope = new ResourceScope('coast-perimeter-test');
    const garden = new ArrivalGarden(scope, new CollisionWorld());
    const root = garden.build();
    const land = root.getObjectByName('night-island-terrain');
    const cliff = root.getObjectByName('night-island-coastal-skirt') as THREE.Mesh;
    const fringe = root.getObjectByName('night-island-tidal-fringe') as THREE.Mesh;
    const shoreline = root.getObjectByName('night-island-shoreline') as THREE.Mesh;
    expect(land).toBeTruthy();
    expect(cliff).toBeTruthy();
    expect(fringe).toBeTruthy();
    expect(shoreline).toBeTruthy();
    expect(cliff.userData.visualRole).toBe('coast-edge-seal');
    const positions = (cliff.geometry as THREE.BufferGeometry).getAttribute('position');
    expect(positions.count).toBe(ISLAND_OUTLINE.length * 4);
    expect((fringe.geometry as THREE.BufferGeometry).getAttribute('position').count).toBe(positions.count);
    for (let i = 0; i < ISLAND_OUTLINE.length; i++) {
      const [ax, az] = ISLAND_OUTLINE[i];
      const [bx, bz] = ISLAND_OUTLINE[(i + 1) % ISLAND_OUTLINE.length];
      expect(positions.getX(i * 4)).toBeCloseTo(ax, 4);
      expect(positions.getZ(i * 4)).toBeCloseTo(az, 4);
      expect(positions.getX(i * 4 + 1)).toBeCloseTo(bx, 4);
      expect(positions.getZ(i * 4 + 1)).toBeCloseTo(bz, 4);
      expect(positions.getY(i * 4 + 2)).toBeLessThan(-1.0);
    }
    const curve = (shoreline.geometry as THREE.TubeGeometry).parameters.path;
    expect(curve).toBeInstanceOf(THREE.CurvePath);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
