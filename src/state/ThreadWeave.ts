import { COLLECTION, EXHIBITS_BY_ID, projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import type { ActiveVisitThread, VisitThreadPreset } from './VisitThread';
import type { Journal } from './Journal';

export interface ThreadWeaveStop {
  readonly exhibitId: string;
  readonly selectionReason: string;
  readonly bridgeFromPrevious: string | null;
}

export interface ThreadWeave {
  readonly title: string;
  readonly opening: string;
  readonly stops: readonly ThreadWeaveStop[];
}

const PRESET_REASON: Record<VisitThreadPreset, string> = {
  highlights: 'It is one of the collection’s stronger anchor exhibits.',
  systems: 'Its projects expose systems, infrastructure, authority, or technical architecture.',
  making: 'It shows how work is authored, transformed, performed, or produced.',
  play: 'It rewards direct interaction, simulation, or playful exploration.',
  wildcard: 'It is a deliberate left turn chosen by the deterministic wildcard route.',
  bookmarks: 'You marked this exhibit as worth returning to.',
};

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'another', 'around', 'because', 'before', 'being',
  'between', 'built', 'could', 'from', 'have', 'into', 'itself', 'local', 'more', 'museum', 'only',
  'other', 'project', 'projects', 'same', 'system', 'systems', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'through', 'using', 'visitor', 'what', 'when', 'where', 'which', 'while',
  'with', 'without', 'work', 'works', 'would', 'your',
]);

function termsFor(exhibitId: string): Set<string> {
  const exhibit = EXHIBITS_BY_ID.get(exhibitId);
  if (!exhibit) return new Set();
  const projects = projectsForExhibit(exhibitId);
  const text = [
    exhibit.title, exhibit.copy.subtitle, exhibit.copy.plaque, exhibit.copy.problem, exhibit.copy.made,
    ...projects.flatMap((project) => [project.name, project.family, project.kind, project.lesson, ...project.capabilities]),
  ].join(' ').toLocaleLowerCase();
  return new Set(text.match(/[a-z0-9][a-z0-9+-]{2,}/g)?.filter((term) => !STOP_WORDS.has(term)) ?? []);
}

function sharedTerms(a: string, b: string): string[] {
  const left = termsFor(a);
  const right = termsFor(b);
  return [...left].filter((term) => right.has(term)).sort((x, y) => y.length - x.length || x.localeCompare(y)).slice(0, 3);
}

function bridge(aId: string, bId: string): string {
  const a = EXHIBITS_BY_ID.get(aId);
  const b = EXHIBITS_BY_ID.get(bId);
  if (!a || !b) return 'The route continues through another part of the collection.';
  const terms = sharedTerms(aId, bId);
  if (terms.length > 0) {
    return `${a.title} → ${b.title}: the connection runs through ${terms.join(', ')}.`;
  }
  if (a.wing === b.wing) {
    const wing = WINGS_BY_ID.get(a.wing);
    return `${a.title} → ${b.title}: two different problems inside ${wing?.name ?? a.wing}.`;
  }
  const aProjects = projectsForExhibit(aId);
  const bProjects = projectsForExhibit(bId);
  const aFamilies = new Set(aProjects.map((project) => project.family.toLocaleLowerCase()));
  const family = bProjects.find((project) => aFamilies.has(project.family.toLocaleLowerCase()))?.family;
  if (family) return `${a.title} → ${b.title}: both emerge from the ${family} project family, despite living in different rooms.`;
  return `${a.title} → ${b.title}: the thread changes domains here on purpose, moving from ${WINGS_BY_ID.get(a.wing)?.name ?? a.wing} to ${WINGS_BY_ID.get(b.wing)?.name ?? b.wing}.`;
}

function reasonFor(active: ActiveVisitThread, exhibitId: string, journal: Journal): string {
  const exhibit = EXHIBITS_BY_ID.get(exhibitId);
  if (!exhibit) return PRESET_REASON[active.preset];
  const pieces = [PRESET_REASON[active.preset]];
  if (active.topic) pieces.push(`It also matches your topic “${active.topic}”.`);
  if (active.onlyWing) pieces.push(`You limited this thread to ${WINGS_BY_ID.get(active.onlyWing)?.name ?? active.onlyWing}.`);
  if (active.preferBookmarks && journal.bookmarks().some((entry) => entry.exhibitId === exhibitId)) pieces.push('Your bookmark gave it extra weight.');
  if (active.avoidVisited && !journal.hasVisited(exhibitId)) pieces.push('It was still new in this browser’s visit journal.');
  return pieces.join(' ');
}

export function buildThreadWeave(active: ActiveVisitThread, journal: Journal): ThreadWeave {
  const stops = active.stopIds.map((exhibitId, index) => ({
    exhibitId,
    selectionReason: reasonFor(active, exhibitId, journal),
    bridgeFromPrevious: index === 0 ? null : bridge(active.stopIds[index - 1], exhibitId),
  }));
  const domains = new Set(active.stopIds.map((id) => EXHIBITS_BY_ID.get(id)?.wing).filter(Boolean));
  return {
    title: `${active.title} — interpretive weave`,
    opening: domains.size > 1
      ? `This thread crosses ${domains.size} museum wings. The links below explain why each stop was selected and what changes as the route moves between them.`
      : 'This thread stays inside one museum wing and uses the stop sequence to show different sides of the same domain.',
    stops,
  };
}

export function threadWeaveForCurrent(active: ActiveVisitThread | null, journal: Journal): ThreadWeaveStop | null {
  if (!active || active.status === 'complete') return null;
  return buildThreadWeave(active, journal).stops[active.cursor] ?? null;
}

export function collectionVocabularySize(): number {
  const terms = new Set<string>();
  for (const exhibit of COLLECTION.exhibits) for (const term of termsFor(exhibit.id)) terms.add(term);
  return terms.size;
}
