import { el, clear, trapFocus } from './dom';

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
    this.titleNode = el('h2', { text: title });
    this.subtitleNode = el('span', { class: 'panel__sub', text: subtitle });
    this.content = el('div', { class: 'panel__content' });
    this.body = el(
      'div',
      { class: 'panel__body', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
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
    this.lastFocused?.focus?.();
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
    this.body.setAttribute('aria-label', title);
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
