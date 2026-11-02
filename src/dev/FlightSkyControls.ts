import type { App } from '../app/App';
import './flight-sky.css';

/** A dev-only overlay, with no renderer/loop, preference writes, or dependencies. */
export class FlightSkyControls {
  private readonly root = document.createElement('aside');
  private readonly flyButton: HTMLButtonElement;
  private readonly timeInput: HTMLInputElement;
  private readonly timeOutput: HTMLOutputElement;
  private readonly resetButton: HTMLButtonElement;

  constructor(private readonly app: App) {
    this.root.className = 'dev-flight-sky';
    this.root.setAttribute('aria-label', 'Developer flight and sky controls');
    this.root.innerHTML = [
      '<header><strong>DEV / FLIGHT + SKY</strong><span>SESSION ONLY</span></header>',
      '<button type="button" data-dev-fly aria-pressed="false">ENABLE FREE FLIGHT (V)</button>',
      '<div class="dev-flight-sky__clock">',
      '<label for="dev-sky-hour">Sky time of day</label>',
      '<output id="dev-sky-readout" for="dev-sky-hour">Canonical night</output>',
      '</div>',
      '<input id="dev-sky-hour" type="range" min="0" max="24" step="0.25" value="22" ',
      'aria-label="Sky time of day">',
      '<div class="dev-flight-sky__ticks" aria-hidden="true"><span>00:00</span><span>12:00</span><span>24:00</span></div>',
      '<button type="button" data-dev-night>RESTORE CANONICAL NIGHT</button>',
      '<p>Fly: WASD + look · Space rise · Ctrl descend · Shift fast. Click the museum to resume mouse look. Close Build Mode before flying.</p>',
    ].join('');
    const fly = this.root.querySelector<HTMLButtonElement>('[data-dev-fly]');
    const time = this.root.querySelector<HTMLInputElement>('#dev-sky-hour');
    const output = this.root.querySelector<HTMLOutputElement>('#dev-sky-readout');
    const reset = this.root.querySelector<HTMLButtonElement>('[data-dev-night]');
    if (!fly || !time || !output || !reset) throw new Error('Developer controls failed to initialize');
    this.flyButton = fly;
    this.timeInput = time;
    this.timeOutput = output;
    this.resetButton = reset;
    document.body.append(this.root);
    fly.addEventListener('click', this.toggleFly);
    time.addEventListener('input', this.changeTime);
    reset.addEventListener('click', this.restoreNight);
    window.addEventListener('keydown', this.onKeyDown);
  }

  private readonly toggleFly = (): void => {
    const enable = !this.app.player.developerFlightMode;
    if (!this.app.player.setDeveloperFlight(enable)) {
      this.app.ui.hud.announce('Close Build Mode or other active tools before enabling free flight.');
      return;
    }
    this.update();
    this.app.ui.hud.announce(enable
      ? 'Developer free flight enabled. Space up, Ctrl down, Shift fast, V to exit.'
      : 'Developer free flight disabled. Normal walking restored.');
  };

  private readonly changeTime = (): void => {
    const hour = Number(this.timeInput.value);
    this.app.setDevSkyTimeOfDay(hour);
    const minutes = Math.round(hour * 60) % (24 * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    this.timeOutput.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };

  private readonly restoreNight = (): void => {
    this.app.setDevSkyTimeOfDay(null);
    this.timeInput.value = '22';
    this.timeOutput.textContent = 'Canonical night';
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyV' || event.repeat || event.altKey || event.metaKey || event.ctrlKey
      || this.app.input.uiCaptured || this.app.player.isFrozen) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, button, a, [contenteditable], [role="dialog"]')) return;
    event.preventDefault();
    this.toggleFly();
  };

  /** Scripted teleports/resets may cancel flight; keep the button truthful. */
  update(): void {
    const flying = this.app.player.developerFlightMode;
    if (this.flyButton.getAttribute('aria-pressed') === String(flying)) return;
    this.flyButton.setAttribute('aria-pressed', String(flying));
    this.flyButton.textContent = flying ? 'EXIT FREE FLIGHT (V)' : 'ENABLE FREE FLIGHT (V)';
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.flyButton.removeEventListener('click', this.toggleFly);
    this.timeInput.removeEventListener('input', this.changeTime);
    this.resetButton.removeEventListener('click', this.restoreNight);
    this.app.player.setDeveloperFlight(false);
    this.app.setDevSkyTimeOfDay(null);
    this.root.remove();
  }
}
