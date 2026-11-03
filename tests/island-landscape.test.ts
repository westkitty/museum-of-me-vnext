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
    const first = new IslandLandscape(firstScope, new CollisionWorld(), 'low').build();
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
    expect(secondTrunks.count).toBe(firstTrunks.count);
    expect(Array.from(firstTrunks.instanceMatrix.array.slice(0, firstTrunks.count * 16)))
      .toEqual(Array.from(secondTrunks.instanceMatrix.array.slice(0, secondTrunks.count * 16)));
    expect(first.getObjectByName('south-arrival-pier-deck')).toBeTruthy();
    expect(first.getObjectByName('single-golden-spire')).toBeTruthy();
    expect(first.getObjectByName('site-path-1')).toBeTruthy();
    expect(first.children.filter((node) => node.name.startsWith('perimeter-woodland-canopy-'))).toHaveLength(3);
    firstScope.dispose();
    secondScope.dispose();
    expect(firstScope.size).toBe(0);
    expect(secondScope.size).toBe(0);
  });
});
