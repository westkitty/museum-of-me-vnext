import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { IslandLandscape } from '../src/world/exterior/IslandLandscape';
import { SCENIC_GROVE_POINTS, isSiteLand } from '../src/world/exterior/IslandSiteLayout';

describe('IslandLandscape', () => {
  it('is deterministic, instanced, and disposes its resources', () => {
    const firstScope = new ResourceScope('landscape-a');
    const secondScope = new ResourceScope('landscape-b');
    const collision = new CollisionWorld();
    const first = new IslandLandscape(firstScope, collision, 'low').build();
    const second = new IslandLandscape(secondScope, new CollisionWorld(), 'low').build();
    const firstTrunks = first.getObjectByName('perimeter-woodland-trunks') as THREE.InstancedMesh;
    const secondTrunks = second.getObjectByName('perimeter-woodland-trunks') as THREE.InstancedMesh;
    expect(firstTrunks).toBeTruthy();
    expect(firstTrunks.count).toBe(68);
    expect(SCENIC_GROVE_POINTS).toHaveLength(20);
    expect(SCENIC_GROVE_POINTS.every(([x, z]) => isSiteLand(x, z))).toBe(true);
    for (let i = 0; i < SCENIC_GROVE_POINTS.length; i++) {
      const position = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(firstTrunks.instanceMatrix.array, i * 16));
      expect(position.x).toBeCloseTo(SCENIC_GROVE_POINTS[i][0], 4);
      expect(position.z).toBeCloseTo(SCENIC_GROVE_POINTS[i][1], 4);
    }
    const firstLobes = first.getObjectByName('woodland-secondary-canopy') as THREE.InstancedMesh;
    const secondLobes = second.getObjectByName('woodland-secondary-canopy') as THREE.InstancedMesh;
    const understory = first.getObjectByName('woodland-understory') as THREE.InstancedMesh;
    const understoryOther = second.getObjectByName('woodland-understory') as THREE.InstancedMesh;
    expect(firstLobes).toBeInstanceOf(THREE.InstancedMesh);
    expect(firstLobes.count).toBe(firstTrunks.count);
    expect(firstLobes.castShadow).toBe(false);
    expect(understory).toBeInstanceOf(THREE.InstancedMesh);
    expect(understory.count).toBeGreaterThan(15);
    expect(understory.count).toBeLessThanOrEqual(firstTrunks.count);
    expect(understory.castShadow).toBe(false);
    expect(Array.from(understory.instanceMatrix.array.slice(0, understory.count * 16)))
      .toEqual(Array.from(understoryOther.instanceMatrix.array.slice(0, understoryOther.count * 16)));
    expect(Array.from(firstLobes.instanceMatrix.array.slice(0, firstLobes.count * 16)))
      .toEqual(Array.from(secondLobes.instanceMatrix.array.slice(0, secondLobes.count * 16)));
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    for (let i = 0; i < understory.count; i++) {
      understory.getMatrixAt(i, matrix);
      point.setFromMatrixPosition(matrix);
      expect(isSiteLand(point.x, point.z)).toBe(true);
      expect(Math.hypot(point.x, point.z - 128)).toBeGreaterThanOrEqual(54);
    }
    expect(secondTrunks.count).toBe(firstTrunks.count);
    expect(Array.from(firstTrunks.instanceMatrix.array.slice(0, firstTrunks.count * 16)))
      .toEqual(Array.from(secondTrunks.instanceMatrix.array.slice(0, secondTrunks.count * 16)));
    expect(first.getObjectByName('south-arrival-pier-deck')).toBeTruthy();
    const pierGuides = first.getObjectByName('pier-guide-inlays') as THREE.InstancedMesh;
    const coastalRocks = first.getObjectByName('shoreline-rock-scatter') as THREE.InstancedMesh;
    expect(pierGuides).toBeInstanceOf(THREE.InstancedMesh);
    expect(pierGuides.count).toBe(16);
    expect(coastalRocks).toBeInstanceOf(THREE.InstancedMesh);
    expect(coastalRocks.count).toBeGreaterThan(10);
    expect(coastalRocks.count).toBeLessThanOrEqual(24);

    const lights = first.getObjectByName('path-ground-light-instances') as THREE.InstancedMesh;
    const lightsOther = second.getObjectByName('path-ground-light-instances') as THREE.InstancedMesh;
    expect(lights).toBeInstanceOf(THREE.InstancedMesh);
    expect(lights.count).toBeGreaterThan(10);
    expect(lights.userData.visualRole).toBe('landscape-path-edge-guidance');
    expect(lights.userData.sourceMarkerIds).toHaveLength(lights.count);
    expect(Array.from(lights.instanceMatrix.array.slice(0, lights.count * 16)))
      .toEqual(Array.from(lightsOther.instanceMatrix.array.slice(0, lightsOther.count * 16)));

    const compass = first.getObjectByName('pier-arrival-compass') as THREE.Mesh;
    const notch = first.getObjectByName('pier-arrival-north-marker') as THREE.Mesh;
    const sentinels = first.getObjectByName('pier-stone-sentinels') as THREE.InstancedMesh;
    const caps = first.getObjectByName('pier-amber-sentinel-caps') as THREE.InstancedMesh;
    expect(compass).toBeTruthy();
    expect(compass.position.y).toBeGreaterThan(-0.49);
    expect(compass.position.z).toBe(196);
    expect(notch.position.z).toBeLessThan(compass.position.z);
    expect(sentinels.count).toBe(12);
    expect(caps.count).toBe(12);
    expect(collision.resolveHorizontal({ x: 0, y: -0.5, z: 196 }, 0.35, 1.78)).toBe(false);
    for (let i = 0; i < sentinels.count; i++) {
      const matrix = new THREE.Matrix4();
      const p = new THREE.Vector3();
      sentinels.getMatrixAt(i, matrix);
      p.setFromMatrixPosition(matrix);
      expect(Math.abs(p.x)).toBeCloseTo(5.22, 3);
      expect(p.z).toBeGreaterThanOrEqual(172);
      expect(p.z).toBeLessThanOrEqual(212);
      expect(collision.resolveHorizontal({ x: p.x, y: -0.5, z: p.z }, 0.35, 1.78)).toBe(true);
    }
    const pierEdgeWest = first.getObjectByName('pier-edge--1') as THREE.Mesh;
    const pierEdgeEast = first.getObjectByName('pier-edge-1') as THREE.Mesh;
    for (const edge of [pierEdgeWest, pierEdgeEast]) {
      expect(edge.position.y).toBeCloseTo(-0.315, 4);
      expect(edge.position.y - (edge.geometry as THREE.BoxGeometry).parameters.height / 2).toBeCloseTo(-0.49, 4);
    }
    for (let i = 0; i < pierGuides.count; i++) {
      const pos = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(pierGuides.instanceMatrix.array, i * 16));
      expect(Math.abs(pos.x)).toBeCloseTo(5.35, 3);
      expect(pos.y).toBeCloseTo(-0.455, 4);
      expect(pos.z).toBeGreaterThanOrEqual(168);
      expect(pos.z).toBeLessThanOrEqual(210);
    }
    const pathLightMatrix = new THREE.Matrix4();
    const pathLightPoint = new THREE.Vector3();
    for (let i = 0; i < lights.count; i++) {
      lights.getMatrixAt(i, pathLightMatrix);
      pathLightPoint.setFromMatrixPosition(pathLightMatrix);
      expect(pathLightPoint.y).toBeCloseTo(-0.285, 4);
      expect(isSiteLand(pathLightPoint.x, pathLightPoint.z)).toBe(true);
    }
    expect(first.getObjectByName('single-golden-spire')).toBeTruthy();
    expect(first.getObjectByName('site-path-1')).toBeTruthy();
    expect(first.children.filter((node) => node.name.startsWith('perimeter-woodland-canopy-'))).toHaveLength(3);
    firstScope.dispose();
    secondScope.dispose();
    expect(firstScope.size).toBe(0);
    expect(secondScope.size).toBe(0);
  });
});
