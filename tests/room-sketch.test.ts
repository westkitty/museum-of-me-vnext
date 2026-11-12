import { describe, expect, it } from 'vitest';
import { measureRoom } from '../src/workshop/RoomSketch';
import { validateWorkshopManifest, type WorkshopPlacementRecord, type WorkshopPlacementManifest } from '../src/workshop/schema';
import { validateWorkshopConservation } from '../src/workshop/conservation';

describe('two-corner Museum Builder room', () => {
  it('constructs four connected walls, one floor and an optional roof from two opposite points', () => {
    const room = measureRoom([250, 0, 250], [258, 0, 256]);
    expect(room).not.toBeNull();
    expect(room?.width).toBe(8);
    expect(room?.depth).toBe(6);
    expect(room?.corners).toEqual([
      [250, 0, 250], [258, 0, 250], [258, 0, 256], [250, 0, 256],
    ]);
    expect(room?.walls.map((wall) => wall.scale[0])).toEqual([8, 6, 8, 6]);
    expect(room?.floor).toEqual({ position: [254, 0, 253], scale: [4, 1, 3] });
    expect(room?.roof).toEqual({ position: [254, 3.09, 253], scale: [4, 1, 3] });
    // Walls share exactly the corners; no floating gap at an orientation change.
    for (const wall of room!.walls) {
      expect(wall.position[1]).toBe(0);
      expect(wall.rotation[0]).toBe(0);
      expect(wall.rotation[2]).toBe(0);
    }
  });

  it('is invariant under reverse corner order and accepts rooms on higher levels', () => {
    const forward = measureRoom([-7, 3, 8], [4, 3, 19]);
    const reverse = measureRoom([4, 3, 19], [-7, 3, 8]);
    expect(forward).toEqual(reverse);
    expect(forward?.floor.position[1]).toBe(3);
    expect(forward?.roof.position[1]).toBeCloseTo(6.09);
  });

  it('rejects degenerate, sloped, enormous or nonfinite rooms', () => {
    const invalid = [
      [[250, 0, 250], [250, 0, 251]],
      [[250, 0, 250], [250.5, 0, 254]],
      [[250, 0, 250], [260, 1, 260]],
      [[250, 0, 250], [281, 0, 253]],
      [[250, 0, 250], [253, 0, 281]],
      [[250, 0, 250], [Number.POSITIVE_INFINITY, 0, 256]],
    ] as const;
    for (const [start, end] of invalid) expect(measureRoom(start, end)).toBeNull();
  });

  it('accepts the complete room as a source manifest and applies conservation to every component', () => {
    const room = measureRoom([250, 0, 250], [256, 0, 258])!;
    const records: WorkshopPlacementRecord[] = [
      ...room.walls.map((wall, i): WorkshopPlacementRecord => ({
        id: `partition-wall-${i + 1}`, label: `Room wall ${i + 1}`,
        prefab: 'partition-wall', anchor: 'floor',
        position: wall.position, rotation: wall.rotation, scale: wall.scale,
        collision: 'solid', worldId: 'exterior',
      })),
      {
        id: 'floor-slab-01', label: 'Room floor', prefab: 'floor-slab', anchor: 'floor',
        position: room.floor.position, rotation: [0, 0, 0], scale: room.floor.scale,
        collision: 'solid', worldId: 'exterior',
      },
      {
        id: 'roof-panel-01', label: 'Room roof', prefab: 'roof-panel', anchor: 'free',
        position: room.roof.position, rotation: [0, 0, 0], scale: room.roof.scale,
        collision: 'none', worldId: 'exterior',
      },
    ];
    const manifest: WorkshopPlacementManifest = { schemaVersion: 1, objects: records };
    const parsed = validateWorkshopManifest(manifest);
    expect(parsed.ok).toBe(true);
    expect(parsed.value?.objects).toHaveLength(6);
    expect(validateWorkshopConservation(manifest).ok).toBe(true);
  });

  it('rejects room construction over existing protected museum circulation', () => {
    const room = measureRoom([-6, 0, -6], [6, 0, 6])!;
    const records: WorkshopPlacementRecord[] = room.walls.map((wall, i): WorkshopPlacementRecord => ({
      id: `partition-wall-${i + 1}`, label: `Restricted wall ${i + 1}`,
      prefab: 'partition-wall', anchor: 'floor',
      position: wall.position, rotation: wall.rotation, scale: wall.scale,
      collision: 'solid', worldId: 'interior',
    }));
    expect(validateWorkshopConservation({ schemaVersion: 1, objects: records }).ok).toBe(false);
  });
});
