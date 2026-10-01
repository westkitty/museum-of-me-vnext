import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { EnvironmentDressing } from '../src/world/EnvironmentDressing';
import { ExhibitColorFields } from '../src/world/ExhibitColorFields';
import { ExhibitThresholds } from '../src/world/ExhibitThresholds';
import { ExteriorIdentity } from '../src/world/ExteriorIdentity';
import { PLACEMENTS, ROTUNDA_APOTHEM, SANCTUARY_DIR, WINGS } from '../src/world/layout';
import { PaletteSet } from '../src/world/palette';
import { RotundaWayfinding } from '../src/world/RotundaWayfinding';
import { Sky } from '../src/world/Sky';
import { WingAtmosphere } from '../src/world/WingAtmosphere';
import { WingFurnishings } from '../src/world/WingFurnishings';
import { WingIdentity } from '../src/world/WingIdentity';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { resolveExhibitTheme } from '../src/world/ExhibitTheme';
import { buildMuseum } from './helpers/walk';

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
    expect(atmosphere.getObjectByName('north-azure-sparkles')).toBeTruthy();
    expect(atmosphere.children.find((node) => node.name === 'north-azure-sparkles')?.children).toHaveLength(42);
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

  it('uses existing project metadata to make every exhibit bay read as a themed room', () => {
    const scope = new ResourceScope('environment-test');
    const fields = new ExhibitColorFields(scope).build();
    let floors = 0;
    let walls = 0;
    let headers = 0;
    let uprights = 0;
    fields.traverse((node) => {
      if (node.name.startsWith('exhibit-floor-field:')) floors++;
      if (node.name.startsWith('exhibit-theme-wall:')) walls++;
      if (node.name.startsWith('exhibit-theme-wall-header:')) headers++;
      if (node.name.startsWith('exhibit-theme-wall-upright:')) uprights++;
    });

    expect(fields.children).toHaveLength(PLACEMENTS.length);
    expect(floors).toBe(PLACEMENTS.length);
    expect(walls).toBe(PLACEMENTS.length);
    expect(headers).toBe(PLACEMENTS.length);
    expect(uprights).toBe(PLACEMENTS.length * 2);
    expect(fields.getObjectByName('exhibit-color-field:E17')?.userData.theme).toBe('dex');
    expect(fields.getObjectByName('exhibit-color-field:E27')?.userData.theme).toBe('games');
    scope.dispose();
  });

  it('keeps Starsilk rooms and halls in the black, deep-blue, azure palette', () => {
    const scope = new ResourceScope('environment-test');
    const palettes = new PaletteSet(scope);
    const north = palettes.get('north');
    const wall = (north.wall as THREE.MeshStandardMaterial).color;
    const accent = (north.accent as THREE.MeshStandardMaterial).color;
    const theme = resolveExhibitTheme('E01', 'north');

    expect(wall.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.08);
    expect(accent.getHSL({ h: 0, s: 0, l: 0 }).h).toBeGreaterThan(0.5);
    expect(theme.id).toBe('starsilk');
    scope.dispose();
  });

  it('uses a readable procedural night sky with a world-relative physical Blood Ring', () => {
    const scope = new ResourceScope('environment-test');
    const sky = new Sky(scope);
    expect(sky.mesh.name).toBe('night-sky-layered-stars');
    const material = sky.mesh.material as THREE.ShaderMaterial;
    expect(material.fragmentShader).toContain('starLayer');
    expect(material.fragmentShader).not.toContain('bloodBand');
    expect(material.fragmentShader).not.toContain('ringAngle');
    expect(sky.bloodRing.name).toBe('blood-ring-complete-orbital-structure');
    expect(sky.bloodRing.geometry).toBeInstanceOf(THREE.TorusGeometry);
    expect(sky.bloodRing.position.y).toBe(Sky.BLOOD_RING_HEIGHT);
    expect(sky.bloodRing.position.x).toBe(0);
    expect(sky.bloodRing.position.z).toBe(0);
    expect(sky.bloodRing.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const ringMaterial = sky.bloodRing.material as THREE.MeshPhysicalMaterial;
    // Transmission is excluded from the shipped ring material because a
    // controlled same-artifact profile measured 520 → 996 Rotunda draw calls
    // and 571.9 → 1321.6 ms rAF p50 when a diagnostic 0.03 override was applied.
    // Those are Chromium/SwiftShader results, not device FPS; see the paired
    // profile JSON files. This structural test protects the intentional red
    // emissive, clearcoat, flat-facet identity without pretending that the
    // small refraction change has human visual approval.
    expect(ringMaterial.transmission).toBe(0);
    expect(ringMaterial.flatShading).toBe(true);
    expect(ringMaterial.clearcoat).toBeGreaterThan(0.5);
    expect(ringMaterial.emissiveIntensity).toBeGreaterThan(0.5);
    const ringHsl = ringMaterial.color.getHSL({ h: 0, s: 0, l: 0 });
    expect(ringHsl.h < 0.03 || ringHsl.h > 0.97).toBe(true);
    expect(ringHsl.s).toBeGreaterThan(0.75);
    expect(sky.horizon.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(0.03);
    expect(sky.horizon.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.07);
    scope.dispose();
  });

  it('adds visual-only island terrain, shoreline, and water without altering collision ownership', () => {
    const scope = new ResourceScope('environment-test');
    const collision = new CollisionWorld();
    const garden = new ArrivalGarden(scope, collision);
    const gardenRoot = garden.build();
    expect(gardenRoot.getObjectByName('night-island-terrain')).toBeTruthy();
    expect(gardenRoot.getObjectByName('night-island-shoreline')).toBeTruthy();
    const water = gardenRoot.getObjectByName('night-island-water');
    expect(water).toBeTruthy();
    const waterMaterial = (water as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(waterMaterial.fragmentShader).toContain('fbm');
    expect(waterMaterial.fragmentShader).not.toContain('* 160.0');
    const initialWaterTime = waterMaterial.uniforms.time.value as number;
    garden.update(1, false);
    expect(waterMaterial.uniforms.time.value).toBeGreaterThan(initialWaterTime);
    const animatedWaterTime = waterMaterial.uniforms.time.value as number;
    garden.update(1, true);
    expect(waterMaterial.uniforms.time.value).toBe(animatedWaterTime);
    expect(collision.size).toBeGreaterThan(0); // garden trees/benches retain their own proven blockers
    expect((gardenRoot.getObjectByName('night-island-shoreline') as THREE.Mesh).userData.visualRole).toBe('water-boundary');
    scope.dispose();
  });

  it('keeps the NW Sanctuary threshold as one clear signed passage', () => {
    const built = buildMuseum();
    const sign = built.root.getObjectByName('sanctuary-threshold-sign');
    expect(sign).toBeTruthy();
    expect(sign?.userData.copy).toBe('STINK WEASEL DEN');

    const supplementaryAtThreshold: string[] = [];
    built.root.traverse((node) => {
      const world = node.getWorldPosition(new THREE.Vector3());
      const alongSanctuary = world.x * SANCTUARY_DIR[0] + world.z * SANCTUARY_DIR[2];
      if (node.name.startsWith('supplementary:') && alongSanctuary >= ROTUNDA_APOTHEM - 3) {
        supplementaryAtThreshold.push(node.name);
      }
    });
    expect(supplementaryAtThreshold).toEqual([]);
    built.scope.dispose();
  });
});
