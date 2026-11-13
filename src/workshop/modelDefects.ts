import report from './catalog-data/builder-model-defects.json' with { type: 'json' };

/** Axis-aligned bounds of one mesh of a model, in the model's own frame (metres). */
export interface MeshBounds {
  readonly name: string;
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  /**
   * False when the mesh is not its own bounding box (a sphere, a cone, a roof
   * prism). Only a box-shaped part can hide another part entirely: a part
   * inside a sphere's bounds may still show through its curved surface.
   */
  readonly boxy?: boolean;
}

/** Parts closer than this are treated as touching. */
export const DEFECT_TOUCH = 0.03;
/** A part counts as sealed only if it sits at least this far inside another on every side. */
export const DEFECT_INSET = 0.005;

const gap = (a: MeshBounds, b: MeshBounds) => Math.max(
  a.min[0] - b.max[0], b.min[0] - a.max[0], a.min[1] - b.max[1], b.min[1] - a.max[1], a.min[2] - b.max[2], b.min[2] - a.max[2], 0);

const sealedIn = (inner: MeshBounds, outer: MeshBounds) => [0, 1, 2].every((axis) =>
  inner.min[axis] > outer.min[axis] + DEFECT_INSET && inner.max[axis] < outer.max[axis] - DEFECT_INSET);

/**
 * Visible defects a visitor would notice, judged from the real mesh bounds:
 * - a part that touches neither the model's base nor any part connected to it
 *   floats (a hovering chair seat, a detached telescope tube);
 * - a part hidden entirely inside a box-shaped part of the same model is
 *   sealed (books inside a bookcase's solid box).
 * Parts named in `floating` hover by design and are not reported.
 * The base is the model's lowest level, so desk-top models are not defects.
 */
export function findModelDefects(meshes: readonly MeshBounds[], options: { floating?: readonly string[] } = {}): string[] {
  if (!meshes.length) return ['has no meshes'];
  const defects: string[] = [];
  const base = Math.min(...meshes.map((mesh) => mesh.min[1]));
  const connected = new Set(meshes.filter((mesh) => mesh.min[1] <= base + DEFECT_TOUCH));
  for (let grew = true; grew;) {
    grew = false;
    for (const mesh of meshes) {
      if (!connected.has(mesh) && [...connected].some((other) => gap(mesh, other) <= DEFECT_TOUCH)) {
        connected.add(mesh);
        grew = true;
      }
    }
  }
  const intended = new Set(options.floating ?? []);
  for (const mesh of meshes) {
    if (!connected.has(mesh) && !intended.has(mesh.name)) defects.push(`part ${mesh.name} floats, detached from the rest of the model`);
  }
  for (const inner of meshes) for (const outer of meshes) {
    if (inner !== outer && outer.boxy !== false && sealedIn(inner, outer)) defects.push(`part ${inner.name} is hidden inside ${outer.name}`);
  }
  return defects;
}

const KNOWN: Readonly<Record<string, readonly string[]>> = report.defects;

/** Defects recorded for a bundled library model by `npm run lint:models`; empty when it passed. */
export function builderModelDefects(assetId: string): readonly string[] {
  return KNOWN[assetId] ?? [];
}
