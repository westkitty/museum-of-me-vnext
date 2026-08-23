import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  describe('Safe Mode protects, rather than reverts, real saved settings (regression)', () => {
    // loadStoredBase() is meant to pull the visitor's real, current setting
    // for the fields Safe Mode overrides in-session, so a later unrelated
    // save doesn't clobber them with the session-only overlay. It read
    // BACKUP_KEY before the current KEY_V2 -- but BACKUP_KEY is only ever set
    // to what KEY_V2 held immediately before the save in progress, so it is
    // always one save behind. The very first save made while in Safe Mode
    // silently reverted the real setting to its previous value.
    afterEach(() => vi.unstubAllGlobals());

    it('keeps a real quality setting across an unrelated save made in Safe Mode', () => {
      savePreferences({ ...DEFAULT_PREFERENCES, quality: 'auto' }, store);
      savePreferences({ ...DEFAULT_PREFERENCES, quality: 'medium' }, store);

      vi.stubGlobal('window', { location: { search: '?safe=1' } });
      savePreferences({ ...DEFAULT_PREFERENCES, quality: 'medium', mouseSensitivity: 1.4 }, store);
      vi.unstubAllGlobals();

      const p = loadPreferences(store);
      expect(p.quality).toBe('medium');
      expect(p.mouseSensitivity).toBe(1.4);
    });
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

  it('restorePrevious fully reverts heard visitors, not just entries (regression)', () => {
    // applyParsed() only ever adds to heard/supplementary and conditionally
    // overwrites guideTarget -- it merges rather than replaces. Restoring to
    // a backup snapshot must first clear that state, or anything recorded
    // after the snapshot survives the "restore".
    const store = memoryStorage();
    const j = new Journal(store);
    j.hearVisitor('astrid'); // save #1: backup now holds nothing heard
    j.hearVisitor('bram'); // save #2: backup now holds {astrid}
    expect(j.hasHeard('astrid')).toBe(true);
    expect(j.hasHeard('bram')).toBe(true);

    expect(j.restorePrevious()).toBe(true);

    expect(j.hasHeard('astrid')).toBe(true);
    expect(j.hasHeard('bram'), 'bram was heard after the backup snapshot').toBe(false);
  });
});
