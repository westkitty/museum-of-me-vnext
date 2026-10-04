import { describe, it, expect } from 'vitest';
import { COLLECTION, WINGS_BY_ID, exhibitsForWing } from '../src/content/collection.generated';
import { ZONES, ZONE_BY_ID, WINGS, WING_BY_ID, PLACEMENTS, LEVEL_1_Y, zoneAt, shapeContains } from '../src/world/layout';
import { compassHeading, mapLevelForY, nearestUnvisitedId } from '../src/ui/MapPanel';

/**
 * The map, the HUD location line and the accessible mirror all read from the
 * same three sources. These tests keep those sources honest without needing a
 * browser: if the data is right, the surfaces built from it are right.
 */
describe('interface data sources', () => {
  it('gives every zone a visitor-facing label, not an internal id', () => {
    for (const z of ZONES) {
      expect(z.label.length, `${z.id}`).toBeGreaterThan(4);
      expect(z.label, `${z.id} label is the raw id`).not.toBe(z.id);
    }
  });

  it('names every wing zone consistently with the collection', () => {
    for (const w of WINGS) {
      const zone = ZONE_BY_ID.get(w.id)!;
      const wing = WINGS_BY_ID.get(w.id)!;
      // The zone label should be recognisable as the same place as the wing.
      const first = wing.name.split(/[\s&,]+/)[0];
      expect(zone.label.toLowerCase(), `${w.id}`).toContain(first.toLowerCase());
    }
  });

  it('lists every exhibit under exactly one wing in the mirror', () => {
    let total = 0;
    for (const wing of COLLECTION.wings) {
      const list = exhibitsForWing(wing.id);
      total += list.length;
      for (const e of list) expect(e.wing).toBe(wing.id);
    }
    expect(total).toBe(35);
  });

  it('describes every wing for the map and the mirror', () => {
    for (const wing of COLLECTION.wings) {
      expect(wing.blurb.length, `${wing.id}`).toBeGreaterThan(40);
      expect(wing.subtitle.length).toBeGreaterThan(4);
    }
  });

  it('resolves a mezzanine bay to its mezzanine, not the wing beneath it', () => {
    // Found by the Phase 13 walkthrough: standing in a mezzanine bay reported
    // the ground wing below, because the ground slab reached up past the
    // balcony floor and the mezzanines run diagonally over those bays.
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      if (wing.level !== 1) continue;
      const spot = placement.visitorSpot;
      expect(zoneAt([spot[0], spot[1] + 0.1, spot[2]]), `${placement.exhibitId}`).toBe(placement.wing);
    }
  });

  it('resolves every ground-floor bay to its own wing', () => {
    for (const placement of PLACEMENTS) {
      const wing = WING_BY_ID.get(placement.wing)!;
      if (wing.level !== 0) continue;
      const spot = placement.visitorSpot;
      expect(zoneAt([spot[0], spot[1] + 0.1, spot[2]]), `${placement.exhibitId}`).toBe(placement.wing);
    }
  });

  it('keeps zone volumes from claiming each other', () => {
    // A zone's own representative point must belong to it and nothing else that
    // is tested earlier — this is what stopped the Sanctuary swallowing bays.
    for (const z of ZONES) {
      expect(zoneAt(z.center), `${z.id} centre`).toBe(z.id);
    }
    // The rotunda centre must not fall inside any wing volume.
    for (const w of WINGS) {
      const zone = ZONE_BY_ID.get(w.id)!;
      for (const shape of zone.shapes) {
        expect(shapeContains(shape, [0, 1, 0]), `${w.id} reaches the rotunda centre`).toBe(false);
      }
    }
  });
});


describe('map orientation helpers', () => {
  it('translates camera yaw into museum compass headings', () => {
    expect(compassHeading(0)).toBe('N');
    expect(compassHeading(Math.PI / 2)).toBe('W');
    expect(compassHeading(-Math.PI / 2)).toBe('E');
    expect(compassHeading(Math.PI)).toBe('S');
  });

  it('chooses the visitor floor from physical height', () => {
    expect(mapLevelForY(0)).toBe(0);
    expect(mapLevelForY(LEVEL_1_Y)).toBe(1);
    expect(mapLevelForY(LEVEL_1_Y - 2.01)).toBe(0);
  });

  it('finds the physically nearest unvisited exhibit', () => {
    const origin = PLACEMENTS[0].doorway;
    const visited = new Set(PLACEMENTS.slice(1).map((entry) => entry.exhibitId));
    expect(nearestUnvisitedId(origin, visited)).toBe(PLACEMENTS[0].exhibitId);
  });

  it('returns null when every exhibit has been visited', () => {
    const visited = new Set(PLACEMENTS.map((entry) => entry.exhibitId));
    expect(nearestUnvisitedId([0, 0, 0], visited)).toBeNull();
  });
});
