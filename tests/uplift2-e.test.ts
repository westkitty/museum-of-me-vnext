import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLECTION, projectsForExhibit } from '../src/content/collection.generated';
import { DeterministicMuseumGuide, type GuideLocation } from '../src/guide/DeterministicMuseumGuide';
import { JOURNAL_KEY, Journal } from '../src/state/Journal';
import { persistenceHealth, isQuotaError } from '../src/state/PersistenceHealth';
import { savePreferences, DEFAULT_PREFERENCES } from '../src/state/Preferences';
import { SecretsLog } from '../src/state/Secrets';
import { Lifecycle } from '../src/app/Lifecycle';
import { PLACEMENT_BY_EXHIBIT, PLACEMENTS, LEVEL_1_Y } from '../src/world/layout';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  failWith: Error | null = null;
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void {
    if (this.failWith) throw this.failWith;
    this.data.set(key, String(value));
  }
}

function quotaError(): Error {
  const error = new Error('The quota has been exceeded.');
  error.name = 'QuotaExceededError';
  return error;
}

function guideAt(journal: Journal, exhibitId: string | null, position: GuideLocation['position']): DeterministicMuseumGuide {
  return new DeterministicMuseumGuide(journal, undefined, () => ({ exhibitId, zoneLabel: 'the hall', position }));
}

const titles = new Set(COLLECTION.exhibits.map((exhibit) => exhibit.title));

describe('uplift2(E) #1 — DexGPT compares two exhibits or projects from their own records', () => {
  it('sets two named exhibits side by side, with both guide actions', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('compare Dex Voice Lab and The Full Weasel');
    expect(reply.text).toContain('Dex Voice Lab (Dex Systems, ground level) holds 5 projects');
    expect(reply.text).toContain('The Full Weasel (Games & Play, ground level) holds one project, completed');
    expect(reply.text).toContain('They are in different wings. They share no project family.');
    expect(reply.actions.map((action) => action.exhibitId)).toEqual(['E17', 'E27']);
  });

  it('accepts exhibit ids and reports a shared family only when the records share one', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('difference between E02 and E07');
    const families = new Set(projectsForExhibit('E02').map((project) => project.family));
    const shared = projectsForExhibit('E07').some((project) => families.has(project.family));
    expect(shared).toBe(true);
    expect(reply.text).toContain('They share the Starsilk / Drakken family.');
    expect(reply.actions.map((action) => action.exhibitId)).toEqual(['E02', 'E07']);
  });

  it('compares two projects by kind, family and status, quoting the status line verbatim', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('DexDictate macOS vs DexSpeak');
    expect(reply.text).toContain('status “Active”');
    expect(reply.text).toContain('status “Paused; legacy reference”');
    expect(reply.text).toContain('Both are kept in the same room, Dex Voice Lab.');
  });

  it('asks for a second name, offering real related rooms, when only one is given', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('compare Starsilk Universe');
    expect(reply.text).toMatch(/^Name two exhibits or projects/);
    for (const action of reply.actions) expect(action.exhibitId).toMatch(/^E\d\d$/);
  });
});

describe('uplift2(E) #2 — DexGPT “what is nearby” from where the visitor stands', () => {
  it('lists the three closest rooms on the same floor by walking distance, marking opened ones', () => {
    const journal = new Journal(null);
    journal.markVisited('E07');
    const at = PLACEMENT_BY_EXHIBIT.get('E08')!.visitorSpot;
    const reply = guideAt(journal, 'E08', at).answer('what is nearby?');
    expect(reply.text).toMatch(/^Nearest to you on the ground floor: /);
    expect(reply.actions).toHaveLength(3);
    expect(reply.actions.map((action) => action.exhibitId)).not.toContain('E08');
    expect(reply.text).toContain('Drakken Terraforming Laboratory in Starsilk & Drakken, about');
    expect(reply.text).toContain('(opened)');
    expect(reply.text).toContain('(not yet opened)');
    const metres = [...reply.text.matchAll(/about (\d+) m on foot/g)].map((match) => Number(match[1]));
    expect(metres).toEqual([...metres].sort((a, b) => a - b));
  });

  it('only offers upper-floor rooms to a visitor on the upper floor', () => {
    const upper = PLACEMENTS.find((placement) => placement.anchor[1] >= LEVEL_1_Y - 1)!;
    const reply = guideAt(new Journal(null), upper.exhibitId, upper.visitorSpot).answer('what is close to me');
    expect(reply.text).toMatch(/upper floor/);
    for (const action of reply.actions) expect(PLACEMENT_BY_EXHIBIT.get(action.exhibitId)!.anchor[1]).toBeGreaterThanOrEqual(LEVEL_1_Y - 1);
  });

  it('says plainly when it cannot know (outside) and keeps the Sanctuary apart from the collection', () => {
    expect(guideAt(new Journal(null), null, null).answer('nearby').actions).toEqual([]);
    const below = guideAt(new Journal(null), null, [-20, -5, -20]).answer('what is nearby');
    expect(below.text).toContain('Dexter Sanctuary stands apart from the collection');
  });
});

describe('uplift2(E) #3 — DexGPT explains how the projects in one room differ', () => {
  it('gives each project its stage, verbatim status line and its own lesson', () => {
    const reply = guideAt(new Journal(null), 'E17', null).answer('what changed between the projects in this room?');
    const projects = projectsForExhibit('E17');
    expect(reply.text).toContain(`Dex Voice Lab holds ${projects.length} projects`);
    for (const project of projects) {
      expect(reply.text).toContain(`“${project.status}”`);
      expect(reply.text).toContain(project.lesson);
    }
    expect(reply.text).toContain('this is not a timeline');
  });

  it('works for a named room from anywhere, and declines without a room', () => {
    const named = guideAt(new Journal(null), null, null).answer('how did the projects in Drakken Terraforming Compendium evolve');
    expect(named.actions[0]?.exhibitId).toBe('E02');
    const nowhere = guideAt(new Journal(null), null, null).answer('what changed in this room');
    expect(nowhere.text).toContain('not standing in an exhibit bay');
  });
});

describe('uplift2(E) #4 — DexGPT fallbacks suggest real matches instead of a dead end', () => {
  it('reads a misspelt collection word and answers the corrected question', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('starsilck');
    expect(reply.text).toMatch(/^I read “starsilck” as “starsilk”\./);
    expect(reply.actions.length).toBeGreaterThan(0);
  });

  it('names what each word finds when no exhibit answers all of them, and what found nothing', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('voice spaceship');
    expect(reply.text).toContain('Nothing in the collection answers “voice spaceship” all together.');
    expect(reply.text).toContain('For “voice”: Dex Voice Lab');
    expect(reply.text).toContain('The collection has nothing for “spaceship”.');
    for (const action of reply.actions) expect(titles.has(action.label.replace(/^Guide me to /, ''))).toBe(true);
  });

  it('still falls back honestly on words the collection does not hold', () => {
    const reply = new DeterministicMuseumGuide(new Journal(null)).answer('qwertyuiop');
    expect(reply.text).toMatch(/^I only answer from the museum’s local collection/);
    expect(reply.actions).toEqual([]);
  });
});

describe('uplift2(E) #5 — return-visit continuity from the local journal', () => {
  it('“where did I leave off” summarises the journal instead of matching an unrelated room', () => {
    const journal = new Journal(null);
    journal.markVisited('E07', 1_000);
    journal.markVisited('E02', 2_000);
    journal.toggleBookmark('E07');
    journal.setNote('E02', 'Look again at the Egg.');
    const reply = new DeterministicMuseumGuide(journal).answer('Where did I leave off?');
    expect(reply.text).toContain('records 2 of 35 exhibits opened');
    expect(reply.text).toContain('The most recent was Drakken Terraforming Compendium');
    expect(reply.text).toContain('You bookmarked Drakken Terraforming Laboratory');
    expect(reply.text).toContain('You left a note on 1 exhibit');
    expect(reply.actions.map((action) => action.exhibitId)).not.toContain('E35');
    expect(reply.actions.at(-1)).toEqual({ kind: 'guide', exhibitId: 'E02', label: 'Back to Drakken Terraforming Compendium' });
  });

  it('offers to carry on to the saved floor-line target', () => {
    const journal = new Journal(null);
    journal.markVisited('E01');
    journal.setGuideTarget({ kind: 'exhibit', id: 'E20' });
    const reply = new DeterministicMuseumGuide(journal).answer('recap');
    expect(reply.actions[0]).toEqual({ kind: 'guide', exhibitId: 'E20', label: expect.stringMatching(/^Carry on to /) });
  });

  it('greets only a returning visitor, from what was on the device when the page loaded', () => {
    const fresh = new Journal(null);
    const firstVisit = new DeterministicMuseumGuide(fresh);
    fresh.markVisited('E01');
    expect(firstVisit.welcomeBack()).toBeNull();
    const returning = new DeterministicMuseumGuide(fresh);
    expect(returning.welcomeBack()).toMatch(/^Welcome back\. Your journal on this device records 1 of 35 exhibits opened; the most recent was Starsilk Universe\./);
  });

  it('never claims to be Dexter in any of its new answers', () => {
    const journal = new Journal(null);
    journal.markVisited('E01');
    const local = guideAt(journal, 'E17', PLACEMENT_BY_EXHIBIT.get('E17')!.visitorSpot);
    for (const question of ['where did I leave off', 'what is nearby', 'compare E01 and E17', 'what changed here', 'voice spaceship']) {
      expect(local.answer(question).text).not.toMatch(/\bI am Dexter\b|\bI'm Dexter\b/);
    }
  });
});

describe('uplift2(E) #6 — two tabs no longer overwrite each other’s journal', () => {
  it('keeps visits made in both tabs (baseline lost the first tab’s visit)', () => {
    const storage = new MemoryStorage();
    const tabA = new Journal(storage);
    const tabB = new Journal(storage);
    tabA.markVisited('E01', 1_000);
    tabB.markVisited('E02', 2_000);
    const stored = JSON.parse(storage.getItem(JOURNAL_KEY)!) as { entries: Record<string, unknown> };
    expect(Object.keys(stored.entries).sort()).toEqual(['E01', 'E02']);
    expect(tabB.hasVisited('E01')).toBe(true);
  });

  it('a storage event folds the other tab’s bookmark and note in without a write', () => {
    const storage = new MemoryStorage();
    const tabA = new Journal(storage);
    const tabB = new Journal(storage);
    tabA.toggleBookmark('E05');
    tabA.setNote('E05', 'from tab A');
    expect(tabB.reconcileExternal(storage.getItem(JOURNAL_KEY))).toBe(true);
    expect(tabB.bookmarks().map((entry) => entry.exhibitId)).toEqual(['E05']);
    expect(tabB.all()[0].note).toBe('from tab A');
    expect(tabB.reconcileExternal(storage.getItem(JOURNAL_KEY))).toBe(false);
  });

  it('honours a clear made in another tab while keeping this tab’s newer visit', () => {
    const storage = new MemoryStorage();
    const tabA = new Journal(storage);
    tabA.markVisited('E01');
    const tabB = new Journal(storage);
    tabA.clear();
    tabB.markVisited('E03');
    expect(tabB.all().map((entry) => entry.exhibitId)).toEqual(['E03']);
  });

  it('a clear in this tab is not undone by merging the other tab’s old records', () => {
    const storage = new MemoryStorage();
    const tabA = new Journal(storage);
    const tabB = new Journal(storage);
    tabA.markVisited('E01');
    tabB.clear();
    expect(new Journal(storage).visitedCount).toBe(0);
  });
});

describe('uplift2(E) #7 — storage failure is told to the visitor, not swallowed', () => {
  afterEach(() => persistenceHealth.reset());

  it('names the stores not being kept, the cause, and the remedy; clears when writes succeed again', () => {
    const storage = new MemoryStorage();
    const journal = new Journal(storage);
    const secrets = new SecretsLog(storage);
    const seen: (string | null)[] = [];
    const off = persistenceHealth.onChange((message) => seen.push(message));
    storage.failWith = quotaError();
    journal.markVisited('E01');
    secrets.markFound('s1');
    savePreferences(DEFAULT_PREFERENCES, storage);
    expect(persistenceHealth.ok).toBe(false);
    expect(persistenceHealth.message()).toBe('Not being saved on this device: your journal, settings and secret finds (this browser’s storage for the museum is full). Everything keeps working for this visit. To keep it, use Export session in the Curator Desk (C) before you close the page.');
    expect(journal.hasVisited('E01')).toBe(true);
    storage.failWith = null;
    journal.markVisited('E02');
    secrets.markFound('s2');
    savePreferences(DEFAULT_PREFERENCES, storage);
    expect(persistenceHealth.message()).toBeNull();
    expect(seen.at(-1)).toBeNull();
    off();
  });

  it('distinguishes blocked storage from a full quota, and announces each change once', () => {
    const storage = new MemoryStorage();
    const journal = new Journal(storage);
    const seen: (string | null)[] = [];
    const off = persistenceHealth.onChange((message) => seen.push(message));
    storage.failWith = new Error('SecurityError');
    journal.markVisited('E01');
    journal.markVisited('E02');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('this browser is blocking storage');
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    off();
  });
});

// uplift2(E) #8 (context-loss notice) was dropped at integration: sub-agent D's
// PauseNotice (tests/uplift2-D.test.ts) implements the same visitor notice.

describe('uplift2(E) defects', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('D-E1: repeated preference changes hold one wake lock, and switching it off releases it (baseline leaked one per change)', async () => {
    const doc = new EventTarget() as EventTarget & { hidden: boolean };
    doc.hidden = false;
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', Object.assign(new EventTarget(), { devicePixelRatio: 1 }));
    const sentinels: { released: boolean; release: () => Promise<void>; addEventListener: () => void }[] = [];
    vi.stubGlobal('navigator', {
      onLine: true,
      wakeLock: {
        request: async () => {
          const sentinel = { released: false, async release() { this.released = true; }, addEventListener() {} };
          sentinels.push(sentinel);
          return sentinel;
        },
      },
    });
    const prefs = { ...DEFAULT_PREFERENCES, wakeLock: true };
    const life = new Lifecycle(
      { stop() {}, start() {}, isRunning: true } as never,
      { resetTransient() {}, uiCaptured: false } as never,
      { canvas: new EventTarget(), resize() {} } as never,
      () => prefs,
      () => {},
      () => true,
    );
    // Constructor sync plus five slider steps, some overlapping.
    await Promise.all([life.syncWakeLock(), life.syncWakeLock(), life.syncWakeLock()]);
    await life.syncWakeLock();
    await life.syncWakeLock();
    const held = () => sentinels.filter((sentinel) => !sentinel.released).length;
    expect(sentinels).toHaveLength(1);
    expect(held()).toBe(1);
    prefs.wakeLock = false;
    await life.syncWakeLock();
    expect(held()).toBe(0);
    life.dispose();
  });

  it('D-E2: unreadable journal entries are set aside and counted; repairable fields are normalised', () => {
    const storage = new MemoryStorage();
    storage.setItem(JOURNAL_KEY, JSON.stringify({
      version: 2,
      entries: {
        E01: { firstVisited: 10, lastVisited: 20, bookmarked: true, note: 'kept' },
        E02: { firstVisited: 'yesterday' },
        E03: { firstVisited: 30, bookmarked: 'yes', note: 42 },
      },
    }));
    const journal = new Journal(storage);
    expect(journal.visitedCount).toBe(2);
    expect(journal.recoveryNotice).toBe('1 journal entry was unreadable and set aside (a copy is quarantined). The rest of your journal loaded.');
    const e03 = journal.all().find((entry) => entry.exhibitId === 'E03')!;
    expect(e03).toEqual({ exhibitId: 'E03', firstVisited: 30, lastVisited: 30, bookmarked: false, note: '' });
    expect(journal.all().map((entry) => entry.exhibitId)).toEqual(['E03', 'E01']);
    expect(storage.getItem('museum-of-me:journal:quarantine')).toContain('unreadable-entries');
  });
});
