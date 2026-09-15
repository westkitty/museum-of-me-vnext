import { COLLECTION, EXHIBITS_BY_ID, WINGS_BY_ID } from '../content/collection.generated';
import type { ExhibitRecord, WingId } from '../content/types';
import type { Journal } from './Journal';
import { attachIntegrity, checksumPayload, verifyIntegrity } from './integrity';

export const VISIT_THREAD_KEY = 'museum-of-me:visit-thread:v1';
export const VISIT_THREAD_BACKUP_KEY = 'museum-of-me:visit-thread:backup';
export const VISIT_THREAD_QUARANTINE_KEY = 'museum-of-me:visit-thread:quarantine';
export const VISIT_THREAD_VERSION = 1;
export const VISIT_THREAD_IMPORT_MAX_BYTES = 128 * 1024;
export const VISIT_THREAD_MAX_STOPS = 12;
export const VISIT_THREAD_MAX_RECENT = 8;

export type VisitThreadPreset = 'highlights' | 'systems' | 'making' | 'play' | 'wildcard' | 'bookmarks';
export type VisitThreadPace = 'quick' | 'standard' | 'deep';
export type VisitThreadStatus = 'active' | 'paused' | 'complete';

export interface VisitThreadOptions {
  preset: VisitThreadPreset;
  pace: VisitThreadPace;
  avoidVisited: boolean;
  preferBookmarks: boolean;
  currentWing?: WingId | null;
  seed?: string;
  topic?: string;
  onlyWing?: WingId | null;
}

export interface ActiveVisitThread {
  id: string;
  title: string;
  preset: VisitThreadPreset;
  pace: VisitThreadPace;
  status: VisitThreadStatus;
  createdAt: number;
  updatedAt: number;
  stopIds: string[];
  cursor: number;
  completedIds: string[];
  skippedIds: string[];
  avoidVisited: boolean;
  preferBookmarks: boolean;
  topic: string;
  onlyWing: WingId | null;
}

export interface VisitThreadRecent {
  id: string;
  title: string;
  preset: VisitThreadPreset;
  pace: VisitThreadPace;
  finishedAt: number;
  stopIds: string[];
}

export interface VisitThreadState {
  version: number;
  revision: number;
  writerId: string;
  updatedAt: number;
  active: ActiveVisitThread | null;
  recent: VisitThreadRecent[];
}

export interface VisitThreadImportPreview {
  ok: boolean;
  state: VisitThreadState | null;
  message: string;
}

const PACE_STOPS: Record<VisitThreadPace, number> = { quick: 3, standard: 5, deep: 8 };
const PRESET_TITLES: Record<VisitThreadPreset, string> = {
  highlights: 'Museum Highlights',
  systems: 'Systems Under the Floorboards',
  making: 'How the Work Gets Made',
  play: 'Things You Can Play',
  wildcard: 'Useful Strange Things',
  bookmarks: 'Your Bookmarked Thread',
};

const WING_SEQUENCE: WingId[] = ['south', 'east', 'north', 'west', 'media', 'infra'];
const KNOWN_IDS = new Set(COLLECTION.exhibits.map((exhibit) => exhibit.id));

function safeStorage(): Storage | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function newWriterId(): string {
  return `thread-${Math.random().toString(36).slice(2, 10)}`;
}

function uniqueKnown(ids: unknown, limit = VISIT_THREAD_MAX_STOPS): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && KNOWN_IDS.has(id)))].slice(0, limit);
}

function validPreset(value: unknown): VisitThreadPreset {
  return ['highlights', 'systems', 'making', 'play', 'wildcard', 'bookmarks'].includes(String(value))
    ? value as VisitThreadPreset : 'highlights';
}

function validPace(value: unknown): VisitThreadPace {
  return ['quick', 'standard', 'deep'].includes(String(value)) ? value as VisitThreadPace : 'standard';
}

function sanitizeActive(value: unknown): ActiveVisitThread | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ActiveVisitThread>;
  const stopIds = uniqueKnown(raw.stopIds);
  if (stopIds.length === 0) return null;
  const completedIds = uniqueKnown(raw.completedIds).filter((id) => stopIds.includes(id));
  const skippedIds = uniqueKnown(raw.skippedIds).filter((id) => stopIds.includes(id) && !completedIds.includes(id));
  const cursor = Math.max(0, Math.min(stopIds.length - 1, Math.floor(Number(raw.cursor) || 0)));
  const status: VisitThreadStatus = raw.status === 'paused' || raw.status === 'complete' ? raw.status : 'active';
  return {
    id: String(raw.id || newId('visit')).slice(0, 80),
    title: String(raw.title || PRESET_TITLES[validPreset(raw.preset)]).slice(0, 96),
    preset: validPreset(raw.preset),
    pace: validPace(raw.pace),
    status,
    createdAt: Math.max(0, Number(raw.createdAt) || Date.now()),
    updatedAt: Math.max(0, Number(raw.updatedAt) || Date.now()),
    stopIds,
    cursor,
    completedIds,
    skippedIds,
    avoidVisited: Boolean(raw.avoidVisited),
    preferBookmarks: Boolean(raw.preferBookmarks),
    topic: String(raw.topic ?? '').trim().slice(0, 80),
    onlyWing: typeof raw.onlyWing === 'string' && WINGS_BY_ID.has(raw.onlyWing as WingId) ? raw.onlyWing as WingId : null,
  };
}

export function sanitizeVisitThreadState(value: unknown): VisitThreadState {
  const raw = value && typeof value === 'object' ? value as Partial<VisitThreadState> : {};
  const recent = (Array.isArray(raw.recent) ? raw.recent : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const entry = item as Partial<VisitThreadRecent>;
      const stopIds = uniqueKnown(entry.stopIds);
      return {
        id: String(entry.id || newId('recent')).slice(0, 80),
        title: String(entry.title || PRESET_TITLES[validPreset(entry.preset)]).slice(0, 96),
        preset: validPreset(entry.preset),
        pace: validPace(entry.pace),
        finishedAt: Math.max(0, Number(entry.finishedAt) || Date.now()),
        stopIds,
      } satisfies VisitThreadRecent;
    })
    .filter((entry) => entry.stopIds.length > 0)
    .slice(-VISIT_THREAD_MAX_RECENT);
  return {
    version: VISIT_THREAD_VERSION,
    revision: Math.max(0, Math.floor(Number(raw.revision) || 0)),
    writerId: String(raw.writerId || ''),
    updatedAt: Math.max(0, Number(raw.updatedAt) || 0),
    active: sanitizeActive(raw.active),
    recent,
  };
}

function searchable(exhibit: ExhibitRecord): string {
  const projects = COLLECTION.projects.filter((project) => exhibit.projectIds.includes(project.id));
  return [
    exhibit.title, exhibit.copy.subtitle, exhibit.copy.plaque, exhibit.copy.problem,
    exhibit.copy.made, exhibit.copy.interaction,
    ...projects.flatMap((project) => [project.name, project.family, project.kind, project.summary, ...project.capabilities]),
  ].join(' ').toLocaleLowerCase();
}

function presetAffinity(exhibit: ExhibitRecord, preset: VisitThreadPreset): number {
  const haystack = searchable(exhibit);
  if (preset === 'highlights') return exhibit.tier === 'A' ? 28 : exhibit.tier === 'B' ? 13 : 4;
  if (preset === 'systems') return /system|infrastructure|continuity|authority|agent|local|control|architecture|data|pipeline|toolkit/.test(haystack) ? 26 : 0;
  if (preset === 'making') return /creative|media|prompt|music|animation|performance|capture|generation|design|author|maker|production/.test(haystack) ? 26 : 0;
  if (preset === 'play') return /game|play|interactive|simulation|katamari|vfx|ability|world|explor/.test(haystack) ? 26 : 0;
  return 10;
}

function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function wingDistance(from: WingId | null | undefined, to: WingId): number {
  if (!from) return 1;
  if (from === to) return 0;
  const a = WING_SEQUENCE.indexOf(from);
  const b = WING_SEQUENCE.indexOf(to);
  if (a < 0 || b < 0) return 2;
  const direct = Math.abs(a - b);
  return Math.min(direct, WING_SEQUENCE.length - direct);
}

function routeOrder(ids: string[], currentWing?: WingId | null): string[] {
  const groups = new Map<WingId, string[]>();
  for (const id of ids) {
    const exhibit = EXHIBITS_BY_ID.get(id);
    if (!exhibit) continue;
    const group = groups.get(exhibit.wing) ?? [];
    group.push(id);
    groups.set(exhibit.wing, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  const wingOrder = [...groups.keys()].sort((a, b) =>
    wingDistance(currentWing, a) - wingDistance(currentWing, b)
      || WING_SEQUENCE.indexOf(a) - WING_SEQUENCE.indexOf(b));
  return wingOrder.flatMap((wing) => groups.get(wing) ?? []);
}

/** Pure deterministic route planner. No navigation or persistence side effects. */
export function buildVisitThreadPlan(options: VisitThreadOptions, journal: Journal): string[] {
  const count = PACE_STOPS[options.pace];
  const bookmarked = new Set(journal.bookmarks().map((entry) => entry.exhibitId));
  let candidates = [...COLLECTION.exhibits];
  if (options.onlyWing) candidates = candidates.filter((exhibit) => exhibit.wing === options.onlyWing);
  if (options.preset === 'bookmarks') {
    const saved = candidates.filter((exhibit) => bookmarked.has(exhibit.id));
    if (saved.length > 0) candidates = saved;
  }

  const seed = options.seed ?? `${options.preset}:${options.pace}`;
  const topicWords = String(options.topic ?? '').toLocaleLowerCase().split(/\s+/).filter((word) => word.length > 1).slice(0, 8);
  const scored = candidates.map((exhibit) => {
    const affinity = presetAffinity(exhibit, options.preset);
    const unvisited = journal.hasVisited(exhibit.id) ? 0 : 18;
    const bookmark = bookmarked.has(exhibit.id) && options.preferBookmarks ? 14 : 0;
    const current = options.currentWing === exhibit.wing ? 5 : 0;
    const wildcard = options.preset === 'wildcard' ? (stableHash(`${seed}:${exhibit.id}`) % 1000) / 100 : 0;
    const avoided = options.avoidVisited && journal.hasVisited(exhibit.id) ? -40 : 0;
    const haystack = searchable(exhibit);
    const topic = topicWords.length ? topicWords.reduce((score, word) => score + (haystack.includes(word) ? 18 : -3), 0) : 0;
    return { exhibit, score: affinity + unvisited + bookmark + current + wildcard + avoided + topic };
  });

  scored.sort((a, b) => b.score - a.score || a.exhibit.id.localeCompare(b.exhibit.id, undefined, { numeric: true }));

  // Diversity is structural, not random: take at most two stops from a wing
  // until each represented wing has had a chance, then fill remaining slots.
  const selected: string[] = [];
  const perWing = new Map<WingId, number>();
  for (const entry of scored) {
    if (selected.length >= count) break;
    if (entry.score <= 0 && selected.length > 0) continue;
    const used = perWing.get(entry.exhibit.wing) ?? 0;
    if (used >= 2) continue;
    selected.push(entry.exhibit.id);
    perWing.set(entry.exhibit.wing, used + 1);
  }
  for (const entry of scored) {
    if (selected.length >= count) break;
    if (!selected.includes(entry.exhibit.id)) selected.push(entry.exhibit.id);
  }
  return routeOrder(selected.slice(0, count), options.currentWing);
}

export class VisitThread {
  state: VisitThreadState;
  recoveryNotice: string | null = null;
  readonly writerId = newWriterId();
  private readonly storage: Storage | null;
  private readonly listeners = new Set<() => void>();

  constructor(storage: Storage | null = safeStorage()) {
    this.storage = storage;
    this.state = this.read();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get active(): ActiveVisitThread | null { return this.state.active; }
  get currentStopId(): string | null {
    const active = this.state.active;
    if (!active || active.status === 'complete') return null;
    return active.stopIds[active.cursor] ?? null;
  }
  get remainingCount(): number {
    const active = this.state.active;
    if (!active) return 0;
    return active.stopIds.filter((id) => !active.completedIds.includes(id) && !active.skippedIds.includes(id)).length;
  }

  start(options: VisitThreadOptions, journal: Journal): ActiveVisitThread | null {
    const stopIds = buildVisitThreadPlan(options, journal);
    if (stopIds.length === 0) return null;
    const now = Date.now();
    const active: ActiveVisitThread = {
      id: newId('visit'), title: options.topic?.trim() ? `${PRESET_TITLES[options.preset]} · ${options.topic.trim().slice(0, 48)}` : PRESET_TITLES[options.preset], preset: options.preset, pace: options.pace,
      status: 'active', createdAt: now, updatedAt: now, stopIds, cursor: 0,
      completedIds: [], skippedIds: [], avoidVisited: options.avoidVisited, preferBookmarks: options.preferBookmarks,
      topic: String(options.topic ?? '').trim().slice(0, 80), onlyWing: options.onlyWing ?? null,
    };
    this.commit((state) => { state.active = active; });
    return this.state.active;
  }

  resumeRecent(id: string): boolean {
    const recent = this.state.recent.find((item) => item.id === id);
    if (!recent) return false;
    const now = Date.now();
    this.commit((state) => {
      state.active = {
        id: newId('visit'), title: recent.title, preset: recent.preset, pace: recent.pace,
        status: 'active', createdAt: now, updatedAt: now, stopIds: [...recent.stopIds], cursor: 0,
        completedIds: [], skippedIds: [], avoidVisited: false, preferBookmarks: false, topic: '', onlyWing: null,
      };
    });
    return true;
  }

  pause(): void { this.mutateActive((active) => { active.status = 'paused'; }); }
  resume(): void { this.mutateActive((active) => { if (active.status !== 'complete') active.status = 'active'; }); }

  recordVisit(exhibitId: string): { advanced: boolean; complete: boolean } {
    const active = this.state.active;
    if (!active || !active.stopIds.includes(exhibitId)) return { advanced: false, complete: false };
    let advanced = false;
    this.commit((state) => {
      const route = state.active;
      if (!route) return;
      if (!route.completedIds.includes(exhibitId)) route.completedIds.push(exhibitId);
      const current = route.stopIds[route.cursor];
      if (current === exhibitId) {
        advanced = true;
        this.advanceCursor(route, 1);
      }
      this.finishIfDone(state);
    });
    return { advanced, complete: this.state.active?.status === 'complete' };
  }

  skipCurrent(): string | null {
    const current = this.currentStopId;
    if (!current) return null;
    this.commit((state) => {
      const active = state.active;
      if (!active) return;
      if (!active.skippedIds.includes(current)) active.skippedIds.push(current);
      this.advanceCursor(active, 1);
      this.finishIfDone(state);
    });
    return this.currentStopId;
  }

  previous(): string | null {
    this.mutateActive((active) => this.advanceCursor(active, -1, true));
    return this.currentStopId;
  }

  goToStop(id: string): boolean {
    const active = this.state.active;
    if (!active) return false;
    const index = active.stopIds.indexOf(id);
    if (index < 0) return false;
    this.mutateActive((route) => { route.cursor = index; if (route.status === 'paused') route.status = 'active'; });
    return true;
  }

  restart(): void {
    this.mutateActive((active) => {
      active.cursor = 0; active.completedIds = []; active.skippedIds = []; active.status = 'active';
    });
  }

  reverse(): void {
    this.mutateActive((active) => {
      const current = active.stopIds[active.cursor];
      active.stopIds.reverse();
      active.cursor = Math.max(0, active.stopIds.indexOf(current));
    });
  }

  moveStop(id: string, delta: -1 | 1): boolean {
    const active = this.state.active;
    if (!active) return false;
    const index = active.stopIds.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= active.stopIds.length) return false;
    this.mutateActive((route) => {
      [route.stopIds[index], route.stopIds[next]] = [route.stopIds[next], route.stopIds[index]];
      route.cursor = Math.max(0, route.stopIds.indexOf(this.currentStopId ?? route.stopIds[0]));
    });
    return true;
  }

  removeStop(id: string): boolean {
    const active = this.state.active;
    if (!active || !active.stopIds.includes(id)) return false;
    this.commit((state) => {
      const route = state.active;
      if (!route) return;
      const wasCurrent = route.stopIds[route.cursor] === id;
      route.stopIds = route.stopIds.filter((stop) => stop !== id);
      route.completedIds = route.completedIds.filter((stop) => stop !== id);
      route.skippedIds = route.skippedIds.filter((stop) => stop !== id);
      if (route.stopIds.length === 0) { state.active = null; return; }
      route.cursor = Math.min(route.cursor, route.stopIds.length - 1);
      if (wasCurrent) this.advanceCursor(route, 0);
      this.finishIfDone(state);
    });
    return true;
  }

  addStop(id: string): boolean {
    if (!KNOWN_IDS.has(id)) return false;
    const active = this.state.active;
    if (!active || active.stopIds.includes(id) || active.stopIds.length >= VISIT_THREAD_MAX_STOPS) return false;
    this.mutateActive((route) => { route.stopIds.push(id); });
    return true;
  }

  end(): void {
    this.commit((state) => {
      if (state.active) this.archive(state, state.active);
      state.active = null;
    });
  }

  exportPayload(): ReturnType<typeof attachIntegrity<VisitThreadState>> {
    return attachIntegrity(sanitizeVisitThreadState(this.state));
  }

  fingerprint(): string { return checksumPayload(sanitizeVisitThreadState(this.state)); }

  previewImport(raw: string): VisitThreadImportPreview {
    if (raw.length > VISIT_THREAD_IMPORT_MAX_BYTES) return { ok: false, state: null, message: 'Visit Thread import is too large.' };
    try {
      const parsed = JSON.parse(raw) as unknown;
      const body = verifyIntegrity<VisitThreadState>(parsed) ? parsed.payload : parsed;
      const version = Number((body as Partial<VisitThreadState> | null)?.version);
      if (Number.isFinite(version) && version > VISIT_THREAD_VERSION) return { ok: false, state: null, message: 'Visit Thread data uses a newer schema.' };
      const next = sanitizeVisitThreadState(body);
      const stops = next.active?.stopIds.length ?? 0;
      return { ok: true, state: next, message: `Preview: ${stops} active stops, ${next.recent.length} recent threads.` };
    } catch { return { ok: false, state: null, message: 'Visit Thread import is not valid JSON.' }; }
  }

  applyImport(state: VisitThreadState): void {
    const next = sanitizeVisitThreadState(state);
    this.commit((current) => {
      current.active = next.active;
      current.recent = next.recent;
    });
  }

  restorePrevious(): boolean {
    if (!this.storage) return false;
    const raw = this.storage.getItem(VISIT_THREAD_BACKUP_KEY);
    if (!raw) return false;
    const preview = this.previewImport(raw);
    if (!preview.ok || !preview.state) return false;
    this.state = preview.state;
    this.persist(false);
    this.recoveryNotice = 'Previous Visit Thread state restored.';
    this.emit();
    return true;
  }

  reconcileExternal(raw: string): boolean {
    const preview = this.previewImport(raw);
    if (!preview.ok || !preview.state) return false;
    if (preview.state.updatedAt <= this.state.updatedAt || preview.state.writerId === this.writerId) return false;
    this.state = preview.state;
    this.emit();
    return true;
  }

  private mutateActive(mutator: (active: ActiveVisitThread) => void): void {
    if (!this.state.active) return;
    this.commit((state) => { if (state.active) mutator(state.active); });
  }

  private advanceCursor(active: ActiveVisitThread, delta: number, allowCompleted = false): void {
    if (active.stopIds.length === 0) return;
    let index = Math.max(0, Math.min(active.stopIds.length - 1, active.cursor + delta));
    const direction = delta < 0 ? -1 : 1;
    if (!allowCompleted) {
      while (index >= 0 && index < active.stopIds.length) {
        const id = active.stopIds[index];
        if (!active.completedIds.includes(id) && !active.skippedIds.includes(id)) break;
        index += direction;
      }
    }
    active.cursor = Math.max(0, Math.min(active.stopIds.length - 1, index));
  }

  private finishIfDone(state: VisitThreadState): void {
    const active = state.active;
    if (!active) return;
    const done = active.stopIds.every((id) => active.completedIds.includes(id) || active.skippedIds.includes(id));
    if (!done) return;
    active.status = 'complete';
    this.archive(state, active);
  }

  private archive(state: VisitThreadState, active: ActiveVisitThread): void {
    const entry: VisitThreadRecent = {
      id: active.id, title: active.title, preset: active.preset, pace: active.pace,
      finishedAt: Date.now(), stopIds: [...active.stopIds],
    };
    state.recent = [...state.recent.filter((item) => item.id !== entry.id), entry].slice(-VISIT_THREAD_MAX_RECENT);
  }

  private commit(mutator: (state: VisitThreadState) => void): void {
    const draft = sanitizeVisitThreadState(JSON.parse(JSON.stringify(this.state)) as VisitThreadState);
    mutator(draft);
    this.state = sanitizeVisitThreadState(draft);
    this.persist(true);
    this.emit();
  }

  private persist(backup: boolean): void {
    this.state.updatedAt = Date.now();
    this.state.revision += 1;
    this.state.writerId = this.writerId;
    if (this.state.active) this.state.active.updatedAt = this.state.updatedAt;
    if (!this.storage) return;
    try {
      const current = this.storage.getItem(VISIT_THREAD_KEY);
      if (backup && current) this.storage.setItem(VISIT_THREAD_BACKUP_KEY, current);
      this.storage.setItem(VISIT_THREAD_KEY, JSON.stringify(this.exportPayload()));
    } catch { /* storage quota / privacy mode */ }
  }

  private read(): VisitThreadState {
    const empty = sanitizeVisitThreadState({ version: VISIT_THREAD_VERSION, writerId: this.writerId });
    if (!this.storage) return empty;
    const raw = this.storage.getItem(VISIT_THREAD_KEY);
    if (!raw) return empty;
    if (raw.length > VISIT_THREAD_IMPORT_MAX_BYTES) {
      this.quarantine(raw, 'size-limit');
      this.recoveryNotice = 'Visit Thread data exceeded its size limit and was quarantined.';
      return empty;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!verifyIntegrity<VisitThreadState>(parsed)) {
        this.quarantine(raw, 'integrity');
        this.recoveryNotice = 'Visit Thread integrity failed; the damaged payload was quarantined.';
        return empty;
      }
      const version = Number(parsed.payload.version);
      if (Number.isFinite(version) && version > VISIT_THREAD_VERSION) {
        this.quarantine(raw, 'future-version');
        this.recoveryNotice = 'A newer Visit Thread format was rejected and quarantined.';
        return empty;
      }
      return sanitizeVisitThreadState(parsed.payload);
    } catch {
      this.quarantine(raw, 'malformed-json');
      this.recoveryNotice = 'Visit Thread data was unreadable and has been quarantined.';
      return empty;
    }
  }

  private quarantine(raw: string, reason: string): void {
    if (!this.storage) return;
    try { this.storage.setItem(VISIT_THREAD_QUARANTINE_KEY, JSON.stringify({ at: new Date().toISOString(), reason, payload: raw.slice(0, VISIT_THREAD_IMPORT_MAX_BYTES) })); } catch { /* quota */ }
  }

  private emit(): void { for (const listener of this.listeners) listener(); }
}

export function visitThreadStopLabel(id: string): string {
  const exhibit = EXHIBITS_BY_ID.get(id);
  if (!exhibit) return id;
  const wing = WINGS_BY_ID.get(exhibit.wing);
  return `${exhibit.title} · ${wing?.name ?? exhibit.wing}`;
}
