import { projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import type { ExhibitRecord } from '../content/types';
import { el } from './dom';

/** Shared between the in-world panels and the lightweight collection. */
export function exhibitReading(record: ExhibitRecord, actions?: HTMLElement): Node[] {
  const wing = WINGS_BY_ID.get(record.wing);
  const projects = projectsForExhibit(record.id);
  return [
    el('dl', { class: 'panel__meta' },
      el('div', {}, el('dt', { text: 'Wing' }), el('dd', { text: wing?.name ?? record.wing })),
      el('div', {}, el('dt', { text: 'Exhibit' }), el('dd', { text: record.id })),
      el('div', {}, el('dt', { text: 'Represents' }), el('dd', { text: `${projects.length} project${projects.length === 1 ? '' : 's'}` })),
    ),
    el('p', { text: record.copy.plaque }),
    actions ?? document.createTextNode(''),
    el('h2', { text: 'The problem' }),
    el('p', { text: record.copy.problem }),
    el('h2', { text: 'What was made' }),
    el('p', { text: record.copy.made }),
    el('h2', { text: 'In this room' }),
    el('p', { text: record.copy.interaction }),
    el('p', { text: record.copy.explore }),
    ...projects.map((project) => el('section', {},
      el('h2', { text: project.name }),
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
