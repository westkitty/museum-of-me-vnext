import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { describeYouTubeError, parseYouTubeLink, thumbnailUrl, watchUrl } from '../src/cinema/youtube';
import { CINEMA_PROGRAMME, CINEMA_PROGRAMME_DATA, parseProgramme, parseYouTubeEntry, type YouTubeFilm } from '../src/cinema/programme';
import { CinemaDrafts, DRAFT_KEY, draftIdFor, newDraftEntry } from '../src/cinema/curatorDraft';
import { promoteDrafts, type OembedResult } from '../scripts/cinema-programme-plugin';
import { YouTubePlayback, type YTNamespace, type YTPlayer } from '../src/cinema/YouTubePlayback';
import { CinemaPlayback } from '../src/cinema/CinemaPlayback';
import { CinemaPlayer } from '../src/cinema/CinemaPlayer';
import { applyMatrix3d, quadMatrix3d } from '../src/cinema/ScreenOverlay';

/** YouTube screenings in the Museum Cinema (docs/MUSEUM_CINEMA_YOUTUBE_2026-11-21.md). */

const ID = 'f6hUqtFVgD8';

describe('YouTube links', () => {
  it.each([
    ['https://youtu.be/f6hUqtFVgD8'],
    ['https://www.youtube.com/watch?v=f6hUqtFVgD8'],
    ['https://youtube.com/watch?v=f6hUqtFVgD8'],
    ['https://www.youtube.com/embed/f6hUqtFVgD8'],
    ['https://m.youtube.com/watch?v=f6hUqtFVgD8&t=12s'],
    ['  https://youtu.be/f6hUqtFVgD8?si=abc123  '],
    ['http://youtu.be/f6hUqtFVgD8'],
    ['https://www.youtube.com/watch?feature=share&v=f6hUqtFVgD8'],
  ])('accepts %s and normalises it to the 11-character ID', (link) => {
    const result = parseYouTubeLink(link);
    expect(result).toEqual({ ok: true, videoId: ID, url: `https://youtu.be/${ID}` });
  });

  it('treats an unlisted video like any other: a valid ID is a valid link (unlisted is not private)', () => {
    // Nothing in a link says whether a video is listed; the parser never asks.
    expect(parseYouTubeLink('https://youtu.be/Ab_-9zZ0xYq').ok).toBe(true);
  });

  it.each([
    ['', 'Paste'],
    ['notalink', 'not a web link'],
    ['not a link', 'characters'],
    ['javascript:alert(1)', 'Only https'],
    ['data:text/html,hi', 'Only https'],
    ['ftp://youtu.be/f6hUqtFVgD8', 'Only https'],
    ['https://youtube.com.evil.example/watch?v=f6hUqtFVgD8', 'Only YouTube links'],
    ['https://evilyoutube.com/watch?v=f6hUqtFVgD8', 'Only YouTube links'],
    ['https://youtu.be.evil.example/f6hUqtFVgD8', 'Only YouTube links'],
    ['https://user:pass@www.youtube.com/watch?v=f6hUqtFVgD8', 'login or port'],
    ['https://www.youtube.com:8443/watch?v=f6hUqtFVgD8', 'login or port'],
    ['https://www.youtube.com/watch?v=f6hUqtFVgD8&v=AAAAAAAAAAA', 'single video'],
    ['https://www.youtube.com/watch', 'single video'],
    ['https://www.youtube.com/shorts/f6hUqtFVgD8', 'single video'],
    ['https://www.youtube.com/playlist?list=PL123', 'single video'],
    ['https://youtu.be/f6hUqtFVgD8/extra', 'single video'],
    ['https://youtu.be/short', 'valid YouTube video ID'],
    ['https://youtu.be/f6hUqtFVgD8X', 'valid YouTube video ID'],
    ['https://youtu.be/f6hUq%3CtFVg', 'valid YouTube video ID'],
    ['https://youtu.be/f6hUqtFVgD8"><script>', 'characters'],
    [`https://youtu.be/${'a'.repeat(400)}`, 'too long'],
  ])('refuses %s', (link, reason) => {
    const result = parseYouTubeLink(link);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(reason);
  });

  it('builds only YouTube addresses from a validated ID', () => {
    expect(watchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    expect(describeYouTubeError(150).watchOnYouTube).toBe(true);
    expect(describeYouTubeError(100).message).toMatch(/removed or made private/);
  });
});

describe('the cinema programme', () => {
  it('keeps the eight local films, valid and in their original order, then the YouTube screening', () => {
    expect(CINEMA_PROGRAMME.rejected).toEqual([]);
    const local = CINEMA_PROGRAMME.films.filter((f) => f.kind === 'local');
    expect(local.map((f) => f.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `full-weasel-loop-${n}`));
    expect(CINEMA_PROGRAMME.films.slice(0, 8).every((f) => f.kind === 'local')).toBe(true);
  });

  it('lists the exact video the owner added, with its verified title and an honest status', () => {
    const youtube = CINEMA_PROGRAMME.films.filter((f): f is YouTubeFilm => f.kind === 'youtube');
    expect(youtube).toHaveLength(1);
    const film = youtube[0];
    expect(CINEMA_PROGRAMME.films.indexOf(film)).toBe(8);
    expect(film.youtube.videoId).toBe(ID);
    expect(film.youtube.submittedUrl).toBe('https://youtu.be/f6hUqtFVgD8');
    expect(film.youtube.canonicalUrl).toBe('https://youtu.be/f6hUqtFVgD8');
    expect(film.title).toBe('the first dirt demo');
    expect(film.youtube.titleSource).toBe('youtube-oembed');
    expect(film.youtube.author).toEqual({ name: 'DigitalGhost', url: 'https://www.youtube.com/@DigitalGhost269' });
    expect(film.youtube.durationSeconds).toBe(51);
    expect(film.youtube.durationSource).toMatch(/getDuration/);
    // Not claimed playable: picture playback was not confirmed (see the note).
    expect(film.youtube.availability).toBe('unverified');
    expect(film.youtube.availabilityNote).toMatch(/not yet confirmed/i);
    expect(film.draft).toBe(false);
  });

  it('validates each source by its own rules', () => {
    const base = { id: 'yt-one', source: 'youtube', title: 'T', youtube: { videoId: ID, submittedUrl: `https://youtu.be/${ID}`, titleSource: 'provisional', availability: 'unverified' } };
    expect('film' in parseYouTubeEntry(base)).toBe(true);
    const bad = (over: Record<string, unknown>, yt: Record<string, unknown> = {}) => {
      const result = parseYouTubeEntry({ ...base, ...over, youtube: { ...base.youtube, ...yt } });
      return 'reason' in result ? result.reason : null;
    };
    expect(bad({}, { videoId: 'AAAAAAAAAAA' })).toMatch(/does not match/);
    expect(bad({}, { submittedUrl: 'https://vimeo.com/123' })).toMatch(/refused/);
    expect(bad({ id: 'Bad ID' })).toMatch(/programme id/);
    expect(bad({}, { titleSource: 'guessed' })).toMatch(/titleSource/);
    expect(bad({}, { availability: 'maybe' })).toMatch(/availability/);
    expect(bad({}, { durationSeconds: 60 })).toMatch(/where it was verified/);
    expect(bad({}, { author: { name: 'x', url: 'https://evil.example/@x' } })).toMatch(/channel/);
    expect(bad({ description: 'x'.repeat(601) })).toMatch(/plain text/);
    // The thumbnail is always rebuilt from the ID, never taken from data.
    const withThumb = parseYouTubeEntry({ ...base, youtube: { ...base.youtube, thumbnail: 'https://evil.example/x.jpg' } });
    expect('film' in withThumb && withThumb.film.youtube.thumbnail).toBe(thumbnailUrl(ID));
    // A local entry cannot borrow YouTube's shape, nor a YouTube entry a file.
    const mixed = parseProgramme({ films: [
      { id: 'a', source: 'local', title: 'A', description: 'd', youtube: base.youtube },
      { id: 'b', source: 'youtube', title: 'B', media: { src: 'x.mp4', type: 'video/mp4', width: 1, height: 1, durationSeconds: 1 } },
      { id: 'c', title: 'C', description: 'd', media: { src: 'x.mp4', type: 'video/mp4', width: 1, height: 1, durationSeconds: 1 } },
    ] });
    expect(mixed.films).toEqual([]);
    expect(mixed.rejected.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('rejects the same video twice, and a draft of a published video', () => {
    const entry = (id: string) => ({ id, source: 'youtube', title: 'T', youtube: { videoId: ID, submittedUrl: `https://youtu.be/${ID}`, titleSource: 'provisional', availability: 'unverified' } });
    const twice = parseProgramme({ films: [entry('one'), entry('two')] });
    expect(twice.films.map((f) => f.id)).toEqual(['one']);
    expect(twice.rejected[0]).toEqual({ id: 'two', reason: `duplicate YouTube video ${ID}` });
    const drafted = parseProgramme({ films: [entry('one')] }, [entry('three')]);
    expect(drafted.rejected[0].reason).toMatch(/duplicate YouTube video/);
    // Drafts may only add YouTube videos, never local files.
    expect(parseProgramme({ films: [] }, [{ id: 'x', source: 'local' }]).rejected[0].reason).toMatch(/drafts may only add YouTube/);
  });
});

class MemoryStorage {
  readonly map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

describe('curator drafts (this browser only)', () => {
  const published = () => CINEMA_PROGRAMME_DATA;

  it('adds, edits, reorders and removes drafts, and keeps them across a reload', () => {
    const storage = new MemoryStorage();
    const drafts = new CinemaDrafts(storage, published);
    expect(drafts.add('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ ok: true });
    expect(drafts.add('https://www.youtube.com/watch?v=M7lc1UVf-VE')).toMatchObject({ ok: true });
    expect(drafts.list.map((d) => (d.youtube as { videoId: string }).videoId)).toEqual(['dQw4w9WgXcQ', 'M7lc1UVf-VE']);
    const [first, second] = drafts.list;
    expect(first.title).toBe('YouTube video dQw4w9WgXcQ');
    expect((first.youtube as { titleSource: string }).titleSource).toBe('provisional');

    expect(drafts.update(first.id, { title: 'A fallback title', description: 'Why it is here.' })).toBeNull();
    expect((drafts.list[0].youtube as { titleSource: string }).titleSource).toBe('curator');
    expect(drafts.update(first.id, { title: '' })).toMatch(/missing title/);

    drafts.move(second.id, -1);
    expect(drafts.list.map((d) => d.id)).toEqual([second.id, first.id]);
    drafts.move(second.id, -1); // already first: unchanged
    expect(drafts.list[0].id).toBe(second.id);

    const reloaded = new CinemaDrafts(storage, published);
    expect(reloaded.list.map((d) => d.id)).toEqual([second.id, first.id]);
    expect(reloaded.list[1].title).toBe('A fallback title');
    // Drafts join this browser's programme after the published films, marked as drafts.
    const programme = reloaded.programme();
    expect(programme.films.slice(0, 9)).toEqual(CINEMA_PROGRAMME.films);
    expect(programme.films.slice(9).every((f) => f.kind === 'youtube' && f.draft)).toBe(true);

    reloaded.remove(second.id);
    reloaded.remove(first.id);
    expect(reloaded.list).toEqual([]);
    expect(storage.map.has(DRAFT_KEY)).toBe(false);
  });

  it('refuses invalid links, published duplicates and draft duplicates', () => {
    const drafts = new CinemaDrafts(new MemoryStorage(), published);
    expect(drafts.add('https://evil.example/watch?v=dQw4w9WgXcQ')).toMatchObject({ ok: false });
    expect(drafts.add('https://youtu.be/f6hUqtFVgD8')).toEqual({ ok: false, reason: 'That video is already in the published programme.' });
    drafts.add('https://youtu.be/dQw4w9WgXcQ');
    expect(drafts.add('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({ ok: false, reason: 'That video is already in your drafts.' });
  });

  it('ignores tampered storage instead of trusting it', () => {
    const storage = new MemoryStorage();
    storage.setItem(DRAFT_KEY, JSON.stringify([{ id: 'x', source: 'local', media: { src: '../../etc' } }, newDraftEntry('dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ')]));
    const drafts = new CinemaDrafts(storage, published);
    expect(drafts.list).toHaveLength(1);
    expect(drafts.loadNote).toMatch(/invalid/);
    storage.setItem(DRAFT_KEY, '{not json');
    expect(new CinemaDrafts(storage, published).list).toEqual([]);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => undefined, removeItem: () => undefined };
    expect(new CinemaDrafts(throwing, published).loadNote).toMatch(/storage unavailable/);
  });

  it('exports the whole programme file with drafts after the published films, and imports it back', () => {
    const drafts = new CinemaDrafts(new MemoryStorage(), published);
    drafts.add('https://youtu.be/dQw4w9WgXcQ');
    const exported = JSON.parse(drafts.exportProgramme()) as { films: { id: string }[] };
    expect(exported.films.slice(0, 9)).toEqual((CINEMA_PROGRAMME_DATA as { films: unknown[] }).films);
    expect(exported.films[9].id).toBe(draftIdFor('dQw4w9WgXcQ'));
    expect(parseProgramme(exported).rejected).toEqual([]);

    const fresh = new CinemaDrafts(new MemoryStorage(), published);
    // The published screening is reported as already listed, never duplicated.
    expect(fresh.importText(JSON.stringify(exported))).toEqual({ added: 1, skipped: ['youtube-the-first-dirt-demo: already listed'] });
    expect(fresh.importText(JSON.stringify(exported)).added).toBe(0);
    expect(fresh.importText('nope').skipped[0]).toMatch(/not valid JSON/);
    expect(fresh.importText(JSON.stringify([{ id: 'bad id', source: 'youtube' }])).skipped[0]).toMatch(/programme id/);
  });

  it('draft IDs are valid programme IDs and distinct for IDs differing only in case', () => {
    expect(draftIdFor('Ab_-9zZ0xYq')).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(draftIdFor('AAAAAAAAAAA')).not.toBe(draftIdFor('aaaaaaaaaaa'));
  });
});

describe('promoting drafts into the version-controlled programme (development server)', () => {
  const current = JSON.parse(JSON.stringify(CINEMA_PROGRAMME_DATA)) as { films: unknown[] } & Record<string, unknown>;
  const draft = newDraftEntry('dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', '2026-11-21');
  const lookup = (result: OembedResult) => async () => result;

  it('appends after the published films, taking YouTube\'s own title and channel', async () => {
    const result = await promoteDrafts(current, [draft], lookup({ status: 'ok', title: 'Real title', authorName: 'Someone', authorUrl: 'https://www.youtube.com/@someone' }), '2026-11-21');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const films = (result.programme as { films: Record<string, unknown>[] }).films;
    expect(films.slice(0, 9)).toEqual(current.films);
    expect(films[9]).toMatchObject({ id: draft.id, title: 'Real title', youtube: { titleSource: 'youtube-oembed', author: { name: 'Someone' }, availability: 'unverified' } });
  });

  it('keeps a curator\'s title, and records refusals honestly', async () => {
    const curated = { ...draft, title: 'Mine', youtube: { ...(draft.youtube as object), titleSource: 'curator' } };
    const kept = await promoteDrafts(current, [curated], lookup({ status: 'ok', title: 'YouTube title' }));
    expect(kept.ok && (kept.programme as { films: { title: string }[] }).films[9].title).toBe('Mine');
    const blocked = await promoteDrafts(current, [draft], lookup({ status: 'not-embeddable' }), '2026-11-21');
    expect(blocked.ok && (blocked.programme as { films: { youtube: { availability: string; availabilityNote: string } }[] }).films[9].youtube)
      .toMatchObject({ availability: 'unavailable', availabilityNote: expect.stringMatching(/does not allow embedding/) });
    const missing = await promoteDrafts(current, [draft], lookup({ status: 'not-found' }));
    expect(missing.ok && (missing.programme as { films: { youtube: { availability: string } }[] }).films[9].youtube.availability).toBe('unavailable');
  });

  it('refuses duplicates, local entries and empty requests', async () => {
    const dup = await promoteDrafts(current, [newDraftEntry(ID, `https://youtu.be/${ID}`)], lookup({ status: 'ok' }));
    expect(dup).toMatchObject({ ok: false, errors: [expect.stringMatching(/already in the programme/)] });
    expect(await promoteDrafts(current, [{ id: 'x', source: 'local' }], lookup({ status: 'ok' }))).toMatchObject({ ok: false });
    expect(await promoteDrafts(current, [], lookup({ status: 'ok' }))).toMatchObject({ ok: false });
  });
});

/** A stand-in for YouTube's IFrame Player API (unit tests only: proves the museum's handling, not YouTube). */
function fakeYouTube(script: { error?: number; noReady?: boolean } = {}) {
  const players: FakePlayer[] = [];
  class FakePlayer implements YTPlayer {
    time = 0; muted = false; destroyed = false; plays = 0;
    readonly events: { onReady?: (e: { target: YTPlayer }) => void; onStateChange?: (e: { data: number; target: YTPlayer }) => void; onError?: (e: { data: number; target: YTPlayer }) => void };
    constructor(readonly element: unknown, readonly options: { videoId: string; host?: string; playerVars?: Record<string, unknown>; events?: FakePlayer['events'] }) {
      this.events = options.events ?? {};
      players.push(this);
      queueMicrotask(() => {
        if (script.error !== undefined) this.events.onError?.({ data: script.error, target: this });
        else if (!script.noReady) this.events.onReady?.({ target: this });
      });
    }
    playVideo() { this.plays++; this.events.onStateChange?.({ data: 1, target: this }); }
    pauseVideo() { this.events.onStateChange?.({ data: 2, target: this }); }
    seekTo(s: number) { this.time = s; }
    getCurrentTime() { return this.time; }
    getDuration() { return 51; }
    mute() { this.muted = true; }
    unMute() { this.muted = false; }
    destroy() { this.destroyed = true; }
    getVideoData() { return { title: 'the first dirt demo' }; }
  }
  let apiLoads = 0;
  const api: YTNamespace = { Player: FakePlayer as unknown as YTNamespace['Player'] };
  const mount = { appendChild: () => undefined } as unknown as HTMLElement;
  const holder = () => ({ className: '', remove() {} });
  return { players, api, mount, holder, loads: () => apiLoads, loadApi: async () => { apiLoads++; return api; } };
}

const film = CINEMA_PROGRAMME.films.find((f): f is YouTubeFilm => f.kind === 'youtube')!;

function youtubePlayback(fake = fakeYouTube(), extra: Partial<ConstructorParameters<typeof YouTubePlayback>[0]> = {}) {
  return new YouTubePlayback({
    mount: () => fake.mount, loadApi: fake.loadApi, createHolder: () => fake.holder() as unknown as HTMLElement,
    isFileProtocol: () => false, online: () => true, origin: () => 'https://museum.example', readyTimeoutMs: 200, ...extra,
  });
}

describe('YouTubePlayback (official IFrame API, faked here)', () => {
  it('loads muted and paused through the privacy-enhanced host; plays only when asked', async () => {
    const fake = fakeYouTube();
    const yt = youtubePlayback(fake);
    expect(await yt.load(film)).toBe(true);
    expect(yt.state).toBe('ready');
    const player = fake.players[0];
    expect(player.options.videoId).toBe(ID);
    expect(player.options.host).toBe('https://www.youtube-nocookie.com');
    expect(player.options.playerVars).toMatchObject({ autoplay: 0, playsinline: 1, origin: 'https://museum.example' });
    expect(player.muted).toBe(true);
    expect(player.plays).toBe(0);
    expect(yt.snapshot()).toMatchObject({ provider: 'youtube', duration: 51, soundOn: false, soundAvailable: true, captionsAvailable: false });
    expect(yt.playerTitle).toBe('the first dirt demo');
  });

  it('plays, pauses, resumes, seeks, skips, restarts and turns sound on only when asked', async () => {
    const fake = fakeYouTube();
    const yt = youtubePlayback(fake);
    await yt.load(film);
    const player = fake.players[0];
    await yt.play();
    expect(yt.state).toBe('playing');
    yt.pause();
    expect(yt.state).toBe('paused');
    await yt.toggle();
    expect(yt.state).toBe('playing');
    yt.seek(30);
    expect(player.time).toBe(30);
    yt.skip(5);
    expect(player.time).toBe(35);
    yt.seek(999);
    expect(player.time).toBe(51);
    yt.restart();
    expect(player.time).toBe(0);
    yt.setSound(true);
    expect(player.muted).toBe(false);
    player.time = 12;
    yt.tick(0.3);
    expect(yt.snapshot().currentTime).toBe(12);
  });

  it('turns YouTube errors into honest messages with a Watch on YouTube fallback, and frees the player', async () => {
    const fake = fakeYouTube({ error: 150 });
    const yt = youtubePlayback(fake);
    expect(await yt.load(film)).toBe(false);
    expect(yt.state).toBe('error');
    expect(yt.errorCode).toBe(150);
    expect(yt.snapshot().error).toMatch(/turned off embedding, or YouTube declined.*\(YouTube error 150\)/);
    expect(yt.snapshot().watchUrl).toBe(watchUrl(ID));
    expect(fake.players[0].destroyed).toBe(true);
    expect(yt.hasPlayer).toBe(false);

    const gone = youtubePlayback(fakeYouTube({ error: 100 }));
    await gone.load(film);
    expect(gone.snapshot()).toMatchObject({ watchUrl: null, error: expect.stringMatching(/removed or made private/) });
  });

  it('reports a slow player, an unreachable YouTube, offline devices and file:// copies without loading anything', async () => {
    const slow = youtubePlayback(fakeYouTube({ noReady: true }));
    expect(await slow.load(film)).toBe(false);
    expect(slow.snapshot().error).toMatch(/did not become ready/);

    const unreachable = youtubePlayback(fakeYouTube(), { loadApi: async () => { throw new Error('script blocked or unreachable'); } });
    expect(await unreachable.load(film)).toBe(false);
    expect(unreachable.snapshot().error).toMatch(/could not be loaded \(script blocked/);

    const offlineFake = fakeYouTube();
    const offline = youtubePlayback(offlineFake, { online: () => false });
    expect(await offline.load(film)).toBe(false);
    expect(offline.snapshot().error).toMatch(/offline/);
    expect(offlineFake.loads()).toBe(0);

    const fileFake = fakeYouTube();
    const file = youtubePlayback(fileFake, { isFileProtocol: () => true });
    expect(await file.load(film)).toBe(false);
    expect(file.snapshot().error).toMatch(/hosted, online museum/);
    expect(fileFake.loads()).toBe(0);
  });

  it('a newer load or a release beats a stale answer: no old player comes back', async () => {
    const fake = fakeYouTube();
    const yt = youtubePlayback(fake);
    const first = yt.load(film);
    yt.release();
    expect(await first).toBe(false);
    expect(yt.state).toBe('empty');
    expect(fake.players.every((p) => p.destroyed || !p)).toBe(true);
  });

  it('notices a held start and tells the visitor to press Play again', async () => {
    const fake = fakeYouTube();
    const yt = youtubePlayback(fake, { playStallSeconds: 1 });
    await yt.load(film);
    fake.players[0].playVideo = () => undefined; // the browser holds playback
    await yt.play();
    yt.tick(0.6);
    yt.tick(0.6);
    expect(yt.state).toBe('paused');
    expect(yt.snapshot().error).toMatch(/Press Play to try again/);
  });
});

describe('CinemaPlayer: one interface over both providers', () => {
  function player() {
    const fake = fakeYouTube();
    const local = new CinemaPlayback({
      createVideo: () => { throw new Error('no local video in this test'); },
    });
    return { fake, cinema: new CinemaPlayer(local, youtubePlayback(fake)) };
  }

  it('refuses YouTube until the visitor accepts the notice, without loading anything', async () => {
    const { fake, cinema } = player();
    expect(await cinema.load(film)).toBe(false);
    expect(cinema.state).toBe('error');
    expect(cinema.snapshot().error).toMatch(/Accept the external-content notice/);
    expect(fake.loads()).toBe(0);
    cinema.externalConsent = true;
    expect(await cinema.load(film)).toBe(true);
    expect(cinema.provider).toBe('youtube');
    expect(fake.loads()).toBe(1);
  });

  it('switching providers or releasing destroys the YouTube player; repeated sessions leave none behind', async () => {
    const { fake, cinema } = player();
    cinema.externalConsent = true;
    for (let i = 0; i < 5; i++) {
      await cinema.load(film);
      await cinema.play();
      cinema.release();
    }
    expect(fake.players).toHaveLength(5);
    expect(fake.players.every((p) => p.destroyed)).toBe(true);
    expect(cinema.hasMediaElement).toBe(false);
    expect(cinema.state).toBe('empty');

    await cinema.load(film);
    expect(cinema.youtube.hasPlayer).toBe(true);
    // Choosing a local film releases YouTube first, even if the local load then fails.
    const local = CINEMA_PROGRAMME.films[0];
    await cinema.load(local).catch(() => undefined);
    expect(cinema.youtube.hasPlayer).toBe(false);
    expect(fake.players.at(-1)!.destroyed).toBe(true);
    expect(cinema.provider).toBe('local');
    expect(cinema.texture).toBeNull();
  });
});

describe('ScreenOverlay geometry', () => {
  it('maps the player\'s corners exactly onto any projected screen quadrilateral', () => {
    const quads: [number, number][][] = [
      [[100, 80], [900, 60], [880, 520], [120, 500]], // perspective, from a side seat
      [[0, 0], [1280, 0], [1280, 720], [0, 720]], // square-on, full viewport
      [[300, 200], [700, 230], [690, 430], [310, 410]],
    ];
    for (const quad of quads) {
      const m = quadMatrix3d(1280, 720, quad as never)!;
      expect(m).toMatch(/^matrix3d\(/);
      const corners: [number, number][] = [[0, 0], [1280, 0], [1280, 720], [0, 720]];
      corners.forEach(([x, y], i) => {
        const [px, py] = applyMatrix3d(m, x, y);
        expect(px).toBeCloseTo(quad[i][0], 3);
        expect(py).toBeCloseTo(quad[i][1], 3);
      });
    }
    expect(quadMatrix3d(1280, 720, [[0, 0], [0, 0], [0, 0], [0, 0]])).toBeNull();
  });

  it('a screen plane seen by a camera projects to a convex quad in front of it', () => {
    const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 500);
    camera.position.set(45, 15.5, 6.7);
    camera.lookAt(27.3, 16, 12.4);
    camera.updateMatrixWorld();
    const plane = new THREE.Object3D();
    plane.position.set(27.3, 16.06, 12.4);
    plane.rotation.y = Math.PI / 2;
    plane.scale.set(13, 13 * 9 / 16, 1);
    plane.updateMatrixWorld();
    const pts = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map(([u, v]) => new THREE.Vector3(u, v, 0).applyMatrix4(plane.matrixWorld).project(camera));
    for (const p of pts) expect(Math.abs(p.z)).toBeLessThan(1);
    // Top-left is left of top-right and above bottom-left on screen.
    expect(pts[0].x).toBeLessThan(pts[1].x);
    expect(pts[0].y).toBeGreaterThan(pts[3].y);
  });
});

describe('the venue says so when a provider refuses after start', () => {
  it('announces the refusal and marks the film, instead of leaving "Starting…" standing', async () => {
    const { CinemaVenue } = await import('../src/cinema/CinemaVenue');
    const { buildMuseum } = await import('./helpers/walk');
    const room = buildMuseum().museum.cinema!;
    const announcements: string[] = [];
    const unavailable: string[] = [];
    const fake = fakeYouTube();
    const youtube = youtubePlayback(fake);
    const cinema = new CinemaPlayer(new CinemaPlayback({ createVideo: () => { throw new Error('unused'); } }), youtube);
    cinema.externalConsent = true;
    const venue = new CinemaVenue({
      interaction: { register: () => () => undefined },
      player: { position: new THREE.Vector3(), isSeated: false, isFrozen: false, flightMode: false, pitch: 0, sit: () => true, stand: () => true },
      input: { isDown: () => false },
      reducedMotion: () => false,
      announce: (m) => announcements.push(m),
      openProgramme: () => undefined,
      console: null,
      filmUnavailable: (id) => unavailable.push(id),
    }, room, CINEMA_PROGRAMME, cinema);
    expect(await venue.choose(film.id)).toBe(true);
    expect(announcements.at(-1)).toMatch(/^Starting the first dirt demo from YouTube/);
    // YouTube refuses once playback is requested.
    fake.players[0].events.onError?.({ data: 150, target: fake.players[0] });
    expect(announcements.at(-1)).toMatch(/^the first dirt demo stopped\. .*YouTube error 150.*watch it on YouTube/);
    expect(unavailable).toEqual([film.id]);
    expect(youtube.hasPlayer).toBe(false);
    venue.dispose();
  });
});
