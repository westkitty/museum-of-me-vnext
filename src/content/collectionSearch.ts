import { COLLECTION, projectsForExhibit, WINGS_BY_ID } from './collection.generated';
import type { ExhibitRecord } from './types';

export interface CollectionSearchEntry {
  readonly id: string;
  readonly kind: 'exhibit' | 'project';
  readonly name: string;
  readonly exhibit: ExhibitRecord;
  readonly keywords: string;
}

export const COLLECTION_SEARCH_ENTRIES: readonly CollectionSearchEntry[] = COLLECTION.exhibits.flatMap((exhibit) => {
  const wing = WINGS_BY_ID.get(exhibit.wing);
  return [
    {
      id: exhibit.id,
      kind: 'exhibit' as const,
      name: exhibit.title,
      exhibit,
      keywords: [exhibit.id, exhibit.slug, wing?.name, exhibit.copy.subtitle, exhibit.copy.plaque].join(' '),
    },
    ...projectsForExhibit(exhibit.id).map((project) => ({
      id: project.id,
      kind: 'project' as const,
      name: project.name,
      exhibit,
      // Repository names and slash-separated collection names already encode
      // established aliases without requiring a second project catalog.
      keywords: [
        project.id, project.family, project.kind, project.summary,
        ...project.capabilities, ...project.repos.map((repo) => repo.split('/').at(-1)),
      ].join(' '),
    })),
  ];
});

function normalize(text: string): string {
  return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function scoreCollectionSearch(query: string, name: string, description: string, keywords = ''): number {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(name);
  const detail = normalize(description);
  const terms = normalize(keywords);
  if (title === q) return 1;
  if (title.startsWith(q)) return 0.94;
  if (title.split(' ').some((word) => word.startsWith(q))) return 0.86;
  if (title.includes(q)) return 0.75;
  if (detail.includes(q)) return 0.58;
  if (terms.includes(q)) return 0.46;
  const haystack = `${title} ${detail} ${terms}`;
  return q.split(' ').every((word) => haystack.includes(word)) ? 0.35 : 0;
}

export function collectionSearch(
  raw: string,
  tags: Readonly<Record<string, readonly string[]>> = {},
): CollectionSearchEntry[] {
  const query = raw.trim();
  if (!query) return [];
  const type = query.match(/(?:^|\s)type:(exhibit|project)\b/i)?.[1]?.toLowerCase();
  const tagQueries = [...query.matchAll(/(?:^|\s)tag:([^\s]+)/gi)].map((match) => normalize(match[1]));
  const words = query.replace(/(?:^|\s)(?:type:(?:exhibit|project)\b|tag:[^\s]+)/gi, ' ').trim();
  return COLLECTION_SEARCH_ENTRIES
    .filter((entry) => (!type || entry.kind === type)
      && tagQueries.every((tag) => tags[entry.exhibit.id]?.some((item) => normalize(item) === tag)))
    .map((entry) => ({ entry, score: words
      ? scoreCollectionSearch(words, entry.name, entry.kind === 'project' ? entry.exhibit.title : '', entry.keywords)
      : 1 }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .map(({ entry }) => entry);
}
