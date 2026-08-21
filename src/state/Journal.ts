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

const KEY = 'museum-of-me:journal';
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
    if (typeof parsed.entries !== 'object' || parsed.entries === null) return false;
    const version = Number(parsed.version);
    if (Number.isFinite(version) && version > JOURNAL_VERSION) return false;
    if (replace) {
      this.entries.clear();
      this.heard.clear();
      this.supplementary.clear();
      this.checkpoints = [];
      this.history = [];
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
      this.entries.clear();
      this.applyParsed(parsed);
      this.save();
      this.recoveryNotice = 'Previous journal save restored.';
      return true;
    } catch {
      return false;
    }
  }

  private applyParsed(parsed: JournalPayload): void {
    if (typeof parsed.entries === 'object' && parsed.entries) {
      for (const [id, entry] of Object.entries(parsed.entries)) {
        if (entry && typeof entry.firstVisited === 'number') this.entries.set(id, { ...entry, exhibitId: id, note: String(entry.note ?? '').slice(0, 2000) });
      }
    }
    for (const id of parsed.heardVisitors ?? []) if (typeof id === 'string') this.heard.add(id);
    for (const id of parsed.supplementaryRead ?? []) if (typeof id === 'string') this.supplementary.add(id);
    if (Array.isArray(parsed.checkpoints)) this.checkpoints = parsed.checkpoints.slice(-8);
    if (Array.isArray(parsed.history)) this.history = parsed.history.slice(-40);
    if (parsed.guideTarget && typeof parsed.guideTarget.id === 'string') this.guideTarget = parsed.guideTarget;
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(KEY);
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
      this.applyParsed(parsed);
    } catch {
      const raw = this.storage.getItem(KEY) ?? '';
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
    try {
      const previous = this.storage.getItem(KEY);
      if (previous) this.storage.setItem(BACKUP_KEY, previous);
      this.storage.setItem(KEY, JSON.stringify(this.exportPayload()));
    } catch {
      /* storage unavailable — journal degrades to session-only */
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
