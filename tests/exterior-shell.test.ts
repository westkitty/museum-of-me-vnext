import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { ExteriorMuseumShell } from '../src/world/exterior/ExteriorMuseumShell';

describe('ExteriorMuseumShell', () => {
  it('builds the reference massing, material families and a clear portal axis', () => {
    const scope = new ResourceScope('shell-test');
    const collision = new CollisionWorld();
    const shell = new ExteriorMuseumShell(scope, collision);
    const root = shell.build();
    const names: string[] = [];
    root.traverse((node) => { if (node.name) names.push(node.name); });

    expect(names).toContain('curved-roof-wing-west');
    expect(names).toContain('curved-roof-wing-east');
    expect(names).toContain('central-turquoise-dome-glazing');
    expect(names.filter((name) => name.startsWith('dome-gold-rib-'))).toHaveLength(16);
    expect(names).toContain('north-rear-elevation');
    expect(names).toContain('raised-stone-terrace');
    expect(names.filter((name) => name.startsWith('formal-stair-tread-'))).toHaveLength(6);

    const roof = root.getObjectByName('curved-roof-wing-west') as THREE.Mesh;
    expect(roof.position.toArray()).toEqual([-25.5, 9.5, 0]);
    expect((roof.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x0c1017);
    expect(collision.size).toBeGreaterThan(0);
    const portal = { x: 0, y: 0, z: 127.5 };
    expect(collision.resolveHorizontal(portal, 0.35, 1.8)).toBe(false);

    scope.dispose();
    expect(scope.size).toBe(0);
    expect(scope.isDisposed).toBe(true);
  });
  it('joins exterior roof, side elevations and portal without sealing the walking axis', () => {
    const scope = new ResourceScope('shell-envelope-test');
    const collision = new CollisionWorld();
    const root = new ExteriorMuseumShell(scope, collision).build();
    const bounds = (name: string) => {
      const object = root.getObjectByName(name);
      expect(object, name).toBeTruthy();
      object!.updateWorldMatrix(true, false);
      return new THREE.Box3().setFromObject(object!);
    };
    const westRoof = bounds('curved-roof-wing-west');
    const westWall = bounds('side-facade--1');
    const eastRoof = bounds('curved-roof-wing-east');
    const eastWall = bounds('side-facade-1');
    const rear = bounds('north-rear-elevation');
    const entryRoof = bounds('entrance-connector-roof');
    const southFacade = bounds('south-facade-left');
    expect(westRoof.min.x).toBeLessThanOrEqual(westWall.max.x);
    expect(eastRoof.max.x).toBeGreaterThanOrEqual(eastWall.min.x);
    expect(westRoof.min.z).toBeLessThanOrEqual(rear.max.z);
    expect(eastRoof.min.z).toBeLessThanOrEqual(rear.max.z);
    expect(entryRoof.min.z).toBeLessThanOrEqual(westRoof.max.z);
    expect(entryRoof.max.z).toBeGreaterThanOrEqual(southFacade.min.z);
    expect(collision.resolveHorizontal({ x: 0, y: 0, z: 116 }, 0.35, 1.8)).toBe(false);
    expect(collision.resolveHorizontal({ x: 0, y: 0, z: 127.5 }, 0.35, 1.8)).toBe(false);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('keeps the gold dome meridians on the same hemisphere as the glazing', () => {
    const scope = new ResourceScope('shell-dome-test');
    const root = new ExteriorMuseumShell(scope, new CollisionWorld()).build();
    const dome = root.getObjectByName('central-turquoise-dome-glazing') as THREE.Mesh;
    const rib = root.getObjectByName('dome-gold-rib-1') as THREE.Mesh;
    expect(dome).toBeTruthy();
    expect(rib).toBeTruthy();
    const points = (rib.geometry as THREE.TubeGeometry).parameters.path.getPoints(24);
    for (const p of points) {
      const r = Math.hypot(p.x, p.z);
      const height = p.y - dome.position.y;
      expect(r * r + height * height).toBeCloseTo(15 * 15, 1);
      expect(p.y).toBeGreaterThanOrEqual(11.5 - 1e-5);
    }
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(26.5, 1);
    scope.dispose();
  });

});
