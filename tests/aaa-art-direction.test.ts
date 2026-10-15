import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ResourceScope } from '../src/assets/ResourceScope';
import { architecturalStoneFinish } from '../src/world/SurfaceFinish';
import { PaletteSet } from '../src/world/palette';
import { ExhibitColorFields } from '../src/world/ExhibitColorFields';
import { Detailing } from '../src/world/Detailing';
import { PLACEMENTS, WINGS } from '../src/world/layout';
import { AtmosphereDirector } from '../src/render/AtmosphereDirector';

describe('museum-wide premium architectural finish', () => {
  it('shares a real tileable, deterministic mineral texture within a resource scope', () => {
    const a = new ResourceScope('finish-one');
    const b = new ResourceScope('finish-two');
    const texture = architecturalStoneFinish(a);
    expect(architecturalStoneFinish(a)).toBe(texture);
    expect(texture.name).toBe('museum-honed-stone-grain');
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    expect(texture.repeat.x).toBeGreaterThan(1);
    const pixels = texture.image.data as Uint8Array;
    expect(pixels).toHaveLength(128 * 128 * 4);
    expect(new Set(pixels.filter((_, i) => i % 4 === 0)).size).toBeGreaterThan(20);
    expect(Array.from(architecturalStoneFinish(b).image.data as Uint8Array)).toEqual(Array.from(pixels));
    a.dispose();
    b.dispose();
    expect(a.size).toBe(0);
    expect(b.size).toBe(0);
  });

  it('puts the shared finish on architecture in all six wings without losing authored colour', () => {
    const scope = new ResourceScope('gallery-finish');
    const paletteA = new PaletteSet(scope);
    const paletteB = new PaletteSet(scope);
    const north = paletteA.get('north');
    const south = paletteB.get('south');
    const rotunda = paletteA.get('rotunda');
    for (const p of [north, south, rotunda]) {
      const wall = p.wall as THREE.MeshStandardMaterial;
      const floor = p.floor as THREE.MeshStandardMaterial;
      expect(wall.map).toBe(architecturalStoneFinish(scope));
      expect(floor.roughnessMap).toBe(wall.map);
      expect((p.trim as THREE.MeshStandardMaterial).map).toBeNull();
    }
    expect((rotunda.wall as THREE.MeshStandardMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l)
      .toBeGreaterThan((north.wall as THREE.MeshStandardMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('frames all 35 playable exhibit spaces with one tinted instance draw, no lights', () => {
    const scope = new ResourceScope('gallery-reliefs');
    const fields = new ExhibitColorFields(scope).build();
    const relief = fields.getObjectByName('gallery-relief-accents') as THREE.InstancedMesh;
    expect(relief?.isInstancedMesh).toBe(true);
    expect(relief.count).toBe(PLACEMENTS.length * 4);
    const origin = new THREE.Vector3();
    const last = new THREE.Matrix4();
    relief.getMatrixAt(relief.count - 1, last);
    origin.setFromMatrixPosition(last);
    expect(origin.length()).toBeGreaterThan(1);
    expect(relief.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((relief.material as THREE.MeshBasicMaterial).depthWrite).toBe(false);
    expect(fields.children).toHaveLength(PLACEMENTS.length + 1);
    expect(fields.children.filter((child) => child.name.startsWith('exhibit-color-field:'))).toHaveLength(35);
    let lights = 0;
    fields.traverse((item) => { if (item instanceof THREE.Light) lights++; });
    expect(lights).toBe(0);
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});


  it('replaces fluorescent wing floors with darker mineral runners and two clear signal rails', () => {
    const scope = new ResourceScope('gallery-runner-detail');
    const palettes = new PaletteSet(scope);
    const zones = ['rotunda', 'balcony', 'sanctuary', ...WINGS.map((w) => w.id)];
    const parents = new Map(zones.map((zone) => [zone, new THREE.Group()]));
    new Detailing(scope, palettes).applyAll(parents);
    const rotunda = parents.get('rotunda')!;
    for (const face of ['ne', 'se', 'sw']) {
      const seal = rotunda.getObjectByName(`rotunda-archive-seal:${face}`)!;
      expect(seal).toBeTruthy();
      expect(Math.hypot(seal.position.x, seal.position.z)).toBeGreaterThan(15);
    }
    for (const face of ['n', 'e', 's', 'w', 'nw']) {
      expect(rotunda.getObjectByName(`rotunda-archive-seal:${face}`)).toBeUndefined();
    }
    for (const wing of WINGS) {
      const scene = parents.get(wing.id)!
      const runner = scene.getObjectByName(`wing-honed-runner:${wing.id}`) as THREE.Mesh;
      const mat = runner.material as THREE.MeshStandardMaterial;
      expect(mat.map).toBe(architecturalStoneFinish(scope));
      expect(mat.color.getHSL({ h: 0, s: 0, l: 0 }).l)
        .toBeLessThan((palettes.get(wing.id).accent as THREE.MeshStandardMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l);
      const rails = scene.children.filter((node) => node.name.startsWith(`wing-runner-inlay:${wing.id}:`));
      expect(rails).toHaveLength(2);
      expect(rails[0].position.distanceTo(rails[1].position)).toBeGreaterThan(1);
    }
    scope.dispose();
    expect(scope.size).toBe(0);
  });

describe('low-cost geographic atmosphere without changing gameplay', () => {
  it('interpolates fog and exposure at wing transitions rather than popping', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x17304b, 70, 300);
    const output = { toneMappingExposure: 1 };
    const director = new AtmosphereDirector(scene, output);
    const fog = scene.fog as THREE.Fog;
    const original = fog.color.clone();
    director.update('north', 1 / 60, false);
    expect(fog.color.equals(original)).toBe(false);
    expect(fog.color.equals(new THREE.Color(0x081f36))).toBe(false);
    expect(fog.near).toBeLessThan(70);
    for (let i = 0; i < 300; i++) director.update('north', 1 / 60, false);
    expect(fog.color.clone().sub(new THREE.Color(0x081f36)).r).toBeCloseTo(0, 3);
    expect(fog.color.clone().sub(new THREE.Color(0x081f36)).b).toBeCloseTo(0, 3);
    expect(fog.near).toBeCloseTo(60, 1);
    expect(output.toneMappingExposure).toBeGreaterThan(1);
    // Reuse one existing fog instance, not a new one per frame.
    expect(scene.fog).toBe(fog);
  });

  it('snaps visual transitions in reduced motion and preserves neutral Rotunda brightness', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0, 1, 2);
    const output = { toneMappingExposure: 1 };
    const director = new AtmosphereDirector(scene, output);
    director.update('west', 0.08, true);
    expect((scene.fog as THREE.Fog).color.getHex()).toBe(0x302339);
    director.update('rotunda', 0.08, true);
    expect(output.toneMappingExposure).toBeGreaterThanOrEqual(1);
    expect((scene.fog as THREE.Fog).far).toBeGreaterThan(300);
    expect(scene.children).toHaveLength(0);
    director.update('east', Number.NaN, false);
    expect(Number.isFinite((scene.fog as THREE.Fog).near)).toBe(true);
  });
});
