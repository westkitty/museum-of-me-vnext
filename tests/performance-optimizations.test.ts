import { describe, expect, it, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { AdaptiveResolution } from '../src/render/AdaptiveResolution';
import { Diagnostics } from '../src/app/Diagnostics';
import { Loop } from '../src/app/Loop';
import { mergeStatic } from '../src/world/MergeStatic';
import { Museum } from '../src/world/Museum';
import { ResourceScope } from '../src/assets/ResourceScope';
import { PersistentEnvironment } from '../src/world/PersistentEnvironment';
import { StreamingManager } from '../src/exhibits/StreamingManager';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { SourceArtwork } from '../src/world/SourceArtwork';
import { Filament } from '../src/exhibits/parts';

afterEach(() => vi.unstubAllGlobals());

describe('performance optimization contract', () => {
  it('captures frame-time distributions including a >100ms stall', () => {
    const d = new Diagnostics();
    for (let i = 0; i < 99; i++) d.recordFrame(16.5, 3, 1, 2, 1);
    d.recordFrame(160, 1, 1, 2, 5);
    expect(d.frameCount).toBe(100);
    expect(d.frameTimeP99).toBe(16.5);
    expect(d.stats.frameTimeMs).toBe(160);
    expect(d.frameTimePercentile(1)).toBe(160);
    expect(d.performanceSummary.lastFixedSteps).toBe(5);
  });

  it('uses actual displayed-frame duration when a 30Hz render cap is selected', () => {
    let now = 0;
    let queued: ((time: number) => void) | null = null;
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => {
      queued = fn; return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => { queued = null; });
    const presented: number[] = [];
    const loop = new Loop({
      fixedUpdate: () => {}, variableUpdate: () => {}, render: () => {},
      afterFrame: (wallMs) => presented.push(wallMs),
    });
    loop.setFrameCap(30);
    loop.start();
    for (let i = 0; i < 12; i++) {
      now += 1000 / 60;
      const next = queued as ((time: number) => void) | null;
      queued = null;
      next?.(now);
    }
    loop.stop();
    expect(presented.length).toBeGreaterThanOrEqual(4);
    expect(presented.slice(1).every((duration) => duration >= 1000 / 30 - 0.1)).toBe(true);
  });

  it('allows resolution changes only after a stable window without high CPU time', () => {
    const policy = new AdaptiveResolution();
    for (let i = 0; i < 180; i++) policy.update(26, 2);
    expect(policy.currentScale).toBeLessThan(1);
    policy.reset();
    for (let i = 0; i < 180; i++) policy.update(26, 25);
    expect(policy.currentScale).toBe(1);
  });

  it('retains cullable material batches instead of merging geometry across distant cells', () => {
    const scope = new ResourceScope('spatial');
    const root = new THREE.Group();
    const zoneA = new THREE.Group();
    const zoneB = new THREE.Group();
    root.add(zoneA, zoneB);
    const material = scope.track(new THREE.MeshBasicMaterial());
    for (const [parent, positions] of [[zoneA, [0, 4]], [zoneB, [210, 214]]] as const) {
      for (const x of positions) {
        const mesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1, 1, 1)), material);
        mesh.position.x = x;
        parent.add(mesh);
      }
    }
    const report = mergeStatic(root, scope, { preserveTopLevel: true, cellSize: 72 });
    expect(report.merged).toBe(4);
    expect(zoneA.children).toHaveLength(1);
    expect(zoneB.children).toHaveLength(1);
    const one = zoneA.children[0] as THREE.Mesh;
    const two = zoneB.children[0] as THREE.Mesh;
    expect(one.userData.spatialBatch).toBe(true);
    expect(one.geometry.boundingSphere!.radius).toBeLessThan(10);
    expect(two.geometry.boundingSphere!.radius).toBeLessThan(10);
    expect(one.geometry.boundingSphere!.center.distanceTo(two.geometry.boundingSphere!.center))
      .toBeGreaterThan(190);
    scope.dispose();
  });

  it('culls only deep unrelated wing geometry, restoring complete Rotunda sightlines', () => {
    const scope = new ResourceScope('visibility');
    const museum = new Museum(scope);
    museum.build();
    expect(museum.updateVisibility('north', 0, -66)).toBe(true);
    expect(museum.zoneGroups.get('north')?.visible).toBe(true);
    expect(museum.zoneGroups.get('south')?.visible).toBe(true); // opposite view through Rotunda
    expect(museum.zoneGroups.get('east')?.visible).toBe(false);
    expect(museum.zoneGroups.get('west')?.visible).toBe(false);
    expect(museum.zoneGroups.get('rotunda')?.visible).toBe(true);
    expect(museum.updateVisibility('north', 0, -30)).toBe(false);
    expect(museum.zoneGroups.get('east')?.visible).toBe(true);
    expect(museum.updateVisibility('rotunda', 0, 0)).toBe(false);
    expect(museum.zoneGroups.get('south')?.visible).toBe(true);
    expect(museum.updateVisibility('rotunda', 0, 0, true, 0, 75)).toBe(true);
    expect(museum.zoneGroups.get('north')?.visible).toBe(true);
    expect(museum.zoneGroups.get('south')?.visible).toBe(false);
    expect(museum.zoneGroups.get('east')?.visible).toBe(false);
    expect(museum.zoneGroups.get('media')?.visible).toBe(true);
    expect(museum.zoneGroups.get('infra')?.visible).toBe(true);
    expect(museum.updateVisibility('rotunda', 0, 0, true, Math.PI / 2, 75)).toBe(true);
    expect(museum.zoneGroups.get('east')?.visible).toBe(true);
    expect(museum.updateVisibility('north', 0, -66, false)).toBe(false);
    expect(museum.zoneGroups.get('south')?.visible).toBe(true);
    scope.dispose();
  });

  it('keeps gallery accent batching but reduces distant visible instances', () => {
    const scope = new ResourceScope('relief');
    const env = new PersistentEnvironment(scope);
    const root = env.build();
    const relief = root.getObjectByName('gallery-relief-accents') as THREE.InstancedMesh;
    expect(relief.count).toBe(140);
    env.updateVisibility('north', true);
    expect(relief.count).toBeGreaterThan(0);
    expect(relief.count).toBeLessThan(140);
    env.updateVisibility('rotunda', false);
    expect(relief.count).toBe(140);
    scope.dispose();
  });

  it('submits one instanced filament draw while preserving the full curved path', () => {
    const scope = new ResourceScope('filament');
    const material = scope.track(new THREE.MeshStandardMaterial());
    const filament = new Filament(scope, 32, 0.025, material);
    filament.follow(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 0),
      new THREE.Vector3(3, 2, 1),
      new THREE.Vector3(4, 2, 3),
    ]));
    expect(filament.group.children).toHaveLength(1);
    expect(filament.instances.isInstancedMesh).toBe(true);
    expect(filament.instances.count).toBe(32);
    const start = new THREE.Matrix4();
    const end = new THREE.Matrix4();
    filament.instances.getMatrixAt(0, start);
    filament.instances.getMatrixAt(31, end);
    expect(start.elements[12]).not.toBe(end.elements[12]);
    expect(filament.instances.boundingSphere?.radius).toBeGreaterThan(1);
    filament.setVisible(false);
    expect(filament.group.visible).toBe(false);
    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('reconfigures streaming radii without losing existing hosts', () => {
    const config = {
      loadRadius: 50, unloadRadius: 65, activateRadius: 30, mountsPerFrame: 1,
    };
    const stream = new StreamingManager(new Map(), {
      addControl: () => () => {}, announce: () => {}, reducedMotion: () => false,
      detailScale: () => 1, loadAsset: async () => new THREE.Group(),
    }, config);
    stream.setRadii(40, 55, 25);
    expect(stream.budget.loadRadius).toBe(40);
    expect(stream.budget.activateRadius).toBe(25);
    expect(() => stream.setRadii(60, 40, 25)).toThrow(RangeError);
    stream.dispose();
  });

  it('uses stable collision query scratch without changing support or wall resolution', () => {
    const collision = new CollisionWorld();
    collision.addFloor(-5, 5, -5, 5, 0);
    collision.addBox([1, 1, 0], [0.4, 1, 0.4]);
    for (let i = 0; i < 150; i++) {
      expect(collision.supportHeight(0, 0, 0)).toBe(0);
      const pos = { x: 0.8, y: 0, z: 0 };
      collision.resolveHorizontal(pos, 0.4, 1.6);
      expect(pos.x).toBeLessThanOrEqual(0.21);
    }
  });

  it('preserves source artwork shapes and full resource cleanup while rasters stream lazily', () => {
    const scope = new ResourceScope('artwork');
    const mounts = new Map<string, THREE.Group>();
    const artwork = new SourceArtwork(scope, mounts);
    expect(artwork.residentCount).toBe(0);
    artwork.update(0, 0, 1);
    artwork.dispose();
    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
