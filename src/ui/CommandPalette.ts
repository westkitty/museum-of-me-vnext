import { Panel } from './Panel';
import { el } from './dom';
import { COLLECTION_SEARCH_ENTRIES, scoreCollectionSearch } from '../content/collectionSearch';
import { SOURCE_INSTALLATIONS, SOURCE_VISITORS, PRIMARY_TO_VNEXT } from '../content/sourceParity';

export interface CommandAction {
  id: string;
  label: string;
  detail: string;
  keywords?: string;
  run: () => void;
}

/**
 * Fuzzy command palette with recent ranking. Does not teleport; collection
 * items request a guide target.
 */
export class CommandPalette extends Panel {
  private query = '';
  private selected = 0;
  private recent: Array<{ id: string; label: string; at: number }> = [];
  /** One persistent polite status line: result count and the keys to use. */
  private readonly status = el('p', { class: 'command-status', id: 'command-status', role: 'status', 'aria-live': 'polite' });
  constructor(
    private readonly guideTo: (exhibitId: string) => void,
    private readonly getActions: () => CommandAction[],
  ) {
    super('command', 'Command palette', 'Find a place or action');
  }

  override open(): void {
    this.query = '';
    this.selected = 0;
    super.open();
    queueMicrotask(() => this.focusSearch());
  }

  protected render(): void {
    const matches = this.matches();
    // ArrowUp at the top decrements unconditionally (see onKey below), so
    // this must clamp both ends -- an upper-only clamp lets `selected` go
    // negative, which then never matches any row's index and desyncs Enter
    // (matches[-1] is undefined) until enough ArrowDown presses recover it.
    this.selected = Math.max(0, Math.min(this.selected, Math.max(0, matches.length - 1)));
    // A real combobox + listbox: the search field keeps focus, the arrows move
    // the active option, and assistive technology hears which option that is
    // (aria-activedescendant / aria-selected) instead of a purely visual ring.
    const list = matches.map((entry, index) =>
      el('button', {
        type: 'button',
        class: 'command-result',
        id: `command-option-${index}`,
        role: 'option',
        tabindex: '-1',
        'aria-selected': index === this.selected ? 'true' : 'false',
        'data-selected': index === this.selected ? 'true' : 'false',
        text: `${entry.label} — ${entry.detail}`,
        onclick: () => this.run(index, matches),
      }),
    );
    const input = el('input', {
      type: 'search',
      id: 'command-search',
      role: 'combobox',
      'aria-label': 'Search commands, exhibits, and projects',
      'aria-autocomplete': 'list',
      'aria-controls': 'command-results',
      'aria-expanded': matches.length > 0 ? 'true' : 'false',
      'aria-activedescendant': matches.length > 0 ? `command-option-${this.selected}` : undefined,
      'aria-describedby': 'command-status',
      value: this.query,
      placeholder: 'Guide, journal, Starsilk, Dexter…',
      oninput: (e: Event) => {
        this.query = (e.target as HTMLInputElement).value;
        this.selected = 0;
        this.render();
        this.focusSearch();
      },
      onkeydown: (e: Event) => this.onKey(e as KeyboardEvent, matches),
    });
    this.status.textContent = commandStatusText(matches.length, this.query);
    this.setContent(
      input,
      this.status,
      matches.length === 0 && this.query
        ? el('p', { text: `No command or collection item matches “${this.query}”. Try “guide”, “journal”, or clear the search.` })
        : el('div', { class: 'command-results', id: 'command-results', role: 'listbox', 'aria-label': 'Places and actions' }, ...list),
      el('h3', { text: 'Recent' }),
      this.recent.length
        ? el('div', {}, ...this.recent.map((item) => el('button', { type: 'button', text: item.label, onclick: () => this.runRecent(item.id) })))
        : el('p', { class: 'panel__note', text: 'No commands run in this tab yet.' }),
    );
    this.body.querySelector<HTMLElement>(`#command-option-${this.selected}`)?.scrollIntoView?.({ block: 'nearest' });
  }

  private focusSearch(): void {
    const input = this.body.querySelector<HTMLInputElement>('#command-search');
    if (!input) return;
    input.focus();
    // Keep the caret where typing continues, not at the start of the query.
    const end = input.value.length;
    input.setSelectionRange?.(end, end);
  }

  private availableActions(): CommandAction[] {
    const collectionActions: CommandAction[] = COLLECTION_SEARCH_ENTRIES.map((entry) => ({
      id: `${entry.kind}:${entry.id}`,
      label: entry.name,
      detail: entry.kind === 'project' ? `project · ${entry.exhibit.title}` : `exhibit · ${entry.exhibit.wing}`,
      keywords: entry.keywords,
      run: () => this.guideTo(entry.exhibit.id),
    }));
    const sourceActions: CommandAction[] = SOURCE_INSTALLATIONS.map((item) => ({
      id: `source:${item.id}`,
      label: item.title,
      detail: `source installation · ${item.wing}`,
      keywords: item.summary,
      run: () => {
        const mapped = PRIMARY_TO_VNEXT[item.id];
        if (mapped && mapped !== 'sanctuary') this.guideTo(mapped);
      },
    }));
    const visitorActions: CommandAction[] = SOURCE_VISITORS.map((v) => ({
      id: `visitor:${v.id}`,
      label: v.title,
      detail: `visitor · ${v.subtitle}`,
      keywords: v.lines.join(' '),
      run: () => { /* dialogue is world-space */ },
    }));
    // Contextual actions must be resolved at use time so exterior/interior
    // eligibility never goes stale while the palette remains alive.
    return [...this.getActions(), ...collectionActions, ...sourceActions, ...visitorActions];
  }

  private matches(): CommandAction[] {
    const q = this.query.trim().toLowerCase();
    const all = this.availableActions();
    if (!q) return all.slice(0, 12);
    return all
      .map((action) => ({ action, match: scoreCollectionSearch(q, action.label, action.detail, action.keywords) }))
      .filter((entry) => entry.match > 0)
      .sort((a, b) => b.match - a.match || a.action.label.localeCompare(b.action.label))
      .slice(0, 24)
      .map((entry) => entry.action);
  }

  private onKey(event: KeyboardEvent, matches: CommandAction[]): void {
    const next = moveCommandSelection(this.selected, event.key, matches.length);
    if (next !== null) {
      event.preventDefault();
      this.selected = next;
      this.render();
      this.focusSearch();
    }
    else if (event.key === 'Enter' && matches[this.selected]) { event.preventDefault(); this.run(this.selected, matches); }
  }

  private run(index: number, matches: CommandAction[]): void {
    const entry = matches[index];
    if (entry) this.execute(entry);
  }

  private execute(entry: CommandAction): void {
    this.recent = [{ id: entry.id, label: entry.label, at: Date.now() }, ...this.recent.filter((item) => item.id !== entry.id)].slice(0, 7);
    // Release this modal before an action opens another one. Otherwise the
    // command panel's close handler can undo the input capture of its child.
    this.close();
    entry.run();
  }

  private runRecent(id: string): void {
    // Recent actions must not be constrained by the current search query. The
    // previous implementation searched only this.matches(), making a recent
    // command silently inert whenever the query no longer matched it.
    const entry = this.availableActions().find((item) => item.id === id);
    if (entry) this.execute(entry);
  }
}

/**
 * Arrow-key movement through the results. Wraps at both ends so the last
 * result is one key away from the first; PageUp/PageDown jump five. Returns
 * null for keys that are not list navigation (the field keeps them).
 */
export function moveCommandSelection(current: number, key: string, count: number): number | null {
  const navigation = key === 'ArrowDown' || key === 'ArrowUp' || key === 'PageDown' || key === 'PageUp';
  if (!navigation) return null;
  if (count <= 0) return 0;
  const at = Math.max(0, Math.min(current, count - 1));
  if (key === 'ArrowDown') return (at + 1) % count;
  if (key === 'ArrowUp') return (at - 1 + count) % count;
  if (key === 'PageDown') return Math.min(count - 1, at + 5);
  return Math.max(0, at - 5);
}

/** The palette's status line: how many results, and how to use them. */
export function commandStatusText(count: number, query: string): string {
  const keys = 'Up and Down arrows choose, Enter goes, Escape closes.';
  if (count === 0) return query.trim() ? 'No results.' : keys;
  if (!query.trim()) return `${count} suggestions. Type to search every exhibit and project. ${keys}`;
  return `${count} ${count === 1 ? 'result' : 'results'}. ${keys}`;
}
