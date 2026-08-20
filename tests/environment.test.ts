import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { EnvironmentDressing } from '../src/world/EnvironmentDressing';
import { ExhibitThresholds } from '../src/world/ExhibitThresholds';
import { PLACEMENTS, WINGS } from '../src/world/layout';
import { PaletteSet } from '../src/world/palette';
import { Sky } from '../src/world/Sky';
import { WingAtmosphere } from '../src/world/WingAtmosphere';
import { WingIdentity } from '../src/world/WingIdentity';

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

  it('uses a daylight sky rather than the former near-black exterior', () => {
    const scope = new ResourceScope('environment-test');
    const sky = new Sky(scope);
    expect(sky.horizon.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.7);
    scope.dispose();
  });
});
