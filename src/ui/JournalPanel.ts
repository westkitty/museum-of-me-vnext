import { Panel } from './Panel';
import { el } from './dom';
import { EXHIBITS_BY_ID, projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import type { Journal } from '../state/Journal';

/**
 * The journal (plan §30): what you have seen, what you bookmarked, and your own
 * notes. Deliberately not a progress tracker — no percentage, no badges.
 */
export class JournalPanel extends Panel {
  constructor(
    private readonly journal: Journal,
    private readonly onOpenExhibit: (id: string) => void,
  ) {
    super('journal', 'Journal', 'Your visit');
  }

  protected render(): void {
    const entries = this.journal.all();
    const bookmarks = this.journal.bookmarks();

    if (entries.length === 0) {
      this.setContent(
        el('p', { text: 'You have not opened an exhibit yet. Walk up to one and press E.' }),
        el('p', { class: 'panel__note', text: 'The journal records where you have been so you can find your way back. It does not keep score.' }),
      );
      return;
    }

    const nodes: Node[] = [];

    if (bookmarks.length > 0) {
      nodes.push(el('h3', { text: 'Bookmarked' }));
      nodes.push(this.grid(bookmarks.map((b) => b.exhibitId)));
    }

    nodes.push(el('h3', { text: 'Visited' }));
    nodes.push(this.grid(entries.map((e) => e.exhibitId)));

    const noteFor = entries[0];
    const record = EXHIBITS_BY_ID.get(noteFor.exhibitId);
    if (record) {
      nodes.push(
        el('h3', { text: `Note — ${record.title}` }),
        el('textarea', {
          rows: 3,
          style: 'width:100%;background:#12111a;color:#ece5d8;border:1px solid rgba(255,255,255,.16);border-radius:3px;padding:.6rem;font:inherit;',
          'aria-label': `Your note about ${record.title}`,
          oninput: (e: Event) => this.journal.setNote(noteFor.exhibitId, (e.target as HTMLTextAreaElement).value),
        }),
      );
      (nodes[nodes.length - 1] as HTMLTextAreaElement).value = noteFor.note;
    }

    nodes.push(
      el('p', { class: 'panel__note', text: `${entries.length} of 35 exhibits opened. The museum keeps this only in your browser.` }),
      el('button', {
        class: 'panel__close',
        type: 'button',
        text: 'Clear journal',
        onclick: () => { this.journal.clear(); this.render(); },
      }),
    );

    this.setContent(...nodes);
  }

  private grid(ids: readonly string[]): HTMLElement {
    const grid = el('div', { class: 'panel__grid' });
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const record = EXHIBITS_BY_ID.get(id);
      if (!record) continue;
      const wing = WINGS_BY_ID.get(record.wing);
      const projects = projectsForExhibit(id);
      grid.append(
        el(
          'button',
          {
            class: 'panel__card',
            type: 'button',
            onclick: () => { this.close(); this.onOpenExhibit(id); },
          },
          el('strong', { text: record.title }),
          el('span', { text: `${wing?.name ?? record.wing} · ${projects.length} project${projects.length === 1 ? '' : 's'}` }),
        ),
      );
    }
    return grid;
  }
}
