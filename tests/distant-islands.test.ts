import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { CAMERA_FAR } from '../src/render/RendererHost';
import { SKY_DOME_RADIUS } from '../src/world/Sky';
import { ExteriorWorld } from '../src/world/exterior/ExteriorWorld';
import {
  DISTANT_ISLAND_LOD_COUNTS,
  ExteriorDistantIslands,
  SKY_ISLANDS_ANCHOR,
  WILD_ISLAND_ANCHOR,
  sampleWildIslandElevation,
} from '../src/world/exterior/ExteriorDistantIslands';
import { LIGHTHOUSE_PENINSULA_CENTER } from '../src/world/exterior/IslandSiteLayout';

function bearingDegFromNorth(x: number, z: number): number {
  const deg = (Math.atan2(x, -z) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function angularSeparationDeg(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Ray-AABB segment intersection on t in [0, 1]. */
function segmentIntersectsBox(
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): boolean {
  let tMin = 0;
  let tMax = 1;
  for (let axis = 0; axis < 3; axis++) {
    const d = p1[axis] - p0[axis];
    if (Math.abs(d) < 1e-8) {
      if (p0[axis] < min[axis] || p0[axis] > max[axis]) return false;
    } else {
      let t1 = (min[axis] - p0[axis]) / d;
      let t2 = (max[axis] - p0[axis]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

describe('ISLAND-02D distant Floating Sky Islands & Wild Island silhouette', () => {
  it('places both visual-only formations at distinct, non-overlapping bearings within camera far & sky dome', () => {
    const world = new ExteriorWorld('high');
    const skyGroup = world.root.getObjectByName('distant-sky-islands') as THREE.Group;
    const wildGroup = world.root.getObjectByName('distant-wild-island') as THREE.Group;
    expect(skyGroup).toBeTruthy();
    expect(wildGroup).toBeTruthy();
    expect(skyGroup.userData.destinationWorld).toBe('W06');
    expect(wildGroup.userData.destinationWorld).toBe('W10');

    // Distance bands from island center
    const skyDistOrigin = Math.hypot(SKY_ISLANDS_ANCHOR[0], SKY_ISLANDS_ANCHOR[2]);
    const wildDistOrigin = Math.hypot(WILD_ISLAND_ANCHOR[0], WILD_ISLAND_ANCHOR[2]);
    expect(skyDistOrigin).toBeGreaterThanOrEqual(260);
    expect(skyDistOrigin).toBeLessThanOrEqual(380);
    expect(wildDistOrigin).toBeGreaterThanOrEqual(380);
    expect(wildDistOrigin).toBeLessThanOrEqual(520);

    // Non-overlapping bearings around origin and clear separation from SE lighthouse peninsula
    const skyBearing = bearingDegFromNorth(SKY_ISLANDS_ANCHOR[0], SKY_ISLANDS_ANCHOR[2]);
    const wildBearing = bearingDegFromNorth(WILD_ISLAND_ANCHOR[0], WILD_ISLAND_ANCHOR[2]);
    const lighthouseBearing = bearingDegFromNorth(LIGHTHOUSE_PENINSULA_CENTER[0], LIGHTHOUSE_PENINSULA_CENTER[2]);

    expect(angularSeparationDeg(skyBearing, wildBearing)).toBeGreaterThan(90);
    expect(angularSeparationDeg(skyBearing, lighthouseBearing)).toBeGreaterThan(45);
    expect(angularSeparationDeg(wildBearing, lighthouseBearing)).toBeGreaterThan(45);
    expect(Math.hypot(SKY_ISLANDS_ANCHOR[0] - LIGHTHOUSE_PENINSULA_CENTER[0], SKY_ISLANDS_ANCHOR[2] - LIGHTHOUSE_PENINSULA_CENTER[2])).toBeGreaterThan(150);
    expect(Math.hypot(WILD_ISLAND_ANCHOR[0] - LIGHTHOUSE_PENINSULA_CENTER[0], WILD_ISLAND_ANCHOR[2] - LIGHTHOUSE_PENINSULA_CENTER[2])).toBeGreaterThan(150);

    // World bounds fit strictly inside sky dome & camera far from every island viewpoint (including opposite shores)
    world.root.updateMatrixWorld(true);
    const skyBounds = new THREE.Box3().setFromObject(skyGroup);
    const wildBounds = new THREE.Box3().setFromObject(wildGroup);

    expect(skyBounds.min.y).toBeGreaterThanOrEqual(45);
    expect(skyBounds.max.y).toBeLessThanOrEqual(105);
    expect(wildBounds.min.y).toBeLessThan(-1);
    expect(wildBounds.max.y).toBeGreaterThan(42);
    expect(sampleWildIslandElevation(-18.6, -18.4)).toBeGreaterThan(43);

    const viewpoints: readonly (readonly [number, number, number])[] = [
      [0, 1.64, 214],      // South pier end
      [176, 13.14, 152],   // Lighthouse gallery
      [165, 1.64, 55],     // East coastal overlook
      [-155, 1.64, 105],   // Southwest coastal overlook
      [0, 1.64, -180],     // North rear shore (worst-case far distance)
      [0, 20, 30],         // Future museum rooftop height
    ];

    expect(SKY_DOME_RADIUS).toBeLessThan(CAMERA_FAR);
    const corner = new THREE.Vector3();
    for (const [vx, vy, vz] of viewpoints) {
      const vp = new THREE.Vector3(vx, vy, vz);
      for (const box of [skyBounds, wildBounds]) {
        for (const cx of [box.min.x, box.max.x]) {
          for (const cy of [box.min.y, box.max.y]) {
            for (const cz of [box.min.z, box.max.z]) {
              const d = corner.set(cx, cy, cz).distanceTo(vp);
              expect(d).toBeLessThan(SKY_DOME_RADIUS);
              expect(d).toBeLessThan(CAMERA_FAR);
            }
          }
        }
      }
    }

    // Sightlines from pier and lighthouse gallery clear the full museum shell bounding box
    const museumShellMin: readonly [number, number, number] = [-39, 0, -105];
    const museumShellMax: readonly [number, number, number] = [39, 18.5, 128];
    const lowSightOrigins: readonly (readonly [number, number, number])[] = [
      [0, 1.14, 212],
      [170, 13.14, 146],
    ];
    for (const origin of lowSightOrigins) {
      expect(segmentIntersectsBox(origin, SKY_ISLANDS_ANCHOR, museumShellMin, museumShellMax)).toBe(false);
      expect(segmentIntersectsBox(origin, WILD_ISLAND_ANCHOR, museumShellMin, museumShellMax)).toBe(false);
    }

    // Elevated rooftop viewpoints clear the actual roof spine & barrel wing bounds to both distant peaks
    const rooftopOrigins: readonly (readonly [number, number, number])[] = [
      [0, 20, 30],
      [0, 19, 80],
    ];
    const wildVisibleTarget: readonly [number, number, number] = [WILD_ISLAND_ANCHOR[0] - 10, 24, WILD_ISLAND_ANCHOR[2] - 6];
    for (const origin of rooftopOrigins) {
      expect(segmentIntersectsBox(origin, SKY_ISLANDS_ANCHOR, museumShellMin, museumShellMax)).toBe(false);
      expect(segmentIntersectsBox(origin, wildVisibleTarget, museumShellMin, museumShellMax)).toBe(false);
    }

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('rebuilds cleanly across low/medium/high quality tiers with zero GPU resource leaks', () => {
    const scope = new ResourceScope('distant-islands-quality');
    const distant = new ExteriorDistantIslands(scope, 'high');

    const snapshot = () => {
      const skyNodes = distant.root.getObjectByName('distant-sky-islands')!.children.filter((c) => c.name.startsWith('sky-island-node-')).length;
      const canopies = (distant.root.getObjectByName('sky-island-botanical-canopies') as THREE.InstancedMesh).count;
      const rocklets = (distant.root.getObjectByName('sky-island-floating-rocklets') as THREE.InstancedMesh | undefined)?.count ?? 0;
      const pines = (distant.root.getObjectByName('wild-island-pine-ridges') as THREE.InstancedMesh).count;
      const mistLayers = distant.root.getObjectByName('distant-wild-island')!.children.filter((c) => c.name.startsWith('wild-island-mist-band-')).length;
      return { skyNodes, canopies, rocklets, pines, mistLayers };
    };

    expect(snapshot()).toEqual({
      skyNodes: DISTANT_ISLAND_LOD_COUNTS.high.skyIslandCount,
      canopies: DISTANT_ISLAND_LOD_COUNTS.high.skyCanopies,
      rocklets: DISTANT_ISLAND_LOD_COUNTS.high.skyRocklets,
      pines: DISTANT_ISLAND_LOD_COUNTS.high.wildPines,
      mistLayers: DISTANT_ISLAND_LOD_COUNTS.high.wildMistLayers,
    });

    // Attach dispose listeners to verify old GPU objects are actually disposed on tier change
    let disposedGeometries = 0;
    let disposedMaterials = 0;
    const seenGeos = new Set<THREE.BufferGeometry>();
    const seenMats = new Set<THREE.Material>();
    distant.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !seenGeos.has(mesh.geometry)) {
        seenGeos.add(mesh.geometry);
        mesh.geometry.addEventListener('dispose', () => disposedGeometries++);
      }
      const raw = mesh.material;
      for (const m of Array.isArray(raw) ? raw : raw ? [raw] : []) {
        if (!seenMats.has(m)) {
          seenMats.add(m);
          m.addEventListener('dispose', () => disposedMaterials++);
        }
      }
    });

    // Single child ResourceScope keeps parent scope count constant across rebuilds
    const baselineParentScopeSize = scope.size;
    expect(baselineParentScopeSize).toBe(1);

    distant.setQuality('low');
    expect(disposedGeometries).toBe(seenGeos.size);
    expect(disposedMaterials).toBe(seenMats.size);
    expect(scope.size).toBe(baselineParentScopeSize);
    expect(snapshot()).toEqual({
      skyNodes: DISTANT_ISLAND_LOD_COUNTS.low.skyIslandCount,
      canopies: DISTANT_ISLAND_LOD_COUNTS.low.skyCanopies,
      rocklets: DISTANT_ISLAND_LOD_COUNTS.low.skyRocklets,
      pines: DISTANT_ISLAND_LOD_COUNTS.low.wildPines,
      mistLayers: DISTANT_ISLAND_LOD_COUNTS.low.wildMistLayers,
    });

    distant.setQuality('medium');
    expect(snapshot()).toEqual({
      skyNodes: DISTANT_ISLAND_LOD_COUNTS.medium.skyIslandCount,
      canopies: DISTANT_ISLAND_LOD_COUNTS.medium.skyCanopies,
      rocklets: DISTANT_ISLAND_LOD_COUNTS.medium.skyRocklets,
      pines: DISTANT_ISLAND_LOD_COUNTS.medium.wildPines,
      mistLayers: DISTANT_ISLAND_LOD_COUNTS.medium.wildMistLayers,
    });

    // Repeated cycling never accumulates tracked resources
    for (const tier of ['high', 'low', 'medium', 'high'] as const) {
      distant.setQuality(tier);
      expect(scope.size).toBe(baselineParentScopeSize);
    }

    scope.dispose();
    expect(scope.size).toBe(0);
  });

  it('adds zero THREE.Light objects, zero off-island CollisionWorld colliders, and disables close-island fog clipping', () => {
    const world = new ExteriorWorld('medium');

    let lights = 0;
    world.root.traverse((obj) => {
      if ((obj as THREE.Light).isLight) lights++;
    });
    expect(lights).toBe(0);

    // Every material inside distantIslands sets fog: false so 70..300 m linear fog does not swallow silhouettes
    world.distantIslands.root.traverse((obj) => {
      const mat = (obj as THREE.Mesh).material;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
        expect((m as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial).fog).toBe(false);
      }
    });

    // Zero off-island support colliders under Sky Islands, Wild Island, or open sea gap
    const probes: readonly (readonly [number, number, number])[] = [
      SKY_ISLANDS_ANCHOR,
      [SKY_ISLANDS_ANCHOR[0] + 30, 81, SKY_ISLANDS_ANCHOR[2] + 16],
      WILD_ISLAND_ANCHOR,
      [WILD_ISLAND_ANCHOR[0] + 20, 10, WILD_ISLAND_ANCHOR[2] - 20],
      [220, 0, -60], // open offshore east (outside ISLAND_OUTLINE)
      [-210, 0, 250], // open offshore southwest between main island and wild island
    ];
    for (const [x, y, z] of probes) {
      expect(world.collision.supportHeight(x, z, y)).toBeNull();
      expect(world.collision.supportHeight(x, z, -0.5)).toBeNull();
    }

    world.dispose();
    expect(world.scope.size).toBe(0);
  });

  it('animates gentle sky drift when reducedMotion=false and snaps/freezes cleanly when reducedMotion=true', () => {
    const scope = new ResourceScope('distant-islands-motion');
    const distant = new ExteriorDistantIslands(scope, 'medium');

    const node0 = distant.root.getObjectByName('sky-island-node-0')!;
    const mist0 = distant.root.getObjectByName('wild-island-mist-band-0')!;
    const canopies = distant.root.getObjectByName('sky-island-botanical-canopies') as THREE.InstancedMesh;
    const restY = node0.position.y;
    const restMistRot = mist0.rotation.y;
    const restMatrices = Float32Array.from(canopies.instanceMatrix.array);

    distant.update(0.8, false);
    // Drifted away from rest pose (use multiple steps for clear delta)
    for (let i = 0; i < 20; i++) distant.update(0.1, false);
    expect(node0.position.y).not.toBe(restY);
    expect(mist0.rotation.y).not.toBe(restMistRot);
    expect(Array.from(canopies.instanceMatrix.array)).not.toEqual(Array.from(restMatrices));

    // reducedMotion=true snaps to rest and remains frozen
    distant.update(0.1, true);
    expect(node0.position.y).toBe(restY);
    expect(mist0.rotation.y).toBe(restMistRot);
    expect(Array.from(canopies.instanceMatrix.array)).toEqual(Array.from(restMatrices));

    distant.update(1.0, true);
    expect(node0.position.y).toBe(restY);
    expect(mist0.rotation.y).toBe(restMistRot);

    scope.dispose();
    expect(scope.size).toBe(0);
  });
});
