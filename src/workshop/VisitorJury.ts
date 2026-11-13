import { INTERACTION_REACH } from '../interaction/InteractionManager';
import { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS } from '../player/PlayerController';
import type { CollisionWorld } from '../world/CollisionWorld';
import type { Vec3 } from '../world/layout';
import { estimatedBounds } from './AutoCurate';
import { HERO_FOCUS_HEIGHT, SIGHTLINE_HALF_WIDTH, segmentHitsBox } from './NarrativeGravity';
import type { MuseumSceneIndex, SceneBounds } from './SceneIndex';
import type { WorkshopPlacementManifest } from './schema';
import { LAND_SUPPORT_Y, PATH_CENTERLINES, PIER_CENTERLINE } from '../world/exterior/IslandSiteLayout';
import { START_POSITION } from '../world/start';

export type JuryStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT TESTED' | 'UNKNOWN';

/** Something a verdict is about, with where it is when that is known. */
export interface JuryAffected {
  readonly kind: 'placement' | 'collider' | 'exhibit' | 'stair' | 'waypoint';
  readonly id: string;
  readonly label: string;
  readonly position: Vec3 | null;
}

export interface JuryCheck {
  readonly status: JuryStatus;
  readonly detail: string;
  readonly affected: readonly JuryAffected[];
}

export interface JuryExhibitVerdict {
  readonly exhibitId: string;
  readonly wing: string;
  readonly level: number;
  readonly status: JuryStatus;
  /** Where the simulated visitor actually stopped at the end of the approach, or null if never walked. */
  readonly arrival: Vec3 | null;
  readonly reached: JuryCheck;
  readonly visible: JuryCheck;
  readonly returns: JuryCheck;
}

export interface JuryRouteVerdict extends JuryCheck {
  readonly id: string;
  readonly label: string;
  /** Legs actually walked through the collision world for this verdict. */
  readonly legs: number;
}

export interface VisitorJuryReport {
  /** Worst of every verdict; a jury that could not walk is NOT TESTED, never PASS. */
  readonly status: JuryStatus;
  readonly exhibits: readonly JuryExhibitVerdict[];
  /** Major sections of the canonical route (entrance, each hall, rings, stairs, Sanctuary). */
  readonly routes: readonly JuryRouteVerdict[];
  /** Each grand stair walked up and down between the rotunda floor and the balcony. */
  readonly stairs: readonly JuryRouteVerdict[];
  /** The Dexter Sanctuary reached from the entrance and left back to it. */
  readonly sanctuary: JuryRouteVerdict;
  readonly floors: readonly { readonly level: number; readonly status: JuryStatus; readonly exhibits: number }[];
  readonly counts: Readonly<Record<JuryStatus, number>>;
  /** Distinct legs walked, total simulated steps and metres covered. */
  readonly walked: { readonly legs: number; readonly steps: number; readonly metres: number };
  readonly summary: string;
  readonly limitations: readonly string[];
}

const SEVERITY: readonly JuryStatus[] = ['PASS', 'NOT TESTED', 'UNKNOWN', 'WARNING', 'FAIL'];
export const worstJuryStatus = (statuses: readonly JuryStatus[]): JuryStatus =>
  statuses.reduce<JuryStatus>((a, b) => (SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a), 'PASS');

// Same stride, step-up, slide and stall rules as the museum's traversal proof
// (tests/helpers/walk.ts), with the player controller's capsule.
const STEP = 0.28;
const STEP_UP = 0.55;
const SLIDE = 0.5;
const STALL_LIMIT = 6;
/** Objects whose top is at most this far above the feet are walked over (rugs, slabs). */
const WALKABLE_HEIGHT = 0.05;
/** A leg passing this close to an object whose bounds are unknown cannot be judged. */
const UNKNOWN_MARGIN = 1;
/** Ground rotunda ring and balcony ring radii used by the canonical route. */
const RING_RADIUS = 10.5;
const BALCONY_RING_RADIUS = 13.5;

interface Obstacle {
  readonly id: string;
  readonly label: string;
  readonly box: SceneBounds;
  readonly solid: boolean;
  readonly estimated: boolean;
  /** Already present in the supplied collision world (the live Builder syncs solid placements). */
  readonly live: boolean;
}

interface Waypoint { readonly label: string; readonly at: Vec3 }

interface LegResult {
  readonly label: string;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly ok: boolean;
  readonly reason: string | null;
  /** Final simulated position (arrival on success, the stuck point on failure). */
  readonly end: Vec3;
  readonly steps: number;
  readonly metres: number;
  readonly blockers: readonly JuryAffected[];
  readonly clipping: readonly JuryAffected[];
  readonly unknown: readonly JuryAffected[];
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const vec = (p: { x: number; y: number; z: number }): Vec3 => [round(p.x), round(p.y), round(p.z)];
const fmt = (p: Vec3) => `(${p.map((v) => v.toFixed(1)).join(', ')})`;
const boxXZDistance = (x: number, z: number, b: SceneBounds) =>
  Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[2] - z, 0, z - b.max[2]));
const inBand = (feetY: number, b: SceneBounds) => b.max[1] > feetY + WALKABLE_HEIGHT && b.min[1] < feetY + PLAYER_HEIGHT;
const centre = (b: SceneBounds): Vec3 => [round((b.min[0] + b.max[0]) / 2), round((b.min[1] + b.max[1]) / 2), round((b.min[2] + b.max[2]) / 2)];
const uniq = (items: readonly JuryAffected[]) => [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()];

/**
 * A capsule walker over the real collision world plus any authored solid
 * placements the world does not already contain. It never mutates the world.
 */
class Walker {
  steps = 0;
  metres = 0;
  private readonly cache = new Map<string, LegResult>();

  constructor(private readonly world: CollisionWorld, private readonly obstacles: readonly Obstacle[],
    private readonly walls: readonly { id: string; minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }[],
    private readonly colliderLabel = 'museum collider') {}

  get legs(): number { return this.cache.size; }

  private resolve(pos: { x: number; y: number; z: number }, overlay: readonly Obstacle[]): void {
    for (let iter = 0; iter < 4; iter++) {
      this.world.resolveHorizontal(pos, PLAYER_RADIUS, PLAYER_HEIGHT);
      let moved = false;
      for (const { box } of overlay) {
        // Identical rule to a runtime dynamic wall: blocks when it overlaps the capsule's height.
        if (pos.y + PLAYER_HEIGHT <= box.min[1] || pos.y >= box.max[1]) continue;
        const cx = Math.max(box.min[0], Math.min(pos.x, box.max[0]));
        const cz = Math.max(box.min[2], Math.min(pos.z, box.max[2]));
        const dx = pos.x - cx, dz = pos.z - cz;
        const sq = dx * dx + dz * dz;
        if (sq > PLAYER_RADIUS * PLAYER_RADIUS) continue;
        if (sq > 1e-8) {
          const d = Math.sqrt(sq);
          pos.x += (dx / d) * (PLAYER_RADIUS - d);
          pos.z += (dz / d) * (PLAYER_RADIUS - d);
        } else {
          const toMinX = pos.x - box.min[0] + PLAYER_RADIUS, toMaxX = box.max[0] - pos.x + PLAYER_RADIUS;
          const toMinZ = pos.z - box.min[2] + PLAYER_RADIUS, toMaxZ = box.max[2] - pos.z + PLAYER_RADIUS;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) pos.x = box.min[0] - PLAYER_RADIUS;
          else if (m === toMaxX) pos.x = box.max[0] + PLAYER_RADIUS;
          else if (m === toMinZ) pos.z = box.min[2] - PLAYER_RADIUS;
          else pos.z = box.max[2] + PLAYER_RADIUS;
        }
        moved = true;
      }
      if (!moved) break;
    }
  }

  /**
   * Walk one leg from a seated start toward a target, stride by stride, with the
   * player's capsule, step-up and headroom. Legs are cached by their endpoints,
   * so a corridor shared by many journeys is walked once and reused.
   */
  walk(from: Waypoint, to: Waypoint): LegResult {
    const key = `${from.at.join(',')}>${to.at.join(',')}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const label = `${from.label} → ${to.label}`;
    const pad = PLAYER_RADIUS + SLIDE * 2 + UNKNOWN_MARGIN + 0.5;
    const lo = [Math.min(from.at[0], to.at[0]) - pad, Math.min(from.at[2], to.at[2]) - pad];
    const hi = [Math.max(from.at[0], to.at[0]) + pad, Math.max(from.at[2], to.at[2]) + pad];
    const nearLeg = this.obstacles.filter(({ box }) => box.max[0] >= lo[0] && box.min[0] <= hi[0] && box.max[2] >= lo[1] && box.min[2] <= hi[1]);
    const overlay = nearLeg.filter((item) => item.solid && !item.live && !item.estimated);
    const clipCandidates = nearLeg.filter((item) => !item.solid && !item.estimated);
    const estimates = nearLeg.filter((item) => item.estimated);

    const pos = { x: from.at[0], y: from.at[1], z: from.at[2] };
    const samples: Vec3[] = [];
    let steps = 0;
    const finish = (ok: boolean, reason: string | null): LegResult => {
      const end = vec(pos);
      let metres = 0;
      for (let k = 1; k < samples.length; k++) metres += Math.hypot(samples[k][0] - samples[k - 1][0], samples[k][2] - samples[k - 1][2]);
      const clipping = new Map<string, JuryAffected>();
      const unknown = new Map<string, JuryAffected>();
      for (const p of samples) {
        for (const item of clipCandidates) {
          if (!clipping.has(item.id) && inBand(p[1], item.box) && boxXZDistance(p[0], p[2], item.box) < PLAYER_RADIUS) {
            clipping.set(item.id, { kind: 'placement', id: item.id, label: item.label, position: centre(item.box) });
          }
        }
        for (const item of estimates) {
          if (!unknown.has(item.id) && inBand(p[1], item.box) && boxXZDistance(p[0], p[2], item.box) < PLAYER_RADIUS + UNKNOWN_MARGIN) {
            unknown.set(item.id, { kind: 'placement', id: item.id, label: item.label, position: centre(item.box) });
          }
        }
      }
      const blockers: JuryAffected[] = [];
      if (!ok) {
        const reach = PLAYER_RADIUS + 0.25;
        // On a slope the push-back can drop the visitor below what stopped them; judge the band over recent strides.
        const recent = samples.slice(-12).map((p) => p[1]).concat(pos.y);
        const lowY = Math.min(...recent), highY = Math.max(...recent);
        const inRecentBand = (b: SceneBounds) => b.max[1] > lowY + WALKABLE_HEIGHT && b.min[1] < highY + PLAYER_HEIGHT;
        for (const item of nearLeg) {
          if (item.estimated || !item.solid) continue;
          if (inRecentBand(item.box) && boxXZDistance(pos.x, pos.z, item.box) <= reach) {
            blockers.push({ kind: 'placement', id: item.id, label: item.label, position: centre(item.box) });
          }
        }
        if (!blockers.length) {
          for (const wall of this.walls) {
            const box: SceneBounds = { min: [wall.minX, wall.minY, wall.minZ], max: [wall.maxX, wall.maxY, wall.maxZ] };
            if (!inRecentBand(box)) continue;
            if (boxXZDistance(pos.x, pos.z, box) <= reach) blockers.push({ kind: 'collider', id: wall.id, label: `${this.colliderLabel} ${wall.id}`, position: centre(box) });
            if (blockers.length >= 5) break;
          }
        }
        if (!blockers.length) blockers.push({ kind: 'waypoint', id: to.label, label: `${label} (unattributed museum geometry)`, position: end });
      }
      const result: LegResult = { label, from: from.at, to: to.at, ok, reason, end, steps, metres: round(metres),
        blockers, clipping: [...clipping.values()], unknown: [...unknown.values()] };
      this.steps += steps;
      this.metres += metres;
      this.cache.set(key, result);
      return result;
    };

    const target = to.at;
    const dx = target[0] - pos.x, dz = target[2] - pos.z;
    const distance = Math.hypot(dx, dz);
    const start = this.world.supportHeight(pos.x, pos.z, pos.y + 2, 3);
    if (start === null) return finish(false, 'no floor under the start of this leg');
    pos.y = start;
    samples.push(vec(pos));
    if (distance < 1e-3) return finish(true, null);
    const budget = Math.max(1, Math.ceil(distance / STEP));
    const ux = dx / distance, uz = dz / distance;
    let best = distance;
    let stalled = 0;
    for (let i = 0; i < budget; i++) {
      steps++;
      const prevX = pos.x, prevZ = pos.z;
      pos.x += ux * STEP;
      pos.z += uz * STEP;
      this.resolve(pos, overlay);
      const support = this.world.supportHeight(pos.x, pos.z, pos.y, STEP_UP);
      if (support === null) return finish(false, 'walked over a hole in the floor');
      if (support - pos.y > STEP_UP + 1e-6) return finish(false, `step of ${(support - pos.y).toFixed(2)} m exceeds the ${STEP_UP} m step-up limit`);
      pos.y = support;
      const ceiling = this.world.ceilingHeight(pos.x, pos.z, pos.y);
      if (Number.isFinite(ceiling) && ceiling - pos.y < PLAYER_HEIGHT) {
        return finish(false, `headroom ${(ceiling - pos.y).toFixed(2)} m is below the ${PLAYER_HEIGHT} m visitor height`);
      }
      samples.push(vec(pos));
      const remaining = Math.hypot(target[0] - pos.x, target[2] - pos.z);
      if (remaining <= STEP) return finish(true, null);
      if (remaining < best - 1e-3) { best = remaining; stalled = 0; continue; }
      stalled++;
      // A lateral nudge around a pier, as a real visitor would.
      let recovered = false;
      for (const side of [SLIDE, -SLIDE, SLIDE * 2, -SLIDE * 2]) {
        const probe = { x: prevX - uz * side + ux * STEP, y: pos.y, z: prevZ + ux * side + uz * STEP };
        this.resolve(probe, overlay);
        const probeRemaining = Math.hypot(target[0] - probe.x, target[2] - probe.z);
        if (probeRemaining < best - 1e-3 && this.world.supportHeight(probe.x, probe.z, pos.y, STEP_UP) !== null) {
          pos.x = probe.x; pos.z = probe.z; best = probeRemaining; stalled = 0; recovered = true;
          samples.push(vec(pos));
          break;
        }
      }
      if (!recovered && stalled >= STALL_LIMIT) return finish(false, 'blocked');
    }
    const left = Math.hypot(target[0] - pos.x, target[2] - pos.z);
    return left > STEP ? finish(false, `ran out of steps ${left.toFixed(2)} m short of the target`) : finish(true, null);
  }

  /** Walk consecutive waypoints; every leg is walked (failures do not hide later legs). */
  journey(points: readonly Waypoint[]): LegResult[] {
    const out: LegResult[] = [];
    for (let k = 0; k + 1 < points.length; k++) out.push(this.walk(points[k], points[k + 1]));
    return out;
  }
}

/** Verdict over walked legs: FAIL if any leg was blocked, WARNING for clipping through non-solid objects, UNKNOWN near unknown bounds. */
function judgeLegs(legs: readonly LegResult[], passText: string): JuryCheck {
  if (!legs.length) return { status: 'NOT TESTED', detail: 'No leg was walked.', affected: [] };
  const failed = legs.filter((leg) => !leg.ok);
  if (failed.length) {
    return { status: 'FAIL', affected: uniq(failed.flatMap((leg) => leg.blockers)),
      detail: failed.map((leg) => `${leg.label}: ${leg.reason} at ${fmt(leg.end)}, blocked by ${leg.blockers.map((b) => b.label).join(', ')}`).join('; ') + '.' };
  }
  const clipping = uniq(legs.flatMap((leg) => leg.clipping));
  if (clipping.length) {
    return { status: 'WARNING', affected: clipping,
      detail: `${passText} but the visitor walks through non-solid ${clipping.map((item) => item.label).join(', ')}.` };
  }
  const unknown = uniq(legs.flatMap((leg) => leg.unknown));
  if (unknown.length) {
    return { status: 'UNKNOWN', affected: unknown,
      detail: `${passText} Placement bounds near the path are not known yet (${unknown.map((item) => item.label).join(', ')}); rerun once models have loaded.` };
  }
  return { status: 'PASS', detail: passText, affected: [] };
}

const totalMetres = (legs: readonly LegResult[]) => Math.round(legs.reduce((sum, leg) => sum + leg.metres, 0));

/** Authored placements in one world (or shared) as obstacles from known bounds, plus that world's walls. */
function obstaclesFor(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest, worldId: 'interior' | 'exterior') {
  const records = new Map(manifest.objects.map((record) => [record.id, record]));
  const colliders = index.collisions[worldId] ?? [];
  const liveIds = new Set(colliders.filter((collider) => collider.ownership === 'dynamic')
    .map((collider) => collider.id.replace(/^(wall|floor):/, '').replace(/:segment-\d+$/, '')));
  const obstacles: Obstacle[] = [];
  let estimatedCount = 0;
  for (const item of index.authored) {
    if (item.world !== worldId && item.world !== 'shared') continue;
    const record = records.get(item.id);
    if (!record || record.prefab === 'floor-slab') continue;
    const solid = item.collision === 'solid';
    if (item.bounds) {
      obstacles.push({ id: item.id, label: item.label, box: item.bounds, solid, estimated: false, live: solid && liveIds.has(item.id) });
    } else if (item.resident === null) {
      // No live Builder: judge from the catalogue footprint, as Narrative Gravity does.
      estimatedCount++;
      obstacles.push({ id: item.id, label: item.label, box: estimatedBounds(record), solid, estimated: false, live: false });
    } else {
      obstacles.push({ id: item.id, label: item.label, box: estimatedBounds(record), solid, estimated: true, live: false });
    }
  }
  const walls = colliders.flatMap((collider) => (collider.kind === 'wall' ? [{
    id: collider.id, minX: collider.minX, maxX: collider.maxX, minY: collider.minY, maxY: collider.maxY, minZ: collider.minZ, maxZ: collider.maxZ }] : []));
  return { obstacles, walls, estimatedCount };
}

/**
 * Deterministic, headless Virtual Visitor Jury. Simulated visitors walk the
 * canonical route through the supplied interior collision world with the
 * player's capsule and step rules (no teleport, no straight-line shortcut
 * through geometry), treating authored placements as obstacles from their
 * known bounds. For each of the 35 exhibits it reports whether the visitor
 * reaches the visitor spot, sees the hero past authored placements, and walks
 * back to the main entrance; it also walks both grand stairs, the Sanctuary
 * and every major route section. It reads only; nothing is moved or saved.
 */
export function visitorJury(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest, world: CollisionWorld | null): VisitorJuryReport {
  const levelOf = new Map(index.wings.map((wing) => [wing.id, wing.level]));
  const notTested = (detail: string): JuryCheck => ({ status: 'NOT TESTED', detail, affected: [] });
  if (!world) {
    const why = 'No interior collision world is loaded, so no visitor was walked.';
    const route = (id: string, label: string): JuryRouteVerdict => ({ id, label, legs: 0, ...notTested(why) });
    const exhibits = index.exhibits.map((exhibit) => ({ exhibitId: exhibit.id, wing: exhibit.wing, level: levelOf.get(exhibit.wing) ?? 0,
      status: 'NOT TESTED' as const, arrival: null, reached: notTested(why), visible: notTested(why), returns: notTested(why) }));
    const counts = { PASS: 0, FAIL: 0, WARNING: 0, 'NOT TESTED': exhibits.length, UNKNOWN: 0 };
    return { status: 'NOT TESTED', exhibits, routes: [], stairs: index.stairs.map((stair) => route(`stair:${stair.id}`, stair.id)),
      sanctuary: route('sanctuary', 'Dexter Sanctuary'), floors: [...new Set(levelOf.values())].sort().map((level) => ({ level, status: 'NOT TESTED' as const,
        exhibits: exhibits.filter((item) => item.level === level).length })),
      counts, walked: { legs: 0, steps: 0, metres: 0 }, summary: why, limitations: [why] };
  }

  const { obstacles, walls, estimatedCount } = obstaclesFor(index, manifest, 'interior');
  const walker = new Walker(world, obstacles, walls);

  const route: Waypoint[] = index.route.map((point) => ({ label: point.label, at: point.position }));
  const wingOf = (label: string) => /^([a-z]+): /.exec(label)?.[1] ?? null;
  // The spine is the canonical route without bay detours; exhibits walk it without other wings' halls.
  const spine = index.route.filter((point) => !point.exhibitId).map((point) => ({ label: point.label, at: point.position }));
  const entranceIndex = spine.findIndex((point) => point.label === 'main entrance');
  const sanctuaryIndex = spine.findIndex((point) => point.label === 'dexter sanctuary');

  // ── Exhibits ────────────────────────────────────────────────────────────────
  const exhibits: JuryExhibitVerdict[] = index.exhibits.map((exhibit) => {
    const level = levelOf.get(exhibit.wing) ?? 0;
    const hallIndex = spine.findIndex((point) => point.label === `${exhibit.wing}: outside ${exhibit.id}`);
    if (hallIndex < 0) {
      const why = `${exhibit.id} has no hall waypoint on the canonical route.`;
      return { exhibitId: exhibit.id, wing: exhibit.wing, level, status: 'UNKNOWN' as const, arrival: null,
        reached: { status: 'UNKNOWN' as const, detail: why, affected: [] }, visible: notTested(why), returns: notTested(why) };
    }
    const path = spine.slice(0, hallIndex + 1).filter((point) => {
      const wing = wingOf(point.label);
      return wing === null || wing === exhibit.wing;
    });
    const spot: Waypoint = { label: `${exhibit.id} visitor spot`, at: exhibit.visitorSpot };
    const hall = spine[hallIndex];
    const corridor = walker.journey(path);
    const bayIn = walker.walk(hall, spot);
    const corridorCheck = judgeLegs(corridor, '');

    // Reached: actually standing at the visitor spot (within one stride).
    let reached: JuryCheck;
    let arrival: Vec3 | null = null;
    if (corridorCheck.status === 'FAIL') {
      reached = { ...corridorCheck, detail: `Never reached the ${exhibit.wing} hall: ${corridorCheck.detail}` };
    } else {
      arrival = bayIn.end;
      const short = Math.hypot(arrival[0] - exhibit.visitorSpot[0], arrival[2] - exhibit.visitorSpot[2]);
      const legs = [...corridor, bayIn];
      const walked = `Walked ${legs.length} legs (${totalMetres(legs)} m) from the arrival plaza and stood ${short.toFixed(2)} m from the visitor spot.`;
      if (bayIn.ok) {
        reached = judgeLegs(legs, walked);
      } else if (short <= INTERACTION_REACH) {
        reached = { status: 'WARNING', affected: bayIn.blockers,
          detail: `Stopped ${short.toFixed(2)} m short of the visitor spot (inside the ${INTERACTION_REACH} m interaction reach): ${bayIn.reason} at ${fmt(bayIn.end)}, blocked by ${bayIn.blockers.map((b) => b.label).join(', ')}.` };
      } else {
        reached = { status: 'FAIL', affected: bayIn.blockers,
          detail: `Stopped ${short.toFixed(2)} m from the visitor spot, beyond the ${INTERACTION_REACH} m interaction reach: ${bayIn.reason} at ${fmt(bayIn.end)}, blocked by ${bayIn.blockers.map((b) => b.label).join(', ')}.` };
      }
    }

    // Visible: eye-height sightline to the hero focus, past authored placements.
    const eye: Vec3 = arrival ?? exhibit.visitorSpot;
    const from: Vec3 = [eye[0], eye[1] + EYE_HEIGHT, eye[2]];
    const to: Vec3 = [exhibit.anchor[0], exhibit.anchor[1] + HERO_FOCUS_HEIGHT, exhibit.anchor[2]];
    const asSubject = (item: Obstacle): JuryAffected => ({ kind: 'placement', id: item.id, label: item.label, position: centre(item.box) });
    const known = obstacles.filter((item) => !item.estimated);
    const hard = known.filter((item) => segmentHitsBox(from, to, item.box));
    const grow = (b: SceneBounds): SceneBounds => ({ min: [b.min[0] - SIGHTLINE_HALF_WIDTH, b.min[1] - SIGHTLINE_HALF_WIDTH, b.min[2] - SIGHTLINE_HALF_WIDTH],
      max: [b.max[0] + SIGHTLINE_HALF_WIDTH, b.max[1] + SIGHTLINE_HALF_WIDTH, b.max[2] + SIGHTLINE_HALF_WIDTH] });
    const soft = known.filter((item) => !hard.includes(item) && segmentHitsBox(from, to, grow(item.box)));
    const unsure = obstacles.filter((item) => item.estimated && segmentHitsBox(from, to, grow(item.box)));
    const viewpoint = arrival ? 'where the visitor stood' : 'the canonical visitor spot (the approach was not completed)';
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]).toFixed(2);
    const visible: JuryCheck = hard.length
      ? { status: 'FAIL', affected: hard.map(asSubject), detail: `The eye-height sightline from ${viewpoint} to the ${exhibit.id} hero is blocked by ${hard.map((item) => item.label).join(', ')}.` }
      : soft.length
        ? { status: 'WARNING', affected: soft.map(asSubject), detail: `${soft.map((item) => item.label).join(', ')} intrudes within ${SIGHTLINE_HALF_WIDTH} m of the sightline to the ${exhibit.id} hero.` }
        : unsure.length
          ? { status: 'UNKNOWN', affected: unsure.map(asSubject), detail: `Bounds of ${unsure.map((item) => item.label).join(', ')} near the sightline are not known yet.` }
          : { status: 'PASS', affected: [], detail: `Clear ${distance} m eye-height sightline from ${viewpoint} to the hero; no authored placement within ${SIGHTLINE_HALF_WIDTH} m of it.` };

    // Returns: from where the visitor stands, back out of the bay and along the corridor to the main entrance.
    const startBack: Waypoint = { label: `${exhibit.id} visitor spot`, at: arrival ?? exhibit.visitorSpot };
    const back = [walker.walk(startBack, hall), ...walker.journey([...path].reverse().slice(0, path.length - entranceIndex))];
    const returnsCheck = judgeLegs(back, `Walked ${back.length} legs (${totalMetres(back)} m) from ${arrival ? 'where the visitor stood' : 'the visitor spot'} back to the main entrance.`);

    return { exhibitId: exhibit.id, wing: exhibit.wing, level, arrival,
      status: worstJuryStatus([reached.status, visible.status, returnsCheck.status]), reached, visible, returns: returnsCheck };
  });

  // ── Major routes: the whole canonical route, every bay detour included, judged by section ──
  const canonicalLegs = walker.journey(route);
  const sectionOf = (leg: LegResult): { id: string; label: string } => {
    const [a, b] = leg.label.split(' → ');
    const wing = wingOf(a) ?? wingOf(b);
    if (wing) return { id: `hall:${wing}`, label: `${wing[0].toUpperCase()}${wing.slice(1)} wing hall` };
    const text = `${a} ${b}`;
    if (text.includes('stair')) return { id: 'stairs', label: 'Grand stair (canonical)' };
    if (text.includes('sanctuary')) return { id: 'sanctuary-route', label: 'Sanctuary approach and return' };
    if (text.includes('balcony')) return { id: 'balcony', label: 'Upper balcony ring' };
    if (text.includes('rotunda ring')) return { id: 'rotunda', label: 'Rotunda ring' };
    return { id: 'entrance', label: 'Arrival plaza, entrance and vestibule' };
  };
  const sections = new Map<string, { label: string; legs: LegResult[] }>();
  sections.set('canonical', { label: 'Whole canonical route', legs: canonicalLegs });
  for (const leg of canonicalLegs) {
    const { id, label } = sectionOf(leg);
    if (!sections.has(id)) sections.set(id, { label, legs: [] });
    sections.get(id)!.legs.push(leg);
  }
  const routes: JuryRouteVerdict[] = [...sections].map(([id, { label, legs }]) => ({ id, label, legs: legs.length,
    ...judgeLegs(legs, `Walked ${legs.length} legs (${totalMetres(legs)} m) without a break.`) }));

  // ── Both grand stairs, up and down, from the rotunda floor to the balcony ring ──
  const stairs: JuryRouteVerdict[] = index.stairs.map((stair) => {
    const mid = stair.path[Math.floor(stair.path.length / 2)];
    const len = Math.hypot(mid[0], mid[2]) || 1;
    const ground: Waypoint = { label: `rotunda floor below ${stair.id}`, at: [round(mid[0] / len * RING_RADIUS), stair.from[1], round(mid[2] / len * RING_RADIUS)] };
    const balcony: Waypoint = { label: `balcony above ${stair.id}`, at: [round(mid[0] / len * BALCONY_RING_RADIUS), stair.to[1], round(mid[2] / len * BALCONY_RING_RADIUS)] };
    const treads = stair.path.map((at, k) => ({ label: `${stair.id} ${k === 0 ? 'foot' : k === stair.path.length - 1 ? 'head' : `rise ${k}`}`, at }));
    const up = walker.journey([ground, ...treads, balcony]);
    const down = walker.journey([balcony, ...[...treads].reverse(), ground]);
    const legs = [...up, ...down];
    const check = judgeLegs(legs, `Walked up (${totalMetres(up)} m) and back down (${totalMetres(down)} m) between floor ${stair.from[1]} m and the balcony at ${stair.to[1]} m.`);
    return { id: `stair:${stair.id}`, label: stair.id, legs: legs.length, ...check,
      affected: check.affected.length || check.status === 'PASS' ? check.affected : [{ kind: 'stair', id: stair.id, label: stair.id, position: stair.from }] };
  });

  // ── Dexter Sanctuary: from the entrance by the shortest canonical way in, then back out ──
  let sanctuary: JuryRouteVerdict;
  if (sanctuaryIndex < 0 || entranceIndex < 0) {
    sanctuary = { id: 'sanctuary', label: 'Dexter Sanctuary', legs: 0, status: 'UNKNOWN', detail: 'The canonical route has no Sanctuary waypoint.', affected: [] };
  } else {
    const tail = spine.slice(sanctuaryIndex);
    const inward = walker.journey([spine[0], ...[...tail].reverse()]);
    const outward = walker.journey(tail);
    const end = inward[inward.length - 1].end;
    const near = Math.hypot(end[0] - index.sanctuary[0], end[2] - index.sanctuary[2]);
    const legs = [...inward, ...outward];
    sanctuary = { id: 'sanctuary', label: 'Dexter Sanctuary', legs: legs.length,
      ...judgeLegs(legs, `Walked from the arrival plaza down into the Sanctuary (${totalMetres(inward)} m, ending ${near.toFixed(1)} m from its centre) and back to the main entrance (${totalMetres(outward)} m).`) };
  }

  // ── Floors and totals ────────────────────────────────────────────────────────
  const levels = [...new Set(index.wings.map((wing) => wing.level))].sort((a, b) => a - b);
  const floors = levels.map((level) => {
    const own = exhibits.filter((item) => item.level === level);
    const stairStatus = level > 0 ? stairs.map((item) => item.status) : [];
    return { level, exhibits: own.length, status: worstJuryStatus([...own.map((item) => item.status), ...stairStatus]) };
  });
  const counts = { PASS: 0, FAIL: 0, WARNING: 0, 'NOT TESTED': 0, UNKNOWN: 0 } as Record<JuryStatus, number>;
  for (const item of exhibits) counts[item.status]++;
  const status = worstJuryStatus([...exhibits.map((item) => item.status), ...routes.map((item) => item.status),
    ...stairs.map((item) => item.status), sanctuary.status]);
  const tally = (Object.entries(counts) as [JuryStatus, number][]).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(', ');
  const badRoutes = [...routes, ...stairs, sanctuary].filter((item) => item.status !== 'PASS');
  const metres = Math.round(walker.metres);
  const summary = `${exhibits.length} exhibits (${tally}); ${routes.length} route sections, ${stairs.length} stairs and the Sanctuary`
    + `${badRoutes.length ? `, of which ${badRoutes.map((item) => `${item.label} ${item.status}`).join(', ')}` : ' all walked without a break'}`
    + `. ${walker.legs} distinct legs, ${walker.steps} strides, ${metres} m walked through the collision world.`;
  const limitations = [
    `Movement uses the player capsule (radius ${PLAYER_RADIUS} m, height ${PLAYER_HEIGHT} m), ${STEP} m strides, ${STEP_UP} m step-up, headroom and floor support from the supplied collision world; lateral slides of up to ${SLIDE * 2} m get round piers. It is a simulation, not a device or browser play-through.`,
    'Each leg starts at its waypoint and must arrive within one stride of the next; legs shared by several journeys are walked once and reused.',
    'Exhibit approaches follow the canonical route from the arrival plaza, skipping other wings\' halls; returns retrace it to the main entrance.',
    `Hero visibility is one eye-height (${EYE_HEIGHT} m) ray to the hero focus, widened by ${SIGHTLINE_HALF_WIDTH} m, tested against authored placements only; original architecture and exhibit dressing are treated as intended.`,
    'Placement bounds are axis-aligned; non-solid placements do not block movement but are reported when the visitor walks through them.',
    ...(estimatedCount ? [`${estimatedCount} placement(s) were judged from catalogue footprints because no live Builder supplied their bounds.`] : []),
  ];
  return { status, exhibits, routes, stairs, sanctuary, floors, counts,
    walked: { legs: walker.legs, steps: walker.steps, metres }, summary, limitations };
}

/** Every placement, collider or waypoint named by a non-passing verdict, once each. */
export function juryAffected(report: VisitorJuryReport): JuryAffected[] {
  const checks: JuryCheck[] = [
    ...report.exhibits.flatMap((item) => [item.reached, item.visible, item.returns]),
    ...report.routes, ...report.stairs, report.sanctuary,
  ];
  return uniq(checks.filter((check) => check.status !== 'PASS').flatMap((check) => check.affected));
}

export interface ExteriorJuryReport {
  readonly status: JuryStatus;
  /** Arrival from the pier to the museum door and back, the pier, and each island path. */
  readonly routes: readonly JuryRouteVerdict[];
  readonly walked: { readonly legs: number; readonly steps: number; readonly metres: number };
  readonly summary: string;
  readonly limitations: readonly string[];
}

/** Waypoints at the island's support height; the walker seats each leg on the floor below. */
const islandPoint = (label: string, x: number, z: number, y = LAND_SUPPORT_Y): Waypoint => ({ label, at: [x, y, z] });

/**
 * The exterior counterpart of the jury: the same walker, on the exterior
 * collision world, along the authored island layout. It never reports PASS for
 * a route it did not walk, and it reads only.
 */
export function exteriorJury(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest, world: CollisionWorld | null): ExteriorJuryReport {
  const ids: [string, string][] = [['exterior:arrival', 'Arrival: pier to museum door and back'], ['exterior:pier', 'Arrival pier'],
    ...PATH_CENTERLINES.map((_, k): [string, string] => [`exterior:path-${k + 1}`, `Island path ${k + 1}`])];
  if (!world) {
    const why = 'No exterior collision world is loaded, so no visitor was walked outside.';
    return { status: 'NOT TESTED', routes: ids.map(([id, label]) => ({ id, label, legs: 0, status: 'NOT TESTED' as const, detail: why, affected: [] })),
      walked: { legs: 0, steps: 0, metres: 0 }, summary: why, limitations: [why] };
  }
  const { obstacles, walls, estimatedCount } = obstaclesFor(index, manifest, 'exterior');
  const walker = new Walker(world, obstacles, walls, 'exterior collider');
  const start = islandPoint('arrival pier start', START_POSITION[0], START_POSITION[2], START_POSITION[1]);
  const door = islandPoint('museum door', index.threshold.exterior[0], index.threshold.exterior[2], index.threshold.exterior[1]);
  const plaza = islandPoint('arrival plaza', PIER_CENTERLINE[0][0], PIER_CENTERLINE[0][1], 0);
  const pier = PIER_CENTERLINE.map(([x, z], k) => islandPoint(`pier ${k + 1}`, x, z));
  const arrivalIn = walker.journey([start, pier[1], plaza, door]);
  const arrivalOut = walker.journey([door, plaza, pier[1], start]);
  const pierLegs = [...walker.journey(pier), ...walker.journey([...pier].reverse())];
  const routes: JuryRouteVerdict[] = [
    { id: ids[0][0], label: ids[0][1], legs: arrivalIn.length + arrivalOut.length,
      ...judgeLegs([...arrivalIn, ...arrivalOut], `Walked from the pier start to the museum door (${totalMetres(arrivalIn)} m) and back (${totalMetres(arrivalOut)} m).`) },
    { id: ids[1][0], label: ids[1][1], legs: pierLegs.length, ...judgeLegs(pierLegs, `Walked the pier end to end and back (${totalMetres(pierLegs)} m).`) },
    ...PATH_CENTERLINES.map((line, k) => {
      const legs = walker.journey(line.map(([x, z], n) => islandPoint(`path ${k + 1} point ${n + 1}`, x, z)));
      return { id: ids[k + 2][0], label: ids[k + 2][1], legs: legs.length, ...judgeLegs(legs, `Walked island path ${k + 1} (${totalMetres(legs)} m).`) };
    }),
  ];
  const status = worstJuryStatus(routes.map((item) => item.status));
  const bad = routes.filter((item) => item.status !== 'PASS');
  return { status, routes,
    walked: { legs: walker.legs, steps: walker.steps, metres: Math.round(walker.metres) },
    summary: `${routes.length} exterior routes${bad.length ? `, of which ${bad.map((item) => `${item.label} ${item.status}`).join(', ')}` : ' all walked without a break'}. ${walker.legs} legs, ${walker.steps} strides, ${Math.round(walker.metres)} m.`,
    limitations: ['Exterior routes follow the authored pier and island path centrelines with the same capsule and step rules as inside; scenery off those paths is not walked.',
      ...(estimatedCount ? [`${estimatedCount} exterior placement(s) were judged from catalogue footprints.`] : [])] };
}

/** Every placement, collider or waypoint named by a non-passing exterior route, once each. */
export function exteriorJuryAffected(report: ExteriorJuryReport): JuryAffected[] {
  return uniq(report.routes.filter((route) => route.status !== 'PASS').flatMap((route) => route.affected));
}
