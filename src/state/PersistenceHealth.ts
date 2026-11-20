/**
 * Whether this browser is actually keeping the visitor's local records.
 *
 * Every store degrades to session-only when a write throws (storage full,
 * blocked in private mode, or disabled). That degradation used to be silent:
 * the visitor kept bookmarking and writing notes that would vanish on reload.
 * Stores now report each write here, and the interface tells the visitor once,
 * in plain words, with the one remedy that exists (export the session).
 *
 * Nothing is stored or sent: this is in-memory state for the current page.
 */
export type PersistedStore = 'journal' | 'preferences' | 'study' | 'visit-thread' | 'secrets' | 'installations';

export type PersistenceFailure = 'quota' | 'blocked';

const STORE_LABEL: Readonly<Record<PersistedStore, string>> = {
  journal: 'journal',
  preferences: 'settings',
  study: 'Study Lab',
  'visit-thread': 'Visit Thread',
  secrets: 'secret finds',
  installations: 'installation states',
};

const ORDER: readonly PersistedStore[] = ['journal', 'preferences', 'study', 'visit-thread', 'secrets', 'installations'];

/** A quota error, by name or by the legacy numeric codes browsers still use. */
export function isQuotaError(error: unknown): boolean {
  const e = error as { name?: string; code?: number } | null;
  return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export class PersistenceHealth {
  private readonly failing = new Map<PersistedStore, PersistenceFailure>();
  private readonly listeners = new Set<(message: string | null) => void>();

  /** A write succeeded: the store is being kept again. */
  saved(store: PersistedStore): void {
    if (!this.failing.delete(store)) return;
    this.emit();
  }

  /** A write threw. */
  failed(store: PersistedStore, error: unknown): void {
    const kind: PersistenceFailure = isQuotaError(error) ? 'quota' : 'blocked';
    if (this.failing.get(store) === kind) return;
    this.failing.set(store, kind);
    this.emit();
  }

  get ok(): boolean {
    return this.failing.size === 0;
  }

  /** Plain-language explanation for the visitor, or null when everything is kept. */
  message(): string | null {
    if (this.failing.size === 0) return null;
    const stores = ORDER.filter((store) => this.failing.has(store)).map((store) => STORE_LABEL[store]);
    const quota = [...this.failing.values()].includes('quota');
    const cause = quota ? 'this browser’s storage for the museum is full' : 'this browser is blocking storage for the museum';
    return `Not being saved on this device: your ${listNames(stores)} (${cause}). Everything keeps working for this visit. To keep it, use Export session in the Curator Desk (C) before you close the page.`;
  }

  /** Called with the new message (or null) whenever the set of failing stores changes. */
  onChange(listener: (message: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test seam: forget all reports. */
  reset(): void {
    this.failing.clear();
  }

  private emit(): void {
    const message = this.message();
    for (const listener of this.listeners) listener(message);
  }
}

/** One per page: every store reports into the same place the interface reads. */
export const persistenceHealth = new PersistenceHealth();
