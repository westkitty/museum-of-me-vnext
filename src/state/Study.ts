import { attachIntegrity, checksumPayload, verifyIntegrity } from './integrity';

export const STUDY_KEY = 'reliquary:study:v1';
export const STUDY_BACKUP_KEY = 'reliquary:study:backup';
export const STUDY_QUARANTINE_KEY = 'reliquary:study:quarantine';
export const STUDY_SCHEMA_VERSION = 1;
export const STUDY_IMPORT_MAX_BYTES = 512 * 1024;
export const STUDY_COLORS = ['gold', 'blue', 'violet', 'green', 'rose'] as const;
export type StudyColor = (typeof STUDY_COLORS)[number];

export interface StudyCollection {
  id: string;
  name: string;
  color: StudyColor;
  members: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
}

export interface StudyQueueItem {
  id: string;
  priority: number;
}

export interface StudyGoal {
  text: string;
  startedAt: number;
  elapsedMs: number;
}

export interface StudyState {
  version: number;
  updatedAt: number;
  revision: number;
  writerId: string;
  collections: StudyCollection[];
  tags: Record<string, string[]>;
  savedSearches: SavedSearch[];
  compare: [string | null, string | null];
  queue: StudyQueueItem[];
  recent: string[];
  goal: StudyGoal | null;
  pinnedId: string | null;
}

export const STUDY_DEFAULT: StudyState = {
  version: STUDY_SCHEMA_VERSION,
  updatedAt: 0,
  revision: 0,
  writerId: '',
  collections: [],
  tags: {},
  savedSearches: [],
  compare: [null, null],
  queue: [],
  recent: [],
  goal: null,
  pinnedId: null,
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function writerId(): string {
  return `study-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeStudy(value: unknown, knownIds: ReadonlySet<string>): StudyState {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<StudyState> : {};
  const tags: Record<string, string[]> = {};
  if (source.tags && typeof source.tags === 'object') {
    for (const [id, values] of Object.entries(source.tags)) {
      if (!knownIds.has(id) || !Array.isArray(values)) continue;
      tags[id] = [...new Set(values.map((v) => String(v).trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 12);
    }
  }
  const collections = (Array.isArray(source.collections) ? source.collections : [])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 20)
    .map((item) => {
      const raw = item as StudyCollection;
      const color: StudyColor = STUDY_COLORS.includes(raw.color as StudyColor) ? raw.color as StudyColor : 'gold';
      return {
        id: String(raw.id || newId('collection')).slice(0, 80),
        name: String(raw.name || 'Untitled').slice(0, 48),
        color,
        members: Array.isArray(raw.members) ? raw.members.filter((id) => knownIds.has(id)).slice(0, 46) : [],
      };
    });
  const savedSearches = (Array.isArray(source.savedSearches) ? source.savedSearches : [])
    .filter((item) => item && typeof item === 'object' && String((item as SavedSearch).query || '').trim())
    .slice(0, 20)
    .map((item) => {
      const raw = item as SavedSearch;
      return { id: String(raw.id || newId('search')).slice(0, 80), name: String(raw.name || raw.query).slice(0, 48), query: String(raw.query).slice(0, 180) };
    });
  const compareRaw = Array.isArray(source.compare) ? source.compare.slice(0, 2) : [null, null];
  const compare: [string | null, string | null] = [
    typeof compareRaw[0] === 'string' && knownIds.has(compareRaw[0]) ? compareRaw[0] : null,
    typeof compareRaw[1] === 'string' && knownIds.has(compareRaw[1]) ? compareRaw[1] : null,
  ];
  const queue: StudyQueueItem[] = [];
  for (const entry of Array.isArray(source.queue) ? source.queue : []) {
    const id = typeof entry === 'string' ? entry : (entry as StudyQueueItem)?.id;
    if (!id || !knownIds.has(id) || queue.some((item) => item.id === id)) continue;
    const priority = typeof entry === 'object' && entry && Number.isFinite((entry as StudyQueueItem).priority)
      ? Math.max(0, Math.min(9, Math.floor((entry as StudyQueueItem).priority)))
      : queue.length;
    queue.push({ id, priority });
  }
  const recent = (Array.isArray(source.recent) ? source.recent : []).filter((id): id is string => typeof id === 'string' && knownIds.has(id)).slice(-40);
  const goalSource = source.goal && typeof source.goal === 'object' ? source.goal as StudyGoal : null;
  const goal: StudyGoal | null = goalSource && String(goalSource.text || '').trim()
    ? { text: String(goalSource.text).slice(0, 180), startedAt: Number(goalSource.startedAt) || Date.now(), elapsedMs: Math.max(0, Number(goalSource.elapsedMs) || 0) }
    : null;
  return {
    version: STUDY_SCHEMA_VERSION,
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0,
    revision: Math.max(0, Math.floor(Number(source.revision) || 0)),
    writerId: String(source.writerId || ''),
    collections,
    tags,
    savedSearches,
    compare,
    queue,
    recent,
    goal,
    pinnedId: typeof source.pinnedId === 'string' && knownIds.has(source.pinnedId) ? source.pinnedId : null,
  };
}

export class Study {
  state: StudyState;
  recoveryNotice: string | null = null;
  private undo: StudyState | null = null;
  readonly writerId = writerId();
  private readonly storage: Storage | null;
  private readonly known: () => Set<string>;

  constructor(knownIds: () => Set<string>, storage: Storage | null = safeStorage()) {
    this.storage = storage;
    this.known = knownIds;
    this.state = this.read();
  }

  private read(): StudyState {
    if (!this.storage) return { ...STUDY_DEFAULT, writerId: this.writerId };
    try {
      const raw = this.storage.getItem(STUDY_KEY);
      if (!raw) return { ...STUDY_DEFAULT, writerId: this.writerId };
      if (raw.length > STUDY_IMPORT_MAX_BYTES) {
        this.quarantine(raw, 'size-limit');
        this.recoveryNotice = 'Study data exceeded the import size limit and was quarantined.';
        return { ...STUDY_DEFAULT, writerId: this.writerId };
      }
      const parsed = JSON.parse(raw) as { payload?: StudyState; integrity?: { digest: string }; version?: number };
      if (parsed.integrity && !verifyIntegrity<StudyState>(parsed)) {
        this.quarantine(raw, 'integrity');
        this.recoveryNotice = 'Study integrity check failed. The payload was quarantined.';
        return { ...STUDY_DEFAULT, writerId: this.writerId };
      }
      const body = parsed.payload ?? (parsed as unknown as StudyState);
      const version = Number(body.version);
      if (Number.isFinite(version) && version > STUDY_SCHEMA_VERSION) {
        this.quarantine(raw, 'future-version');
        this.recoveryNotice = 'A newer Study format was rejected.';
        return { ...STUDY_DEFAULT, writerId: this.writerId };
      }
      return sanitizeStudy(body, this.known());
    } catch {
      const raw = this.storage.getItem(STUDY_KEY) ?? '';
      if (raw) this.quarantine(raw, 'malformed-json');
      this.recoveryNotice = 'Study JSON was corrupt and has been quarantined.';
      return { ...STUDY_DEFAULT, writerId: this.writerId };
    }
  }

  persist(): void {
    this.state.updatedAt = Date.now();
    this.state.revision += 1;
    this.state.writerId = this.writerId;
    if (!this.storage) return;
    try {
      const previous = this.storage.getItem(STUDY_KEY);
      if (previous) this.storage.setItem(STUDY_BACKUP_KEY, previous);
      const envelope = attachIntegrity(sanitizeStudy(this.state, this.known()));
      this.storage.setItem(STUDY_KEY, JSON.stringify(envelope));
    } catch { /* quota */ }
  }

  commit(mutator: (state: StudyState) => void): void {
    this.undo = JSON.parse(JSON.stringify(this.state)) as StudyState;
    mutator(this.state);
    this.state = sanitizeStudy(this.state, this.known());
    this.persist();
  }

  undoLast(): boolean {
    if (!this.undo) return false;
    this.state = this.undo;
    this.undo = null;
    this.persist();
    return true;
  }

  importRaw(raw: string): { ok: boolean; preview: StudyState | null; message: string } {
    if (raw.length > STUDY_IMPORT_MAX_BYTES) return { ok: false, preview: null, message: 'Study import is too large.' };
    try {
      const parsed = JSON.parse(raw) as { payload?: StudyState };
      const body = parsed.payload ?? (parsed as unknown as StudyState);
      const next = sanitizeStudy(body, this.known());
      return { ok: true, preview: next, message: `Preview: ${next.collections.length} collections, ${next.queue.length} queued, revision ${next.revision}.` };
    } catch {
      return { ok: false, preview: null, message: 'Study import is not valid JSON.' };
    }
  }

  applyImport(next: StudyState): void {
    this.undo = this.state;
    this.state = sanitizeStudy(next, this.known());
    this.persist();
  }

  fingerprint(): string {
    return checksumPayload(this.state);
  }

  private quarantine(raw: string, reason: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STUDY_QUARANTINE_KEY, JSON.stringify({ at: new Date().toISOString(), reason, payload: raw.slice(0, 200_000) }));
    } catch { /* quota */ }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
