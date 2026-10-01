import { Panel } from './Panel';
import { el } from './dom';
import type { VisitorPreferences } from '../state/Preferences';
import type { QualityTier } from '../render/QualityTiers';

export interface SettingsHandlers {
  readonly get: () => VisitorPreferences;
  readonly setQuality: (tier: QualityTier | 'auto') => void;
  readonly update: (patch: Partial<VisitorPreferences>) => void;
  /** Live adaptive-quality state, or null when the museum is not adapting. */
  readonly qualityStatus?: () => string | null;
}

/**
 * Visitor settings. Everything the accessibility pass requires is here and
 * everything here takes effect immediately — no reload, no confirmation.
 */
export class SettingsPanel extends Panel {
  constructor(private readonly handlers: SettingsHandlers) {
    super('settings', 'Settings', 'Comfort and accessibility');
  }

  protected render(): void {
    const p = this.handlers.get();

    this.setContent(
      el('h3', { text: 'Display' }),
      this.qualityField(p),
      this.range('Interface scale', 'Scales all museum text and panels.', p.uiScale, 0.8, 1.6, 0.05,
        (v) => this.handlers.update({ uiScale: v })),
      this.check('High contrast', 'Increases contrast in every reading surface.', p.highContrast,
        (v) => this.handlers.update({ highContrast: v })),

      el('h3', { text: 'Motion' }),
      this.check('Reduced motion', 'Stops exhibit animation and camera easing. Every exhibit stays fully usable — its moving parts simply hold still.', p.reducedMotion,
        (v) => this.handlers.update({ reducedMotion: v })),
      this.range('Field of view', 'Wider views reduce motion discomfort for some visitors.', p.fieldOfView, 55, 95, 1,
        (v) => this.handlers.update({ fieldOfView: v })),

      el('h3', { text: 'Looking and moving' }),
      this.range('Mouse sensitivity', '', p.mouseSensitivity, 0.3, 2.5, 0.05,
        (v) => this.handlers.update({ mouseSensitivity: v })),
      this.check('Invert vertical look', '', p.invertY, (v) => this.handlers.update({ invertY: v })),

      el('h3', { text: 'Sound' }),
      this.range('Overall volume', 'Muted by default. Raise this only when you want sound.', p.masterVolume, 0, 1, 0.05,
        (v) => this.handlers.update({ masterVolume: v })),
      this.range('Ambience', 'Controls the room-tone mix once Overall volume is raised.', p.ambienceVolume, 0, 1, 0.05,
        (v) => this.handlers.update({ ambienceVolume: v })),
      this.check('Subtitles', 'Shows a text line for museum dialogue and audio cues.', p.subtitles,
        (v) => this.handlers.update({ subtitles: v })),

      el('h3', { text: 'Source comfort' }),
      this.range('HUD opacity', 'Dims the overlay without hiding required museum text.', p.hudOpacity, 0.5, 1, 0.02,
        (v) => this.handlers.update({ hudOpacity: v })),
      this.check('Pause simulation when the tab hides', 'Stops the loop on blur. Keyboard paths still work when you return.', p.autoPauseOnBlur,
        (v) => this.handlers.update({ autoPauseOnBlur: v })),
      this.select('Frame limit', 'Caps rendering. Simulation stays on the fixed step.',
        [['auto', 'Automatic'], ['30', '30 fps'], ['60', '60 fps'], ['unlimited', 'Unlimited']],
        p.frameCap,
        (v) => this.handlers.update({ frameCap: v as VisitorPreferences['frameCap'] }),
      ),
      this.check('Keep screen awake', 'Requests a Wake Lock while exploring. Safe Mode refuses this.', p.wakeLock,
        (v) => this.handlers.update({ wakeLock: v })),
      this.check('Show visitors on the map', '', p.showMapVisitors,
        (v) => this.handlers.update({ showMapVisitors: v })),
      this.check('Reduced transparency', 'Makes glass surfaces more opaque.', p.reducedTransparency,
        (v) => this.handlers.update({ reducedTransparency: v })),
      this.check('Show tooltips', '', p.showTooltips,
        (v) => this.handlers.update({ showTooltips: v })),
      this.select('Interface density', '',
        [['comfortable', 'Comfortable'], ['compact', 'Compact']],
        p.interfaceDensity,
        (v) => this.handlers.update({ interfaceDensity: v as VisitorPreferences['interfaceDensity'] }),
      ),

      el('p', { class: 'panel__note', text: 'Settings are stored in this browser only. The museum has no account and no server. Append ?safe=1 for a session-only Safe Mode that leaves stored values intact.' }),
    );
  }

  /**
   * The Quality control plus whatever the adaptive governor is currently doing.
   * "Automatic" is a moving target by design, so telling the visitor which tier
   * they are actually getting is the difference between an adaptive museum and
   * an unpredictable one.
   */
  private qualityField(p: VisitorPreferences): HTMLElement {
    const field = this.select(
      'Quality',
      'Higher tiers add shadows, detail and streaming range. Chosen automatically at first visit.',
      [['auto', 'Automatic'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
      p.quality,
      (v) => this.handlers.setQuality(v as QualityTier | 'auto'),
    );
    const status = this.handlers.qualityStatus?.();
    if (status) field.append(el('small', { class: 'field__status', text: status }));
    return field;
  }

  private range(label: string, hint: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLElement {
    const output = el('output', { text: format(value) });
    const input = el('input', {
      type: 'range', min, max, step, value,
      'aria-label': label,
      oninput: (e: Event) => {
        const v = Number((e.target as HTMLInputElement).value);
        output.textContent = format(v);
        onChange(v);
      },
    });
    return el('div', { class: 'field' },
      el('label', {}, `${label} `, output),
      input,
      hint ? el('small', { text: hint }) : el('span', {}),
    );
  }

  private check(label: string, hint: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return el('div', { class: 'field field--check' },
      el('input', {
        type: 'checkbox', id, checked: value,
        onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
      }),
      el('div', {},
        el('label', { for: id, text: label }),
        hint ? el('small', { text: hint }) : el('span', {}),
      ),
    );
  }

  private select(label: string, hint: string, options: [string, string][], value: string, onChange: (v: string) => void): HTMLElement {
    const select = el('select', {
      'aria-label': label,
      onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
    });
    for (const [v, text] of options) {
      const option = el('option', { value: v, text });
      if (v === value) option.selected = true;
      select.append(option);
    }
    return el('div', { class: 'field' }, el('label', { text: label }), select, hint ? el('small', { text: hint }) : el('span', {}));
  }
}

function format(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
