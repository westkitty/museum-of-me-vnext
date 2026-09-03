import { isWorkshopPrefabId, type WorkshopPrefabId } from './catalog';

export const WORKSHOP_SCHEMA_VERSION = 1 as const;
export const WORKSHOP_MAX_OBJECTS = 256;

export type WorkshopAnchor = 'floor' | 'free';
export type WorkshopVec3 = [number, number, number];

export interface WorkshopSceneOverride {
  readonly id: string;
  readonly position: WorkshopVec3;
  readonly rotation: WorkshopVec3;
  readonly scale: WorkshopVec3;
}

export interface WorkshopPlacementRecord {
  readonly id: string;
  readonly label: string;
  readonly prefab: WorkshopPrefabId;
  readonly anchor: WorkshopAnchor;
  readonly position: WorkshopVec3;
  readonly rotation: WorkshopVec3;
  readonly scale: WorkshopVec3;
}

export interface WorkshopPlacementManifest {
  readonly schemaVersion: typeof WORKSHOP_SCHEMA_VERSION;
  readonly objects: readonly WorkshopPlacementRecord[];
  /** Existing-scene dressing transforms. Optional for schema-version-1 files. */
  readonly sceneOverrides?: readonly WorkshopSceneOverride[];
}

export interface WorkshopManifestValidation {
  readonly ok: boolean;
  readonly value: WorkshopPlacementManifest | null;
  readonly errors: readonly string[];
}

export const EMPTY_WORKSHOP_MANIFEST: WorkshopPlacementManifest = {
  schemaVersion: WORKSHOP_SCHEMA_VERSION,
  objects: [],
  sceneOverrides: [],
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const POSITION_LIMITS: readonly [number, number, number] = [500, 150, 500];
const SCALE_MIN = 0.05;
const SCALE_MAX = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteVec3(value: unknown): WorkshopVec3 | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null;
  return [value[0], value[1], value[2]];
}

function validateRecord(value: unknown, index: number, errors: string[]): WorkshopPlacementRecord | null {
  if (!isRecord(value)) {
    errors.push(`objects[${index}] must be an object`);
    return null;
  }

  const id = typeof value.id === 'string' ? value.id : '';
  if (!ID_PATTERN.test(id)) errors.push(`objects[${index}].id must match ${ID_PATTERN}`);

  const label = typeof value.label === 'string' ? value.label.trim() : '';
  if (label.length < 1 || label.length > 80) {
    errors.push(`objects[${index}].label must contain 1-80 characters`);
  }

  const prefab = value.prefab;
  if (!isWorkshopPrefabId(prefab)) errors.push(`objects[${index}].prefab is not a supported Workshop prefab`);

  const anchor = value.anchor;
  if (anchor !== 'floor' && anchor !== 'free') {
    errors.push(`objects[${index}].anchor must be "floor" or "free"`);
  }

  const position = finiteVec3(value.position);
  const rotation = finiteVec3(value.rotation);
  const scale = finiteVec3(value.scale);
  if (!position) errors.push(`objects[${index}].position must be three finite numbers`);
  if (!rotation) errors.push(`objects[${index}].rotation must be three finite numbers`);
  if (!scale) errors.push(`objects[${index}].scale must be three finite numbers`);

  if (position) {
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(position[axis]) > POSITION_LIMITS[axis]) {
        errors.push(`objects[${index}].position[${axis}] exceeds the Workshop world bounds`);
      }
    }
  }

  if (scale && scale.some((entry) => entry < SCALE_MIN || entry > SCALE_MAX)) {
    errors.push(`objects[${index}].scale entries must be between ${SCALE_MIN} and ${SCALE_MAX}`);
  }

  if (
    !ID_PATTERN.test(id)
    || label.length < 1
    || label.length > 80
    || !isWorkshopPrefabId(prefab)
    || (anchor !== 'floor' && anchor !== 'free')
    || !position
    || !rotation
    || !scale
  ) {
    return null;
  }

  return {
    id,
    label,
    prefab,
    anchor,
    position,
    rotation,
    scale,
  };
}

function validateSceneOverride(value: unknown, index: number, errors: string[]): WorkshopSceneOverride | null {
  if (!isRecord(value)) {
    errors.push(`sceneOverrides[${index}] must be an object`);
    return null;
  }
  const id = typeof value.id === 'string' ? value.id : '';
  if (!ID_PATTERN.test(id)) errors.push(`sceneOverrides[${index}].id must match ${ID_PATTERN}`);
  const position = finiteVec3(value.position);
  const rotation = finiteVec3(value.rotation);
  const scale = finiteVec3(value.scale);
  if (!position) errors.push(`sceneOverrides[${index}].position must be three finite numbers`);
  if (!rotation) errors.push(`sceneOverrides[${index}].rotation must be three finite numbers`);
  if (!scale) errors.push(`sceneOverrides[${index}].scale must be three finite numbers`);
  if (position) {
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(position[axis]) > POSITION_LIMITS[axis]) {
        errors.push(`sceneOverrides[${index}].position[${axis}] exceeds the Workshop world bounds`);
      }
    }
  }
  if (scale && scale.some((entry) => entry < SCALE_MIN || entry > SCALE_MAX)) {
    errors.push(`sceneOverrides[${index}].scale entries must be between ${SCALE_MIN} and ${SCALE_MAX}`);
  }
  if (!ID_PATTERN.test(id) || !position || !rotation || !scale) return null;
  return { id, position, rotation, scale };
}

export function validateWorkshopManifest(value: unknown): WorkshopManifestValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, value: null, errors: ['manifest must be an object'] };
  }

  if (value.schemaVersion !== WORKSHOP_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${WORKSHOP_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.objects)) {
    errors.push('objects must be an array');
    return { ok: false, value: null, errors };
  }
  const rawSceneOverrides = value.sceneOverrides === undefined ? [] : value.sceneOverrides;
  if (!Array.isArray(rawSceneOverrides)) {
    errors.push('sceneOverrides must be an array when present');
  }
  if (value.objects.length > WORKSHOP_MAX_OBJECTS) {
    errors.push(`objects may contain at most ${WORKSHOP_MAX_OBJECTS} records`);
  }

  const objects: WorkshopPlacementRecord[] = [];
  const sceneOverrides: WorkshopSceneOverride[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < value.objects.length; index++) {
    const parsed = validateRecord(value.objects[index], index, errors);
    if (!parsed) continue;
    if (ids.has(parsed.id)) {
      errors.push(`duplicate object id: ${parsed.id}`);
      continue;
    }
    ids.add(parsed.id);
    objects.push(parsed);
  }

  if (Array.isArray(rawSceneOverrides)) {
    if (rawSceneOverrides.length > 64) errors.push('sceneOverrides may contain at most 64 records');
    for (let index = 0; index < rawSceneOverrides.length; index++) {
      const parsed = validateSceneOverride(rawSceneOverrides[index], index, errors);
      if (!parsed) continue;
      if (ids.has(parsed.id)) {
        errors.push(`duplicate object id: ${parsed.id}`);
        continue;
      }
      ids.add(parsed.id);
      sceneOverrides.push(parsed);
    }
  }

  if (errors.length) return { ok: false, value: null, errors };
  return {
    ok: true,
    value: canonicalizeWorkshopManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects, sceneOverrides }),
    errors: [],
  };
}

function roundNumber(value: number): number {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function canonicalVec3(value: WorkshopVec3): WorkshopVec3 {
  return [roundNumber(value[0]), roundNumber(value[1]), roundNumber(value[2])];
}

export function canonicalizeWorkshopManifest(manifest: WorkshopPlacementManifest): WorkshopPlacementManifest {
  return {
    schemaVersion: WORKSHOP_SCHEMA_VERSION,
    objects: [...manifest.objects]
      .map((record) => ({
        id: record.id,
        label: record.label.trim(),
        prefab: record.prefab,
        anchor: record.anchor,
        position: canonicalVec3(record.position),
        rotation: canonicalVec3(record.rotation),
        scale: canonicalVec3(record.scale),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    sceneOverrides: [...(manifest.sceneOverrides ?? [])]
      .map((override) => ({
        id: override.id,
        position: canonicalVec3(override.position),
        rotation: canonicalVec3(override.rotation),
        scale: canonicalVec3(override.scale),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function cloneWorkshopManifest(manifest: WorkshopPlacementManifest): WorkshopPlacementManifest {
  return canonicalizeWorkshopManifest(manifest);
}

export function serializeWorkshopManifest(manifest: WorkshopPlacementManifest): string {
  return `${JSON.stringify(canonicalizeWorkshopManifest(manifest), null, 2)}\n`;
}

export function workshopManifestsEqual(a: WorkshopPlacementManifest, b: WorkshopPlacementManifest): boolean {
  return serializeWorkshopManifest(a) === serializeWorkshopManifest(b);
}
