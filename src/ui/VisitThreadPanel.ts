import { Panel } from './Panel';
import { el } from './dom';
import { COLLECTION, EXHIBITS_BY_ID, WINGS_BY_ID } from '../content/collection.generated';
import type { WingId } from '../content/types';
import type { Journal } from '../state/Journal';
import {
  VisitThread, buildVisitThreadPlan, type VisitThreadPace, type VisitThreadPreset, visitThreadStopLabel,
} from '../state/VisitThread';
import { buildThreadWeave } from '../state/ThreadWeave';

const PRESETS: Array<{ id: VisitThreadPreset; label: string; note: string }> = [
  { id: 'highlights', label: 'Highlights', note: 'A compact cross-section of the strongest physical exhibits.' },
  { id: 'systems', label: 'Systems', note: 'Continuity, infrastructure, control planes, tools, and architecture.' },
  { id: 'making', label: 'Making', note: 'Media, prompts, performance, creative tools, and production methods.' },
  { id: 'play', label: 'Play', note: 'Games, simulations, VFX, and things that reward direct interaction.' },
  { id: 'wildcard', label: 'Useful strange things', note: 'A deterministic shuffle through less-obvious connections.' },
  { id: 'bookmarks', label: 'My bookmarks', note: 'Build a route from things you already marked for another look.' },
];

const PACES: Array<{ id: VisitThreadPace; label: string; stops: number }> = [
  { id: 'quick', label: 'Quick', stops: 3 },
  { id: 'standard', label: 'Standard', stops: 5 },
  { id: 'deep', label: 'Deep', stops: 8 },
];

/**
 * Local self-guided itinerary surface. It composes existing collection,
 * Journal, Map and Wayfinding authorities; it never teleports or gates access.
 */
export class VisitThreadPanel extends Panel {
  private preset: VisitThreadPreset = 'highlights';
  private pace: VisitThreadPace = 'standard';
  private avoidVisited = true;
  private preferBookmarks = true;
  private addQuery = '';
  private topic = '';
  private onlyWing: WingId | null = null;
  private importMessage = '';
  private previewSeed = `preview-${Date.now().toString(36)}`;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly thread: VisitThread,
    private readonly journal: Journal,
    private readonly currentWing: () => WingId | null,
    private readonly guideTo: (id: string | null) => void,
    private readonly announce: (message: string) => void,
  ) {
    super('visit-thread', 'Visit Thread', 'A route through the museum, not a score');
    this.unsubscribe = thread.subscribe(() => { if (this.isOpen) this.render(); });
  }

  protected render(): void {
    const active = this.thread.active;
    if (!active) {
      this.setHeading('Visit Thread', 'Choose a thread through the museum');
      this.setContent(...this.renderBuilder());
      return;
    }
    this.setHeading(active.title, active.status === 'complete' ? 'Thread complete' : 'Your current route');
    this.setContent(...this.renderActive());
  }

  private renderBuilder(): Node[] {
    const presetGrid = el('div', { class: 'thread-presets', role: 'radiogroup', 'aria-label': 'Visit Thread theme' });
    for (const preset of PRESETS) {
      presetGrid.append(el('button', {
        type: 'button', class: 'thread-preset', role: 'radio',
        'aria-checked': String(this.preset === preset.id),
        onclick: () => { this.preset = preset.id; this.render(); },
      }, el('strong', { text: preset.label }), el('span', { text: preset.note })));
    }

    const paceGroup = el('div', { class: 'thread-pace', role: 'radiogroup', 'aria-label': 'Visit Thread length' });
    for (const pace of PACES) {
      paceGroup.append(el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(this.pace === pace.id),
        text: `${pace.label} · ${pace.stops} stops`, onclick: () => { this.pace = pace.id; this.render(); },
      }));
    }

    const focusControls = el('div', { class: 'thread-focus' },
      el('label', {}, el('span', { text: 'Optional topic' }), el('input', {
        type: 'search', value: this.topic, placeholder: 'continuity, music, local AI, animation…',
        oninput: (event: Event) => { this.topic = (event.target as HTMLInputElement).value; },
      })),
      el('label', {}, el('span', { text: 'Optional wing' }), el('select', {
        onchange: (event: Event) => { this.onlyWing = ((event.target as HTMLSelectElement).value || null) as WingId | null; },
      },
        (() => { const option = el('option', { value: '', text: 'Use the whole museum' }); option.selected = this.onlyWing === null; return option; })(),
        ...COLLECTION.wings.map((wing) => { const option = el('option', { value: wing.id, text: wing.name }); option.selected = this.onlyWing === wing.id; return option; }),
      )),
    );

    const controls = el('div', { class: 'thread-options' },
      el('label', { class: 'field--check' },
        el('input', { type: 'checkbox', checked: this.avoidVisited, onchange: (event: Event) => { this.avoidVisited = (event.target as HTMLInputElement).checked; } }),
        el('span', { text: 'Prefer things I have not opened yet' }),
      ),
      el('label', { class: 'field--check' },
        el('input', { type: 'checkbox', checked: this.preferBookmarks, onchange: (event: Event) => { this.preferBookmarks = (event.target as HTMLInputElement).checked; } }),
        el('span', { text: 'Give my bookmarks extra weight' }),
      ),
    );

    const begin = el('button', {
      type: 'button', class: 'thread-primary', text: 'Build thread and guide me', onclick: () => this.startThread(),
    });
    const recent = this.thread.state.recent.length
      ? el('section', { class: 'thread-recent' },
          el('h3', { text: 'Recent threads' }),
          ...[...this.thread.state.recent].reverse().map((item) => el('button', {
            type: 'button', class: 'panel__card', onclick: () => {
              if (!this.thread.resumeRecent(item.id)) return;
              this.guideTo(this.thread.currentStopId);
              this.announce(`Reopened ${item.title}.`);
            },
          }, el('strong', { text: item.title }), el('span', { text: `${item.stopIds.length} stops · ${new Date(item.finishedAt).toLocaleDateString()}` }))),
        )
      : el('p', { class: 'panel__note', text: 'Finished or ended threads appear here so you can run them again. Nothing leaves this browser.' });

    const previewIds = buildVisitThreadPlan({
      preset: this.preset, pace: this.pace, avoidVisited: this.avoidVisited,
      preferBookmarks: this.preferBookmarks, currentWing: this.currentWing(),
      seed: this.previewSeed, topic: this.topic, onlyWing: this.onlyWing,
    }, this.journal);
    const preview = el('section', { class: 'thread-preview', 'aria-label': 'Visit Thread preview' },
      el('div', { class: 'thread-preview__head' },
        el('div', {}, el('h3', { text: 'Preview' }), el('p', { text: 'This is a dry run. Nothing is saved and the floor guide does not move until you start.' })),
        this.preset === 'wildcard' ? el('button', { type: 'button', text: 'Reshuffle preview', onclick: () => { this.previewSeed = `preview-${Date.now().toString(36)}`; this.render(); } }) : document.createTextNode(''),
      ),
      previewIds.length
        ? el('ol', { class: 'thread-preview__list' }, ...previewIds.map((id) => el('li', { text: visitThreadStopLabel(id) })))
        : el('p', { class: 'panel__note', text: 'Nothing matches these constraints. Broaden the topic or wing before starting.' }),
    );

    return [
      el('p', { text: 'Pick a shape for the visit. The planner uses the actual collection, your local journal, and the wing layout. It may guide you; it will never move you.' }),
      el('h3', { text: 'What kind of thread?' }), presetGrid,
      el('h3', { text: 'How long?' }), paceGroup,
      el('h3', { text: 'Narrow it, if you want' }), focusControls, controls, preview, begin, recent,
      this.thread.recoveryNotice ? el('p', { class: 'panel__note', text: this.thread.recoveryNotice }) : document.createTextNode(''),
    ];
  }

  private renderActive(): Node[] {
    const active = this.thread.active!;
    const current = this.thread.currentStopId;
    const summary = active.status === 'complete'
      ? `You reached or deliberately skipped all ${active.stopIds.length} stops. The route remains editable and replayable.`
      : `${active.stopIds.length} stops. ${this.thread.remainingCount} still in this thread. This is itinerary state, not museum completion.`;

    const weave = buildThreadWeave(active, this.journal);
    const route = el('ol', { class: 'thread-route', 'aria-label': 'Visit Thread stops' });
    active.stopIds.forEach((id, index) => {
      const exhibit = EXHIBITS_BY_ID.get(id)!;
      const wing = WINGS_BY_ID.get(exhibit.wing)!;
      const completed = active.completedIds.includes(id);
      const skipped = active.skippedIds.includes(id);
      const isCurrent = current === id && active.status !== 'complete';
      const status = completed ? 'visited' : skipped ? 'skipped' : isCurrent ? 'current' : 'upcoming';
      const statusText = completed ? 'Reached' : skipped ? 'Skipped' : isCurrent ? 'Next' : 'Later';
      const woven = weave.stops[index];
      route.append(el('li', { class: 'thread-stop', 'data-state': status, 'aria-current': isCurrent ? 'step' : undefined },
        el('div', { class: 'thread-stop__index', text: String(index + 1) }),
        el('div', { class: 'thread-stop__copy' },
          el('strong', { text: exhibit.title }),
          el('span', { text: `${wing.name} · ${exhibit.copy.subtitle}` }),
          el('small', { class: 'thread-status', text: statusText }),
          el('p', { class: 'thread-reason', text: woven?.selectionReason ?? '' }),
          woven?.bridgeFromPrevious ? el('p', { class: 'thread-bridge', text: woven.bridgeFromPrevious }) : document.createTextNode(''),
        ),
        el('div', { class: 'thread-stop__actions' },
          el('button', { type: 'button', text: 'Guide', onclick: () => { this.thread.goToStop(id); this.guideTo(id); this.render(); } }),
          el('button', { type: 'button', text: '↑', 'aria-label': `Move ${exhibit.title} earlier`, disabled: index === 0, onclick: () => this.thread.moveStop(id, -1) }),
          el('button', { type: 'button', text: '↓', 'aria-label': `Move ${exhibit.title} later`, disabled: index === active.stopIds.length - 1, onclick: () => this.thread.moveStop(id, 1) }),
          el('button', { type: 'button', text: 'Remove', 'aria-label': `Remove ${exhibit.title} from thread`, onclick: () => this.thread.removeStop(id) }),
        ),
      ));
    });

    const search = el('input', {
      type: 'search', value: this.addQuery, placeholder: 'Add an exhibit by title or wing…',
      'aria-label': 'Find an exhibit to add to this thread',
      oninput: (event: Event) => { this.addQuery = (event.target as HTMLInputElement).value; this.render(); queueMicrotask(() => this.body.querySelector<HTMLInputElement>('.thread-add input')?.focus()); },
    });
    const addMatches = this.addMatches();
    const addArea = el('div', { class: 'thread-add' }, search,
      this.addQuery.trim() ? el('div', { class: 'thread-add__results' }, ...addMatches.map((exhibit) => el('button', {
        type: 'button', text: `Add ${exhibit.title}`, onclick: () => { this.thread.addStop(exhibit.id); this.addQuery = ''; },
      }))) : document.createTextNode(''),
    );

    const nav = el('div', { class: 'thread-actions' },
      current ? el('button', { type: 'button', class: 'thread-primary', text: `Guide to next · ${EXHIBITS_BY_ID.get(current)?.title ?? current}`, onclick: () => this.guideTo(current) }) : document.createTextNode(''),
      el('button', { type: 'button', text: active.status === 'paused' ? 'Resume thread' : 'Pause thread', disabled: active.status === 'complete', onclick: () => active.status === 'paused' ? this.thread.resume() : this.thread.pause() }),
      el('button', { type: 'button', text: 'Previous stop', disabled: active.cursor === 0, onclick: () => { const id = this.thread.previous(); if (id) this.guideTo(id); } }),
      el('button', { type: 'button', text: 'Skip this stop', disabled: !current, onclick: () => { const id = this.thread.skipCurrent(); this.guideTo(id); } }),
      el('button', { type: 'button', text: 'Reverse route', onclick: () => { this.thread.reverse(); this.guideTo(this.thread.currentStopId); } }),
      el('button', { type: 'button', text: 'Restart thread', onclick: () => { this.thread.restart(); this.guideTo(this.thread.currentStopId); } }),
    );

    const dataActions = el('div', { class: 'thread-actions thread-actions--secondary' },
      el('button', { type: 'button', text: 'Copy route as text', onclick: () => void this.copyText() }),
      el('button', { type: 'button', text: 'Export thread JSON', onclick: () => this.exportJson() }),
      el('label', { class: 'thread-file' }, 'Import thread JSON', el('input', { type: 'file', accept: 'application/json,.json', onchange: (event: Event) => void this.importJson((event.target as HTMLInputElement).files?.[0]) })),
      el('button', { type: 'button', text: 'Restore previous thread state', onclick: () => { const ok = this.thread.restorePrevious(); this.importMessage = ok ? 'Previous thread state restored.' : 'No valid previous thread state is available.'; this.render(); } }),
      el('button', { type: 'button', class: 'panel__close', text: 'End thread', onclick: () => { this.thread.end(); this.guideTo(null); this.render(); } }),
    );

    return [
      el('div', { class: 'thread-summary', role: 'status', 'aria-live': 'polite' },
        el('strong', { text: active.status === 'complete' ? 'Thread closed cleanly.' : current ? `Next: ${visitThreadStopLabel(current)}` : 'No next stop.' }),
        el('span', { text: summary }),
      ),
      nav, route,
      el('h3', { text: 'Edit the thread' }),
      el('p', { class: 'panel__note', text: 'Reorder, remove, or add a stop. Editing the itinerary never alters the museum collection.' }),
      addArea, dataActions,
      this.importMessage ? el('p', { class: 'panel__note', role: 'status', text: this.importMessage }) : document.createTextNode(''),
    ];
  }

  private startThread(): void {
    const active = this.thread.start({
      preset: this.preset, pace: this.pace, avoidVisited: this.avoidVisited,
      preferBookmarks: this.preferBookmarks, currentWing: this.currentWing(),
      seed: this.previewSeed, topic: this.topic, onlyWing: this.onlyWing,
    }, this.journal);
    if (!active) {
      this.announce('No exhibits matched that Visit Thread. Try another theme.');
      return;
    }
    this.guideTo(this.thread.currentStopId);
    this.announce(`${active.title} started. The floor guide points to the first stop.`);
  }

  private addMatches() {
    const query = this.addQuery.trim().toLocaleLowerCase();
    if (!query || !this.thread.active) return [];
    const existing = new Set(this.thread.active.stopIds);
    return COLLECTION.exhibits.filter((exhibit) => {
      if (existing.has(exhibit.id)) return false;
      const wing = WINGS_BY_ID.get(exhibit.wing)?.name ?? exhibit.wing;
      return `${exhibit.id} ${exhibit.title} ${wing} ${exhibit.copy.subtitle}`.toLocaleLowerCase().includes(query);
    }).slice(0, 6);
  }

  private threadText(): string {
    const active = this.thread.active;
    if (!active) return '';
    return [
      `Museum of Me — ${active.title}`,
      ...active.stopIds.map((id, index) => `${index + 1}. ${visitThreadStopLabel(id)}`),
      '', 'This is a local self-guided itinerary; it does not represent museum completion.',
    ].join('\n');
  }

  private async copyText(): Promise<void> {
    const text = this.threadText();
    try {
      await navigator.clipboard.writeText(text);
      this.importMessage = 'Route copied as plain text.';
    } catch {
      this.importMessage = 'Clipboard is unavailable. Export JSON instead.';
    }
    this.render();
  }

  private exportJson(): void {
    const payload = this.thread.exportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `museum-visit-thread-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.importMessage = 'Visit Thread exported.';
    this.render();
  }

  private async importJson(file?: File): Promise<void> {
    if (!file) return;
    if (file.size > 128 * 1024) { this.importMessage = 'Import is too large.'; this.render(); return; }
    const preview = this.thread.previewImport(await file.text());
    if (!preview.ok || !preview.state) { this.importMessage = preview.message; this.render(); return; }
    if (!window.confirm(`${preview.message} Replace the current Visit Thread state?`)) { this.importMessage = 'Import cancelled.'; this.render(); return; }
    this.thread.applyImport(preview.state);
    this.importMessage = 'Visit Thread imported.';
    this.guideTo(this.thread.currentStopId);
  }

  override dispose(): void {
    this.unsubscribe();
    super.dispose();
  }
}
