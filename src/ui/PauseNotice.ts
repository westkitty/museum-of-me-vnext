import { el } from './dom';

/** What the lifecycle knows about why the museum is not rendering. */
export interface PauseState {
  /** The browser took the WebGL context away (driver reset, GPU pressure). */
  readonly contextLost: boolean;
  /** Seconds since the context was lost, when known. */
  readonly lostForSeconds?: number;
}

export interface PauseNoticeContent {
  readonly title: string;
  readonly message: string;
  /** Offer a reload button. */
  readonly reload: boolean;
}

/** After this long without the context coming back, recommend reloading. */
export const CONTEXT_RESTORE_PATIENCE_S = 8;

/**
 * Visitor-facing words for a paused 3D view. Null when nothing is wrong.
 * Hiding the tab is not shown here: nobody can see a hidden tab, and the
 * museum resumes by itself when it is shown again.
 */
export function pauseNoticeFor(state: PauseState): PauseNoticeContent | null {
  if (!state.contextLost) return null;
  const long = (state.lostForSeconds ?? 0) >= CONTEXT_RESTORE_PATIENCE_S;
  return {
    title: 'The 3D view has paused',
    message: long
      ? 'The graphics have not come back by themselves. Reloading usually fixes this; your visit journal and settings are kept in this browser.'
      : 'Your browser’s graphics stopped responding for a moment. The museum is waiting for them to return and will carry on by itself. Your place, journal and settings are safe.',
    reload: true,
  };
}

/**
 * A persistent, visible notice for an interrupted 3D view. The frame loop is
 * stopped while this is up, so it is driven directly by lifecycle events, not
 * by the per-frame HUD update. role="alert" makes assistive technology say it
 * once, immediately; it never takes keyboard focus away from the visitor.
 */
export class PauseNotice {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly message: HTMLElement;
  private readonly reload: HTMLButtonElement;

  constructor(parent: HTMLElement, onReload: () => void = () => window.location.reload()) {
    this.title = el('strong', { class: 'pause-notice__title' });
    this.message = el('p', { class: 'pause-notice__message' });
    this.reload = el('button', { type: 'button', class: 'pause-notice__reload', text: 'Reload the museum', onclick: onReload });
    this.root = el('section', {
      class: 'pause-notice', role: 'alert', 'aria-live': 'assertive', hidden: true,
      'aria-label': 'Museum paused',
    }, this.title, this.message, this.reload);
    parent.append(this.root);
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(content: PauseNoticeContent | null): void {
    if (!content) {
      this.root.hidden = true;
      return;
    }
    this.title.textContent = content.title;
    this.message.textContent = content.message;
    this.reload.hidden = !content.reload;
    this.root.hidden = false;
  }

  dispose(): void {
    this.root.remove();
  }
}
