import { describe, it, expect } from 'vitest';
import { COLLECTION, projectsForExhibit } from '../src/content/collection.generated';

/**
 * THE PHASE 9 CONTENT GATE.
 *
 * No visitor-facing placeholder survives, every project carries the full set of
 * interpretation the plan requires, and the whole collection stays project-first.
 */
describe('content completion (Phase 9 gate)', () => {
  it('gives every project a title, description, status, interpretation and lesson', () => {
    for (const p of COLLECTION.projects) {
      expect(p.name.length, `${p.id} name`).toBeGreaterThan(2);
      expect(p.kind.length, `${p.id} kind`).toBeGreaterThan(4);
      expect(p.status.length, `${p.id} status`).toBeGreaterThan(4);
      expect(p.period.length, `${p.id} period`).toBeGreaterThan(3);
      expect(p.family.length, `${p.id} family`).toBeGreaterThan(3);
      expect(p.summary.length, `${p.id} summary`).toBeGreaterThan(30);
      expect(p.brief.length, `${p.id} brief`).toBeGreaterThan(120);
      expect(p.deep.length, `${p.id} deep`).toBeGreaterThanOrEqual(3);
      expect(p.capabilities.length, `${p.id} capabilities`).toBeGreaterThanOrEqual(3);
      expect(p.lesson.length, `${p.id} lesson`).toBeGreaterThan(30);
    }
  });

  it('writes every deep paragraph as finished prose', () => {
    for (const p of COLLECTION.projects) {
      for (const paragraph of p.deep) {
        expect(paragraph.length, `${p.id}`).toBeGreaterThan(50);
        expect(paragraph.trim(), `${p.id} unfinished paragraph`).toMatch(/[.!?]$/);
      }
    }
  });

  it('gives every exhibit complete interpretation for all three layers', () => {
    for (const e of COLLECTION.exhibits) {
      expect(e.copy.subtitle.length, `${e.id} subtitle`).toBeGreaterThan(4);
      expect(e.copy.plaque.length, `${e.id} plaque`).toBeGreaterThan(40);
      expect(e.copy.problem.length, `${e.id} problem`).toBeGreaterThan(40);
      expect(e.copy.made.length, `${e.id} made`).toBeGreaterThan(60);
      expect(e.copy.interaction.length, `${e.id} interaction`).toBeGreaterThan(50);
      expect(e.copy.explore.length, `${e.id} explore`).toBeGreaterThan(30);
      // Subtitles are titles, not sentences, so they carry no terminal stop.
      for (const [key, value] of Object.entries(e.copy)) {
        if (key === 'subtitle') continue;
        expect(value.trim(), `${e.id} ${key} unfinished`).toMatch(/[.!?]$/);
      }
    }
  });

  it('carries no placeholder language anywhere a visitor can read', () => {
    const banned = /\b(TODO|placeholder|lorem|coming soon|TBD|FIXME|to be written|fill in)\b/i;
    for (const p of COLLECTION.projects) {
      const text = [p.summary, p.brief, p.lesson, ...p.deep, ...p.capabilities].join(' ');
      expect(banned.test(text), `${p.id}`).toBe(false);
    }
    for (const e of COLLECTION.exhibits) {
      expect(banned.test(Object.values(e.copy).join(' ')), `${e.id}`).toBe(false);
    }
  });

  it('resolves every exhibit to real project records', () => {
    for (const e of COLLECTION.exhibits) {
      const projects = projectsForExhibit(e.id);
      expect(projects.length, `${e.id}`).toBe(e.projectIds.length);
      for (const p of projects) expect(p.summary.length).toBeGreaterThan(30);
    }
  });

  it('states repository references as public paths, never local ones', () => {
    for (const p of COLLECTION.projects) {
      for (const repo of p.repos) {
        expect(repo, `${p.id} repo`).toMatch(/^[\w-]+\/[\w.-]+$/);
        expect(repo, `${p.id} repo is a local path`).not.toMatch(/^[/~]/);
      }
    }
  });

  it('never praises the creator anywhere in the collection', () => {
    // PRODUCT LAW 7, checked over the whole corpus rather than a sample.
    const forbidden =
      /\b(Andrew|brilliant|genius|masterful|visionary|prolific|remarkable achievement|tour de force|impressive body of work)\b/i;
    const corpus = [
      ...COLLECTION.projects.flatMap((p) => [p.summary, p.brief, p.lesson, ...p.deep]),
      ...COLLECTION.exhibits.flatMap((e) => Object.values(e.copy)),
      ...COLLECTION.wings.map((w) => w.blurb),
    ].join(' ');
    const match = corpus.match(forbidden);
    expect(match?.[0] ?? null).toBeNull();
  });

  it('describes every wing well enough to orient a stranger', () => {
    for (const w of COLLECTION.wings) {
      expect(w.blurb.length, `${w.id}`).toBeGreaterThan(60);
      expect(w.blurb.trim()).toMatch(/[.!?]$/);
    }
  });
});
