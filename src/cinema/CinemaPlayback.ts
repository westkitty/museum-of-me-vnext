import * as THREE from 'three';
import { resolveMediaUrl, type Film, type LocalFilm } from './programme';

export type PlaybackState = 'empty' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlaybackSnapshot {
  readonly state: PlaybackState;
  readonly film: Film | null;
  /** Which backend is playing: the museum's own files, or YouTube's embed player. */
  readonly provider: 'local' | 'youtube' | null;
  readonly currentTime: number;
  readonly duration: number;
  readonly captionsAvailable: boolean;
  readonly captionsOn: boolean;
  readonly captionText: string;
  readonly soundOn: boolean;
  /** Whether the visitor can turn sound on (a local film with a soundtrack, or any YouTube film). */
  readonly soundAvailable: boolean;
  readonly error: string | null;
  /** When the film can still be watched on the provider's own site (embedding refused, etc.). */
  readonly watchUrl: string | null;
}

export interface CinemaPlaybackOptions {
  /** Creates the one media element. Injected by tests; defaults to a detached <video>. */
  readonly createVideo?: () => HTMLVideoElement;
  readonly resolveUrl?: (path: string) => string;
  readonly createTexture?: (video: HTMLVideoElement) => THREE.Texture;
  /** Longest wait for a film to become playable before it is reported unavailable. */
  readonly loadTimeoutMs?: number;
}

/**
 * The cinema's film player: one lazily created video element and one video
 * texture, for whatever the programme selects. It owns no frame loop
 * (THREE.VideoTexture uploads frames as the browser decodes them, inside the
 * app's own render), never starts by itself, and starts every film muted:
 * sound is only ever turned on by the visitor, and only for a film that has a
 * soundtrack. `release()` stops decoding and frees the element and texture.
 */
export class CinemaPlayback {
  private video: HTMLVideoElement | null = null;
  private videoTexture: THREE.Texture | null = null;
  private track: HTMLTrackElement | null = null;
  private listeners: AbortController | null = null;
  private currentFilm: LocalFilm | null = null;
  private status: PlaybackState = 'empty';
  private errorMessage: string | null = null;
  private captionsWanted = true;
  private sound = false;
  private cue = '';
  private loadToken = 0;
  private readonly changeListeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  constructor(private readonly options: CinemaPlaybackOptions = {}) {}

  get state(): PlaybackState { return this.status; }
  get film(): LocalFilm | null { return this.currentFilm; }
  /** The texture the screen shows while a film is loaded; null otherwise. */
  get texture(): THREE.Texture | null { return this.videoTexture; }
  /** True while a media element exists (it is released when the visitor leaves). */
  get hasMediaElement(): boolean { return this.video !== null; }
  get element(): HTMLVideoElement | null { return this.video; }

  snapshot(): PlaybackSnapshot {
    const video = this.video;
    const duration = video && Number.isFinite(video.duration) && video.duration > 0
      ? video.duration : this.currentFilm?.media.durationSeconds ?? 0;
    return {
      state: this.status,
      film: this.currentFilm,
      provider: this.currentFilm ? 'local' : null,
      currentTime: video ? video.currentTime : 0,
      duration,
      captionsAvailable: Boolean(this.currentFilm?.captions),
      captionsOn: Boolean(this.currentFilm?.captions) && this.captionsWanted,
      captionText: this.captionsWanted ? this.cue : '',
      soundOn: this.sound,
      soundAvailable: Boolean(this.currentFilm?.media.hasAudio),
      error: this.errorMessage,
      watchUrl: null,
    };
  }

  onChange(fn: (snapshot: PlaybackSnapshot) => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  /**
   * Load a film without playing it. Resolves true once it is playable, false
   * if it could not be loaded (the reason is in the snapshot). A newer
   * `load` supersedes an older one still in flight.
   */
  async load(film: LocalFilm): Promise<boolean> {
    this.release();
    const token = ++this.loadToken;
    this.currentFilm = film;
    this.errorMessage = null;
    this.status = 'loading';
    this.emit();

    const video = (this.options.createVideo ?? defaultVideo)();
    this.video = video;
    this.listeners = new AbortController();
    const signal = this.listeners.signal;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = false;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');

    if (film.captions) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.srclang = film.captions.language;
      track.label = film.captions.label;
      track.src = this.resolve(film.captions.src);
      track.default = true;
      video.appendChild(track);
      this.track = track;
      // Cues are drawn by the museum's own caption line, not the browser's.
      track.addEventListener('load', () => { if (track.track) track.track.mode = 'hidden'; }, { signal });
      if (track.track) {
        track.track.mode = 'hidden';
        track.track.addEventListener('cuechange', () => {
          const cues = track.track.activeCues;
          const lines: string[] = [];
          for (let i = 0; cues && i < cues.length; i++) lines.push((cues[i] as VTTCue).text ?? '');
          this.cue = lines.join('\n');
          this.emit();
        }, { signal });
      }
    }

    video.addEventListener('playing', () => { this.status = 'playing'; this.emit(); }, { signal });
    video.addEventListener('pause', () => {
      if (this.status === 'playing') { this.status = video.ended ? 'ended' : 'paused'; this.emit(); }
    }, { signal });
    video.addEventListener('ended', () => { this.status = 'ended'; this.cue = ''; this.emit(); }, { signal });
    video.addEventListener('timeupdate', () => this.emit(), { signal });
    video.addEventListener('seeked', () => this.emit(), { signal });

    const ready = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), this.options.loadTimeoutMs ?? 20_000);
      const finish = (ok: boolean) => { clearTimeout(timeout); resolve(ok); };
      video.addEventListener('loadeddata', () => finish(true), { signal, once: true });
      video.addEventListener('error', () => finish(false), { signal, once: true });
      signal.addEventListener('abort', () => finish(false), { once: true });
    });
    video.src = this.resolve(film.media.src);
    video.load();
    const ok = await ready;
    if (token !== this.loadToken) return false; // superseded or released meanwhile
    if (!ok) {
      this.fail(describeMediaError(video));
      return false;
    }
    this.videoTexture = (this.options.createTexture ?? defaultTexture)(video);
    this.status = 'ready';
    this.emit();
    return true;
  }

  /** Start or resume. Only ever called from a visitor's action. */
  async play(): Promise<boolean> {
    const video = this.video;
    if (!video || this.status === 'loading' || this.status === 'error' || this.status === 'empty') return false;
    if (this.status === 'ended') video.currentTime = 0;
    video.muted = !this.sound;
    try {
      await video.play();
      this.status = 'playing';
      this.emit();
      return true;
    } catch (error) {
      // A browser can refuse play() (e.g. a policy it applies to this page).
      this.status = 'paused';
      this.errorMessage = `The browser would not start this film: ${error instanceof Error ? error.message : String(error)}`;
      this.emit();
      return false;
    }
  }

  pause(): void {
    if (!this.video || this.status !== 'playing') return;
    this.video.pause();
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

  /** Back to the first frame, keeping the current play/pause state. */
  restart(): void {
    if (!this.video || this.status === 'loading' || this.status === 'error' || this.status === 'empty') return;
    this.video.currentTime = 0;
    if (this.status === 'ended') this.status = 'paused';
    this.cue = '';
    this.emit();
  }

  seek(seconds: number): void {
    const video = this.video;
    if (!video || this.status === 'loading' || this.status === 'error' || this.status === 'empty') return;
    const duration = this.snapshot().duration;
    video.currentTime = Math.max(0, Math.min(duration > 0 ? duration : seconds, seconds));
    if (this.status === 'ended' && video.currentTime < duration) this.status = 'paused';
    this.emit();
  }

  skip(deltaSeconds: number): void {
    if (this.video) this.seek(this.video.currentTime + deltaSeconds);
  }

  setCaptions(on: boolean): void {
    this.captionsWanted = on;
    this.emit();
  }

  /** Sound is visitor-controlled and only exists for films with a soundtrack. */
  setSound(on: boolean): void {
    this.sound = on && Boolean(this.currentFilm?.media.hasAudio);
    if (this.video) this.video.muted = !this.sound;
    this.emit();
  }

  /** Stop decoding and free the element, its track and the texture. Safe to call repeatedly. */
  release(): void {
    this.loadToken++;
    this.listeners?.abort();
    this.listeners = null;
    const video = this.video;
    if (video) {
      video.pause();
      this.track?.remove();
      video.removeAttribute('src');
      video.load(); // drops the decoder and buffered media
    }
    this.track = null;
    this.video = null;
    this.videoTexture?.dispose();
    this.videoTexture = null;
    const hadFilm = this.currentFilm !== null || this.status !== 'empty';
    this.currentFilm = null;
    this.status = 'empty';
    this.errorMessage = null;
    this.cue = '';
    this.sound = false;
    if (hadFilm) this.emit();
  }

  dispose(): void {
    this.release();
    this.changeListeners.clear();
  }

  private fail(message: string): void {
    const film = this.currentFilm;
    this.listeners?.abort();
    this.listeners = null;
    if (this.video) {
      this.video.removeAttribute('src');
      this.video.load();
    }
    this.track = null;
    this.video = null;
    this.currentFilm = film;
    this.status = 'error';
    this.errorMessage = message;
    this.emit();
  }

  private resolve(path: string): string {
    return (this.options.resolveUrl ?? resolveMediaUrl)(path);
  }

  private emit(): void {
    if (this.changeListeners.size === 0) return;
    const snapshot = this.snapshot();
    for (const fn of this.changeListeners) fn(snapshot);
  }
}

function defaultVideo(): HTMLVideoElement {
  return document.createElement('video');
}

function defaultTexture(video: HTMLVideoElement): THREE.Texture {
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function describeMediaError(video: HTMLVideoElement): string {
  const code = video.error?.code;
  if (code === 4) return 'This film could not be played: the file is missing or its format is not supported here.';
  if (code === 2) return 'This film could not be loaded from the museum\'s files.';
  if (code === 3) return 'This film\'s file is damaged and could not be decoded.';
  return 'This film did not become playable. Its file may be missing.';
}
