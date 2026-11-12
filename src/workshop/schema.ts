import { isWorkshopPrefabId, type WorkshopPrefabId } from './catalog';
import { builderModelAllowed, builderFinishAllowed } from './builderAssetCatalog';
import { defaultOpening, wallOpeningSegments, type WallOpeningKind } from './WallOpenings';

export const WORKSHOP_SCHEMA_VERSION = 1 as const;
export const WORKSHOP_MAX_OBJECTS = 256;

export type WorkshopAnchor = 'floor' | 'free' | 'wall';
export type WorkshopCollisionMode = 'none' | 'solid';
export type WorkshopEventMode = 'none' | 'announce' | 'message' | 'toggle-glow' | 'toggle-tint';
export type WorkshopWorldId = 'exterior' | 'interior' | 'shared';
export type WorkshopVec3 = [number, number, number];

export interface WorkshopSceneOverride {
  readonly id: string;
  readonly position: WorkshopVec3;
  readonly rotation: WorkshopVec3;
  readonly scale: WorkshopVec3;
}

export interface WorkshopSurfaceOverride {
  readonly id: string;
  readonly worldId: 'exterior' | 'interior';
  readonly color?: string;
  readonly texture?: string;
}

export interface WorkshopPlacementRecord {
  readonly id: string;
  readonly label: string;
  readonly prefab: WorkshopPrefabId;
  readonly anchor: WorkshopAnchor;
  readonly position: WorkshopVec3;
  readonly rotation: WorkshopVec3;
  readonly scale: WorkshopVec3;
  /** Individual paint. Materials are not shared with unrelated objects. */
  readonly color?: string;
  readonly assetId?: string;
  readonly texture?: string;
  /** Content-addressed, locally bundled image. */
  readonly image?: string;
  /** Wall fixture thickness in metres. */
  readonly depth?: number;
  readonly collision?: WorkshopCollisionMode;
  readonly event?: WorkshopEventMode;
  /** Bounded, literal HUD copy; never executable code or interpreted as markup. */
  readonly eventMessage?: string;
  /** Six-digit target tint/emissive color for visual reactions. */
  readonly eventColor?: string;
  readonly worldId?: WorkshopWorldId;
  /** Apertures only exist in authored partition walls; static museum walls stay protected. */
  readonly opening?: Exclude<WallOpeningKind, 'none'>;
  readonly openingWidth?: number;
  readonly openingHeight?: number;
  readonly openingSill?: number;
}

export interface WorkshopPlacementManifest {
  readonly schemaVersion: typeof WORKSHOP_SCHEMA_VERSION;
  readonly objects: readonly WorkshopPlacementRecord[];
  /** Existing-scene dressing transforms. Optional for schema-version-1 files. */
  readonly sceneOverrides?: readonly WorkshopSceneOverride[];
  readonly surfaceOverrides?: readonly WorkshopSurfaceOverride[];
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
  surfaceOverrides: [],
};

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const POSITION_LIMITS: readonly [number, number, number] = [500, 150, 500];
const SCALE_MIN = 0.05;
const SCALE_MAX = 100;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const WORKSHOP_IMAGE = /^workshop-media\/[0-9a-f]{64}\.webp$/;

const SURFACE_PATH = /^(?:exterior|interior):(?:[0-9]{1,5}\/){0,12}[0-9]{1,5}$/;

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
  if (anchor !== 'floor' && anchor !== 'free' && anchor !== 'wall') {
    errors.push(`objects[${index}].anchor must be "floor", "free", or "wall"`);
  }

  const color = value.color === undefined ? undefined : typeof value.color === 'string' && COLOR.test(value.color) ? value.color.toLowerCase() : null;
  const assetId = value.assetId === undefined ? undefined : builderModelAllowed(value.assetId) ? value.assetId : null;
  const texture = value.texture === undefined ? undefined : builderFinishAllowed(value.texture) ? value.texture : null;
  const image = value.image === undefined ? undefined : typeof value.image === 'string' && WORKSHOP_IMAGE.test(value.image) ? value.image : null;
  const depth = value.depth === undefined ? undefined : typeof value.depth === 'number' && Number.isFinite(value.depth) && value.depth >= 0.01 && value.depth <= 2 ? value.depth : null;
  const collision = value.collision === undefined ? undefined : value.collision === 'none' || value.collision === 'solid' ? value.collision : null;
  const event = value.event === undefined ? undefined
    : value.event === 'none' || value.event === 'announce' || value.event === 'message'
      || value.event === 'toggle-glow' || value.event === 'toggle-tint' ? value.event : null;
  const eventMessage = value.eventMessage === undefined ? undefined
    : typeof value.eventMessage === 'string' && value.eventMessage.trim().length > 0
      && value.eventMessage.trim().length <= 160 ? value.eventMessage.trim() : null;
  const eventColor = value.eventColor === undefined ? undefined
    : typeof value.eventColor === 'string' && COLOR.test(value.eventColor)
      ? value.eventColor.toLowerCase() : null;
  const worldId = value.worldId === undefined ? undefined
    : value.worldId === 'exterior' || value.worldId === 'interior' || value.worldId === 'shared' ? value.worldId : null;
  if (color === null) errors.push(`objects[${index}].color must be a six-digit hex color`);
  if (assetId === null) errors.push('Invalid locally registered model asset');
  if (texture === null) errors.push('Invalid local finish');
  if (prefab === 'catalog-model' && !assetId) errors.push('Catalog model requires an assetId');
  if (assetId && prefab !== 'catalog-model') errors.push('assetId requires catalog-model prefab');
  if (image === null) errors.push(`objects[${index}].image must be a locally stored WebP`);
  if (depth === null) errors.push(`objects[${index}].depth must be between 0.01 and 2 metres`);
  if (collision === null) errors.push(`objects[${index}].collision is invalid`);
  if (event === null) errors.push(`objects[${index}].event is invalid`);
  if (eventMessage === null) errors.push('Event message must be 1–160 characters');
  if (eventColor === null) errors.push('Event reaction color must be a six-digit hex color');
  if (event === 'message' && !eventMessage) errors.push('Message event requires authored text');
  if (eventMessage && (!event || event === 'none' || event === 'announce')) {
    errors.push('Event message requires message or visual reaction mode');
  }
  if (eventColor && event !== 'toggle-glow' && event !== 'toggle-tint') {
    errors.push('Event color requires a visual reaction mode');
  }
  if (worldId === null) errors.push(`objects[${index}].worldId is invalid`);
  if (image && prefab !== 'wall-art') errors.push(`objects[${index}].image requires a wall-art prefab`);
  if (anchor === 'wall' && prefab !== 'wall-art' && prefab !== 'wall-panel') errors.push(`objects[${index}].wall anchor requires wall-art or wall-panel`);
  const opening = value.opening === undefined ? undefined
    : value.opening === 'door' || value.opening === 'window' ? value.opening : null;
  const fraction = (value: unknown): number | undefined | null =>
    value === undefined ? undefined
      : typeof value === 'number' && Number.isFinite(value) ? value : null;
  const openingWidth = fraction(value.openingWidth);
  const openingHeight = fraction(value.openingHeight);
  const openingSill = fraction(value.openingSill);
  if (opening === null) errors.push('Invalid wall opening kind');
  if (opening && prefab !== 'partition-wall') errors.push('Wall openings require a partition-wall');
  if (!opening && [openingWidth, openingHeight, openingSill].some((v) => v !== undefined)) {
    errors.push('Wall opening dimensions require an authored door or window');
  }
  if ([openingWidth, openingHeight, openingSill].some((v) => v === null)) {
    errors.push('Wall opening fractions must be finite numbers');
  }
  if (opening) {
    const fallback = defaultOpening(opening);
    try {
      wallOpeningSegments(opening, {
        width: openingWidth ?? fallback.width,
        height: openingHeight ?? fallback.height,
        sill: openingSill ?? fallback.sill,
      });
    } catch {
      errors.push('Door/window opening has invalid width, height or sill');
    }
  }
  const position = finiteVec3(value.position);
  const rotation = finiteVec3(value.rotation);
  const scale = finiteVec3(value.scale);
  if (!position) errors.push(`objects[${index}].position must be three finite numbers`);
  if (!rotation) errors.push(`objects[${index}].rotation must be three finite numbers`);
  if ((prefab === 'floor-slab' || prefab === 'partition-wall') && rotation
    && (Math.abs(rotation[0]) > 0.0001 || Math.abs(rotation[2]) > 0.0001)) {
    errors.push(`objects[${index}].${prefab} must remain level (rotate around Y only)`);
  }
  if (!scale) errors.push(`objects[${index}].scale must be three finite numbers`);

  if (position) {
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(position[axis]) > POSITION_LIMITS[axis]) {
        errors.push(`objects[${index}].position[${axis}] exceeds the Workshop world bounds`);
      }
    }
  }

  if (opening === 'door' && scale) {
    const defaults = defaultOpening('door');
    if (scale[0] * (openingWidth ?? defaults.width) < 1
      || scale[1] * 3 * (openingHeight ?? defaults.height) < 2) {
      errors.push('Doorway clearance must be at least 1 m wide and 2 m tall');
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
    || (anchor !== 'floor' && anchor !== 'free' && anchor !== 'wall')
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
    ...(color ? { color } : {}),
    ...(assetId ? { assetId } : {}),
    ...(texture && texture !== 'none' ? { texture } : {}),
    ...(image ? { image } : {}),
    ...(depth === undefined || depth === null ? {} : { depth }),
    ...(collision ? { collision: collision as WorkshopCollisionMode } : {}),
    ...(event ? { event: event as WorkshopEventMode } : {}),
    ...(eventMessage ? { eventMessage } : {}),
    ...(eventColor ? { eventColor } : {}),
    ...(worldId ? { worldId: worldId as WorkshopWorldId } : {}),
    ...(opening ? { opening } : {}),
    ...(openingWidth === undefined || openingWidth === null ? {} : { openingWidth }),
    ...(openingHeight === undefined || openingHeight === null ? {} : { openingHeight }),
    ...(openingSill === undefined || openingSill === null ? {} : { openingSill }),

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

function validateSurfaceOverride(value: unknown, index: number, errors: string[]): WorkshopSurfaceOverride | null {
  if (!isRecord(value)) { errors.push('surfaceOverrides must contain objects'); return null; }
  const id = typeof value.id === 'string' ? value.id : '';
  const worldId = value.worldId;
  const color = value.color === undefined ? undefined
    : typeof value.color === 'string' && COLOR.test(value.color) ? value.color.toLowerCase() : null;
  const texture = value.texture === undefined ? undefined
    : builderFinishAllowed(value.texture) ? value.texture : null;
  if (!SURFACE_PATH.test(id)) errors.push('surfaceOverrides[' + index + ']: unsafe scene-mesh path');
  if (worldId !== 'exterior' && worldId !== 'interior') errors.push('Invalid surface world');
  if (color === null || texture === null) errors.push('Invalid surface paint or finish');
  if (!color && (!texture || texture === 'none')) errors.push('Surface override must have paint or texture');
  if (!SURFACE_PATH.test(id) || (worldId !== 'exterior' && worldId !== 'interior')
    || color === null || texture === null) return null;
  return { id, worldId, ...(color ? { color } : {}),
    ...(texture && texture !== 'none' ? { texture } : {}) };
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
  const rawSurfaceOverrides = value.surfaceOverrides === undefined ? [] : value.surfaceOverrides;
  if (!Array.isArray(rawSurfaceOverrides)) errors.push('surfaceOverrides must be an array when present');
  if (!Array.isArray(rawSceneOverrides)) {
    errors.push('sceneOverrides must be an array when present');
  }
  if (value.objects.length > WORKSHOP_MAX_OBJECTS) {
    errors.push(`objects may contain at most ${WORKSHOP_MAX_OBJECTS} records`);
  }

  const objects: WorkshopPlacementRecord[] = [];
  const sceneOverrides: WorkshopSceneOverride[] = [];
  const surfaceOverrides: WorkshopSurfaceOverride[] = [];
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

  if (Array.isArray(rawSurfaceOverrides)) {
    if (rawSurfaceOverrides.length > 512) errors.push('At most 512 surface finishes');
    const surfaceIds = new Set<string>();
    for (let index = 0; index < rawSurfaceOverrides.length; index++) {
      const parsed = validateSurfaceOverride(rawSurfaceOverrides[index], index, errors);
      if (!parsed) continue;
      if (surfaceIds.has(parsed.id)) { errors.push('Duplicate surface finish id'); continue; }
      surfaceIds.add(parsed.id);
      surfaceOverrides.push(parsed);
    }
  }

  if (errors.length) return { ok: false, value: null, errors };
  return {
    ok: true,
    value: canonicalizeWorkshopManifest({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects, sceneOverrides, surfaceOverrides }),
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
        ...(record.color ? { color: record.color.toLowerCase() } : {}),
        ...(record.assetId ? { assetId: record.assetId } : {}),
        ...(record.texture ? { texture: record.texture } : {}),
        ...(record.image ? { image: record.image } : {}),
        ...(record.depth === undefined ? {} : { depth: roundNumber(record.depth) }),
        ...(record.collision ? { collision: record.collision } : {}),
        ...(record.event ? { event: record.event } : {}),
        ...(record.eventMessage ? { eventMessage: record.eventMessage.trim() } : {}),
        ...(record.eventColor ? { eventColor: record.eventColor.toLowerCase() } : {}),
        ...(record.worldId ? { worldId: record.worldId } : {}),
        ...(record.opening ? { opening: record.opening } : {}),
        ...(record.openingWidth === undefined ? {} : { openingWidth: roundNumber(record.openingWidth) }),
        ...(record.openingHeight === undefined ? {} : { openingHeight: roundNumber(record.openingHeight) }),
        ...(record.openingSill === undefined ? {} : { openingSill: roundNumber(record.openingSill) }),

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
    surfaceOverrides: [...(manifest.surfaceOverrides ?? [])]
      .map((override) => ({
        id: override.id,
        worldId: override.worldId,
        ...(override.color ? { color: override.color.toLowerCase() } : {}),
        ...(override.texture ? { texture: override.texture } : {}),
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
