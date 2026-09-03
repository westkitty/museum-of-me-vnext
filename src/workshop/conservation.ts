import {
  BALCONY_INNER_APOTHEM,
  GROUND_Y,
  LEVEL_1_Y,
  PLACEMENTS,
  PLINTH_RADIUS,
  PLINTH_TOP_Y,
  ROTUNDA_APOTHEM,
  SANCTUARY_CENTER,
  SANCTUARY_FLOOR_Y,
  SANCTUARY_RADIUS,
  SANCTUARY_RAMP_FROM,
  SANCTUARY_RAMP_HALF_WIDTH,
  SANCTUARY_RAMP_TO,
  SANCTUARY_DIR,
  STAIRS,
  WINGS,
  stairArcPoint,
  faceDirection,
  rightOf,
  type Vec3,
} from '../world/layout';
import { INSTALLATION_PLACEMENTS } from '../world/installationPlacement';
import { SOURCE_VISITORS, visitorRouteForVNext } from '../content/sourceParity';
import { INTERACTION_REACH } from '../interaction/InteractionManager';
import {
  validateWorkshopManifest,
  type WorkshopManifestValidation,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
} from './schema';
import type { WorkshopPrefabId } from './catalog';
import {
  AUTHORABLE_SCENE_DEFINITIONS,
  type AuthorableSceneEntry,
} from './AuthorableSceneRegistry';

export interface WorkshopConservationViolation {
  readonly placementId: string;
  readonly placementLabel: string;
  readonly protectedArea: string;
  readonly rule: string;
  readonly reason: string;
}

export interface WorkshopConservationValidation {
  readonly ok: boolean;
  readonly violations: readonly WorkshopConservationViolation[];
}

interface ProtectedArea {
  readonly protectedArea: string;
  readonly rule: string;
  readonly yMin: number;
  readonly yMax: number;
  readonly intersects: (x: number, z: number, radius: number) => boolean;
}

interface PrefabBounds {
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
  readonly minY: number;
  readonly maxY: number;
}

type SceneTransform = {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
};

/** Conservative render bounds for the existing four safe, non-colliding prefabs. */
const PREFAB_BOUNDS: Record<WorkshopPrefabId, PrefabBounds> = {
  'display-plinth': { halfX: 0.88, halfY: 0.55, halfZ: 0.88, minY: 0, maxY: 1.1 },
  'museum-bench': { halfX: 1.1, halfY: 0.385, halfZ: 0.36, minY: 0, maxY: 0.77 },
  'sign-post': { halfX: 0.625, halfY: 0.89, halfZ: 0.26, minY: 0, maxY: 1.78 },
  'artifact-table': { halfX: 0.825, halfY: 0.5, halfZ: 0.5, minY: 0, maxY: 1 },
};

const SCENE_BOUNDS = new Map(AUTHORABLE_SCENE_DEFINITIONS.map((entry) => [entry.id, entry.bounds]));

function circle(
  protectedArea: string,
  rule: string,
  center: Vec3,
  radius: number,
  yMin: number,
  yMax: number,
): ProtectedArea {
  return {
    protectedArea, rule, yMin, yMax,
    intersects: (x, z, objectRadius) => {
      const dx = x - center[0];
      const dz = z - center[2];
      return dx * dx + dz * dz <= (radius + objectRadius) ** 2;
    },
  };
}

function slab(
  protectedArea: string,
  rule: string,
  direction: Vec3,
  alongMin: number,
  alongMax: number,
  halfWidth: number,
  yMin: number,
  yMax: number,
): ProtectedArea {
  const right = rightOf(direction);
  return {
    protectedArea, rule, yMin, yMax,
    intersects: (x, z, objectRadius) => {
      const along = x * direction[0] + z * direction[2];
      const lateral = x * right[0] + z * right[2];
      return along >= alongMin - objectRadius
        && along <= alongMax + objectRadius
        && Math.abs(lateral) <= halfWidth + objectRadius;
    },
  };
}

function protectedAreas(): readonly ProtectedArea[] {
  const areas: ProtectedArea[] = [
    circle(
      'Rotunda flight-pad operating area', 'flight-pad',
      [0, GROUND_Y, 0], PLINTH_RADIUS + 0.45, GROUND_Y - 0.75, PLINTH_TOP_Y + 2,
    ),
    circle(
      'Rotunda circulation floor', 'rotunda-circulation',
      [0, GROUND_Y, 0], ROTUNDA_APOTHEM - 0.75, GROUND_Y - 0.75, 3.2,
    ),
    slab(
      'Dexter Sanctuary access zone', 'sanctuary-access', SANCTUARY_DIR,
      SANCTUARY_RAMP_FROM - 1, SANCTUARY_RAMP_TO + 1,
      SANCTUARY_RAMP_HALF_WIDTH + 1, SANCTUARY_FLOOR_Y - 1, GROUND_Y + 3,
    ),
    circle(
      'Dexter Sanctuary chamber', 'sanctuary-chamber',
      SANCTUARY_CENTER, SANCTUARY_RADIUS + 1, SANCTUARY_FLOOR_Y - 1,
      SANCTUARY_FLOOR_Y + 3,
    ),
  ];

  for (const wing of WINGS) {
    const direction = faceDirection(wing.face);
    areas.push(
      slab(
        `${wing.id} wing threshold`, `wing-threshold:${wing.id}`, direction,
        ROTUNDA_APOTHEM - 1, wing.corridorTo + 1, wing.corridorHalfWidth + 0.75,
        wing.floorY - 0.75, wing.floorY + 3,
      ),
      slab(
        `${wing.id} mandatory hall passage`, `wing-circulation:${wing.id}`, direction,
        wing.hallFrom - 1, wing.hallTo + 1, Math.max(2.5, wing.hallHalfWidth - 2),
        wing.floorY - 0.75, wing.floorY + 3,
      ),
    );
  }

  for (const stair of STAIRS) {
    for (let i = 0; i <= stair.collisionSegments; i++) {
      const point = stairArcPoint(stair, i / stair.collisionSegments);
      areas.push(circle(
        `${stair.id} operating path`, `stair-circulation:${stair.id}`,
        point, stair.halfWidth + 0.9, point[1] - 1, point[1] + 3,
      ));
    }
  }

  for (const installation of INSTALLATION_PLACEMENTS) {
    const readRadius = Math.max(
      installation.readingZoneRadius,
      installation.interactionRadius,
      installation.cameraSafeDistance,
    );
    const floorY = installation.interactionPoint[1];
    areas.push(
      circle(
        `${installation.id} interaction/read zone`, `source-installation-read:${installation.id}`,
        installation.interactionPoint, readRadius + 0.5, floorY - 0.75, floorY + 3,
      ),
      circle(
        `${installation.id} lectern`, `source-installation-lectern:${installation.id}`,
        installation.lectern, installation.lecternCollisionRadius + 0.8,
        installation.lectern[1] - 0.75, installation.lectern[1] + 3,
      ),
      circle(
        `${installation.id} installation footprint`, `source-installation-footprint:${installation.id}`,
        installation.position,
        Math.hypot(installation.footprint[0], installation.footprint[1]) + 0.8,
        installation.position[1] - 0.75, installation.position[1] + 3,
      ),
    );
  }

  for (const placement of PLACEMENTS) {
    areas.push(circle(
      `${placement.exhibitId} interaction/read zone`, `exhibit-read-zone:${placement.exhibitId}`,
      placement.visitorSpot, INTERACTION_REACH, placement.visitorSpot[1] - 0.75,
      placement.visitorSpot[1] + 3,
    ));
  }

  for (const visitor of SOURCE_VISITORS) {
    for (const point of visitorRouteForVNext(visitor.id)) {
      areas.push(circle(
        `${visitor.id} authored visitor route`, `authored-visitor-route:${visitor.id}`,
        point, visitor.width / 2 + 1, point[1] - 0.75, point[1] + 3,
      ));
    }
  }

  // The upper balcony opening is an existing floor boundary, not a Workshop
  // coordinate system. Keep its authored ring edge clear wherever a free
  // placement could otherwise project into the atrium.
  areas.push(slab(
    'Rotunda balcony inner edge', 'balcony-inner-edge', [0, 0, -1],
    -BALCONY_INNER_APOTHEM - 1, BALCONY_INNER_APOTHEM + 1, 1.5,
    LEVEL_1_Y - 0.75, LEVEL_1_Y + 3,
  ));

  return areas;
}

const PROTECTED_AREAS = protectedAreas();

function placementRadius(record: WorkshopPlacementRecord): number {
  const bounds = PREFAB_BOUNDS[record.prefab];
  // A sphere is intentionally conservative for arbitrary Euler rotation. The
  // validator protects visitor experience, not a new collision representation.
  return Math.hypot(
    bounds.halfX * record.scale[0],
    bounds.halfY * record.scale[1],
    bounds.halfZ * record.scale[2],
  );
}

function overlapsVertical(record: WorkshopPlacementRecord, area: ProtectedArea): boolean {
  const bounds = PREFAB_BOUNDS[record.prefab];
  const minY = record.position[1] + bounds.minY;
  const maxY = record.position[1] + bounds.maxY;
  return minY <= area.yMax && maxY >= area.yMin;
}

function sceneRadius(transform: SceneTransform, bounds: PrefabBounds): number {
  return Math.hypot(
    bounds.halfX * transform.scale[0],
    bounds.halfY * transform.scale[1],
    bounds.halfZ * transform.scale[2],
  );
}

function sceneOverlapsVertical(transform: SceneTransform, bounds: PrefabBounds, area: ProtectedArea): boolean {
  const minY = transform.position[1] + bounds.minY * transform.scale[1];
  const maxY = transform.position[1] + bounds.maxY * transform.scale[1];
  return minY <= area.yMax && maxY >= area.yMin;
}

export function validateWorkshopConservation(
  manifest: WorkshopPlacementManifest,
  sceneEntries: readonly AuthorableSceneEntry[] = [],
): WorkshopConservationValidation {
  const violations: WorkshopConservationViolation[] = [];
  for (const record of manifest.objects) {
    const radius = placementRadius(record);
    for (const area of PROTECTED_AREAS) {
      if (!overlapsVertical(record, area) || !area.intersects(record.position[0], record.position[2], radius)) continue;
      violations.push({
        placementId: record.id,
        placementLabel: record.label,
        protectedArea: area.protectedArea,
        rule: area.rule,
        reason: `${record.label} intersects ${area.protectedArea}`,
      });
      break;
    }
  }

  const entriesById = new Map(sceneEntries.map((entry) => [entry.id, entry]));
  for (const override of manifest.sceneOverrides ?? []) {
    const entry = entriesById.get(override.id);
    const bounds = entry?.bounds ?? SCENE_BOUNDS.get(override.id);
    if (!bounds) {
      violations.push({
        placementId: override.id,
        placementLabel: override.id,
        protectedArea: 'Authorable scene registry',
        rule: 'unknown-authorable-object',
        reason: `${override.id} is not registered as an authorable scene object`,
      });
      continue;
    }
    for (const area of PROTECTED_AREAS) {
      if (!sceneOverlapsVertical(override, bounds, area) || !area.intersects(
        override.position[0], override.position[2], sceneRadius(override, bounds),
      )) continue;
      violations.push({
        placementId: override.id,
        placementLabel: entry?.label ?? override.id,
        protectedArea: area.protectedArea,
        rule: area.rule,
        reason: `${entry?.label ?? override.id} intersects ${area.protectedArea}`,
      });
      break;
    }
  }
  return { ok: violations.length === 0, violations };
}

export function conservationErrors(
  violations: readonly WorkshopConservationViolation[],
): string[] {
  return violations.map((violation) =>
    `${violation.placementLabel} (${violation.placementId}): ${violation.reason} [${violation.rule}]`);
}

export function validateWorkshopManifestForMuseum(
  raw: unknown,
  sceneEntries: readonly AuthorableSceneEntry[] = [],
): WorkshopManifestValidation {
  const parsed = validateWorkshopManifest(raw);
  if (!parsed.ok || !parsed.value) return parsed;
  const conservation = validateWorkshopConservation(parsed.value, sceneEntries);
  if (!conservation.ok) {
    return { ok: false, value: null, errors: conservationErrors(conservation.violations) };
  }
  return parsed;
}
