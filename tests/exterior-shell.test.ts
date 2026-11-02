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
});
