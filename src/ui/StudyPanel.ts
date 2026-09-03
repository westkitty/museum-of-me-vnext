import { Panel } from './Panel';
import { el } from './dom';
import type { Study, StudyColor } from '../state/Study';
import { STUDY_COLORS } from '../state/Study';
import { SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, SOURCE_VISITORS } from '../content/sourceParity';
import { EXHIBITS_BY_ID, COLLECTION } from '../content/collection.generated';

export class StudyPanel extends Panel {
  private tab: 'overview' | 'collections' | 'compare' | 'queue' | 'tools' = 'overview';
  private speech: SpeechSynthesisUtterance | null = null;
  private status = '';

  constructor(
    private readonly study: Study,
    private readonly knownIds: () => string[],
    private readonly textFor: (id: string) => string,
  ) {
    super('study', 'Study Lab', 'Collections, comparison, and reading');
  }

  protected render(): void {
    const tabs = (['overview', 'collections', 'compare', 'queue', 'tools'] as const).map((id) =>
      el('button', {
        type: 'button',
        class: this.tab === id ? 'study-tab study-tab--active' : 'study-tab',
        text: id,
        'aria-selected': this.tab === id ? 'true' : 'false',
        onclick: () => { this.tab = id; this.render(); },
      }),
    );
    this.setContent(
      el('div', { class: 'study-tabs', role: 'tablist' }, ...tabs),
      el('p', { role: 'status', class: 'panel__note', text: this.status || this.study.recoveryNotice || `Revision ${this.study.state.revision} · writer ${this.study.state.writerId || 'local'}` }),
      ...this.panelBody(),
    );
  }

  private panelBody(): HTMLElement[] {
    const s = this.study.state;
    if (this.tab === 'overview') {
      return [
        this.goalBlock(),
        el('p', { text: `Queue ${s.queue.length} · collections ${s.collections.length} · saved searches ${s.savedSearches.length} · compare ${s.compare.filter(Boolean).length}/2` }),
        el('label', { text: 'Search' }),
        this.searchBox(),
      ];
    }
    if (this.tab === 'collections') {
      const name = el('input', { type: 'text', class: 'study-input', maxlength: 48, placeholder: 'New collection' }) as HTMLInputElement;
      return [
        el('div', {},
          name,
          el('button', { type: 'button', text: 'Create', onclick: () => {
            const value = name.value.trim();
            if (!value) return;
            this.study.commit((st) => {
              st.collections.push({ id: `collection-${Date.now()}`, name: value, color: 'gold', members: [] });
            });
            this.status = `Created collection ${value}.`;
            this.render();
          } }),
        ),
        ...s.collections.map((c) => el('article', { class: 'study-card' },
          el('h3', { text: c.name }),
          el('p', { text: `${c.members.length} members · ${c.color}` }),
          this.colorSelect(c.id, c.color),
          el('button', { type: 'button', text: 'Delete collection', onclick: () => {
            this.study.commit((st) => { st.collections = st.collections.filter((item) => item.id !== c.id); });
            this.status = `Deleted ${c.name}.`;
            this.render();
          } }),
        )),
      ];
    }
    if (this.tab === 'compare') {
      return [
        el('p', { text: 'Two distinct slots. Empty results can be cleared.' }),
        this.compareSlot(0),
        this.compareSlot(1),
        el('button', { type: 'button', text: 'Clear comparison', onclick: () => {
          this.study.commit((st) => { st.compare = [null, null]; });
          this.status = 'Comparison cleared.';
          this.render();
        } }),
      ];
    }
    if (this.tab === 'queue') {
      const next = s.queue.slice().sort((a, b) => a.priority - b.priority)[0];
      return [
        el('p', { text: next ? `Next: ${this.label(next.id)}` : 'Queue is empty.' }),
        ...s.queue.map((item) => el('div', {},
          el('span', { text: `${item.priority} · ${this.label(item.id)}` }),
          el('button', { type: 'button', text: 'Remove', onclick: () => {
            this.study.commit((st) => { st.queue = st.queue.filter((q) => q.id !== item.id); });
            this.render();
          } }),
        )),
        this.enqueueBox(),
      ];
    }
    return [
      el('button', { type: 'button', text: 'Read aloud current pin', onclick: () => this.speak() }),
      el('button', { type: 'button', text: 'Stop speech', onclick: () => this.stopSpeech() }),
      el('button', { type: 'button', text: 'Undo last Study change', onclick: () => {
        this.status = this.study.undoLast() ? 'Study change undone.' : 'Nothing to undo.';
        this.render();
      } }),
      el('button', { type: 'button', text: 'Export Study JSON', onclick: () => this.exportStudy() }),
      this.importControl(),
    ];
  }

  private goalBlock(): HTMLElement {
    const s = this.study.state;
    const input = el('input', { type: 'text', maxlength: 180, value: s.goal?.text ?? '', placeholder: 'Session goal' }) as HTMLInputElement;
    return el('div', {},
      input,
      el('button', { type: 'button', text: s.goal ? 'Update goal' : 'Start goal', onclick: () => {
        const text = input.value.trim();
        this.study.commit((st) => {
          st.goal = text ? { text, startedAt: st.goal?.startedAt ?? Date.now(), elapsedMs: st.goal?.elapsedMs ?? 0 } : null;
        });
        this.render();
      } }),
      s.goal ? el('p', { text: `Elapsed ${Math.round((Date.now() - s.goal.startedAt + s.goal.elapsedMs) / 60000)} min` }) : el('span', {}),
    );
  }

  private searchBox(): HTMLElement {
    const input = el('input', { type: 'search', placeholder: 'type:exhibit tag:…' }) as HTMLInputElement;
    const name = el('input', { type: 'text', placeholder: 'Save as', maxlength: 48 }) as HTMLInputElement;
    return el('div', {},
      input, name,
      el('button', { type: 'button', text: 'Save search', onclick: () => {
        const query = input.value.trim();
        if (!query) { this.status = 'Enter a Study search query.'; this.render(); return; }
        this.study.commit((st) => {
          st.savedSearches.push({ id: `search-${Date.now()}`, name: name.value.trim() || query, query });
        });
        this.status = 'Search saved.';
        this.render();
      } }),
      ...this.study.state.savedSearches.map((search) => el('button', {
        type: 'button',
        text: search.name,
        onclick: () => { input.value = search.query; this.status = `Restored search ${search.name}.`; },
      })),
    );
  }

  private compareSlot(index: 0 | 1): HTMLElement {
    const current = this.study.state.compare[index];
    const select = el('select', {
      onchange: (e: Event) => {
        const id = (e.target as HTMLSelectElement).value || null;
        this.study.commit((st) => {
          const next: [string | null, string | null] = [...st.compare];
          next[index] = id;
          st.compare = next;
        });
      },
    },
      el('option', { value: '', text: `Slot ${index + 1}` }),
      ...this.knownIds().slice(0, 80).map((id) => el('option', { value: id, text: this.label(id), selected: current === id })),
    );
    return el('div', {}, select, current ? el('p', { text: this.textFor(current).slice(0, 280) }) : el('p', { text: 'Empty slot.' }));
  }

  private enqueueBox(): HTMLElement {
    const select = el('select', {},
      el('option', { value: '', text: 'Add to queue' }),
      ...this.knownIds().map((id) => el('option', { value: id, text: this.label(id) })),
    ) as HTMLSelectElement;
    return el('div', {},
      select,
      el('button', { type: 'button', text: 'Queue', onclick: () => {
        const id = select.value;
        if (!id) return;
        this.study.commit((st) => {
          if (!st.queue.some((q) => q.id === id)) st.queue.push({ id, priority: st.queue.length });
        });
        this.render();
      } }),
    );
  }

  private colorSelect(id: string, color: StudyColor): HTMLElement {
    return el('select', {
      onchange: (e: Event) => {
        const value = (e.target as HTMLSelectElement).value as StudyColor;
        this.study.commit((st) => {
          const c = st.collections.find((item) => item.id === id);
          if (c && STUDY_COLORS.includes(value)) c.color = value;
        });
      },
    }, ...STUDY_COLORS.map((c) => el('option', { value: c, text: c, selected: c === color })));
  }

  private speak(): void {
    const id = this.study.state.pinnedId ?? this.study.state.queue[0]?.id ?? COLLECTION.exhibits[0]?.id;
    if (!id || typeof speechSynthesis === 'undefined') {
      this.status = 'Speech synthesis is unavailable.';
      this.render();
      return;
    }
    this.stopSpeech();
    this.speech = new SpeechSynthesisUtterance(this.textFor(id));
    this.speech.onend = () => { this.speech = null; };
    speechSynthesis.speak(this.speech);
    this.status = 'Reading aloud.';
    this.render();
  }

  private stopSpeech(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.speech = null;
  }

  private exportStudy(): void {
    const blob = new Blob([JSON.stringify({ payload: this.study.state, integrity: { algorithm: 'SHA-256', digest: this.study.fingerprint() } }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `reliquary-study-${Date.now()}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  private importControl(): HTMLElement {
    const input = el('input', {
      type: 'file', accept: 'application/json', hidden: true,
      onchange: (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        void file.text().then((raw) => {
          const result = this.study.importRaw(raw);
          if (result.ok && result.preview) {
            this.study.applyImport(result.preview);
          }
          this.status = result.message;
          this.render();
        });
      },
    });
    return el('div', {}, input, el('button', { type: 'button', text: 'Import Study…', onclick: () => input.click() }));
  }

  private label(id: string): string {
    return EXHIBITS_BY_ID.get(id)?.title
      ?? SOURCE_INSTALLATIONS.find((i) => i.id === id)?.title
      ?? SOURCE_SUPPLEMENTARY.find((s) => s.id === id)?.title
      ?? SOURCE_VISITORS.find((v) => v.id === id)?.title
      ?? id;
  }

  override close(): void {
    this.stopSpeech();
    super.close();
  }
}
