# YouTube screenings in the Museum Cinema (2026-11-21)

Base: `main` at `eb03d1a` (PR #68). This is local work only: nothing has been committed, pushed, merged or deployed.

**Owner authorisation:** the 2026-11-21 task, including the unlisted link `https://youtu.be/f6hUqtFVgD8` "explicitly authorized for inclusion".

## What it does

**Programme.** The cinema's programme now holds two kinds of entry, told apart by `source`:
- **`local`:** the eight Full Weasel films. They are unchanged, in their original order, and keep every existing check (relative path, SHA-256, metadata, captions).
- **`youtube`:** an explicitly chosen online exception. Each entry stores:
  - its programme ID and canonical video ID;
  - the submitted link;
  - its title and where the title came from (YouTube oEmbed, a curator, or provisional);
  - the channel, when verified;
  - its duration, only when YouTube's player reported it;
  - an availability status (`embeddable`, `unverified` or `unavailable`) with a dated note;
  - a provider label ("YouTube · external, online only").

**Link validation.** YouTube links are normalised to the 11-character ID. Accepted forms are `youtu.be/ID`, `youtube.com/watch?v=ID` (with or without `www.`, or `m.`) and `youtube.com/embed/ID`.

Refused:
- other hosts and look-alikes;
- credentials and ports;
- other paths (shorts, playlists);
- repeated `v` parameters;
- malformed IDs;
- odd characters;
- over-long input;
- duplicates.

**Unlisted videos.** They are not special: anyone with the link can watch them, so they are accepted. A link listed in this public programme is public, and the museum says so.

## Watching inside the theater

A YouTube video cannot be a `THREE.VideoTexture`: its frames sit in a cross-origin iframe the page cannot read. So the museum uses YouTube's official IFrame Player API (privacy-enhanced host `www.youtube-nocookie.com`) and lays the player over the cinema screen.

**`ScreenOverlay`** sits on top of the 3D view and below every HUD element and panel:
- **Fit:** after each rendered frame, it projects the screen's four corners through the live camera and maps the player onto that quadrilateral with a CSS `matrix3d` homography.
- **What follows from that:** it tracks the seat, head turns, off-axis perspective, viewport size and resizing, with no second renderer and no extra loop.
- **Turning away:** it hides when any screen corner is behind the camera, and the film keeps playing.

**Input:**
- The player takes no pointer input by default, so mouse look and the museum's keys keep working.
- "YouTube controls" in the cinema console hands the pointer to YouTube's own controls (captions, quality).

**Limitation:** a browser iframe always draws above the WebGL canvas. Theater geometry (seat backs, heads) cannot pass in front of the picture, and the picture is not lit by the room. The museum's panels and controls do sit above it.

**Unified playback.** `CinemaPlayer` gives the venue and console one interface over two backends:
- `CinemaPlayback`: local files as a VideoTexture, unchanged.
- `YouTubePlayback`: the IFrame API.

It supports select, load, play, pause, resume, seek, skip, restart, state, duration, errors, sound and release.
- Choosing a film releases the other backend, so switching providers leaves nothing behind.
- YouTube films start muted; Sound unmutes them on the visitor's click.
- Captions belong to YouTube (through its controls). The museum's CC button is hidden for YouTube rather than promising a capability it does not have.
- YouTube time is polled from the museum's existing frame loop at about 4 Hz.

## Privacy and lifecycle

**Nothing loads early.** No YouTube script, thumbnail, iframe or media is requested on arrival, on entering the cinema, or on opening the programme. The programme shows a local "YouTube" card instead of the thumbnail.

**Consent.** Choosing a YouTube screening first shows a notice:
- what loads, and that it connects to YouTube and Google;
- that it works only online;
- that local films are unaffected;
- "Watch from YouTube", "Back", and "Open on YouTube instead".

The answer lasts for the visit (`sessionStorage`). `CinemaPlayer` refuses YouTube without it, whatever path asks.

**Release.**
- The player is destroyed, and its iframe removed:
  - on leaving the cinema;
  - on leaving the interior;
  - on choosing another film;
  - on dispose.
- Standing up keeps the film running, the cinema's existing seated semantics.
- A hidden tab pauses it.
- A load token stops stale asynchronous answers from bringing an old player back.

**Failure handling.** Each case below gets a plain message, and "Watch on YouTube" where it could still work:
- invalid link;
- duplicate video;
- removed or private video (error 100);
- embedding refused (101/150);
- missing referrer or client identity (152/153);
- other player errors;
- the API failing to load (network, blocker, privacy settings);
- a slow player (20 s);
- a held start (a "press Play" message after 6 s);
- offline;
- a `file://` standalone copy (refused with an explanation; local films play).

A refusal that arrives after a film was announced as starting is announced too. The rest of the programme is unaffected.

**Security.**
- The thumbnail is always rebuilt from the ID, never taken from data.
- The release CSP (`public/_headers`) names exactly `https://www.youtube.com` (script), `www.youtube-nocookie.com`/`www.youtube.com` (frames) and `i.ytimg.com` (images).
- The governed asset is `cinema-youtube-screenings` (source `external`).
- The exception is recorded in `docs/ASSET_POLICY.md`.

## Adding more videos (curator)

**In the cinema:** open the programme and choose **Add video…** (the panel is titled "Add video").
- Paste a link, then **Add to Cinema**: it validates the link, extracts the ID, refuses duplicates and creates a draft.
- Edit a fallback title or description; a changed title is marked as the curator's, not YouTube's.
- **Move up / Move down**, **Remove**, **Open on YouTube**, and **Show preview**, which asks before loading the thumbnail.

**Drafts are this browser's only.** They are kept in `localStorage` (`museum-of-me:cinema-drafts:v1`) and survive reloads. They appear in this browser's programme marked "Draft · this browser only, not published". They never change the museum for anyone else.

**Publishing (making them global):**
- **Local development server (`npm run dev`):** **Save drafts to data/cinema/programme.json**.
  - A dev-only route (`scripts/cinema-programme-plugin.ts`, `/__museum-cinema/programme`) re-validates each draft and checks it with YouTube's public oEmbed for the real title, channel and embeddability.
  - It appends drafts after the existing films, writing atomically.
  - The route is never built: `verify-release-dist` checks it is absent from production.
  - It uses the same guards as the Workshop save route: serve-only, loopback, same-origin, JSON, size limit, one fixed file.
- **Anywhere:** **Export programme file** downloads the whole programme with the drafts appended. Replace `data/cinema/programme.json` with it. **Import programme file…** brings an export back as drafts.
- **In both cases,** the change is published when that file is committed and deployed.

**No new backend.** There is no public endpoint, login, database, paid API or new dependency.

## The first screening: `f6hUqtFVgD8`

**Programme entry:** `youtube-the-first-dirt-demo`, ninth, after the eight local films.

**Verified facts** (2026-11-21):
- **Title and channel**, from YouTube oEmbed: "the first dirt demo", by DigitalGhost (`@DigitalGhost269`). oEmbed answering also means YouTube treats the video as embeddable.
- **The player loads:** YouTube's IFrame Player API, in the museum, reached `ready` and reported the same title and a duration of 51 s (stored with its source).
- **Description:** none stored; none was verified.

**Picture playback: not verified.**
- **Observation:** in this build environment (a cloud data-centre network and automated Chromium, headless and headed), YouTube reached `ready` and then raised error 150 when playback was requested. Its own documentation sample video `M7lc1UVf-VE` did the same, although oEmbed reports that video as embeddable, so this is YouTube declining this browser and network, not the uploader's setting. A direct embed showed "Video unavailable"/buffering, and no frame was ever presented.
- **Recorded status:** `availability: "unverified"`, with that note. It has not been claimed playable.
- **Confirmation needed:** in an ordinary browser, open the cinema, sit, choose it and accept the notice. If YouTube refuses there too, the console says so and offers "Watch on YouTube".

## Tests

**Unit** (Vitest):
- `tests/cinema-youtube.test.ts` (40 tests):
  - link forms, the unlisted-link case, 21 malicious or malformed refusals;
  - typed validation; duplicates;
  - the eight local films' order; the exact new entry;
  - curator add, edit, reorder, remove, reload persistence, tampered storage, export and import;
  - dev promotion (oEmbed ok, not embeddable, not found, curator title, duplicates);
  - the YouTube backend against a fake API: muted ready, play, pause, seek, skip, restart, sound, held start, error 150 and 100, timeout, unreachable, offline, `file://`, stale loads;
  - the consent gate; provider switching; five repeated sessions with no leaked players;
  - the late-refusal announcement;
  - homography corner mapping.
- Updated: `cinema.test.ts` and `cinema-playback.test.ts`.

**Browser** (`tests/browser/cinema-youtube.e2e.ts`, 5 tests, real museum with YouTube's API script replaced by a labelled local stub):
- no YouTube request before consent;
- keyboard to the screening and through consent;
- the player's corners on the projected screen;
- museum keys and buttons driving it;
- YouTube controls opt-in;
- hide when turned away;
- switching to a local film destroys it;
- standing keeps it, leaving destroys it, in three sessions;
- error 150 shows the reason and "Watch on YouTube", and local films still play;
- offline (YouTube hosts aborted): the screening explains itself and local films play;
- curator paste, refuse, duplicate, edit, reorder, reload, drafts in the programme, remove.

These prove the museum's side only.

**Live capture** (`tests/browser/youtube-live.capture.ts`, `npx playwright test -c playwright.capture.config.ts …`; not in CI):
- the real museum and the real YouTube player;
- asserts only what YouTube confirmed (no request before consent; player title);
- records whether playback reached `playing` in `test-results/youtube-live.json`.

Result here: `ready` → error 150, `reachedPlayingWithAdvancingTime: false`.

**Standalone (`file://`):** the YouTube screening refuses with the "needs the hosted, online museum" message and a watch link; a local film plays; 0 external requests.
