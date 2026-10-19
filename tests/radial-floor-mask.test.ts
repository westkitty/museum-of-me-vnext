import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { radialFloorMask } from '../src/world/RadialFloorMask';
import { ExhibitColorFields } from '../src/world/ExhibitColorFields';
import { PLACEMENTS } from '../src/world/layout';

describe('shared gallery lighting mask', () => {
  it('uses one deterministic small locally generated alpha mask per scope', () => {
    const a = new ResourceScope('soft-mask-A');
    const b = new ResourceScope('soft-mask-B');
    const mask = radialFloorMask(a);
    expect(radialFloorMask(a)).toBe(mask);
    expect(mask.colorSpace).toBe(THREE.NoColorSpace);
    expect(mask.generateMipmaps).toBe(false);
    const pixels = mask.image.data as Uint8Array;
    expect(pixels).toHaveLength(64 * 64 * 4);
    expect(Array.from(pixels)).toEqual(Array.from(radialFloorMask(b).image.data as Uint8Array));
    expect(pixels[4 * (32 * 64 + 32) + 1]).toBeGreaterThan(220);
    expect(pixels[1]).toBe(0);
    a.dispose(); b.dispose();
    expect(a.size).toBe(0);
    expect(b.size).toBe(0);
  });

  it('culls the new gallery light pools together with the existing rims and witness marks', () => {
    const scope = new ResourceScope('gallery-pools');
    const fields = new ExhibitColorFields(scope);
    fields.build();
    const pool = fields.group.getObjectByName('gallery-curatorial-light-pools') as THREE.InstancedMesh;
    const rim = fields.group.getObjectByName('gallery-floor-inlaid-rims') as THREE.InstancedMesh;
    const mark = fields.group.getObjectByName('gallery-relief-accents') as THREE.InstancedMesh;
    expect(pool.count).toBe(PLACEMENTS.length);
    fields.setVisibleWings(new Set(['north']));
    const north = PLACEMENTS.filter((p) => p.wing === 'north').length;
    expect(pool.count).toBe(north);
    expect(rim.count).toBe(north);
    expect(mark.count).toBe(north * 4);
    fields.setVisibleWings(null);
    expect(pool.count).toBe(PLACEMENTS.length);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
