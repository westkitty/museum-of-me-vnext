import { describe, it, expect } from 'vitest';
import {
  COLLECTION,
  PROJECTS_BY_ID,
  EXHIBITS_BY_ID,
  projectsForExhibit,
  exhibitsForWing,
} from '../src/content/collection.generated';

describe('collection integrity', () => {
  it('has unique current project identities', () => {
    expect(COLLECTION.projects.length).toBeGreaterThanOrEqual(64);
    expect(PROJECTS_BY_ID.size).toBe(COLLECTION.projects.length);
  });

  it('has exactly 35 visitor-facing physical exhibit slots', () => {
    expect(COLLECTION.exhibits).toHaveLength(35);
    expect(EXHIBITS_BY_ID.size).toBe(35);
  });

  it('maps every current project to exactly one exhibit', () => {
    const owner = new Map<string, string>();
    for (const e of COLLECTION.exhibits) {
      for (const p of e.projectIds) {
        expect(owner.has(p), `${p} mapped twice`).toBe(false);
        owner.set(p, e.id);
      }
    }
    expect(owner.size).toBe(COLLECTION.projects.length);
    for (const p of COLLECTION.projects) {
      expect(owner.has(p.id), `${p.id} unrepresented`).toBe(true);
    }
  });

  it('keeps corrected current project homes instead of restoring stale historical grouping', () => {
    expect(EXHIBITS_BY_ID.get('E14')?.projectIds).toContain('P029'); // DexEnhance: prompt/browser workflow tooling
    expect(EXHIBITS_BY_ID.get('E21')?.projectIds).not.toContain('P029');
    expect(EXHIBITS_BY_ID.get('E11')?.projectIds).toContain('P060'); // He-Maker: project recovery / archaeology
    expect(EXHIBITS_BY_ID.get('E16')?.projectIds).not.toContain('P060');
  });

  it('resolves projects for every exhibit', () => {
    for (const e of COLLECTION.exhibits) {
      const projects = projectsForExhibit(e.id);
      expect(projects).toHaveLength(e.projectIds.length);
      expect(projects.every(Boolean)).toBe(true);
    }
  });

  it('assigns every exhibit to a known wing', () => {
    const wingIds = new Set(COLLECTION.wings.map((w) => w.id));
    for (const e of COLLECTION.exhibits) {
      expect(wingIds.has(e.wing), `${e.id} wing ${e.wing}`).toBe(true);
    }
    let total = 0;
    for (const w of COLLECTION.wings) total += exhibitsForWing(w.id).length;
    expect(total).toBe(35);
  });

  it('gives every exhibit complete interpretive copy', () => {
    for (const e of COLLECTION.exhibits) {
      expect(e.copy.plaque.length, `${e.id} plaque`).toBeGreaterThan(20);
      expect(e.copy.problem.length, `${e.id} problem`).toBeGreaterThan(20);
      expect(e.copy.made.length, `${e.id} made`).toBeGreaterThan(20);
      expect(e.copy.interaction.length, `${e.id} interaction`).toBeGreaterThan(20);
      expect(e.copy.explore.length, `${e.id} explore`).toBeGreaterThan(15);
    }
  });

  it('gives every project layered interpretation', () => {
    for (const p of COLLECTION.projects) {
      expect(p.summary.length, `${p.id} summary`).toBeGreaterThan(20);
      expect(p.brief.length, `${p.id} brief`).toBeGreaterThan(80);
      expect(p.deep.length, `${p.id} deep`).toBeGreaterThanOrEqual(2);
      expect(p.capabilities.length, `${p.id} capabilities`).toBeGreaterThanOrEqual(3);
      expect(p.lesson.length, `${p.id} lesson`).toBeGreaterThan(20);
    }
  });

  it('keeps interpretation project-first rather than creator-facing', () => {
    const forbidden = /\b(Andrew|his |brilliant|genius|masterful|visionary|prolific|impressive achievement)\b/i;
    for (const p of COLLECTION.projects) {
      const text = [p.summary, p.brief, ...p.deep, p.lesson].join(' ');
      expect(forbidden.test(text), `${p.id} uses creator-facing language`).toBe(false);
    }
    for (const e of COLLECTION.exhibits) {
      const text = Object.values(e.copy).join(' ');
      expect(forbidden.test(text), `${e.id} uses creator-facing language`).toBe(false);
    }
  });
});
