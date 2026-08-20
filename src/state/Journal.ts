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

interface JournalPayload {
  version: number;
  entries: Record<string, JournalEntry>;
}

const KEY = 'museum-of-me:journal';
export const JOURNAL_VERSION = 1;

export class Journal {
  private entries = new Map<string, JournalEntry>();
  private readonly storage: Storage | null;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    this.load();
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
    this.save();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as JournalPayload;
      if (parsed?.version !== JOURNAL_VERSION || typeof parsed.entries !== 'object') return;
      for (const [id, entry] of Object.entries(parsed.entries)) {
        if (entry && typeof entry.firstVisited === 'number') this.entries.set(id, { ...entry, exhibitId: id });
      }
    } catch {
      /* corrupt payload — start fresh rather than crash the museum */
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      const entries: Record<string, JournalEntry> = {};
      for (const [id, e] of this.entries) entries[id] = e;
      this.storage.setItem(KEY, JSON.stringify({ version: JOURNAL_VERSION, entries } satisfies JournalPayload));
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
