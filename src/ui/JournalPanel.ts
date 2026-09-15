import { Panel } from './Panel';
import { el } from './dom';
import { EXHIBITS_BY_ID, projectsForExhibit, WINGS_BY_ID } from '../content/collection.generated';
import type { Journal, JournalEntry } from '../state/Journal';

type JournalView = 'all' | 'bookmarks' | 'notes';
type JournalSort = 'recent' | 'first' | 'title';

/**
 * The journal: what you have seen, what you bookmarked, and your own notes.
 * Deliberately not a progress tracker — no percentage, no badges.
 */
export class JournalPanel extends Panel {
  private query = '';
  private view: JournalView = 'all';
  private sort: JournalSort = 'recent';
  private selectedId: string | null = null;
  private statusMessage = '';

  constructor(
    private readonly journal: Journal,
    private readonly onOpenExhibit: (id: string) => void,
    private readonly onOpenThread?: () => void,
  ) {
    super('journal', 'Journal', 'Your visit');
  }

  protected render(): void {
    const entries = this.journal.all();
    if (entries.length === 0) {
      this.setContent(
        el('div', { class: 'journal-empty' },
          el('h3', { text: 'Nothing recorded yet' }),
          el('p', { text: 'Walk up to an exhibit and interact with it. The journal will remember where you have been on this device.' }),
          this.onOpenThread ? el('button', { type: 'button', text: 'Build a Visit Thread instead', onclick: () => { this.close(); this.onOpenThread?.(); } }) : document.createTextNode(''),
        ),
        el('p', { class: 'panel__note', text: 'The journal is a return path, not a score. You can use the entire museum without filling it.' }),
      );
      return;
    }

    const visible = this.visibleEntries(entries);
    if (!this.selectedId || !visible.some((entry) => entry.exhibitId === this.selectedId)) {
      this.selectedId = visible[0]?.exhibitId ?? null;
    }

    const controls = el('div', { class: 'journal-controls' },
      el('label', { class: 'journal-search' },
        el('span', { text: 'Find in this visit' }),
        el('input', {
          type: 'search', value: this.query, placeholder: 'Exhibit, wing, project, note…',
          oninput: (event: Event) => {
            this.query = (event.target as HTMLInputElement).value;
            this.render();
            queueMicrotask(() => this.body.querySelector<HTMLInputElement>('.journal-search input')?.focus());
          },
        }),
      ),
      el('fieldset', { class: 'journal-segment' },
        el('legend', { text: 'Show' }),
        ...(['all', 'bookmarks', 'notes'] as const).map((view) => el('button', {
          type: 'button', 'aria-pressed': String(this.view === view), text: view === 'all' ? 'All' : view === 'bookmarks' ? 'Bookmarked' : 'With notes',
          onclick: () => { this.view = view; this.render(); },
        })),
      ),
      el('label', { class: 'journal-sort' },
        el('span', { text: 'Sort' }),
        el('select', { onchange: (event: Event) => { this.sort = (event.target as HTMLSelectElement).value as JournalSort; this.render(); } },
          ...([['recent', 'Most recent'], ['first', 'First visited'], ['title', 'Title']] as const).map(([value, label]) => {
            const option = el('option', { value, text: label });
            if (value === this.sort) option.selected = true;
            return option;
          }),
        ),
      ),
    );

    const results = visible.length > 0
      ? this.grid(visible)
      : el('div', { class: 'journal-empty' },
          el('h3', { text: 'No journal entries match' }),
          el('p', { text: 'Your visit data is still here. Clear the search or switch the filter.' }),
          el('button', { type: 'button', text: 'Show everything', onclick: () => { this.query = ''; this.view = 'all'; this.render(); } }),
        );

    const selected = entries.find((entry) => entry.exhibitId === this.selectedId) ?? null;
    const editor = selected ? this.noteEditor(selected) : document.createTextNode('');

    this.setContent(
      el('div', { class: 'journal-toolbar' },
        el('p', { text: `${entries.length} exhibits are in this local visit journal. Search, sort, annotate, or use one as a return point.` }),
        this.onOpenThread ? el('button', { type: 'button', text: 'Open Visit Thread', onclick: () => { this.close(); this.onOpenThread?.(); } }) : document.createTextNode(''),
      ),
      controls,
      el('p', { class: 'journal-result-count', role: 'status', 'aria-live': 'polite', text: `${visible.length} ${visible.length === 1 ? 'entry' : 'entries'} shown.` }),
      results,
      editor,
      this.statusMessage ? el('p', { class: 'panel__note', role: 'status', text: this.statusMessage }) : document.createTextNode(''),
      el('div', { class: 'journal-danger' },
        el('button', {
          class: 'panel__close', type: 'button', text: 'Clear journal…', onclick: () => {
            if (!window.confirm('Clear this browser’s Museum journal, notes, bookmarks, checkpoints, and visit history?')) return;
            this.journal.clear();
            this.selectedId = null;
            this.statusMessage = 'Journal cleared.';
            this.render();
          },
        }),
      ),
      el('p', { class: 'panel__note', text: 'Everything here stays in this browser unless you explicitly export it. There is no score, badge, or completion requirement.' }),
    );
  }

  private visibleEntries(entries: readonly JournalEntry[]): JournalEntry[] {
    let out = [...entries];
    if (this.view === 'bookmarks') out = out.filter((entry) => entry.bookmarked);
    else if (this.view === 'notes') out = out.filter((entry) => entry.note.trim().length > 0);
    const query = this.query.trim().toLocaleLowerCase();
    if (query) {
      out = out.filter((entry) => {
        const record = EXHIBITS_BY_ID.get(entry.exhibitId);
        if (!record) return false;
        const wing = WINGS_BY_ID.get(record.wing);
        const projects = projectsForExhibit(entry.exhibitId);
        const haystack = [record.id, record.title, record.copy.subtitle, wing?.name ?? '', entry.note, ...projects.map((project) => project.name)].join(' ').toLocaleLowerCase();
        return query.split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
      });
    }
    if (this.sort === 'first') out.sort((a, b) => a.firstVisited - b.firstVisited);
    else if (this.sort === 'title') out.sort((a, b) => (EXHIBITS_BY_ID.get(a.exhibitId)?.title ?? a.exhibitId).localeCompare(EXHIBITS_BY_ID.get(b.exhibitId)?.title ?? b.exhibitId));
    else out.sort((a, b) => b.lastVisited - a.lastVisited);
    return out;
  }

  private grid(entries: readonly JournalEntry[]): HTMLElement {
    const grid = el('div', { class: 'journal-grid' });
    for (const entry of entries) {
      const record = EXHIBITS_BY_ID.get(entry.exhibitId);
      if (!record) continue;
      const wing = WINGS_BY_ID.get(record.wing);
      const projects = projectsForExhibit(entry.exhibitId);
      const selected = this.selectedId === entry.exhibitId;
      grid.append(
        el('article', { class: 'journal-card', 'data-selected': String(selected) },
          el('button', {
            class: 'journal-card__main', type: 'button', 'aria-pressed': String(selected),
            onclick: () => { this.selectedId = entry.exhibitId; this.render(); },
          },
            el('strong', { text: record.title }),
            el('span', { text: `${wing?.name ?? record.wing} · ${projects.length} project${projects.length === 1 ? '' : 's'}` }),
            entry.note.trim() ? el('small', { text: entry.note.trim().slice(0, 96) }) : document.createTextNode(''),
          ),
          el('div', { class: 'journal-card__actions' },
            el('button', {
              type: 'button', 'aria-pressed': String(entry.bookmarked),
              'aria-label': entry.bookmarked ? `Remove bookmark from ${record.title}` : `Bookmark ${record.title}`,
              text: entry.bookmarked ? '★' : '☆', onclick: () => { this.journal.toggleBookmark(entry.exhibitId); this.render(); },
            }),
            el('button', { type: 'button', text: 'Open', onclick: () => { this.close(); this.onOpenExhibit(entry.exhibitId); } }),
          ),
        ),
      );
    }
    return grid;
  }

  private noteEditor(entry: JournalEntry): HTMLElement {
    const record = EXHIBITS_BY_ID.get(entry.exhibitId)!;
    const textarea = el('textarea', {
      rows: 5, class: 'journal-note', 'aria-label': `Your note about ${record.title}`,
      oninput: (event: Event) => this.journal.setNote(entry.exhibitId, (event.target as HTMLTextAreaElement).value),
    }) as HTMLTextAreaElement;
    textarea.value = entry.note;
    return el('section', { class: 'journal-editor' },
      el('div', { class: 'journal-editor__head' },
        el('div', {}, el('h3', { text: `Note — ${record.title}` }), el('p', { text: record.copy.plaque })),
        el('button', { type: 'button', text: 'Open exhibit record', onclick: () => { this.close(); this.onOpenExhibit(entry.exhibitId); } }),
      ),
      textarea,
      el('div', { class: 'journal-editor__actions' },
        el('button', { type: 'button', text: entry.bookmarked ? 'Remove bookmark' : 'Bookmark this', onclick: () => { this.journal.toggleBookmark(entry.exhibitId); this.render(); } }),
        el('button', { type: 'button', text: 'Copy note', disabled: !entry.note.trim(), onclick: () => void this.copyNote(entry) }),
        el('button', { type: 'button', text: 'Clear note', disabled: !entry.note, onclick: () => { this.journal.setNote(entry.exhibitId, ''); this.statusMessage = 'Note cleared.'; this.render(); } }),
      ),
    );
  }

  private async copyNote(entry: JournalEntry): Promise<void> {
    const record = EXHIBITS_BY_ID.get(entry.exhibitId);
    const text = `${record?.title ?? entry.exhibitId}\n\n${entry.note}`;
    try {
      await navigator.clipboard.writeText(text);
      this.statusMessage = 'Note copied.';
    } catch {
      this.statusMessage = 'Clipboard is unavailable in this browser context.';
    }
    this.render();
  }
}
