import {
  ENTRANCE_DOOR, INTERIOR_ENTRY_POSITION, EXTERIOR_RETURN_POSITION, PLACEMENTS, SANCTUARY_CENTER,
  STAIRS, WINGS, ZONES, stairArcPoint, type Vec3,
} from '../world/layout';
import { INSTALLATION_PLACEMENTS } from '../world/installationPlacement';
import { canonicalRoute } from '../world/route';
import type { ColliderSnapshot, CollisionWorld } from '../world/CollisionWorld';
import type { WorkshopPlacementManifest } from './schema';

/** Read-only snapshot derived from the same spatial sources as the museum runtime. */
export interface MuseumSceneIndex {
  readonly schemaVersion: 1;
  readonly source: 'museum-layout';
  readonly wings: readonly { id: string; level: number; floorY: number; exhibits: readonly string[] }[];
  readonly zones: readonly { id: string; label: string; center: Vec3; level: number; shapes: (typeof ZONES)[number]['shapes']; neighbours: readonly string[] }[];
  readonly exhibits: readonly { id: string; wing: string; anchor: Vec3; doorway: Vec3; visitorSpot: Vec3; bounds: (typeof PLACEMENTS)[number]['bounds'] }[];
  readonly stairs: readonly { id: string; from: Vec3; to: Vec3; halfWidth: number }[];
  readonly threshold: { doorway: Vec3; interior: Vec3; exterior: Vec3 };
  readonly sanctuary: Vec3;
  readonly route: readonly { id: string; label: string; position: Vec3; exhibitId?: string }[];
  readonly installations: readonly { id: string; host: string; position: Vec3; interactionPoint: Vec3; footprint: readonly [number, number] }[];
  readonly authored: readonly { id: string; label: string; prefab: string; world: string; position: Vec3; assetId?: string; collision: string }[];
  readonly collisions: { readonly exterior: readonly ColliderSnapshot[] | null; readonly interior: readonly ColliderSnapshot[] | null };
  /** These are explicitly absent until independently derived from their runtime owners. */
  readonly unavailable: readonly string[];
}

export function buildMuseumSceneIndex(manifest: WorkshopPlacementManifest,
  worlds: { exterior?: CollisionWorld; interior?: CollisionWorld } = {}): MuseumSceneIndex {
  return structuredClone({
    schemaVersion: 1, source: 'museum-layout',
    wings: WINGS.map((wing) => ({ id: wing.id, level: wing.level, floorY: wing.floorY, exhibits: [...wing.exhibits] })),
    zones: ZONES.map((zone) => ({ id: zone.id, label: zone.label, center: zone.center, level: zone.level,
      shapes: zone.shapes, neighbours: [...zone.neighbours] })),
    exhibits: PLACEMENTS.map((placement) => ({ id: placement.exhibitId, wing: placement.wing,
      anchor: placement.anchor, doorway: placement.doorway, visitorSpot: placement.visitorSpot, bounds: placement.bounds })),
    stairs: STAIRS.map((stair) => ({ id: stair.id, from: stairArcPoint(stair, 0), to: stairArcPoint(stair, 1), halfWidth: stair.halfWidth })),
    threshold: { doorway: ENTRANCE_DOOR, interior: INTERIOR_ENTRY_POSITION, exterior: EXTERIOR_RETURN_POSITION },
    sanctuary: SANCTUARY_CENTER,
    route: canonicalRoute().map((point, index) => ({ id: `route:${String(index).padStart(3, '0')}`, label: point.label,
      position: point.at, ...(point.exhibitId ? { exhibitId: point.exhibitId } : {}) })),
    installations: INSTALLATION_PLACEMENTS.map((item) => ({ id: item.id, host: item.host, position: item.position,
      interactionPoint: item.interactionPoint, footprint: item.footprint })),
    authored: [...manifest.objects].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((item) => ({
      id: item.id, label: item.label, prefab: item.prefab, world: item.worldId ?? 'shared', position: item.position,
      ...(item.assetId ? { assetId: item.assetId } : {}), collision: item.collision ?? 'none',
    })),
    collisions: { exterior: worlds.exterior?.snapshot() ?? null, interior: worlds.interior?.snapshot() ?? null },
    unavailable: ['runtime mesh and surface inventory', ...(!worlds.exterior ? ['exterior collision world'] : []),
      ...(!worlds.interior ? ['interior collision world'] : []), 'masked-floor exact geometry', 'static collider ownership attribution', 'live residency',
      'original scene overrides', 'deliberate negative space', 'spatial clearance evaluation'],
  });
}
