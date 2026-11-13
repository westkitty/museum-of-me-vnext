import { zoneAtXYZ, type Vec3, type ZoneId } from '../world/layout';
import { clearWalkways, protectedWalkways, walkwayIntrusion } from './ClearWalkways';
import { validateWorkshopManifestForMuseum, workshopPlacementExtents } from './conservation';
import { latestDecision, overlapsEmptyRegion, recordDecision } from './CuratorMemory';
import type { MuseumSceneIndex, SceneBounds } from './SceneIndex';
import { WORKSHOP_SCHEMA_VERSION, type WorkshopPlacementManifest, type WorkshopPlacementRecord, type WorkshopVec3 } from './schema';

export type CurateMode = 'clear' | 'furnish' | 'both';
export type CurateDensity = 'minimal' | 'restrained' | 'rich';
export type CurateScope = { readonly kind: 'museum' } | { readonly kind: 'zone'; readonly zone: ZoneId };

export interface CurateSuggestion {
  /** Stable id: the moved object's id, or the id the added object will have. */
  readonly id: string;
  readonly kind: 'move' | 'add';
  readonly label: string;
  readonly zone: ZoneId;
  readonly from: Vec3 | null;
  readonly to: Vec3;
  /** For additions: the exact record that approval would add. */
  readonly record: WorkshopPlacementRecord | null;
  /** World box at the destination, for ghost previews. */
  readonly bounds: SceneBounds;
  readonly reason: string;
}

export interface CurateReport {
  readonly suggestions: readonly CurateSuggestion[];
  readonly skipped: readonly { readonly id: string; readonly reason: string }[];
  readonly limitations: readonly string[];
}

/** Benches per exhibit zone: a deliberate ceiling, never a target to fill. */
export const DENSITY_BENCHES: Readonly<Record<CurateDensity, (exhibits: number) => number>> = {
  minimal: (n) => Math.min(1, n),
  restrained: (n) => Math.ceil(n / 3),
  rich: (n) => n,
};
const BENCH_SPACING = 4;
const CLEAR_MARGIN = 0.25;
/** Candidates are a grid over the exhibit's own bay, nearest the visitor position first. */
const GRID_STEP = 0.5;
/** Clearance kept around the exhibit's anchor, where its display stands. */
const DISPLAY_CLEARANCE = 3;
const round = (v: number) => Math.round(v * 10_000) / 10_000;

const overlaps = (a: SceneBounds, b: SceneBounds) => a.min[0] < b.max[0] && a.max[0] > b.min[0]
  && a.min[1] < b.max[1] && a.max[1] > b.min[1] && a.min[2] < b.max[2] && a.max[2] > b.min[2];
const grow = (b: SceneBounds, m: number): SceneBounds => ({ min: [b.min[0] - m, b.min[1], b.min[2] - m], max: [b.max[0] + m, b.max[1], b.max[2] + m] });

/** Axis-aligned world box of a yaw-rotated, scaled placement from its nominal extents. */
export function estimatedBounds(record: WorkshopPlacementRecord): SceneBounds {
  const e = workshopPlacementExtents(record);
  const yaw = record.rotation[1];
  const hx = e.halfX * record.scale[0], hz = e.halfZ * record.scale[2];
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const ex = c * hx + s * hz, ez = s * hx + c * hz;
  const [x, y, z] = record.position;
  return { min: [x - ex, y + e.minY * record.scale[1], z - ez], max: [x + ex, y + e.maxY * record.scale[1], z + ez] };
}

const inScope = (scope: CurateScope, zone: ZoneId) => scope.kind === 'museum' || scope.zone === zone;
export const furnishId = (exhibitId: string) => `curate-bench-${exhibitId.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 64);

/**
 * Deterministic curation suggestions. Clearing reuses Clear Walkways (so locks,
 * standing rejections and empty regions apply); furnishing proposes gallery
 * benches behind exhibit visitor positions only where every safety check
 * passes. Nothing is applied here: approval is a separate, explicit step.
 */
export function autoCurate(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest,
  options: { mode: CurateMode; density: CurateDensity; scope: CurateScope }): CurateReport {
  const suggestions: CurateSuggestion[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const limitations: string[] = [];
  const authoredBounds = new Map<string, SceneBounds>();
  for (const item of index.authored) {
    const record = manifest.objects.find((entry) => entry.id === item.id);
    if (record) authoredBounds.set(item.id, item.bounds ?? estimatedBounds(record));
  }

  if (options.mode !== 'furnish') {
    const report = clearWalkways(index, manifest);
    for (const proposal of report.proposals) {
      const item = index.authored.find((entry) => entry.id === proposal.objectId)!;
      if (!inScope(options.scope, item.zone)) continue;
      const before = authoredBounds.get(item.id)!;
      const dx = proposal.to[0] - proposal.from[0], dz = proposal.to[2] - proposal.from[2];
      const bounds: SceneBounds = { min: [before.min[0] + dx, before.min[1], before.min[2] + dz], max: [before.max[0] + dx, before.max[1], before.max[2] + dz] };
      authoredBounds.set(item.id, bounds);
      suggestions.push({ id: proposal.objectId, kind: 'move', label: item.label, zone: item.zone, from: proposal.from, to: proposal.to,
        record: null, bounds, reason: `Clears ${report.findings.find((finding) => finding.objectId === item.id)?.walkways.map((walkway) => walkway.label).join(', ')} (moves ${proposal.distance} m).` });
    }
    for (const item of report.unresolved) {
      const zone = index.authored.find((entry) => entry.id === item.objectId)?.zone;
      if (zone && inScope(options.scope, zone)) skipped.push({ id: item.objectId, reason: item.reason });
    }
    limitations.push(...report.limitations.slice(0, 2));
  }

  if (options.mode !== 'clear') {
    const walls = index.collisions.interior?.filter((collider) => collider.kind === 'wall') ?? null;
    const floors = index.collisions.interior?.filter((collider) => collider.kind === 'floor') ?? null;
    if (!walls || !floors) {
      limitations.push('Furnishing needs the loaded interior collision world to check walls and floors; nothing was suggested.');
    } else {
      const walkways = protectedWalkways(index).filter((walkway) => walkway.world === 'interior');
      const exhibitBoxes: SceneBounds[] = index.exhibits.map(({ bounds: { c, h } }) => ({
        min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] }));
      const installationBoxes: SceneBounds[] = index.installations.map(({ position: p, footprint: [hx, hz] }) => ({
        min: [p[0] - hx, p[1], p[2] - hz], max: [p[0] + hx, p[1] + 1.8, p[2] + hz] }));
      const seats: Vec3[] = manifest.objects.filter((record) => record.prefab === 'museum-bench').map((record) => record.position);
      const byZone = new Map<ZoneId, (typeof index.exhibits)[number][]>();
      for (const exhibit of index.exhibits) {
        if (!inScope(options.scope, exhibit.zone)) continue;
        byZone.set(exhibit.zone, [...(byZone.get(exhibit.zone) ?? []), exhibit]);
      }
      for (const [zone, exhibits] of [...byZone].sort(([a], [b]) => a.localeCompare(b))) {
        const quota = DENSITY_BENCHES[options.density](exhibits.length);
        let added = 0;
        for (const exhibit of [...exhibits].sort((a, b) => a.id.localeCompare(b.id))) {
          if (added >= quota) break;
          const id = furnishId(exhibit.id);
          if (manifest.objects.some((record) => record.id === id)) continue;
          const decision = latestDecision(manifest, 'furnish-add', id);
          if (decision?.outcome === 'rejected') { skipped.push({ id, reason: `A bench for ${exhibit.id} was rejected by the curator on ${decision.at.slice(0, 10)}; not proposed again.` }); continue; }
          const { c, h } = exhibit.bounds;
          const ownBay: SceneBounds = { min: [c[0] - h[0], c[1] - h[1], c[2] - h[2]], max: [c[0] + h[0], c[1] + h[1], c[2] + h[2]] };
          const candidates: WorkshopVec3[] = [];
          for (let x = ownBay.min[0] + GRID_STEP; x < ownBay.max[0]; x += GRID_STEP) {
            for (let z = ownBay.min[2] + GRID_STEP; z < ownBay.max[2]; z += GRID_STEP) candidates.push([round(x), exhibit.visitorSpot[1], round(z)]);
          }
          const distance = (p: WorkshopVec3) => Math.hypot(p[0] - exhibit.visitorSpot[0], p[2] - exhibit.visitorSpot[2]);
          candidates.sort((a, b) => distance(a) - distance(b) || a[0] - b[0] || a[2] - b[2]);
          let chosen: CurateSuggestion | null = null;
          for (const position of candidates) {
              if (zoneAtXYZ(position[0], position[1], position[2]) !== zone) continue;
              if (Math.hypot(position[0] - exhibit.anchor[0], position[2] - exhibit.anchor[2]) < DISPLAY_CLEARANCE) continue;
              if (seats.some((seat) => Math.hypot(seat[0] - position[0], seat[2] - position[2]) < BENCH_SPACING && Math.abs(seat[1] - position[1]) < 2)) continue;
              const yaw = round(Math.atan2(exhibit.anchor[0] - position[0], exhibit.anchor[2] - position[2]));
              const record: WorkshopPlacementRecord = { id, label: `Bench facing ${exhibit.id}`, prefab: 'museum-bench', anchor: 'floor',
                position, rotation: [0, yaw, 0], scale: [1, 1, 1], worldId: 'interior', collision: 'none' };
              const box = estimatedBounds(record);
              const padded = grow(box, CLEAR_MARGIN);
              if (walkways.some((walkway) => walkwayIntrusion(walkway, padded) > 0)) continue;
              // Wholly inside this exhibit's bay, and clear of every other exhibit's bay and all installations.
              if (padded.min[0] < ownBay.min[0] || padded.max[0] > ownBay.max[0] || padded.min[2] < ownBay.min[2] || padded.max[2] > ownBay.max[2]) continue;
              if (exhibitBoxes.some((other, k) => index.exhibits[k].id !== exhibit.id && overlaps(padded, other))
                || installationBoxes.some((other) => overlaps(padded, other))) continue;
              if ([...authoredBounds.values()].some((other) => overlaps(padded, other))) continue;
              if (overlapsEmptyRegion(manifest, 'interior', box)) continue;
              if (walls.some((wall) => wall.kind === 'wall' && overlaps(padded, { min: [wall.minX, wall.minY, wall.minZ], max: [wall.maxX, wall.maxY, wall.maxZ] }))) continue;
              const supported = [[box.min[0], box.min[2]], [box.max[0], box.min[2]], [box.min[0], box.max[2]], [box.max[0], box.max[2]]]
                .every(([x, z]) => floors.some((floor) => floor.kind === 'floor' && x >= floor.minX && x <= floor.maxX && z >= floor.minZ && z <= floor.maxZ
                  && Math.abs(floor.y - position[1]) < 0.05));
              if (!supported) continue;
              if (!validateWorkshopManifestForMuseum({ schemaVersion: WORKSHOP_SCHEMA_VERSION, objects: [record] }, []).ok) continue;
              chosen = { id, kind: 'add', label: record.label, zone, from: null, to: position, record, bounds: box,
                reason: `A place to sit ${round(distance(position)).toFixed(1)} m from the ${exhibit.id} visitor position, facing the exhibit, outside its reading zone and clear of every walkway.` };
              break;
          }
          if (!chosen) { skipped.push({ id, reason: `No safe bench position found behind ${exhibit.id}.` }); continue; }
          suggestions.push(chosen);
          authoredBounds.set(id, chosen.bounds);
          seats.push(chosen.to);
          added++;
        }
      }
      limitations.push(`Furnishing adds gallery benches only, at most ${options.density === 'minimal' ? 'one per zone' : options.density === 'restrained' ? 'one per three exhibits' : 'one per exhibit'}, at least ${BENCH_SPACING} m apart.`,
        'Walls are checked by their axis-aligned envelopes and floors at the four bench corners; masked floor openings are not resolved.',
        `Benches stay inside the exhibit's own bay and ${DISPLAY_CLEARANCE} m from its display anchor; non-colliding exhibit dressing is not detected, so preview before approving.`,
        'Placement is geometric; artistic judgement remains the curator\'s.');
    }
  }
  return { suggestions, skipped, limitations };
}

/** Apply only approved suggestions, remembering each approval; nothing else changes. */
export function applyCurateSuggestions(manifest: WorkshopPlacementManifest, suggestions: readonly CurateSuggestion[],
  approved: ReadonlySet<string>, at = new Date()): WorkshopPlacementManifest {
  let next: WorkshopPlacementManifest = manifest;
  for (const suggestion of suggestions) {
    if (!approved.has(suggestion.id)) continue;
    if (suggestion.kind === 'add' && suggestion.record) {
      if (next.objects.some((record) => record.id === suggestion.id)) continue;
      next = { ...next, objects: [...next.objects, suggestion.record] };
      next = recordDecision(next, { kind: 'furnish-add', objectId: suggestion.id, outcome: 'approved', position: suggestion.to as WorkshopVec3, at });
    } else if (suggestion.kind === 'move') {
      next = { ...next, objects: next.objects.map((record) => (record.id === suggestion.id
        ? { ...record, position: [suggestion.to[0], suggestion.to[1], suggestion.to[2]] as WorkshopVec3 } : record)) };
      next = recordDecision(next, { kind: 'walkway-move', objectId: suggestion.id, outcome: 'approved', position: suggestion.to as WorkshopVec3, at });
    }
  }
  return next;
}

/** Remember a rejection so the same suggestion is not offered again. */
export function rejectCurateSuggestion(manifest: WorkshopPlacementManifest, suggestion: CurateSuggestion, at = new Date()): WorkshopPlacementManifest {
  return recordDecision(manifest, { kind: suggestion.kind === 'add' ? 'furnish-add' : 'walkway-move', objectId: suggestion.id,
    outcome: 'rejected', position: (suggestion.kind === 'add' ? suggestion.to : suggestion.from ?? suggestion.to) as WorkshopVec3, at });
}
