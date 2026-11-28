import * as THREE from 'three';
import type { SourceVisitor } from '../content/sourceParity';

type Shape = 'box' | 'round' | 'head' | 'taper' | 'rod' | 'cap' | 'ring';
type Vec = readonly [number, number, number];
type Hair = 'swept' | 'crop' | 'bob' | 'bun' | 'part' | 'curls' | 'hood';
type Garment = 'tailored' | 'field' | 'cardigan' | 'uniform' | 'vest' | 'hoodie' | 'overshirt';
interface Style {
  garment: Garment;
  hair: Hair;
  shoulder: number;
  length: number;
  face: number;
  accent: number;
  glasses?: boolean;
  bag?: boolean;
  carry?: 'chest' | 'low';
}

// These are wardrobe choices for the existing roles. Dialogue, route, palette
// and prop identity still come from the curated source records.
const STYLES: Readonly<Record<string, Style>> = {
  'curator-archive': { garment: 'tailored', hair: 'bun', shoulder: 0.96, length: 1.07, face: 0.93, accent: 0xb19871, glasses: true },
  'visitor-katamari': { garment: 'field', hair: 'swept', shoulder: 1.12, length: 0.91, face: 1.03, accent: 0xcc9055, carry: 'chest' },
  'visitor-myth': { garment: 'cardigan', hair: 'bob', shoulder: 0.94, length: 1.18, face: 0.88, accent: 0xb48c92 },
  'visitor-local': { garment: 'hoodie', hair: 'part', shoulder: 1, length: 0.96, face: 0.92, accent: 0x839cba, glasses: true },
  'visitor-analyst': { garment: 'tailored', hair: 'crop', shoulder: 1.05, length: 1.04, face: 1.07, accent: 0xc5ad7b },
  'visitor-memory': { garment: 'overshirt', hair: 'swept', shoulder: 0.98, length: 1.17, face: 0.88, accent: 0x76b5aa, carry: 'low' },
  'visitor-access': { garment: 'cardigan', hair: 'bun', shoulder: 1.03, length: 1, face: 1.04, accent: 0xc59561, carry: 'low' },
  docent: { garment: 'tailored', hair: 'part', shoulder: 1.03, length: 1.11, face: 0.96, accent: 0xce9252 },
  guard: { garment: 'uniform', hair: 'crop', shoulder: 1.17, length: 0.97, face: 1.11, accent: 0x98a3ac, carry: 'chest' },
  conservator: { garment: 'vest', hair: 'bun', shoulder: 1.02, length: 0.93, face: 0.91, accent: 0xb38863, carry: 'low' },
  'student-a': { garment: 'cardigan', hair: 'curls', shoulder: 0.97, length: 0.95, face: 1.05, accent: 0xb592c8, bag: true },
  'student-b': { garment: 'hoodie', hair: 'crop', shoulder: 1.11, length: 1.03, face: 0.95, accent: 0x82b5bd, bag: true },
  sketcher: { garment: 'overshirt', hair: 'bob', shoulder: 1, length: 0.92, face: 1.04, accent: 0xccab72 },
  architect: { garment: 'tailored', hair: 'swept', shoulder: 1.13, length: 1.16, face: 0.88, accent: 0xbaabb6, glasses: true, carry: 'low' },
  pilgrim: { garment: 'field', hair: 'hood', shoulder: 1.07, length: 1.16, face: 0.95, accent: 0xd6a66f, carry: 'low' },
  'research-pair-a': { garment: 'vest', hair: 'part', shoulder: 0.97, length: 1.03, face: 0.93, accent: 0xac945d, glasses: true },
  'research-pair-b': { garment: 'field', hair: 'curls', shoulder: 1.04, length: 0.94, face: 1.08, accent: 0x74a5af, carry: 'chest' },
};

const DEFAULT_STYLE: Style = { garment: 'overshirt', hair: 'crop', shoulder: 1, length: 1, face: 1, accent: 0x999185 };
export function visitorStyle(id: string): Style {
  return STYLES[id] ?? DEFAULT_STYLE;
}

export function visitorColor(c: number[] | undefined, fallback: number): number {
  if (!c || c.length < 3) return fallback;
  return (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
}

type Piece = [Shape, number, Vec, Vec, Vec?];
const INK = 0x24282e;
const PAPER = 0xd9cfb5;

type TransformedPiece = { positions: Float32Array; normals: Float32Array };

function compose(
  templates: Record<Shape, THREE.BufferGeometry>,
  specs: readonly Piece[],
  transformed: Map<string, TransformedPiece>,
): THREE.BufferGeometry {
  let vertexCount = 0;
  let indexCount = 0;
  for (const [shape] of specs) {
    vertexCount += templates[shape].getAttribute('position').count;
    indexCount += templates[shape].getIndex()!.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  // Each kit contains only a handful of the fixed low-poly templates.
  const indices = new Uint16Array(indexCount);
  const color = new THREE.Color();
  const scaling = new THREE.Matrix4();
  const rotationX = new THREE.Matrix4();
  const rotationY = new THREE.Matrix4();
  const rotationZ = new THREE.Matrix4();
  const translation = new THREE.Matrix4();
  const transforms = [scaling, rotationX, rotationY, rotationZ, translation];
  const normalMatrix = new THREE.Matrix3();
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const [shape, hex, position, scale, rotation = [0, 0, 0]] of specs) {
    const template = templates[shape];
    const sourcePosition = template.getAttribute('position');
    const count = sourcePosition.count;
    const start = vertexOffset * 3;
    const end = start + count * 3;
    uvs.set(template.getAttribute('uv').array, vertexOffset * 2);

    // Wardrobes, faces and props repeat the same local transforms across
    // visitors. Reuse those position and normal slices within this build.
    const key = `${shape}:${position}:${scale}:${rotation}`;
    const cached = transformed.get(key);
    if (cached) {
      positions.set(cached.positions, start);
      normals.set(cached.normals, start);
    } else {
      positions.set(sourcePosition.array, start);
      normals.set(template.getAttribute('normal').array, start);
      const positionSlice = positions.subarray(start, end);
      const normalSlice = normals.subarray(start, end);
      const partPositions = new THREE.BufferAttribute(positionSlice, 3);
      const partNormals = new THREE.BufferAttribute(normalSlice, 3);
      // Keep the authored order and intermediate Float32 rounding.
      scaling.makeScale(...scale);
      rotationX.makeRotationX(rotation[0]);
      rotationY.makeRotationY(rotation[1]);
      rotationZ.makeRotationZ(rotation[2]);
      translation.makeTranslation(...position);
      for (const matrix of transforms) {
        partPositions.applyMatrix4(matrix);
        partNormals.applyNormalMatrix(normalMatrix.getNormalMatrix(matrix));
      }
      transformed.set(key, { positions: positionSlice, normals: normalSlice });
    }
    color.setHex(hex);
    for (let i = start; i < end; i += 3) color.toArray(colors, i);
    const sourceIndex = template.getIndex()!.array;
    for (let i = 0; i < sourceIndex.length; i++) indices[indexOffset++] = sourceIndex[i] + vertexOffset;
    vertexOffset += count;
  }
  return new THREE.BufferGeometry()
    .setIndex(new THREE.BufferAttribute(indices, 1))
    .setAttribute('position', new THREE.BufferAttribute(positions, 3))
    .setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    .setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    .setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function clothing(style: Style, coat: number, shirt: number): Piece[] {
  const { garment, accent } = style;
  const pieces: Piece[] = [
    ['taper', coat, [0, 0, 0], [0.83, 1, 0.62]],
    ['box', shirt, [0, 0.315, 0.583], [0.28, 0.34, 0.045]],
  ];
  if (garment === 'tailored' || garment === 'cardigan') {
    for (const side of [-1, 1]) {
      pieces.push(['box', accent, [side * 0.177, 0.245, 0.616], [0.105, 0.44, 0.06], [0, 0, -side * 0.34]]);
      pieces.push(['box', coat, [side * 0.32, -0.24, 0.44], [0.29, 0.073, 0.11]]);
    }
    pieces.push(['round', accent, [0.03, -0.26, 0.57], [0.06, 0.05, 0.05]]);
    if (garment === 'cardigan') pieces.push(['box', coat, [0, -0.422, 0.03], [1.26, 0.125, 1.16]]);
  } else if (garment === 'hoodie') {
    pieces.push(['round', accent, [0, 0.43, -0.26], [0.46, 0.25, 0.38]]);
    pieces.push(['box', accent, [0, -0.23, 0.53], [0.44, 0.20, 0.14]]);
    for (const side of [-1, 1]) pieces.push(['box', shirt, [side * 0.1, 0.14, 0.58], [0.027, 0.30, 0.036], [0, 0, side * 0.14]]);
  } else {
    const high = garment === 'uniform' || garment === 'vest';
    pieces.push(['box', accent, [0, -0.07, 0.55], [0.035, 0.68, 0.05]]);
    for (const side of [-1, 1]) {
      const x = side * 0.3;
      pieces.push(['box', coat, [x, high ? 0.10 : -0.22, 0.52], [0.28, 0.24, 0.12]]);
      pieces.push(['box', accent, [x, high ? 0.22 : -0.10, 0.58], [0.29, 0.065, 0.06]]);
    }
  }
  if (garment === 'uniform') {
    for (const side of [-1, 1]) pieces.push(['box', accent, [side * 0.53, 0.48, 0.02], [0.25, 0.06, 0.44]]);
  }
  if (style.bag) {
    pieces.push(['box', accent, [0.02, -0.05, -0.55], [0.9, 0.72, 0.42]]);
    for (const side of [-1, 1]) pieces.push(['box', INK, [side * 0.45, 0.08, 0.49], [0.17, 0.79, 0.13], [0, 0, side * 0.22]]);
  }
  return pieces;
}

function face(style: Style, skin: number): Piece[] {
  const pieces: Piece[] = [
    ['head', skin, [0, 0.05, -0.06], [0.94, 1, 0.88]],
    ['round', skin, [0, -0.31, 0.10], [0.73, 0.65, 0.66]],
    ['round', skin, [0, -0.07, 0.78], [0.17, 0.24, 0.23]],
    ['box', 0x563e38, [0, -0.40, 0.72], [0.33, 0.045, 0.047]],
    ['rod', skin, [0, -0.96, -0.07], [0.37, 0.73, 0.38]],
  ];
  for (const side of [-1, 1]) {
    pieces.push(['round', skin, [side * 0.90, -0.12, -0.04], [0.18, 0.31, 0.23]]);
    pieces.push(['box', 0x372b28, [side * 0.37, 0.28, 0.75], [0.34, 0.07, 0.08], [0, 0, side * 0.13]]);
    if (style.glasses) pieces.push(['ring', 0x584d43, [side * 0.38, 0.10, 0.82], [1.07, 0.78, 0.66]]);
  }
  if (style.glasses) pieces.push(['box', 0x584d43, [0, 0.13, 0.86], [0.31, 0.066, 0.06]]);
  return pieces;
}

function hair(style: Style, color: number, coat: number): Piece[] {
  const p: Piece[] = [['cap', color, [0, 0.05, -0.06], [1, 1.04, 0.96]]];
  switch (style.hair) {
    case 'crop': p[0][3] = [0.99, 1.04, 0.96]; break;
    case 'part':
    case 'swept':
      p.push(['round', color, [-0.29, 0.77, 0.48], [0.62, style.hair === 'part' ? 0.22 : 0.36, 0.43], [0, 0, 0.31]]);
      break;
    case 'bun':
      p.push(['round', color, [0, 0.48, -0.84], [0.45, 0.47, 0.41]]);
      break;
    case 'bob':
    case 'hood':
      for (const side of [-1, 1]) {
        p.push(['round', style.hair === 'hood' ? coat : color, [side * 0.72, -0.12, -0.24], [0.33, 0.89, 0.71], [0, 0, side * 0.17]]);
      }
      if (style.hair === 'hood') p.push(['cap', coat, [0, 0.19, -0.19], [1.13, 1.12, 0.94]]);
      break;
    case 'curls':
      p.push(['round', color, [-0.52, 0.68, 0.44], [0.42, 0.47, 0.48]]);
      p.push(['round', color, [0.18, 0.89, 0.35], [0.49, 0.40, 0.50]]);
      p.push(['round', color, [0.70, 0.57, 0.17], [0.35, 0.46, 0.48]]);
  }
  return p;
}

function prop(visitor: SourceVisitor, accent: number): Piece[] {
  switch (visitor.prop) {
    case 'camera':
      return [
        ['box', INK, [0, 0, 0], [0.18, 0.118, 0.062]],
        ['rod', 0x565b61, [0, -0.012, 0.048], [0.053, 0.07, 0.053], [Math.PI / 2, 0, 0]],
        ['rod', 0x79aab3, [0, -0.012, 0.085], [0.038, 0.006, 0.038], [Math.PI / 2, 0, 0]],
        ['box', accent, [0.051, 0.062, 0], [0.065, 0.037, 0.055]],
      ];
    case 'radio':
      return [
        ['box', INK, [0, 0, 0], [0.085, 0.146, 0.048]],
        ['box', 0x9faab0, [0, -0.016, 0.027], [0.056, 0.054, 0.008]],
        ['rod', INK, [-0.027, 0.11, 0], [0.009, 0.116, 0.009]],
        ['box', 0x90af69, [0.019, 0.044, 0.027], [0.019, 0.012, 0.009]],
      ];
    case 'toolkit':
      return [
        ['box', INK, [0, -0.12, 0], [0.25, 0.17, 0.13]],
        ['box', accent, [0, -0.086, 0.069], [0.248, 0.025, 0.008]],
        ['ring', INK, [0, -0.028, 0], [0.24, 0.13, 0.20]],
        ['box', 0xc5bbaa, [0.064, -0.085, 0.074], [0.036, 0.039, 0.008]],
        ['box', 0xc5bbaa, [-0.064, -0.085, 0.074], [0.036, 0.039, 0.008]],
      ];
    case 'lantern': {
      const warm = visitor.id === 'pilgrim';
      const radius = warm ? 0.083 : 0.062;
      const metal = warm ? 0x936541 : 0x425e61;
      const parts: Piece[] = [
        [warm ? 'round' : 'box', accent, [0, -0.14, 0], [radius, 0.14, radius]],
        ['rod', metal, [0, -0.218, 0], [radius + 0.015, 0.027, radius + 0.015]],
        ['rod', metal, [0, -0.07, 0], [radius + 0.011, 0.030, radius + 0.011]],
        ['ring', metal, [0, -0.05, 0], [0.26, 0.20, 0.22]],
      ];
      for (const x of [-radius, radius]) {
        parts.push(['rod', metal, [x, -0.144, radius * 0.5], [0.0075, 0.15, 0.008]]);
      }
      return parts;
    }
    case 'cane':
      return [
        ['rod', 0x5e4738, [0, -0.382, 0], [0.015, 0.752, 0.015]],
        ['box', 0x9a7656, [0, 0, 0.025], [0.044, 0.034, 0.112]],
        ['rod', INK, [0, -0.749, 0], [0.021, 0.034, 0.021]],
      ];
    case 'tablet':
      return [
        ['box', INK, [0, 0, 0], [0.172, 0.228, 0.018]],
        ['box', accent, [0, 0.008, 0.011], [0.149, 0.184, 0.008]],
        ['box', 0xaeb6b8, [0, -0.096, 0.011], [0.023, 0.008, 0.005]],
      ];
    case 'laptop':
      return [
        ['box', 0x737f92, [0, 0, 0], [0.29, 0.026, 0.201]],
        ['box', INK, [0, 0.017, 0.006], [0.256, 0.010, 0.124]],
        ['box', INK, [0, 0.088, 0.085], [0.29, 0.178, 0.021], [0.26, 0, 0]],
        ['box', 0x86abbc, [0, 0.089, 0.072], [0.265, 0.153, 0.006], [0.26, 0, 0]],
      ];
    default: {
      const wide = visitor.prop === 'folio' || visitor.prop === 'file';
      const open = !!visitor.seated;
      const w = wide ? 0.27 : open ? 0.32 : 0.16;
      const h = wide ? 0.31 : 0.21;
      return [
        ['box', accent, [0, 0, 0], [w, h, 0.032]],
        ['box', PAPER, [0.006, 0.001, open ? 0.023 : 0], [w - 0.014, h - 0.018, 0.024]],
        ['box', INK, [-w * (open ? 0 : 0.48), 0.002, 0.032], [0.011, h * 0.95, 0.014]],
        ['box', visitor.prop === 'file' ? 0xc58365 : 0x8c775c, [w * 0.24, h * 0.43, 0.027], [0.037, 0.038, 0.017]],
      ];
    }
  }
}

/**
 * Builds the shared pieces first, then one visitor's four kit geometries per
 * step. Steps are pure CPU work on typed arrays (no GPU object exists until a
 * geometry is registered with a BatchedMesh), so a caller may pause between
 * them. The result is identical however the steps are paced.
 */
function* visitorGeometrySteps(visitors: readonly SourceVisitor[]): Generator<void, Record<string, THREE.BufferGeometry>> {
  const templates = {
    box: new THREE.BoxGeometry(1, 1, 1),
    round: new THREE.SphereGeometry(1, 7, 5),
    head: new THREE.SphereGeometry(1, 12, 8),
    taper: new THREE.CylinderGeometry(1, 0.80, 1, 10),
    rod: new THREE.CylinderGeometry(1, 1, 1, 7),
    cap: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.46),
    ring: new THREE.TorusGeometry(0.27, 0.046, 4, 10),
  };
  const transformed = new Map<string, TransformedPiece>();
  const geometries: Record<string, THREE.BufferGeometry> = {};
  let finished = false;
  try {
    // Bounds are computed here, inside the paced steps, so registering the
    // geometry with the BatchedMesh does not repeat that work synchronously.
    const plain = (pieces: Piece[]) => {
      const geometry = compose(templates, pieces, transformed);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return geometry;
    };
    const unit: Vec = [1, 1, 1];
    const origin: Vec = [0, 0, 0];
    Object.assign(geometries, {
      box: plain([['box', 0xffffff, origin, unit]]),
      pelvis: plain([['round', 0xffffff, origin, unit]]),
      round: plain([['round', 0xffffff, origin, unit]]),
      upperArm: plain([['taper', 0xffffff, origin, unit]]),
      lowerArm: plain([['taper', 0xffffff, origin, unit], ['rod', 0xc5c1b9, [0, -0.39, 0], [0.95, 0.18, 0.95]]]),
      upperLeg: plain([['taper', 0xffffff, origin, unit]]),
      lowerLeg: plain([['taper', 0xffffff, origin, unit]]),
      eye: plain([['round', 0xcbc0ad, origin, [1, 0.44, 0.29]], ['round', INK, [0, 0, 0.25], [0.43, 0.42, 0.29]]]),
      shoe: plain([['round', 0xffffff, [0, 0.12, 0.13], [0.49, 0.41, 0.52]], ['box', 0xa59b8b, [0, -0.37, 0.08], [0.95, 0.23, 0.99]]]),
      'sketcher-seat': plain([
        ['box', 0xffffff, [0, 0.065, 0], [0.31, 0.21, 0.24]],
        ['round', 0x886e55, [0, -0.038, -0.045], [0.235, 0.042, 0.205]],
        ['rod', 0x706357, [0, -0.335, -0.045], [0.033, 0.59, 0.033]],
        ['rod', 0x61574b, [0, -0.627, -0.045], [0.18, 0.046, 0.16]],
      ]),
    });
    yield;
    for (const visitor of visitors) {
      const style = visitorStyle(visitor.id);
      const coat = visitorColor(visitor.palette.coat, 0x4a5460);
      const shirt = visitorColor(visitor.palette.shirt, 0x746e62);
      const skin = visitorColor(visitor.palette.skin, 0xc4a07a);
      const hairColor = visitorColor(visitor.palette.hair, 0x2a2420);
      geometries[visitor.id + ':torso'] = plain(clothing(style, coat, shirt));
      geometries[visitor.id + ':head'] = plain(face(style, skin));
      geometries[visitor.id + ':hair'] = plain(hair(style, hairColor, coat));
      geometries[visitor.id + ':prop'] = plain(prop(visitor, style.accent));
      yield;
    }
    finished = true;
    return geometries;
  } finally {
    for (const geometry of Object.values(templates)) geometry.dispose();
    // Abandoned or failed: release the partial kit instead of leaking it.
    if (!finished) for (const geometry of Object.values(geometries)) geometry.dispose();
  }
}

/** Builds every visitor kit in one synchronous call. */
export function createVisitorGeometry(visitors: readonly SourceVisitor[]): Record<string, THREE.BufferGeometry> {
  const steps = visitorGeometrySteps(visitors);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/**
 * Builds the same kits as createVisitorGeometry, pausing between steps so the
 * caller can yield to the frame loop. Each step's synchronous duration is
 * reported to `onSlice`. The returned geometries are CPU-only until the
 * caller registers them; the caller owns and must dispose them.
 */
export async function prepareVisitorGeometry(
  visitors: readonly SourceVisitor[],
  checkpoint: () => Promise<void>,
  onSlice?: (ms: number) => void,
): Promise<Record<string, THREE.BufferGeometry>> {
  const steps = visitorGeometrySteps(visitors);
  try {
    for (;;) {
      const started = performance.now();
      const step = steps.next();
      onSlice?.(performance.now() - started);
      if (step.done) return step.value;
      await checkpoint();
    }
  } finally {
    // A rejected checkpoint leaves the generator suspended; return() runs its
    // cleanup, releasing the templates and any partial geometry.
    steps.return(undefined as never);
  }
}
