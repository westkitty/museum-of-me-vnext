import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { ArrivalBeacons } from '../src/world/ArrivalBeacons';
import { START_POSITION, START_YAW } from '../src/world/start';
import { PLAZA_HALF_WIDTH, VESTIBULE_TO } from '../src/world/layout';

describe('phase 01 monumental arrival', () => {
  it('keeps the gateway supports outside the walkable plaza and the lintel overhead', () => {
    const scope = new ResourceScope('arrival-architecture-test');
    const arrival = new ArrivalBeacons(scope);
    const piers = arrival.group.children.filter((item) => item.name === 'monumental-arrival-pier');
    const lintel = arrival.group.getObjectByName('monumental-arrival-lintel');
    expect(piers).toHaveLength(2);
    expect(lintel).toBeDefined();
    for (const pier of piers) {
      expect(Math.abs(pier.position.x)).toBeGreaterThan(PLAZA_HALF_WIDTH);
      expect(pier.position.z).toBe(VESTIBULE_TO + 4);
    }
    expect(lintel!.position.y).toBeGreaterThan(20);
    expect(lintel!.position.x).toBe(0);
    // With yaw zero the visitor looks toward decreasing Z. The gateway must
    // actually frame the entrance ahead, not sit behind the opening camera.
    expect(START_YAW).toBe(0);
    expect(lintel!.position.z).toBeLessThan(START_POSITION[2]);
    expect(lintel!.position.z).toBeGreaterThan(VESTIBULE_TO);
    expect(Math.abs(lintel!.position.x - START_POSITION[0])).toBeLessThan(1);
    scope.dispose();
  });

  it('uses shared resources and never adds a physical light or collision mesh', () => {
    const scope = new ResourceScope('arrival-architecture-test');
    const arrival = new ArrivalBeacons(scope);
    const meshes: THREE.Mesh[] = [];
    arrival.group.traverse((object) => {
      expect((object as THREE.Light).isLight).not.toBe(true);
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    expect(meshes.length).toBeGreaterThan(5);
    const shafts = meshes.filter((mesh) => mesh.material instanceof THREE.MeshBasicMaterial
      && mesh.material.transparent);
    expect(shafts).toHaveLength(4);
    expect(new Set(shafts.map((mesh) => mesh.geometry)).size).toBe(1);
    const markers = arrival.group.children.filter((item) => item.name === 'ceremonial-searchlight');
    expect(markers).toHaveLength(4);
    for (const marker of markers) {
      expect(marker.position.z).toBeLessThan(START_POSITION[2]);
      expect(marker.position.z).toBeGreaterThan(VESTIBULE_TO);
    }
    scope.dispose();
  });
});
