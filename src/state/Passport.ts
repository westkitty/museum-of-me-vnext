import { persistenceHealth } from './PersistenceHealth';
import {
  isPocketWorldId,
  isStampedWorldId,
  STAMPED_WORLD_IDS,
  type BonusWorldId,
  type PocketWorldId,
  type StampedWorldId,
} from '../world/pocket/types';

export const PASSPORT_KEY = 'museum-of-me:passport:v1';
export const PASSPORT_BACKUP_KEY = 'museum-of-me:passport:v1:backup';
export const PASSPORT_QUARANTINE_KEY = 'museum-of-me:passport:v1:quarantine';
export const PASSPORT_VERSION = 1;

export interface StampRecord {
  readonly worldId: StampedWorldId;
  readonly earnedAt: number;
}

export interface BonusRecord {
  readonly worldId: BonusWorldId;
  readonly completedAt: number;
}

export interface PassportPayload {
  readonly version: number;
  readonly unlockedUi: boolean;
  readonly stamps: Partial<Record<StampedWorldId, StampRecord>>;
  readonly bonusCompleted: Partial<Record<BonusWorldId, BonusRecord>>;
  readonly visitedWorlds: Partial<Record<PocketWorldId, number>>;
}

export interface PassportExitOutcome {
  readonly stampEarned: boolean;
  readonly bonusCompleted: boolean;
  readonly unlockedUiChanged: boolean;
}

interface SyncedPassportState {
  unlockedUi: boolean;
  stamps: Map<StampedWorldId, number>;
  bonusL01: number | null;
  visited: Map<PocketWorldId, number>;
}

function emptySynced(): SyncedPassportState {
  return {
    unlockedUi: false,
    stamps: new Map(),
    bonusL01: null,
    visited: new Map(),
  };
}

/**
 * Isolated 10-stamp pocket-world Passport persistence.
 *
 * - Exactly 10 stamp slots (`W01`..`W10`), immutable once earned.
 * - Bonus interlude `L01` is stored strictly in `bonusCompleted` and NEVER
 *   increments `earnedCount` or occupies a stamp slot.
 * - `unlockedUi` flips to `true` on any pocket-world exit (even `0/10` on Back).
 */
export class Passport {
  private uiUnlocked = false;
  private stamps = new Map<StampedWorldId, StampRecord>();
  private bonusCompleted = new Map<BonusWorldId, BonusRecord>();
  private visited = new Map<PocketWorldId, number>();
  private readonly listeners = new Set<() => void>();
  private readonly storage: Storage | null;
  private lastRaw: string | null = null;
  private synced: SyncedPassportState = emptySynced();
  private discardExternal = false;
  recoveryNotice: string | null = null;

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    this.load();
  }

  get unlockedUi(): boolean {
    return this.uiUnlocked;
  }

  get earnedCount(): number {
    return this.stamps.size;
  }

  get totalStamps(): number {
    return STAMPED_WORLD_IDS.length;
  }

  canSeeHudBadge(): boolean {
    return this.uiUnlocked || this.stamps.size > 0;
  }

  canEnterW10(): boolean {
    return this.stamps.size >= 1;
  }

  hasStamp(id: PocketWorldId): boolean {
    return isStampedWorldId(id) && this.stamps.has(id);
  }

  stampFor(id: StampedWorldId): StampRecord | undefined {
    return this.stamps.get(id);
  }

  hasBonusCompleted(id: BonusWorldId = 'L01'): boolean {
    return this.bonusCompleted.has(id);
  }

  bonusFor(id: BonusWorldId = 'L01'): BonusRecord | undefined {
    return this.bonusCompleted.get(id);
  }

  hasVisited(id: PocketWorldId): boolean {
    return this.visited.has(id);
  }

  visitedAt(id: PocketWorldId): number | undefined {
    return this.visited.get(id);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Award a stamp for W01..W10. Idempotent; refuses L01 or unknown IDs. */
  earnStamp(worldId: PocketWorldId, now = Date.now()): boolean {
    if (!isStampedWorldId(worldId)) return false;
    if (this.stamps.has(worldId)) return false;
    const timestamp = finiteTimestamp(now);
    this.stamps.set(worldId, { worldId, earnedAt: timestamp });
    if (!this.visited.has(worldId)) this.visited.set(worldId, timestamp);
    this.save();
    this.emit();
    return true;
  }

  /** Record completion of bonus interlude L01 without adding a stamp. */
  recordBonusCompletion(worldId: BonusWorldId = 'L01', now = Date.now()): boolean {
    if (worldId !== 'L01' || this.bonusCompleted.has('L01')) return false;
    const timestamp = finiteTimestamp(now);
    this.bonusCompleted.set('L01', { worldId: 'L01', completedAt: timestamp });
    if (!this.visited.has('L01')) this.visited.set('L01', timestamp);
    this.save();
    this.emit();
    return true;
  }

  /**
   * Record returning from a pocket world.
   * Unlocks the Passport UI even on an early Back/Esc exit (`0/10`), and only
   * writes a stamp or bonus completion when `completed === true`.
   */
  recordExit(worldId: PocketWorldId, completed: boolean, now = Date.now()): PassportExitOutcome {
    const timestamp = finiteTimestamp(now);
    const unlockedUiChanged = !this.uiUnlocked;
    this.uiUnlocked = true;
    if (!this.visited.has(worldId)) this.visited.set(worldId, timestamp);

    let stampEarned = false;
    let bonusCompleted = false;
    if (completed) {
      if (worldId === 'L01') {
        if (!this.bonusCompleted.has('L01')) {
          this.bonusCompleted.set('L01', { worldId: 'L01', completedAt: timestamp });
          bonusCompleted = true;
        }
      } else if (isStampedWorldId(worldId) && !this.stamps.has(worldId)) {
        this.stamps.set(worldId, { worldId, earnedAt: timestamp });
        stampEarned = true;
      }
    }

    this.save();
    this.emit();
    return { stampEarned, bonusCompleted, unlockedUiChanged };
  }

  clear(): void {
    this.discardExternal = true;
    this.uiUnlocked = false;
    this.stamps.clear();
    this.bonusCompleted.clear();
    this.visited.clear();
    this.save();
    this.emit();
  }

  exportPayload(): PassportPayload {
    const stamps: Partial<Record<StampedWorldId, StampRecord>> = {};
    for (const id of STAMPED_WORLD_IDS) {
      const record = this.stamps.get(id);
      if (record) stamps[id] = { worldId: record.worldId, earnedAt: record.earnedAt };
    }
    const bonusCompleted: Partial<Record<BonusWorldId, BonusRecord>> = {};
    const l01 = this.bonusCompleted.get('L01');
    if (l01) bonusCompleted.L01 = { worldId: 'L01', completedAt: l01.completedAt };
    const visitedWorlds: Partial<Record<PocketWorldId, number>> = {};
    for (const [id, at] of this.visited) visitedWorlds[id] = at;
    return {
      version: PASSPORT_VERSION,
      unlockedUi: this.uiUnlocked,
      stamps,
      bonusCompleted,
      visitedWorlds,
    };
  }

  restorePrevious(): boolean {
    if (!this.storage) return false;
    const raw = this.storage.getItem(PASSPORT_BACKUP_KEY);
    if (!raw) return false;
    const parsed = parsePassportRaw(raw);
    if (!parsed.ok) return false;
    this.discardExternal = true;
    this.applyParsed(parsed.state);
    this.save();
    this.emit();
    this.recoveryNotice = 'Previous passport save restored.';
    return true;
  }

  reconcileExternal(raw: string | null): boolean {
    if (raw === null || raw === this.lastRaw) return false;
    const before = JSON.stringify(this.exportPayload());
    if (!this.mergeExternal(raw)) return false;
    this.lastRaw = raw;
    this.synced = this.snapshotSynced();
    const changed = JSON.stringify(this.exportPayload()) !== before;
    if (changed) this.emit();
    return changed;
  }

  private mergeExternal(raw: string): boolean {
    const parsed = parsePassportRaw(raw);
    if (!parsed.ok) return false;
    const ext = parsed.state;

    const mergedStamps = new Map<StampedWorldId, StampRecord>(ext.stamps);
    for (const [id, record] of this.stamps) {
      if (this.synced.stamps.get(id) === record.earnedAt) continue;
      const theirs = mergedStamps.get(id);
      mergedStamps.set(id, {
        worldId: id,
        earnedAt: theirs ? Math.min(record.earnedAt, theirs.earnedAt) : record.earnedAt,
      });
    }

    const mergedBonus = new Map<BonusWorldId, BonusRecord>(ext.bonusCompleted);
    const localBonus = this.bonusCompleted.get('L01');
    if (localBonus && this.synced.bonusL01 !== localBonus.completedAt) {
      const theirs = mergedBonus.get('L01');
      mergedBonus.set('L01', {
        worldId: 'L01',
        completedAt: theirs ? Math.min(localBonus.completedAt, theirs.completedAt) : localBonus.completedAt,
      });
    }

    const mergedVisited = new Map<PocketWorldId, number>(ext.visited);
    for (const [id, at] of this.visited) {
      if (this.synced.visited.get(id) === at) continue;
      const theirs = mergedVisited.get(id);
      mergedVisited.set(id, theirs !== undefined ? Math.min(at, theirs) : at);
    }

    const unlockedChangedLocally = this.uiUnlocked !== this.synced.unlockedUi;
    this.uiUnlocked = unlockedChangedLocally
      ? this.uiUnlocked || ext.unlockedUi
      : ext.unlockedUi;
    this.stamps = mergedStamps;
    this.bonusCompleted = mergedBonus;
    this.visited = mergedVisited;
    return true;
  }

  private applyParsed(state: ParsedPassportState): void {
    this.uiUnlocked = state.unlockedUi;
    this.stamps = new Map(state.stamps);
    this.bonusCompleted = new Map(state.bonusCompleted);
    this.visited = new Map(state.visited);
  }

  private snapshotSynced(): SyncedPassportState {
    return {
      unlockedUi: this.uiUnlocked,
      stamps: new Map([...this.stamps].map(([id, rec]) => [id, rec.earnedAt])),
      bonusL01: this.bonusCompleted.get('L01')?.completedAt ?? null,
      visited: new Map(this.visited),
    };
  }

  private load(): void {
    if (!this.storage) return;
    const raw = this.storage.getItem(PASSPORT_KEY);
    if (!raw) return;

    const parsed = parsePassportRaw(raw);
    if (!parsed.ok) {
      this.quarantine(raw, parsed.reason);
      const restored = this.tryRestoreBackupOnLoad();
      this.recoveryNotice = restored
        ? 'Passport data was unreadable and quarantined. Restored from your last valid backup.'
        : parsed.reason === 'future-version'
          ? 'A newer passport format was quarantined. A fresh passport is in use.'
          : 'Passport data was unreadable and quarantined. A fresh passport is in use.';
      return;
    }

    this.applyParsed(parsed.state);
    this.lastRaw = raw;
    this.synced = this.snapshotSynced();
    if (parsed.dropped > 0) {
      this.quarantine(raw, 'unreadable-entries');
      this.recoveryNotice = `${parsed.dropped} passport ${parsed.dropped === 1 ? 'entry was' : 'entries were'} unreadable and set aside (a copy is quarantined).`;
    }
  }

  private tryRestoreBackupOnLoad(): boolean {
    if (!this.storage) return false;
    const backupRaw = this.storage.getItem(PASSPORT_BACKUP_KEY);
    if (!backupRaw) return false;
    const parsed = parsePassportRaw(backupRaw);
    if (!parsed.ok) return false;
    this.applyParsed(parsed.state);
    try {
      const normalized = JSON.stringify(this.exportPayload());
      this.storage.setItem(PASSPORT_KEY, normalized);
      this.lastRaw = normalized;
      this.synced = this.snapshotSynced();
    } catch {
      this.lastRaw = null;
      this.synced = emptySynced();
    }
    return true;
  }

  private quarantine(raw: string, reason: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(PASSPORT_QUARANTINE_KEY, JSON.stringify({
        at: new Date().toISOString(),
        reason,
        payload: raw.slice(0, 200_000),
      }));
    } catch {
      /* quota */
    }
  }

  private save(): void {
    if (!this.storage) return;
    const discard = this.discardExternal;
    this.discardExternal = false;
    try {
      const previous = this.storage.getItem(PASSPORT_KEY);
      if (previous !== null && previous !== this.lastRaw && !discard) {
        this.mergeExternal(previous);
      }
      if (previous && parsePassportRaw(previous).ok) {
        this.storage.setItem(PASSPORT_BACKUP_KEY, previous);
      }
      const raw = JSON.stringify(this.exportPayload());
      this.storage.setItem(PASSPORT_KEY, raw);
      this.lastRaw = raw;
      this.synced = this.snapshotSynced();
      persistenceHealth.saved('passport');
    } catch (error) {
      persistenceHealth.failed('passport', error);
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

interface ParsedPassportState {
  unlockedUi: boolean;
  stamps: Map<StampedWorldId, StampRecord>;
  bonusCompleted: Map<BonusWorldId, BonusRecord>;
  visited: Map<PocketWorldId, number>;
}

type ParsePassportResult =
  | { ok: true; state: ParsedPassportState; dropped: number }
  | { ok: false; reason: 'malformed-json' | 'future-version' | 'wrong-shape' };

export function parsePassportPayloadValue(parsed: unknown): ParsePassportResult {
  if (!isPlainObject(parsed)) return { ok: false, reason: 'wrong-shape' };
  const version = Number(parsed.version);
  if (!Number.isInteger(version) || version < 1) return { ok: false, reason: 'wrong-shape' };
  if (version > PASSPORT_VERSION) return { ok: false, reason: 'future-version' };
  if (typeof parsed.unlockedUi !== 'boolean' || !isPlainObject(parsed.stamps)) {
    return { ok: false, reason: 'wrong-shape' };
  }
  if (parsed.bonusCompleted !== undefined && !isPlainObject(parsed.bonusCompleted)) {
    return { ok: false, reason: 'wrong-shape' };
  }
  if (parsed.visitedWorlds !== undefined && !isPlainObject(parsed.visitedWorlds)) {
    return { ok: false, reason: 'wrong-shape' };
  }

  let dropped = 0;
  const stamps = new Map<StampedWorldId, StampRecord>();
  for (const [id, rawRecord] of Object.entries(parsed.stamps)) {
    if (!isStampedWorldId(id)) {
      dropped++;
      continue;
    }
    if (!isPlainObject(rawRecord) || typeof rawRecord.earnedAt !== 'number' || !Number.isFinite(rawRecord.earnedAt)) {
      dropped++;
      continue;
    }
    stamps.set(id, { worldId: id, earnedAt: rawRecord.earnedAt });
  }

  const bonusCompleted = new Map<BonusWorldId, BonusRecord>();
  if (isPlainObject(parsed.bonusCompleted)) {
    for (const [id, rawBonus] of Object.entries(parsed.bonusCompleted)) {
      if (id !== 'L01') {
        dropped++;
        continue;
      }
      if (!isPlainObject(rawBonus) || typeof rawBonus.completedAt !== 'number' || !Number.isFinite(rawBonus.completedAt)) {
        dropped++;
        continue;
      }
      bonusCompleted.set('L01', { worldId: 'L01', completedAt: rawBonus.completedAt });
    }
  }

  const visited = new Map<PocketWorldId, number>();
  if (isPlainObject(parsed.visitedWorlds)) {
    for (const [id, at] of Object.entries(parsed.visitedWorlds)) {
      if (!isPocketWorldId(id) || typeof at !== 'number' || !Number.isFinite(at)) {
        dropped++;
        continue;
      }
      visited.set(id, at);
    }
  }

  return {
    ok: true,
    state: {
      unlockedUi: parsed.unlockedUi,
      stamps,
      bonusCompleted,
      visited,
    },
    dropped,
  };
}

function parsePassportRaw(raw: string): ParsePassportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'malformed-json' };
  }
  return parsePassportPayloadValue(parsed);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteTimestamp(now: number): number {
  return Number.isFinite(now) ? now : Date.now();
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
