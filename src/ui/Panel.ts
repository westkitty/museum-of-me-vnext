import { el, clear, trapFocus } from './dom';
import './uplift2-D.css';

/**
 * Base modal surface. Every reading panel in the museum is one of these:
 * real HTML, real focus order, escape to close, focus returned on close.
 */
export abstract class Panel {
  readonly root: HTMLElement;
  protected readonly body: HTMLElement;
  protected readonly content: HTMLElement;

  private releaseTrap: (() => void) | null = null;
  private lastFocused: HTMLElement | null = null;
  private readonly closeListeners = new Set<() => void>();

  private readonly titleNode: HTMLElement;
  private readonly subtitleNode: HTMLElement;

  constructor(
    readonly id: string,
    private title: string,
    private subtitle: string,
  ) {
    // The dialog is named by its visible heading and described by its visible
    // kicker, so assistive technology announces exactly what is on screen.
    this.titleNode = el('h2', { id: `panel-${id}-title`, text: title });
    this.subtitleNode = el('span', { class: 'panel__sub', id: `panel-${id}-desc`, text: subtitle });
    this.content = el('div', { class: 'panel__content' });
    this.body = el(
      'div',
      {
        class: 'panel__body', role: 'dialog', 'aria-modal': 'true', tabindex: '-1',
        'aria-labelledby': `panel-${id}-title`,
        'aria-describedby': subtitle ? `panel-${id}-desc` : undefined,
      },
      el(
        'header',
        { class: 'panel__head' },
        el('div', {}, this.subtitleNode, this.titleNode),
        el('button', {
          class: 'panel__close',
          type: 'button',
          text: 'Close  (Esc)',
          onclick: () => this.close(),
        }),
      ),
      this.content,
    );
    this.root = el('div', { class: 'panel', id: `panel-${id}`, hidden: true }, this.body);
    this.root.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    });
    this.root.addEventListener('mousedown', (e) => {
      if (e.target === this.root) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  onClose(fn: () => void): () => void {
    this.closeListeners.add(fn);
    return () => this.closeListeners.delete(fn);
  }

  open(): void {
    if (this.isOpen) return;
    this.lastFocused = document.activeElement as HTMLElement | null;
    this.render();
    this.root.hidden = false;
    this.releaseTrap = trapFocus(this.body);
    this.body.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.releaseTrap?.();
    this.releaseTrap = null;
    restoreFocusAfterClose(this.lastFocused);
    this.lastFocused = null;
    for (const fn of this.closeListeners) fn();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Retitle the panel. Used by surfaces that show a different subject each time. */
  protected setHeading(title: string, subtitle: string): void {
    this.title = title;
    this.subtitle = subtitle;
    this.titleNode.textContent = title;
    this.subtitleNode.textContent = subtitle;
    if (subtitle) this.body.setAttribute('aria-describedby', this.subtitleNode.id);
    else this.body.removeAttribute('aria-describedby');
  }

  /** Rebuild the panel contents. Called on every open. */
  protected abstract render(): void;

  protected setContent(...nodes: (Node | string)[]): void {
    // Removing the currently-focused element from the document moves focus
    // to document.body (standard browser behavior) -- outside this.body,
    // where the focus trap's keydown listener lives. Once that happens, Tab
    // never reaches the listener again (events bubble from target toward
    // ancestors, not into descendants), so the trap silently stops working
    // for the rest of the panel's open lifetime. Any handler that rebuilds
    // content in response to activating a control inside it hits this the
    // same way, so the restore belongs here once, not in every caller.
    const hadFocusInside = this.body.contains(document.activeElement);
    clear(this.content);
    this.content.append(...nodes);
    if (hadFocusInside && !this.body.contains(document.activeElement)) {
      this.body.focus();
    }
  }

  dispose(): void {
    this.close();
    this.closeListeners.clear();
    this.root.remove();
  }

  protected get titleText(): string {
    return this.title;
  }

  protected get subtitleText(): string {
    return this.subtitle;
  }
}

/**
 * Return focus after a panel closes. The opener is preferred, but only while
 * it can still take focus: a panel opened from inside another panel that then
 * closed (Journal -> Visit Thread) or re-rendered would otherwise park focus
 * on an element inside a hidden dialog, where screen readers lose their place
 * and the underlying panel's focus trap no longer sees Tab. Then the topmost
 * still-open panel takes focus; with none open, focus goes back to the page so
 * the museum's own keys work.
 */
export function restoreFocusAfterClose(opener: HTMLElement | null): void {
  if (opener && isFocusReturnable(opener)) {
    opener.focus({ preventScroll: true });
    if (document.activeElement === opener) return;
  }
  const open = [...document.querySelectorAll<HTMLElement>('.panel:not([hidden]) > .panel__body')];
  const top = open[open.length - 1];
  if (top) {
    top.focus({ preventScroll: true });
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) active.blur();
}

function isFocusReturnable(node: HTMLElement): boolean {
  if (!node.isConnected || node === document.body || node === document.documentElement) return false;
  if (node.closest('[hidden], [inert]')) return false;
  return node.getClientRects().length > 0;
}
