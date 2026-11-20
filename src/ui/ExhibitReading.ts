import { COLLECTION, projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import { PROJECT_STAGE_LABEL, projectStage, type ProjectStage } from '../content/projectStage';
import type { ExhibitRecord } from '../content/types';
import { el } from './dom';

export interface ExhibitReadingContext {
  /** One line saying where the room is and how far a walk it is from here. */
  readonly locate?: (exhibitId: string) => string | null;
  /** Open another room's reading (a related exhibit). */
  readonly openExhibit?: (exhibitId: string) => void;
}

/** Other rooms holding a project from exactly the same family, in building order. */
export function relatedExhibits(record: ExhibitRecord): { exhibit: ExhibitRecord; family: string }[] {
  const families = new Set(projectsForExhibit(record.id).map((project) => project.family));
  const out: { exhibit: ExhibitRecord; family: string }[] = [];
  for (const other of COLLECTION.exhibits) {
    if (other.id === record.id) continue;
    const shared = projectsForExhibit(other.id).find((project) => families.has(project.family));
    if (shared) out.push({ exhibit: other, family: shared.family });
  }
  return out;
}

function stageChip(stage: ProjectStage | null): HTMLElement | null {
  if (!stage) return null;
  return el('span', { class: `stage-chip stage-chip--${stage}`, text: PROJECT_STAGE_LABEL[stage] });
}

/** "2 active · 1 superseded" — the rooms that carry a lineage say so up front. */
export function stageSummary(record: ExhibitRecord): string | null {
  const projects = projectsForExhibit(record.id);
  if (projects.length < 2) return null;
  const counts = new Map<ProjectStage, number>();
  for (const project of projects) {
    const stage = projectStage(project.status);
    if (stage) counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  const order: ProjectStage[] = ['active', 'experimental', 'paused', 'completed', 'superseded', 'abandoned'];
  const parts = order.filter((stage) => counts.has(stage)).map((stage) => `${counts.get(stage)} ${PROJECT_STAGE_LABEL[stage].toLocaleLowerCase()}`);
  return parts.length ? parts.join(' · ') : null;
}

/** Shared between the in-world panels and the lightweight collection. */
export function exhibitReading(record: ExhibitRecord, actions?: HTMLElement, context: ExhibitReadingContext = {}): Node[] {
  const wing = WINGS_BY_ID.get(record.wing);
  const projects = projectsForExhibit(record.id);
  const summary = stageSummary(record);
  const where = context.locate?.(record.id) ?? null;
  const related = relatedExhibits(record);
  return [
    el('dl', { class: 'panel__meta' },
      el('div', {}, el('dt', { text: 'Wing' }), el('dd', { text: `${wing?.name ?? record.wing} · ${wing?.level === 1 ? 'upper floor' : 'ground floor'}` })),
      el('div', {}, el('dt', { text: 'Exhibit' }), el('dd', { text: record.id })),
      el('div', {}, el('dt', { text: 'Represents' }), el('dd', { text: `${projects.length} project${projects.length === 1 ? '' : 's'}${summary ? ` (${summary})` : ''}` })),
    ),
    where ? el('p', { class: 'exhibit-reading__where', text: where }) : document.createTextNode(''),
    el('p', { text: record.copy.plaque }),
    actions ?? document.createTextNode(''),
    el('h2', { text: 'The problem' }),
    el('p', { text: record.copy.problem }),
    el('h2', { text: 'What was made' }),
    el('p', { text: record.copy.made }),
    el('h2', { text: 'In this room' }),
    el('p', { text: record.copy.interaction }),
    el('p', { text: record.copy.explore }),
    related.length > 0 ? el('section', { class: 'exhibit-reading__related', 'aria-label': 'Related rooms' },
      el('h2', { text: 'Related rooms' }),
      el('p', { class: 'panel__note', text: 'Other rooms that hold a project from the same family.' }),
      el('ul', {}, ...related.map(({ exhibit, family }) => el('li', {},
        context.openExhibit
          ? el('button', { type: 'button', class: 'exhibit-reading__related-link', text: `${exhibit.id} · ${exhibit.title}`,
            onclick: () => context.openExhibit?.(exhibit.id) })
          : el('span', { text: `${exhibit.id} · ${exhibit.title}` }),
        el('span', { class: 'exhibit-reading__family', text: ` — ${family}` }),
      ))),
    ) : document.createTextNode(''),
    ...projects.map((project) => el('section', {},
      el('h2', {}, project.name, stageChip(projectStage(project.status)) ?? ''),
      el('dl', { class: 'panel__meta' },
        el('div', {}, el('dt', { text: 'Kind' }), el('dd', { text: project.kind })),
        el('div', {}, el('dt', { text: 'Status' }), el('dd', { text: project.status })),
        el('div', {}, el('dt', { text: 'Period' }), el('dd', { text: project.period })),
        el('div', {}, el('dt', { text: 'Family' }), el('dd', { text: project.family })),
      ),
      el('p', { text: project.brief }),
      ...project.deep.map((paragraph) => el('p', { text: paragraph })),
      el('h3', { text: 'Capabilities' }),
      el('ul', {}, ...project.capabilities.map((capability) => el('li', { text: capability }))),
      el('p', { class: 'panel__note', text: `What this project taught: ${project.lesson}` }),
      project.repos.length > 0 && el('ul', { 'aria-label': 'Source repositories' },
        ...project.repos.map((repo) => el('li', {},
          el('a', { href: `https://github.com/${repo}`, rel: 'noopener noreferrer', target: '_blank', text: repo }),
        )),
      ),
    )),
  ];
}
