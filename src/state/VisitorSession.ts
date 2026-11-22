import { JOURNAL_KEY, JOURNAL_VERSION, type Journal } from './Journal';
import { PASSPORT_KEY, parsePassportPayloadValue, type Passport } from './Passport';
import { PREFERENCES_KEY, PREFERENCES_LEGACY_KEY, DEFAULT_PREFERENCES, PREFERENCES_VERSION, preferencesForExport, sanitizePreferences, type VisitorPreferences } from './Preferences';
import { SECRETS_KEY, SECRETS_VERSION, type SecretsLog } from './Secrets';
import { STUDY_KEY, STUDY_SCHEMA_VERSION, type Study } from './Study';
import { VISIT_THREAD_KEY, VISIT_THREAD_VERSION, type VisitThread } from './VisitThread';
import { attachIntegrity, verifyIntegrity } from './integrity';

const BACKUP_KEY = 'museum-of-me:session:before-import';
const FORMAT = 'reliquary-session';
const VERSION = 2;
export const SESSION_MAX_BYTES = 512 * 1024;

const KEYS = [JOURNAL_KEY, STUDY_KEY, PREFERENCES_KEY, PREFERENCES_LEGACY_KEY, VISIT_THREAD_KEY, SECRETS_KEY, PASSPORT_KEY] as const;
type StorageKey = typeof KEYS[number];
type Snapshot = Partial<Record<StorageKey, string | null>>;
type SessionParts = { journal: Journal; study: Study; preferences: VisitorPreferences; visitThread: VisitThread; secretsLog: SecretsLog; passport?: Passport };

export function exportVisitorSession(parts: SessionParts): string {
  return JSON.stringify(attachIntegrity({
    format: FORMAT,
    version: VERSION,
    journal: parts.journal.exportPayload(),
    study: parts.study.state,
    preferences: preferencesForExport(parts.preferences),
    visitThread: parts.visitThread.exportPayload(),
    secrets: parts.secretsLog.exportPayload(),
    ...(parts.passport ? { passport: parts.passport.exportPayload() } : {}),
  }), null, 2);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function supportedVersion(value: Record<string, unknown>, maximum: number): boolean {
  return typeof value.version === 'number' && Number.isInteger(value.version)
    && value.version > 0 && value.version <= maximum;
}

function validJournal(value: unknown): value is Record<string, unknown> & { entries: Record<string, unknown> } {
  return record(value) && supportedVersion(value, JOURNAL_VERSION) && record(value.entries)
    && Object.values(value.entries).every(entry => record(entry) && typeof entry.firstVisited === 'number'
      && typeof entry.lastVisited === 'number' && typeof entry.note === 'string' && typeof entry.bookmarked === 'boolean')
    && ['heardVisitors', 'supplementaryRead'].every(key => value[key] === undefined
      || (Array.isArray(value[key]) && value[key].every(id => typeof id === 'string')))
    && (value.checkpoints === undefined || (Array.isArray(value.checkpoints)
      && value.checkpoints.every(checkpoint => record(checkpoint) && typeof checkpoint.id === 'string'
        && typeof checkpoint.name === 'string' && typeof checkpoint.createdAt === 'string'
        && Array.isArray(checkpoint.exhibitIds) && checkpoint.exhibitIds.every(id => typeof id === 'string'))))
    && (value.history === undefined || (Array.isArray(value.history)
      && value.history.every(entry => record(entry) && typeof entry.id === 'string' && typeof entry.title === 'string'
        && typeof entry.at === 'string' && validTarget(entry))))
    && (value.guideTarget === undefined || (record(value.guideTarget) && validTarget(value.guideTarget)));
}

function validTarget(target: Record<string, unknown>): boolean {
  return typeof target.id === 'string'
    && ['exhibit', 'installation', 'supplementary', 'visitor'].some(kind => target.kind === kind);
}

export function previewVisitorSession(raw: string, parts: Pick<SessionParts, 'study' | 'visitThread'>):
{ values: Snapshot; description: string } {
  if (raw.length > SESSION_MAX_BYTES) throw new Error('Session file is too large.');
  const parsed: unknown = JSON.parse(raw);
  if (!record(parsed)) throw new Error('This file is missing the museum session record.');
  const wrapped = 'integrity' in parsed || 'payload' in parsed;
  if (wrapped && !verifyIntegrity(parsed)) throw new Error('Session checksum does not match.');
  const body: unknown = wrapped ? parsed.payload : parsed;
  if (!record(body) || body.format !== FORMAT || (wrapped ? body.version !== VERSION : body.version !== undefined)) {
    throw new Error('This museum session format is unsupported.');
  }

  const { journal, study, preferences, visitThread, secrets, passport } = body;
  if (!validJournal(journal)) throw new Error('The Journal record is invalid.');
  const values: Snapshot = { [JOURNAL_KEY]: JSON.stringify(journal) };
  const entries = Object.keys(journal.entries).length;
  const description = [`${entries} journal ${entries === 1 ? 'entry' : 'entries'}`];
  if (wrapped || study !== undefined) {
    if (!record(study) || !supportedVersion(study, STUDY_SCHEMA_VERSION) || !record(study.tags)
      || !['collections', 'savedSearches', 'compare', 'queue', 'recent'].every(key => Array.isArray(study[key]))) {
      throw new Error('The Study Lab record is invalid.');
    }
    const result = parts.study.importRaw(JSON.stringify(study));
    if (!result.ok || !result.preview) throw new Error(result.message);
    values[STUDY_KEY] = JSON.stringify(attachIntegrity(result.preview));
    description.push(`${result.preview.collections.length} Study collections`);
  }
  if (wrapped || preferences !== undefined) {
    if (!record(preferences) || !supportedVersion(preferences, PREFERENCES_VERSION)
      || Object.entries(DEFAULT_PREFERENCES).some(([key, value]) =>
        (wrapped || preferences[key] !== undefined) && typeof preferences[key] !== typeof value)) {
      throw new Error('The preferences record is invalid.');
    }
    const state = JSON.stringify(sanitizePreferences(preferences));
    values[PREFERENCES_KEY] = state;
    values[PREFERENCES_LEGACY_KEY] = state;
    description.push('preferences');
  }
  if (wrapped || visitThread !== undefined) {
    if (!verifyIntegrity(visitThread) || !record(visitThread.payload)
      || !supportedVersion(visitThread.payload, VISIT_THREAD_VERSION) || !Array.isArray(visitThread.payload.recent)
      || (visitThread.payload.active !== null
        && (!record(visitThread.payload.active) || !Array.isArray(visitThread.payload.active.stopIds)))) {
      throw new Error('The Visit Thread record or its checksum is invalid.');
    }
    const result = parts.visitThread.previewImport(JSON.stringify(visitThread));
    if (!result.ok || !result.state) throw new Error(result.message);
    values[VISIT_THREAD_KEY] = JSON.stringify(attachIntegrity(result.state));
    description.push(`${result.state.active?.stopIds.length ?? 0} active tour stops`);
  }
  if (wrapped || secrets !== undefined) {
    if (!record(secrets) || secrets.version !== SECRETS_VERSION || !record(secrets.found)
      || !Object.values(secrets.found).every(at => typeof at === 'number' && Number.isFinite(at))) {
      throw new Error('The secret finds record is invalid.');
    }
    values[SECRETS_KEY] = JSON.stringify(secrets);
    const found = Object.keys(secrets.found).length;
    description.push(`${found} secret ${found === 1 ? 'find' : 'finds'}`);
  }
  if (passport !== undefined) {
    const parsedPassport = parsePassportPayloadValue(passport);
    if (!parsedPassport.ok || parsedPassport.dropped > 0) {
      throw new Error('The Passport record is invalid.');
    }
    const stamps: Record<string, { worldId: string; earnedAt: number }> = {};
    for (const [id, rec] of parsedPassport.state.stamps) stamps[id] = { worldId: rec.worldId, earnedAt: rec.earnedAt };
    const bonusCompleted: Record<string, { worldId: string; completedAt: number }> = {};
    const l01 = parsedPassport.state.bonusCompleted.get('L01');
    if (l01) bonusCompleted.L01 = { worldId: 'L01', completedAt: l01.completedAt };
    const visitedWorlds: Record<string, number> = {};
    for (const [id, at] of parsedPassport.state.visited) visitedWorlds[id] = at;
    values[PASSPORT_KEY] = JSON.stringify({
      version: Number((passport as Record<string, unknown>).version),
      unlockedUi: parsedPassport.state.unlockedUi,
      stamps,
      bonusCompleted,
      visitedWorlds,
    });
    const stampCount = parsedPassport.state.stamps.size;
    description.push(`${stampCount} passport ${stampCount === 1 ? 'stamp' : 'stamps'}`);
  }
  return { values, description: description.join(', ') };
}

function snapshot(storage: Storage): Snapshot {
  return Object.fromEntries(KEYS.map(key => [key, storage.getItem(key)]));
}

function write(storage: Storage, key: string, value: string | null): void {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

function replace(storage: Storage, values: Snapshot, keepUndo: boolean): void {
  const current = snapshot(storage);
  const oldBackup = storage.getItem(BACKUP_KEY);
  if (keepUndo) write(storage, BACKUP_KEY, JSON.stringify(current));
  try {
    for (const key of KEYS) {
      if (values[key] !== undefined) write(storage, key, values[key]);
    }
    if (!keepUndo) write(storage, BACKUP_KEY, null);
  } catch (error) {
    write(storage, BACKUP_KEY, null);
    for (const key of KEYS) {
      if (storage.getItem(key) !== current[key]) write(storage, key, null);
    }
    for (const key of KEYS) write(storage, key, current[key] ?? null);
    write(storage, BACKUP_KEY, oldBackup);
    throw error;
  }
}

export function applyVisitorSession(storage: Storage, values: Snapshot): void {
  replace(storage, values, true);
}

export function restoreVisitorSession(storage: Storage): boolean {
  const raw = storage.getItem(BACKUP_KEY);
  if (raw === null) return false;
  const parsed: unknown = JSON.parse(raw);
  if (!record(parsed) || !KEYS.every(key => parsed[key] === undefined || parsed[key] === null || typeof parsed[key] === 'string')) {
    throw new Error('The previous session backup is unreadable.');
  }
  replace(storage, parsed as Snapshot, false);
  return true;
}
