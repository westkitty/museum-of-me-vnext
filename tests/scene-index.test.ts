import { describe, expect, it } from 'vitest';
import { PLACEMENTS, STAIRS, WINGS, ZONES } from '../src/world/layout';
import { INSTALLATION_PLACEMENTS } from '../src/world/installationPlacement';
import { canonicalRoute } from '../src/world/route';
import { buildMuseumSceneIndex, querySceneIndex } from '../src/workshop/SceneIndex';
import { MuseumPlacements } from '../src/workshop/MuseumPlacements';
import { AuthorableSceneRegistry } from '../src/workshop/AuthorableSceneRegistry';
import * as THREE from 'three';
import { zoneAtXYZ } from '../src/world/layout';
import type { WorkshopPlacementManifest } from '../src/workshop/schema';
import { CollisionWorld } from '../src/world/CollisionWorld';

const manifest: WorkshopPlacementManifest = { schemaVersion: 2, objects: [{
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

  it('attributes every located item to its museum zone', () => {
    const snapshot = buildMuseumSceneIndex(manifest);
    expect(snapshot.schemaVersion).toBe(2);
    for (const exhibit of snapshot.exhibits) {
      expect(exhibit.zone).toBe(zoneAtXYZ(...(exhibit.anchor as [number, number, number])));
    }
    expect(snapshot.exhibits.find((exhibit) => exhibit.id === 'E03')?.zone).toBe('north');
    expect(snapshot.exhibits.find((exhibit) => exhibit.id === 'E13')?.zone).toBe('media');
    expect(new Set(snapshot.route.map((point) => point.zone)).size).toBeGreaterThan(4);
    expect(snapshot.installations.every((item) => typeof item.zone === 'string')).toBe(true);
    // Without a runtime the index says so instead of inventing bounds or residency.
    expect(snapshot.authored[0]).toMatchObject({ bounds: null, resident: null });
    expect(snapshot.sceneObjects).toBeNull();
    expect(snapshot.unavailable).toEqual(expect.arrayContaining(['live residency', 'authored placement bounds']));
  });

  it('reports live bounds, residency and moved original objects from the runtime', () => {
    const root = new THREE.Group();
    const registry = new AuthorableSceneRegistry([{ id: 'rotunda-information-counter', root }]);
    const placements = new MuseumPlacements(manifest, registry);
    root.position.x += 0.5;
    const snapshot = buildMuseumSceneIndex(manifest, {}, { placements });
    const authored = snapshot.authored[0];
    expect(authored.resident).toBe(true);
    const live = placements.placementBounds('outside-object')!;
    expect(authored.bounds).toEqual({ min: live.min.toArray(), max: live.max.toArray() });
    expect(authored.bounds!.min[0]).toBeCloseTo(259.5, 6);
    expect(snapshot.sceneObjects).toHaveLength(1);
    expect(snapshot.sceneObjects![0]).toMatchObject({ id: 'rotunda-information-counter', moved: true });
    expect(snapshot.unavailable).not.toContain('live residency');
    placements.dispose();
  });

  it('attributes colliders to zones by centre and answers nearest-first spatial queries', () => {
    const interior = new CollisionWorld();
    interior.setDynamicWall('north-wall', { kind: 'wall', minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -61, maxZ: -59 });
    const snapshot = buildMuseumSceneIndex(manifest, { interior });
    expect(snapshot.collisions.interior?.[0]).toMatchObject({ id: 'wall:north-wall', zone: 'north' });

    const query = querySceneIndex(snapshot);
    const e03 = snapshot.exhibits.find((exhibit) => exhibit.id === 'E03')!;
    const hits = query.near(e03.anchor, 2);
    expect(hits[0]).toMatchObject({ kind: 'exhibit', id: 'E03', distance: 0 });
    expect(hits.every((hit, i) => i === 0 || hits[i - 1].distance <= hit.distance)).toBe(true);
    expect(query.near([260, 0, 260], 0.1).map((hit) => hit.id)).toContain('outside-object');
    expect(query.near([0, 0, 0], 0).filter((hit) => hit.kind === 'authored')).toEqual([]);
    const stair = snapshot.stairs[0];
    expect(query.near(stair.from, 0.01).some((hit) => hit.kind === 'stair' && hit.id === stair.id)).toBe(true);
    // The curved stair is sampled: its mid-run point lies on the path even though it is off the chord.
    const mid = stair.path[Math.floor(stair.path.length / 2)];
    expect(query.near(mid, 0.01).some((hit) => hit.kind === 'stair' && hit.id === stair.id)).toBe(true);
    const install = snapshot.installations[0];
    const edge: [number, number, number] = [install.position[0] + install.footprint[0] - 0.01, 0, install.position[2]];
    expect(query.near(edge, 0).some((hit) => hit.kind === 'installation' && hit.id === install.id)).toBe(true);
  });
});
