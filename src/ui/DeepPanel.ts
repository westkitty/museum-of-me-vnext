import { Panel } from './Panel';
import { el } from './dom';
import { EXHIBITS_BY_ID, projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import type { Journal } from '../state/Journal';

/**
 * Interpretation layer 3 (plan §9): history, decisions, status, relationships
 * and optional source references for every project an exhibit represents.
 */
export class DeepPanel extends Panel {
  private exhibitId: string | null = null;

  constructor(private readonly journal: Journal) {
    super('deep', 'Exhibit', 'Deeper reading');
  }

  openFor(exhibitId: string): void {
    this.exhibitId = exhibitId;
    this.open();
  }

  protected render(): void {
    if (!this.exhibitId) {
      this.setContent(el('p', { text: 'Walk up to an exhibit and press E to read more about it.' }));
      return;
    }
    const record = EXHIBITS_BY_ID.get(this.exhibitId);
    if (record) this.setHeading(record.title, record.copy.subtitle);
    if (!record) {
      this.setContent(el('p', { text: 'That exhibit is not part of this collection.' }));
      return;
    }
    const wing = WINGS_BY_ID.get(record.wing);
    const projects = projectsForExhibit(record.id);
    const bookmarked = this.journal.bookmarks().some((b) => b.exhibitId === record.id);

    const nodes: Node[] = [
      el(
        'dl',
        { class: 'panel__meta' },
        el('div', {}, el('dt', { text: 'Wing' }), el('dd', { text: wing?.name ?? record.wing })),
        el('div', {}, el('dt', { text: 'Exhibit' }), el('dd', { text: `${record.id} · ${record.copy.subtitle}` })),
        el('div', {}, el('dt', { text: 'Represents' }), el('dd', { text: `${projects.length} project${projects.length === 1 ? '' : 's'}` })),
      ),
      el('p', { text: record.copy.plaque }),
      el('h3', { text: 'The problem' }),
      el('p', { text: record.copy.problem }),
      el('h3', { text: 'What was made' }),
      el('p', { text: record.copy.made }),
      el('h3', { text: 'In this room' }),
      el('p', { text: record.copy.interaction }),
      el('p', { text: record.copy.explore }),
      el('button', {
        class: 'panel__close',
        type: 'button',
        text: bookmarked ? 'Remove bookmark' : 'Bookmark this exhibit',
        onclick: (e: Event) => {
          const on = this.journal.toggleBookmark(record.id);
          (e.currentTarget as HTMLButtonElement).textContent = on
            ? 'Remove bookmark'
            : 'Bookmark this exhibit';
        },
      }),
    ];

    for (const project of projects) {
      nodes.push(
        el('h3', { text: project.name }),
        el(
          'dl',
          { class: 'panel__meta' },
          el('div', {}, el('dt', { text: 'Kind' }), el('dd', { text: project.kind })),
          el('div', {}, el('dt', { text: 'Status' }), el('dd', { text: project.status })),
          el('div', {}, el('dt', { text: 'Period' }), el('dd', { text: project.period })),
          el('div', {}, el('dt', { text: 'Family' }), el('dd', { text: project.family })),
        ),
        el('p', { text: project.brief }),
        ...project.deep.map((paragraph) => el('p', { text: paragraph })),
        el('h4', { text: 'Capabilities' }),
        el('ul', {}, ...project.capabilities.map((c) => el('li', { text: c }))),
        el('p', { class: 'panel__note', text: `What this project taught: ${project.lesson}` }),
        ...(project.repos.length
          ? [
              el(
                'p',
                { class: 'panel__note' },
                'Source: ',
                ...project.repos.flatMap((r, i) => [
                  i > 0 ? el('span', { text: ' · ' }) : el('span', {}),
                  el('a', { href: `https://github.com/${r}`, rel: 'noopener noreferrer', target: '_blank', text: r }),
                ]),
              ),
            ]
          : []),
      );
    }

    this.setContent(...nodes);
  }
}
