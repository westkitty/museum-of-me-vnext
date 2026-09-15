import { el, isActivationKey } from './dom';
import type { InteractionFocus } from '../interaction/InteractionManager';
import { ZONE_BY_ID, type ZoneId } from '../world/layout';
import { WINGS_BY_ID } from '../content/collection.generated';

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
  private readonly location: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly hints: HTMLElement;
  private readonly lockPrompt: HTMLElement;
  private readonly threadStatus: HTMLButtonElement;
  private buildModeButton: HTMLButtonElement | null = null;
  private pointerLocked = false;
  private buildModeActive = false;
  private interactionFocus: InteractionFocus | null = null;
  private workshopCueLabel: string | null = null;

  private subtitleTimer = 0;
  private lastZone: ZoneId | null = null;

  constructor(onRequestLock: () => void, onOpenThread?: () => void) {
    this.reticle = el('div', { class: 'hud__reticle' });
    this.cueLabel = el('span', {});
    this.cue = el('div', { class: 'hud__cue' }, el('kbd', { text: 'F' }), this.cueLabel);
    this.location = el('div', { class: 'hud__location' });
    this.subtitle = el('div', { class: 'hud__subtitle', role: 'status', 'aria-live': 'polite' });
    this.threadStatus = el('button', {
      class: 'hud__thread', type: 'button', hidden: true,
      'aria-label': 'Open current Visit Thread', onclick: () => onOpenThread?.(),
    }) as HTMLButtonElement;
    this.hints = el(
      'div',
      { class: 'hud__hints' },
      el('div', { html: '<b>M</b> map · <b>J</b> journal · <b>C</b> curator' }),
      el('div', { html: '<b>Y</b> study · <b>T</b> thread · <b>Ctrl+K</b> command · <b>H</b> contents · <b>O</b> settings' }),
    );

    const requestLock = (event?: Event): void => {
      event?.preventDefault();
      onRequestLock();
    };
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
      el('h2', { text: 'Museum of Me' }),
      el('p', { text: 'Click or press Enter to enter. WASD or arrow keys move, mouse looks, Q/E rotate, Shift sprints, Space jumps, F interacts.' }),
      el('p', { text: 'No mouse? Q/E turn and Page Up/Page Down look vertically; the whole museum remains keyboard-usable.' }),
      el('p', { text: 'Press H at any time for the full text of every exhibit.' }),
    );

    this.root = el(
      'div',
      { class: 'hud', 'aria-hidden': 'false' },
      this.reticle,
      this.cue,
      this.location,
      this.threadStatus,
      this.hints,
      this.subtitle,
      this.lockPrompt,
    );
    this.setLocation('plaza');
  }

  setPointerLocked(locked: boolean): void {
    this.pointerLocked = locked;
    this.lockPrompt.hidden = locked || this.touchMode || this.buildModeActive;
    this.reticle.style.display = locked || this.touchMode ? '' : 'none';
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
    this.lockPrompt.hidden = active || this.pointerLocked || this.touchMode;
  }

  private touchMode = false;

  /** Switch to touch affordances the first time a touch is seen. */
  setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    if (!on) {
      this.setPointerLocked(this.pointerLocked);
      return;
    }
    this.lockPrompt.hidden = true;
    this.reticle.style.display = '';
    this.hints.innerHTML =
      '<div>Left half to walk · right half to look</div><div>Tap the centre dot to interact</div>';
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
  }

  setLocation(zone: ZoneId): void {
    if (zone === this.lastZone) return;
    this.lastZone = zone;
    const record = ZONE_BY_ID.get(zone);
    const wing = WINGS_BY_ID.get(zone as never);
    this.location.replaceChildren(
      el('span', { text: wing ? wing.subtitle : 'Museum of Me' }),
      el('strong', { text: wing ? wing.name : (record?.label ?? 'Museum') }),
    );
  }

  /** Show a transient line. Also read by assistive technology. */
  announce(message: string, seconds = 6): void {
    this.subtitle.textContent = message;
    this.subtitle.classList.add('hud__subtitle--visible');
    this.subtitleTimer = seconds;
  }

  /** Called once per frame from the single loop. */
  update(dt: number): void {
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
