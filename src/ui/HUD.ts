import { el } from './dom';
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

  private subtitleTimer = 0;
  private lastZone: ZoneId | null = null;

  constructor(onRequestLock: () => void) {
    this.reticle = el('div', { class: 'hud__reticle' });
    this.cueLabel = el('span', {});
    this.cue = el('div', { class: 'hud__cue' }, el('kbd', { text: 'F' }), this.cueLabel);
    this.location = el('div', { class: 'hud__location' });
    this.subtitle = el('div', { class: 'hud__subtitle', role: 'status', 'aria-live': 'polite' });
    this.hints = el(
      'div',
      { class: 'hud__hints' },
      el('div', { html: '<b>M</b> map · <b>J</b> journal' }),
      el('div', { html: '<b>H</b> contents · <b>O</b> settings' }),
    );

    this.lockPrompt = el(
      'div',
      { class: 'hud__lock', onclick: onRequestLock },
      el('h2', { text: 'Museum of Me' }),
      el('p', { text: 'Click to enter. WASD or arrow keys move, mouse looks, Q/E rotate, Shift sprints, Space jumps, F interacts.' }),
      el('p', { text: 'No mouse? Q/E turn and Page Up/Page Down look vertically; the whole museum remains keyboard-usable.' }),
      el('p', { text: 'Press H at any time for the full text of every exhibit.' }),
    );

    this.root = el(
      'div',
      { class: 'hud', 'aria-hidden': 'false' },
      this.reticle,
      this.cue,
      this.location,
      this.hints,
      this.subtitle,
      this.lockPrompt,
    );
    this.setLocation('plaza');
  }

  setPointerLocked(locked: boolean): void {
    this.lockPrompt.hidden = locked || this.touchMode;
    this.reticle.style.display = locked || this.touchMode ? '' : 'none';
  }

  private touchMode = false;

  /** Switch to touch affordances the first time a touch is seen. */
  setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    if (!on) return;
    this.lockPrompt.hidden = true;
    this.reticle.style.display = '';
    this.hints.innerHTML =
      '<div>Left half to walk · right half to look</div><div>Tap the centre dot to interact</div>';
  }

  setFocus(focus: InteractionFocus | null): void {
    this.reticle.classList.toggle('hud__reticle--active', focus !== null);
    this.cue.classList.toggle('hud__cue--visible', focus !== null);
    if (focus) this.cueLabel.textContent = focus.label;
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
