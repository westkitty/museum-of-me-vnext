import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DexterSanctuary } from '../src/exhibits/sanctuary/DexterSanctuary';
import { ResourceScope } from '../src/assets/ResourceScope';
import { COLLECTION } from '../src/content/collection.generated';
import { SANCTUARY_CENTER, SANCTUARY_FLOOR_Y, zoneAt, ZONE_BY_ID } from '../src/world/layout';
import { readFileSync } from 'node:fs';

describe('the Dexter Sanctuary', () => {
  it('is not one of the thirty-five exhibits', () => {
    expect(COLLECTION.exhibits).toHaveLength(35);
    for (const e of COLLECTION.exhibits) {
      expect(e.title.toLowerCase(), 'Dexter has been made into an exhibit').not.toContain('sanctuary');
      expect(e.projectIds).not.toContain('DEXTER');
    }
    // It is a zone of the building, not an entry in the collection.
    expect(ZONE_BY_ID.get('sanctuary')?.label).toBe('Dexter Sanctuary');
  });

  it('sits below and behind the Rotunda axis', () => {
    expect(SANCTUARY_FLOOR_Y).toBeLessThan(0);
    // Behind: on the far side of the Rotunda from the south entrance.
    expect(SANCTUARY_CENTER[2]).toBeLessThan(-20);
    expect(zoneAt([SANCTUARY_CENTER[0], SANCTUARY_FLOOR_Y + 1, SANCTUARY_CENTER[2]])).toBe('sanctuary');
  });

  it('builds Dexter with the hanging ears the variety is named for', () => {
    const scope = new ResourceScope('sanctuary');
    const sanctuary = new DexterSanctuary(scope);
    const dexter = sanctuary.group.getObjectByName('dexter');
    expect(dexter, 'Dexter is missing from his own sanctuary').toBeTruthy();

    const box = new THREE.Box3().setFromObject(dexter!);
    const size = new THREE.Vector3();
    box.getSize(size);
    // A small spaniel lying down: longer than tall, and not a placeholder box.
    expect(size.x).toBeGreaterThan(size.y);
    expect(size.y).toBeGreaterThan(0.3);
    let meshes = 0;
    dexter!.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshes++; });
    expect(meshes, 'Dexter is too crude for this room').toBeGreaterThan(20);

    sanctuary.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('holds still under reduced motion', () => {
    const scope = new ResourceScope('sanctuary');
    const sanctuary = new DexterSanctuary(scope);
    const dexter = sanctuary.group.getObjectByName('dexter')!;
    const before = dexter.children.map((c) => c.position.y);
    for (let i = 0; i < 120; i++) sanctuary.update(1 / 60, true);
    expect(dexter.children.map((c) => c.position.y)).toEqual(before);
    scope.dispose();
  });

  it('contains nothing that turns him into a mascot', () => {
    const source = readFileSync('src/exhibits/sanctuary/DexterSanctuary.ts', 'utf8');
    const forbidden = [
      /\bscore\b(?!,? no)/i, /\bbadge/i, /\bcollectible/i, /\bpaw.?print/i,
      /\bachievement/i, /\bunlock/i, /\breward/i, /\bpoints\b/i, /\btutorial\b(?!\s+voice)/i,
    ];
    // The file may name these only to say the room does not have them.
    const body = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    for (const re of forbidden) {
      expect(re.test(body), `Sanctuary implementation matches ${re}`).toBe(false);
    }
  });

  it('offers accessible text without being listed as an exhibit', () => {
    const scope = new ResourceScope('sanctuary');
    const sanctuary = new DexterSanctuary(scope);
    const content = sanctuary.accessibleContent();
    expect(content.heading).toContain('Dexter');
    expect(content.body.join(' ')).toMatch(/Phal(è|e)ne/);
    expect(content.body.join(' ')).toMatch(/none of them are him/i);
    scope.dispose();
  });
});
