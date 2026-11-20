import { describe, expect, it } from 'vitest';
import { COLLECTION, EXHIBITS_BY_ID, PROJECTS_BY_ID, projectsForExhibit } from '../src/content/collection.generated';
import {
  exhibitForProject, floorChangeText, lecternRepresentedLine, projectAnchorId, projectConnections, roomOutline,
  roomSources, roomSourcesLine, threadFloorSummary, threadLegs, threadPositionText, wingAnchorId, wingVisitSummary,
} from '../src/content/readingRelations';
import { matchingExhibitIds } from '../src/ui/CollectionPage';
import { nextTabIndex, STUDY_TAB_LABELS } from '../src/ui/StudyPanel';

/**
 * Uplift 2, sub-agent B: interpretation and reading surfaces.
 * Each block names the improvement (B1…B8) it guards; see docs/uplift2/B.md.
 */

const exhibit = (id: string) => EXHIBITS_BY_ID.get(id)!;
const projectNamed = (name: string) => COLLECTION.projects.find((project) => project.name === name)!;

describe('B1 room outline and readable anchors', () => {
  it('gives every project a unique, readable anchor', () => {
    const anchors = COLLECTION.projects.map((project) => projectAnchorId(project.id));
    expect(new Set(anchors).size).toBe(COLLECTION.projects.length);
    for (const anchor of anchors) expect(anchor).toMatch(/^project-[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(projectAnchorId(projectNamed('WorldsVault').id)).toBe('project-worldsvault');
    expect(wingAnchorId('north')).toBe('wing-north');
  });

  it('lists multi-project rooms in authored projectIds order and leaves single rooms alone', () => {
    for (const record of COLLECTION.exhibits) {
      const outline = roomOutline(record);
      if (record.projectIds.length < 2) {
        expect(outline).toEqual([]);
        continue;
      }
      expect(outline.map((entry) => entry.project.id)).toEqual([...record.projectIds]);
      expect(outline.map((entry) => entry.position)).toEqual(record.projectIds.map((_, index) => index + 1));
    }
    const e34 = roomOutline(exhibit('E34'));
    expect(e34).toHaveLength(7);
    expect(roomOutline(exhibit('E10')).map((entry) => entry.label).join(' | ')).toContain('Superseded');
  });
});

describe('B2 connections in the record', () => {
  it('finds the Starsilk Universe repositories shared with the rooms that hold those projects', () => {
    const universe = projectNamed('Starsilk Universe');
    const shared = projectConnections(universe.id).filter((connection) => connection.kind === 'shared-source');
    expect(shared.map((connection) => connection.exhibit.id).sort()).toEqual(['E04', 'E05', 'E08']);
    for (const connection of shared) {
      expect(universe.repos).toContain(connection.detail);
      expect(connection.other.repos).toContain(connection.detail);
    }
  });

  it('is symmetric for shared sources and backed by real records everywhere', () => {
    for (const project of COLLECTION.projects) {
      for (const connection of projectConnections(project.id)) {
        expect(PROJECTS_BY_ID.get(connection.other.id)).toBe(connection.other);
        expect(exhibitForProject(connection.other.id)).toBe(connection.exhibit);
        expect(connection.other.id).not.toBe(project.id);
        if (connection.kind === 'shared-source') {
          expect(projectConnections(connection.other.id).some((back) => back.kind === 'shared-source'
            && back.other.id === project.id && back.detail === connection.detail)).toBe(true);
        }
        if (connection.kind === 'shared-capability') {
          expect(connection.sameRoom).toBe(false);
          expect(project.capabilities.map((c) => c.toLowerCase())).toContain(connection.detail.toLowerCase());
        }
      }
    }
  });

  it('notes in-room naming once, in both directions (CanonForge and WorldsVault)', () => {
    const canon = projectConnections(projectNamed('CanonForge').id).filter((connection) => connection.other.name === 'WorldsVault');
    expect(canon).toHaveLength(1);
    expect(canon[0].sameRoom).toBe(true);
    expect(canon[0].text).toBe('This record and WorldsVault (in this room) name each other.');
  });

  it('does not link a project to itself through its own aliases', () => {
    const nexus = COLLECTION.projects.filter((project) => project.name.includes(' / '));
    for (const project of nexus) expect(projectConnections(project.id).every((c) => c.other.id !== project.id)).toBe(true);
  });
});

describe('B3 room sources', () => {
  it('counts distinct public repositories and the projects without one', () => {
    for (const record of COLLECTION.exhibits) {
      const sources = roomSources(record);
      const projects = projectsForExhibit(record.id);
      expect(new Set(sources.repos).size).toBe(sources.repos.length);
      expect(sources.repos.length).toBe(new Set(projects.flatMap((p) => p.repos)).size);
      expect(sources.withoutRepo.every((p) => p.repos.length === 0)).toBe(true);
    }
    expect(roomSourcesLine(exhibit('E01'))).toBe('3 public repositories');
    const none = COLLECTION.exhibits.find((record) => roomSources(record).repos.length === 0);
    if (none) expect(roomSourcesLine(none)).toBe('No public repository listed');
  });
});

describe('B4 lectern names lifecycle stages', () => {
  it('marks superseded, paused and experimental projects and leaves active ones plain', () => {
    const e10 = lecternRepresentedLine(projectsForExhibit('E10'));
    expect(e10).toBe('Represents 3 projects: WorldsVault Uplink (superseded), CanonForge (superseded), WorldsVault.');
    expect(lecternRepresentedLine(projectsForExhibit('E17'))).toContain('DexSpeak (paused)');
    const single = COLLECTION.exhibits.find((record) => record.projectIds.length === 1)!;
    const only = projectsForExhibit(single.id)[0];
    expect(lecternRepresentedLine([only])).toMatch(new RegExp(`^Represents ${only.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\([a-z]+\\))?\\.$`));
  });
});

describe('B5 journal: where you have been', () => {
  it('splits every wing into opened and not-opened rooms with no score', () => {
    const summary = wingVisitSummary(['E01', 'E04', 'E20', 'NOPE']);
    expect(summary).toHaveLength(6);
    let rooms = 0;
    for (const wing of summary) {
      rooms += wing.opened.length + wing.notOpened.length;
      expect(wing.opened.every((room) => room.wing === wing.wing)).toBe(true);
    }
    expect(rooms).toBe(35);
    expect(summary.flatMap((wing) => wing.opened.map((room) => room.id)).sort()).toEqual(['E01', 'E04', 'E20']);
    // Information only: no percentage, score or badge field.
    for (const wing of summary) expect(Object.keys(wing).sort()).toEqual(['level', 'name', 'notOpened', 'opened', 'wing']);
  });
});

describe('B6 Visit Thread floors and stairs', () => {
  const ground = COLLECTION.exhibits.find((record) => COLLECTION.wings.find((w) => w.id === record.wing)!.level === 0)!.id;
  const upper = COLLECTION.exhibits.find((record) => COLLECTION.wings.find((w) => w.id === record.wing)!.level === 1)!.id;

  it('marks each stair change between consecutive stops', () => {
    const legs = threadLegs([ground, upper, ground]);
    expect(legs.map((leg) => leg.floorChange)).toEqual([null, 'up', 'down']);
    expect(legs.map((leg) => leg.floor)).toEqual(['ground floor', 'upper floor', 'ground floor']);
    expect(floorChangeText('up')).toBe('Up a grand stair to the upper floor');
    expect(threadFloorSummary([ground, upper, ground])).toBe('Uses both floors: 1 stair climb · 1 descent between stops.');
    expect(threadFloorSummary([ground, ground])).toBe('Stays on the ground floor.');
  });

  it('states the position of the current stop', () => {
    expect(threadPositionText(['E01', 'E02', 'E03'], 'E02')).toBe('Stop 2 of 3');
    expect(threadPositionText(['E01'], null)).toBeNull();
    expect(threadPositionText(['E01'], 'E09')).toBeNull();
  });
});

describe('B7 collection page find', () => {
  it('matches rooms through room and project text with the shared search', () => {
    expect(matchingExhibitIds('')).toBeNull();
    expect(matchingExhibitIds('   ')).toBeNull();
    expect([...matchingExhibitIds('dictation')!]).toEqual(['E17']);
    expect(matchingExhibitIds('WorldsVault')!.has('E10')).toBe(true);
    expect(matchingExhibitIds('zzzz-no-such-thing')!.size).toBe(0);
  });
});

describe('B8 Study Lab tabs', () => {
  it('has a visible name for every tab and arrow-key movement that wraps', () => {
    expect(Object.values(STUDY_TAB_LABELS)).toEqual(['Overview', 'Collections', 'Compare', 'Reading queue', 'Tools']);
    expect(nextTabIndex('ArrowRight', 4, 5)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 5)).toBe(4);
    expect(nextTabIndex('Home', 3, 5)).toBe(0);
    expect(nextTabIndex('End', 0, 5)).toBe(4);
    expect(nextTabIndex('Enter', 0, 5)).toBeNull();
  });
});
