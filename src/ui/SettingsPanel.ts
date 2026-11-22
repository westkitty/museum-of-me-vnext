import { Panel } from './Panel';
import { el } from './dom';
import { DEFAULT_PREFERENCES, type VisitorPreferences } from '../state/Preferences';
import type { QualityTier } from '../render/QualityTiers';

export interface SettingsHandlers {
  readonly get: () => VisitorPreferences;
  readonly setQuality: (tier: QualityTier | 'auto') => void;
  readonly update: (patch: Partial<VisitorPreferences>) => void;
}

/**
 * Visitor settings. Everything the accessibility pass requires is here and
 * everything here takes effect immediately — no reload, no confirmation.
 */
/** The comfort settings a visitor can change here, restored together. Quality
 * goes through its own handler; the version and stored-only fields are left. */
export const RESTORABLE_SETTINGS = [
  'uiScale', 'highContrast', 'reducedMotion', 'fieldOfView', 'mouseSensitivity', 'touchSensitivity', 'invertY',
  'masterVolume', 'ambienceVolume', 'musicVolume', 'subtitles', 'hudOpacity', 'autoPauseOnBlur', 'frameCap',
  'wakeLock', 'showMapVisitors', 'reducedTransparency', 'showTooltips', 'interfaceDensity',
] as const satisfies readonly (keyof VisitorPreferences)[];

type RestorableSettings = Pick<VisitorPreferences, (typeof RESTORABLE_SETTINGS)[number]>;

export function pickRestorable(source: VisitorPreferences): RestorableSettings {
  return Object.fromEntries(RESTORABLE_SETTINGS.map((key) => [key, source[key]])) as RestorableSettings;
}

/**
 * Slider bounds. They match the clamps in sanitizePreferences exactly, so the
 * value a visitor sees on the slider is the value that survives a reload.
 */
export const SETTING_RANGES = {
  uiScale: { min: 0.85, max: 1.6, step: 0.05 },
  fieldOfView: { min: 55, max: 95, step: 1 },
  mouseSensitivity: { min: 0.45, max: 2.25, step: 0.05 },
  touchSensitivity: { min: 0.45, max: 2.25, step: 0.05 },
  masterVolume: { min: 0, max: 1, step: 0.05 },
  ambienceVolume: { min: 0, max: 1, step: 0.05 },
  musicVolume: { min: 0, max: 1, step: 0.05 },
  hudOpacity: { min: 0.5, max: 1, step: 0.02 },
} as const satisfies Partial<Record<keyof VisitorPreferences, { min: number; max: number; step: number }>>;

export type RangeSetting = keyof typeof SETTING_RANGES;

/** Visible and spoken value of a slider, with its unit, e.g. "120%", "65°", "×1.20". */
export function settingValueText(key: RangeSetting, value: number): string {
  switch (key) {
    case 'fieldOfView': return `${Math.round(value)}°`;
    case 'mouseSensitivity':
    case 'touchSensitivity': return `×${value.toFixed(2)}`;
    default: return `${Math.round(value * 100)}%`;
  }
}

export class SettingsPanel extends Panel {
  /** What the visitor had before the last restore, for a one-step undo. */
  private undoRestore: { settings: RestorableSettings; quality: VisitorPreferences['quality'] } | null = null;

  constructor(private readonly handlers: SettingsHandlers) {
    super('settings', 'Settings', 'Comfort and accessibility');
    this.onClose(() => { this.undoRestore = null; });
  }

  protected render(): void {
    const p = this.handlers.get();

    this.setContent(
      el('h3', { text: 'Display' }),
      this.select('Quality', 'Higher tiers add shadows, detail and streaming range. Chosen automatically at first visit.',
        [['auto', 'Automatic'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']],
        p.quality,
        (v) => this.handlers.setQuality(v as QualityTier | 'auto'),
      ),
      this.range('uiScale', 'Interface scale', 'Scales all museum text and panels. Long panels scroll; their Close button stays in view.', p.uiScale,
        (v) => this.handlers.update({ uiScale: v })),
      this.check('High contrast', 'Increases contrast in every reading surface.', p.highContrast,
        (v) => this.handlers.update({ highContrast: v })),

      el('h3', { text: 'Motion' }),
      this.check('Reduced motion', 'Stops exhibit animation and camera easing. Every exhibit stays fully usable — its moving parts simply hold still.', p.reducedMotion,
        (v) => this.handlers.update({ reducedMotion: v })),
      this.range('fieldOfView', 'Field of view', 'Wider views reduce motion discomfort for some visitors. The view changes as you drag.', p.fieldOfView,
        (v) => this.handlers.update({ fieldOfView: v })),

      el('h3', { text: 'Looking and moving' }),
      this.range('mouseSensitivity', 'Mouse sensitivity', 'How far the view turns for each movement of the mouse. Q / E and Page Up / Page Down turn at a fixed speed whatever this is set to.', p.mouseSensitivity,
        (v) => this.handlers.update({ mouseSensitivity: v })),
      this.range('touchSensitivity', 'Touch look sensitivity', 'How far the view turns when you drag on the right half of a touch screen. Separate from the mouse.', p.touchSensitivity,
        (v) => this.handlers.update({ touchSensitivity: v })),
      this.check('Invert vertical look', 'Moving the mouse or your finger up looks down, like an aircraft stick.', p.invertY, (v) => this.handlers.update({ invertY: v })),

      el('h3', { text: 'Sound' }),
      this.range('masterVolume', 'Overall volume', 'Muted by default. Raise this only when you want sound.', p.masterVolume,
        (v) => this.handlers.update({ masterVolume: v })),
      this.range('ambienceVolume', 'Ambience', 'Controls the room-tone mix once Overall volume is raised.', p.ambienceVolume,
        (v) => this.handlers.update({ ambienceVolume: v })),
      this.range('musicVolume', 'Music', 'Controls musical cues and scores once Overall volume is raised. Visual cue descriptions follow the Subtitles setting.', p.musicVolume,
        (v) => this.handlers.update({ musicVolume: v })),
      this.check('Subtitles', 'Shows a text line for museum dialogue and audio cues.', p.subtitles,
        (v) => this.handlers.update({ subtitles: v })),

      el('h3', { text: 'Source comfort' }),
      this.range('hudOpacity', 'HUD opacity', 'Dims the overlay without hiding required museum text.', p.hudOpacity,
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
      this.check('Show visitors on the map', 'Shows authored people, staff, and the ambient crowd on the floor plan.', p.showMapVisitors,
        (v) => this.handlers.update({ showMapVisitors: v })),
      this.check('Reduced transparency', 'Makes glass surfaces more opaque.', p.reducedTransparency,
        (v) => this.handlers.update({ reducedTransparency: v })),
      this.check('Show tooltips', 'Adds hover titles to map exhibits and visitor markers; accessible names remain available either way.', p.showTooltips,
        (v) => this.handlers.update({ showTooltips: v })),
      this.select('Interface density', 'Compact uses less padding around panels, leaving more room for text on small screens.',
        [['comfortable', 'Comfortable'], ['compact', 'Compact']],
        p.interfaceDensity,
        (v) => this.handlers.update({ interfaceDensity: v as VisitorPreferences['interfaceDensity'] }),
      ),

      el('h3', { text: 'Start over' }),
      this.undoRestore
        ? el('div', { class: 'field' },
          el('p', { role: 'status', class: 'panel__note', text: 'Settings restored to their defaults.' }),
          el('button', { type: 'button', text: 'Undo restore', onclick: () => this.undo() }))
        : el('div', { class: 'field' },
          el('button', { type: 'button', text: 'Restore default settings', onclick: () => this.restoreDefaults() }),
          el('small', { text: 'Puts every setting on this page back to its default. You can undo it straight away.' })),

      el('p', { class: 'panel__note', text: 'Settings are stored in this browser only. The museum has no account and no server. Append ?safe=1 for a session-only Safe Mode that leaves stored values intact.' }),
    );
  }

  private restoreDefaults(): void {
    const current = this.handlers.get();
    this.undoRestore = { settings: pickRestorable(current), quality: current.quality };
    this.handlers.setQuality(DEFAULT_PREFERENCES.quality);
    this.handlers.update(pickRestorable(DEFAULT_PREFERENCES));
    this.render();
  }

  private undo(): void {
    const previous = this.undoRestore;
    if (!previous) return;
    this.undoRestore = null;
    this.handlers.setQuality(previous.quality);
    this.handlers.update(previous.settings);
    this.render();
  }

  private range(key: RangeSetting, label: string, hint: string, value: number, onChange: (v: number) => void): HTMLElement {
    const { min, max, step } = SETTING_RANGES[key];
    const id = `set-${key}`;
    const hintId = `${id}-hint`;
    const output = el('output', { for: id, text: settingValueText(key, value) });
    const input = el('input', {
      type: 'range', id, min, max, step, value,
      'aria-label': label,
      'aria-valuetext': settingValueText(key, value),
      'aria-describedby': hint ? hintId : undefined,
      oninput: (e: Event) => {
        const target = e.target as HTMLInputElement;
        const v = Number(target.value);
        const text = settingValueText(key, v);
        output.textContent = text;
        target.setAttribute('aria-valuetext', text);
        onChange(v);
      },
    });
    return el('div', { class: 'field' },
      el('label', { for: id }, `${label} `, output),
      input,
      hint ? el('small', { id: hintId, text: hint }) : el('span', {}),
    );
  }

  private check(label: string, hint: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`;
    return el('div', { class: 'field field--check' },
      el('input', {
        type: 'checkbox', id, checked: value,
        'aria-describedby': hint ? `${id}-hint` : undefined,
        onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
      }),
      el('div', {},
        el('label', { for: id, text: label }),
        hint ? el('small', { id: `${id}-hint`, text: hint }) : el('span', {}),
      ),
    );
  }

  private select(label: string, hint: string, options: [string, string][], value: string, onChange: (v: string) => void): HTMLElement {
    const id = `set-${label.replace(/\W+/g, '-').toLowerCase()}`;
    const select = el('select', {
      id,
      'aria-label': label,
      'aria-describedby': hint ? `${id}-hint` : undefined,
      onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
    });
    for (const [v, text] of options) {
      const option = el('option', { value: v, text });
      if (v === value) option.selected = true;
      select.append(option);
    }
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), select, hint ? el('small', { id: `${id}-hint`, text: hint }) : el('span', {}));
  }
}

