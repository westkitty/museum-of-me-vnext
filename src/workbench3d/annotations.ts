export type SpatialWorldId = 'interior' | 'exterior';

export interface PlanningPin {
  readonly id: string;
  readonly worldId: SpatialWorldId;
  /** X/Z in the selected world's authored coordinate frame. */
  readonly position: readonly [number, number];
  /** Interior level, or null for an outdoor pin. */
  readonly floor: 0 | 1 | null;
  readonly title: string;
  readonly body: string;
  /** Stable source feature when the ray hit has an authored semantic tag. */
  readonly featureId?: string;
  /** Exact world-space Y when the physical surface supplied it. */
  readonly y?: number;
}

/**
 * Migrate the v1 2D plan meaning explicitly: pins without worldId came from
 * the indoor-only top-down museum map. Outdoor pins always carry worldId and
 * floor:null, so legacy floors can never be reinterpreted as island pins.
 */
export function normalizePlanningPin(value: unknown): PlanningPin | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id || !Array.isArray(row.position)
    || row.position.length !== 2
    || !row.position.every((coordinate) => typeof coordinate === 'number'
      && Number.isFinite(coordinate) && Math.abs(coordinate) <= 300)) return null;

  const worldId = row.worldId === undefined ? 'interior' : row.worldId;
  if (worldId !== 'interior' && worldId !== 'exterior') return null;
  const floor = worldId === 'exterior'
    ? null
    : row.floor === 0 || row.floor === 1 ? row.floor : null;
  if (worldId === 'interior' && floor === null) return null;

  const y = typeof row.y === 'number' && Number.isFinite(row.y) && Math.abs(row.y) <= 100
    ? row.y : undefined;
  const featureId = typeof row.featureId === 'string'
    && /^[a-z0-9][a-z0-9-]{0,79}$/.test(row.featureId) ? row.featureId : undefined;
  return {
    id: row.id.slice(0, 60),
    worldId,
    position: [row.position[0], row.position[1]],
    floor,
    title: String(row.title || 'Annotation').slice(0, 120),
    body: String(row.body || '').slice(0, 10_000),
    ...(featureId ? { featureId } : {}),
    ...(y === undefined ? {} : { y }),
  };
}
