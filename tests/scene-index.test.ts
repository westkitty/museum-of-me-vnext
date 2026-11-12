import { describe, expect, it } from 'vitest';
import { PLACEMENTS, STAIRS, WINGS, ZONES } from '../src/world/layout';
import { INSTALLATION_PLACEMENTS } from '../src/world/installationPlacement';
import { canonicalRoute } from '../src/world/route';
import { buildMuseumSceneIndex } from '../src/workshop/SceneIndex';
import type { WorkshopPlacementManifest } from '../src/workshop/schema';
import { CollisionWorld } from '../src/world/CollisionWorld';

const manifest: WorkshopPlacementManifest = { schemaVersion: 1, objects: [{
  id: 'outside-object', label: 'Outside', prefab: 'sculpture-sphere', anchor: 'free',
  position: [260, 0, 260], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior', collision: 'solid',
}] };

describe('museum scene index', () => {
  it('derives stable spatial records from the authoritative sources', () => {
    const snapshot = buildMuseumSceneIndex(manifest);
    expect(snapshot.wings).toHaveLength(6);
    expect(snapshot.exhibits).toHaveLength(35);
    expect(snapshot.stairs).toHaveLength(2);
    expect(snapshot.zones).toHaveLength(ZONES.length);
    expect(snapshot.installations).toHaveLength(INSTALLATION_PLACEMENTS.length);
    expect(snapshot.route).toHaveLength(canonicalRoute().length);
    expect(snapshot.wings.map((wing) => wing.id)).toEqual(WINGS.map((wing) => wing.id));
    expect(snapshot.exhibits.map((exhibit) => exhibit.id)).toEqual(PLACEMENTS.map((exhibit) => exhibit.exhibitId));
    expect(snapshot.exhibits.find((exhibit) => exhibit.id === 'E03')?.visitorSpot)
      .toEqual(PLACEMENTS.find((exhibit) => exhibit.exhibitId === 'E03')?.visitorSpot);
    expect(snapshot.stairs.map((stair) => stair.id)).toEqual(STAIRS.map((stair) => stair.id));
    expect(snapshot.authored[0]).toMatchObject({ id: 'outside-object', world: 'exterior', collision: 'solid' });
    expect(new Set(snapshot.route.map((item) => item.id)).size).toBe(snapshot.route.length);
    expect(snapshot.unavailable).toContain('exterior collision world');
    expect(JSON.stringify(buildMuseumSceneIndex(manifest))).toBe(JSON.stringify(snapshot));
    const original = PLACEMENTS[0].anchor[0];
    (snapshot.exhibits[0].anchor as unknown as number[])[0] = 12345;
    expect(PLACEMENTS[0].anchor[0]).toBe(original);
    expect(buildMuseumSceneIndex(manifest).exhibits[0].anchor[0]).toBe(original);
  });

  it('snapshots live static and authored colliders without exposing mutable runtime data', () => {
    const exterior = new CollisionWorld();
    exterior.addBox([0, 1, 0], [1, 1, 1]);
    exterior.addMaskedFloor(-5, 5, -5, 5, 0, (x) => x >= 0);
    exterior.setDynamicWall('my-wall', { kind: 'wall', minX: 10, maxX: 12, minY: 0, maxY: 2,
      minZ: 10, maxZ: 12, oriented: { centerX: 11, centerZ: 11, halfX: 1, halfZ: 1, yaw: 0.2 } });
    const snapshot = buildMuseumSceneIndex(manifest, { exterior });
    expect(snapshot.collisions.exterior).toHaveLength(3);
    expect(snapshot.collisions.interior).toBeNull();
    expect(snapshot.unavailable).toContain('interior collision world');
    expect(snapshot.collisions.exterior?.[1]).toMatchObject({ kind: 'floor', hasMask: true, ownership: 'static' });
    expect(snapshot.collisions.exterior?.[2]).toMatchObject({ id: 'wall:my-wall', ownership: 'dynamic',
      oriented: { yaw: 0.2 } });
    const wall = snapshot.collisions.exterior?.[2];
    if (wall?.kind !== 'wall' || !wall.oriented) throw new Error('Expected oriented wall');
    (wall.oriented as { yaw: number }).yaw = 2;
    expect(exterior.snapshot()[2]).toMatchObject({ oriented: { yaw: 0.2 } });
    expect(exterior.supportHeight(-1, 0, 0)).toBeNull();
    expect(exterior.supportHeight(1, 0, 0)).toBe(0);
  });
});
