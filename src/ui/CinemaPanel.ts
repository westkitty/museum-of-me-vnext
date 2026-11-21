import { Panel } from './Panel';
import { el } from './dom';
import {
  PROVIDER_LABEL, filmDuration, formatDuration, resolveMediaUrl, type Film, type Programme, type YouTubeFilm,
} from '../cinema/programme';
import { thumbnailUrl, watchUrl } from '../cinema/youtube';
import type { CinemaDrafts, DraftEntry } from '../cinema/curatorDraft';
import type { PlaybackSnapshot } from '../cinema/CinemaPlayback';
import './cinema.css';

/** The visitor's acceptance of the external-content notice for YouTube screenings. */
export interface ExternalConsent {
  readonly given: () => boolean;
  readonly accept: () => void;
}

/**
 * The cinema programme: the museum's own films and any YouTube screenings,
 * each saying where it comes from. A YouTube screening asks once per visit
 * before anything is loaded from YouTube (no script, thumbnail or player
 * before that). Real HTML, keyboard-operable like every panel.
 */
export class CinemaProgrammePanel extends Panel {
  private unavailable = new Map<string, string>();
  private confirming: YouTubeFilm | null = null;

  constructor(
    private readonly programme: () => Programme,
    private readonly choose: (filmId: string) => void,
    private readonly current: () => string | null,
    private readonly consent: ExternalConsent,
    private readonly openCurator: () => void,
  ) {
    super('cinema-programme', 'Programme', 'The Museum Cinema · upper floor');
  }

  /** Remember a film that failed to load so the list says so honestly. */
  markUnavailable(filmId: string, reason: string): void {
    this.unavailable.set(filmId, reason);
  }

  override close(): void {
    this.confirming = null;
    super.close();
  }

  protected override render(): void {
    if (this.confirming) {
      this.renderConsent(this.confirming);
      return;
    }
    const { films, rejected } = this.programme();
    if (films.length === 0) {
      this.setContent(
        el('p', { class: 'cinema-programme__empty', text: 'No films are in the programme yet. The cinema, its screen and its player are ready; films appear here once real museum media is added to the programme.' }),
        ...this.rejectedNotes(rejected),
        this.curatorButton(),
      );
      return;
    }
    const currentId = this.current();
    const list = el('ul', { class: 'cinema-programme__list', 'aria-label': 'Films' });
    for (const film of films) {
      const reason = this.unavailable.get(film.id);
      const blocked = film.kind === 'youtube' && film.youtube.availability === 'unavailable';
      const button = el('button', {
        type: 'button',
        class: `cinema-film${film.kind === 'youtube' ? ' cinema-film--external' : ''}`,
        'aria-describedby': `cinema-film-${film.id}-about`,
        'aria-current': film.id === currentId ? 'true' : undefined,
        'aria-disabled': blocked ? 'true' : undefined,
        onclick: () => this.select(film),
      },
      this.poster(film),
      el('span', { class: 'cinema-film__text' },
        el('span', { class: 'cinema-film__title', text: film.title }),
        el('span', { class: 'cinema-film__meta', text: filmMeta(film) }),
        film.kind === 'youtube' && film.draft ? el('span', { class: 'cinema-film__draft', text: 'Draft · this browser only, not published' }) : null,
        el('span', { class: 'cinema-film__about', id: `cinema-film-${film.id}-about`, text: aboutText(film) }),
        blocked ? el('span', { class: 'cinema-film__unavailable', text: `Unavailable here: ${film.kind === 'youtube' ? film.youtube.availabilityNote ?? 'YouTube will not play it inside the museum.' : ''}` }) : null,
        reason ? el('span', { class: 'cinema-film__unavailable', text: `Unavailable last time: ${reason}` }) : null,
      ));
      const item = el('li', {}, button);
      if (film.kind === 'youtube') {
        item.append(el('a', {
          class: 'cinema-film__watch', href: watchUrl(film.youtube.videoId), target: '_blank', rel: 'noopener noreferrer',
          text: 'Watch on YouTube instead (opens a new tab)',
        }));
      }
      list.append(item);
    }
    const local = films.filter((f) => f.kind === 'local').length;
    const external = films.length - local;
    this.setContent(
      el('p', { class: 'panel__note', text: `${local} museum film${local === 1 ? '' : 's'} (play offline)${external ? ` and ${external} YouTube screening${external === 1 ? '' : 's'} (online only)` : ''}.` }),
      list,
      el('p', { class: 'panel__note', text: 'Choosing a film starts it on the screen. Nothing plays until you choose, and films start without sound.' }),
      ...this.rejectedNotes(rejected),
      this.curatorButton(),
    );
  }

  /** Keyboard visitors land on the current (or first) film, not the dialog shell. */
  override open(): void {
    super.open();
    this.focusFirst();
  }

  private focusFirst(): void {
    const focusTarget = this.content.querySelector<HTMLElement>('[data-autofocus]')
      ?? this.content.querySelector<HTMLButtonElement>('button.cinema-film[aria-current="true"]')
      ?? this.content.querySelector<HTMLButtonElement>('button.cinema-film');
    focusTarget?.focus({ preventScroll: true });
  }

  private select(film: Film): void {
    if (film.kind === 'youtube') {
      if (film.youtube.availability === 'unavailable') return;
      if (!this.consent.given()) {
        this.confirming = film;
        this.render();
        this.focusFirst();
        return;
      }
    }
    this.close();
    this.choose(film.id);
  }

  private renderConsent(film: YouTubeFilm): void {
    this.setContent(
      el('h3', { class: 'cinema-consent__title', text: 'Watch from YouTube?' }),
      el('p', { class: 'cinema-consent__text', text: `"${film.title}" is not part of the museum's own collection: it plays from YouTube, an external service. Choosing Watch loads YouTube's player in its privacy-enhanced mode, which connects this browser to YouTube and Google, may set cookies or similar storage there, and is subject to YouTube's terms. It plays only while you are online. The museum's own films stay offline and are unaffected.` }),
      el('p', { class: 'cinema-consent__text', text: 'Your answer lasts for this visit. The film starts without sound; turn sound on with the Sound button.' }),
      el('div', { class: 'cinema-consent__actions' },
        el('button', {
          type: 'button', class: 'cinema-consent__accept', 'data-autofocus': 'true', text: 'Watch from YouTube',
          onclick: () => {
            this.consent.accept();
            this.confirming = null;
            this.close();
            this.choose(film.id);
          },
        }),
        el('button', {
          type: 'button', class: 'cinema-consent__back', text: 'Back to the programme',
          onclick: () => { this.confirming = null; this.render(); this.focusFirst(); },
        }),
        el('a', { href: watchUrl(film.youtube.videoId), target: '_blank', rel: 'noopener noreferrer', text: 'Open on YouTube instead (new tab)' }),
      ),
    );
  }

  private poster(film: Film): HTMLElement | null {
    if (film.kind === 'local') {
      return film.poster ? el('img', { class: 'cinema-film__poster', src: resolveMediaUrl(film.poster.src), alt: '', loading: 'lazy', width: 96, height: 173 }) : null;
    }
    // A provider thumbnail is an external request: only after the visitor accepted the notice.
    return this.consent.given()
      ? el('img', { class: 'cinema-film__poster cinema-film__poster--wide', src: film.youtube.thumbnail, alt: '', loading: 'lazy', width: 96, height: 54, referrerpolicy: 'strict-origin-when-cross-origin' })
      : el('span', { class: 'cinema-film__poster cinema-film__poster--provider', 'aria-hidden': 'true', text: 'YouTube' });
  }

  private curatorButton(): HTMLElement {
    return el('button', { type: 'button', class: 'cinema-programme__curate', text: 'Add video…', onclick: () => { this.close(); this.openCurator(); } });
  }

  private rejectedNotes(rejected: Programme['rejected']): HTMLElement[] {
    if (rejected.length === 0) return [];
    return [el('p', { class: 'panel__note', text: `${rejected.length} programme entr${rejected.length === 1 ? 'y was' : 'ies were'} not shown because the data was incomplete: ${rejected.map((r) => `${r.id} (${r.reason})`).join('; ')}.` })];
  }
}

function aboutText(film: Film): string {
  if (film.kind === 'local') return film.description;
  const by = film.youtube.author ? `By ${film.youtube.author.name} on YouTube. ` : '';
  return `${by}${film.description}`.trim() || 'No description provided.';
}

export function filmMeta(film: Film): string {
  if (film.kind === 'youtube') {
    const duration = filmDuration(film);
    const title = film.youtube.titleSource === 'youtube-oembed' ? 'title from YouTube'
      : film.youtube.titleSource === 'curator' ? 'title set by a curator' : 'title not yet verified';
    const availability = film.youtube.availability === 'embeddable' ? 'plays here when online'
      : film.youtube.availability === 'unavailable' ? 'unavailable here' : 'playback here not yet verified';
    return `${PROVIDER_LABEL} · ${duration ? formatDuration(duration) : 'length from YouTube'} · ${title} · ${availability} · captions from YouTube`;
  }
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
  /** Let pointer input reach YouTube's own controls (captions, quality); null when not supported. */
  readonly providerControls?: (on: boolean) => void;
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
  private readonly providerButton: HTMLButtonElement;
  private readonly watchLink: HTMLAnchorElement;
  private readonly standButton: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private snapshot: PlaybackSnapshot | null = null;
  private context: CinemaConsoleContext = { visible: false, seatLabel: null };
  private providerControlsOn = false;

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
    this.providerButton = button('Use YouTube\'s own controls (captions, quality) with the mouse or touch', 'YouTube controls', () => {
      this.providerControlsOn = !this.providerControlsOn;
      this.actions.providerControls?.(this.providerControlsOn);
      this.render();
    }, { 'aria-pressed': 'false' });
    this.watchLink = el('a', { class: 'cinema-console__watch', target: '_blank', rel: 'noopener noreferrer', text: 'Watch on YouTube', hidden: true }) as HTMLAnchorElement;
    this.standButton = button('Stand up (X, or any movement key)', 'Stand up', () => this.actions.stand());
    this.hint = el('p', { class: 'cinema-console__hint' });
    this.root = el('section', { class: 'cinema-console', 'aria-label': 'Cinema controls', hidden: true },
      this.caption,
      el('div', { class: 'cinema-console__bar' },
        el('div', { class: 'cinema-console__heading' }, this.title, this.status, this.watchLink),
        el('div', { class: 'cinema-console__controls' },
          programmeButton, this.restartButton, this.backButton, this.playButton, this.forwardButton,
          this.seekInput, this.time, this.captionsButton, this.soundButton, this.providerButton, this.standButton),
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
    if (snapshot.provider !== 'youtube' && this.providerControlsOn) {
      this.providerControlsOn = false;
      this.actions.providerControls?.(false);
    }
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
    const youtube = s?.provider === 'youtube';
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
    this.time.textContent = `${formatDuration(s?.currentTime ?? 0)} / ${duration > 0 ? formatDuration(duration) : '–:––'}`;
    this.captionsButton.hidden = youtube;
    this.captionsButton.disabled = !s?.captionsAvailable;
    this.captionsButton.setAttribute('aria-pressed', String(Boolean(s?.captionsOn)));
    this.captionsButton.title = s?.captionsAvailable ? 'Captions (V)' : (film?.captionsNote ?? 'No captions for this film');
    this.soundButton.hidden = !s?.soundAvailable;
    this.soundButton.setAttribute('aria-pressed', String(Boolean(s?.soundOn)));
    this.soundButton.textContent = s?.soundOn ? 'Sound on' : 'Sound off';
    this.providerButton.hidden = !youtube || !playable || !this.actions.providerControls;
    this.providerButton.setAttribute('aria-pressed', String(this.providerControlsOn));
    this.watchLink.hidden = !s?.watchUrl;
    if (s?.watchUrl) this.watchLink.href = s.watchUrl;
    this.standButton.hidden = !seatLabel;
    const caption = s?.captionsOn ? s.captionText : '';
    this.caption.hidden = !caption;
    this.caption.textContent = caption;
    this.hint.textContent = seatLabel
      ? `Keys while seated: Space play/pause · R restart · , and . skip · ${youtube ? 'captions: YouTube controls' : 'V captions'} · P programme · X or W/A/S/D stand up`
      : 'Find a seat to watch seated, or watch from where you stand. Exits are lit green.';
  }
}

function statusLine(s: PlaybackSnapshot | null, seatLabel: string | null): string {
  const seat = seatLabel ? `Seated: ${seatLabel}. ` : '';
  if (!s || s.state === 'empty') return `${seat}No film chosen. Open the programme to choose one.`;
  const from = s.provider === 'youtube' ? ' (from YouTube, online)' : '';
  if (s.state === 'loading') return `${seat}Loading ${s.film?.title ?? 'the film'}${from}…`;
  if (s.state === 'error') return `${seat}${s.error ?? 'This film is unavailable.'} Choose another from the programme.`;
  if (s.error) return `${seat}${s.error}`;
  const silent = s.film?.kind === 'local' && !s.film.media.hasAudio ? ' Silent film.' : '';
  if (s.state === 'playing') return `${seat}Now playing${from}.${silent}`;
  if (s.state === 'paused') return `${seat}Paused.`;
  if (s.state === 'ended') return `${seat}The film has ended. Play again, or choose another.`;
  return `${seat}Ready${from}.${silent}`;
}

/** Everything the Add-video panel needs, kept narrow so it can be tested without the app. */
export interface CuratorHost {
  readonly drafts: CinemaDrafts;
  readonly published: () => Programme;
  readonly consent: ExternalConsent;
  /** Development server promotion into data/cinema/programme.json; null in production builds. */
  readonly promote: ((drafts: readonly DraftEntry[]) => Promise<{ ok: boolean; message: string }>) | null;
}

/**
 * ADD VIDEO: paste a YouTube link, check it, add it as a draft; edit a fallback
 * title and description; reorder; remove; export or import the programme
 * file; and (development server only) promote drafts into the version-
 * controlled programme. Drafts never change the museum for anyone else.
 */
export class CinemaCuratorPanel extends Panel {
  private message = '';
  private messageKind: 'ok' | 'error' = 'ok';
  private previews = new Set<string>();

  constructor(private readonly host: CuratorHost) {
    super('cinema-curator', 'Add video', 'The Museum Cinema · curator');
    host.drafts.onChange(() => { if (this.isOpen) this.render(); });
  }

  protected override render(): void {
    const input = el('input', {
      type: 'url', id: 'cinema-curator-link', class: 'cinema-curator__input', placeholder: 'https://youtu.be/…',
      autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'cinema-curator-message',
    }) as HTMLInputElement;
    const form = el('form', {
      class: 'cinema-curator__form',
      onsubmit: (event: Event) => {
        event.preventDefault();
        const result = this.host.drafts.add(input.value);
        if (result.ok) {
          this.say(`Added as a draft: ${result.entry.title}. Edit its title below if you like.`, 'ok');
          input.value = '';
        } else {
          this.say(result.reason, 'error');
        }
        this.render();
        this.content.querySelector<HTMLInputElement>('#cinema-curator-link')?.focus();
      },
    },
    el('label', { for: 'cinema-curator-link', class: 'cinema-curator__label', text: 'Paste YouTube link' }),
    el('div', { class: 'cinema-curator__row' }, input, el('button', { type: 'submit', class: 'cinema-curator__add', text: 'Add to Cinema' })),
    el('p', { id: 'cinema-curator-message', class: `cinema-curator__message cinema-curator__message--${this.messageKind}`, role: 'status', 'aria-live': 'polite', text: this.message }),
    );

    const drafts = this.host.drafts.list;
    const draftList = el('ol', { class: 'cinema-curator__list', 'aria-label': 'Draft screenings' });
    drafts.forEach((entry, index) => draftList.append(this.draftItem(entry, index, drafts.length)));
    const publishedYouTube = this.host.published().films.filter((f): f is YouTubeFilm => f.kind === 'youtube' && !f.draft);

    const exportButton = el('button', {
      type: 'button', class: 'cinema-curator__tool', text: 'Export programme file',
      onclick: () => {
        const blob = new Blob([this.host.drafts.exportProgramme()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: 'programme.json' }) as HTMLAnchorElement;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        this.say('Exported programme.json. Replace data/cinema/programme.json with it and commit to publish.', 'ok');
        this.render();
      },
    });
    const importInput = el('input', {
      type: 'file', accept: 'application/json,.json', id: 'cinema-curator-import', class: 'cinema-curator__file', hidden: true, tabindex: '-1',
      onchange: async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        if (file.size > 512 * 1024) { this.say('That file is too large to be a cinema programme.', 'error'); this.render(); return; }
        const result = this.host.drafts.importText(await file.text());
        this.say(`Imported ${result.added} draft${result.added === 1 ? '' : 's'}.${result.skipped.length ? ` Skipped: ${result.skipped.join('; ')}.` : ''}`, result.added ? 'ok' : 'error');
        this.render();
      },
    }) as HTMLInputElement;
    const promote = this.host.promote;
    const promoteButton = promote && drafts.length
      ? el('button', {
        type: 'button', class: 'cinema-curator__promote', text: 'Save drafts to data/cinema/programme.json (development server)',
        onclick: async () => {
          this.say('Checking the drafts with YouTube and saving…', 'ok');
          this.render();
          const result = await promote(this.host.drafts.list);
          if (result.ok) this.host.drafts.clear();
          this.say(result.message, result.ok ? 'ok' : 'error');
          this.render();
        },
      })
      : null;

    this.setContent(
      el('p', { class: 'panel__note', text: 'Drafts are kept in this browser only. They appear in this browser\'s programme, marked as drafts, and change nothing for anyone else. A YouTube link listed in the published programme is public, even if the video is unlisted.' }),
      form,
      el('h3', { class: 'cinema-curator__heading', text: `Drafts (${drafts.length})` }),
      drafts.length ? draftList : el('p', { class: 'panel__note', text: 'No drafts yet.' }),
      ...(this.host.drafts.loadNote ? [el('p', { class: 'panel__note', text: this.host.drafts.loadNote })] : []),
      el('h3', { class: 'cinema-curator__heading', text: 'Publishing' }),
      el('p', { class: 'panel__note', text: promote
        ? 'On the development server, save drafts straight into data/cinema/programme.json (each is checked with YouTube first). Commit that file to publish.'
        : 'To publish, export the programme file, replace data/cinema/programme.json with it, and commit. (Saving directly is available only on the local development server.)' }),
      el('div', { class: 'cinema-curator__tools' },
        exportButton,
        el('button', { type: 'button', class: 'cinema-curator__tool', text: 'Import programme file…', onclick: () => importInput.click() }),
        importInput,
        promoteButton,
      ),
      ...(publishedYouTube.length
        ? [el('p', { class: 'panel__note', text: `Published YouTube screenings: ${publishedYouTube.map((f) => `${f.title} (${f.youtube.videoId})`).join('; ')}.` })]
        : []),
    );
  }

  override open(): void {
    super.open();
    this.content.querySelector<HTMLInputElement>('#cinema-curator-link')?.focus({ preventScroll: true });
  }

  private say(message: string, kind: 'ok' | 'error'): void {
    this.message = message;
    this.messageKind = kind;
  }

  private draftItem(entry: DraftEntry, index: number, total: number): HTMLElement {
    const yt = entry.youtube as { videoId: string; titleSource: string };
    const titleId = `cinema-draft-${entry.id}-title`;
    const aboutId = `cinema-draft-${entry.id}-about`;
    const title = el('input', { id: titleId, class: 'cinema-curator__input', value: String(entry.title), maxlength: 200 }) as HTMLInputElement;
    const about = el('textarea', { id: aboutId, class: 'cinema-curator__textarea', rows: 2, maxlength: 600 }) as HTMLTextAreaElement;
    about.value = String(entry.description ?? '');
    const save = () => {
      const problem = this.host.drafts.update(entry.id, { title: title.value, description: about.value });
      this.say(problem ?? `Saved ${title.value}.`, problem ? 'error' : 'ok');
    };
    title.addEventListener('change', save);
    about.addEventListener('change', save);
    const showPreview = this.previews.has(entry.id) && this.host.consent.given();
    return el('li', { class: 'cinema-curator__item' },
      showPreview
        ? el('img', { class: 'cinema-curator__thumb', src: thumbnailUrl(yt.videoId), alt: `YouTube thumbnail for ${entry.title}`, width: 160, height: 90 })
        : el('button', {
          type: 'button', class: 'cinema-curator__tool', text: 'Show preview (loads from YouTube)',
          onclick: () => { this.host.consent.accept(); this.previews.add(entry.id); this.render(); },
        }),
      el('div', { class: 'cinema-curator__fields' },
        el('p', { class: 'cinema-curator__source', text: `${PROVIDER_LABEL} · video ${yt.videoId} · ${yt.titleSource === 'curator' ? 'title set by you' : 'provisional title (not verified)'} · draft, this browser only` }),
        el('label', { for: titleId, text: 'Title' }), title,
        el('label', { for: aboutId, text: 'Description (optional)' }), about,
        el('div', { class: 'cinema-curator__row' },
          el('button', { type: 'button', class: 'cinema-curator__tool', text: 'Move up', disabled: index === 0, 'aria-label': `Move ${entry.title} up`, onclick: () => this.host.drafts.move(entry.id, -1) }),
          el('button', { type: 'button', class: 'cinema-curator__tool', text: 'Move down', disabled: index === total - 1, 'aria-label': `Move ${entry.title} down`, onclick: () => this.host.drafts.move(entry.id, 1) }),
          el('button', { type: 'button', class: 'cinema-curator__tool cinema-curator__remove', text: 'Remove', 'aria-label': `Remove ${entry.title}`, onclick: () => { this.host.drafts.remove(entry.id); this.say(`Removed ${entry.title}.`, 'ok'); } }),
          el('a', { href: watchUrl(yt.videoId), target: '_blank', rel: 'noopener noreferrer', text: 'Open on YouTube' }),
        ),
      ),
    );
  }
}
