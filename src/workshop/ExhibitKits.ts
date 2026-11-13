import * as THREE from 'three';
import type {
  WorkshopKit, WorkshopKitTemplateId, WorkshopPlacementManifest, WorkshopPlacementRecord, WorkshopVec3,
} from './schema';

/** A slot's default transform relative to the kit origin, and the record it creates. */
export interface KitSlot {
  readonly slot: string;
  readonly label: string;
  readonly record: Pick<WorkshopPlacementRecord, 'prefab' | 'anchor'> & Partial<Pick<WorkshopPlacementRecord, 'assetId' | 'collision' | 'color'>>;
  readonly position: WorkshopVec3;
  readonly rotation: WorkshopVec3;
  readonly scale: WorkshopVec3;
}

export interface KitTemplate {
  readonly id: WorkshopKitTemplateId;
  readonly label: string;
  readonly description: string;
  readonly slots: readonly KitSlot[];
}

const model = (assetId: string) => ({ prefab: 'catalog-model' as const, anchor: 'floor' as const, assetId, collision: 'solid' as const });
const ONE: WorkshopVec3 = [1, 1, 1];

/**
 * Arrangements built only from the bundled, licensed Builder library, in its
 * shared light-wood palette. Every part stands on the floor except the
 * computer: `openlife:computer_basic` is modelled with its base at desk height
 * (0.73 m), so it belongs on the `openlife:desk_basic` top (0.71–0.77 m) and
 * floats if stood on the floor beside it. `openlife:bookshelf_basic` is not
 * used: its solid outer box encloses its shelves and books, so it renders as a
 * blank slab; the drawer chest (`openlife:dresser_basic`) stands in as the
 * archive and chart storage. `openlife:dining_chair` is not used: its legs are
 * modelled as horizontal bars 0.19 m above the floor, so the seat hovers; the
 * park bench (seat 0.41–0.49 m on vertical legs, as wide as the desk) is the
 * library's only grounded upright seat. `openlife:telescope_basic` is not used
 * (owner decision, 2026-11-13): its tube does not touch its posts and its drum
 * floats above the tube, so the observatory shows a star chart on an easel.
 */
export const KIT_TEMPLATES: Readonly<Record<WorkshopKitTemplateId, KitTemplate>> = {
  'archive-research-station': {
    id: 'archive-research-station', label: 'Archive Research Station',
    description: 'A reading desk and bench before two archive drawer chests, with a table for laid-out documents.',
    slots: [
      { slot: 'desk', label: 'Research desk', record: model('openlife:desk_basic'), position: [0, 0, 0], rotation: [0, 0, 0], scale: ONE },
      { slot: 'chair', label: 'Reading bench', record: model('openlife:park_bench'), position: [0, 0, 0.75], rotation: [0, Math.PI, 0], scale: ONE },
      { slot: 'shelf-left', label: 'Archive drawers', record: model('openlife:dresser_basic'), position: [-0.7, 0, -1.3], rotation: [0, 0, 0], scale: ONE },
      { slot: 'shelf-right', label: 'Archive drawers', record: model('openlife:dresser_basic'), position: [0.7, 0, -1.3], rotation: [0, 0, 0], scale: ONE },
      { slot: 'document-table', label: 'Document table', record: model('openlife:dining_table'), position: [1.95, 0, 0.2], rotation: [0, -Math.PI / 2, 0], scale: ONE },
    ],
  },
  'observatory-workstation': {
    id: 'observatory-workstation', label: 'Observatory Workstation',
    description: 'An observing desk with a logging computer and bench, a star chart on an easel, and a chest of charts.',
    slots: [
      { slot: 'chart-easel', label: 'Star chart easel', record: model('openlife:easel_basic'), position: [-1.5, 0, 0.1], rotation: [0, 0.3, 0], scale: ONE },
      { slot: 'desk', label: 'Observing desk', record: model('openlife:desk_basic'), position: [0.4, 0, 0], rotation: [0, 0, 0], scale: ONE },
      { slot: 'chair', label: 'Observer bench', record: model('openlife:park_bench'), position: [0.4, 0, 0.75], rotation: [0, Math.PI, 0], scale: ONE },
      // On the desk top. The model's screen is on its +z side, so a half turn puts the screen at the back and the keyboard toward the chair.
      { slot: 'computer', label: 'Logging computer', record: model('openlife:computer_basic'), position: [0.75, 0, -0.1], rotation: [0, Math.PI, 0], scale: ONE },
      { slot: 'chart-shelf', label: 'Star chart chest', record: model('openlife:dresser_basic'), position: [0.4, 0, -1.3], rotation: [0, 0, 0], scale: ONE },
    ],
  },
};

const EPS_POSITION = 1e-3;
const EPS_ANGLE = 1e-3;

function originMatrix(kit: Pick<WorkshopKit, 'position' | 'rotationY'>): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...kit.position),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), kit.rotationY), new THREE.Vector3(1, 1, 1));
}

function recordMatrix(transform: { position: WorkshopVec3; rotation: WorkshopVec3; scale: WorkshopVec3 }): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...transform.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...transform.rotation)), new THREE.Vector3(...transform.scale));
}

function decompose(matrix: THREE.Matrix4): { position: WorkshopVec3; rotation: WorkshopVec3; scale: WorkshopVec3 } {
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  return { position: [position.x, position.y, position.z], rotation: [euler.x, euler.y, euler.z], scale: [scale.x, scale.y, scale.z] };
}

/** World transform of a child given the kit origin and a local transform. */
export function kitWorldTransform(kit: Pick<WorkshopKit, 'position' | 'rotationY'>,
  local: { position: WorkshopVec3; rotation: WorkshopVec3; scale: WorkshopVec3 }) {
  return decompose(originMatrix(kit).multiply(recordMatrix(local)));
}

/** Local transform of a member record relative to the kit origin. */
export function kitLocalTransform(kit: Pick<WorkshopKit, 'position' | 'rotationY'>, record: Pick<WorkshopPlacementRecord, 'position' | 'rotation' | 'scale'>) {
  return decompose(originMatrix(kit).invert().multiply(recordMatrix(record)));
}

export const kitOf = (manifest: WorkshopPlacementManifest, recordId: string): WorkshopKit | null =>
  manifest.kits?.find((kit) => kit.members.some((member) => member.id === recordId)) ?? null;

function unusedId(taken: ReadonlySet<string>, base: string): string {
  const stem = base.slice(0, 56);
  if (!taken.has(stem)) return stem;
  for (let n = 2; ; n++) if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
}

const takenIds = (manifest: WorkshopPlacementManifest) => new Set([...manifest.objects.map((record) => record.id),
  ...(manifest.kits ?? []).map((kit) => kit.id)]);

/** Add a kit from a template: one new record per slot, all owned by the new kit. */
export function placeKit(manifest: WorkshopPlacementManifest, templateId: WorkshopKitTemplateId,
  at: { position: WorkshopVec3; rotationY: number; worldId: 'exterior' | 'interior'; id?: string }): { manifest: WorkshopPlacementManifest; kit: WorkshopKit } {
  const template = KIT_TEMPLATES[templateId];
  const taken = takenIds(manifest);
  const kitId = unusedId(taken, at.id ?? templateId);
  taken.add(kitId);
  const origin = { position: at.position, rotationY: at.rotationY };
  const records: WorkshopPlacementRecord[] = [];
  const members: { slot: string; id: string }[] = [];
  for (const slot of template.slots) {
    const id = unusedId(taken, `${kitId}-${slot.slot}`);
    taken.add(id);
    records.push({ id, label: slot.label, ...slot.record, ...kitWorldTransform(origin, slot), worldId: at.worldId });
    members.push({ slot: slot.slot, id });
  }
  const kit: WorkshopKit = { id: kitId, label: template.label, template: templateId, worldId: at.worldId,
    position: at.position, rotationY: at.rotationY, members };
  return { kit, manifest: { ...manifest, objects: [...manifest.objects, ...records], kits: [...(manifest.kits ?? []), kit] } };
}

const requireKit = (manifest: WorkshopPlacementManifest, kitId: string): WorkshopKit => {
  const kit = manifest.kits?.find((item) => item.id === kitId);
  if (!kit) throw new Error(`Unknown kit ${kitId}`);
  return kit;
};

const replaceKit = (manifest: WorkshopPlacementManifest, kit: WorkshopKit): WorkshopPlacementManifest =>
  ({ ...manifest, kits: (manifest.kits ?? []).map((item) => (item.id === kit.id ? kit : item)) });

/** Move the kit origin; every member keeps its local transform, including overrides. */
export function moveKit(manifest: WorkshopPlacementManifest, kitId: string, to: { position: WorkshopVec3; rotationY: number }): WorkshopPlacementManifest {
  const kit = requireKit(manifest, kitId);
  const ids = new Map(kit.members.map((member) => [member.id, member]));
  const objects = manifest.objects.map((record) => (ids.has(record.id)
    ? { ...record, ...kitWorldTransform(to, kitLocalTransform(kit, record)) } : record));
  return replaceKit({ ...manifest, objects }, { ...kit, position: to.position, rotationY: to.rotationY });
}


/** Members whose local transform differs from the template, and template slots that were removed. */
export function kitOverrides(manifest: WorkshopPlacementManifest, kitId: string) {
  const kit = requireKit(manifest, kitId);
  const template = KIT_TEMPLATES[kit.template];
  const overridden: string[] = [];
  for (const member of kit.members) {
    const slot = template.slots.find((item) => item.slot === member.slot);
    const record = manifest.objects.find((item) => item.id === member.id);
    if (!slot || !record) continue;
    const local = kitLocalTransform(kit, record);
    const sameQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...local.rotation))
      .angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(...slot.rotation))) < EPS_ANGLE;
    if (local.position.some((v, i) => Math.abs(v - slot.position[i]) > EPS_POSITION) || !sameQuat
      || local.scale.some((v, i) => Math.abs(v - slot.scale[i]) > EPS_POSITION)
      || (slot.record.assetId ?? null) !== (record.assetId ?? null) || record.prefab !== slot.record.prefab) overridden.push(member.slot);
  }
  const removed = template.slots.filter((slot) => !kit.members.some((member) => member.slot === slot.slot)).map((slot) => slot.slot);
  return { overridden, removed };
}

/** Restore a slot's template transform (re-creating it if it was removed); other members are untouched. */
export function resetKitSlot(manifest: WorkshopPlacementManifest, kitId: string, slotId: string): WorkshopPlacementManifest {
  const kit = requireKit(manifest, kitId);
  const slot = KIT_TEMPLATES[kit.template].slots.find((item) => item.slot === slotId);
  if (!slot) throw new Error(`Kit ${kitId} has no slot ${slotId}`);
  const world = kitWorldTransform(kit, slot);
  const member = kit.members.find((item) => item.slot === slotId);
  if (member) {
    return { ...manifest, objects: manifest.objects.map((record) => (record.id === member.id
      ? { ...record, ...slot.record, label: slot.label, ...world } : record)) };
  }
  const id = unusedId(takenIds(manifest), `${kit.id}-${slot.slot}`);
  return replaceKit({ ...manifest, objects: [...manifest.objects, { id, label: slot.label, ...slot.record, ...world, worldId: kit.worldId }] },
    { ...kit, members: [...kit.members, { slot: slot.slot, id }] });
}

/** Copy a kit, keeping each member's overrides and finishes, at a new origin. */
export function duplicateKit(manifest: WorkshopPlacementManifest, kitId: string, to: { position: WorkshopVec3; rotationY: number }): { manifest: WorkshopPlacementManifest; kit: WorkshopKit } {
  const kit = requireKit(manifest, kitId);
  const taken = takenIds(manifest);
  const copyId = unusedId(taken, `${kit.id}-copy`);
  taken.add(copyId);
  const records: WorkshopPlacementRecord[] = [];
  const members: { slot: string; id: string }[] = [];
  for (const member of kit.members) {
    const record = manifest.objects.find((item) => item.id === member.id);
    if (!record) continue;
    const id = unusedId(taken, `${copyId}-${member.slot}`);
    taken.add(id);
    records.push({ ...record, id, ...kitWorldTransform(to, kitLocalTransform(kit, record)) });
    members.push({ slot: member.slot, id });
  }
  const copy: WorkshopKit = { ...kit, id: copyId, position: to.position, rotationY: to.rotationY, members };
  return { kit: copy, manifest: { ...manifest, objects: [...manifest.objects, ...records], kits: [...(manifest.kits ?? []), copy] } };
}

/** Delete a kit. With `keepMembers`, its records stay as independent placements (ungroup). */
export function removeKit(manifest: WorkshopPlacementManifest, kitId: string, options: { keepMembers?: boolean } = {}): WorkshopPlacementManifest {
  const kit = requireKit(manifest, kitId);
  const memberIds = new Set(kit.members.map((member) => member.id));
  const kits = (manifest.kits ?? []).filter((item) => item.id !== kitId);
  if (options.keepMembers) return { ...manifest, kits };
  const locks = manifest.curator?.locks.filter((id) => !memberIds.has(id));
  return { ...manifest, kits, objects: manifest.objects.filter((record) => !memberIds.has(record.id)),
    ...(manifest.curator ? { curator: { ...manifest.curator, locks: locks ?? [],
      decisions: manifest.curator.decisions.filter((decision) => !memberIds.has(decision.objectId)) } } : {}) };
}

/**
 * Treat a direct edit of one member as a move of the whole kit: the new kit
 * origin keeps that member's local transform. Kits stand on the floor, so only
 * the yaw of the edit carries to the origin.
 */
export function kitFollowMember(manifest: WorkshopPlacementManifest, kitId: string, memberId: string,
  moved: { position: WorkshopVec3; rotation: WorkshopVec3; scale: WorkshopVec3 }): WorkshopPlacementManifest {
  const kit = requireKit(manifest, kitId);
  const record = manifest.objects.find((item) => item.id === memberId);
  if (!record || !kit.members.some((member) => member.id === memberId)) throw new Error(`${memberId} is not part of kit ${kitId}`);
  const local = kitLocalTransform(kit, record);
  const origin = recordMatrix(moved).multiply(recordMatrix(local).invert());
  const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  origin.decompose(position, quaternion, scale);
  const yaw = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ').y;
  return moveKit(manifest, kitId, { position: [position.x, position.y, position.z], rotationY: yaw });
}
