import { Panel } from './Panel';
import { el } from './dom';
import { formatDuration, resolveMediaUrl, type Film, type Programme } from '../cinema/programme';
import type { PlaybackSnapshot } from '../cinema/CinemaPlayback';
import './cinema.css';

/**
 * The cinema programme: every film the museum actually holds, with what it is,
 * how long it runs, whether it has sound and captions. Choosing a film starts
 * it on the auditorium screen. Real HTML, keyboard-operable like every panel.
 */
export class CinemaProgrammePanel extends Panel {
  private unavailable = new Map<string, string>();

  constructor(
    private readonly programme: Programme,
    private readonly choose: (filmId: string) => void,
    private readonly current: () => string | null,
  ) {
    super('cinema-programme', 'Programme', 'The Museum Cinema · upper floor');
  }

  /** Remember a film that failed to load so the list says so honestly. */
  markUnavailable(filmId: string, reason: string): void {
    this.unavailable.set(filmId, reason);
  }

  protected override render(): void {
    const { films, rejected } = this.programme;
    if (films.length === 0) {
      this.setContent(
        el('p', { class: 'cinema-programme__empty', text: 'No films are in the programme yet. The cinema, its screen and its player are ready; films appear here once real museum media is added to the programme.' }),
        ...this.rejectedNotes(rejected),
      );
      return;
    }
    const currentId = this.current();
    const list = el('ul', { class: 'cinema-programme__list', 'aria-label': 'Films' });
    for (const film of films) {
      const reason = this.unavailable.get(film.id);
      const button = el('button', {
        type: 'button',
        class: 'cinema-film',
        'aria-describedby': `cinema-film-${film.id}-about`,
        'aria-current': film.id === currentId ? 'true' : undefined,
        onclick: () => {
          this.close();
          this.choose(film.id);
        },
      },
      film.poster ? el('img', { class: 'cinema-film__poster', src: resolveMediaUrl(film.poster.src), alt: '', loading: 'lazy', width: 96, height: 173 }) : null,
      el('span', { class: 'cinema-film__text' },
        el('span', { class: 'cinema-film__title', text: film.title }),
        el('span', { class: 'cinema-film__meta', text: filmMeta(film) }),
        el('span', { class: 'cinema-film__about', id: `cinema-film-${film.id}-about`, text: film.description }),
        reason ? el('span', { class: 'cinema-film__unavailable', text: `Unavailable last time: ${reason}` }) : null,
      ));
      list.append(el('li', {}, button));
    }
    const first = films[0];
    this.setContent(
      el('p', { class: 'panel__note', text: `${films.length} film${films.length === 1 ? '' : 's'}. ${first.context}` }),
      list,
      el('p', { class: 'panel__note', text: 'Choosing a film starts it on the screen. Nothing plays until you choose, and films start without sound.' }),
      ...this.rejectedNotes(rejected),
    );
  }

  /** Keyboard visitors land on the current (or first) film, not the dialog shell. */
  override open(): void {
    super.open();
    const focusTarget = this.content.querySelector<HTMLButtonElement>('button.cinema-film[aria-current="true"]')
      ?? this.content.querySelector<HTMLButtonElement>('button.cinema-film');
    focusTarget?.focus({ preventScroll: true });
  }

  private rejectedNotes(rejected: Programme['rejected']): HTMLElement[] {
    if (rejected.length === 0) return [];
    return [el('p', { class: 'panel__note', text: `${rejected.length} programme entr${rejected.length === 1 ? 'y was' : 'ies were'} not shown because the data was incomplete: ${rejected.map((r) => `${r.id} (${r.reason})`).join('; ')}.` })];
  }
}

export function filmMeta(film: Film): string {
  const sound = film.media.hasAudio ? 'Sound available (off until you turn it on)' : 'Silent';
  const captions = film.captions ? 'Captions' : 'No captions';
  return `${formatDuration(film.media.durationSeconds)} · ${sound} · ${captions} · ${film.media.width}×${film.media.height}`;
}

export interface CinemaConsoleActions {
  readonly programme: () => void;
  readonly toggle: () => void;
  readonly restart: () => void;
  readonly skip: (seconds: number) => void;
  readonly seek: (seconds: number) => void;
  readonly captions: (on: boolean) => void;
  readonly sound: (on: boolean) => void;
  readonly stand: () => void;
}

export interface CinemaConsoleContext {
  readonly visible: boolean;
  readonly seatLabel: string | null;
}

/**
 * The seated playback controls: a small, non-modal bar so the screen stays the
 * focus. Every control is a real button with a visible focus ring; the same
 * actions have keys while seated (shown in the hint line). Captions are drawn
 * here, in a polite live region, so screen readers hear them too.
 */
export class CinemaConsole {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly status: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly playButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly backButton: HTMLButtonElement;
  private readonly forwardButton: HTMLButtonElement;
  private readonly seekInput: HTMLInputElement;
  private readonly time: HTMLElement;
  private readonly captionsButton: HTMLButtonElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly standButton: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private snapshot: PlaybackSnapshot | null = null;
  private context: CinemaConsoleContext = { visible: false, seatLabel: null };

  constructor(private readonly actions: CinemaConsoleActions) {
    const button = (label: string, text: string, onclick: () => void, extra: Record<string, string> = {}) =>
      el('button', { type: 'button', class: 'cinema-console__button', 'aria-label': label, title: label, text, onclick, ...extra }) as HTMLButtonElement;
    this.title = el('p', { class: 'cinema-console__title' });
    this.status = el('p', { class: 'cinema-console__status', role: 'status', 'aria-live': 'polite' });
    this.caption = el('p', { class: 'cinema-console__caption', 'aria-live': 'polite', hidden: true });
    const programmeButton = button('Programme (P)', 'Programme', () => this.actions.programme());
    this.restartButton = button('Restart (R)', '⏮ Restart', () => this.actions.restart());
    this.backButton = button('Back 5 seconds (,)', '−5 s', () => this.actions.skip(-5));
    this.playButton = button('Play (Space)', '▶ Play', () => this.actions.toggle());
    this.forwardButton = button('Forward 5 seconds (.)', '+5 s', () => this.actions.skip(5));
    this.seekInput = el('input', {
      type: 'range', class: 'cinema-console__seek', min: 0, max: 1, step: 0.01, value: 0, 'aria-label': 'Position in film',
      oninput: () => this.actions.seek(Number(this.seekInput.value)),
    }) as HTMLInputElement;
    this.time = el('span', { class: 'cinema-console__time', 'aria-hidden': 'true', text: '0:00 / 0:00' });
    this.captionsButton = button('Captions (V)', 'CC', () => this.actions.captions(this.captionsButton.getAttribute('aria-pressed') !== 'true'), { 'aria-pressed': 'false' });
    this.soundButton = button('Sound', 'Sound off', () => this.actions.sound(this.soundButton.getAttribute('aria-pressed') !== 'true'), { 'aria-pressed': 'false' });
    this.standButton = button('Stand up (X, or any movement key)', 'Stand up', () => this.actions.stand());
    this.hint = el('p', { class: 'cinema-console__hint' });
    this.root = el('section', { class: 'cinema-console', 'aria-label': 'Cinema controls', hidden: true },
      this.caption,
      el('div', { class: 'cinema-console__bar' },
        el('div', { class: 'cinema-console__heading' }, this.title, this.status),
        el('div', { class: 'cinema-console__controls' },
          programmeButton, this.restartButton, this.backButton, this.playButton, this.forwardButton,
          this.seekInput, this.time, this.captionsButton, this.soundButton, this.standButton),
        this.hint,
      ));
  }

  get isVisible(): boolean {
    return !this.root.hidden;
  }

  setContext(context: CinemaConsoleContext): void {
    this.context = context;
    this.render();
  }

  update(snapshot: PlaybackSnapshot): void {
    this.snapshot = snapshot;
    this.render();
  }

  private render(): void {
    const { visible, seatLabel } = this.context;
    this.root.hidden = !visible;
    if (!visible) return;
    const s = this.snapshot;
    const film = s?.film ?? null;
    const state = s?.state ?? 'empty';
    this.title.textContent = film ? film.title : 'The Museum Cinema';
    this.status.textContent = statusLine(s, seatLabel);
    const playable = state === 'ready' || state === 'playing' || state === 'paused' || state === 'ended';
    this.playButton.textContent = state === 'playing' ? '❚❚ Pause' : state === 'ended' ? '▶ Play again' : '▶ Play';
    this.playButton.setAttribute('aria-label', state === 'playing' ? 'Pause (Space)' : 'Play (Space)');
    for (const control of [this.playButton, this.restartButton, this.backButton, this.forwardButton]) control.disabled = !playable;
    const duration = s?.duration ?? 0;
    this.seekInput.disabled = !playable || duration <= 0;
    this.seekInput.max = String(Math.max(duration, 0.01));
    // Do not fight a visitor who is dragging the slider.
    if (document.activeElement !== this.seekInput) this.seekInput.value = String(s?.currentTime ?? 0);
    this.seekInput.setAttribute('aria-valuetext', `${formatDuration(s?.currentTime ?? 0)} of ${formatDuration(duration)}`);
    this.time.textContent = `${formatDuration(s?.currentTime ?? 0)} / ${formatDuration(duration)}`;
    this.captionsButton.disabled = !s?.captionsAvailable;
    this.captionsButton.setAttribute('aria-pressed', String(Boolean(s?.captionsOn)));
    this.captionsButton.title = s?.captionsAvailable ? 'Captions (V)' : (film?.captionsNote ?? 'No captions for this film');
    this.soundButton.hidden = !film?.media.hasAudio;
    this.soundButton.setAttribute('aria-pressed', String(Boolean(s?.soundOn)));
    this.soundButton.textContent = s?.soundOn ? 'Sound on' : 'Sound off';
    this.standButton.hidden = !seatLabel;
    const caption = s?.captionsOn ? s.captionText : '';
    this.caption.hidden = !caption;
    this.caption.textContent = caption;
    this.hint.textContent = seatLabel
      ? 'Keys while seated: Space play/pause · R restart · , and . skip · V captions · P programme · X or W/A/S/D stand up'
      : 'Find a seat to watch seated, or watch from where you stand. Exits are lit green.';
  }
}

function statusLine(s: PlaybackSnapshot | null, seatLabel: string | null): string {
  const seat = seatLabel ? `Seated: ${seatLabel}. ` : '';
  if (!s || s.state === 'empty') return `${seat}No film chosen. Open the programme to choose one.`;
  if (s.state === 'loading') return `${seat}Loading ${s.film?.title ?? 'the film'}…`;
  if (s.state === 'error') return `${seat}${s.error ?? 'This film is unavailable.'} Choose another from the programme.`;
  if (s.error) return `${seat}${s.error}`;
  const silent = s.film && !s.film.media.hasAudio ? ' Silent film.' : '';
  if (s.state === 'playing') return `${seat}Now playing.${silent}`;
  if (s.state === 'paused') return `${seat}Paused.`;
  if (s.state === 'ended') return `${seat}The film has ended. Play again, or choose another.`;
  return `${seat}Ready.${silent}`;
}
