import { describe, expect, it } from 'vitest';
import { Journal } from '../src/state/Journal';
import { VisitThread } from '../src/state/VisitThread';
import { buildThreadWeave, collectionVocabularySize, threadWeaveForCurrent } from '../src/state/ThreadWeave';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; }, clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null, key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key), setItem: (key, value) => void map.set(key, value),
  } as Storage;
}

function makeThread() {
  const journal = new Journal(memoryStorage());
  const thread = new VisitThread(memoryStorage());
  thread.start({ preset: 'systems', pace: 'standard', avoidVisited: true, preferBookmarks: true, currentWing: 'south', topic: 'continuity architecture' }, journal);
  return { journal, thread };
}

describe('Thread Weave', () => {
  it('explains every selected stop without inventing a second route', () => {
    const { journal, thread } = makeThread();
    const weave = buildThreadWeave(thread.active!, journal);
    expect(weave.stops.map((stop) => stop.exhibitId)).toEqual(thread.active!.stopIds);
    expect(weave.stops.every((stop) => stop.selectionReason.length > 30)).toBe(true);
    expect(weave.stops[0].bridgeFromPrevious).toBeNull();
    expect(weave.stops.slice(1).every((stop) => (stop.bridgeFromPrevious?.length ?? 0) > 20)).toBe(true);
  });

  it('describes topic and novelty evidence when those options governed selection', () => {
    const { journal, thread } = makeThread();
    const current = threadWeaveForCurrent(thread.active, journal)!;
    expect(current.selectionReason).toContain('continuity architecture');
    expect(current.selectionReason).toContain('visit journal');
  });

  it('moves its current explanation with the real thread cursor', () => {
    const { journal, thread } = makeThread();
    const first = threadWeaveForCurrent(thread.active, journal)!.exhibitId;
    thread.skipCurrent();
    const second = threadWeaveForCurrent(thread.active, journal)!.exhibitId;
    expect(second).not.toBe(first);
    expect(second).toBe(thread.currentStopId);
  });

  it('derives connections from a substantial local collection vocabulary', () => {
    expect(collectionVocabularySize()).toBeGreaterThan(100);
  });
});
