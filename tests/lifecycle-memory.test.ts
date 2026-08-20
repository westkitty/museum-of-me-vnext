import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { installExhibits } from '../src/exhibits';
import { StreamingManager } from '../src/exhibits/StreamingManager';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { AssetManager } from '../src/assets/AssetManager';
import { buildMuseum } from './helpers/walk';
import { canonicalRoute } from '../src/world/route';
import { zoneAt, type Vec3 } from '../src/world/layout';
import type { ResourceScope } from '../src/assets/ResourceScope';
import { EYE_HEIGHT } from '../src/player/PlayerController';

installExhibits();

/**
 * THE PHASE 12 GATE.
 *
 * Plan §"Mandatory traversal": entrance → north → east → south → west → upper
 * level → Sanctuary → entrance, repeated. Memory must settle rather than climb
 * monotonically.
 *
 * This walks the real canonical route through the real StreamingManager and
 * measures the exhibits' own tracked resource counts, which is the number that
 * actually corresponds to GPU allocations.
 */

const assets = new AssetManager();

function makeStreaming(mounts: ReadonlyMap<string, THREE.Group>) {
  const interaction = new InteractionManager();
  const streaming = new StreamingManager(
    mounts,
    {
      addControl: (id, c) => interaction.register(id, c),
      announce: () => {},
      reducedMotion: () => false,
      detailScale: () => 1,
      loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
        (await assets.load(assetId, scope, { detail })).object,
    },
    { loadRadius: 34, unloadRadius: 48, activateRadius: 22, mountsPerFrame: 3 },
  );
  streaming.initialise();
  return { streaming, interaction };
}

/** Walk the route, letting streaming settle at each waypoint. */
async function walkRouteOnce(
  streaming: StreamingManager,
  route: readonly { at: Vec3 }[],
  samples: number[],
): Promise<void> {
  for (const waypoint of route) {
    const eye: Vec3 = [waypoint.at[0], waypoint.at[1] + EYE_HEIGHT, waypoint.at[2]];
    const zone = zoneAt([eye[0], waypoint.at[1] + 0.1, eye[2]]);
    for (let frame = 0; frame < 6; frame++) {
      streaming.evaluate(eye, 1 / 60, zone);
      streaming.updateActive(1 / 60, eye);
      // Let preload promises resolve between frames, as they would in a browser.
      await Promise.resolve();
      await Promise.resolve();
    }
    samples.push(streaming.totalResourceCount());
  }
}

describe('performance and lifecycle (Phase 12 gate)', () => {
  it('settles rather than climbing across four full traversals', async () => {
    const built = buildMuseum();
    const { streaming } = makeStreaming(built.mounts);
    const route = canonicalRoute();

    const peaks: number[] = [];
    const ends: number[] = [];

    for (let lap = 0; lap < 4; lap++) {
      const samples: number[] = [];
      await walkRouteOnce(streaming, route, samples);
      peaks.push(Math.max(...samples));
      ends.push(samples[samples.length - 1]);
    }

    // The peak must not creep upward lap after lap.
    const firstPeak = peaks[0];
    for (let i = 1; i < peaks.length; i++) {
      expect(
        peaks[i],
        `lap ${i + 1} peaked at ${peaks[i]} against lap 1's ${firstPeak} — memory is climbing:\n${peaks.join(', ')}`,
      ).toBeLessThanOrEqual(firstPeak * 1.05);
    }

    // And the resting level at the end of each lap must be stable.
    for (let i = 1; i < ends.length; i++) {
      expect(ends[i], `end of lap ${i + 1}`).toBeLessThanOrEqual(ends[0] * 1.05 + 5);
    }

    streaming.dispose();
    expect(streaming.totalResourceCount(), 'disposal left resources behind').toBe(0);
  }, 120_000);

  it('never holds the whole museum resident at once', async () => {
    const built = buildMuseum();
    const { streaming } = makeStreaming(built.mounts);
    const route = canonicalRoute();
    const samples: number[] = [];
    await walkRouteOnce(streaming, route, samples);

    // Residency is bounded by proximity and zone, so at no point should all 35
    // exhibits be built at once — that is the whole point of Layer 3.
    let maxResident = 0;
    for (const host of streaming.hosts.values()) void host;
    // Re-walk, sampling residency directly.
    for (const waypoint of route) {
      const eye: Vec3 = [waypoint.at[0], waypoint.at[1] + EYE_HEIGHT, waypoint.at[2]];
      const zone = zoneAt([eye[0], waypoint.at[1] + 0.1, eye[2]]);
      for (let f = 0; f < 4; f++) {
        streaming.evaluate(eye, 1 / 60, zone);
        await Promise.resolve();
        await Promise.resolve();
      }
      maxResident = Math.max(maxResident, streaming.telemetry.resident);
    }
    expect(maxResident, 'streaming kept every exhibit resident').toBeLessThan(35);
    expect(maxResident, 'streaming loaded nothing at all').toBeGreaterThan(0);
    streaming.dispose();
  }, 120_000);

  it('unmounts as many exhibits as it mounts over a round trip', async () => {
    const built = buildMuseum();
    const { streaming } = makeStreaming(built.mounts);
    const route = canonicalRoute();
    const samples: number[] = [];
    await walkRouteOnce(streaming, route, samples);

    const { totalMounts, totalUnmounts } = streaming.telemetry;
    expect(totalMounts, 'nothing streamed in').toBeGreaterThan(10);
    // Anything still resident at the end is legitimately near the entrance.
    const stillResident = streaming.telemetry.resident;
    expect(
      totalMounts - totalUnmounts,
      `mounted ${totalMounts}, unmounted ${totalUnmounts}, ${stillResident} still resident`,
    ).toBeLessThanOrEqual(stillResident + 2);
    streaming.dispose();
  }, 120_000);

  it('keeps museum geometry within a sane budget', () => {
    const built = buildMuseum();
    let meshes = 0;
    let triangles = 0;
    built.root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      meshes++;
      const position = mesh.geometry?.getAttribute?.('position');
      if (position) triangles += position.count / 3;
    });
    // The always-resident shell. Exhibits stream on top of this.
    expect(meshes, `shell mesh count ${meshes}`).toBeLessThan(4000);
    expect(triangles, `shell triangle count ${Math.round(triangles)}`).toBeLessThan(600_000);
    expect(built.collision.size, 'collision broadphase').toBeLessThan(6000);
  });

  it('disposes the whole museum without leaking', () => {
    const built = buildMuseum();
    const before = built.scope.size;
    expect(before).toBeGreaterThan(100);
    built.scope.dispose();
    expect(built.scope.size).toBe(0);
  });
});
