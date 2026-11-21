import type * as THREE from 'three';
import { CinemaPlayback, type PlaybackSnapshot, type PlaybackState } from './CinemaPlayback';
import { YouTubePlayback } from './YouTubePlayback';
import type { Film } from './programme';

/**
 * The cinema's one playback interface over two backends: the museum's own
 * files (CinemaPlayback, a VideoTexture on the screen) and YouTube's official
 * embed player (YouTubePlayback, presented over the screen by ScreenOverlay).
 * Choosing a film releases whatever the other backend held, so switching
 * between providers never leaves a decoder or a player behind.
 *
 * YouTube is refused until the visitor has accepted the external-content
 * notice (`externalConsent`), whatever path asks for it.
 */
export class CinemaPlayer {
  readonly local: CinemaPlayback;
  readonly youtube: YouTubePlayback;
  /** Set only by the visitor accepting the notice for YouTube screenings. */
  externalConsent = false;
  private active: CinemaPlayback | YouTubePlayback;
  private consentError: { film: Film; message: string } | null = null;
  private readonly listeners = new Set<(snapshot: PlaybackSnapshot) => void>();

  constructor(local: CinemaPlayback, youtube: YouTubePlayback) {
    this.local = local;
    this.youtube = youtube;
    this.active = local;
    const forward = (from: CinemaPlayback | YouTubePlayback) => (snapshot: PlaybackSnapshot) => {
      if (from === this.active) for (const fn of this.listeners) fn(snapshot);
    };
    local.onChange(forward(local));
    youtube.onChange(forward(youtube));
  }

  get state(): PlaybackState { return this.consentError ? 'error' : this.active.state; }
  get film(): Film | null { return this.consentError?.film ?? this.active.film; }
  get provider(): 'local' | 'youtube' | null { return this.film ? this.film.kind : null; }
  /** The local backend's texture for the 3D screen (YouTube draws in the overlay instead). */
  get texture(): THREE.Texture | null { return this.active === this.local ? this.local.texture : null; }
  /** The local backend's media element, when it holds one. */
  get element(): HTMLVideoElement | null { return this.local.element; }
  /** True while either backend holds media (a video element or a YouTube player). */
  get hasMediaElement(): boolean { return this.local.hasMediaElement || this.youtube.hasPlayer; }

  snapshot(): PlaybackSnapshot {
    if (this.consentError) {
      return { ...this.youtube.snapshot(), state: 'error', film: this.consentError.film, provider: 'youtube', error: this.consentError.message };
    }
    return this.active.snapshot();
  }

  onChange(fn: (snapshot: PlaybackSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async load(film: Film): Promise<boolean> {
    this.consentError = null;
    if (film.kind === 'youtube') {
      this.local.release();
      this.active = this.youtube;
      if (!this.externalConsent) {
        this.youtube.release();
        this.consentError = { film, message: 'This screening plays from YouTube. Accept the external-content notice in the programme to watch it here.' };
        this.emit();
        return false;
      }
      return this.youtube.load(film);
    }
    this.youtube.release();
    this.active = this.local;
    return this.local.load(film);
  }

  play(): Promise<boolean> { return this.active.play(); }
  pause(): void { this.active.pause(); }
  toggle(): Promise<boolean> { return this.active.toggle(); }
  restart(): void { this.active.restart(); }
  seek(seconds: number): void { this.active.seek(seconds); }
  skip(seconds: number): void { this.active.skip(seconds); }
  setCaptions(on: boolean): void { this.active.setCaptions(on); }
  setSound(on: boolean): void { this.active.setSound(on); }

  /** From the frame loop (YouTube reports time by polling, not events). */
  tick(dt: number): void {
    if (this.active === this.youtube) this.youtube.tick(dt);
  }

  release(): void {
    const had = this.consentError !== null;
    this.consentError = null;
    this.local.release();
    this.youtube.release();
    this.active = this.local;
    if (had) this.emit();
  }

  dispose(): void {
    this.release();
    this.local.dispose();
    this.youtube.dispose();
    this.listeners.clear();
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const fn of this.listeners) fn(snapshot);
  }
}
