import { measureWall, type WallPoint, type WallSegment } from './WallSketch';

/** An axis-aligned, two-corner room sketch, in metres, at one floor elevation. */
export interface RoomSketch {
  readonly corners: readonly [WallPoint, WallPoint, WallPoint, WallPoint];
  readonly walls: readonly [WallSegment, WallSegment, WallSegment, WallSegment];
  readonly floor: { readonly position: [number, number, number]; readonly scale: [number, number, number] };
  readonly roof: { readonly position: [number, number, number]; readonly scale: [number, number, number] };
  readonly width: number;
  readonly depth: number;
}

/**
 * Model-first geometry source for the rectangle tool. The four walls and slab
 * share exact corners, so a single Undo restores/removes the whole operation.
 * The Builder applies its existing visitor-route/conservation validation
 * atomically before accepting any resulting placement records.
 */
export function measureRoom(start: WallPoint, end: WallPoint): RoomSketch | null {
  if (![...start, ...end].every(Number.isFinite)) return null;
  if (Math.abs(start[1] - end[1]) > 0.001) return null;
  const width = Math.abs(end[0] - start[0]);
  const depth = Math.abs(end[2] - start[2]);
  if (width < 1.25 || depth < 1.25 || width > 30 || depth > 30) return null;

  const xMin = Math.min(start[0], end[0]);
  const xMax = Math.max(start[0], end[0]);
  const zMin = Math.min(start[2], end[2]);
  const zMax = Math.max(start[2], end[2]);
  const y = start[1];
  const corners: [WallPoint, WallPoint, WallPoint, WallPoint] = [
    [xMin, y, zMin], [xMax, y, zMin], [xMax, y, zMax], [xMin, y, zMax],
  ];
  const walls: WallSegment[] = [];
  for (let index = 0; index < 4; index++) {
    const segment = measureWall(corners[index], corners[(index + 1) % 4]);
    if (!segment) return null;
    walls.push(segment);
  }
  const center: [number, number, number] = [(xMin + xMax) / 2, y, (zMin + zMax) / 2];
  const scale: [number, number, number] = [width / 2, 1, depth / 2];
  return {
    corners,
    walls: walls as [WallSegment, WallSegment, WallSegment, WallSegment],
    floor: { position: [...center], scale: [...scale] },
    // Roof BoxGeometry is 0.18 m tall; bottom is above the 3 m-high walls.
    roof: { position: [center[0], y + 3.09, center[2]], scale: [...scale] },
    width, depth,
  };
}
