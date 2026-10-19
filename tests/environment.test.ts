import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { EnvironmentDressing } from '../src/world/EnvironmentDressing';
import { Detailing } from '../src/world/Detailing';
import { ExhibitColorFields } from '../src/world/ExhibitColorFields';
import { ExhibitThresholds } from '../src/world/ExhibitThresholds';
import { ExteriorIdentity } from '../src/world/ExteriorIdentity';
import { MonumentalRotunda } from '../src/world/MonumentalRotunda';
import { PLACEMENTS, ROTUNDA_APOTHEM, SANCTUARY_DIR, WINGS } from '../src/world/layout';
import { PaletteSet } from '../src/world/palette';
import { RotundaWayfinding } from '../src/world/RotundaWayfinding';
import { NIGHT_MOON_DIRECTION, Sky } from '../src/world/Sky';
import { WingAtmosphere } from '../src/world/WingAtmosphere';
import { WingFurnishings } from '../src/world/WingFurnishings';
import { WingIdentity } from '../src/world/WingIdentity';
import { ArrivalGarden } from '../src/world/ArrivalGarden';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { resolveExhibitTheme } from '../src/world/ExhibitTheme';
import { buildMuseum } from './helpers/walk';

describe('monumental cinematic arrival (regression)', () => {
  it('renders the Drakken Blood Ring as vitrified glass inside the single procedural sky draw', () => {
    const scope = new ResourceScope('cinematic-sky');
    const sky = new Sky(scope);
    const shader = (sky.mesh.material as THREE.ShaderMaterial).fragmentShader;
    expect(shader).toContain('bloodRingBody');
    expect(shader).toContain('glassFacet');
    expect(shader).toContain('floatingGlass');
    expect(shader).not.toContain('orbitalHalo');
    expect(shader).not.toContain('bloodRingHalo');
    expect(sky.mesh.userData.canonicalFeature).toBe('starsilk-drakken-blood-ring');
    expect(sky.mesh.userData.bloodRingConstruction).toBe('vitrified-biospheric-scar');
    expect(shader).toContain('starCloud');
    expect(sky.mesh).toBeInstanceOf(THREE.Mesh);
    expect(sky.mesh.frustumCulled).toBe(false);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('gives the arrival a tall physical-looking noncolliding portico with no extra lights', () => {
    const scope = new ResourceScope('cinematic-portico');
    const root = new ExteriorIdentity(scope).build();
    const towers = root.children.filter((node) => node.name === 'monumental-portal-tower');
    expect(towers).toHaveLength(2);
    expect(towers.map((node) => node.position.x)).toEqual([-20.2, 20.2]);
    expect(towers.every((node) => node.position.y > 8)).toBe(true);
    expect(root.getObjectByName('monumental-portal-architrave')).toBeTruthy();
    expect(root.getObjectByName('monumental-portal-amber-cornice')).toBeTruthy();
    let lights = 0;
    root.traverse((node) => { if (node instanceof THREE.Light) lights++; });
    expect(lights).toBe(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

describe('monumental Rotunda crown', () => {
  it('creates eight octagonal crown segments and paired upper piers without lights', () => {
    const scope = new ResourceScope('rotunda-monument');
    const group = new MonumentalRotunda(scope).build();
    const crowns = group.children.filter((x) => x.name.startsWith('rotunda-crown-architrave:'));
    const piers = group.children.filter((x) => x.name.startsWith('rotunda-upper-pier:'));
    expect(crowns).toHaveLength(8);
    expect(piers).toHaveLength(16);
    expect(group.children.every((node) => !(node instanceof THREE.Light))).toBe(true);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

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

  it('uses physical architectural glass that can pick up the scene environment', () => {
    const scope = new ResourceScope('environment-test');
    const palettes = new PaletteSet(scope);
    const glass = palettes.glass();
    expect(glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const material = glass as THREE.MeshPhysicalMaterial;
    expect(material.transmission).toBeGreaterThan(0.3);
    expect(material.clearcoat).toBeGreaterThan(0);
    expect(material.depthWrite).toBe(false);
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
    expect(names.has('facade-glass-panel:west')).toBe(true);
    expect(names.has('facade-glass-panel:east')).toBe(true);
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
    expect(atmosphere.children.filter((node) => node.name.startsWith('wing-ceiling-housing:'))).toHaveLength(fixtures.length);
    expect(atmosphere.children.filter((node) => node.name.startsWith('wing-ceiling-glint:'))).toHaveLength(fixtures.length);
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

    expect(fields.children).toHaveLength(PLACEMENTS.length + 2);
    const stageRims = fields.getObjectByName('gallery-floor-inlaid-rims') as THREE.InstancedMesh;
    expect(stageRims.isInstancedMesh).toBe(true);
    expect(stageRims.count).toBe(PLACEMENTS.length);
    const relief = fields.getObjectByName('gallery-relief-accents') as THREE.InstancedMesh;
    expect(relief.isInstancedMesh).toBe(true);
    expect(relief.count).toBe(PLACEMENTS.length * 4);
    expect(relief.instanceColor).not.toBeNull();
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

  it('adds emissive architectural depth cues without adding realtime lights', () => {
    const scope = new ResourceScope('environment-test');
    const palettes = new PaletteSet(scope);
    const parents = new Map<string, THREE.Group>();
    for (const id of ['rotunda', 'balcony', 'sanctuary', ...WINGS.map((wing) => wing.id)]) {
      if (!parents.has(id)) parents.set(id, new THREE.Group());
    }
    new Detailing(scope, palettes).applyAll(parents);
    const cove: string[] = [];
    const thresholds: string[] = [];
    let addedLights = 0;
    for (const parent of parents.values()) parent.traverse((node) => {
      if (node.name.startsWith('rotunda-cove-glow:')) cove.push(node.name);
      if (node.name.startsWith('wing-threshold-glow:')) thresholds.push(node.name);
      if ((node as THREE.Light).isLight) addedLights++;
    });
    expect(cove).toHaveLength(8);
    expect(thresholds).toHaveLength(WINGS.length * 2);
    expect(addedLights).toBe(0);
    scope.dispose();
  });

  it('uses a readable procedural night sky with a vitrified Drakken Blood Ring', () => {
    const scope = new ResourceScope('environment-test');
    const sky = new Sky(scope);
    expect(sky.mesh.name).toBe('night-sky-layered-stars');
    const material = sky.mesh.material as THREE.ShaderMaterial;
    expect(material.fragmentShader).toContain('starLayer');
    expect(material.fragmentShader).toContain('galacticBand');
    expect(material.fragmentShader).toContain('moonDisk');
    expect(material.fragmentShader).toContain('moonHalo');
    const skyMoon = material.uniforms.moonDirection.value as THREE.Vector3;
    expect(skyMoon.distanceTo(NIGHT_MOON_DIRECTION)).toBeLessThan(1e-7);
    expect(skyMoon.z).toBeLessThan(0); // visible over the museum from the south arrival
    expect(material.fragmentShader).toContain('bloodRingBody');
    expect(material.fragmentShader).toContain('glassFacet');
    expect(sky.mesh.userData.canonicalFeature).toBe('starsilk-drakken-blood-ring');
    expect(material.fragmentShader).not.toContain('bloodRingHalo');
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
    const waterMesh = water as THREE.Mesh;
    const waterMaterial = waterMesh.material as THREE.ShaderMaterial;
    expect(waterMesh.geometry).toBeInstanceOf(THREE.RingGeometry);
    const waterTriangles = waterMesh.geometry.index
      ? waterMesh.geometry.index.count / 3
      : waterMesh.geometry.getAttribute('position').count / 3;
    expect(waterTriangles).toBeGreaterThanOrEqual(2_500);
    expect(waterTriangles).toBeLessThanOrEqual(3_000);
    expect(waterMesh.userData.visualRole).toBe('environment-water');
    expect(waterMesh.userData.waveModel).toBe('deep-water-dispersion');
    expect(waterMaterial.vertexShader).toContain('sqrt(9.81 * k)');
    expect(waterMaterial.vertexShader).toContain('accumulateWave');
    const waterMoon = waterMaterial.uniforms.moonDirection.value as THREE.Vector3;
    expect(waterMoon.distanceTo(NIGHT_MOON_DIRECTION)).toBeLessThan(1e-7);
    expect(waterMaterial.fragmentShader).toContain('fresnel');
    expect(waterMaterial.fragmentShader).toContain('moonSpecular');
    expect(waterMaterial.fragmentShader).toContain('shoreFoam');
    expect(waterMaterial.fragmentShader).not.toContain('fbm');
    expect(waterMaterial.fragmentShader).not.toContain('hash(');
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

  it('batches all ceremonial arrival dressing into four visually equivalent instances', () => {
    const scope = new ResourceScope('arrival-batch-test');
    const collision = new CollisionWorld();
    const root = new ArrivalGarden(scope, collision).build();
    const expected = new Map([
      ['arrival-ceremonial-bronze-inlay', 2],
      ['arrival-reflective-stone-inset', 18],
      ['arrival-ceremonial-obelisk', 8],
      ['arrival-ceremonial-obelisk-crown', 8],
    ]);
    const meshes = root.children.filter((child) =>
      child.name.startsWith('arrival-') && (child as THREE.InstancedMesh).isInstancedMesh,
    ) as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(4);
    for (const batch of meshes) {
      expect(batch.count).toBe(expected.get(batch.name));
      expect(batch.castShadow).toBe(false);
      expect(batch.receiveShadow).toBe(false);
      expect(batch.boundingSphere).not.toBeNull();
    }
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pillars = meshes.find((mesh) => mesh.name === 'arrival-ceremonial-obelisk')!;
    for (let i = 0; i < pillars.count; i++) {
      pillars.getMatrixAt(i, matrix);
      matrix.decompose(position, rotation, scale);
      expect(Math.abs(position.x)).toBeCloseTo(11.8, 3);
      expect(scale.x).toBeCloseTo(0.5, 3);
      expect(scale.y).toBeCloseTo(2.9, 3);
    }
    const panels = meshes.find((mesh) => mesh.name === 'arrival-reflective-stone-inset')!;
    panels.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(Math.abs(position.x)).toBeCloseTo(2.4, 3);
    expect(Math.abs(rotation.x)).toBeCloseTo(Math.SQRT1_2, 3);
    expect([...root.children].some((node) => (node as THREE.Light).isLight)).toBe(false);
    expect(collision.size).toBeGreaterThan(0); // preexisting trees, benches and fountain
    const disposeSpies = meshes.map((mesh) => vi.spyOn(mesh, 'dispose'));
    scope.dispose();
    for (const spy of disposeSpies) expect(spy).toHaveBeenCalledOnce();
    expect(scope.size).toBe(0);
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
