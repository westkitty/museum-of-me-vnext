import { PLAYER_HEIGHT } from '../player/PlayerController';
import type { Vec3 } from '../world/layout';
import { validateWorkshopManifestForMuseum } from './conservation';
import type { MuseumSceneIndex, SceneBounds } from './SceneIndex';
import { WORKSHOP_SCHEMA_VERSION, type WorkshopPlacementManifest, type WorkshopPlacementRecord } from './schema';

/** Clear width kept free along every protected walkway (accessible passing width). */
export const WALKWAY_CLEAR_WIDTH = 1.5;
/** Objects whose top is at most this far above the walkway floor are walkable (rugs, floor slabs). */
const WALKABLE_HEIGHT = 0.05;
const PROPOSAL_MARGIN = 0.1;
const PROPOSAL_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

export type WalkwayWorld = 'exterior' | 'interior';
export type WalkwayKind = 'route' | 'stair' | 'exhibit-approach' | 'installation-reach' | 'threshold';

/** A protected corridor: a polyline (one point means a disc) with a clear half-width. */
export interface Walkway {
  readonly id: string;
  readonly kind: WalkwayKind;
  readonly label: string;
  readonly world: WalkwayWorld;
  readonly path: readonly Vec3[];
  readonly halfWidth: number;
}

export interface WalkwayFinding {
  readonly objectId: string;
  readonly label: string;
  /** FAIL: a solid object blocks movement. WARNING: a non-solid object intrudes. UNKNOWN: bounds not yet known. */
  readonly severity: 'FAIL' | 'WARNING' | 'UNKNOWN';
  readonly locked: boolean;
  readonly walkways: readonly { readonly id: string; readonly label: string; readonly intrusion: number }[];
}

export interface WalkwayProposal {
  readonly objectId: string;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly distance: number;
}

export interface ClearWalkwaysReport {
  readonly status: 'PASS' | 'FAIL' | 'WARNING' | 'UNKNOWN';
  readonly walkways: number;
  readonly findings: readonly WalkwayFinding[];
  /** Reversible suggestions only. Nothing is applied without explicit approval. */
  readonly proposals: readonly WalkwayProposal[];
  readonly unresolved: readonly { readonly objectId: string; readonly reason: string }[];
  readonly limitations: readonly string[];
}

/** Every protected walkway derived from the authoritative scene index. */
export function protectedWalkways(index: MuseumSceneIndex): Walkway[] {
  const half = WALKWAY_CLEAR_WIDTH / 2;
  const out: Walkway[] = [];
  for (let i = 0; i + 1 < index.route.length; i++) {
    const from = index.route[i], to = index.route[i + 1];
    const base = { kind: 'route' as const, label: `${from.label} → ${to.label}`, path: [from.position, to.position], halfWidth: half };
    out.push({ ...base, id: `route:${i}:interior`, world: 'interior' });
    // The first canonical leg crosses the vestibule from the exterior plaza.
    if (i === 0) out.push({ ...base, id: `route:${i}:exterior`, world: 'exterior' });
  }
  for (const stair of index.stairs) {
    out.push({ id: `stair:${stair.id}`, kind: 'stair', label: `stair ${stair.id}`, world: 'interior',
      path: stair.path, halfWidth: stair.halfWidth });
  }
  for (const exhibit of index.exhibits) {
    out.push({ id: `approach:${exhibit.id}`, kind: 'exhibit-approach', label: `${exhibit.id} approach`, world: 'interior',
      path: [exhibit.doorway, exhibit.visitorSpot], halfWidth: half });
  }
  for (const installation of index.installations) {
    out.push({ id: `reach:${installation.id}`, kind: 'installation-reach', label: `${installation.id} interaction point`,
      world: 'interior', path: [installation.interactionPoint], halfWidth: half });
  }
  out.push({ id: 'threshold:interior', kind: 'threshold', label: 'entrance threshold (inside)', world: 'interior',
    path: [index.threshold.doorway, index.threshold.interior], halfWidth: half });
  out.push({ id: 'threshold:exterior', kind: 'threshold', label: 'entrance threshold (outside)', world: 'exterior',
    path: [index.threshold.doorway, index.threshold.exterior], halfWidth: half });
  return out;
}

interface Rect { minX: number; maxX: number; minZ: number; maxZ: number }

function pointRect(x: number, z: number, r: Rect): number {
  return Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
}

function pointSegment(x: number, z: number, a: Vec3, b: Vec3): { d: number; t: number } {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / len));
  return { d: Math.hypot(a[0] + t * dx - x, a[2] + t * dz - z), t };
}

function segmentsCross(a: Vec3, b: Vec3, c: [number, number], d: [number, number]): boolean {
  const o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) => Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
  return o(a[0], a[2], b[0], b[2], c[0], c[1]) !== o(a[0], a[2], b[0], b[2], d[0], d[1])
    && o(c[0], c[1], d[0], d[1], a[0], a[2]) !== o(c[0], c[1], d[0], d[1], b[0], b[2]);
}

/** XZ distance from a segment to a rectangle, and the walkway floor height at the nearest point. */
function segmentRect(a: Vec3, b: Vec3, r: Rect): { d: number; y: number } {
  const lerpY = (t: number) => a[1] + (b[1] - a[1]) * t;
  if (pointRect(a[0], a[2], r) === 0) return { d: 0, y: a[1] };
  if (pointRect(b[0], b[2], r) === 0) return { d: 0, y: b[1] };
  const corners: [number, number][] = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];
  for (let k = 0; k < 4; k++) {
    if (segmentsCross(a, b, corners[k], corners[(k + 1) % 4])) {
      const { t } = pointSegment((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, a, b);
      return { d: 0, y: lerpY(t) };
    }
  }
  let best = { d: pointRect(a[0], a[2], r), y: a[1] };
  const endB = pointRect(b[0], b[2], r);
  if (endB < best.d) best = { d: endB, y: b[1] };
  for (const [cx, cz] of corners) {
    const { d, t } = pointSegment(cx, cz, a, b);
    if (d < best.d) best = { d, y: lerpY(t) };
  }
  return best;
}

/** How far (metres) a box intrudes into a walkway's clear width, or 0 when clear. */
export function walkwayIntrusion(walkway: Walkway, bounds: SceneBounds): number {
  const r: Rect = { minX: bounds.min[0], maxX: bounds.max[0], minZ: bounds.min[2], maxZ: bounds.max[2] };
  const path = walkway.path.length === 1 ? [walkway.path[0], walkway.path[0]] : walkway.path;
  let worst = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const { d, y } = segmentRect(path[k], path[k + 1], r);
    if (d >= walkway.halfWidth) continue;
    // Only objects occupying the band between walkable floor and head height obstruct.
    if (bounds.max[1] <= y + WALKABLE_HEIGHT || bounds.min[1] >= y + PLAYER_HEIGHT) continue;
    worst = Math.max(worst, walkway.halfWidth - d);
  }
  return worst;
}

const inWorld = (walkway: Walkway, world: string) => world === 'shared' || walkway.world === world;
const shift = (b: SceneBounds, dx: number, dz: number): SceneBounds => ({
  min: [b.min[0] + dx, b.min[1], b.min[2] + dz], max: [b.max[0] + dx, b.max[1], b.max[2] + dz] });
const overlaps = (a: SceneBounds, b: SceneBounds) => a.min[0] < b.max[0] && a.max[0] > b.min[0]
  && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];
const round = (v: number) => Math.round(v * 10_000) / 10_000;

/**
 * Deterministic walkway audit with reversible move suggestions. Never moves
 * original museum objects, never deletes, and never proposes a move for a
 * locked placement or one that would fail museum conservation, enter another
 * walkway, or overlap an exhibit, installation or other placement.
 */
export function clearWalkways(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest,
  options: { locked?: ReadonlySet<string> } = {}): ClearWalkwaysReport {
  const walkways = protectedWalkways(index);
  const records = new Map(manifest.objects.map((record) => [record.id, record]));
  const locked = options.locked ?? new Set<string>();
  const findings: WalkwayFinding[] = [];
  for (const item of index.authored) {
    const record = records.get(item.id);
    if (!record) continue;
    if (!item.bounds) {
      const near = walkways.filter((walkway) => inWorld(walkway, item.world) && walkwayIntrusion(walkway,
        { min: [item.position[0] - 1, item.position[1], item.position[2] - 1], max: [item.position[0] + 1, item.position[1] + PLAYER_HEIGHT, item.position[2] + 1] }) > 0);
      if (near.length) findings.push({ objectId: item.id, label: item.label, severity: 'UNKNOWN', locked: locked.has(item.id),
        walkways: near.map((walkway) => ({ id: walkway.id, label: walkway.label, intrusion: 0 })) });
      continue;
    }
    const hits = walkways.filter((walkway) => inWorld(walkway, item.world))
      .map((walkway) => ({ id: walkway.id, label: walkway.label, intrusion: round(walkwayIntrusion(walkway, item.bounds!)) }))
      .filter((hit) => hit.intrusion > 0);
    if (hits.length) findings.push({ objectId: item.id, label: item.label, severity: record.collision === 'solid' ? 'FAIL' : 'WARNING',
      locked: locked.has(item.id), walkways: hits });
  }

  // Obstacles a moved object must not overlap.
  const exhibitBoxes: SceneBounds[] = index.exhibits.map(({ bounds: { c, h } }) => ({
    min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] }));
  const installationBoxes: SceneBounds[] = index.installations.map(({ position: p, footprint: [hx, hz] }) => ({
    min: [p[0] - hx, p[1], p[2] - hz], max: [p[0] + hx, p[1] + PLAYER_HEIGHT, p[2] + hz] }));
  const placed = new Map(index.authored.filter((item) => item.bounds).map((item) => [item.id, item.bounds!]));

  const proposals: WalkwayProposal[] = [];
  const unresolved: { objectId: string; reason: string }[] = [];
  for (const finding of findings) {
    if (finding.severity === 'UNKNOWN') { unresolved.push({ objectId: finding.objectId, reason: 'Bounds are not yet known; load the model and rescan.' }); continue; }
    if (finding.locked) { unresolved.push({ objectId: finding.objectId, reason: 'Locked by the curator; not moved.' }); continue; }
    const record = records.get(finding.objectId)!;
    const bounds = placed.get(finding.objectId)!;
    const world = record.worldId ?? 'shared';
    const exhibitWorld = world !== 'exterior';
    const directions: [number, number][] = [];
    for (let k = 0; k < 16; k++) directions.push([Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)]);
    let chosen: WalkwayProposal | null = null;
    for (const step of PROPOSAL_STEPS) {
      for (const [ux, uz] of directions) {
        const dx = round(ux * step), dz = round(uz * step);
        const moved = shift(bounds, dx, dz);
        if (walkways.some((walkway) => inWorld(walkway, world) && walkwayIntrusion(walkway,
          { min: [moved.min[0] - PROPOSAL_MARGIN, moved.min[1], moved.min[2] - PROPOSAL_MARGIN],
            max: [moved.max[0] + PROPOSAL_MARGIN, moved.max[1], moved.max[2] + PROPOSAL_MARGIN] }) > 0)) continue;
        if (exhibitWorld && (exhibitBoxes.some((box) => overlaps(moved, box)) || installationBoxes.some((box) => overlaps(moved, box)))) continue;
        let blocked = false;
        for (const [id, other] of placed) if (id !== finding.objectId && overlaps(moved, other)) { blocked = true; break; }
        if (blocked) continue;
        const to: Vec3 = [round(record.position[0] + dx), record.position[1], round(record.position[2] + dz)];
        const candidate: WorkshopPlacementRecord = { ...record, position: [to[0], to[1], to[2]] };
        if (!validateWorkshopManifestForMuseum({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: [candidate] }, []).ok) continue;
        chosen = { objectId: finding.objectId, from: record.position, to, distance: round(Math.hypot(dx, dz)) };
        placed.set(finding.objectId, moved);
        break;
      }
      if (chosen) break;
    }
    if (chosen) proposals.push(chosen);
    else unresolved.push({ objectId: finding.objectId, reason: `No conservation-safe position within ${PROPOSAL_STEPS.at(-1)} m clears every walkway; consider moving it manually. Nothing was removed.` });
  }

  const has = (severity: WalkwayFinding['severity']) => findings.some((finding) => finding.severity === severity);
  const runtimeMissing = index.authored.length > 0 && index.authored.every((item) => item.bounds === null && item.resident === null);
  const status = has('FAIL') ? 'FAIL' : has('WARNING') ? 'WARNING' : has('UNKNOWN') || runtimeMissing ? 'UNKNOWN' : 'PASS';
  return {
    status, walkways: walkways.length, findings, proposals, unresolved,
    limitations: [
      `Walkways: canonical route legs, both stair runs, every exhibit approach, installation interaction points and the entrance threshold, each kept ${WALKWAY_CLEAR_WIDTH} m clear (stairs keep their full width).`,
      'Only authored placements are assessed and moved; original architecture and exhibits are treated as fixed.',
      'Bounds are axis-aligned; rotated objects may report slightly more intrusion than they occupy.',
      'This is a geometric check, not a traversal simulation; see Visitor Jury for walked routes.',
    ],
  };
}

/**
 * Apply only the approved proposals, returning a new manifest. Unapproved
 * proposals and every other record are left untouched; nothing is removed.
 */
export function applyWalkwayProposals(manifest: WorkshopPlacementManifest, proposals: readonly WalkwayProposal[],
  approved: ReadonlySet<string>): WorkshopPlacementManifest {
  const moves = new Map(proposals.filter((proposal) => approved.has(proposal.objectId)).map((proposal) => [proposal.objectId, proposal.to]));
  return { ...manifest, objects: manifest.objects.map((record) => {
    const to = moves.get(record.id);
    return to ? { ...record, position: [to[0], to[1], to[2]] as [number, number, number] } : record;
  }) };
}
