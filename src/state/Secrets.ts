/**
 * Which hidden things this visitor has found, kept on this device only.
 * Separate from the Journal: exhibit visits are for orientation and are never
 * counted; secrets are the one place the museum keeps a count.
 */
const KEY = 'museum-of-me:secrets';
export const SECRETS_VERSION = 1;

interface SecretsPayload {
  version: number;
  found: Record<string, number>;
}

export class SecretsLog {
  private readonly found = new Map<string, number>();

  constructor(private readonly storage: Storage | null = safeStorage()) {
    this.load();
  }

  has(id: string): boolean {
    return this.found.has(id);
  }

  /** Records a find. Returns false if it was already found. */
  markFound(id: string, now = Date.now()): boolean {
    if (this.found.has(id)) return false;
    this.found.set(id, now);
    this.save();
    return true;
  }

  /** How many of the given ids have been found (ignores retired ids). */
  countOf(ids: readonly string[]): number {
    let n = 0;
    for (const id of ids) if (this.found.has(id)) n++;
    return n;
  }

  foundAt(id: string): number | undefined {
    return this.found.get(id);
  }

  clear(): void {
    this.found.clear();
    this.save();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return;
      const payload = JSON.parse(raw) as Partial<SecretsPayload>;
      if (payload.version !== SECRETS_VERSION || !payload.found || typeof payload.found !== 'object') return;
      for (const [id, at] of Object.entries(payload.found)) {
        if (typeof id === 'string' && typeof at === 'number' && Number.isFinite(at)) this.found.set(id, at);
      }
    } catch {
      // Unreadable saved finds are not worth interrupting a visit for; start fresh.
      this.found.clear();
    }
  }

  private save(): void {
    if (!this.storage) return;
    const payload: SecretsPayload = { version: SECRETS_VERSION, found: Object.fromEntries(this.found) };
    try {
      this.storage.setItem(KEY, JSON.stringify(payload));
    } catch {
      // Storage full or blocked: the find still counts for this visit.
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
