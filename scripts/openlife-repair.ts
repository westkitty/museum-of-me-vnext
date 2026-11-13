/**
 * Deterministic repair of the pinned OpenLife (Life_Sim) Builder models.
 *
 * The source generator builds round parts (cylinders, cones, discs, capsules)
 * with their axis along Z instead of Y, so legs, poles, trunks and cushions
 * lie on their side or float. The generator's cylinders are centred on their
 * position and its cones start at their base. This module stands every such
 * part upright with a quarter turn about X: a cylinder about its centre, a
 * cone about the centre of its base, narrow end up. Vertex data is untouched: only node
 * transforms in the glTF JSON chunk change, plus any per-model fixes below.
 *
 * Pure function of the source bytes; runs in Node and in the browser.
 */

type Vec3 = readonly [number, number, number];

/**
 * Fit a part (or a copy of one) to an exact world box. `turn` first orients
 * its own geometry: none, 'up' (its Z axis becomes Y) or 'x' (its Z axis
 * becomes X). It is then scaled per axis and moved to fill [min, max].
 */
export interface OpenLifePlacement { readonly turn?: 'up' | 'x'; readonly min: Vec3; readonly max: Vec3 }

export interface OpenLifeRepairPlan {
  /** Why this model needs per-part changes; recorded for review. */
  readonly why?: string;
  /** Round parts that are meant to face along Z (a clock face, a drum head). */
  readonly keep?: readonly string[];
  /** Parts to move, in metres, after any upright turn. */
  readonly move?: Readonly<Record<string, Vec3>>;
  /** Parts to fit to a new box instead of the automatic turn. */
  readonly place?: Readonly<Record<string, OpenLifePlacement>>;
  /** New parts that reuse an existing part's mesh: { name: { of, ...placement } }. */
  readonly copies?: Readonly<Record<string, OpenLifePlacement & { readonly of: string }>>;
  /** Parts to remove because they are sealed inside another part and never visible. */
  readonly remove?: readonly string[];
  /** Parts that hover by design, with the reason; the defect lint accepts them. */
  readonly floating?: Readonly<Record<string, string>>;
}

interface GltfJson {
  nodes: { name?: string; mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { bufferView?: number; byteOffset?: number; count: number; min?: number[]; max?: number[] }[];
  bufferViews: { byteOffset?: number }[];
  scenes: { nodes: number[] }[];
}

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

function parseGlb(bytes: Uint8Array): { json: GltfJson; jsonLength: number; rest: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(16, true) !== JSON_CHUNK) throw new Error('not a GLB with a leading JSON chunk');
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as GltfJson;
  return { json, jsonLength, rest: bytes.subarray(20 + jsonLength) };
}

function binChunk(rest: Uint8Array): Uint8Array {
  const view = new DataView(rest.buffer, rest.byteOffset, rest.byteLength);
  return rest.subarray(8, 8 + view.getUint32(0, true));
}

function positions(json: GltfJson, bin: Uint8Array, mesh: number): Float32Array[] {
  return json.meshes[mesh].primitives.map((primitive) => {
    const accessor = json.accessors[primitive.attributes.POSITION];
    const view = json.bufferViews[accessor.bufferView ?? 0];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const copy = bin.slice(offset, offset + accessor.count * 12);
    return new Float32Array(copy.buffer, copy.byteOffset, accessor.count * 3);
  });
}

interface PartShape {
  round: boolean;
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  /** A cone's narrow end; null for a part that is the same width at both ends. */
  narrowEnd: 'min' | 'max' | null;
  /** Z of the part's base: its wide end for a cone, its middle otherwise. */
  anchorZ: number;
}

/**
 * Rotationally symmetric about a Z-parallel axis: equal X and Y extents,
 * vertices spread over many angles around the axis, and few distinct
 * (height, radius) rings relative to the vertex count.
 */
export function partShape(data: readonly Float32Array[]): PartShape {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const array of data) for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], array[i + k]);
    max[k] = Math.max(max[k], array[i + k]);
  }
  const center: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const rx = (max[0] - min[0]) / 2;
  const ry = (max[1] - min[1]) / 2;
  const length = max[2] - min[2];
  const radius = Math.max(rx, ry, 1e-6);
  const box = { min: min as [number, number, number], max: max as [number, number, number] };
  const flat = { ...box, round: false, center, narrowEnd: null, anchorZ: center[2] } as const;
  // Polygonal prisms are narrower across their flats: a hexagon by cos 30°.
  if (Math.abs(rx - ry) > 0.15 * radius) return flat;
  const angles = new Set<number>();
  const rings = new Set<string>();
  let count = 0;
  let nearMin = 0;
  let nearMax = 0;
  for (const array of data) for (let i = 0; i < array.length; i += 3) {
    const dx = array[i] - center[0];
    const dy = array[i + 1] - center[1];
    const r = Math.hypot(dx, dy);
    if (r > 0.02 * radius) angles.add(Math.round(Math.atan2(dy, dx) * 12));
    rings.add(`${Math.round((array[i + 2] - min[2]) / Math.max(length, 1e-6) * 40)}:${Math.round(r / radius * 40)}`);
    count++;
    if (array[i + 2] - min[2] < 0.05 * length) nearMin = Math.max(nearMin, r);
    if (max[2] - array[i + 2] < 0.05 * length) nearMax = Math.max(nearMax, r);
  }
  const round = angles.size >= 6 && rings.size <= Math.max(4, count / 5);
  const narrowEnd = nearMax < nearMin * 0.8 ? 'max' : nearMin < nearMax * 0.8 ? 'min' : null;
  // Source cones start at their base (trimesh convention); cylinders are centred.
  const anchorZ = narrowEnd === 'max' ? min[2] : narrowEnd === 'min' ? max[2] : center[2];
  return { ...box, round, center, narrowEnd, anchorZ };
}

/** Quaternion (x, y, z, w) for a quarter turn about X; +1 sends +Z to -Y, -1 sends +Z to +Y. */
const quarterTurnX = (sign: 1 | -1): [number, number, number, number] => [sign * Math.SQRT1_2, 0, 0, Math.SQRT1_2];

/** Rotates p about X by a quarter turn with the given sign. */
const turn = (sign: 1 | -1, [x, y, z]: readonly number[]): [number, number, number] => (sign === 1 ? [x, -z, y] : [x, z, -y]);

export interface OpenLifeRepairResult {
  readonly bytes: Uint8Array;
  readonly upright: string[];
  readonly removed: string[];
  readonly moved: string[];
  readonly placed: string[];
  readonly copied: string[];
}

const QUARTER = Math.SQRT1_2;
const TURNS = {
  // +Z becomes +Y: (x, y, z) -> (x, z, -y)
  up: { quaternion: [-QUARTER, 0, 0, QUARTER], apply: ([x, y, z]: Vec3): Vec3 => [x, z, -y], axis: [0, 2, 1] },
  // +Z becomes +X: (x, y, z) -> (z, y, -x)
  x: { quaternion: [0, QUARTER, 0, QUARTER], apply: ([x, y, z]: Vec3): Vec3 => [z, y, -x], axis: [2, 1, 0] },
  none: { quaternion: null, apply: (p: Vec3): Vec3 => p, axis: [0, 1, 2] },
} as const;

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** Node transform that maps a part's local box onto the target world box. */
function fit(shape: PartShape, placement: OpenLifePlacement) {
  const turnSpec = TURNS[placement.turn ?? 'none'];
  // turnSpec.axis[k] is the world axis that local axis k ends up along.
  const scale = [0, 1, 2].map((k) => {
    const world = turnSpec.axis[k];
    const local = shape.max[k] - shape.min[k];
    return local > 1e-9 ? (placement.max[world] - placement.min[world]) / local : 1;
  });
  let low: [number, number, number] = [Infinity, Infinity, Infinity];
  for (let corner = 0; corner < 8; corner++) {
    const p: Vec3 = [0, 1, 2].map((k) => ((corner >> k) & 1 ? shape.max[k] : shape.min[k]) * scale[k]) as unknown as Vec3;
    const q = turnSpec.apply(p);
    low = low.map((value, k) => Math.min(value, q[k])) as [number, number, number];
  }
  return {
    translation: placement.min.map((value, k) => round6(value - low[k])),
    rotation: turnSpec.quaternion ? [...turnSpec.quaternion] : undefined,
    scale: scale.every((value) => value === 1) ? undefined : scale.map(round6),
  };
}

export function repairOpenLifeGlb(source: Uint8Array, plan: OpenLifeRepairPlan = {}): OpenLifeRepairResult {
  const { json, rest } = parseGlb(source);
  const bin = binChunk(rest);
  const result = { upright: [] as string[], moved: [] as string[], removed: [] as string[], placed: [] as string[], copied: [] as string[] };
  const keep = new Set(plan.keep ?? []);
  const remove = new Set(plan.remove ?? []);
  const named = (name: string) => {
    const index = json.nodes.findIndex((node) => node.name === name);
    if (index < 0 || json.nodes[index].mesh === undefined) throw new Error(`repair plan names unknown part ${name}`);
    return index;
  };
  for (const name of [...keep, ...remove, ...Object.keys(plan.move ?? {}), ...Object.keys(plan.place ?? {}),
    ...Object.values(plan.copies ?? {}).map((copy) => copy.of), ...Object.keys(plan.floating ?? {})]) named(name);

  const shapes = new Map<number, PartShape>();
  const shapeOf = (mesh: number) => {
    if (!shapes.has(mesh)) shapes.set(mesh, partShape(positions(json, bin, mesh)));
    return shapes.get(mesh)!;
  };
  const sourceCount = json.nodes.length;
  for (let index = 0; index < sourceCount; index++) {
    const node = json.nodes[index];
    if (node.mesh === undefined) continue;
    const name = node.name ?? `node-${index}`;
    if (node.translation || node.rotation || node.scale) throw new Error(`${name} already has a transform`);
    const shape = shapeOf(node.mesh);
    let translation: [number, number, number] = [0, 0, 0];
    const placement = plan.place?.[name];
    if (placement) {
      const t = fit(shape, placement);
      translation = t.translation as [number, number, number];
      if (t.rotation) node.rotation = t.rotation;
      if (t.scale) node.scale = t.scale;
      result.placed.push(name);
    } else if (shape.round && !keep.has(name)) {
      // Narrow end up: with sign -1, +Z maps to +Y. Turn about the centre, then
      // put the axis at the part's base Z (a cone's base, a cylinder's middle).
      const sign: 1 | -1 = shape.narrowEnd === 'max' ? -1 : 1;
      const turned = turn(sign, shape.center);
      translation = [shape.center[0] - turned[0], shape.center[1] - turned[1], shape.anchorZ - turned[2]];
      node.rotation = quarterTurnX(sign);
      result.upright.push(name);
    }
    const offset = plan.move?.[name];
    if (offset) {
      translation = [translation[0] + offset[0], translation[1] + offset[1], translation[2] + offset[2]];
      result.moved.push(name);
    }
    if (translation.some((value) => value !== 0)) node.translation = translation.map(round6);
  }

  for (const [name, copy] of Object.entries(plan.copies ?? {})) {
    if (json.nodes.some((node) => node.name === name)) throw new Error(`copy ${name} would duplicate an existing part name`);
    const ofIndex = named(copy.of);
    const t = fit(shapeOf(json.nodes[ofIndex].mesh!), copy);
    const index = json.nodes.push({ name, mesh: json.nodes[ofIndex].mesh, translation: t.translation,
      ...(t.rotation ? { rotation: t.rotation } : {}), ...(t.scale ? { scale: t.scale } : {}) }) - 1;
    const parent = json.nodes.find((node) => node.children?.includes(ofIndex));
    if (parent) parent.children!.push(index);
    else for (const scene of json.scenes) if (scene.nodes.includes(ofIndex)) scene.nodes.push(index);
    result.copied.push(name);
  }

  for (const [index, node] of json.nodes.entries()) {
    if (!remove.has(node.name ?? '')) continue;
    for (const scene of json.scenes) scene.nodes = scene.nodes.filter((n) => n !== index);
    for (const parent of json.nodes) if (parent.children) parent.children = parent.children.filter((n) => n !== index);
    result.removed.push(node.name!);
  }

  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const out = new Uint8Array(12 + 8 + jsonBytes.length + rest.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, JSON_CHUNK, true);
  out.set(jsonBytes, 20);
  out.set(rest, 20 + jsonBytes.length);
  return { bytes: out, ...result };
}
