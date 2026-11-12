import type { Vec3 } from '../world/layout';
import { estimatedBounds } from './AutoCurate';
import { protectedWalkways, walkwayIntrusion } from './ClearWalkways';
import { validateWorkshopManifestForMuseum } from './conservation';
import { isLocked, overlapsEmptyRegion, recordDecision, suppressionReason } from './CuratorMemory';
import type { MuseumSceneIndex, SceneBounds } from './SceneIndex';
import { WORKSHOP_SCHEMA_VERSION, type WorkshopPlacementManifest, type WorkshopVec3 } from './schema';

/** Pilots named by the mission; other exhibits are not assessed until reviewed. */
export const NARRATIVE_GRAVITY_PILOTS = ['E03', 'E13'] as const;
export type NarrativeGravityPilot = (typeof NARRATIVE_GRAVITY_PILOTS)[number];

export const EYE_HEIGHT = 1.6;
/** Height above the bay floor where the hero is read from the visitor position. */
export const HERO_FOCUS_HEIGHT = 1.2;
/** Half-width of the protected sightline corridor. */
export const SIGHTLINE_HALF_WIDTH = 0.5;
/** Objects within this angle of the sightline, but outside it, compete for attention. */
export const COMPETING_ANGLE = Math.PI / 9;
const LATERAL_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
const round = (v: number) => Math.round(v * 10_000) / 10_000;

export interface GravitySuggestion {
  readonly objectId: string;
  readonly label: string;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly bounds: SceneBounds;
  readonly reason: string;
}

export interface NarrativeGravityReport {
  readonly exhibitId: NarrativeGravityPilot;
  /** NO CHANGE is a first-class verdict: the composition already serves the exhibit. */
  readonly verdict: 'NO CHANGE' | 'SUGGESTIONS' | 'REVIEW' | 'UNKNOWN';
  readonly sightline: { readonly from: Vec3; readonly to: Vec3; readonly blockers: readonly string[] };
  readonly competing: readonly { readonly objectId: string; readonly label: string; readonly reason: string }[];
  readonly suggestions: readonly GravitySuggestion[];
  readonly unresolved: readonly { readonly objectId: string; readonly reason: string }[];
  /** What the analysis guarantees it never touches. */
  readonly preserved: readonly string[];
  readonly limitations: readonly string[];
}

/** Whether segment a→b passes through box (slab test). */
function segmentHitsBox(a: Vec3, b: Vec3, box: SceneBounds): boolean {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) { if (a[k] < box.min[k] || a[k] > box.max[k]) return false; continue; }
    let near = (box.min[k] - a[k]) / d, far = (box.max[k] - a[k]) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near); t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}
const grow = (b: SceneBounds, m: number): SceneBounds => ({ min: [b.min[0] - m, b.min[1] - m, b.min[2] - m], max: [b.max[0] + m, b.max[1] + m, b.max[2] + m] });
const shift = (b: SceneBounds, dx: number, dz: number): SceneBounds => ({ min: [b.min[0] + dx, b.min[1], b.min[2] + dz], max: [b.max[0] + dx, b.max[1], b.max[2] + dz] });
const overlaps = (a: SceneBounds, b: SceneBounds) => a.min[0] < b.max[0] && a.max[0] > b.min[0]
  && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];

/**
 * Read an exhibit's composition from the visitor position: the sightline to
 * the hero must stay clear, and nothing authored should compete with it. Only
 * authored placements may ever be suggested to move, sideways out of the
 * sightline and within the same bay; the exhibit, its content, installations
 * and original scene objects are fixed. When nothing needs to change, the
 * verdict is NO CHANGE and no suggestion is produced.
 */
export function narrativeGravity(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest, exhibitId: NarrativeGravityPilot): NarrativeGravityReport {
  const exhibit = index.exhibits.find((item) => item.id === exhibitId);
  if (!exhibit) throw new Error(`Unknown exhibit ${exhibitId}`);
  const from: Vec3 = [exhibit.visitorSpot[0], exhibit.visitorSpot[1] + EYE_HEIGHT, exhibit.visitorSpot[2]];
  const to: Vec3 = [exhibit.anchor[0], exhibit.anchor[1] + HERO_FOCUS_HEIGHT, exhibit.anchor[2]];
  const { c, h } = exhibit.bounds;
  const bay: SceneBounds = { min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] };
  const preserved = [`${exhibitId} hero object, content and canonical text`, 'installations and their lecterns',
    'original museum scene objects', 'the visitor position and doorway approach'];
  const limitations = ['The sightline is one eye-height ray from the canonical visitor position to the hero focus, widened by '
    + `${SIGHTLINE_HALF_WIDTH} m; other viewpoints are not assessed.`, 'Bounds are axis-aligned.',
  'Only authored placements are assessed; exhibit dressing that is part of the original museum is treated as intended composition.'];

  const records = new Map(manifest.objects.map((record) => [record.id, record]));
  const inBay = index.authored.filter((item) => {
    const record = records.get(item.id);
    if (!record || record.worldId !== 'interior') return false;
    const box = item.bounds ?? estimatedBounds(record);
    return overlaps(box, bay);
  });
  const boundsOf = (id: string) => { const item = index.authored.find((entry) => entry.id === id)!; return item.bounds ?? estimatedBounds(records.get(id)!); };
  // A live model whose bounds are not known yet is never judged from an estimate.
  const unknown = inBay.filter((item) => item.bounds === null && item.resident !== null);
  const known = inBay.filter((item) => !unknown.includes(item));

  const blockers = known.filter((item) => segmentHitsBox(from, to, grow(boundsOf(item.id), SIGHTLINE_HALF_WIDTH)));
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const sightYaw = Math.atan2(dx, dz);
  const competing = known.filter((item) => !blockers.includes(item)).flatMap((item) => {
    const box = boundsOf(item.id);
    const cx = (box.min[0] + box.max[0]) / 2 - from[0], cz = (box.min[2] + box.max[2]) / 2 - from[2];
    const angle = Math.abs(Math.atan2(Math.sin(Math.atan2(cx, cz) - sightYaw), Math.cos(Math.atan2(cx, cz) - sightYaw)));
    const nearer = Math.hypot(cx, cz) < Math.hypot(dx, dz);
    const tall = box.max[1] - exhibit.anchor[1] > HERO_FOCUS_HEIGHT;
    return angle < COMPETING_ANGLE && nearer && tall
      ? [{ objectId: item.id, label: item.label, reason: `Stands between the visitor and ${exhibitId}, ${Math.round(angle * 180 / Math.PI)}° off the sightline and taller than the hero focus; review whether it competes.` }]
      : [];
  });

  const walkways = protectedWalkways(index).filter((walkway) => walkway.world === 'interior');
  const suggestions: GravitySuggestion[] = [];
  const unresolved: { objectId: string; reason: string }[] = unknown.map((item) => ({ objectId: item.id,
    reason: 'Bounds are not yet known, so whether it blocks the view cannot be judged; load the model and rerun.' }));
  const len = Math.hypot(dx, dz) || 1;
  const perpendicular: [number, number] = [-dz / len, dx / len];
  const occupied = new Map(index.authored.map((item) => [item.id, item.bounds ?? (records.get(item.id) ? estimatedBounds(records.get(item.id)!) : null)]));
  for (const item of blockers) {
    const record = records.get(item.id)!;
    if (isLocked(manifest, item.id)) { unresolved.push({ objectId: item.id, reason: 'Locked by the curator; it stays in the sightline by choice.' }); continue; }
    const suppressed = suppressionReason(manifest, 'gravity-move', item.id);
    if (suppressed) { unresolved.push({ objectId: item.id, reason: suppressed }); continue; }
    const box = boundsOf(item.id);
    let chosen: GravitySuggestion | null = null;
    for (const step of LATERAL_STEPS) {
      for (const sign of [1, -1]) {
        const ox = round(perpendicular[0] * step * sign), oz = round(perpendicular[1] * step * sign);
        const moved = shift(box, ox, oz);
        if (segmentHitsBox(from, to, grow(moved, SIGHTLINE_HALF_WIDTH))) continue;
        if (moved.min[0] < bay.min[0] || moved.max[0] > bay.max[0] || moved.min[2] < bay.min[2] || moved.max[2] > bay.max[2]) continue;
        if (walkways.some((walkway) => walkwayIntrusion(walkway, moved) > 0)) continue;
        if (overlapsEmptyRegion(manifest, 'interior', moved)) continue;
        if ([...occupied].some(([id, other]) => id !== item.id && other && overlaps(moved, other))) continue;
        const position: WorkshopVec3 = [round(record.position[0] + ox), record.position[1], round(record.position[2] + oz)];
        if (!validateWorkshopManifestForMuseum({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: [{ ...record, position }] }, []).ok) continue;
        chosen = { objectId: item.id, label: item.label, from: record.position, to: position, bounds: moved,
          reason: `Clears the sightline to ${exhibitId} by moving ${step} m sideways; distance to the hero is kept.` };
        break;
      }
      if (chosen) break;
    }
    if (chosen) { suggestions.push(chosen); occupied.set(item.id, chosen.bounds); }
    else unresolved.push({ objectId: item.id, reason: 'No conservation-safe sideways position within 6 m in this bay clears the sightline; consider moving it by hand.' });
  }

  const verdict = suggestions.length ? 'SUGGESTIONS'
    : blockers.length || competing.length ? 'REVIEW'
      : unknown.length ? 'UNKNOWN' : 'NO CHANGE';
  return { exhibitId, verdict, sightline: { from, to, blockers: blockers.map((item) => item.id) }, competing, suggestions, unresolved, preserved,
    limitations: unknown.length ? [...limitations, `${unknown.length} placement(s) in the bay have unknown bounds.`] : limitations };
}

/** Apply approved gravity moves, remembering each approval; nothing else changes. */
export function applyGravitySuggestions(manifest: WorkshopPlacementManifest, suggestions: readonly GravitySuggestion[],
  approved: ReadonlySet<string>, at = new Date()): WorkshopPlacementManifest {
  let next = manifest;
  for (const suggestion of suggestions) {
    if (!approved.has(suggestion.objectId)) continue;
    next = { ...next, objects: next.objects.map((record) => (record.id === suggestion.objectId
      ? { ...record, position: [suggestion.to[0], suggestion.to[1], suggestion.to[2]] as WorkshopVec3 } : record)) };
    next = recordDecision(next, { kind: 'gravity-move', objectId: suggestion.objectId, outcome: 'approved', position: suggestion.to as WorkshopVec3, at });
  }
  return next;
}

export function rejectGravitySuggestion(manifest: WorkshopPlacementManifest, suggestion: GravitySuggestion, at = new Date()): WorkshopPlacementManifest {
  return recordDecision(manifest, { kind: 'gravity-move', objectId: suggestion.objectId, outcome: 'rejected', position: suggestion.from as WorkshopVec3, at });
}
