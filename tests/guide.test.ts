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
