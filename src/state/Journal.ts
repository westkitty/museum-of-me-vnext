import { persistenceHealth } from './PersistenceHealth';

/**
 * Visited state and bookmarks. Plan §30: orientation, never achievement.
 * There is no score, no completion percentage, and no badge.
 */
export interface JournalEntry {
  readonly exhibitId: string;
  firstVisited: number;
  lastVisited: number;
  bookmarked: boolean;
  note: string;
}

export interface GuideTargetRef {
  kind: 'installation' | 'visitor' | 'supplementary' | 'exhibit';
  id: string;
}

export interface VisitCheckpoint {
  id: string;
  name: string;
  createdAt: string;
  exhibitIds: string[];
}

interface JournalPayload {
  version: number;
  entries: Record<string, JournalEntry>;
  heardVisitors?: string[];
  supplementaryRead?: string[];
  checkpoints?: VisitCheckpoint[];
  history?: Array<GuideTargetRef & { title: string; at: string }>;
  guideTarget?: GuideTargetRef;
}

export const JOURNAL_KEY = 'museum-of-me:journal';
const BACKUP_KEY = 'museum-of-me:journal:backup';
const QUARANTINE_KEY = 'museum-of-me:journal:quarantine';
export const JOURNAL_VERSION = 2;

export class Journal {
  private entries = new Map<string, JournalEntry>();
  private heard = new Set<string>();
  private supplementary = new Set<string>();
  private checkpoints: VisitCheckpoint[] = [];
  private history: Array<GuideTargetRef & { title: string; at: string }> = [];
  guideTarget: GuideTargetRef | undefined;
  recoveryNotice: string | null = null;
  private readonly storage: Storage | null;
  /** The stored text this tab last read or wrote; anything else was written by another tab. */
  private lastRaw: string | null = null;
  /** What this tab last agreed with storage, so local changes can be told apart from another tab's. */
  private synced: SyncedState = emptySynced();
  /** Set by clear(): the next save replaces storage instead of merging another tab's records back. */
  private discardExternal = false;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    this.load();
  }

  hearVisitor(id: string): void {
    this.heard.add(id);
    this.save();
  }

  hasHeard(id: string): boolean {
    return this.heard.has(id);
  }

  markSupplementaryRead(id: string): void {
    this.supplementary.add(id);
    this.save();
  }

  hasReadSupplementary(id: string): boolean {
    return this.supplementary.has(id);
  }

  recordHistory(ref: GuideTargetRef, title: string): void {
    this.history = [...this.history.filter((h) => !(h.kind === ref.kind && h.id === ref.id)), {
      ...ref, title, at: new Date().toISOString(),
    }].slice(-40);
    this.save();
  }

  visitHistory(): readonly (GuideTargetRef & { title: string; at: string })[] {
    return this.history;
  }

  addCheckpoint(name: string): VisitCheckpoint {
    const snapshot: VisitCheckpoint = {
      id: `cp-${Date.now()}`,
      name: name.slice(0, 80) || `Checkpoint ${this.checkpoints.length + 1}`,
      createdAt: new Date().toISOString(),
      exhibitIds: [...this.entries.keys()],
    };
    this.checkpoints = [...this.checkpoints, snapshot].slice(-8);
    this.save();
    return snapshot;
  }

  listCheckpoints(): readonly VisitCheckpoint[] {
    return this.checkpoints;
  }

  setGuideTarget(target: GuideTargetRef | undefined): void {
    this.guideTarget = target;
    this.save();
  }

  nextUnvisited(ids: readonly string[]): string | null {
    return ids.find((id) => !this.entries.has(id)) ?? null;
  }

  markVisited(exhibitId: string, now = Date.now()): void {
    const existing = this.entries.get(exhibitId);
    if (existing) {
      existing.lastVisited = now;
    } else {
      this.entries.set(exhibitId, {
        exhibitId,
        firstVisited: now,
        lastVisited: now,
        bookmarked: false,
        note: '',
      });
    }
    this.save();
  }

  hasVisited(exhibitId: string): boolean {
    return this.entries.has(exhibitId);
  }

  toggleBookmark(exhibitId: string): boolean {
    const e = this.entries.get(exhibitId);
    if (!e) {
      this.markVisited(exhibitId);
      const created = this.entries.get(exhibitId)!;
      created.bookmarked = true;
      this.save();
      return true;
    }
    e.bookmarked = !e.bookmarked;
    this.save();
    return e.bookmarked;
  }

  setNote(exhibitId: string, note: string): void {
    const e = this.entries.get(exhibitId);
    if (!e) return;
    e.note = note.slice(0, 2000);
    this.save();
  }

  get visitedCount(): number {
    return this.entries.size;
  }

  all(): readonly JournalEntry[] {
    return [...this.entries.values()].sort((a, b) => b.lastVisited - a.lastVisited);
  }

  bookmarks(): readonly JournalEntry[] {
    return this.all().filter((e) => e.bookmarked);
  }

  clear(): void {
    this.discardExternal = true;
    this.entries.clear();
    this.heard.clear();
    this.supplementary.clear();
    this.checkpoints = [];
    this.history = [];
    this.guideTarget = undefined;
    this.save();
  }

  exportPayload(): JournalPayload {
    const entries: Record<string, JournalEntry> = {};
    for (const [id, e] of this.entries) entries[id] = e;
    return {
      version: JOURNAL_VERSION,
      entries,
      heardVisitors: [...this.heard],
      supplementaryRead: [...this.supplementary],
      checkpoints: this.checkpoints,
      history: this.history,
      guideTarget: this.guideTarget,
    };
  }

  importPayload(value: unknown, { replace = false } = {}): boolean {
    if (!value || typeof value !== 'object') return false;
    const parsed = value as JournalPayload;
    if (typeof parsed.entries !== 'object' || parsed.entries === null || Array.isArray(parsed.entries)) return false;
    const version = Number(parsed.version);
    if (Number.isFinite(version) && version > JOURNAL_VERSION) return false;
    if (replace) {
      this.discardExternal = true;
      this.entries.clear();
      this.heard.clear();
      this.supplementary.clear();
      this.checkpoints = [];
      this.history = [];
      this.guideTarget = undefined;
    }
    this.applyParsed(parsed);
    this.save();
    return true;
  }

  restorePrevious(): boolean {
    if (!this.storage) return false;
    const raw = this.storage.getItem(BACKUP_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as JournalPayload;
      if (!parsed || typeof parsed !== 'object'
        || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) return false;
      const version = Number(parsed.version);
      if (Number.isFinite(version) && version > JOURNAL_VERSION) return false;
      // applyParsed() only adds to heard/supplementary and conditionally
      // overwrites guideTarget -- it merges onto existing state rather than
      // replacing it. A "restore" that skips clearing these three first keeps
      // anything recorded after the backup snapshot, so a visitor heard or a
      // supplementary text read after the last save would still read as
      // heard/read even after "restoring" to before that save.
      this.discardExternal = true;
      this.entries.clear();
      this.heard.clear();
      this.supplementary.clear();
      this.checkpoints = [];
      this.history = [];
      this.guideTarget = undefined;
      this.applyParsed(parsed);
      this.save();
      this.recoveryNotice = 'Previous journal save restored.';
      return true;
    } catch {
      return false;
    }
  }

  /** Returns how many stored entries could not be read and were left out. */
  private applyParsed(parsed: JournalPayload): number {
    const { entries, dropped } = readEntries(parsed.entries);
    for (const [id, entry] of entries) this.entries.set(id, entry);
    for (const id of parsed.heardVisitors ?? []) if (typeof id === 'string') this.heard.add(id);
    for (const id of parsed.supplementaryRead ?? []) if (typeof id === 'string') this.supplementary.add(id);
    if (Array.isArray(parsed.checkpoints)) this.checkpoints = parsed.checkpoints.slice(-8);
    if (Array.isArray(parsed.history)) this.history = parsed.history.slice(-40);
    if (parsed.guideTarget && typeof parsed.guideTarget.id === 'string') this.guideTarget = parsed.guideTarget;
    return dropped;
  }

  /**
   * Another tab (or window) of the museum wrote the journal. Fold its records
   * into this tab's: visits, bookmarks and notes made here since the last
   * agreement with storage are kept, everything else follows storage, so
   * neither tab's visits are lost and a clear made elsewhere is honoured.
   * Returns true when this tab's journal changed.
   */
  reconcileExternal(raw: string | null): boolean {
    if (raw === null || raw === this.lastRaw) return false;
    const before = JSON.stringify(this.exportPayload());
    if (!this.mergeExternal(raw)) return false;
    this.lastRaw = raw;
    this.synced = this.snapshotSynced();
    return JSON.stringify(this.exportPayload()) !== before;
  }

  private mergeExternal(raw: string): boolean {
    let parsed: JournalPayload;
    try {
      parsed = JSON.parse(raw) as JournalPayload;
    } catch {
      return false;
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) return false;
    const version = Number(parsed.version);
    if (Number.isFinite(version) && version > JOURNAL_VERSION) return false;

    const merged = readEntries(parsed.entries).entries;
    for (const [id, entry] of this.entries) {
      if (this.synced.entries.get(id) === JSON.stringify(entry)) continue; // unchanged here
      const theirs = merged.get(id);
      merged.set(id, theirs
        ? { ...entry, firstVisited: Math.min(entry.firstVisited, theirs.firstVisited), lastVisited: Math.max(entry.lastVisited, theirs.lastVisited) }
        : { ...entry });
    }
    const union = (external: unknown, local: Set<string>, synced: Set<string>) => {
      const out = new Set<string>(Array.isArray(external) ? external.filter((id): id is string => typeof id === 'string') : []);
      for (const id of local) if (!synced.has(id)) out.add(id);
      return out;
    };
    const heard = union(parsed.heardVisitors, this.heard, this.synced.heard);
    const supplementary = union(parsed.supplementaryRead, this.supplementary, this.synced.supplementary);
    const externalCheckpoints = Array.isArray(parsed.checkpoints) ? parsed.checkpoints.filter((cp) => cp && typeof cp.id === 'string') : [];
    const checkpoints = [...externalCheckpoints, ...this.checkpoints.filter((cp) => !this.synced.checkpoints.has(cp.id) && !externalCheckpoints.some((other) => other.id === cp.id))]
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).slice(-8);
    const externalHistory = Array.isArray(parsed.history) ? parsed.history.filter((h) => h && typeof h.id === 'string') : [];
    const localHistory = this.history.filter((h) => !this.synced.history.has(historyKey(h)));
    const history = [...externalHistory.filter((h) => !localHistory.some((mine) => mine.kind === h.kind && mine.id === h.id)), ...localHistory]
      .sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-40);
    const guideChangedHere = JSON.stringify(this.guideTarget ?? null) !== this.synced.guideTarget;
    const guideTarget = guideChangedHere
      ? this.guideTarget
      : parsed.guideTarget && typeof parsed.guideTarget.id === 'string' ? parsed.guideTarget : undefined;

    this.entries = merged;
    this.heard = heard;
    this.supplementary = supplementary;
    this.checkpoints = checkpoints;
    this.history = history;
    this.guideTarget = guideTarget;
    return true;
  }

  private snapshotSynced(): SyncedState {
    return {
      entries: new Map([...this.entries].map(([id, entry]) => [id, JSON.stringify(entry)])),
      heard: new Set(this.heard),
      supplementary: new Set(this.supplementary),
      checkpoints: new Set(this.checkpoints.map((cp) => cp.id)),
      history: new Set(this.history.map(historyKey)),
      guideTarget: JSON.stringify(this.guideTarget ?? null),
    };
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(JOURNAL_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as JournalPayload;
      if (typeof parsed !== 'object' || parsed === null || typeof parsed.entries !== 'object') {
        this.quarantine(raw, 'wrong-shape');
        this.recoveryNotice = 'Journal data was unreadable and has been quarantined. A fresh journal is in use.';
        return;
      }
      const version = Number(parsed.version);
      if (Number.isFinite(version) && version > JOURNAL_VERSION) {
        this.quarantine(raw, 'future-version');
        this.recoveryNotice = 'A newer journal format was rejected and quarantined.';
        return;
      }
      if (Array.isArray(parsed.entries)) {
        this.quarantine(raw, 'wrong-shape');
        this.recoveryNotice = 'Journal data was unreadable and has been quarantined. A fresh journal is in use.';
        return;
      }
      const dropped = this.applyParsed(parsed);
      this.lastRaw = raw;
      this.synced = this.snapshotSynced();
      if (dropped > 0) {
        this.quarantine(raw, 'unreadable-entries');
        this.recoveryNotice = `${dropped} journal ${dropped === 1 ? 'entry was' : 'entries were'} unreadable and set aside (a copy is quarantined). The rest of your journal loaded.`;
      }
    } catch {
      const raw = this.storage.getItem(JOURNAL_KEY) ?? '';
      if (raw) this.quarantine(raw, 'malformed-json');
      this.recoveryNotice = 'Journal JSON was corrupt and has been quarantined. Existing visitor data was not silently discarded.';
    }
  }

  private quarantine(raw: string, reason: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(QUARANTINE_KEY, JSON.stringify({ at: new Date().toISOString(), reason, payload: raw.slice(0, 200_000) }));
    } catch { /* quota */ }
  }

  private save(): void {
    if (!this.storage) return;
    const discard = this.discardExternal;
    this.discardExternal = false;
    try {
      const previous = this.storage.getItem(JOURNAL_KEY);
      // Another tab wrote since this one last read: merge, never overwrite its visits.
      if (previous !== null && previous !== this.lastRaw && !discard) this.mergeExternal(previous);
      if (previous) this.storage.setItem(BACKUP_KEY, previous);
      const raw = JSON.stringify(this.exportPayload());
      this.storage.setItem(JOURNAL_KEY, raw);
      this.lastRaw = raw;
      this.synced = this.snapshotSynced();
      persistenceHealth.saved('journal');
    } catch (error) {
      /* storage unavailable — journal degrades to session-only, and the visitor is told */
      persistenceHealth.failed('journal', error);
    }
  }
}

interface SyncedState {
  entries: Map<string, string>;
  heard: Set<string>;
  supplementary: Set<string>;
  checkpoints: Set<string>;
  history: Set<string>;
  guideTarget: string;
}

function emptySynced(): SyncedState {
  return { entries: new Map(), heard: new Set(), supplementary: new Set(), checkpoints: new Set(), history: new Set(), guideTarget: 'null' };
}

function historyKey(h: { kind: string; id: string; at: string }): string {
  return `${h.kind}:${h.id}:${h.at}`;
}

/**
 * Stored entries, each checked on its own. An entry without a numeric first
 * visit is unreadable and left out (and counted); repairable fields — a
 * missing last visit, a non-boolean bookmark, a non-string note — are
 * normalised instead of letting NaN or strings into sorting and the UI.
 */
function readEntries(value: unknown): { entries: Map<string, JournalEntry>; dropped: number } {
  const entries = new Map<string, JournalEntry>();
  let dropped = 0;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { entries, dropped };
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    const entry = raw as Partial<JournalEntry> | null;
    if (!entry || typeof entry !== 'object' || typeof entry.firstVisited !== 'number' || !Number.isFinite(entry.firstVisited)) {
      dropped++;
      continue;
    }
    const lastVisited = typeof entry.lastVisited === 'number' && Number.isFinite(entry.lastVisited)
      ? Math.max(entry.lastVisited, entry.firstVisited)
      : entry.firstVisited;
    entries.set(id, {
      exhibitId: id,
      firstVisited: entry.firstVisited,
      lastVisited,
      bookmarked: entry.bookmarked === true,
      note: typeof entry.note === 'string' ? entry.note.slice(0, 2000) : '',
    });
  }
  return { entries, dropped };
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
