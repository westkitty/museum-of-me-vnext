import { IFRAME_API_URL, PLAYER_HOST, describeYouTubeError, watchUrl } from './youtube';
import type { YouTubeFilm } from './programme';
import type { PlaybackSnapshot, PlaybackState } from './CinemaPlayback';

/** The part of YouTube's IFrame Player API the cinema uses. */
export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
  getIframe?(): HTMLIFrameElement;
  getVideoData?(): { title?: string; author?: string };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: {
    host?: string;
    videoId: string;
    width?: number | string;
    height?: number | string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: { target: YTPlayer }) => void;
      onStateChange?: (event: { data: number; target: YTPlayer }) => void;
      onError?: (event: { data: number; target: YTPlayer }) => void;
    };
  }) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/**
 * Load YouTube's official IFrame Player API once, on demand. Rejects on a
 * script error or after `timeoutMs`; a later attempt may retry.
 */
export function loadYouTubeIframeApi(timeoutMs = 15_000): Promise<YTNamespace> {
  if (typeof window !== 'undefined' && window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => fail(new Error('timed out')), timeoutMs);
    const script = document.createElement('script');
    const fail = (error: Error) => {
      clearTimeout(timer);
      script.remove();
      apiPromise = null;
      reject(error);
    };
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else fail(new Error('API loaded without a player'));
    };
    script.async = true;
    script.dataset.museumCinema = 'youtube-iframe-api';
    script.onerror = () => fail(new Error('script blocked or unreachable'));
    script.setAttribute('src', IFRAME_API_URL);
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface YouTubePlaybackOptions {
  readonly loadApi?: () => Promise<YTNamespace>;
  /** Where the player's element goes (the cinema's screen overlay). */
  readonly mount: () => HTMLElement;
  readonly readyTimeoutMs?: number;
  /** Seconds after play() with no "playing" before the visitor is told the browser held it. */
  readonly playStallSeconds?: number;
  readonly isFileProtocol?: () => boolean;
  readonly online?: () => boolean;
  readonly origin?: () => string;
  /** Creates the element the player replaces (tests supply one without a DOM). */
  readonly createHolder?: () => HTMLElement;
}

const STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

/**
 * A YouTube screening through the official embed player. Same surface as the
 * local CinemaPlayback, so the cinema's controls drive either. Starts muted
 * (sound only by the visitor's choice), never plays before the visitor's
 * explicit choice, and `release()` destroys the player and its iframe.
 * Captions belong to YouTube; this player cannot switch them.
 */
export class YouTubePlayback {
  private player: YTPlayer | null = null;
  private holder: HTMLElement | null = null;
  private currentFilm: YouTubeFilm | null = null;
  private status: PlaybackState = 'empty';
  private errorMessage: string | null = null;
  private fallbackUrl: string | null = null;
  private sound = false;
  private time = 0;
  private duration = 0;
  private loadToken = 0;
  private sinceEmit = 0;
  private playRequestedFor = -1;
  private verifiedTitle: string | null = null;
  /** The IFrame API's last onError code, for diagnosis and tests. */
  errorCode: number | null = null;
  private readonly changeListeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  constructor(private readonly options: YouTubePlaybackOptions) {}

  get state(): PlaybackState { return this.status; }
  get film(): YouTubeFilm | null { return this.currentFilm; }
  /** True while a player (and its iframe) exists. */
  get hasPlayer(): boolean { return this.player !== null; }
  get iframe(): HTMLIFrameElement | null { return this.player?.getIframe?.() ?? null; }
  /** The title YouTube's own player reported for the loaded video, when it did. */
  get playerTitle(): string | null { return this.verifiedTitle; }
  get durationSeconds(): number { return this.duration; }

  snapshot(): PlaybackSnapshot {
    const film = this.currentFilm;
    return {
      state: this.status,
      film,
      provider: film ? 'youtube' : null,
      currentTime: this.time,
      duration: this.duration > 0 ? this.duration : film?.youtube.durationSeconds ?? 0,
      captionsAvailable: false,
      captionsOn: false,
      captionText: '',
      soundOn: this.sound,
      soundAvailable: film !== null && this.player !== null,
      error: this.errorMessage,
      watchUrl: this.fallbackUrl,
    };
  }

  onChange(fn: (snapshot: PlaybackSnapshot) => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  async load(film: YouTubeFilm): Promise<boolean> {
    this.release();
    const token = ++this.loadToken;
    this.currentFilm = film;
    this.status = 'loading';
    this.emit();

    if (this.options.isFileProtocol?.() ?? (typeof location !== 'undefined' && location.protocol === 'file:')) {
      return this.fail(token, 'YouTube screenings need the hosted, online museum. This offline copy plays only the museum\'s own films.', true);
    }
    if (!(this.options.online?.() ?? (typeof navigator === 'undefined' || navigator.onLine !== false))) {
      return this.fail(token, 'This device is offline, so YouTube cannot be reached. The museum\'s own films still play.', true);
    }
    let api: YTNamespace;
    try {
      api = await (this.options.loadApi ?? (() => loadYouTubeIframeApi()))();
    } catch (error) {
      return this.fail(token, `YouTube's player could not be loaded (${error instanceof Error ? error.message : 'unknown'}): the network, a content blocker or browser privacy settings may be stopping it.`, true);
    }
    if (token !== this.loadToken) return false;

    const holder = this.options.createHolder?.() ?? document.createElement('div');
    holder.className = 'cinema-youtube__player';
    this.options.mount().appendChild(holder);
    this.holder = holder;
    const origin = this.options.origin?.() ?? (typeof location !== 'undefined' ? location.origin : '');
    const ready = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), this.options.readyTimeoutMs ?? 20_000);
      const done = (ok: boolean) => { clearTimeout(timer); resolve(ok); };
      try {
        this.player = new api.Player(holder, {
          host: PLAYER_HOST,
          videoId: film.youtube.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0, playsinline: 1, rel: 0, controls: 1, fs: 0, iv_load_policy: 3,
            disablekb: 0, enablejsapi: 1, ...(origin && origin !== 'null' ? { origin, widget_referrer: origin } : {}),
          },
          events: {
            onReady: (event) => {
              if (token !== this.loadToken) return;
              event.target.mute();
              this.sound = false;
              this.duration = Number(event.target.getDuration()) || 0;
              this.verifiedTitle = event.target.getVideoData?.()?.title || null;
              done(true);
            },
            onStateChange: (event) => this.onState(token, event.data),
            onError: (event) => {
              if (token !== this.loadToken) return;
              const code = Number(event.data);
              const { message, watchOnYouTube } = describeYouTubeError(code);
              this.errorCode = code;
              done(false);
              void this.fail(token, `${message} (YouTube error ${code})`, watchOnYouTube);
            },
          },
        });
      } catch (error) {
        done(false);
        void this.fail(token, `YouTube's player could not start: ${error instanceof Error ? error.message : String(error)}`, true);
      }
    });
    const ok = await ready;
    if (token !== this.loadToken) return false;
    if (!ok) {
      if ((this.status as PlaybackState) !== 'error') return this.fail(token, 'YouTube\'s player did not become ready in time (slow or blocked connection).', true);
      return false;
    }
    this.status = 'ready';
    this.emit();
    return true;
  }

  async play(): Promise<boolean> {
    const player = this.player;
    if (!player || this.status === 'loading' || this.status === 'error' || this.status === 'empty') return false;
    if (this.status === 'ended') player.seekTo(0, true);
    this.errorMessage = null;
    this.playRequestedFor = 0;
    player.playVideo();
    this.emit();
    return true;
  }

  pause(): void {
    if (!this.player || (this.status !== 'playing' && this.status !== 'ready')) return;
    this.player.pauseVideo();
    this.playRequestedFor = -1;
    this.status = 'paused';
    this.emit();
  }

  async toggle(): Promise<boolean> {
    if (this.status === 'playing') {
      this.pause();
      return true;
    }
    return this.play();
  }

  restart(): void {
    if (!this.player || this.status === 'loading' || this.status === 'error' || this.status === 'empty') return;
    this.player.seekTo(0, true);
    this.time = 0;
    if (this.status === 'ended') this.status = 'paused';
    this.emit();
  }

  seek(seconds: number): void {
    if (!this.player || this.status === 'loading' || this.status === 'error' || this.status === 'empty') return;
    const clamped = Math.max(0, this.duration > 0 ? Math.min(this.duration, seconds) : seconds);
    this.player.seekTo(clamped, true);
    this.time = clamped;
    this.emit();
  }

  skip(deltaSeconds: number): void {
    if (this.player) this.seek(this.readTime() + deltaSeconds);
  }

  /** Captions are YouTube's (its own CC control); there is nothing to switch here. */
  setCaptions(): void { this.emit(); }

  setSound(on: boolean): void {
    if (!this.player) return;
    if (on) this.player.unMute();
    else this.player.mute();
    this.sound = on;
    this.emit();
  }

  /** From the app's frame loop: refresh time at ~4 Hz while playing, and notice a held start. */
  tick(dt: number): void {
    if (!this.player) return;
    if (this.playRequestedFor >= 0 && this.status !== 'playing') {
      this.playRequestedFor += dt;
      if (this.playRequestedFor > (this.options.playStallSeconds ?? 6)) {
        this.playRequestedFor = -1;
        this.errorMessage = 'The film has not started yet: the browser may have held it, or YouTube is still buffering. Press Play to try again.';
        if (this.status === 'ready') this.status = 'paused';
        this.emit();
      }
    }
    if (this.status !== 'playing') return;
    this.sinceEmit += dt;
    if (this.sinceEmit < 0.25) return;
    this.sinceEmit = 0;
    this.time = this.readTime();
    const duration = Number(this.player.getDuration());
    if (duration > 0) this.duration = duration;
    this.emit();
  }

  release(): void {
    this.loadToken++;
    const hadFilm = this.currentFilm !== null || this.status !== 'empty';
    try { this.player?.destroy(); } catch { /* already gone */ }
    this.player = null;
    this.holder?.remove();
    this.holder = null;
    this.currentFilm = null;
    this.status = 'empty';
    this.errorMessage = null;
    this.fallbackUrl = null;
    this.sound = false;
    this.time = 0;
    this.duration = 0;
    this.playRequestedFor = -1;
    this.verifiedTitle = null;
    this.errorCode = null;
    if (hadFilm) this.emit();
  }

  dispose(): void {
    this.release();
    this.changeListeners.clear();
  }

  private onState(token: number, data: number): void {
    if (token !== this.loadToken || !this.player) return;
    if (data === STATE.PLAYING) {
      this.status = 'playing';
      this.playRequestedFor = -1;
      this.errorMessage = null;
    } else if (data === STATE.PAUSED) {
      if (this.status === 'playing') this.status = 'paused';
    } else if (data === STATE.ENDED) {
      this.status = 'ended';
    } else {
      return;
    }
    this.time = this.readTime();
    this.emit();
  }

  private readTime(): number {
    try {
      return Number(this.player?.getCurrentTime()) || 0;
    } catch {
      return this.time;
    }
  }

  private fail(token: number, message: string, offerWatch: boolean): false {
    if (token !== this.loadToken) return false;
    const film = this.currentFilm;
    try { this.player?.destroy(); } catch { /* already gone */ }
    this.player = null;
    this.holder?.remove();
    this.holder = null;
    this.currentFilm = film;
    this.status = 'error';
    this.errorMessage = message;
    this.fallbackUrl = offerWatch && film ? watchUrl(film.youtube.videoId) : null;
    this.emit();
    return false;
  }

  private emit(): void {
    if (this.changeListeners.size === 0) return;
    const snapshot = this.snapshot();
    for (const fn of this.changeListeners) fn(snapshot);
  }
}
