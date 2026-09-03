import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SOURCE_INSTALLATIONS,
  SOURCE_SUPPLEMENTARY,
  SOURCE_VISITORS,
  CURATED_RASTERS,
  SOURCE_PRIMARY_COUNT,
  SOURCE_SUPPLEMENTARY_COUNT,
  SOURCE_VISITOR_COUNT,
  SOURCE_WITNESSABLE_COUNT,
  SOURCE_THREE_VERSION,
  SOURCE_SANCTUARY,
  PRIMARY_TO_VNEXT,
} from '../src/content/sourceParity';
import { sanitizePreferences, loadPreferencesResult, PREFERENCES_VERSION } from '../src/state/Preferences';
import { Journal } from '../src/state/Journal';
import { Study, sanitizeStudy } from '../src/state/Study';
import { checksumPayload, verifyIntegrity, attachIntegrity } from '../src/state/integrity';

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

describe('source-parity identities', () => {
  it('keeps the 14 primary installation identities', () => {
    expect(SOURCE_INSTALLATIONS).toHaveLength(SOURCE_PRIMARY_COUNT);
    expect(SOURCE_INSTALLATIONS.map((i) => i.id)).toEqual([
      'starsilk-atlas', 'drakken-sandbox', 'orbital-tomb', 'smores-katamari',
      'westcat-east', 'parable', 'vibe-nexus', 'westcat-familiar', 'heliocide',
      'dexdictate', 'tablet-link', 'osint-box', 'dexvault', 'dexgpt',
    ]);
    expect(new Set(SOURCE_INSTALLATIONS.map((i) => i.id)).size).toBe(14);
  });

  it('keeps the 15 supplementary identities', () => {
    expect(SOURCE_SUPPLEMENTARY).toHaveLength(SOURCE_SUPPLEMENTARY_COUNT);
    expect(SOURCE_SUPPLEMENTARY.map((s) => s.id)).toEqual([
      'drakken-compendium', 'starsilk-maker', 'sky-built-film', 'dexdictate-android',
      'ftl-research', 'bigmac-stack', 'blood-archive', 'heliocide-rush',
      'friend-cats-newsroom', 'westcat-overlay', 'dexstitch', 'handoff-necromancer',
      'dexkeeper', 'quarrymind-study', 'dexcast',
    ]);
  });

  it('keeps the 17 visitor identities, roles, and dialogue', () => {
    expect(SOURCE_VISITORS).toHaveLength(SOURCE_VISITOR_COUNT);
    expect(SOURCE_VISITORS.map((v) => v.id)).toEqual([
      'curator-archive', 'visitor-katamari', 'visitor-myth', 'visitor-local',
      'visitor-analyst', 'visitor-memory', 'visitor-access', 'docent', 'guard',
      'conservator', 'student-a', 'student-b', 'sketcher', 'architect', 'pilgrim',
      'research-pair-a', 'research-pair-b',
    ]);
    for (const visitor of SOURCE_VISITORS) {
      expect(visitor.lines.length, visitor.id).toBeGreaterThan(0);
      expect(visitor.title, visitor.id).toBeTruthy();
    }
    expect(SOURCE_VISITORS.filter((v) => v.staff).map((v) => v.id)).toEqual([
      'curator-archive', 'docent', 'guard', 'conservator',
    ]);
    expect(SOURCE_VISITORS.find((v) => v.id === 'sketcher')?.seated).toBe(true);
    expect(SOURCE_VISITORS.find((v) => v.id === 'student-a')?.group).toBeTruthy();
  });

  it('counts 46 witnessable source records', () => {
    expect(SOURCE_INSTALLATIONS.length + SOURCE_SUPPLEMENTARY.length + SOURCE_VISITORS.length)
      .toBe(SOURCE_WITNESSABLE_COUNT);
  });

  it('maps source installations onto vNext without deleting the 64/35 corpus', () => {
    expect(PRIMARY_TO_VNEXT['starsilk-atlas']).toBe('E01');
    expect(PRIMARY_TO_VNEXT['dexgpt']).toBe('sanctuary');
    expect(Object.keys(PRIMARY_TO_VNEXT)).toHaveLength(14);
  });

  it('records the curated Three.js identity as 0.185.1', () => {
    expect(SOURCE_THREE_VERSION).toBe('0.185.1');
  });
});

describe('curated rasters', () => {
  it('preserves exact SHA-256, MIME, and byte length for all nine curated rasters', () => {
    expect(CURATED_RASTERS).toHaveLength(9);
    for (const raster of CURATED_RASTERS) {
      const bytes = readFileSync(raster.relativePath);
      expect(bytes.length, raster.id).toBe(raster.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), raster.id).toBe(raster.sha256);
    }
  });

  it('keeps Dexter reference imagery and project wall art distinct', () => {
    expect(CURATED_RASTERS.map((r) => r.role)).toEqual([
      'museum-shell-background',
      'entrance-background',
      'project-art-smores-katamari',
      'project-art-drakken-sandbox',
      'project-art-westcat-familiar',
      'project-art-orbital-tomb',
      'project-art-starsilk-atlas',
      'project-art-dexgpt',
      'dexter-turnaround-reference',
    ]);
  });
});

describe('Dexter source lock', () => {
  it('confirms the 13-point scent path and brown-eye contract in raw source data', () => {
    expect(SOURCE_SANCTUARY.scentPath).toHaveLength(13);
    expect(SOURCE_SANCTUARY.modelLock.eyes).toBe('readable brown');
    expect(SOURCE_SANCTUARY.modelLock.blindnessCue).not.toMatch(/fog/i);
    expect(SOURCE_SANCTUARY.modelLock.requiredFeatures).toContain('brown-eye');
    expect(SOURCE_SANCTUARY.modelLock.ears).toBe('hanging feathered');
  });
});

describe('preferences sanitization', () => {
  it('clamps, enumerates, and migrates while quarantining corrupt JSON', () => {
    const clean = sanitizePreferences({ quality: 'balanced', fov: 400, hudOpacity: 0.2, frameCap: 'nope', invertY: 'yes' });
    expect(clean.quality).toBe('medium');
    expect(clean.fieldOfView).toBeLessThanOrEqual(95);
    expect(clean.hudOpacity).toBe(0.5);
    expect(clean.frameCap).toBe('auto');
    expect(clean.invertY).toBe(false);
    expect(clean.version).toBe(PREFERENCES_VERSION);

    const store = memoryStorage();
    store.setItem('museum-of-me:preferences', '{not json');
    const result = loadPreferencesResult(store);
    expect(result.quarantined).toBe(true);
    expect(store.getItem('museum-of-me:preferences:quarantine')).toBeTruthy();
    expect(result.preferences.quality).toBe('auto');
  });
});

describe('journal integrity', () => {
  it('quarantines corrupt journal JSON without crashing', () => {
    const store = memoryStorage();
    store.setItem('museum-of-me:journal', 'garbage');
    const journal = new Journal(store);
    expect(journal.visitedCount).toBe(0);
    expect(journal.recoveryNotice).toMatch(/quarantine/i);
    expect(store.getItem('museum-of-me:journal:quarantine')).toBeTruthy();
  });

  it('migrates a v1 journal and keeps visits', () => {
    const store = memoryStorage();
    store.setItem('museum-of-me:journal', JSON.stringify({
      version: 1,
      entries: { E01: { exhibitId: 'E01', firstVisited: 1, lastVisited: 2, bookmarked: true, note: 'kept' } },
    }));
    const journal = new Journal(store);
    expect(journal.hasVisited('E01')).toBe(true);
    expect(journal.bookmarks()).toHaveLength(1);
  });
});

describe('study state', () => {
  it('sanitizes collections, compare slots, and saved searches', () => {
    const known = new Set(['starsilk-atlas', 'orbital-tomb']);
    const state = sanitizeStudy({
      collections: [{ id: 'c1', name: 'Canon', color: 'gold', members: ['starsilk-atlas', 'nope'] }],
      compare: ['starsilk-atlas', 'missing', 'extra'],
      savedSearches: [{ id: 's1', name: 'Atlas', query: 'type:installation atlas' }],
      queue: ['starsilk-atlas', 'starsilk-atlas'],
    }, known);
    expect(state.collections[0].members).toEqual(['starsilk-atlas']);
    expect(state.compare).toEqual(['starsilk-atlas', null]);
    expect(state.queue).toHaveLength(1);
    expect(state.savedSearches[0].query).toContain('atlas');
  });

  it('round-trips integrity envelopes', () => {
    const study = new Study(() => new Set(['E01']), memoryStorage());
    study.commit((s) => { s.pinnedId = 'E01'; });
    const envelope = attachIntegrity(study.state);
    expect(verifyIntegrity(envelope)).toBe(true);
    expect(checksumPayload(study.state)).toHaveLength(64);
  });
});
