import { describe, expect, it } from 'vitest';
import { Journal, JOURNAL_KEY } from '../src/state/Journal';
import { SecretsLog, SECRETS_KEY } from '../src/state/Secrets';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../src/state/Preferences';
import { STUDY_KEY, Study } from '../src/state/Study';
import { VisitThread } from '../src/state/VisitThread';
import { applyVisitorSession, exportVisitorSession, previewVisitorSession, restoreVisitorSession } from '../src/state/VisitorSession';
import { attachIntegrity } from '../src/state/integrity';

function storageFixture() {
  const values = new Map<string, string>();
  let failOnce: string | null = null;
  const storage: Storage = {
    get length() { return values.size; },
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === failOnce) {
        failOnce = null;
        throw new Error('Storage quota test');
      }
      values.set(key, value);
    },
    key: index => [...values.keys()][index] ?? null,
    clear: () => values.clear(),
    removeItem: key => { values.delete(key); },
  };
  return { storage, values, failNextWriteTo: (key: string) => { failOnce = key; } };
}

function parts(storage: Storage | null) {
  return {
    journal: new Journal(storage),
    study: new Study(() => new Set(['E01', 'E02']), storage),
    preferences: storage ? loadPreferences(storage) : { ...DEFAULT_PREFERENCES },
    visitThread: new VisitThread(storage),
    secretsLog: new SecretsLog(storage),
  };
}

function sourceFile() {
  const source = parts(null);
  source.journal.toggleBookmark('E01');
  source.study.commit(state => { state.collections.push({ id: 'north', name: 'North', color: 'gold', members: ['E01'] }); });
  source.preferences.uiScale = 1.35;
  source.visitThread.start({ preset: 'highlights', pace: 'quick', avoidVisited: false, preferBookmarks: false }, source.journal);
  source.secretsLog.markFound('tree-roots', 123);
  return exportVisitorSession(source);
}

describe('visitor session', () => {
  it('round-trips Journal, Study, preferences, route and secret finds in one import and undo', () => {
    const { storage, values } = storageFixture();
    const previous = parts(storage);
    previous.journal.markVisited('E02');
    previous.secretsLog.markFound('rotunda-balcony', 456);
    savePreferences({ ...previous.preferences, uiScale: 1.1 }, storage);
    const before = [...values];

    const preview = previewVisitorSession(sourceFile(), previous);
    expect(preview.description).toContain('1 secret find');
    expect([...values]).toEqual(before);
    applyVisitorSession(storage, preview.values);

    const imported = parts(storage);
    expect(imported.journal.bookmarks()[0]?.exhibitId).toBe('E01');
    expect(imported.journal.hasVisited('E02')).toBe(false);
    expect(imported.study.state.collections[0]?.members).toEqual(['E01']);
    expect(imported.preferences.uiScale).toBe(1.35);
    expect(imported.visitThread.active?.stopIds).toHaveLength(3);
    expect(imported.secretsLog.foundAt('tree-roots')).toBe(123);

    expect(restoreVisitorSession(storage)).toBe(true);
    expect([...values].sort()).toEqual(before.sort());
    expect(restoreVisitorSession(storage)).toBe(false);
  });

  it('rejects a corrupt or malformed file before making any storage writes', () => {
    const { storage, values } = storageFixture();
    const previous = parts(storage);
    previous.journal.markVisited('E02');
    const before = [...values];
    const file = JSON.parse(sourceFile());
    file.payload.journal.entries.E01.bookmarked = false;
    expect(() => previewVisitorSession(JSON.stringify(file), previous)).toThrow(/checksum/i);
    expect(() => previewVisitorSession(JSON.stringify(attachIntegrity({
      ...file.payload, journal: { version: 2, entries: {}, heardVisitors: 7 },
    })), previous)).toThrow(/Journal record/);
    expect([...values]).toEqual(before);
  });

  it('accepts legacy exports without erasing existing finds', () => {
    const { storage } = storageFixture();
    const previous = parts(storage);
    previous.secretsLog.markFound('tree-roots', 789);
    const { payload } = JSON.parse(sourceFile());
    delete payload.version;
    delete payload.secrets;
    applyVisitorSession(storage, previewVisitorSession(JSON.stringify(payload), previous).values);
    expect(storage.getItem(SECRETS_KEY)).toContain('789');
  });

  it('rolls back earlier writes if a later section fails', () => {
    const { storage, values, failNextWriteTo } = storageFixture();
    const previous = parts(storage);
    previous.journal.markVisited('E02');
    const before = storage.getItem(JOURNAL_KEY);
    failNextWriteTo(STUDY_KEY);
    expect(() => applyVisitorSession(storage, previewVisitorSession(sourceFile(), previous).values)).toThrow('Storage quota test');
    expect(storage.getItem(JOURNAL_KEY)).toBe(before);
    expect(values.size).toBe(1);
    expect(restoreVisitorSession(storage)).toBe(false);
  });
});
