import {
  INSTALLATION_IDS, defaultStateFor, sanitizeInstallationState,
  type InstallationState,
} from '../content/installationState';
import { attachIntegrity, verifyIntegrity } from './integrity';

/**
 * Persistence for the fourteen source installations.
 *
 * Source parity: Version B `Installation` saved after every changed key and
 * restored through `sanitizeState`, so a hostile or stale payload could never
 * put an installation into an illegal state. This store keeps that contract and
 * adds the museum's quarantine rule — corrupt JSON is preserved under a
 * quarantine key and reported, never silently discarded.
 */

const KEY = 'museum-of-me:installations';
const BACKUP_KEY = 'museum-of-me:installations:backup';
const QUARANTINE_KEY = 'museum-of-me:installations:quarantine';
export const INSTALLATION_STORE_VERSION = 1;

interface Payload {
  version: number;
  states: Record<string, InstallationState>;
  examined: string[];
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class InstallationStore {
  private states = new Map<string, InstallationState>();
  private examined = new Set<string>();
  recoveryNotice: string | null = null;
  private readonly storage: Storage | null;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    for (const id of INSTALLATION_IDS) this.states.set(id, defaultStateFor(id));
    this.load();
  }

  get(id: string): InstallationState {
    return this.states.get(id) ?? defaultStateFor(id);
  }

  set(id: string, state: InstallationState): void {
    this.states.set(id, sanitizeInstallationState(id, state));
    this.save();
  }

  markExamined(id: string): void {
    this.examined.add(id);
    this.save();
  }

  hasExamined(id: string): boolean {
    return this.examined.has(id);
  }

  examinedIds(): readonly string[] {
    return [...this.examined];
  }

  reset(id: string): InstallationState {
    const fresh = defaultStateFor(id);
    this.states.set(id, fresh);
    this.save();
    return fresh;
  }

  resetAll(): void {
    for (const id of INSTALLATION_IDS) this.states.set(id, defaultStateFor(id));
    this.examined.clear();
    this.save();
  }

  exportPayload(): Payload {
    return {
      version: INSTALLATION_STORE_VERSION,
      states: Object.fromEntries(this.states),
      examined: [...this.examined],
    };
  }

  private load(): void {
    if (!this.storage) return;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      // Accept both a bare payload and an integrity envelope.
      const body = verifyIntegrity<Payload>(parsed)
        ? parsed.payload
        : (parsed as Payload);
      if (!body || typeof body !== 'object' || typeof body.states !== 'object' || body.states === null) {
        this.quarantine(raw, 'wrong-shape');
        this.recoveryNotice = 'Installation state was unreadable and has been quarantined. The installations opened at their source defaults.';
        return;
      }
      if (Number.isFinite(Number(body.version)) && Number(body.version) > INSTALLATION_STORE_VERSION) {
        this.quarantine(raw, 'future-version');
        this.recoveryNotice = 'A newer installation-state format was rejected and quarantined.';
        return;
      }
      for (const id of INSTALLATION_IDS) {
        this.states.set(id, sanitizeInstallationState(id, body.states[id]));
      }
      const examined = Array.isArray(body.examined) ? body.examined : [];
      for (const id of examined) if (INSTALLATION_IDS.includes(id as never)) this.examined.add(id);
    } catch {
      if (raw) this.quarantine(raw, 'malformed-json');
      this.recoveryNotice = 'Installation-state JSON was corrupt and has been quarantined. Nothing was silently discarded.';
    }
  }

  private quarantine(raw: string, reason: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(QUARANTINE_KEY, JSON.stringify({
        at: new Date().toISOString(), reason, payload: raw.slice(0, 200_000),
      }));
    } catch { /* quota */ }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      const previous = this.storage.getItem(KEY);
      if (previous) this.storage.setItem(BACKUP_KEY, previous);
      this.storage.setItem(KEY, JSON.stringify(attachIntegrity(this.exportPayload())));
    } catch {
      /* storage unavailable — installation state degrades to session-only */
    }
  }
}
