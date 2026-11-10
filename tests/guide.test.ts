import { describe, expect, it } from 'vitest';
import { COLLECTION } from '../src/content/collection.generated';
import { DeterministicMuseumGuide } from '../src/guide/DeterministicMuseumGuide';
import { Journal } from '../src/state/Journal';
import { VisitThread } from '../src/state/VisitThread';

function guide(): DeterministicMuseumGuide {
  return new DeterministicMuseumGuide(new Journal(null));
}

describe('DeterministicMuseumGuide', () => {
  it('resolves an exhibit title to its existing wayfinding destination', () => {
    const reply = guide().answer('Dex Voice Lab');

    expect(reply.text).toContain('Dex Voice Lab');
    expect(reply.actions).toEqual([{ kind: 'guide', exhibitId: 'E17', label: 'Guide me to Dex Voice Lab' }]);
  });

  it('answers a project-name query from the existing generated collection', () => {
    const reply = guide().answer('The Full Weasel');

    expect(reply.text).toContain('finished birthday rhythm game');
    expect(reply.actions[0]?.exhibitId).toBe('E27');
  });

  it('lists the collection wings and the actual controls without inventing teleportation', () => {
    const localGuide = guide();
    const wings = localGuide.answer('what wings are there?');
    const controls = localGuide.answer('controls');

    for (const wing of COLLECTION.wings) expect(wings.text).toContain(wing.name);
    expect(controls.text).toContain('W/A/S/D');
    expect(controls.text).toContain('do not teleport');
    expect(controls.text).toContain('T your Visit Thread');
    expect(controls.actions).toEqual([]);
  });


  it('explains Visit Thread as local guidance rather than gamified completion', () => {
    const reply = guide().answer('make me a tour route');
    expect(reply.text).toContain('Visit Thread');
    expect(reply.text).toContain('never teleports');
    expect(reply.text).toContain('not a score');
    expect(reply.actions).toEqual([]);
  });

  it('uses only the visit journal to identify the next unvisited exhibit', () => {
    const journal = new Journal(null);
    journal.markVisited(COLLECTION.exhibits[0].id);
    const reply = new DeterministicMuseumGuide(journal).answer('show me something I missed');

    expect(reply.actions[0]?.exhibitId).toBe(COLLECTION.exhibits[1].id);
  });


it('explains the active Visit Thread from the same deterministic itinerary state', () => {
  const journal = new Journal(null);
  const thread = new VisitThread(null);
  thread.start({ preset: 'systems', pace: 'quick', avoidVisited: true, preferBookmarks: false, currentWing: 'south', topic: 'continuity' }, journal);
  const localGuide = new DeterministicMuseumGuide(journal, thread);
  const status = localGuide.answer('what is my route?');
  const why = localGuide.answer('why this stop?');
  expect(status.text).toContain(thread.active!.title);
  expect(status.actions[0]?.exhibitId).toBe(thread.currentStopId);
  expect(why.actions[0]?.exhibitId).toBe(thread.currentStopId);
  expect(why.text).toContain('continuity');
});
});

describe('DeterministicMuseumGuide — ordinary visitor questions', () => {
  const at = (exhibitId: string | null, zoneLabel = 'Reliquary Rotunda') =>
    new DeterministicMuseumGuide(new Journal(null), undefined, () => ({ exhibitId, zoneLabel }));

  it('finds a named project inside a natural question instead of listing wings', () => {
    const reply = guide().answer('Where is the Full Weasel?');
    expect(reply.actions).toEqual([{ kind: 'guide', exhibitId: 'E27', label: 'Guide me to The Full Weasel' }]);
    expect(reply.text).toContain('South Wing');
  });

  it('resolves a partial project name asked conversationally', () => {
    const reply = guide().answer('what is DexDictate?');
    expect(reply.actions[0]?.exhibitId).toBe('E17');
    expect(reply.text).toContain('DexDictate');
  });

  it('tells the visitor what they can do at an exhibit, from its own interaction copy', () => {
    const exhibit = COLLECTION.exhibits.find((candidate) => candidate.id === 'E15')!;
    expect(guide().answer('tell me about RepoForge').text).toContain(exhibit.copy.interaction);
  });

  it('answers a subject with a shortlist drawn from the collection', () => {
    const reply = guide().answer('show me games');
    expect(reply.actions.length).toBeGreaterThan(1);
    for (const action of reply.actions) {
      expect(COLLECTION.exhibits.some((candidate) => candidate.id === action.exhibitId)).toBe(true);
    }
    expect(guide().answer('help me find games').actions.length).toBeGreaterThan(1);
  });

  it('describes the museum with the living collection totals', () => {
    const reply = guide().answer('What is this place?');
    expect(reply.text).toContain(`${COLLECTION.projects.length} current project identities`);
    expect(reply.text).toContain(`${COLLECTION.exhibits.length} exhibits`);
    expect(guide().answer('how many projects are there').text).toContain(String(COLLECTION.projects.length));
  });

  it('keeps DexGPT, Dexter and the Sanctuary distinct', () => {
    const self = guide().answer('who are you?');
    const dexter = guide().answer('Who is Dexter?');
    expect(self.text).toContain('I am DexGPT');
    expect(self.text).toContain('I am not Dexter');
    expect(dexter.text).toContain('not a project');
    expect(dexter.text).toContain('none of them are him');
    expect(dexter.text).toContain('Sanctuary');
    expect(dexter.actions).toEqual([]);
    expect(guide().answer('where is the sanctuary').text).toContain('below and behind the Rotunda');
  });

  it('describes the exhibit the visitor is standing in, and says so when they are in none', () => {
    const inside = at('E08').answer('what am I looking at?');
    expect(inside.text).toContain('You are at Heliocide Observatory');
    expect(inside.actions[0]?.exhibitId).toBe('E08');
    expect(at(null).answer('where am I?').text).toContain('You are in Reliquary Rotunda');
  });

  it('lists what a named wing holds', () => {
    const reply = guide().answer("what's in the east wing?");
    for (const exhibit of COLLECTION.exhibits.filter((candidate) => candidate.wing === 'east')) {
      expect(reply.text).toContain(exhibit.title);
    }
    expect(reply.actions.length).toBe(3);
  });

  it('resolves every project and exhibit by its own name', () => {
    for (const project of COLLECTION.projects) {
      const host = COLLECTION.exhibits.find((candidate) => candidate.projectIds.includes(project.id))!;
      expect(guide().answer(`tell me about ${project.name}`).actions[0]?.exhibitId, project.name).toBe(host.id);
    }
    for (const exhibit of COLLECTION.exhibits) {
      expect(guide().answer(`where is ${exhibit.title}?`).actions[0]?.exhibitId, exhibit.title).toBe(exhibit.id);
    }
  });

  it('answers status, building and greeting questions from recorded facts', () => {
    const finished = guide().answer('what is finished?');
    expect(finished.text).toContain('The Full Weasel (Completed; playable)');
    expect(finished.actions.map((action) => action.exhibitId)).toContain('E27');
    expect(guide().answer('how do I get upstairs?').text).toContain('grand stairs');
    expect(guide().answer('hello').text).toContain('I am DexGPT');
    expect(guide().answer('what should I see first').actions[0]?.exhibitId).toBe(COLLECTION.exhibits[0].id);
  });

  it('answers how-to-move questions with controls and unknown subjects with the honest fallback', () => {
    expect(guide().answer('how do I move?').text).toContain('W/A/S/D');
    expect(guide().answer('help').text).toContain('W/A/S/D');
    const unknown = guide().answer('quarterly tax filing');
    expect(unknown.text).toContain('I only answer from the museum’s local collection');
    expect(unknown.actions).toEqual([]);
  });
});
