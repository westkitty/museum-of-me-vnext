import { Panel } from './Panel';
import { el } from './dom';
import type { Journal } from '../state/Journal';
import { SOURCE_INSTALLATIONS, SOURCE_SUPPLEMENTARY, SOURCE_VISITORS, PRIMARY_TO_VNEXT } from '../content/sourceParity';
import { EXHIBITS_BY_ID } from '../content/collection.generated';

export interface CuratorHandlers {
  guideTo: (exhibitId: string | null) => void;
  captureView: () => void;
  copyLocation: () => Promise<void>;
  nextUnvisited: () => void;
  restorePrevious: () => boolean;
  exportSession: () => void;
  importSession: (file: File) => Promise<string>;
}

/**
 * Curator Desk — bookmarks, notes, checkpoints, history, import/export,
 * previous-save recovery, capture, and guide actions.
 */
export class CuratorPanel extends Panel {
  private importNotice = '';

  constructor(
    private readonly journal: Journal,
    private readonly handlers: CuratorHandlers,
  ) {
    super('curator', 'Curator Desk', 'Records, checkpoints, and recovery');
  }

  protected render(): void {
    const bookmarks = this.journal.bookmarks();
    const history = this.journal.visitHistory();
    const checkpoints = this.journal.listCheckpoints();
    const records = [
      ...SOURCE_INSTALLATIONS.map((i) => ({ id: i.id, title: i.title, kind: 'installation' as const, mapped: PRIMARY_TO_VNEXT[i.id] })),
      ...SOURCE_SUPPLEMENTARY.map((s) => ({ id: s.id, title: s.title, kind: 'supplementary' as const, mapped: undefined })),
      ...SOURCE_VISITORS.map((v) => ({ id: v.id, title: v.title, kind: 'visitor' as const, mapped: undefined })),
    ];

    this.setContent(
      el('p', { class: 'panel__note', role: 'status', text: this.journal.recoveryNotice ?? this.importNotice ?? 'Local curator records. Walking remains the only way to move through the museum.' }),
      el('div', { class: 'panel__grid' },
        el('button', { type: 'button', text: 'Next unvisited', onclick: () => this.handlers.nextUnvisited() }),
        el('button', { type: 'button', text: 'Clear guide', onclick: () => this.handlers.guideTo(null) }),
        el('button', { type: 'button', text: 'Copy location', onclick: () => void this.handlers.copyLocation() }),
        el('button', { type: 'button', text: 'Capture view', onclick: () => this.handlers.captureView() }),
        el('button', { type: 'button', text: 'Export session', onclick: () => this.handlers.exportSession() }),
        el('button', { type: 'button', text: 'Restore previous save', onclick: () => {
          this.importNotice = this.handlers.restorePrevious() ? 'Previous save restored.' : 'No previous save is available.';
          this.render();
        } }),
      ),
      this.fileButton(),
      el('h3', { text: 'Checkpoints' }),
      el('button', { type: 'button', text: 'Save checkpoint', onclick: () => { this.journal.addCheckpoint('Visit checkpoint'); this.render(); } }),
      ...checkpoints.map((cp) => el('p', { text: `${cp.name} · ${cp.exhibitIds.length} exhibits · ${cp.createdAt}` })),
      el('h3', { text: 'Bookmarks' }),
      bookmarks.length === 0
        ? el('p', { text: 'No bookmarks yet.' })
        : el('ul', {}, ...bookmarks.map((b) => {
          const rec = EXHIBITS_BY_ID.get(b.exhibitId);
          return el('li', {},
            el('button', { type: 'button', text: rec?.title ?? b.exhibitId, onclick: () => this.handlers.guideTo(b.exhibitId) }),
          );
        })),
      el('h3', { text: 'History' }),
      history.length === 0
        ? el('p', { text: 'No history yet.' })
        : el('ol', {}, ...history.slice().reverse().map((h) => el('li', { text: `${h.title} (${h.kind})` }))),
      el('h3', { text: 'Source collection' }),
      el('p', { class: 'panel__note', text: `${records.length} source records (14 installations, 15 supplementary, 17 visitors). The vNext 64/35 corpus remains intact.` }),
      el('ul', {}, ...SOURCE_INSTALLATIONS.map((i) => el('li', { text: `${i.title} → ${PRIMARY_TO_VNEXT[i.id] ?? 'sanctuary'}` }))),
    );
  }

  private fileButton(): HTMLElement {
    const input = el('input', {
      type: 'file',
      accept: 'application/json',
      hidden: true,
      onchange: (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        void this.handlers.importSession(file).then((message) => {
          this.importNotice = message;
          this.render();
        });
      },
    });
    return el('div', {},
      input,
      el('button', { type: 'button', text: 'Import session…', onclick: () => input.click() }),
    );
  }
}
