# The Museum Cinema (2026-11-21)

Base: `main` at `3840551`, plus the uncommitted forensic repair of the same day. This is local work only: nothing has been committed, pushed, merged or deployed.

## Design authority

**Bible:** "Theater / video wing" (brainstorm section). It records the owner's wish for "another second-floor wing or major space: a theater … a proper home for the many video/film projects", where visitors "enter, sit, and watch videos in-world".
- It also lists an **open decision**: "seventh full wing, a mezzanine extension, or a major shared venue".
- That section was brainstorming. No accepted cinema design, dimensions or approval exist in the Bible, `OPERATIONAL_STATE.md` or `docs/`.

**This build** follows the 2026-11-21 owner task, which keeps the six-wing structure. So the cinema is a **shared venue on the second floor**, not a seventh wing.

**Not built** (Bible ideas the task did not ask for):
- character cameos in the seating (e.g. the Shard God with popcorn);
- DexGPT introducing films.

## Location and integration

The cinema is off the Rotunda balcony's east face, standing over the east wing. The choice came from the built architecture (`src/world/cinemaLayout.ts`):

- **Other upper faces are taken.** NW and NE hold the media and infra wings; SW and SE carry the grand stairs' arrivals.
- **Ceiling heights decide between N, E, S and W.** The north hall rises to y 14.4 and the south hall to 11.4, so neither can carry a room at balcony height. The east and west halls stop at y 10.4, and east has the longer clear run.
- **The walking surface sits at y 10.6**, 0.6 m above the balcony and clear of the east hall's roof. The lobby ramps up to it (0.6 m over 4 m).
- **It stays clear of its neighbours:** south of the NE infra wing's bays and north of the south wing's bays.
- **This is enforced by test, not by comment:** `tests/cinema.test.ts` checks that no vertex or triangle of any other building mesh enters the cinema's rooms.

**Changes to the existing building:**
- The drum's east face (until now solid with glazing above) gets a 5.2 × 4.4 m threshold.
- The stair-foot signs now list "Museum Cinema" among the upper-floor destinations.
- Nothing else in the building moved. Exhibits, wings, the Sanctuary and circulation are untouched.

**Plan:**

```
balcony ─ threshold ─ lobby ─(ramp)─ light lock ─ door ─ auditorium (screen at the west wall)
                                 └─ exit passage behind the screen ─ exit door ─┘
```

## Architecture (`src/world/Cinema.ts`)

All of it is built with GeometryKit, so the visible surface and collision are recorded together.

**Threshold and lobby:**
- **Threshold:** a bronze proscenium frame around the opening, a lit "CINEMA" marquee, and an instanced ring of marquee bulbs. The marquee reads across the atrium from the Rotunda floor.
- **Lobby:** midnight-blue plaster, coffered ceiling and azure cove light, a burgundy runner, and a "Now showing" case and programme board on the north wall.
- **Light lock:** a velvet baffle between the lobby and the doors. Visitors walk round its end. It removes the straight sightline from the seats through the doors to the bright Rotunda, which the first captures showed as a white glare during films; a test now proves no such line exists.

**Auditorium** (29 × 24 m, ceiling 11 m):
- **Seating:**
  - a flat front zone;
  - nine stadium tiers (2.1 m deep, 0.36 m rise, under the 0.55 m step-up);
  - two blocks of 126 crimson seats, 252 in all, in three instanced meshes;
  - one collider per row, so rows are solid.
- **Aisles:**
  - a ramped north aisle (the step-free route), with handrail and floor light;
  - stepped centre and south aisles with lit nosings.
- **Rear platform:** four marked step-free viewing positions with slim guard rails.
- **Finishes:** acoustic wall panels with bronze fillets and sconces, acoustic ceiling clouds, ceiling coves.
- **Screen:** 13 × 7.3 m in a bronze frame with a dead-black masked field, velvet masking legs either side, and a low apron.

**Projection and exits:**
- **Projection booth:** behind the rear wall, with two glazed ports level with the screen centre and two projectors. A faint additive beam shows only while a film runs.
- **Exits:**
  - the entry door (front north), and an exit door (front south) into a passage behind the screen that leads back to the lobby;
  - green EXIT signs and a green floor guide line, always lit.

## Playback system (`src/cinema/`)

The room, the player and the content are kept separate, as asked.

**`programme.ts` + `data/cinema/programme.json`: the content.**
- **Validation:** entries are checked strictly. Remote URLs, `..`, absolute paths, non-video types, and missing titles, descriptions, dimensions or durations are rejected with a reason, never silently repaired.
- **Adding a film:** add an entry. The room and the player do not change.

**`CinemaPlayback.ts`: the player.**
- **One element, created only on demand:** a single `<video>` is made when a film is chosen; there is none before.
- **Display:** a `THREE.VideoTexture` on the screen, drawn inside the app's single render.
- **No new loop:** no `requestAnimationFrame` or `setInterval`.
- **Capabilities:**
  - load, play, pause, resume, restart, seek, skip;
  - captions through WebVTT `<track>` cues, drawn into the museum's own caption line (a polite live region);
  - visitor-controlled sound, offered only for films that have a soundtrack.
- **Sound policy:** it never autoplays and every film starts muted.
- **Failure handling:** load timeouts and media errors become a clear state with a reason. A refused `play()` is reported, never thrown.
- **Release:** `release()` stops decoding (`removeAttribute('src')` and `load()`) and disposes the texture.

**`CinemaVenue.ts`: the cinema as a place.**
- **Interaction:** seats, accessible positions and the programme board are registered with the museum's own interaction system (F, Enter, or a centre tap).
- **Sitting:**
  - takes the seat nearest where you stand;
  - turns you toward the screen centre;
  - drops your eye to seated height (1.12 m; 1.22 m at the accessible positions);
  - opens the programme if nothing is chosen.
- **Standing:**
  - X, any movement key, or the Stand up button;
  - returns you exactly to where you stood.
- **Seat targets are inert while you're seated,** so no prompt sits over the film.
- **House lights:**
  - fade to 22% of surface brightness while a film plays, and to 45% when paused;
  - aisle, step, exit and booth lights never go out;
  - the fade is instant under reduced motion.
- **Leaving the cinema** stands you up and releases the film. Leaving the interior does the same, and a hidden tab pauses it.

**UI (`src/ui/CinemaPanel.ts`, `cinema.css`):**
- **The programme** is a standard museum dialog. Keyboard focus lands on the first film, and each entry has a poster, duration, sound and caption status, and a description.
- **The seated controls** are a non-modal bar:
  - Programme, Restart, −5 s, Play/Pause, +5 s, a seek slider with spoken value, CC, Sound (only when the film has a soundtrack) and Stand up;
  - visible focus rings, and larger touch targets on coarse pointers.
- **Seated keys:** Space/K, R, `,` and `.`, V, P and X.

**Seated mode in `PlayerController`:** `sit()`, `stand()` and `isSeated`.
- Movement and gravity stop; look stays free.
- It is not a freeze: panels and scripted moves still work on top of it.
- Teleporting clears it, and the flight pad ignores a seated visitor.

## Screening content

8 real films are available. All are first-party, local, and hash-checked against disk.

| # | Film | Length | Sound | Captions |
|---|---|---|---|---|
| 1–8 | *The Full Weasel · Background loop 1–8* (P039, E27). The game's own "Primary animated background loop" files. | 6.04 s each | none (no audio track) | none (no speech) |

- **The 9th file** (`grok_video_2026-02-08-15-27-24.mp4`) is byte-identical to `…15-27-23.mp4`, so it is listed once.
- **Descriptions state only what each 3-second poster frame shows:** the "Happy Birthday Nana Cheese" party stages, disco balls and spotlit pallet stages.
- **The clips are portrait (832×1504).** The screen masks them to their own shape inside the frame.

**Missing:**
- **The collection's film and video projects** (P069 Character Performance Capture, P070 ClearCut Local) have no media in the repository, so they are not listed.
- **No caption files exist.** The caption path is built and unit-tested, but no real captioned film has been played. It remains **pending**.
- **No film with sound exists.** The sound control is unit-tested only.

## Validation

**Unit tests (Vitest):** 1,229/1,229 pass.
- **New** `tests/cinema.test.ts` (12) uses the real built museum and the real `PlayerController`:
  - reaching the cinema by the grand stair;
  - the ramped aisle and accessible positions;
  - stepped aisles and the exit loop;
  - every seat sampled; solid rows;
  - no intrusion into the cinema's rooms;
  - the light-lock sightline check (fails without the baffle);
  - media hashes and programme validation.
- **New** `tests/cinema-playback.test.ts` (14) covers:
  - no autoplay; muted;
  - controls and the end of a film;
  - missing file; refused play;
  - release and supersede;
  - venue sit, stand, keys, house lights, reduced motion, masking, leaving and dispose.

**Browser tests (Chromium):** new `tests/browser/cinema.e2e.ts` (5) passes.
- **Walk and watch:**
  - walked with real held keys from the Rotunda floor, up the grand stair, round the balcony, through the threshold, ramp, light lock and door;
  - F on a seat;
  - the programme by keyboard (Tab, Enter);
  - the real film decodes onto the screen (a `VideoTexture`, muted, 832×1504, time advancing, the screen's rendered pixels change);
  - Space, R, +5 s and Play buttons work;
  - CC is disabled with the reason given;
  - a movement key stands you up where you stood;
  - leaving by the exit loop releases the media;
  - no page errors; no requests leave the machine; exactly one media request.
- **Missing file:** a 404 on the film shows an error state and an "Unavailable" mark, and another film still plays.
- **Reduced motion:** house lights change at once and the marquee holds still.
- **Touch:** a centre tap sits you down; tapping a film, Pause and Stand up all work.
- **Step-free position:** reached by the ramped aisle; F gives a 1.22 m eye height.

**Passage inventory:** 7 cinema passages are added (threshold, lobby ramp, light lock, entry door, exit door, exit passage, ramped aisle). The traversal harness walks them in both directions.

**Full suite, gate and standalone:** see the OPERATIONAL_STATE entry (r106).

**Evidence:** `docs/evidence/museum-cinema-20261121/`
- 00 marquee from the Rotunda floor
- 01 entrance
- 02 lobby
- 03 auditorium from the rear
- 04 auditorium from the front
- 05 programme panel
- 06 seated view with a film playing
- 07 accessible viewing position

## Performance

**Draw cost:** the cinema is its own zone render root, drawn only from the cinema, balcony or Rotunda.
- It adds 39 meshes after the static merge, all inside that root: 3 of them are invisible interaction proxies, never drawn, and 3 are instanced seat parts.
- The architecture merge ceiling in `tests/performance.test.ts` moves from 424 to 463, with that accounting written in the test.

**Lights:** no new lights.

**Media:** no video exists until a visitor chooses a film, and only that one file is fetched. Video is released on leaving.

**Transfer:** the posters (188 KB) are loaded lazily by the programme panel. They count in the initial-visit tally as a conservative measure.

## Accessibility

**Implemented:**
- keyboard-operable programme and controls, with visible focus;
- labelled buttons and a seek slider with spoken time;
- captions path (none available yet; said so);
- step-free route and positions;
- touch controls;
- reduced motion;
- always-lit exit route.

**Known limits:**
- **Ramp gradient:** the ramped aisle is about 10°, steeper than real-world accessibility codes. It is the only step-free route to the rear platform.
- **Seated sightline:** from the accessible positions, the last row's seat backs graze the bottom edge of the screen.

## Not verified

- Human visual and comfort acceptance.
- Real pointer-lock feel.
- Real-device performance.
- Captioned or sound films (none exist).
- `file://` standalone video on the screen: see the OPERATIONAL_STATE entry.
- Exact-head CI, since nothing is pushed.
