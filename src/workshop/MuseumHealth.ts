import type { Vec3 } from '../world/layout';
import type { AuthorableSceneEntry } from './AuthorableSceneRegistry';
import { clearWalkways } from './ClearWalkways';
import { validateWorkshopConservation } from './conservation';
import { overlapsEmptyRegion } from './CuratorMemory';
import { scanAuthoredRouteClearance } from './RouteClearance';
import type { MuseumSceneIndex } from './SceneIndex';
import { exteriorJuryAffected, juryAffected, type ExteriorJuryReport, type VisitorJuryReport } from './VisitorJury';
import { WORKSHOP_MAX_OBJECTS, type WorkshopPlacementManifest } from './schema';

export type HealthStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT TESTED' | 'UNKNOWN';

/** A real thing a diagnostic is about, with where to find it when that is known. */
export interface HealthSubject {
  readonly kind: 'placement' | 'exhibit' | 'wing' | 'stair' | 'collider' | 'region';
  readonly id: string;
  readonly label: string;
  readonly world: 'exterior' | 'interior' | 'shared' | null;
  readonly position: Vec3 | null;
}

export interface HealthCheck {
  readonly id: string;
  readonly title: string;
  readonly status: HealthStatus;
  readonly detail: string;
  readonly affected: readonly HealthSubject[];
}

export interface MuseumHealthReport {
  /** The worst status of any check; a check that was not run can never be reported as passing. */
  readonly status: HealthStatus;
  readonly checks: readonly HealthCheck[];
  readonly counts: Readonly<Record<HealthStatus, number>>;
}

const SEVERITY: readonly HealthStatus[] = ['PASS', 'NOT TESTED', 'UNKNOWN', 'WARNING', 'FAIL'];
const worst = (statuses: readonly HealthStatus[]): HealthStatus =>
  statuses.reduce<HealthStatus>((a, b) => (SEVERITY.indexOf(b) > SEVERITY.indexOf(a) ? b : a), 'PASS');

/** The museum's protected structure: these counts are canon, not configuration. */
export const EXPECTED_STRUCTURE = { wings: 6, exhibits: 35, stairs: 2, levels: 2 } as const;

export interface MuseumHealthOptions {
  /** Original movable scene objects, so conservation also covers their overrides. */
  readonly sceneEntries?: readonly AuthorableSceneEntry[];
  /** True when the index was built with live placement bounds (a runtime was supplied). */
  readonly runtime?: boolean;
  /** A Virtual Visitor Jury run for this same manifest; without one the jury check stays NOT TESTED. */
  readonly jury?: VisitorJuryReport;
  /** The exterior jury (arrival, pier, island paths) for this same manifest; without one it stays NOT TESTED. */
  readonly exteriorJury?: ExteriorJuryReport;
}

/**
 * Read-only aggregate of the Builder's deterministic analyses. Nothing here
 * moves, saves or loads anything; each check says what it could not verify.
 */
export function museumHealth(index: MuseumSceneIndex, manifest: WorkshopPlacementManifest,
  options: MuseumHealthOptions = {}): MuseumHealthReport {
  const placementSubject = (id: string): HealthSubject => {
    const item = index.authored.find((entry) => entry.id === id);
    const record = manifest.objects.find((entry) => entry.id === id);
    const world = (item?.world ?? record?.worldId ?? null) as HealthSubject['world'];
    return { kind: 'placement', id, label: item?.label ?? record?.label ?? id, world,
      position: item?.position ?? (record ? [record.position[0], record.position[1], record.position[2]] : null) };
  };
  const checks: HealthCheck[] = [];

  // 1. Protected structure.
  const missing: HealthSubject[] = [];
  const levels = new Set(index.wings.map((wing) => wing.level));
  const exhibitCount = index.exhibits.length;
  for (const wing of index.wings) {
    for (const exhibit of wing.exhibits) {
      if (!index.exhibits.some((entry) => entry.id === exhibit)) missing.push({ kind: 'exhibit', id: exhibit, label: exhibit, world: 'interior', position: null });
    }
  }
  const structureOk = index.wings.length === EXPECTED_STRUCTURE.wings && exhibitCount === EXPECTED_STRUCTURE.exhibits
    && index.stairs.length === EXPECTED_STRUCTURE.stairs && levels.size === EXPECTED_STRUCTURE.levels && missing.length === 0;
  checks.push({ id: 'structure', title: 'Protected museum structure', status: structureOk ? 'PASS' : 'FAIL',
    detail: `${index.wings.length}/${EXPECTED_STRUCTURE.wings} wings, ${exhibitCount}/${EXPECTED_STRUCTURE.exhibits} exhibits, ${index.stairs.length}/${EXPECTED_STRUCTURE.stairs} stairs, ${levels.size}/${EXPECTED_STRUCTURE.levels} levels, as derived from the museum layout.`,
    affected: missing });

  // 2. Conservation of protected areas.
  const conservation = validateWorkshopConservation(manifest, options.sceneEntries ?? []);
  checks.push({ id: 'conservation', title: 'Protected areas and circulation', status: conservation.ok ? 'PASS' : 'FAIL',
    detail: conservation.ok
      ? `${manifest.objects.length} placement(s)${options.sceneEntries ? ` and ${options.sceneEntries.length} original object(s)` : ''} respect every protected area.`
      : conservation.violations.map((violation) => `${violation.placementLabel}: ${violation.reason}`).join(' '),
    affected: conservation.violations.map((violation) => placementSubject(violation.placementId)) });

  // 3. Clear walkways.
  if (!options.runtime) {
    checks.push({ id: 'walkways', title: 'Clear walkways', status: 'NOT TESTED',
      detail: 'Placement bounds are only known from the running Builder; open it to test walkways.', affected: [] });
  } else {
    const walkways = clearWalkways(index, manifest);
    checks.push({ id: 'walkways', title: 'Clear walkways', status: walkways.status,
      detail: walkways.findings.length
        ? `${walkways.findings.length} placement(s) intrude on ${walkways.walkways} protected walkways: ${walkways.findings
          .map((finding) => `${finding.label} (${finding.severity}, ${finding.walkways.map((walkway) => walkway.label).join(', ')})`).join('; ')}.`
        : `No placement intrudes on ${walkways.walkways} protected walkways. ${walkways.limitations.join(' ')}`,
      affected: walkways.findings.map((finding) => placementSubject(finding.objectId)) });
  }

  // 4. Route collision scan (advisory; never a full traversal PASS).
  if (!index.collisions.exterior || !index.collisions.interior) {
    checks.push({ id: 'route-collision', title: 'Route collision scan', status: 'NOT TESTED',
      detail: 'Both collision worlds must be loaded to scan the canonical route.', affected: [] });
  } else {
    const route = scanAuthoredRouteClearance(index);
    checks.push({ id: 'route-collision', title: 'Route collision scan', status: route.findings.length ? 'WARNING' : 'UNKNOWN',
      detail: route.findings.length
        ? `${route.findings.length} wall collider(s) may touch the visitor along the canonical route.`
        : `No dynamic wall touches the canonical route. Not proven: ${route.limitations.join(' ')}`,
      affected: route.findings.map((finding) => finding.objectId ? placementSubject(finding.objectId)
        : { kind: 'collider' as const, id: finding.colliderId, label: finding.colliderId, world: finding.world, position: null }) });
  }

  // 5. Bounds known for every placement (collision and analyses depend on them).
  const unknownBounds = index.authored.filter((item) => item.bounds === null);
  checks.push({ id: 'bounds', title: 'Placement bounds known', status: !options.runtime ? 'NOT TESTED' : unknownBounds.length ? 'UNKNOWN' : 'PASS',
    detail: !options.runtime ? 'Bounds are only known from the running Builder.'
      : unknownBounds.length ? `${unknownBounds.length} placement(s) have no known bounds yet (models still loading or unavailable).`
        : `All ${index.authored.length} placement(s) have known bounds.`,
    affected: options.runtime ? unknownBounds.map((item) => placementSubject(item.id)) : [] });

  // 6. Deliberately empty regions stay empty.
  const regions = manifest.curator?.emptyRegions ?? [];
  const occupants: HealthSubject[] = [];
  const occupiedRegions = new Set<string>();
  for (const item of index.authored) {
    const box = item.bounds ?? { min: item.position, max: item.position };
    const region = overlapsEmptyRegion(manifest, item.world, box);
    if (region) { occupants.push(placementSubject(item.id)); occupiedRegions.add(region.label); }
  }
  checks.push({ id: 'empty-regions', title: 'Deliberately empty areas', status: !regions.length ? 'PASS' : occupants.length ? 'WARNING' : 'PASS',
    detail: !regions.length ? 'No areas are marked as deliberately empty.'
      : occupants.length ? `${occupants.length} placement(s) occupy area(s) the curator marked empty: ${[...occupiedRegions].join(', ')}.`
        : `${regions.length} deliberately empty area(s) remain clear.`,
    affected: occupants });

  // 7. Capacity.
  const used = manifest.objects.length / WORKSHOP_MAX_OBJECTS;
  checks.push({ id: 'capacity', title: 'Placement capacity', status: used > 0.9 ? 'WARNING' : 'PASS',
    detail: `${manifest.objects.length} of ${WORKSHOP_MAX_OBJECTS} placements used (${Math.round(used * 100)}%).`, affected: [] });

  // 8–9. Honest gaps: never inferred, never fabricated.
  checks.push({ id: 'performance', title: 'Device frame time', status: 'NOT TESTED',
    detail: 'No device frame-time measurement has been recorded for this scene.', affected: [] });
  if (!options.jury) {
    checks.push({ id: 'visitor-jury', title: 'Virtual Visitor Jury', status: 'NOT TESTED',
      detail: 'No Virtual Visitor Jury has been run for this scene; run it to walk simulated visitors.', affected: [] });
  } else {
    const kinds = { placement: 'placement', collider: 'collider', exhibit: 'exhibit', stair: 'stair', waypoint: 'region' } as const;
    checks.push({ id: 'visitor-jury', title: 'Virtual Visitor Jury', status: options.jury.status, detail: options.jury.summary,
      affected: juryAffected(options.jury).map((item) => item.kind === 'placement' ? placementSubject(item.id)
        : { kind: kinds[item.kind], id: item.id, label: item.label, world: 'interior' as const, position: item.position }) });
  }
  if (!options.exteriorJury) {
    checks.push({ id: 'exterior-jury', title: 'Virtual Visitor Jury — exterior', status: 'NOT TESTED',
      detail: 'No exterior jury has been run for this scene; the arrival, pier and island paths have not been walked.', affected: [] });
  } else {
    const kinds = { placement: 'placement', collider: 'collider', exhibit: 'exhibit', stair: 'stair', waypoint: 'region' } as const;
    checks.push({ id: 'exterior-jury', title: 'Virtual Visitor Jury — exterior', status: options.exteriorJury.status, detail: options.exteriorJury.summary,
      affected: exteriorJuryAffected(options.exteriorJury).map((item) => item.kind === 'placement' ? placementSubject(item.id)
        : { kind: kinds[item.kind], id: item.id, label: item.label, world: 'exterior' as const, position: item.position }) });
  }

  const counts = { PASS: 0, FAIL: 0, WARNING: 0, 'NOT TESTED': 0, UNKNOWN: 0 } as Record<HealthStatus, number>;
  for (const check of checks) counts[check.status]++;
  return { status: worst(checks.map((check) => check.status)), checks, counts };
}
