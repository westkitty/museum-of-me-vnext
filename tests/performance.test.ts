import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Museum } from '../src/world/Museum';
import { Lighting } from '../src/render/Lighting';
import { ResourceScope } from '../src/assets/ResourceScope';
import { QUALITY } from '../src/render/QualityTiers';
import { mergeStatic, NO_MERGE } from '../src/world/MergeStatic';
import { SPAWN_POSITION, PLACEMENT_BY_EXHIBIT } from '../src/world/layout';
import { INTERACTION_ONLY_LAYER, InteractionManager } from '../src/interaction/InteractionManager';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { SourceVisitors } from '../src/world/SourceVisitors';
import { SourceInstallations } from '../src/world/SourceInstallations';
import { Journal } from '../src/state/Journal';
import { NIGHT_MOON_DIRECTION } from '../src/world/Sky';

/**
 * Runtime cost gates. Profiling in a browser put the entrance at 986 draw calls
 * and 31 simultaneous point lights, which are the two numbers that actually
 * determine whether this building runs. These tests hold both down.
 */

describe('static geometry merging', () => {
  it('collapses the architecture into far fewer meshes', () => {
    const scope = new ResourceScope('t');
    const museum = new Museum(scope);
    const built = museum.build();
    const { before, after, merged } = built.merge;

    expect(merged, 'nothing was merged').toBeGreaterThan(200);
    expect(after, `merge left ${after} meshes from ${before}`).toBeLessThan(before / 3);
    scope.dispose();
  });

  it('never merges an exhibit mount or anything marked no-merge', () => {
    const scope = new ResourceScope('t');
    const museum = new Museum(scope);
    const built = museum.build();

    // Every exhibit mount must survive as its own group.
    expect(built.exhibitMounts.size).toBe(35);
    for (const [id, mount] of built.exhibitMounts) {
      expect(mount.parent, `${id} mount was removed`).not.toBeNull();
      expect(mount.name).toBe(`exhibit:${id}`);
    }
    scope.dispose();
  });

  it('respects the no-merge flag', () => {
    const scope = new ResourceScope('t');
    const root = new THREE.Group();
    const material = scope.track(new THREE.MeshStandardMaterial());
    const keep = new THREE.Mesh(scope.track(new THREE.BoxGeometry()), material);
    keep.userData[NO_MERGE] = true;
    keep.name = 'keep-me';
    root.add(keep);
    for (let i = 0; i < 5; i++) {
      root.add(new THREE.Mesh(scope.track(new THREE.BoxGeometry()), material));
    }
    mergeStatic(root, scope);
    expect(root.getObjectByName('keep-me'), 'a no-merge mesh was merged away').toBeTruthy();
    scope.dispose();
  });

  it('leaves collision untouched', () => {
    const scope = new ResourceScope('t');
    const museum = new Museum(scope);
    const built = museum.build();
    // Collision is recorded during construction, before any merge, so the
    // building's walls cannot move as a result of a rendering optimisation.
    expect(built.collision.size).toBeGreaterThan(900);
    const support = built.collision.supportHeight(SPAWN_POSITION[0], SPAWN_POSITION[2], 2, 3);
    expect(support).not.toBeNull();
    scope.dispose();
  });
});

describe('interaction hot path', () => {
  it('samples focus at 30 Hz instead of raycasting every rendered frame', () => {
    const interaction = new InteractionManager();
    const target = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    target.position.set(0, 0, -2);
    target.geometry.computeBoundingSphere();
    target.updateMatrixWorld(true);
    interaction.register('test', {
      object: target,
      label: 'Test target',
      activate: () => {},
    });

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 10);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    interaction.update(camera, 1 / 30);
    expect(interaction.currentFocus?.exhibitId).toBe('test');

    camera.rotation.y = Math.PI;
    camera.updateMatrixWorld(true);
    interaction.update(camera, 1 / 120);
    expect(interaction.currentFocus?.exhibitId).toBe('test');

    interaction.update(camera, 1 / 120);
    interaction.update(camera, 1 / 120);
    interaction.update(camera, 1 / 120);
    expect(interaction.currentFocus).toBeNull();
    interaction.dispose();
    target.geometry.dispose();
    (target.material as THREE.Material).dispose();
  });

  it('raycasts interaction-only proxies that the camera cannot render', () => {
    const interaction = new InteractionManager();
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    target.layers.set(INTERACTION_ONLY_LAYER);
    target.position.set(0, 0, -2);
    target.geometry.computeBoundingSphere();
    target.updateMatrixWorld(true);
    interaction.register('proxy', {
      object: target,
      label: 'Proxy target',
      activate: () => {},
    });

    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 10);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    expect(camera.layers.test(target.layers)).toBe(false);
    interaction.update(camera, 1 / 30);
    expect(interaction.currentFocus?.exhibitId).toBe('proxy');

    interaction.dispose();
    target.geometry.dispose();
    (target.material as THREE.Material).dispose();
  });
});

describe('visitor simulation budget', () => {
  it('renders the 17 authored visitor bodies through one camera-visible batch', () => {
    const scope = new ResourceScope('source-visitors-batch');
    const world = new CollisionWorld();
    world.addFloor(-500, 500, -500, 500, 0);
    const interaction = new InteractionManager();
    const visitors = new SourceVisitors(scope, world, interaction, () => {});
    const camera = new THREE.PerspectiveCamera();
    let cameraVisibleMeshes = 0;
    visitors.group.traverse((node) => {
      if ((node as THREE.Mesh).isMesh && camera.layers.test(node.layers)) cameraVisibleMeshes += 1;
    });

    expect(visitors.batch.isBatchedMesh).toBe(true);
    expect(visitors.batch.instanceCount).toBe(327);
    expect(cameraVisibleMeshes).toBe(1);
    expect(visitors.snapshot()).toHaveLength(17);
    expect(visitors.snapshot().every((visitor) => visitor.meshCount >= 20 || visitor.seated)).toBe(true);
    // One batch + one batch material + one shared hit geometry/material.
    expect(scope.size).toBeLessThanOrEqual(4);

    visitors.dispose();
    interaction.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('coarse-steps distant authored visitors instead of simulating them every fixed step', () => {
    const scope = new ResourceScope('source-visitors-performance');
    const world = new CollisionWorld();
    world.addFloor(-500, 500, -500, 500, 0);
    const interaction = new InteractionManager();
    const visitors = new SourceVisitors(scope, world, interaction, () => {});
    const before = visitors.positions().map((v) => [v.x, v.z] as const);

    for (let i = 0; i < 5; i++) visitors.update(1 / 60, false, 10_000, 10_000);
    expect(visitors.positions().map((v) => [v.x, v.z] as const)).toEqual(before);

    visitors.update(1 / 60, false, 10_000, 10_000);
    const after = visitors.positions().map((v) => [v.x, v.z] as const);
    expect(after.some((p, i) => Math.hypot(p[0] - before[i][0], p[1] - before[i][1]) > 1e-5)).toBe(true);
    visitors.dispose();
    interaction.dispose();
    scope.dispose();
  });
});

describe('source installation visibility budget', () => {
  it('renders only the current zone and its declared neighbours', () => {
    const scope = new ResourceScope('source-installation-visibility');
    const world = new CollisionWorld();
    world.addFloor(-500, 500, -500, 500, 0);
    const interaction = new InteractionManager();
    const installations = new SourceInstallations(
      scope,
      world,
      interaction,
      new Journal(null),
      () => {},
    );
    const total = installations.count;
    expect(total).toBeGreaterThan(10);

    installations.update(0, false, [0, 1.6, 130], 'plaza');
    const plazaVisible = installations.visibleCount;
    expect(plazaVisible).toBeGreaterThan(0);
    expect(plazaVisible).toBeLessThan(total);

    const hiddenId = installations.ids().find((id) => !installations.get(id)?.group.visible);
    expect(hiddenId).toBeTruthy();
    expect(installations.engage(hiddenId!)).toBe(true);
    expect(installations.get(hiddenId!)?.group.visible).toBe(true);
    installations.disengage();
    expect(installations.get(hiddenId!)?.group.visible).toBe(false);

    installations.update(0, false, [0, 1.6, 0], 'rotunda');
    expect(installations.visibleCount).toBeGreaterThan(plazaVisible);

    const camera = new THREE.PerspectiveCamera();
    let cameraVisibleHitMeshes = 0;
    installations.group.traverse((node) => {
      if (
        (node as THREE.Mesh).isMesh
        && node.name.startsWith('installation-hit:')
        && camera.layers.test(node.layers)
      ) cameraVisibleHitMeshes += 1;
    });
    expect(cameraVisibleHitMeshes).toBe(0);

    installations.dispose();
    interaction.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});

describe('light budget', () => {
  it('caps simultaneous point lights regardless of where the visitor stands', () => {
    const scope = new ResourceScope('t');
    const lighting = new Lighting(scope, QUALITY.high);

    const spots: [number, number, number][] = [
      [0, 1.6, 150],
      [0, 1.6, 80],
      [0, 1.6, 0],
      [0, 1.6, -40],
      [0, 11.6, 12],
      [-42, -3.4, -42],
    ];
    for (const spot of spots) {
      lighting.update(spot);
      expect(
        lighting.activePointLights,
        `too many lights at ${spot.join(',')}`,
      ).toBeLessThanOrEqual(8);
    }
    lighting.dispose();
    scope.dispose();
  });

  it('lights the room the visitor is actually in', () => {
    const scope = new ResourceScope('t');
    const lighting = new Lighting(scope, QUALITY.high);
    // A bay is dark until streaming says its exhibit is resident.
    const placement = PLACEMENT_BY_EXHIBIT.get('E01')!;
    const eye: [number, number, number] = [placement.anchor[0], placement.anchor[1] + 1.6, placement.anchor[2]];

    lighting.update(eye);
    const dark = lighting.bayLights.get('E01')!.visible;
    expect(dark, 'a bay lit itself before its exhibit streamed in').toBe(false);

    lighting.setBayLight('E01', true);
    lighting.update(eye);
    expect(lighting.bayLights.get('E01')!.visible, 'the bay stayed dark with its exhibit resident').toBe(true);
    lighting.dispose();
    scope.dispose();
  });

  it('freezes static light transforms after construction', () => {
    const scope = new ResourceScope('static-light-transforms');
    const lighting = new Lighting(scope, QUALITY.high);
    let localAutoUpdates = 0;
    let worldAutoUpdates = 0;
    lighting.group.traverse((node) => {
      if (node.matrixAutoUpdate) localAutoUpdates++;
      if (node.matrixWorldAutoUpdate) worldAutoUpdates++;
    });
    expect(localAutoUpdates).toBe(0);
    expect(worldAutoUpdates).toBe(0);
    lighting.dispose();
    scope.dispose();
  });

  it('keeps only one shadow-casting light, and none on the low tier', () => {
    for (const tier of [QUALITY.low, QUALITY.medium, QUALITY.high]) {
      const scope = new ResourceScope('t');
      const lighting = new Lighting(scope, tier);
      let casters = 0;
      lighting.group.traverse((n) => {
        if ((n as THREE.Light).isLight && (n as THREE.Light).castShadow) casters++;
      });
      expect(casters, `${tier.tier} shadow casters`).toBeLessThanOrEqual(tier.shadows ? 1 : 0);
      if (tier.shadows) {
        const caster = lighting.group.children.find((node) => (node as THREE.Light).castShadow) as THREE.DirectionalLight;
        expect(caster.shadow.normalBias).toBeGreaterThan(0);
        expect(caster.shadow.radius).toBeGreaterThan(1);
        expect(caster.position.clone().normalize().distanceTo(NIGHT_MOON_DIRECTION)).toBeLessThan(1e-7);
      }
      lighting.dispose();
      scope.dispose();
    }
  });
});
