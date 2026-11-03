import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { ArrivalBeacons } from '../src/world/ArrivalBeacons';

describe('arrival composition visual regression', () => {
  it('frames the facade with two low piers and never blocks the central view with a lintel', () => {
    const scope = new ResourceScope('arrival-framing-test');
    const root = new ArrivalBeacons(scope).group;
    const piers = root.children.filter((node) => node.name === 'monumental-arrival-pier') as THREE.Mesh<THREE.BoxGeometry>[];
    const sideCaps = root.getObjectByName('monumental-arrival-lintel') as THREE.Group;
    expect(piers).toHaveLength(2);
    expect(piers.map((node) => node.position.x)).toEqual([-23.5, 23.5]);
    expect(piers.every((node) => node.position.y === 4.9 && node.geometry.parameters.height === 9.8)).toBe(true);
    expect(sideCaps).toBeInstanceOf(THREE.Group);
    expect(sideCaps.children).toHaveLength(4);
    for (const child of sideCaps.children as THREE.Mesh<THREE.BoxGeometry>[]) {
      const halfWidth = child.geometry.parameters.width / 2;
      expect(Math.abs(child.position.x) - halfWidth).toBeGreaterThan(20);
      expect(child.position.y).toBeLessThan(11);
    }
    const searchlights = root.children.filter((node) => node.name === 'ceremonial-searchlight') as THREE.Group[];
    expect(searchlights).toHaveLength(4);
    for (const marker of searchlights) {
      const shaft = marker.children.find((node) => node instanceof THREE.Mesh &&
        node.geometry instanceof THREE.CylinderGeometry &&
        node.geometry.parameters.height === 32);
      expect(shaft).toBeTruthy();
    }
    let lights = 0;
    root.traverse((node) => { if (node instanceof THREE.Light) lights++; });
    expect(lights).toBe(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
