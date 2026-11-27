import type * as THREE from 'three';
import type { InputManager } from '../player/Input';
import type { PlayerController } from '../player/PlayerController';
import type { PocketWorldDefinition } from '../world/pocket/types';
import type { PocketTransitionController } from '../world/pocket/PocketWorldHost';
import { restoreFocusAfterClose } from './Panel';
import { el, trapFocus } from './dom';
import './pocket.css';

export const POCKET_PROMPT_DURATION = 0.35;
export const VHS_REWIND_DURATION = 0.55;
export const VHS_REWIND_MAX_JITTER_PX = 2;

export interface PocketTransitionOptions {
  readonly camera: THREE.PerspectiveCamera;
  readonly input: InputManager;
  readonly player: PlayerController;
  readonly reducedMotion: () => boolean;
}

/**
 * Non-flashing entry prompt (zoom-out / blur + Enter / Back / Esc) and
 * 0.55s VHS-rewind exit overlay.
 *
 * Never creates a requestAnimationFrame or setInterval: progresses strictly
 * from `update(dt)` driven by `App.variableUpdate`.
 */
export class PocketTransition implements PocketTransitionController {
  readonly root: HTMLElement;
  private readonly promptScrim: HTMLElement;
  private readonly promptCard: HTMLElement;
  private readonly promptKicker: HTMLElement;
  private readonly promptTitle: HTMLElement;
  private readonly promptDesc: HTMLElement;
  private readonly promptNote: HTMLElement;
  private readonly promptStatus: HTMLElement;
  private readonly enterButton: HTMLButtonElement;
  private readonly backButton: HTMLButtonElement;

  private readonly rewindOverlay: HTMLElement;
  private readonly rewindSweep: HTMLElement;
  private readonly rewindBand: HTMLElement;
  private readonly rewindBadge: HTMLElement;

  private releaseTrap: (() => void) | null = null;
  private releaseCapture: (() => void) | null = null;
  private releaseFreeze: (() => void) | null = null;
  private lastFocused: HTMLElement | null = null;

  private promptOpen = false;
  private promptLoading = false;
  private promptElapsed = 0;
  private baseFov = 65;
  private onEnterCallback: (() => Promise<boolean>) | null = null;
  private onCancelCallback: (() => void) | null = null;

  private rewindActive = false;
  private rewindElapsed = 0;

  constructor(private readonly opts: PocketTransitionOptions) {
    this.promptKicker = el('span', { class: 'pocket-prompt__kicker' });
    this.promptTitle = el('h2', { id: 'pocket-prompt-title' });
    this.promptDesc = el('p', { class: 'pocket-prompt__desc', id: 'pocket-prompt-desc' });
    this.promptNote = el('p', { class: 'pocket-prompt__note' });
    this.promptStatus = el('p', { class: 'pocket-prompt__status', role: 'status', 'aria-live': 'polite' });

    this.enterButton = el('button', {
      class: 'pocket-prompt__enter',
      type: 'button',
      text: 'Enter',
      onclick: () => { void this.confirmEntry(); },
    }) as HTMLButtonElement;

    this.backButton = el('button', {
      class: 'pocket-prompt__back',
      type: 'button',
      text: 'Back (Esc)',
      onclick: () => this.cancelEntry(),
    }) as HTMLButtonElement;

    this.promptCard = el('div', {
      class: 'pocket-prompt__card',
      role: 'dialog',
      'aria-modal': 'true',
      tabindex: '-1',
      'aria-labelledby': 'pocket-prompt-title',
      'aria-describedby': 'pocket-prompt-desc',
    },
    this.promptKicker,
    this.promptTitle,
    this.promptDesc,
    this.promptNote,
    this.promptStatus,
    el('div', { class: 'pocket-prompt__actions' }, this.enterButton, this.backButton));

    this.promptScrim = el('div', {
      class: 'pocket-prompt',
      hidden: true,
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.cancelEntry();
        }
      },
      onmousedown: (e: Event) => {
        if (e.target === this.promptScrim) this.cancelEntry();
      },
    }, this.promptCard);

    this.rewindSweep = el('div', { class: 'pocket-rewind__sweep' });
    this.rewindBand = el('div', { class: 'pocket-rewind__band' });
    this.rewindBadge = el('div', { class: 'pocket-rewind__badge', text: '◀◀ REWIND · MUSEUM' });
    this.rewindOverlay = el('div', {
      class: 'pocket-rewind',
      hidden: true,
      'aria-hidden': 'true',
    }, this.rewindSweep, this.rewindBand, this.rewindBadge);

    this.root = el('div', { class: 'pocket-transition' }, this.promptScrim, this.rewindOverlay);
  }

  get isPromptOpen(): boolean {
    return this.promptOpen;
  }

  get isRewindActive(): boolean {
    return this.rewindActive;
  }

  openEntryPrompt(
    def: PocketWorldDefinition,
    alreadyStamped: boolean,
    onEnter: () => Promise<boolean>,
    onCancel: () => void,
  ): void {
    if (this.promptOpen) return;
    this.lastFocused = document.activeElement as HTMLElement | null;
    this.onEnterCallback = onEnter;
    this.onCancelCallback = onCancel;
    this.promptOpen = true;
    this.promptLoading = false;
    this.promptElapsed = 0;
    this.baseFov = this.opts.camera.fov;

    this.opts.input.releasePointerLock();
    this.releaseCapture = this.opts.input.acquireUiCapture();
    this.releaseFreeze = this.opts.player.acquireFreeze();

    this.promptKicker.textContent = def.isBonus
      ? `Bonus Interlude · ${def.id}`
      : `Pocket World · ${def.id}`;
    this.promptTitle.textContent = def.title;
    this.promptDesc.textContent = `Entry: ${def.entryDescription}.`;
    this.promptNote.textContent = def.isBonus
      ? 'Optional interlude (does not add a passport stamp). You can return safely at any time.'
      : alreadyStamped
        ? 'Passport stamp already recorded for this world. Revisit freely or return at any time.'
        : 'Complete this pocket world to earn its passport stamp, or return at any time.';
    this.promptStatus.textContent = '';
    this.enterButton.disabled = false;
    this.enterButton.textContent = 'Enter';

    this.applyPromptVisuals(this.isReducedMotion() ? 1 : 0);
    this.promptScrim.hidden = false;
    this.releaseTrap = trapFocus(this.promptCard);
    this.enterButton.focus();
  }

  closePrompt(restoreFov = true): void {
    if (!this.promptOpen) return;
    this.promptOpen = false;
    this.promptLoading = false;
    this.promptScrim.hidden = true;
    if (restoreFov) this.restoreCameraFov();
    this.promptScrim.style.removeProperty('--pocket-prompt-progress');
    this.releaseTrap?.();
    this.releaseTrap = null;
    this.releaseFreeze?.();
    this.releaseFreeze = null;
    this.releaseCapture?.();
    this.releaseCapture = null;
    this.onEnterCallback = null;
    this.onCancelCallback = null;
    restoreFocusAfterClose(this.lastFocused);
    this.lastFocused = null;
  }

  playExitRewind(worldTitle?: string): void {
    if (this.isReducedMotion()) return;
    this.rewindActive = true;
    this.rewindElapsed = 0;
    this.rewindBadge.textContent = worldTitle ? `◀◀ REWIND · ${worldTitle.toUpperCase()}` : '◀◀ REWIND · MUSEUM';
    this.applyRewindVisuals(0);
    this.rewindOverlay.hidden = false;
  }

  update(dt: number): void {
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;

    if (this.promptOpen && !this.promptLoading) {
      if (this.isReducedMotion()) {
        this.restoreCameraFov();
        this.applyPromptVisuals(1);
      } else {
        this.promptElapsed = Math.min(POCKET_PROMPT_DURATION, this.promptElapsed + safeDt);
        const t = easeOutCubic(this.promptElapsed / POCKET_PROMPT_DURATION);
        this.applyPromptVisuals(t);
        const targetFov = Math.min(92, this.baseFov + 8);
        this.opts.camera.fov = this.baseFov + (targetFov - this.baseFov) * t;
        this.opts.camera.updateProjectionMatrix();
      }
    }

    if (this.rewindActive) {
      this.rewindElapsed += safeDt;
      if (this.rewindElapsed >= VHS_REWIND_DURATION) {
        this.stopRewind();
      } else {
        const progress = this.rewindElapsed / VHS_REWIND_DURATION;
        this.applyRewindVisuals(progress);
      }
    }
  }

  dispose(): void {
    this.closePrompt();
    this.stopRewind();
    this.root.remove();
  }

  private async confirmEntry(): Promise<void> {
    if (!this.promptOpen || this.promptLoading) return;
    const onEnter = this.onEnterCallback;
    if (!onEnter) return;
    this.promptLoading = true;
    this.enterButton.disabled = true;
    this.enterButton.textContent = 'Opening…';
    this.promptStatus.textContent = 'Preparing passage…';

    // Restore base FOV before host snapshots camera state for the pocket world.
    this.restoreCameraFov();

    const entered = await onEnter();
    if (!this.promptOpen || this.onEnterCallback !== onEnter) return;

    if (entered) {
      this.closePrompt(false);
    } else {
      this.promptLoading = false;
      this.enterButton.disabled = false;
      this.enterButton.textContent = 'Enter';
      this.promptStatus.textContent = 'Passage did not open. You remain safely in the museum.';
      // Disabling the button while loading dropped keyboard focus to the page,
      // which left Esc ("Back (Esc)") and Tab unable to reach the dialog.
      // Return focus to the retry action.
      if (!this.promptCard.contains(document.activeElement)) this.enterButton.focus({ preventScroll: true });
    }
  }

  private cancelEntry(): void {
    if (!this.promptOpen) return;
    const onCancel = this.onCancelCallback;
    this.closePrompt();
    onCancel?.();
  }

  private stopRewind(): void {
    if (!this.rewindActive) return;
    this.rewindActive = false;
    this.rewindElapsed = 0;
    this.rewindOverlay.hidden = true;
    this.rewindOverlay.style.removeProperty('--rewind-opacity');
    this.rewindOverlay.style.removeProperty('--rewind-band-y');
    this.rewindOverlay.style.removeProperty('--rewind-jitter-x');
    this.rewindOverlay.style.removeProperty('--rewind-jitter-y');
  }

  private applyPromptVisuals(progress: number): void {
    this.promptScrim.style.setProperty('--pocket-prompt-progress', progress.toFixed(3));
  }

  private applyRewindVisuals(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const opacity = clamped < 0.15
      ? clamped / 0.15
      : 1 - (clamped - 0.15) / 0.85;
    this.rewindOverlay.style.setProperty('--rewind-opacity', Math.max(0, Math.min(1, opacity)).toFixed(3));

    if (this.isReducedMotion()) {
      this.rewindOverlay.style.setProperty('--rewind-jitter-x', '0px');
      this.rewindOverlay.style.setProperty('--rewind-jitter-y', '0px');
      this.rewindOverlay.style.setProperty('--rewind-band-y', '42');
      return;
    }

    const jitterX = clampJitter(Math.sin(clamped * Math.PI * 14) * 1.4);
    const jitterY = clampJitter(Math.cos(clamped * Math.PI * 10) * 1.1);
    const bandY = 92 - clamped * 104;
    this.rewindOverlay.style.setProperty('--rewind-jitter-x', `${jitterX.toFixed(2)}px`);
    this.rewindOverlay.style.setProperty('--rewind-jitter-y', `${jitterY.toFixed(2)}px`);
    this.rewindOverlay.style.setProperty('--rewind-band-y', bandY.toFixed(2));
  }

  private restoreCameraFov(): void {
    if (this.opts.camera.fov !== this.baseFov) {
      this.opts.camera.fov = this.baseFov;
      this.opts.camera.updateProjectionMatrix();
    }
  }

  private isReducedMotion(): boolean {
    if (this.opts.reducedMotion()) return true;
    if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduced') return true;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
    return false;
  }
}

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function clampJitter(px: number): number {
  return Math.max(-VHS_REWIND_MAX_JITTER_PX, Math.min(VHS_REWIND_MAX_JITTER_PX, px));
}
