import { el, isActivationKey } from './dom';
import type { InteractionFocus } from '../interaction/InteractionManager';
import { ZONE_BY_ID, type ZoneId } from '../world/layout';
import { WINGS_BY_ID } from '../content/collection.generated';
import './pocket.css';

/**
 * The persistent interface. Plan §30 asks for minimal: an interaction cue, a
 * location indicator, and a subtitle line. Nothing else is on screen while the
 * visitor is simply walking.
 */
export class HUD {
  readonly root: HTMLElement;

  private readonly reticle: HTMLElement;
  private readonly cue: HTMLElement;
  private readonly cueLabel: HTMLElement;
  /** The F key cap; touch visitors tap the centre dot instead, so it is hidden in touch mode. */
  private readonly cueKey: HTMLElement;
  private readonly location: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly thresholdPanel: HTMLElement;
  private readonly thresholdStatus: HTMLElement;
  private readonly thresholdEnter: HTMLButtonElement;
  private readonly thresholdRetry: HTMLButtonElement;
  private readonly thresholdReturn: HTMLButtonElement;
  private readonly ticketCard: HTMLElement;
  private readonly ticketStatus: HTMLElement;
  private thresholdFocusReturn: HTMLElement | null = null;
  private readonly hints: HTMLElement;
  private readonly lockPrompt: HTMLElement;
  private readonly resumeLook: HTMLButtonElement;
  private readonly visitorMenu: HTMLButtonElement;
  private readonly arrivalAction: HTMLElement;
  private arrivalReady = true;
  private arrivalEntered = false;
  private cinematicArrivalActive = false;
  private readonly threadStatus: HTMLButtonElement;
  private readonly topActions: HTMLElement;
  private readonly passportButton: HTMLButtonElement;
  private readonly pocketBackButton: HTMLButtonElement;
  private buildModeButton: HTMLButtonElement | null = null;
  private pointerLocked = false;
  private buildModeActive = false;
  private passportVisible = false;
  private pocketWorldActive = false;
  private interactionFocus: InteractionFocus | null = null;
  private workshopCueLabel: string | null = null;

  private subtitleTimer = 0;
  private readonly secretCard: HTMLElement;
  private secretTimer = 0;
  private lastZone: ZoneId | null = null;
  private lastOutsideLabel: string | undefined;
  private lastOutsideKicker: string | undefined;

  constructor(
    onRequestLock: (touch: boolean) => void | boolean,
    onOpenThread?: () => void,
    onEnterMuseum?: () => void,
    onRetryMuseum?: () => void,
    onContinueOutside?: () => void,
    onVisitorMenu?: () => void,
    onOpenPassport?: () => void,
    onExitPocket?: () => void,
  ) {
    this.reticle = el('div', { class: 'hud__reticle' });
    this.cueLabel = el('span', {});
    this.cueKey = el('kbd', { text: 'F' });
    this.cue = el('div', { class: 'hud__cue' }, this.cueKey, this.cueLabel);
    this.location = el('div', { class: 'hud__location' });
    this.subtitle = el('div', { class: 'hud__subtitle', role: 'status', 'aria-live': 'polite' });
    this.secretCard = el('div', { class: 'hud__secret', role: 'status', 'aria-live': 'polite' });
    this.thresholdStatus = el('p', { text: 'The museum entrance is ready.' });
    this.thresholdEnter = el('button', {
      // Admission is a ticket from the kiosk; this is the same action for
      // visitors who prefer a button (it does not bypass the ticket).
      type: 'button', text: 'Take a ticket', onclick: () => onEnterMuseum?.(),
    }) as HTMLButtonElement;
    this.thresholdRetry = el('button', {
      type: 'button', text: 'Reload and retry', hidden: true, onclick: () => onRetryMuseum?.(),
    }) as HTMLButtonElement;
    this.thresholdReturn = el('button', {
      type: 'button', text: 'Continue outside', hidden: true, onclick: () => onContinueOutside?.(),
    }) as HTMLButtonElement;
    this.thresholdPanel = el('section', {
      class: 'hud__threshold', hidden: true,
      'aria-label': 'Museum entrance',
    }, this.thresholdStatus, this.thresholdEnter, this.thresholdRetry, this.thresholdReturn);
    this.ticketStatus = el('span', { class: 'hud__ticket-status' });
    this.ticketCard = el('div', {
      class: 'hud__ticket', hidden: true, role: 'status', 'aria-live': 'polite',
    });
    this.threadStatus = el('button', {
      class: 'hud__thread', type: 'button', hidden: true,
      'aria-label': 'Open current Visit Thread', onclick: () => onOpenThread?.(),
    }) as HTMLButtonElement;
    this.passportButton = el('button', {
      class: 'hud__passport', type: 'button', hidden: true,
      'aria-haspopup': 'dialog', 'aria-controls': 'panel-passport',
      'aria-label': 'Open Passport (0 of 10 stamps)',
      text: 'Passport (0/10)',
      onclick: () => onOpenPassport?.(),
    }) as HTMLButtonElement;
    this.pocketBackButton = el('button', {
      class: 'hud__pocket-back', type: 'button', hidden: true,
      'aria-label': 'Back to Museum',
      text: 'Back to Museum',
      onclick: () => onExitPocket?.(),
    }) as HTMLButtonElement;
    this.topActions = el('div', { class: 'hud__top-actions' }, this.passportButton, this.pocketBackButton);
    this.hints = el('div', { class: 'hud__hints' });
    this.renderHints();

    this.arrivalAction = el('span', {
      class: 'hud__arrival-action',
      text: 'CLICK OR PRESS ENTER TO BEGIN EXPLORING',
      'aria-live': 'polite',
    });
    const requestLock = (event?: Event): void => {
      event?.preventDefault();
      if (!this.arrivalReady) return;
      const touch = (typeof PointerEvent !== 'undefined'
        && event instanceof PointerEvent && event.pointerType === 'touch')
        || Boolean(window.matchMedia?.('(pointer: coarse)').matches);
      if (onRequestLock(touch) === false) return;
      this.arrivalEntered = true;
      this.lockPrompt.hidden = true;
      // The role=button intro is hidden after entry; release keyboard focus so
      // global movement bindings are not blocked by a hidden semantic control.
      if (document.activeElement === this.lockPrompt) this.lockPrompt.blur();
      this.setPointerLocked(this.pointerLocked);
    };
    this.resumeLook = el('button', {
      class: 'hud__resume-look',
      type: 'button',
      hidden: true,
      'aria-label': 'Resume mouse look',
      text: 'CLICK TO RESUME MOUSE LOOK',
      onclick: (event: Event) => {
        event.preventDefault();
        onRequestLock(false);
      },
    }) as HTMLButtonElement;
    this.visitorMenu = el('button', {
      class: 'hud__visitor-menu', type: 'button', hidden: true,
      'aria-haspopup': 'dialog', 'aria-controls': 'panel-visitor-menu',
      text: 'Museum', onclick: onVisitorMenu,
    });
    this.lockPrompt = el(
      'div',
      {
        class: 'hud__lock',
        role: 'button',
        tabindex: '0',
        'aria-label': 'Enter the museum and capture mouse look',
        onclick: requestLock,
        onkeydown: (event: Event) => {
          const keyEvent = event as KeyboardEvent;
          if (isActivationKey(keyEvent)) requestLock(keyEvent);
        },
      },
      el('span', { class: 'hud__arrival-eyebrow', text: 'THE RELIQUARY OF ITERATIVE BECOMING' }),
      el('span', { class: 'hud__arrival-pretitle', text: 'Welcome to the' }),
      el('h2', { text: 'Museum of Me' }),
      el('span', { class: 'hud__arrival-rule', 'aria-hidden': 'true' }),
      el('p', { class: 'hud__arrival-invitation', text: 'An entire world of work. One place to discover it.' }),
      this.arrivalAction,
      el('p', { class: 'hud__arrival-controls', text: 'WASD / arrow keys move · Mouse looks · Q/E rotate · Shift sprints · Space jumps · F interacts.' }),
      el('p', { class: 'hud__arrival-accessibility', text: 'No mouse required: Page Up / Page Down look vertically. Press H for accessible exhibit texts.' }),
    );

    this.root = el(
      'div',
      { class: 'hud', 'aria-hidden': 'false' },
      this.reticle,
      this.cue,
      this.location,
      this.threadStatus,
      this.topActions,
      this.hints,
      this.subtitle,
      this.secretCard,
      this.thresholdPanel,
      this.ticketCard,
      this.lockPrompt,
      this.resumeLook,
      this.visitorMenu,
    );
    this.setLocation('plaza');
  }

  /** The cinematic introduction dialog owns the first title while it is open.
   * The HUD's own arrival card is the fallback for ?qa/?edit sessions; showing
   * both stacked two different welcome titles on top of each other. */
  setCinematicArrivalActive(active: boolean): void {
    this.cinematicArrivalActive = active;
    this.root.classList.toggle('hud--cinematic', active);
    this.setPointerLocked(this.pointerLocked);
  }

  /** The accessible cinematic dialog has completed the same one-time entry. */
  completeArrival(): void {
    this.cinematicArrivalActive = false;
    this.root.classList.remove('hud--cinematic');
    this.arrivalEntered = true;
    this.lockPrompt.hidden = true;
    this.setPointerLocked(this.pointerLocked);
  }

  /** The first title is a one-time introduction, not a modal that returns
   * over the museum whenever pointer lock is released. */
  setArrivalReadiness(ready: boolean): void {
    if (this.arrivalEntered || this.arrivalReady === ready) return;
    this.arrivalReady = ready;
    this.lockPrompt.setAttribute('aria-disabled', String(!ready));
    this.lockPrompt.classList.toggle('hud__lock--preparing', !ready);
    this.arrivalAction.textContent = ready
      ? 'CLICK OR PRESS ENTER TO BEGIN EXPLORING'
      : 'PREPARING YOUR ARRIVAL — GALLERIES WARMING';
  }

  setPointerLocked(locked: boolean): void {
    this.pointerLocked = locked;
    this.lockPrompt.hidden = locked || this.touchMode || this.buildModeActive || this.arrivalEntered
      || this.cinematicArrivalActive;
    this.resumeLook.hidden = !this.arrivalEntered || locked || this.touchMode || this.buildModeActive;
    this.reticle.style.display = locked || this.touchMode ? '' : 'none';
    this.visitorMenu.hidden = !this.arrivalEntered || !this.touchMode || this.buildModeActive;
    // The bottom-right action button and the key hints share a corner: lift
    // the hints clear of the button instead of letting it cover them.
    this.root.classList.toggle('hud--corner-action', !this.resumeLook.hidden || !this.visitorMenu.hidden);
  }

  /** Add the development-only Build Mode affordance after the editor loads. */
  setBuildModeControl(onToggle: (() => void) | null): void {
    this.buildModeButton?.remove();
    this.buildModeButton = null;
    if (!onToggle) return;
    const button = el('button', {
      class: 'hud__build-mode',
      type: 'button',
      'aria-pressed': 'false',
      'aria-label': 'Enter Build Mode',
      text: 'BUILD MODE',
    });
    button.addEventListener('click', onToggle);
    button.disabled = this.pocketWorldActive;
    this.root.append(button);
    this.buildModeButton = button;
  }

  /** Workshop owns this state; the ordinary capture prompt never overlays it. */
  setBuildModeActive(active: boolean): void {
    this.buildModeActive = active;
    if (this.buildModeButton) {
      this.buildModeButton.textContent = active ? 'EXIT BUILD MODE' : 'BUILD MODE';
      this.buildModeButton.setAttribute('aria-label', active ? 'Exit Build Mode' : 'Enter Build Mode');
      this.buildModeButton.setAttribute('aria-pressed', String(active));
    }
    this.setPointerLocked(this.pointerLocked);
  }

  setPassportStatus(visible: boolean, earned: number, total: number): void {
    const hintChanged = this.passportVisible !== visible;
    this.passportVisible = visible;
    this.passportButton.hidden = !visible;
    const label = `Passport (${earned}/${total})`;
    if (this.passportButton.textContent !== label) {
      this.passportButton.textContent = label;
    }
    this.passportButton.setAttribute('aria-label', `Open Passport (${earned} of ${total} stamps)`);
    if (hintChanged) this.renderHints();
  }

  setPocketWorldState(active: boolean): void {
    this.pocketWorldActive = active;
    this.pocketBackButton.hidden = !active;
    if (this.buildModeButton) this.buildModeButton.disabled = active;
  }

  private touchMode = false;

  /** Switch to touch affordances the first time a touch is seen. */
  setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    this.cueKey.hidden = on;
    this.setPointerLocked(this.pointerLocked);
    this.renderHints();
  }

  private renderHints(): void {
    if (this.touchMode) {
      this.hints.innerHTML = '<div>Left half to walk · right half to look</div><div>Tap the centre dot to interact</div>';
      return;
    }
    const passportHint = this.passportVisible ? ' · <b>P</b> passport' : '';
    this.hints.innerHTML =
      `<div><b>M</b> map · <b>J</b> journal · <b>C</b> curator${passportHint}</div>`
      + '<div><b>Y</b> study · <b>T</b> thread · <b>Ctrl+K</b> command · <b>H</b> contents · <b>O</b> settings</div>';
  }

  setFocus(focus: InteractionFocus | null): void {
    this.interactionFocus = focus;
    this.renderCue();
  }

  /** Development-only contextual cue; ordinary visitor interaction wins. */
  setWorkshopCue(label: string | null): void {
    this.workshopCueLabel = label;
    this.renderCue();
  }

  private renderCue(): void {
    const label = this.interactionFocus?.label ?? (this.workshopCueLabel ? `EDIT · ${this.workshopCueLabel}` : null);
    this.reticle.classList.toggle('hud__reticle--active', label !== null);
    this.cue.classList.toggle('hud__cue--visible', label !== null);
    if (label) this.cueLabel.textContent = label;
  }


  setVisitThreadStatus(label: string | null): void {
    this.threadStatus.hidden = !label;
    this.threadStatus.textContent = label ?? '';
    this.root.classList.toggle('hud--thread-active', Boolean(label));
  }

  /** `outsideLabel` is set while the visitor is in the exterior or a pocket world. */
  setLocation(zone: ZoneId, outsideLabel?: string, outsideKicker?: string): void {
    if (zone === this.lastZone && outsideLabel === this.lastOutsideLabel && outsideKicker === this.lastOutsideKicker) return;
    this.lastZone = zone;
    this.lastOutsideLabel = outsideLabel;
    this.lastOutsideKicker = outsideKicker;
    this.location.dataset.zone = outsideKicker ? 'pocket' : outsideLabel ? 'exterior' : zone;
    const record = ZONE_BY_ID.get(zone);
    const wing = outsideLabel ? undefined : WINGS_BY_ID.get(zone as never);
    const floor = outsideLabel ? null : floorLabelForZone(zone);
    this.location.dataset.floor = floor ?? '';
    this.location.replaceChildren(
      el('span', { text: [floor, wing ? wing.subtitle : (outsideKicker ?? 'Museum of Me')].filter(Boolean).join(' · ') }),
      el('strong', { text: outsideLabel ?? (wing ? wing.name : (record?.label ?? 'Museum')) }),
    );
  }

  /** Show a transient line. Also read by assistive technology. */
  announce(message: string, seconds = 6): void {
    this.subtitle.textContent = message;
    this.subtitle.classList.add('hud__subtitle--visible');
    this.subtitleTimer = seconds;
  }

  /** A found secret: title, its line, and how many have been found. */
  showSecret(title: string, line: string, found: number, total: number, quiet = false, seconds = 5.5): void {
    this.secretCard.replaceChildren(
      el('span', { class: 'hud__secret-kicker', text: quiet ? 'Found' : 'Secret found' }),
      el('strong', { text: title }),
      el('p', { text: line }),
      el('span', { class: 'hud__secret-count', text: `${found} of ${total} secrets` }),
    );
    this.secretCard.classList.toggle('hud__secret--quiet', quiet);
    // Restart the entrance animation even when one find follows another.
    this.secretCard.classList.remove('hud__secret--visible');
    void this.secretCard.offsetWidth;
    this.secretCard.classList.add('hud__secret--visible');
    this.secretTimer = seconds;
  }

  /** The visitor's admission ticket, shown while they walk to the doors. */
  showTicket(ticket: { readonly number: string; readonly date: string } | null, status = ''): void {
    if (!ticket) { this.ticketCard.hidden = true; return; }
    if (this.ticketCard.hidden || this.ticketCard.dataset.number !== ticket.number) {
      this.ticketCard.dataset.number = ticket.number;
      this.ticketCard.replaceChildren(
        el('span', { class: 'hud__ticket-eyebrow', text: 'Museum of Me · Admit one' }),
        el('strong', { class: 'hud__ticket-number', text: `No. ${ticket.number}` }),
        el('span', { class: 'hud__ticket-date', text: ticket.date }),
        this.ticketStatus,
      );
      this.ticketCard.hidden = false;
    }
    if (this.ticketStatus.textContent !== status) this.ticketStatus.textContent = status;
  }

  setThresholdStatus(visible: boolean, message: string, failed = false, preparing = false, needsTicket = false): void {
    const wasVisible = !this.thresholdPanel.hidden;
    const active = document.activeElement;
    if (visible && !wasVisible && active instanceof HTMLElement && !this.thresholdPanel.contains(active)) {
      this.thresholdFocusReturn = active;
    }
    this.thresholdPanel.hidden = !visible;
    this.thresholdStatus.textContent = message;
    this.thresholdEnter.hidden = failed || !needsTicket;
    this.thresholdEnter.disabled = false;
    this.thresholdRetry.hidden = !failed;
    this.thresholdReturn.hidden = !failed && !preparing;
    this.thresholdStatus.setAttribute('role', failed ? 'alert' : 'status');

    if (this.thresholdPanel.contains(active)) {
      if (!visible) {
        if (this.thresholdFocusReturn?.isConnected && !this.thresholdFocusReturn.hidden) {
          this.thresholdFocusReturn.focus({ preventScroll: true });
        } else if (active instanceof HTMLElement) {
          active.blur();
        }
        this.thresholdFocusReturn = null;
      } else if ((active === this.thresholdEnter && this.thresholdEnter.hidden)
        || (active === this.thresholdRetry && this.thresholdRetry.hidden)
        || (active === this.thresholdReturn && this.thresholdReturn.hidden)) {
        const next = failed ? this.thresholdRetry : preparing ? this.thresholdReturn : this.thresholdEnter;
        next.focus({ preventScroll: true });
      }
    }
  }

  /** Called once per frame from the single loop. */
  update(dt: number): void {
    if (this.secretTimer > 0) {
      this.secretTimer -= dt;
      if (this.secretTimer <= 0) this.secretCard.classList.remove('hud__secret--visible');
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) {
        this.subtitle.classList.remove('hud__subtitle--visible');
      }
    }
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}

/** Which floor a zone is on, as a visitor would say it. The building has two
 * architectural levels plus the Sanctuary below the Rotunda. */
export function floorLabelForZone(zone: ZoneId): string | null {
  // 'plaza' inside is the entrance atrium, on the ground floor; outside, the
  // HUD passes an exterior label and asks for no floor.
  if (zone === 'sanctuary') return 'Lower level';
  return ZONE_BY_ID.get(zone)?.level === 1 ? 'Upper floor' : 'Ground floor';
}
