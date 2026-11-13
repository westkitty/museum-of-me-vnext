import {
  ENTRANCE_DOOR, INTERIOR_ENTRY_POSITION, EXTERIOR_RETURN_POSITION, PLACEMENTS, SANCTUARY_CENTER,
  STAIRS, WINGS, ZONES, stairArcPoint, zoneAtXYZ, type Vec3, type ZoneId,
} from '../world/layout';
import { INSTALLATION_PLACEMENTS } from '../world/installationPlacement';
import { canonicalRoute } from '../world/route';
import type { ColliderSnapshot, CollisionWorld } from '../world/CollisionWorld';
import type { WorkshopPlacementManifest } from './schema';
import type { AuthorableSceneTransform } from './AuthorableSceneRegistry';

export interface SceneBounds { readonly min: Vec3; readonly max: Vec3 }

/**
 * Optional live runtime sources. Kept structural so the index never needs a
 * live THREE scene in tests and can never mutate what it reads.
 */
export interface SceneIndexRuntime {
  readonly placements?: {
    isResident(id: string): boolean;
    placementBounds(id: string): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null;
    sceneEntries(): readonly { id: string; label: string; collisionPolicy: string; baseline: AuthorableSceneTransform;
      root: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number } } }[];
  };
}

/**
 * Read-only snapshot derived from the same spatial sources as the museum runtime.
 * Every located item carries the museum zone that contains it (or the nearest
 * zone outside the building, as `zoneAtXYZ` defines).
 */
export interface MuseumSceneIndex {
  readonly schemaVersion: 2;
  readonly source: 'museum-layout';
  readonly wings: readonly { id: string; level: number; floorY: number; exhibits: readonly string[] }[];
  readonly zones: readonly { id: string; label: string; center: Vec3; level: number; shapes: (typeof ZONES)[number]['shapes']; neighbours: readonly string[] }[];
  readonly exhibits: readonly { id: string; wing: string; zone: ZoneId; anchor: Vec3; doorway: Vec3; visitorSpot: Vec3; bounds: (typeof PLACEMENTS)[number]['bounds'] }[];
  /** `path` samples the stair's curved centreline from foot to head. */
  readonly stairs: readonly { id: string; from: Vec3; to: Vec3; halfWidth: number; path: readonly Vec3[] }[];
  readonly threshold: { doorway: Vec3; interior: Vec3; exterior: Vec3 };
  readonly sanctuary: Vec3;
  readonly route: readonly { id: string; label: string; position: Vec3; zone: ZoneId; exhibitId?: string }[];
  readonly installations: readonly { id: string; host: string; zone: ZoneId; position: Vec3; interactionPoint: Vec3; footprint: readonly [number, number] }[];
  readonly authored: readonly {
    id: string; label: string; prefab: string; world: string; zone: ZoneId; position: Vec3; assetId?: string; collision: string;
    /** World AABB, or null when no runtime was supplied or a model's bounds are not yet known. */
    bounds: SceneBounds | null;
    /** Live root present; null when no runtime was supplied. */
    resident: boolean | null;
  }[];
  /** Original museum objects the Workshop may move, with their current and baseline transforms. */
  readonly sceneObjects: readonly { id: string; label: string; zone: ZoneId; collisionPolicy: string;
    current: AuthorableSceneTransform; baseline: AuthorableSceneTransform; moved: boolean }[] | null;
  /** Colliders with `zone` from their centre: spatial attribution, not ownership. */
  readonly collisions: { readonly exterior: readonly (ColliderSnapshot & { zone: ZoneId })[] | null; readonly interior: readonly (ColliderSnapshot & { zone: ZoneId })[] | null };
  /** These are explicitly absent until independently derived from their runtime owners. */
  readonly unavailable: readonly string[];
}

const zoneOf = (p: Vec3): ZoneId => zoneAtXYZ(p[0], p[1], p[2]);
export const STAIR_SAMPLES = 12;

function colliderCentre(collider: ColliderSnapshot): Vec3 {
  if (collider.kind === 'floor') return [(collider.minX + collider.maxX) / 2, collider.y, (collider.minZ + collider.maxZ) / 2];
  if (collider.kind === 'wall') return [(collider.minX + collider.maxX) / 2, (collider.minY + collider.maxY) / 2, (collider.minZ + collider.maxZ) / 2];
  const ramp = collider as unknown as { minX: number; maxX: number; minZ: number; maxZ: number; y0?: number; y1?: number };
  return [(ramp.minX + ramp.maxX) / 2, ((ramp.y0 ?? 0) + (ramp.y1 ?? 0)) / 2, (ramp.minZ + ramp.maxZ) / 2];
}

function zonedColliders(world: CollisionWorld | undefined) {
  return world?.snapshot().map((collider) => ({ ...collider, zone: zoneOf(colliderCentre(collider)) })) ?? null;
}

const vec = (v: { x: number; y: number; z: number }): [number, number, number] => [v.x, v.y, v.z];

export function buildMuseumSceneIndex(manifest: WorkshopPlacementManifest,
  worlds: { exterior?: CollisionWorld; interior?: CollisionWorld } = {}, runtime: SceneIndexRuntime = {}): MuseumSceneIndex {
  const placements = runtime.placements;
  return structuredClone({
    schemaVersion: 2, source: 'museum-layout',
    wings: WINGS.map((wing) => ({ id: wing.id, level: wing.level, floorY: wing.floorY, exhibits: [...wing.exhibits] })),
    zones: ZONES.map((zone) => ({ id: zone.id, label: zone.label, center: zone.center, level: zone.level,
      shapes: zone.shapes, neighbours: [...zone.neighbours] })),
    exhibits: PLACEMENTS.map((placement) => ({ id: placement.exhibitId, wing: placement.wing, zone: zoneOf(placement.anchor),
      anchor: placement.anchor, doorway: placement.doorway, visitorSpot: placement.visitorSpot, bounds: placement.bounds })),
    stairs: STAIRS.map((stair) => ({ id: stair.id, from: stairArcPoint(stair, 0), to: stairArcPoint(stair, 1), halfWidth: stair.halfWidth,
      path: Array.from({ length: STAIR_SAMPLES + 1 }, (_, i) => stairArcPoint(stair, i / STAIR_SAMPLES)) })),
    threshold: { doorway: ENTRANCE_DOOR, interior: INTERIOR_ENTRY_POSITION, exterior: EXTERIOR_RETURN_POSITION },
    sanctuary: SANCTUARY_CENTER,
    route: canonicalRoute().map((point, index) => ({ id: `route:${String(index).padStart(3, '0')}`, label: point.label,
      position: point.at, zone: zoneOf(point.at), ...(point.exhibitId ? { exhibitId: point.exhibitId } : {}) })),
    installations: INSTALLATION_PLACEMENTS.map((item) => ({ id: item.id, host: item.host, zone: zoneOf(item.position),
      position: item.position, interactionPoint: item.interactionPoint, footprint: item.footprint })),
    authored: [...manifest.objects].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map((item) => {
      const box = placements?.placementBounds(item.id) ?? null;
      return {
        id: item.id, label: item.label, prefab: item.prefab, world: item.worldId ?? 'shared', zone: zoneOf(item.position),
        position: item.position, ...(item.assetId ? { assetId: item.assetId } : {}), collision: item.collision ?? 'none',
        bounds: box ? { min: vec(box.min), max: vec(box.max) } : null,
        resident: placements ? placements.isResident(item.id) : null,
      };
    }),
    sceneObjects: placements ? placements.sceneEntries().map((entry) => {
      const current: AuthorableSceneTransform = { position: vec(entry.root.position), rotation: vec(entry.root.rotation),
        scale: vec(entry.root.scale) };
      return { id: entry.id, label: entry.label, zone: zoneOf(current.position), collisionPolicy: entry.collisionPolicy,
        current, baseline: entry.baseline, moved: JSON.stringify(current) !== JSON.stringify(entry.baseline) };
    }) : null,
    collisions: { exterior: zonedColliders(worlds.exterior), interior: zonedColliders(worlds.interior) },
    unavailable: ['runtime mesh and surface inventory', ...(!worlds.exterior ? ['exterior collision world'] : []),
      ...(!worlds.interior ? ['interior collision world'] : []), 'masked-floor exact geometry',
      'static collider ownership attribution (zone attribution is spatial only)',
      ...(!placements ? ['live residency', 'authored placement bounds', 'original scene overrides'] : []),
      'deliberate negative space', 'spatial clearance evaluation'],
  });
}

export type SceneHitKind = 'exhibit' | 'installation' | 'authored' | 'route' | 'stair' | 'scene-object';
export interface SceneHit { readonly kind: SceneHitKind; readonly id: string; readonly zone: ZoneId; readonly distance: number }

/** Spatial lookups over an index. Distances are horizontal (XZ) to a point or box. */
export function querySceneIndex(index: MuseumSceneIndex) {
  const toBox = (x: number, z: number, b: SceneBounds) => Math.hypot(
    Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2]));
  const toPoint = (x: number, z: number, p: Vec3) => Math.hypot(p[0] - x, p[2] - z);
  const toSegment = (x: number, z: number, a: Vec3, b: Vec3) => {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(a[0] + t * dx - x, a[2] + t * dz - z);
  };
  return {
    /** Every indexed item within `radius` metres (XZ) of a point, nearest first. */
    near(point: Vec3, radius: number): SceneHit[] {
      const [x, , z] = point;
      const hits: SceneHit[] = [];
      const push = (kind: SceneHitKind, id: string, zone: ZoneId, distance: number) => {
        if (distance <= radius) hits.push({ kind, id, zone, distance });
      };
      for (const e of index.exhibits) {
        const { c, h } = e.bounds;
        push('exhibit', e.id, e.zone, toBox(x, z, { min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]],
          max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] }));
      }
      for (const i of index.installations) {
        // Footprints are half-extents of the installation's collision footprint.
        const [hx, hz] = i.footprint;
        push('installation', i.id, i.zone, toBox(x, z, { min: [i.position[0] - hx, 0, i.position[2] - hz],
          max: [i.position[0] + hx, 0, i.position[2] + hz] }));
      }
      for (const a of index.authored) push('authored', a.id, a.zone, a.bounds ? toBox(x, z, a.bounds) : toPoint(x, z, a.position));
      for (const r of index.route) push('route', r.id, r.zone, toPoint(x, z, r.position));
      for (const s of index.stairs) {
        let d = Infinity;
        for (let k = 0; k + 1 < s.path.length; k++) d = Math.min(d, toSegment(x, z, s.path[k], s.path[k + 1]));
        push('stair', s.id, zoneOf(s.from), Math.max(0, d - s.halfWidth));
      }
      for (const o of index.sceneObjects ?? []) push('scene-object', o.id, o.zone, toPoint(x, z, o.current.position));
      return hits.sort((a, b) => a.distance - b.distance || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    },
    zoneAt: zoneOf,
  };
}
