import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { EnvironmentDressing } from '../src/world/EnvironmentDressing';
import { ExhibitColorFields } from '../src/world/ExhibitColorFields';
import { ExhibitThresholds } from '../src/world/ExhibitThresholds';
import { ExteriorIdentity } from '../src/world/ExteriorIdentity';
import { PLACEMENTS, WINGS } from '../src/world/layout';
import { PaletteSet } from '../src/world/palette';
import { RotundaWayfinding } from '../src/world/RotundaWayfinding';
import { Sky } from '../src/world/Sky';
import { WingAtmosphere } from '../src/world/WingAtmosphere';
import { WingFurnishings } from '../src/world/WingFurnishings';
import { WingIdentity } from '../src/world/WingIdentity';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { CollisionWorld } from '../src/world/CollisionWorld';

describe('museum environment coherence', () => {
  it('keeps the Rotunda substantially brighter than the themed wings', () => {
    const scope = new ResourceScope('environment-test');
    const palettes = new PaletteSet(scope);

    const rotunda = (palettes.get('rotunda').wall as THREE.MeshStandardMaterial).color;
    const north = (palettes.get('north').wall as THREE.MeshStandardMaterial).color;
    const south = (palettes.get('south').wall as THREE.MeshStandardMaterial).color;

    expect(rotunda.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.85);
    expect(rotunda.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(north.getHSL({ h: 0, s: 0, l: 0 }).l + 0.35);
    expect(rotunda.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(south.getHSL({ h: 0, s: 0, l: 0 }).l + 0.25);
    scope.dispose();
  });

  it('gives major wings distinct accent colours', () => {
    const scope = new ResourceScope('environment-test');
    const palettes = new PaletteSet(scope);
    const zones = ['north', 'east', 'south', 'west', 'media', 'infra'] as const;
    const accents = zones.map((zone) => (palettes.get(zone).accent as THREE.MeshStandardMaterial).color.getHexString());
    expect(new Set(accents).size).toBe(zones.length);
    scope.dispose();
  });

  it('ships explicit welcome, planting, seating, facade and corridor dressing', () => {
    const scope = new ResourceScope('environment-test');
    const dressing = new EnvironmentDressing(scope).build();
    const names = new Set<string>();
    dressing.traverse((node) => { if (node.name) names.add(node.name); });

    expect(names.has('environment-dressing')).toBe(true);
    expect(names.has('facade-entablature')).toBe(true);
    expect(names.has('baseline-vestibule-floor')).toBe(true);
    expect(names.has('welcome-information-desk')).toBe(true);
    expect(names.has('indoor-plant')).toBe(true);
    expect(names.has('interior-bench')).toBe(true);
    expect(names.has('hall-pedestal')).toBe(true);
    scope.dispose();
  });

  it('strengthens the visible museum facade without replacing the real entrance', () => {
    const scope = new ResourceScope('environment-test');
    const exterior = new ExteriorIdentity(scope).build();
    const names = new Set<string>();
    exterior.traverse((node) => { if (node.name) names.add(node.name); });

    expect(names.has('exterior-museum-identity')).toBe(true);
    expect(names.has('arrival-facade-cornice')).toBe(true);
    expect(names.has('arrival-facade-glazing')).toBe(true);
    expect(names.has('arrival-facade-crest')).toBe(true);
    scope.dispose();
  });

  it('adds recognisable colour and shape identity to every wing', () => {
    const scope = new ResourceScope('environment-test');
    const identity = new WingIdentity(scope).build();
    const bands = identity.children.filter((node) => node.name.startsWith('wing-threshold-band:'));
    const motifs = identity.children.filter((node) => node.name.startsWith('wing-motif:'));
    const strips = identity.children.filter((node) => node.name.startsWith('wing-transition-strip:'));

    expect(bands).toHaveLength(WINGS.length);
    expect(motifs).toHaveLength(WINGS.length * 2);
    expect(strips).toHaveLength(WINGS.length * 2);
    scope.dispose();
  });

  it('continues each wing colour family through decorative hall atmosphere', () => {
    const scope = new ResourceScope('environment-test');
    const atmosphere = new WingAtmosphere(scope).build();
    const fixtures = atmosphere.children.filter((node) => node.name.startsWith('wing-ceiling-fixture:'));
    const inlays = atmosphere.children.filter((node) => node.name.startsWith('wing-wall-inlay:'));

    expect(fixtures.length).toBeGreaterThanOrEqual(WINGS.length * 3);
    expect(inlays).toHaveLength(WINGS.length * 2);
    scope.dispose();
  });

  it('gives every wing its own authored furnishing vocabulary', () => {
    const scope = new ResourceScope('environment-test');
    const furnishings = new WingFurnishings(scope).build();
    const groups = furnishings.children.filter((node) => node.name.startsWith('wing-furnishing:'));

    expect(groups).toHaveLength(WINGS.length * 2);
    for (const wing of WINGS) {
      expect(groups.filter((node) => node.name === `wing-furnishing:${wing.id}`)).toHaveLength(2);
    }
    let lights = 0;
    furnishings.traverse((node) => { if ((node as THREE.Light).isLight) lights++; });
    expect(lights).toBe(0);
    scope.dispose();
  });

  it('keeps the neutral Rotunda readable while threading colour to all six wings', () => {
    const scope = new ResourceScope('environment-test');
    const wayfinding = new RotundaWayfinding(scope).build();
    const threads = wayfinding.children.filter((node) => node.name.startsWith('rotunda-route-thread:'));
    const medallions = wayfinding.children.filter((node) => node.name.startsWith('rotunda-zone-medallion:'));
    const ticks = wayfinding.children.filter((node) => node.name.startsWith('rotunda-route-tick:'));

    expect(threads).toHaveLength(WINGS.length);
    expect(medallions).toHaveLength(WINGS.length);
    expect(ticks).toHaveLength(WINGS.length * 2);
    scope.dispose();
  });

  it('adds a derived colour frame to every exhibit threshold', () => {
    const scope = new ResourceScope('environment-test');
    const thresholds = new ExhibitThresholds(scope).build();
    const blades = thresholds.children.filter((node) => node.name.startsWith('exhibit-accent:'));
    const headers = thresholds.children.filter((node) => node.name.startsWith('exhibit-header:'));

    expect(blades).toHaveLength(PLACEMENTS.length * 2);
    expect(headers).toHaveLength(PLACEMENTS.length);
    expect(new Set(headers.map((node) => node.name)).size).toBe(PLACEMENTS.length);
    scope.dispose();
  });

  it('carries each wing palette into the interior of all 35 exhibit bays', () => {
    const scope = new ResourceScope('environment-test');
    const fields = new ExhibitColorFields(scope).build();
    let floors = 0;
    let backdrops = 0;
    let rails = 0;
    fields.traverse((node) => {
      if (node.name.startsWith('exhibit-floor-field:')) floors++;
      if (node.name.startsWith('exhibit-backdrop-field:')) backdrops++;
      if (node.name.startsWith('exhibit-backdrop-rail:')) rails++;
    });

    expect(fields.children).toHaveLength(PLACEMENTS.length);
    expect(floors).toBe(PLACEMENTS.length);
    expect(backdrops).toBe(PLACEMENTS.length);
    expect(rails).toBe(PLACEMENTS.length);
    scope.dispose();
  });

  it('uses a procedural night sky with a dark horizon', () => {
    const scope = new ResourceScope('environment-test');
    const sky = new Sky(scope);
    expect(sky.mesh.name).toBe('night-sky-starfield-blood-ring');
    expect(sky.horizon.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.12);
    scope.dispose();
  });

  it('adds visual-only island terrain, shoreline, and water without altering collision ownership', () => {
    const scope = new ResourceScope('environment-test');
    const collision = new CollisionWorld();
    const garden = new ArrivalGarden(scope, collision).build();
    expect(garden.getObjectByName('night-island-terrain')).toBeTruthy();
    expect(garden.getObjectByName('night-island-shoreline')).toBeTruthy();
    expect(garden.getObjectByName('night-island-water')).toBeTruthy();
    expect(collision.size).toBeGreaterThan(0); // garden trees/benches retain their own proven blockers
    scope.dispose();
  });
});
