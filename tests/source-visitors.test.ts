import { describe, expect, it } from 'vitest';
import authorityJson from '../data/source-parity/visitor-authority.json';
import { SOURCE_VISITORS, SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, visitorRouteForVNext } from '../src/content/sourceParity';
import { zoneAt } from '../src/world/layout';

interface AuthorityVisitor {
  id: string; title: string; subtitle: string;
  speed: number; height: number; width: number;
  prop: string | null; staff: boolean; seated: boolean;
  group: string | null; gesture: string | null; dialogueMode: string | null;
  focusIds: string[]; reactsTo: string[];
  lines: string[]; thoughts: string[];
  palette: Record<string, number[]>;
}

const AUTHORITY = (authorityJson as { visitors: AuthorityVisitor[] }).visitors;
const AUTHORITY_BY_ID = new Map(AUTHORITY.map((v) => [v.id, v]));

describe('the seventeen authored visitors', () => {
  it('matches the CURATED authority on every governing conversation field', () => {
    // The repository's visitor records were derived from Version B. The CURATED
    // HTML outranks Version B, so every governing field is checked against it.
    // Route and position are excluded on purpose: they are old-hall
    // coordinates, and the two authorities disagree on them.
    expect(SOURCE_VISITORS).toHaveLength(17);
    expect(AUTHORITY).toHaveLength(17);
    expect(SOURCE_VISITORS.map((v) => v.id)).toEqual(AUTHORITY.map((v) => v.id));
    for (const visitor of SOURCE_VISITORS) {
      const truth = AUTHORITY_BY_ID.get(visitor.id)!;
      expect(visitor.title, visitor.id).toBe(truth.title);
      expect(visitor.subtitle, visitor.id).toBe(truth.subtitle);
      expect(visitor.speed, visitor.id).toBe(truth.speed);
      expect(visitor.height, visitor.id).toBe(truth.height);
      expect(visitor.width, visitor.id).toBe(truth.width);
      expect(visitor.prop ?? null, visitor.id).toBe(truth.prop);
      expect(!!visitor.staff, visitor.id).toBe(truth.staff);
      expect(!!visitor.seated, visitor.id).toBe(truth.seated);
      expect(visitor.group ?? null, visitor.id).toBe(truth.group);
      expect(visitor.gesture ?? null, visitor.id).toBe(truth.gesture);
      expect(visitor.dialogueMode ?? null, visitor.id).toBe(truth.dialogueMode);
      expect([...(visitor.focusIds ?? [])], visitor.id).toEqual(truth.focusIds);
      expect([...(visitor.reactsTo ?? [])], visitor.id).toEqual(truth.reactsTo);
      expect([...visitor.lines], visitor.id).toEqual(truth.lines);
      expect([...visitor.thoughts], visitor.id).toEqual(truth.thoughts);
      expect(visitor.palette, visitor.id).toEqual(truth.palette);
    }
  });

  it('gives every visitor a non-empty authored conversation', () => {
    for (const visitor of SOURCE_VISITORS) {
      expect(visitor.lines.length, visitor.id).toBeGreaterThan(0);
      for (const line of visitor.lines) {
        expect(line.trim().length, `${visitor.id} line`).toBeGreaterThan(0);
      }
    }
    // 51 authored lines across the seventeen, from the CURATED source.
    expect(SOURCE_VISITORS.reduce((n, v) => n + v.lines.length, 0)).toBe(51);
    expect(SOURCE_VISITORS.reduce((n, v) => n + v.thoughts.length, 0)).toBe(34);
  });

  it('keeps the staff, seated and paired roles the source assigned', () => {
    expect(SOURCE_VISITORS.filter((v) => v.staff).map((v) => v.id))
      .toEqual(['curator-archive', 'docent', 'guard', 'conservator']);
    expect(SOURCE_VISITORS.filter((v) => v.seated).map((v) => v.id)).toEqual(['sketcher']);
    const paired = SOURCE_VISITORS.filter((v) => v.group);
    expect(paired.length).toBeGreaterThanOrEqual(2);
    for (const v of paired) {
      expect(paired.filter((p) => p.group === v.group).length, `${v.id} has no partner`).toBeGreaterThan(1);
    }
  });

  it('points every focusIds and reactsTo reference at something that exists', () => {
    const known = new Set<string>([
      ...SOURCE_INSTALLATIONS.map((i) => i.id),
      ...SOURCE_SUPPLEMENTARY.map((s) => s.id),
    ]);
    for (const visitor of SOURCE_VISITORS) {
      for (const id of visitor.focusIds ?? []) {
        expect(known.has(id), `${visitor.id} focuses on unknown "${id}"`).toBe(true);
      }
      for (const id of visitor.reactsTo ?? []) {
        expect(known.has(id), `${visitor.id} reacts to unknown "${id}"`).toBe(true);
        // Reacting to something you never look at would be incoherent.
        expect(visitor.focusIds ?? [], `${visitor.id} reactsTo outside focusIds`).toContain(id);
      }
    }
  });

  it('gives every visitor a vNext route that stays inside the museum', () => {
    for (const visitor of SOURCE_VISITORS) {
      const route = visitorRouteForVNext(visitor.id);
      expect(route.length, visitor.id).toBeGreaterThan(0);
      for (const point of route) {
        const zone = zoneAt([point[0], point[1] + 0.1, point[2]]);
        expect(zone, `${visitor.id} route point leaves the building`).not.toBe('outside');
      }
    }
  });
});
