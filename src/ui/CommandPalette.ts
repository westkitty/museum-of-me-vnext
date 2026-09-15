import { Panel } from './Panel';
import { el } from './dom';
import { COLLECTION } from '../content/collection.generated';
import { SOURCE_INSTALLATIONS, SOURCE_VISITORS, PRIMARY_TO_VNEXT } from '../content/sourceParity';

export interface CommandAction {
  id: string;
  label: string;
  detail: string;
  keywords?: string;
  run: () => void;
}

function score(query: string, label: string, detail: string, keywords = ''): number {
  if (!query) return 1;
  const q = query.toLocaleLowerCase();
  const l = label.toLocaleLowerCase();
  const d = detail.toLocaleLowerCase();
  const k = keywords.toLocaleLowerCase();
  if (l === q) return 1;
  if (l.startsWith(q)) return 0.94;
  if (l.split(/\s+/).some((word) => word.startsWith(q))) return 0.86;
  if (l.includes(q)) return 0.75;
  if (d.includes(q)) return 0.58;
  if (k.includes(q)) return 0.46;
  return 0;
}

/**
 * Fuzzy command palette with recent ranking. Does not teleport; collection
 * items request a guide target.
 */
export class CommandPalette extends Panel {
  private query = '';
  private selected = 0;
  private recent: Array<{ id: string; label: string; at: number }> = [];
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
    queueMicrotask(() => this.body.querySelector('input')?.focus());
  }

  protected render(): void {
    const matches = this.matches();
    // ArrowUp at the top decrements unconditionally (see onKey below), so
    // this must clamp both ends -- an upper-only clamp lets `selected` go
    // negative, which then never matches any row's index and desyncs Enter
    // (matches[-1] is undefined) until enough ArrowDown presses recover it.
    this.selected = Math.max(0, Math.min(this.selected, Math.max(0, matches.length - 1)));
    const list = matches.map((entry, index) =>
      el('button', {
        type: 'button',
        class: 'command-result',
        'data-selected': index === this.selected ? 'true' : 'false',
        text: `${entry.label} — ${entry.detail}`,
        onclick: () => this.run(index, matches),
      }),
    );
    const input = el('input', {
      type: 'search',
      id: 'command-search',
      value: this.query,
      placeholder: 'Guide, journal, Starsilk, Dexter…',
      'aria-expanded': 'true',
      oninput: (e: Event) => {
        this.query = (e.target as HTMLInputElement).value;
        this.selected = 0;
        this.render();
        this.body.querySelector('input')?.focus();
      },
      onkeydown: (e: Event) => this.onKey(e as KeyboardEvent, matches),
    });
    this.setContent(
      input,
      matches.length === 0 && this.query
        ? el('p', { text: `No command or collection item matches “${this.query}”. Try “guide”, “journal”, or clear the search.` })
        : el('div', { class: 'command-results' }, ...list),
      el('h3', { text: 'Recent' }),
      this.recent.length
        ? el('div', {}, ...this.recent.map((item) => el('button', { type: 'button', text: item.label, onclick: () => this.runRecent(item.id) })))
        : el('p', { class: 'panel__note', text: 'No commands run in this tab yet.' }),
    );
  }

  private availableActions(): CommandAction[] {
    const exhibitActions: CommandAction[] = COLLECTION.exhibits.map((exhibit) => ({
      id: `exhibit:${exhibit.id}`,
      label: exhibit.title,
      detail: `exhibit · ${exhibit.wing}`,
      keywords: 'find inspect visit collection record',
      run: () => this.guideTo(exhibit.id),
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
    return [...this.getActions(), ...exhibitActions, ...sourceActions, ...visitorActions];
  }

  private matches(): CommandAction[] {
    const q = this.query.trim().toLowerCase();
    const all = this.availableActions();
    if (!q) return all.slice(0, 12);
    return all
      .map((action) => ({ action, match: score(q, action.label, action.detail, action.keywords) }))
      .filter((entry) => entry.match > 0)
      .sort((a, b) => b.match - a.match || a.action.label.localeCompare(b.action.label))
      .slice(0, 24)
      .map((entry) => entry.action);
  }

  private onKey(event: KeyboardEvent, matches: CommandAction[]): void {
    if (event.key === 'ArrowDown') { event.preventDefault(); this.selected += 1; this.render(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); this.selected -= 1; this.render(); }
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
