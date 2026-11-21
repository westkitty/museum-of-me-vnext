import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CinemaPlayback } from '../src/cinema/CinemaPlayback';
import { CinemaPlayer } from '../src/cinema/CinemaPlayer';
import { YouTubePlayback } from '../src/cinema/YouTubePlayback';
import { CinemaVenue, type CinemaHost } from '../src/cinema/CinemaVenue';
import { CINEMA_PROGRAMME, type LocalFilm } from '../src/cinema/programme';
import { CINEMA_SEATS, SCREEN, SEATED_EYE_HEIGHT } from '../src/world/cinemaLayout';
import { buildMuseum } from './helpers/walk';

/** A media element stand-in with the behaviour the player relies on. */
class FakeVideo extends EventTarget {
  src = '';
  muted = false;
  defaultMuted = false;
  playsInline = false;
  preload = '';
  loop = false;
  currentTime = 0;
  duration = NaN;
  paused = true;
  ended = false;
  error: { code: number } | null = null;
  plays = 0;
  loads = 0;
  readonly attributes = new Map<string, string>();
  constructor(private readonly behaviour: 'ok' | 'missing' | 'refuse' = 'ok') { super(); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
  appendChild() { /* no captions in these tests */ }
  load() {
    this.loads++;
    if (!this.src) return;
    queueMicrotask(() => {
      if (this.behaviour === 'missing') {
        this.error = { code: 4 };
        this.dispatchEvent(new Event('error'));
        return;
      }
      this.duration = 6.04;
      this.dispatchEvent(new Event('loadeddata'));
    });
  }
  async play() {
    if (this.behaviour === 'refuse') throw new Error('NotAllowedError');
    this.plays++;
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  finish() { this.currentTime = this.duration; this.ended = true; this.paused = true; this.dispatchEvent(new Event('ended')); }
}

const LOCAL = CINEMA_PROGRAMME.films.filter((f): f is LocalFilm => f.kind === 'local');
const film: LocalFilm = LOCAL[0];

function player(behaviour: 'ok' | 'missing' | 'refuse' = 'ok') {
  const videos: FakeVideo[] = [];
  const textures: THREE.Texture[] = [];
  const playback = new CinemaPlayback({
    createVideo: () => { const v = new FakeVideo(behaviour); videos.push(v); return v as unknown as HTMLVideoElement; },
    resolveUrl: (path) => `http://museum.test/${path}`,
    createTexture: () => { const t = new THREE.Texture(); textures.push(t); return t; },
    loadTimeoutMs: 500,
  });
  return { playback, videos, textures };
}

describe('CinemaPlayback', () => {
  it('loads without playing, muted, from the local programme path', async () => {
    const { playback, videos } = player();
    expect(await playback.load(film)).toBe(true);
    expect(playback.state).toBe('ready');
    expect(videos[0].plays).toBe(0); // no autoplay
    expect(videos[0].muted).toBe(true);
    expect(videos[0].src).toBe(`http://museum.test/${film.media.src}`);
    expect(playback.texture).not.toBeNull();
  });

  it('plays, pauses, resumes, seeks, skips, restarts and ends', async () => {
    const { playback, videos } = player();
    await playback.load(film);
    expect(await playback.play()).toBe(true);
    expect(playback.state).toBe('playing');
    expect(videos[0].muted).toBe(true); // a silent film is never unmuted
    playback.pause();
    expect(playback.state).toBe('paused');
    expect(await playback.toggle()).toBe(true);
    expect(playback.state).toBe('playing');
    playback.seek(4);
    expect(videos[0].currentTime).toBe(4);
    playback.skip(5);
    expect(videos[0].currentTime).toBeCloseTo(6.04);
    playback.skip(-10);
    expect(videos[0].currentTime).toBe(0);
    playback.seek(3);
    playback.restart();
    expect(videos[0].currentTime).toBe(0);
    videos[0].finish();
    expect(playback.state).toBe('ended');
    expect(await playback.play()).toBe(true); // play again from the start
    expect(videos[0].currentTime).toBe(0);
  });

  it('sound stays off for a silent film; captions are absent when the film has none', async () => {
    const { playback, videos } = player();
    await playback.load(film);
    playback.setSound(true);
    expect(playback.snapshot().soundOn).toBe(false);
    expect(videos[0].muted).toBe(true);
    expect(playback.snapshot().captionsAvailable).toBe(false);
  });

  it('sound is the visitor\'s choice for a film that has a soundtrack', async () => {
    const { playback, videos } = player();
    await playback.load({ ...film, media: { ...film.media, hasAudio: true } });
    await playback.play();
    expect(videos[0].muted).toBe(true);
    playback.setSound(true);
    expect(videos[0].muted).toBe(false);
  });

  it('a missing file fails gracefully with a reason and frees the element', async () => {
    const { playback, videos } = player('missing');
    expect(await playback.load(film)).toBe(false);
    expect(playback.state).toBe('error');
    expect(playback.snapshot().error).toMatch(/missing or its format is not supported/);
    expect(playback.hasMediaElement).toBe(false);
    expect(videos[0].src).toBe('');
    expect(await playback.play()).toBe(false);
  });

  it('a refused play() is reported, not thrown', async () => {
    const { playback } = player('refuse');
    await playback.load(film);
    expect(await playback.play()).toBe(false);
    expect(playback.state).toBe('paused');
    expect(playback.snapshot().error).toMatch(/would not start/);
  });

  it('release stops decoding and disposes the texture; a newer load supersedes an older one', async () => {
    const { playback, videos, textures } = player();
    await playback.load(film);
    await playback.play();
    let disposed = false;
    textures[0].addEventListener('dispose', () => { disposed = true; });
    playback.release();
    expect(videos[0].paused).toBe(true);
    expect(videos[0].src).toBe('');
    expect(disposed).toBe(true);
    expect(playback.state).toBe('empty');
    expect(playback.texture).toBeNull();

    const first = playback.load(film);
    const second = playback.load(LOCAL[1]);
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(playback.film?.id).toBe(LOCAL[1].id);
  });
});

describe('CinemaVenue', () => {
  const built = buildMuseum();
  const room = built.museum.cinema!;

  function venue(options: { reduced?: boolean } = {}) {
    const controls = new Map<string, { activate: () => void; label: string | (() => string) }>();
    const held = new Set<string>();
    const announcements: string[] = [];
    let programmeOpens = 0;
    const seat = { feet: null as number[] | null, eye: 0 };
    const playerState = {
      position: new THREE.Vector3(...CINEMA_SEATS[40].aisleSide),
      isSeated: false, isFrozen: false, flightMode: false, pitch: 0,
      sit(feet: number[], _yaw: number, eye: number) { seat.feet = feet; seat.eye = eye; this.isSeated = true; return true; },
      stand() { const was = this.isSeated; this.isSeated = false; return was; },
    };
    const host: CinemaHost = {
      interaction: { register: (id, control) => { controls.set(id, control); return () => controls.delete(id); } },
      player: playerState as never,
      input: { isDown: (a) => held.has(a) },
      reducedMotion: () => Boolean(options.reduced),
      announce: (m) => announcements.push(m),
      openProgramme: () => { programmeOpens++; },
      console: null,
      filmUnavailable: () => undefined,
    };
    const { playback, videos } = player();
    const v = new CinemaVenue(host, room, CINEMA_PROGRAMME, new CinemaPlayer(playback, new YouTubePlayback({ mount: () => { throw new Error('no DOM in unit tests'); } })));
    return { v, controls, held, announcements, seat, playerState, playback, videos, get programmeOpens() { return programmeOpens; } };
  }

  it('registers seats, accessible positions and the programme board with the interaction system', () => {
    const { controls } = venue();
    expect([...controls.keys()].sort()).toEqual(['cinema-accessible', 'cinema-programme', 'cinema-seats:north', 'cinema-seats:south']);
  });

  it('sitting takes the seat nearest the visitor, faces the screen, opens the programme; moving stands up', () => {
    const t = venue();
    t.controls.get('cinema-seats:north')!.activate();
    expect(t.seat.feet).toEqual([...CINEMA_SEATS[40].position]);
    expect(t.seat.eye).toBe(SEATED_EYE_HEIGHT);
    expect(t.v.seated).toBe(`seat ${CINEMA_SEATS[40].label}`);
    expect(t.programmeOpens).toBe(1);
    expect(t.playerState.pitch).toBeGreaterThan(0); // looking up at the screen centre
    t.held.add('forward');
    t.v.update(1 / 60, 'cinema', true);
    expect(t.v.seated).toBeNull();
    expect(t.playerState.isSeated).toBe(false);
  });

  it('keys belong to the cinema only while seated', async () => {
    const t = venue();
    expect(t.v.handleKey('Space', true, false)).toBe(false);
    t.controls.get('cinema-seats:north')!.activate();
    await t.v.choose(CINEMA_PROGRAMME.films[0].id);
    expect(t.playback.state).toBe('playing');
    expect(t.v.handleKey('Space', true, false)).toBe(true);
    expect(t.playback.state).toBe('paused');
    expect(t.v.handleKey('KeyW', true, false)).toBe(false); // movement is never captured
    expect(t.v.handleKey('KeyX', true, false)).toBe(true);
    expect(t.v.seated).toBeNull();
  });

  it('house lights fall while a film plays and rise when it stops; reduced motion changes them at once', async () => {
    const t = venue();
    await t.v.choose(CINEMA_PROGRAMME.films[0].id);
    t.v.update(0.5, 'cinema', true);
    expect(t.v.houseLightLevel).toBeGreaterThan(0.5);
    expect(t.v.houseLightLevel).toBeLessThan(1);
    for (let i = 0; i < 60; i++) t.v.update(0.1, 'cinema', true);
    expect(t.v.houseLightLevel).toBe(0);
    expect(room.beam.visible).toBe(true);
    t.playback.pause();
    for (let i = 0; i < 60; i++) t.v.update(0.1, 'cinema', true);
    expect(t.v.houseLightLevel).toBeCloseTo(0.45);

    const reduced = venue({ reduced: true });
    await reduced.v.choose(CINEMA_PROGRAMME.films[0].id);
    reduced.v.update(1 / 60, 'cinema', true);
    expect(reduced.v.houseLightLevel).toBe(0);
  });

  it('the screen shows the film masked to its own shape, and the programme slide otherwise', async () => {
    const t = venue();
    expect(room.pictureMaterial.map).toBe(room.idleTexture);
    await t.v.choose(CINEMA_PROGRAMME.films[0].id);
    const media = LOCAL[0].media;
    expect(room.pictureMaterial.map).toBe(t.playback.texture);
    expect(room.picture.scale.y).toBeCloseTo(SCREEN.height);
    expect(room.picture.scale.x).toBeCloseTo(SCREEN.height * media.width / media.height);
    t.v.leave();
    expect(room.pictureMaterial.map).toBe(room.idleTexture);
    expect(room.picture.scale.x).toBeCloseTo(SCREEN.width);
  });

  it('leaving the cinema stands the visitor up, stops the film and releases its media', async () => {
    const t = venue();
    t.v.update(1 / 60, 'cinema', true);
    t.controls.get('cinema-seats:south')!.activate();
    await t.v.choose(CINEMA_PROGRAMME.films[0].id);
    expect(t.playback.hasMediaElement).toBe(true);
    t.v.update(1 / 60, 'balcony', true);
    expect(t.v.seated).toBeNull();
    expect(t.playback.hasMediaElement).toBe(false);
    expect(t.playback.state).toBe('empty');
    expect(t.videos[0].src).toBe('');
  });

  it('dispose unregisters every control', () => {
    const t = venue();
    t.v.dispose();
    expect(t.controls.size).toBe(0);
  });
});
