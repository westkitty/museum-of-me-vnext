import { describe, it, expect, beforeEach } from 'vitest';
import { loadPreferences, savePreferences, DEFAULT_PREFERENCES, PREFERENCES_VERSION } from '../src/state/Preferences';
import { Journal } from '../src/state/Journal';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  } as Storage;
}

describe('preferences', () => {
  let store: Storage;
  beforeEach(() => { store = memoryStorage(); });

  it('returns defaults with no stored payload', () => {
    const p = loadPreferences(store);
    expect(p.quality).toBe(DEFAULT_PREFERENCES.quality);
    expect(p.version).toBe(PREFERENCES_VERSION);
  });

  it('round-trips', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, quality: 'low', uiScale: 1.5 }, store);
    const p = loadPreferences(store);
    expect(p.quality).toBe('low');
    expect(p.uiScale).toBe(1.5);
  });

  it('merges a partial older payload onto defaults instead of discarding it', () => {
    store.setItem('museum-of-me:preferences', JSON.stringify({ version: 0, quality: 'high' }));
    const p = loadPreferences(store);
    expect(p.quality).toBe('high');
    expect(p.masterVolume).toBe(DEFAULT_PREFERENCES.masterVolume);
    expect(p.version).toBe(PREFERENCES_VERSION);
  });

  it('survives corrupt storage', () => {
    store.setItem('museum-of-me:preferences', '{not json');
    expect(loadPreferences(store).quality).toBe(DEFAULT_PREFERENCES.quality);
  });

  it('works with no storage at all', () => {
    expect(() => savePreferences(DEFAULT_PREFERENCES, null)).not.toThrow();
    expect(loadPreferences(null).quality).toBe(DEFAULT_PREFERENCES.quality);
  });
});

describe('journal', () => {
  it('records visits without scoring them', () => {
    const j = new Journal(memoryStorage());
    j.markVisited('E01');
    j.markVisited('E02');
    j.markVisited('E01');
    expect(j.visitedCount).toBe(2);
    expect(j.hasVisited('E01')).toBe(true);
    expect(j.hasVisited('E09')).toBe(false);
  });

  it('toggles bookmarks, creating the entry if needed', () => {
    const j = new Journal(memoryStorage());
    expect(j.toggleBookmark('E19')).toBe(true);
    expect(j.bookmarks().map((b) => b.exhibitId)).toEqual(['E19']);
    expect(j.toggleBookmark('E19')).toBe(false);
    expect(j.bookmarks()).toHaveLength(0);
  });

  it('persists across instances', () => {
    const store = memoryStorage();
    const a = new Journal(store);
    a.markVisited('E32');
    a.setNote('E32', 'the katamari one');
    const b = new Journal(store);
    expect(b.hasVisited('E32')).toBe(true);
    expect(b.all()[0].note).toBe('the katamari one');
  });

  it('starts fresh on a corrupt payload', () => {
    const store = memoryStorage();
    store.setItem('museum-of-me:journal', 'garbage');
    expect(new Journal(store).visitedCount).toBe(0);
  });
});
