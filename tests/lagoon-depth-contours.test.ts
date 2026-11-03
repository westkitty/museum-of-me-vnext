import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { LAGOON_OUTLINE, LAND_SUPPORT_Y } from '../src/world/exterior/IslandSiteLayout';

describe('bounded lagoon depth and shallow-water visual correction', () => {
  it('uses one small polygon-mapped texture with varied shoreline and deep-water color', () => {
    const scope = new ResourceScope('lagoon-texture-test');
    const world = new CollisionWorld();
    const root = new ArrivalGarden(scope, world).build();
    const lagoon = root.getObjectByName('east-sheltered-lagoon') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const bed = root.getObjectByName('east-lagoon-bed') as THREE.Mesh<THREE.BufferGeometry>;
    expect(lagoon.geometry).toBe(bed.geometry);
    const map = lagoon.material.map as THREE.DataTexture;
    expect(map).toBeInstanceOf(THREE.DataTexture);
    expect(map.image.width).toBe(128);
    expect(map.image.height).toBe(128);
    expect(map.colorSpace).toBe(THREE.SRGBColorSpace);
    const green = new Set<number>();
    const pixelData = map.image.data as Uint8Array;
    for (let i = 1; i < pixelData.length; i += 4) green.add(pixelData[i]);
    expect(green.size).toBeGreaterThan(40);
    expect(lagoon.position.y).toBeLessThan(LAND_SUPPORT_Y - 0.5);
    expect(lagoon.position.y).toBeGreaterThan(bed.position.y + 0.5);
    expect(lagoon.material.depthWrite).toBe(false);
    const uv = lagoon.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(-0.001);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(-0.001);
      expect(uv.getX(i)).toBeLessThanOrEqual(1.001);
      expect(uv.getY(i)).toBeLessThanOrEqual(1.001);
    }
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('adds one coastline-faithful bank shelf without terrain or collision changes', () => {
    const scope = new ResourceScope('lagoon-shelf-test');
    const collision = new CollisionWorld();
    const root = new ArrivalGarden(scope, collision).build();
    const shelf = root.getObjectByName('east-lagoon-waterline-shelf') as THREE.Mesh<THREE.BufferGeometry>;
    const water = root.getObjectByName('east-sheltered-lagoon') as THREE.Mesh;
    const wall = root.getObjectByName('east-lagoon-basin-wall') as THREE.Mesh;
    expect(shelf).toBeInstanceOf(THREE.Mesh);
    expect(shelf.userData.visualRole).toBe('lagoon-physical-depth-cue-visual-only');
    expect(wall).toBeTruthy();
    const position = shelf.geometry.getAttribute('position');
    expect(position.count).toBe(LAGOON_OUTLINE.length * 4);
    expect(shelf.geometry.getIndex()?.count).toBe(LAGOON_OUTLINE.length * 6);
    for (let i = 0; i < LAGOON_OUTLINE.length; i++) {
      const [x, z] = LAGOON_OUTLINE[i];
      expect(position.getX(i * 4)).toBeCloseTo(x, 5);
      expect(position.getZ(i * 4)).toBeCloseTo(z, 5);
      expect(position.getY(i * 4)).toBeGreaterThan(water.position.y);
      expect(position.getY(i * 4 + 2)).toBeLessThan(water.position.y);
    }
    const baselineScope = new ResourceScope('lagoon-shelf-baseline');
    const baselineCollision = new CollisionWorld();
    new ArrivalGarden(baselineScope, baselineCollision).build();
    expect(collision.size).toBe(baselineCollision.size);
    scope.dispose();
    baselineScope.dispose();
    expect(scope.size).toBe(0);
    expect(baselineScope.size).toBe(0);
  });
});
