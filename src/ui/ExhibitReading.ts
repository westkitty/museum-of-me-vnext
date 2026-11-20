import { COLLECTION, projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import { PROJECT_STAGE_LABEL, projectStage, type ProjectStage } from '../content/projectStage';
import type { ExhibitRecord } from '../content/types';
import { el } from './dom';
import { museumLink } from '../content/collectionLinks';
import {
  projectAnchorId, projectConnections, roomOutline, roomSourcesLine, type ProjectConnection,
} from '../content/readingRelations';
import './uplift2-b.css';

export interface ExhibitReadingContext {
  /** One line saying where the room is and how far a walk it is from here. */
  readonly locate?: (exhibitId: string) => string | null;
  /** Open another room's reading (a related exhibit). */
  readonly openExhibit?: (exhibitId: string) => void;
  /** On the standalone page, in-page jumps also update the address so they can be shared. */
  readonly updateHash?: boolean;
}

/** A link or button to another room: in-world it opens the reading, on the page it is a real link. */
function roomLink(exhibitId: string, text: string, context: ExhibitReadingContext, className = 'exhibit-reading__related-link'): HTMLElement {
  return context.openExhibit
    ? el('button', { type: 'button', class: className, text, onclick: () => context.openExhibit?.(exhibitId) })
    : el('a', { class: className, href: museumLink({ exhibit: exhibitId }), text });
}

/** Jump to a section inside the reading without touching the page URL in the 3D museum. */
function anchorLink(anchor: string, text: string, updateHash: boolean): HTMLElement {
  return el('a', {
    href: `#${anchor}`, class: 'exhibit-reading__anchor', text,
    onclick: (event: Event) => {
      const link = event.currentTarget as HTMLElement;
      const target = link.ownerDocument.getElementById(anchor);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
      const heading = target.matches('h2, h3') ? target : target.querySelector<HTMLElement>('h2, h3');
      heading?.focus({ preventScroll: true });
      if (updateHash) history.replaceState(null, '', `#${anchor}`);
    },
  });
}

function connectionItem(connection: ProjectConnection, context: ExhibitReadingContext, updateHash: boolean): HTMLElement {
  const target = connection.sameRoom
    ? anchorLink(projectAnchorId(connection.other.id), `Read ${connection.other.name}`, updateHash)
    : roomLink(connection.exhibit.id, `${connection.exhibit.id} · ${connection.exhibit.title}`, context);
  return el('li', {}, el('span', { text: connection.text }), ' ', target);
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
  const outline = roomOutline(record);
  const updateHash = context.updateHash ?? false;
  const empty = () => document.createTextNode('');
  return [
    el('dl', { class: 'panel__meta' },
      el('div', {}, el('dt', { text: 'Wing' }), el('dd', { text: `${wing?.name ?? record.wing} · ${wing?.level === 1 ? 'upper floor' : 'ground floor'}` })),
      el('div', {}, el('dt', { text: 'Exhibit' }), el('dd', { text: record.id })),
      el('div', {}, el('dt', { text: 'Represents' }), el('dd', { text: `${projects.length} project${projects.length === 1 ? '' : 's'}${summary ? ` (${summary})` : ''}` })),
      el('div', {}, el('dt', { text: 'Sources' }), el('dd', { text: roomSourcesLine(record) })),
    ),
    where ? el('p', { class: 'exhibit-reading__where', text: where }) : empty(),
    el('p', { text: record.copy.plaque }),
    actions ?? empty(),
    outline.length > 0 ? el('nav', { class: 'exhibit-reading__outline', 'aria-labelledby': `outline-${record.id}` },
      el('h2', { id: `outline-${record.id}`, tabindex: '-1', text: 'Projects in this room' }),
      el('p', { class: 'panel__note', text: 'In the order the collection lists them. Choose one to jump to its reading.' }),
      el('ol', {}, ...outline.map((entry) => el('li', {}, anchorLink(entry.anchor, entry.label, updateHash)))),
    ) : empty(),
    el('section', { class: 'exhibit-reading__story', 'aria-label': 'About this room' },
      el('h2', { text: 'The problem' }),
      el('p', { text: record.copy.problem }),
      el('h2', { text: 'What was made' }),
      el('p', { text: record.copy.made }),
      el('h2', { text: 'In this room' }),
      el('p', { text: record.copy.interaction }),
      el('p', { text: record.copy.explore }),
    ),
    related.length > 0 ? el('section', { class: 'exhibit-reading__related', 'aria-label': 'Related rooms' },
      el('h2', { text: 'Related rooms' }),
      el('p', { class: 'panel__note', text: 'Other rooms that hold a project from the same family.' }),
      el('ul', {}, ...related.map(({ exhibit, family }) => el('li', {},
        roomLink(exhibit.id, `${exhibit.id} · ${exhibit.title}`, context),
        el('span', { class: 'exhibit-reading__family', text: ` — ${family}` }),
      ))),
    ) : empty(),
    ...projects.map((project) => {
      const anchor = projectAnchorId(project.id);
      const connections = projectConnections(project.id);
      return el('section', { id: anchor, class: 'exhibit-reading__project', 'aria-labelledby': `${anchor}-title` },
        el('h2', { id: `${anchor}-title`, tabindex: '-1' }, project.name, stageChip(projectStage(project.status)) ?? ''),
        el('dl', { class: 'panel__meta' },
          el('div', {}, el('dt', { text: 'Kind' }), el('dd', { text: project.kind })),
          el('div', {}, el('dt', { text: 'Status' }), el('dd', { text: project.status })),
          el('div', {}, el('dt', { text: 'Period' }), el('dd', { text: project.period })),
          el('div', {}, el('dt', { text: 'Family' }), el('dd', { text: project.family })),
        ),
        el('p', { class: 'exhibit-reading__brief', text: project.brief }),
        ...project.deep.map((paragraph) => el('p', { text: paragraph })),
        el('h3', { text: 'Capabilities' }),
        el('ul', {}, ...project.capabilities.map((capability) => el('li', { text: capability }))),
        el('p', { class: 'panel__note', text: `What this project taught: ${project.lesson}` }),
        el('h3', { text: 'Source' }),
        project.repos.length > 0
          ? el('ul', { class: 'exhibit-reading__repos', 'aria-label': `Source repositories for ${project.name}` },
            ...project.repos.map((repo) => el('li', {},
              el('a', {
                href: `https://github.com/${repo}`, rel: 'noopener noreferrer', target: '_blank',
                'aria-label': `${repo} on GitHub (opens in a new tab)`, 'data-print-url': `github.com/${repo}`,
              }, repo, el('span', { class: 'exhibit-reading__external', 'aria-hidden': 'true', text: ' ↗' })),
            )),
          )
          : el('p', { class: 'panel__note', text: 'No public repository is listed for this project.' }),
        connections.length > 0 ? el('div', { class: 'exhibit-reading__connections' },
          el('h3', { text: 'Connections in the record' }),
          el('ul', {}, ...connections.map((connection) => connectionItem(connection, context, updateHash))),
        ) : empty(),
        outline.length > 0 ? el('p', { class: 'exhibit-reading__back' }, anchorLink(`outline-${record.id}`, 'Back to the projects in this room', updateHash)) : empty(),
      );
    }),
  ];
}
