import { COLLECTION, EXHIBITS_BY_ID, PROJECTS_BY_ID, projectsForExhibit, WINGS_BY_ID } from './collection.generated';
import { PROJECT_STAGE_LABEL, projectNameWithStage, projectStage, type ProjectStage } from './projectStage';
import type { ExhibitRecord, ProjectRecord, WingId } from './types';

/**
 * Derived reading relationships. Everything here is computed from the
 * generated collection: no fact, date or link is invented. Where the record is
 * silent (for example, it dates nearly every project only as "2026"), these
 * helpers stay silent too.
 */

function slug(text: string): string {
  return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Stable, readable in-page anchor for a project's section in an exhibit
 * reading ("#project-worldsvault"), so a single project can be linked to.
 * Falls back to the project id for anything outside the collection.
 */
export function projectAnchorId(projectId: string): string {
  const project = PROJECTS_BY_ID.get(projectId);
  return `project-${slug(project ? project.name : projectId) || slug(projectId)}`;
}

/** Stable in-page anchor for a wing's section in an index. */
export function wingAnchorId(wing: WingId): string {
  return `wing-${wing}`;
}

export interface RoomOutlineEntry {
  readonly project: ProjectRecord;
  readonly anchor: string;
  /** 1-based position in the room's authored project order. */
  readonly position: number;
  readonly stage: ProjectStage | null;
  readonly label: string;
}

/**
 * The projects of a room in the order the collection lists them (the authored
 * `projectIds` order), each with an anchor. Single-project rooms have no outline.
 */
export function roomOutline(record: ExhibitRecord): RoomOutlineEntry[] {
  const projects = projectsForExhibit(record.id);
  if (projects.length < 2) return [];
  return projects.map((project, index) => {
    const stage = projectStage(project.status);
    return {
      project,
      anchor: projectAnchorId(project.id),
      position: index + 1,
      stage,
      label: `${project.name} — ${project.kind}${stage ? ` · ${PROJECT_STAGE_LABEL[stage]}` : ''}`,
    };
  });
}

export type ConnectionKind = 'shared-source' | 'names' | 'named-by' | 'shared-capability';

export interface ProjectConnection {
  readonly kind: ConnectionKind;
  readonly other: ProjectRecord;
  readonly exhibit: ExhibitRecord;
  /** The repository or capability shared; empty for name references. */
  readonly detail: string;
  /** One plain sentence for the reader. */
  readonly text: string;
  readonly sameRoom: boolean;
}

const EXHIBIT_FOR_PROJECT = new Map<string, ExhibitRecord>();
for (const exhibit of COLLECTION.exhibits) for (const id of exhibit.projectIds) EXHIBIT_FOR_PROJECT.set(id, exhibit);

export function exhibitForProject(projectId: string): ExhibitRecord | undefined {
  return EXHIBIT_FOR_PROJECT.get(projectId);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A project's name and its slash-separated aliases ("Vibe Coding Nexus / DexGate Academy"). */
function nameAliases(project: ProjectRecord): string[] {
  return project.name.split(' / ').map((alias) => alias.trim()).filter((alias) => alias.length >= 4);
}

const ALIAS_PATTERNS = new Map<string, RegExp[]>(COLLECTION.projects.map((project) => [
  project.id,
  nameAliases(project).map((alias) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, 'u')),
]));

/** True when the project's own record text names the other project exactly. */
function names(project: ProjectRecord, other: ProjectRecord): boolean {
  const text = [project.status, project.brief, ...project.deep, project.lesson].join(' ');
  return (ALIAS_PATTERNS.get(other.id) ?? []).some((pattern) => pattern.test(text));
}

const ORDER: Record<ConnectionKind, number> = { 'shared-source': 0, names: 1, 'named-by': 2, 'shared-capability': 3 };

/**
 * Exact, record-backed links from one project to others: a public repository
 * both list, one record naming the other by name, or an identical capability.
 */
export function projectConnections(projectId: string): ProjectConnection[] {
  const project = PROJECTS_BY_ID.get(projectId);
  const home = EXHIBIT_FOR_PROJECT.get(projectId);
  if (!project || !home) return [];
  const capabilities = new Set(project.capabilities.map((capability) => capability.toLocaleLowerCase()));
  const out: ProjectConnection[] = [];
  for (const other of COLLECTION.projects) {
    if (other.id === project.id) continue;
    const exhibit = EXHIBIT_FOR_PROJECT.get(other.id);
    if (!exhibit) continue;
    const sameRoom = exhibit.id === home.id;
    const where = sameRoom ? 'in this room' : `in ${exhibit.id}`;
    for (const repo of other.repos.filter((repo) => project.repos.includes(repo))) {
      out.push({ kind: 'shared-source', other, exhibit, detail: repo, sameRoom, text: `Shares the repository ${repo} with ${other.name} (${where}).` });
    }
    const namesOther = names(project, other);
    const namedByOther = names(other, project);
    if (namesOther && namedByOther) {
      out.push({ kind: 'names', other, exhibit, detail: '', sameRoom, text: `This record and ${other.name} (${where}) name each other.` });
    } else if (namesOther) {
      out.push({ kind: 'names', other, exhibit, detail: '', sameRoom, text: `This record names ${other.name} (${where}).` });
    } else if (namedByOther) {
      out.push({ kind: 'named-by', other, exhibit, detail: '', sameRoom, text: `${other.name} (${where}) names this project in its record.` });
    }
    const sharedCapability = other.capabilities.find((capability) => capabilities.has(capability.toLocaleLowerCase()));
    if (sharedCapability && !sameRoom) {
      out.push({ kind: 'shared-capability', other, exhibit, detail: sharedCapability, sameRoom, text: `Shares the capability “${sharedCapability}” with ${other.name} (${where}).` });
    }
  }
  return out.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.exhibit.id.localeCompare(b.exhibit.id) || a.other.name.localeCompare(b.other.name));
}

export interface RoomSources {
  /** Distinct public repositories across the room, in authored order. */
  readonly repos: readonly string[];
  /** Projects in the room that list no public repository. */
  readonly withoutRepo: readonly ProjectRecord[];
}

export function roomSources(record: ExhibitRecord): RoomSources {
  const repos: string[] = [];
  const withoutRepo: ProjectRecord[] = [];
  for (const project of projectsForExhibit(record.id)) {
    if (project.repos.length === 0) withoutRepo.push(project);
    for (const repo of project.repos) if (!repos.includes(repo)) repos.push(repo);
  }
  return { repos, withoutRepo };
}

/** "3 public repositories · 1 project without a public repository" */
export function roomSourcesLine(record: ExhibitRecord): string {
  const { repos, withoutRepo } = roomSources(record);
  const parts = [repos.length === 0 ? 'No public repository listed' : `${repos.length} public repositor${repos.length === 1 ? 'y' : 'ies'}`];
  const total = projectsForExhibit(record.id).length;
  if (withoutRepo.length > 0 && repos.length > 0) parts.push(`${withoutRepo.length} of ${total} project${total === 1 ? '' : 's'} without one`);
  return parts.join(' · ');
}

/**
 * The lectern's "Represents" line. It carries each project's lifecycle stage
 * when it is not plainly active, so a visitor reading the physical lectern can
 * tell an experiment or a superseded line from living work. The canonical
 * status text is unchanged and stays in the deeper reading.
 */
export function lecternRepresentedLine(projects: readonly ProjectRecord[]): string {
  if (projects.length === 1) return `Represents ${projectNameWithStage(projects[0])}.`;
  return `Represents ${projects.length} projects: ${projects.map(projectNameWithStage).join(', ')}.`;
}

export interface WingVisitSummary {
  readonly wing: WingId;
  readonly name: string;
  readonly level: 0 | 1;
  readonly opened: readonly ExhibitRecord[];
  readonly notOpened: readonly ExhibitRecord[];
}

/**
 * For the journal: per wing, which rooms this browser has opened and which it
 * has not. Information for planning a return, never a score.
 */
export function wingVisitSummary(openedIds: Iterable<string>): WingVisitSummary[] {
  const opened = new Set(openedIds);
  return COLLECTION.wings.map((wing) => {
    const rooms = COLLECTION.exhibits.filter((exhibit) => exhibit.wing === wing.id);
    return {
      wing: wing.id,
      name: wing.name,
      level: wing.level,
      opened: rooms.filter((room) => opened.has(room.id)),
      notOpened: rooms.filter((room) => !opened.has(room.id)),
    };
  });
}

export type FloorName = 'ground floor' | 'upper floor';

export function exhibitFloor(exhibitId: string): FloorName | null {
  const exhibit = EXHIBITS_BY_ID.get(exhibitId);
  const wing = exhibit ? WINGS_BY_ID.get(exhibit.wing) : undefined;
  if (!wing) return null;
  return wing.level === 1 ? 'upper floor' : 'ground floor';
}

export interface ThreadLeg {
  readonly stopId: string;
  readonly floor: FloorName | null;
  /** How this stop is reached from the previous one, when the floor changes. */
  readonly floorChange: 'up' | 'down' | null;
  readonly sameWingAsPrevious: boolean;
}

/** Floor and stair changes along a route of exhibit ids, from the stop order alone. */
export function threadLegs(stopIds: readonly string[]): ThreadLeg[] {
  return stopIds.map((stopId, index) => {
    const floor = exhibitFloor(stopId);
    const previous = index > 0 ? stopIds[index - 1] : null;
    const previousFloor = previous ? exhibitFloor(previous) : null;
    const floorChange = previousFloor && floor && previousFloor !== floor ? (floor === 'upper floor' ? 'up' : 'down') : null;
    const sameWingAsPrevious = previous !== null && EXHIBITS_BY_ID.get(previous)?.wing === EXHIBITS_BY_ID.get(stopId)?.wing;
    return { stopId, floor, floorChange, sameWingAsPrevious };
  });
}

/** "Up a grand stair to the upper floor" / "Down a grand stair to the ground floor". */
export function floorChangeText(change: 'up' | 'down'): string {
  return change === 'up' ? 'Up a grand stair to the upper floor' : 'Down a grand stair to the ground floor';
}

/** "2 stair climbs · 1 descent" for a whole route, or null when it stays on one floor. */
export function threadFloorSummary(stopIds: readonly string[]): string | null {
  const legs = threadLegs(stopIds);
  const ups = legs.filter((leg) => leg.floorChange === 'up').length;
  const downs = legs.filter((leg) => leg.floorChange === 'down').length;
  const floors = new Set(legs.map((leg) => leg.floor).filter(Boolean));
  if (ups === 0 && downs === 0) return floors.size === 1 ? `Stays on the ${[...floors][0]}.` : null;
  const parts: string[] = [];
  if (ups) parts.push(`${ups} stair climb${ups === 1 ? '' : 's'}`);
  if (downs) parts.push(`${downs} descent${downs === 1 ? '' : 's'}`);
  return `Uses both floors: ${parts.join(' · ')} between stops.`;
}

/** "Stop 3 of 5" for the stop the floor guide points at, or null when the thread is closed. */
export function threadPositionText(stopIds: readonly string[], currentId: string | null): string | null {
  if (!currentId) return null;
  const index = stopIds.indexOf(currentId);
  return index < 0 ? null : `Stop ${index + 1} of ${stopIds.length}`;
}
