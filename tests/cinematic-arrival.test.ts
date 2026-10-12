import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { ArrivalBeacons } from '../src/world/ArrivalBeacons';
import { canEnterArrival, sampleArrivalCamera } from '../src/world/ArrivalCamera';
import { App } from '../src/app/App';
import { mountCinematicArrival } from '../src/ui/CinematicArrival';
import { START_POSITION, START_YAW } from '../src/world/start';
import { PLAZA_HALF_WIDTH, VESTIBULE_TO } from '../src/world/layout';

describe('phase 01 monumental arrival', () => {
  it('enforces the minimum prewarm dwell and bounded fallback', () => {
    expect(canEnterArrival(3999, 4000, true)).toBe(false);
    expect(canEnterArrival(4000, 4000, true)).toBe(true);
    expect(canEnterArrival(4000, 4000, false)).toBe(false);
    expect(canEnterArrival(7999, 4000, false)).toBe(false);
    expect(canEnterArrival(8000, 4000, false)).toBe(true);
  });

  it('converges monotonically from sky/crane framing to the untouched visitor eye', () => {
    const start = sampleArrivalCamera(0, 4000);
    const middle = sampleArrivalCamera(2000, 4000);
    const end = sampleArrivalCamera(4000, 4000);
    expect(start).toEqual({ rise: 6.5, retreat: 18, pitch: 0.16 });
    expect(middle.rise).toBeGreaterThan(0);
    expect(middle.rise).toBeLessThan(start.rise);
    expect(middle.retreat).toBeLessThan(start.retreat);
    expect(middle.pitch).toBeLessThan(start.pitch);
    expect(end).toEqual({ rise: 0, retreat: 0, pitch: 0 });
    expect(sampleArrivalCamera(8000, 4000)).toEqual(end);
  });


  it('routes title readiness through the app-owned variable update loop', () => {
    expect(typeof App.prototype.setArrivalUpdate).toBe('function');
    expect(typeof App.prototype.variableUpdate).toBe('function');
    expect(typeof mountCinematicArrival).toBe('function');
  });
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
