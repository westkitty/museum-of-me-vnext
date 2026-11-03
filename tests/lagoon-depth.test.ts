import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { addIslandSupport, LAGOON_OUTLINE, LAND_SUPPORT_Y } from '../src/world/exterior/IslandSiteLayout';

function coveredByTriangle(geometry: THREE.BufferGeometry, x: number, y: number): boolean {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  const count = indices?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const ai = indices ? indices.getX(i) : i;
    const bi = indices ? indices.getX(i + 1) : i + 1;
    const ci = indices ? indices.getX(i + 2) : i + 2;
    const ax = positions.getX(ai), ay = positions.getY(ai);
    const bx = positions.getX(bi), by = positions.getY(bi);
    const cx = positions.getX(ci), cy = positions.getY(ci);
    const cross = (px: number, py: number, qx: number, qy: number) =>
      (px - x) * (qy - y) - (py - y) * (qx - x);
    const s1 = cross(ax, ay, bx, by);
    const s2 = cross(bx, by, cx, cy);
    const s3 = cross(cx, cy, ax, ay);
    if (Math.min(s1, s2, s3) >= -1e-5 || Math.max(s1, s2, s3) <= 1e-5) return true;
  }
  return false;
}

describe('subtractive east lagoon', () => {
  it('cuts the actual water polygon out of visual terrain while preserving dry land', () => {
    const scope = new ResourceScope('lagoon-triangulation');
    const collision = new CollisionWorld();
    const root = new ArrivalGarden(scope, collision).build();
    const terrain = root.getObjectByName('night-island-terrain') as THREE.Mesh<THREE.ShapeGeometry>;
    expect(terrain).toBeTruthy();
    const shapeParameter = terrain.geometry.parameters.shapes;
    const shape = Array.isArray(shapeParameter) ? shapeParameter[0] : shapeParameter;
    expect(shape.holes).toHaveLength(1);
    // ShapeGeometry's local Y coordinate is -world Z before mesh rotation.
    expect(coveredByTriangle(terrain.geometry, 92, -1)).toBe(false);
    expect(coveredByTriangle(terrain.geometry, -80, 0)).toBe(true);
    addIslandSupport(collision);
    expect(collision.supportHeight(92, 1, 0)).toBeNull();
    expect(collision.supportHeight(-80, 0, 0)).toBe(LAND_SUPPORT_Y);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('has bounded mineral depth, polygon-anchored walls and reusable geometry', () => {
    const scope = new ResourceScope('lagoon-basin');
    const root = new ArrivalGarden(scope, new CollisionWorld()).build();
    const water = root.getObjectByName('east-sheltered-lagoon') as THREE.Mesh;
    const bed = root.getObjectByName('east-lagoon-bed') as THREE.Mesh;
    const wall = root.getObjectByName('east-lagoon-basin-wall') as THREE.Mesh;
    const bank = root.getObjectByName('east-lagoon-rock-bank') as THREE.Mesh;
    expect(water).toBeTruthy();
    expect(bed).toBeTruthy();
    expect(wall).toBeTruthy();
    expect(bank).toBeTruthy();
    expect(water.geometry).toBe(bed.geometry);
    expect(water.position.y).toBeLessThan(LAND_SUPPORT_Y);
    expect(bed.position.y).toBeLessThan(water.position.y - 0.5);
    expect(water.userData.visualRole).toBe('enclosed-lagoon');
    expect(wall.userData.visualRole).toBe('lagoon-stone-slope');
    const wallPositions = wall.geometry.getAttribute('position');
    expect(wallPositions.count).toBe(LAGOON_OUTLINE.length * 4);
    for (let i = 0; i < LAGOON_OUTLINE.length; i++) {
      const [ax, az] = LAGOON_OUTLINE[i];
      const [bx, bz] = LAGOON_OUTLINE[(i + 1) % LAGOON_OUTLINE.length];
      expect(wallPositions.getX(i * 4)).toBeCloseTo(ax, 5);
      expect(wallPositions.getZ(i * 4)).toBeCloseTo(az, 5);
      expect(wallPositions.getX(i * 4 + 1)).toBeCloseTo(bx, 5);
      expect(wallPositions.getZ(i * 4 + 1)).toBeCloseTo(bz, 5);
    }
    expect((bank.geometry as THREE.TubeGeometry).parameters.path).toBeInstanceOf(THREE.CurvePath);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
