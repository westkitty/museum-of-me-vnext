import { describe, expect, it, vi } from 'vitest';
import { Journal } from '../src/state/Journal';
import {
  VisitThread, buildVisitThreadPlan, sanitizeVisitThreadState,
  VISIT_THREAD_KEY, VISIT_THREAD_BACKUP_KEY, VISIT_THREAD_QUARANTINE_KEY, VISIT_THREAD_MAX_STOPS, VISIT_THREAD_VERSION,
} from '../src/state/VisitThread';
import { EXHIBITS_BY_ID } from '../src/content/collection.generated';
import { attachIntegrity } from '../src/state/integrity';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; }, clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null, key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key), setItem: (key, value) => void map.set(key, value),
  } as Storage;
}

function options(overrides = {}) {
  return { preset: 'highlights' as const, pace: 'standard' as const, avoidVisited: false, preferBookmarks: true, currentWing: 'south' as const, ...overrides };
}

describe('Visit Thread planner', () => {
  it('builds only real exhibit stops and respects pace', () => {
    const plan = buildVisitThreadPlan(options(), new Journal(memoryStorage()));
    expect(plan).toHaveLength(5);
    expect(plan.every((id) => EXHIBITS_BY_ID.has(id))).toBe(true);
  });

  it('uses quick and deep pace as materially different route sizes', () => {
    const journal = new Journal(memoryStorage());
    expect(buildVisitThreadPlan(options({ pace: 'quick' as const }), journal)).toHaveLength(3);
    expect(buildVisitThreadPlan(options({ pace: 'deep' as const }), journal)).toHaveLength(8);
  });


  it('keeps standard pace at five stops', () => {
    expect(buildVisitThreadPlan(options({ pace: 'standard' as const }), new Journal(memoryStorage()))).toHaveLength(5);
  });

  it('gives the named thematic presets materially different route choices', () => {
    const journal = new Journal(memoryStorage());
    const routes = ['highlights', 'systems', 'making', 'play'].map((preset) =>
      buildVisitThreadPlan(options({ preset: preset as 'highlights' | 'systems' | 'making' | 'play', seed: 'same' }), journal).join(','));
    expect(new Set(routes).size).toBeGreaterThanOrEqual(3);
  });

  it('keeps route diversity bounded to at most two stops per wing before fill', () => {
    const plan = buildVisitThreadPlan(options({ pace: 'deep' as const, preset: 'wildcard' as const, seed: 'diverse' }), new Journal(memoryStorage()));
    const counts = new Map<string, number>();
    for (const id of plan) {
      const wing = EXHIBITS_BY_ID.get(id)!.wing;
      counts.set(wing, (counts.get(wing) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it('orders selected stops from the current wing when that wing is represented', () => {
    const plan = buildVisitThreadPlan(options({ preset: 'making' as const, currentWing: 'south' as const }), new Journal(memoryStorage()));
    expect(EXHIBITS_BY_ID.get(plan[0])?.wing).toBe('south');
  });

  it('planning is pure with respect to Journal state', () => {
    const journal = new Journal(memoryStorage());
    journal.toggleBookmark('E22');
    const before = JSON.stringify(journal.exportPayload());
    buildVisitThreadPlan(options({ preset: 'bookmarks' as const }), journal);
    expect(JSON.stringify(journal.exportPayload())).toBe(before);
  });

  it('makes wildcard routes stable for the same seed and different for another seed', () => {
    const journal = new Journal(memoryStorage());
    const a = buildVisitThreadPlan(options({ preset: 'wildcard' as const, seed: 'alpha' }), journal);
    const b = buildVisitThreadPlan(options({ preset: 'wildcard' as const, seed: 'alpha' }), journal);
    const c = buildVisitThreadPlan(options({ preset: 'wildcard' as const, seed: 'beta' }), journal);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('prefers unvisited exhibits when asked', () => {
    const journal = new Journal(memoryStorage());
    for (const id of ['E27', 'E30', 'E32']) journal.markVisited(id);
    const plan = buildVisitThreadPlan(options({ avoidVisited: true }), journal);
    expect(plan.some((id) => ['E27', 'E30', 'E32'].includes(id))).toBe(false);
  });


  it('can focus a route to one wing without inventing destinations', () => {
    const plan = buildVisitThreadPlan(options({ onlyWing: 'media' as const, pace: 'quick' as const }), new Journal(memoryStorage()));
    expect(plan).toHaveLength(3);
    expect(plan.every((id) => EXHIBITS_BY_ID.get(id)?.wing === 'media')).toBe(true);
  });

  it('uses a local topic to materially change ranking', () => {
    const journal = new Journal(memoryStorage());
    const music = buildVisitThreadPlan(options({ topic: 'music audio voice', pace: 'quick' as const }), journal);
    const infrastructure = buildVisitThreadPlan(options({ topic: 'infrastructure continuity systems', pace: 'quick' as const }), journal);
    expect(music).not.toEqual(infrastructure);
  });

  it('can make a route from bookmarks', () => {
    const journal = new Journal(memoryStorage());
    for (const id of ['E05', 'E22', 'E34']) journal.toggleBookmark(id);
    const plan = buildVisitThreadPlan(options({ preset: 'bookmarks' as const, pace: 'quick' as const }), journal);
    expect(new Set(plan)).toEqual(new Set(['E05', 'E22', 'E34']));
  });
});

describe('Visit Thread state', () => {
  it('persists an integrity-protected active thread', () => {
    const store = memoryStorage();
    const first = new VisitThread(store);
    const journal = new Journal(memoryStorage());
    expect(first.start(options(), journal)).not.toBeNull();
    const raw = store.getItem(VISIT_THREAD_KEY)!;
    expect(raw).toContain('SHA-256');
    const second = new VisitThread(store);
    expect(second.active?.stopIds).toEqual(first.active?.stopIds);
  });

  it('auto-advances only when the current route stop is actually visited', () => {
    const thread = new VisitThread(memoryStorage());
    const journal = new Journal(memoryStorage());
    thread.start(options(), journal);
    const current = thread.currentStopId!;
    const other = thread.active!.stopIds[1];
    expect(thread.recordVisit(other).advanced).toBe(false);
    expect(thread.currentStopId).toBe(current);
    expect(thread.recordVisit(current).advanced).toBe(true);
    expect(thread.currentStopId).not.toBe(current);
  });


  it('records an out-of-order route visit without jumping the current cursor', () => {
    const thread = new VisitThread(memoryStorage());
    thread.start(options(), new Journal(memoryStorage()));
    const current = thread.currentStopId!;
    const later = thread.active!.stopIds[2];
    thread.recordVisit(later);
    expect(thread.active!.completedIds).toContain(later);
    expect(thread.currentStopId).toBe(current);
  });

  it('pauses and resumes without discarding route state', () => {
    const thread = new VisitThread(memoryStorage());
    thread.start(options(), new Journal(memoryStorage()));
    const stops = [...thread.active!.stopIds];
    thread.pause();
    expect(thread.active?.status).toBe('paused');
    thread.resume();
    expect(thread.active?.status).toBe('active');
    expect(thread.active?.stopIds).toEqual(stops);
  });

  it('supports skip, previous, direct stop selection, reverse and restart without teleport semantics', () => {
    const thread = new VisitThread(memoryStorage());
    thread.start(options(), new Journal(memoryStorage()));
    const original = [...thread.active!.stopIds];
    const first = thread.currentStopId!;
    thread.skipCurrent();
    expect(thread.active!.skippedIds).toContain(first);
    thread.previous();
    expect(thread.currentStopId).toBe(first);
    expect(thread.goToStop(original[2])).toBe(true);
    thread.reverse();
    expect(thread.active!.stopIds).toEqual([...original].reverse());
    thread.restart();
    expect(thread.active!.completedIds).toEqual([]);
    expect(thread.active!.skippedIds).toEqual([]);
  });

  it('supports bounded route editing', () => {
    const thread = new VisitThread(memoryStorage());
    thread.start(options({ pace: 'quick' as const }), new Journal(memoryStorage()));
    const before = [...thread.active!.stopIds];
    expect(thread.moveStop(before[1], -1)).toBe(true);
    expect(thread.active!.stopIds[0]).toBe(before[1]);
    expect(thread.removeStop(before[2])).toBe(true);
    const candidate = [...EXHIBITS_BY_ID.keys()].find((id) => !thread.active!.stopIds.includes(id))!;
    expect(thread.addStop(candidate)).toBe(true);
    while (thread.active!.stopIds.length < VISIT_THREAD_MAX_STOPS) {
      const next = [...EXHIBITS_BY_ID.keys()].find((id) => !thread.active!.stopIds.includes(id));
      if (!next) break;
      thread.addStop(next);
    }
    expect(thread.addStop('E35')).toBe(false);
  });

  it('archives a completed thread and can replay it later', () => {
    const thread = new VisitThread(memoryStorage());
    thread.start(options({ pace: 'quick' as const }), new Journal(memoryStorage()));
    for (const id of [...thread.active!.stopIds]) thread.recordVisit(id);
    expect(thread.active?.status).toBe('complete');
    expect(thread.state.recent).toHaveLength(1);
    const id = thread.state.recent[0].id;
    thread.end();
    expect(thread.active).toBeNull();
    expect(thread.resumeRecent(id)).toBe(true);
    expect(thread.active?.status).toBe('active');
  });

  it('completes and archives only after every route stop is handled', () => {
    const thread = new VisitThread(memoryStorage());
    thread.start(options({ pace: 'quick' as const }), new Journal(memoryStorage()));
    const [first, second, third] = [...thread.active!.stopIds];
    thread.recordVisit(first);
    thread.recordVisit(second);
    expect(thread.active?.status).toBe('active');
    expect(thread.state.recent).toHaveLength(0);
    thread.recordVisit(third);
    expect(thread.active?.status).toBe('complete');
    expect(thread.state.recent).toHaveLength(1);
  });

  it('backs up mutations and restores the previous valid thread state', () => {
    const store = memoryStorage();
    const thread = new VisitThread(store);
    thread.start(options(), new Journal(memoryStorage()));
    const activeId = thread.active!.id;
    thread.pause();
    expect(store.getItem(VISIT_THREAD_BACKUP_KEY)).toBeTruthy();
    expect(thread.active?.status).toBe('paused');
    expect(thread.restorePrevious()).toBe(true);
    expect(thread.active?.id).toBe(activeId);
    expect(thread.active?.status).toBe('active');
  });

  it('quarantines malformed persisted JSON instead of throwing it away silently', () => {
    const store = memoryStorage();
    store.setItem(VISIT_THREAD_KEY, '{broken');
    const thread = new VisitThread(store);
    expect(thread.active).toBeNull();
    expect(thread.recoveryNotice).toContain('quarantined');
    expect(store.getItem(VISIT_THREAD_QUARANTINE_KEY)).toContain('malformed-json');
  });

  it('rejects a future persisted schema and preserves quarantine evidence', () => {
    const store = memoryStorage();
    const future = attachIntegrity({ version: VISIT_THREAD_VERSION + 1, revision: 0, writerId: 'future', updatedAt: 1, active: null, recent: [] });
    store.setItem(VISIT_THREAD_KEY, JSON.stringify(future));
    const thread = new VisitThread(store);
    expect(thread.active).toBeNull();
    expect(thread.recoveryNotice).toContain('newer Visit Thread format');
    expect(store.getItem(VISIT_THREAD_QUARANTINE_KEY)).toContain('future-version');
  });

  it('keeps fingerprints stable until state changes', () => {
    const thread = new VisitThread(memoryStorage());
    const before = thread.fingerprint();
    expect(thread.fingerprint()).toBe(before);
    thread.start(options(), new Journal(memoryStorage()));
    expect(thread.fingerprint()).not.toBe(before);
  });

  it('reconciles only newer state from another writer', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-15T10:00:00Z'));
      const older = new VisitThread(memoryStorage());
      older.start(options({ pace: 'quick' as const }), new Journal(memoryStorage()));
      vi.setSystemTime(new Date('2026-09-15T10:00:01Z'));
      const newer = new VisitThread(memoryStorage());
      newer.start(options({ pace: 'deep' as const }), new Journal(memoryStorage()));
      expect(older.reconcileExternal(JSON.stringify(newer.exportPayload()))).toBe(true);
      expect(older.active?.stopIds).toHaveLength(8);
      expect(older.reconcileExternal(JSON.stringify(newer.exportPayload()))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects tampered persisted state and quarantines the evidence', () => {
    const store = memoryStorage();
    const thread = new VisitThread(store);
    thread.start(options(), new Journal(memoryStorage()));
    const parsed = JSON.parse(store.getItem(VISIT_THREAD_KEY)!);
    parsed.payload.active.title = 'tampered';
    store.setItem(VISIT_THREAD_KEY, JSON.stringify(parsed));
    const recovered = new VisitThread(store);
    expect(recovered.active).toBeNull();
    expect(store.getItem(VISIT_THREAD_QUARANTINE_KEY)).toContain('integrity');
  });

  it('sanitizes unknown ids, duplicates and oversized route state', () => {
    const state = sanitizeVisitThreadState({ active: { stopIds: ['E01', 'E01', 'fake', ...[...EXHIBITS_BY_ID.keys()]], cursor: 999 } });
    expect(state.active!.stopIds.length).toBeLessThanOrEqual(VISIT_THREAD_MAX_STOPS);
    expect(new Set(state.active!.stopIds).size).toBe(state.active!.stopIds.length);
    expect(state.active!.stopIds).not.toContain('fake');
    expect(state.active!.cursor).toBeLessThan(state.active!.stopIds.length);
  });

  it('previews and applies imports without mutating on preview', () => {
    const source = new VisitThread(memoryStorage());
    source.start(options(), new Journal(memoryStorage()));
    const raw = JSON.stringify(source.exportPayload());
    const target = new VisitThread(memoryStorage());
    const preview = target.previewImport(raw);
    expect(preview.ok).toBe(true);
    expect(target.active).toBeNull();
    target.applyImport(preview.state!);
    expect(target.active?.stopIds).toEqual(source.active?.stopIds);
  });
});
