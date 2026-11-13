/** Pure source-catalog filtering for the local Builder; no DOM, no network. */
export interface SourceCatalogEntry {
  id: string; name: string; pack: string; packName: string; author: string; license: string;
  featured?: { target: string; wing: string; role: string };
}
export interface SourceVerificationReport {
  sourceRevision: string;
  verified: readonly string[];
  rejected: readonly { id: string; status: string; detail?: string }[];
  unchecked: readonly string[];
}
export type SourceAvailability = 'importable' | 'unsupported' | 'unchecked';
export interface SourceAvailabilityInfo { state: SourceAvailability; reason: string }
export interface SourceFilter {
  query: string;
  featuredOnly: boolean;
  pack: string;
  wing: string;
  /** '' means every availability state. */
  availability: SourceAvailability | '';
}

const REASONS: Record<string, string> = {
  'size-mismatch': 'Source bytes differ in size from the pinned record',
  'blob-mismatch': 'Source bytes differ from the pinned Git blob',
  'unsupported-extension': 'Requires a glTF extension this import path does not support',
  'invalid-glb': 'Failed GLB structure or self-contained reference validation',
  'fetch-failed': 'Source bytes could not be fetched during verification',
};

/** Only IDs the committed report lists as verified are importable. */
export function sourceAvailability(report: SourceVerificationReport | null):
(id: string) => SourceAvailabilityInfo {
  const verified = new Set(report?.verified ?? []);
  const rejected = new Map((report?.rejected ?? []).map((entry) => [entry.id, entry]));
  return (id) => {
    if (verified.has(id)) return { state: 'importable', reason: 'Bytes verified against the pinned source' };
    const entry = rejected.get(id);
    if (entry && entry.status !== 'fetch-failed') {
      return { state: 'unsupported', reason: entry.detail ? `${REASONS[entry.status] ?? entry.status}: ${entry.detail}`
        : REASONS[entry.status] ?? entry.status };
    }
    return { state: 'unchecked', reason: entry ? REASONS['fetch-failed']! : 'Not yet verified against the pinned source' };
  };
}

export function filterSourceCatalog<T extends SourceCatalogEntry>(entries: readonly T[], filter: SourceFilter,
  availability: (id: string) => SourceAvailabilityInfo): T[] {
  const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((item) => {
    if (filter.featuredOnly && !item.featured) return false;
    if (filter.pack && item.pack !== filter.pack) return false;
    if (filter.wing && item.featured?.wing !== filter.wing) return false;
    if (filter.availability && availability(item.id).state !== filter.availability) return false;
    if (!terms.length) return true;
    const haystack = [item.name, item.id, item.pack, item.packName, item.author, item.license,
      item.featured?.target ?? '', item.featured?.wing ?? '', item.featured?.role ?? ''].join(' ').toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
