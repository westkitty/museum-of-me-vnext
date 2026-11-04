import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { isLagoon, LAGOON_OUTLINE, LAND_SUPPORT_Y } from '../src/world/exterior/IslandSiteLayout';

describe('S4 lagoon waterline and visible surf correction', () => {
  it('keeps the original site topology but reveals the basin wall', () => {
    const scope = new ResourceScope('lagoon-s4');
    const collision = new CollisionWorld();
    const root = new ArrivalGarden(scope, collision).build();
    const lagoon = root.getObjectByName('east-sheltered-lagoon') as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
    const bed = root.getObjectByName('east-lagoon-bed') as THREE.Mesh<THREE.ShapeGeometry>;
    const wall = root.getObjectByName('east-lagoon-basin-wall') as THREE.Mesh<THREE.BufferGeometry>;
    const land = root.getObjectByName('night-island-terrain') as THREE.Mesh<THREE.ShapeGeometry>;
    expect(lagoon.position.y).toBeLessThan(LAND_SUPPORT_Y - 0.40);
    expect(lagoon.position.y).toBeGreaterThan(bed.position.y + 0.55);
    expect(lagoon.geometry).not.toBe(bed.geometry);
    expect(lagoon.geometry.getAttribute('uv').count).toBe(lagoon.geometry.getAttribute('position').count);
    expect(wall.geometry.getAttribute('position').count).toBe(LAGOON_OUTLINE.length * 4);
    const authoredHole = land.geometry.parameters.shapes as THREE.Shape;
    expect(authoredHole.holes).toHaveLength(1);
    const positions = lagoon.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      expect(isLagoon(positions.getX(i), -positions.getY(i))).toBe(true);
    }
    expect(collision.supportHeight(92, 1, 0)).toBeNull();
    scope.dispose();
    expect(scope.size).toBe(0);
  });
  it('uses a small deterministic depth and ripple texture, not a solid blue plate', () => {
    const a = new ResourceScope('lagoon-texture-a');
    const b = new ResourceScope('lagoon-texture-b');
    const meshA = new ArrivalGarden(a, new CollisionWorld()).build().getObjectByName('east-sheltered-lagoon') as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
    const meshB = new ArrivalGarden(b, new CollisionWorld()).build().getObjectByName('east-sheltered-lagoon') as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
    const mapA = meshA.material.map as THREE.DataTexture;
    const mapB = meshB.material.map as THREE.DataTexture;
    expect(mapA).toBeInstanceOf(THREE.DataTexture);
    expect(mapA.image.width).toBe(128);
    expect(mapA.image.height).toBe(128);
    const pixels = mapA.image.data as Uint8Array;
    const second = mapB.image.data as Uint8Array;
    expect(Array.from(second)).toEqual(Array.from(pixels));
    const greens = new Set<number>();
    for (let i = 0; i < 128 * 128; i += 29) greens.add(pixels[i * 4 + 1]);
    expect(greens.size).toBeGreaterThan(25);
    expect(meshA.material.roughness).toBeGreaterThan(0.4);
    expect(meshA.material.emissiveIntensity).toBeLessThan(0.1);
    a.dispose();
    b.dispose();
    expect(a.size).toBe(0);
    expect(b.size).toBe(0);
  });
  it('keeps foam offshore, below land and clear of 0.335-m ocean crests', () => {
    const scope = new ResourceScope('coastal-s4');
    const root = new ArrivalGarden(scope, new CollisionWorld()).build();
    const foam = root.getObjectByName('night-island-broken-surf') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const ocean = root.getObjectByName('night-island-water') as THREE.Mesh<THREE.RingGeometry>;
    expect(foam.material.opacity).toBeGreaterThan(0.6);
    expect(foam.geometry.getIndex()!.count).toBe(foam.geometry.getAttribute('position').count / 4 * 6);
    const positions = foam.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getY(i)).toBeGreaterThan(ocean.position.y + 0.335);
      expect(positions.getY(i)).toBeLessThan(LAND_SUPPORT_Y);
    }
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
