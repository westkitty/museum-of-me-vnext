# World production ledger — 2026-11-26

Single execution ledger for the World Production Engine V2 session and Codex continuation.
Resume from this file, the source, and the evidence below; do not restart reconnaissance.

## Workspace

| Item | Value |
|---|---|
| Cumulative worktree | `/Users/andrew/museum of me/worktrees/wt-world-production-20261126` |
| Branch | `feat/world-production-20261126` (local only, uncommitted work) |
| Base | `3b59e96` (visual-finishing candidate; `origin/main` `ff6d983` is its ancestor) |
| Codex W02 original | `/Users/andrew/museum of me/worktrees/wt-w02-prehistoric-fern-20261126` — **untouched**; preserved as `refs/checkpoints/w02-codex-20261126` (`a37a61e`) + `/Users/andrew/museum of me/checkpoints/w02-codex-20261126/` (tgz + sha256, verified) |
| W01 lane | `feat/w01-great-ocean-procession` @ `67e44fc` in the main checkout — **untouched**. Its authored world, music and narrow shared changes are now reconciled into this local cumulative candidate; the unrelated branch delta was not merged. |
| Checkpoints | `refs/checkpoints/world-production-*` (commit objects over the full worktree incl. untracked; no branch commits) |

Restore any checkpoint into a fresh worktree: `git worktree add <dir> 3b59e96 && cd <dir> && git checkout <checkpoint-ref> -- . && git reset -q`.

## Shared infrastructure added (this session)

- `src/world/pocket/devPreviews.ts` — DEV-only lazy loader map; `?preview=w02[,w03…]` or `?preview=all`. Handles on `window.__worldPreview[ID]`.
- `main.ts` / `App.ts` — `ephemeralPassport` (in-memory `Passport(null)`) whenever `?preview=` is present in DEV: preview completion uses the real host path but never writes localStorage. Production build verified: no preview loader or world chunk in runtime JS (`verify:dist` exit 0).
- `src/world/pocket/kit/worldKit.ts` — mesh+collider pairs (platform, ramp, rail), sky dome, light rig (**no real-time shadow maps**: museum renderer has `shadowMap.autoUpdate=false`; a casting pocket light breaks every receiving draw with GL_INVALID_OPERATION), seeded RNG.
- `tests/browser/helpers/world-journey.ts` — keyboard-only real-time journey helpers (Q/E, PageUp/PageDown, W/Shift, F). Diagnostic placement confined to `placeInMuseum` (museum side, labelled).
- `playwright.worlds.config.ts` — port 4191; `MUSEUM_WORLDS_GL=metal` runs headless Chrome on ANGLE Metal (Apple M1, ~60 fps in W02); default SwiftShader (~0.5 fps in museum: unusable for real-time journeys).

Browser command: `MUSEUM_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" MUSEUM_WORLDS_GL=metal npx playwright test -c playwright.worlds.config.ts <file>`

## Baseline (before changes, seeded worktree)

`npm run typecheck` 0 · `npm run lint` 0 · `npx vitest run` 139 files / 1377 tests pass.

After W03: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` 140 files / 1392 tests pass · `npm run build` 0 · `npm run verify:dist` 0 · no `w03-*` symbols in `dist/assets/*.js`.

After W04: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` 141 files / 1399 tests · `npm run build` 0 · `npm run verify:dist` 0 · no `w04-*` world symbols in dist (the dormant `pocket-portal:w04` anchor ships, as W02/W03 anchors do).

After W05: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` 142 files / 1406 tests · `npm run build` 0 · `npm run verify:dist` 0 · no W05 world symbols in dist (the W05 anchor's active label string ships; the world stays dormant in production).

After W06: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` 143 files / 1414 tests · `npm run build` 0 · `npm run verify:dist` 0 · no W06 world symbols in dist (`w06-parasol|createW06World|Skyborne Gardens (Preview)` → 0 files; the Flight Pad II active label string ships in 1 chunk; the world stays dormant in production).

After W07: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` 144 files / 1422 tests · `npm run build` 0 · `npm run verify:dist` 0 · no W07 world symbols in dist (`w07-slingshot|createW07World|Portal Slingshot Trials (Preview)` → 0 files). The test-lab door and its dormant/active anchor labels ship in the main chunk (plus its sourcemap) by design; the world stays dormant in production.

Final W01–W10 + L01 cumulative source candidate: `npm run gate` PASS — 149 test files / 1,438 unit tests, 9 release-tool tests, validators, build, budget check (17.53 MB initial of 20 MB), and `verify:dist` (256 files). The production JavaScript contains no `createW01World`–`createW10World`, `createL01World` or W10 test-rig marker; no W01 `.m4a` ships while the registry is dormant. `git diff --check` was clean after fixing inherited W01 provenance trailing spaces. In the final cumulative world browser sweep, 29/30 passed; W08 reduced motion then passed on a focused rerun after correcting the test's stale dock target (runtime unchanged). Thus all 30 cases pass on the cumulative runtime, but not in a single green suite invocation. The standard museum browser suite and standalone checks remain separate.

Touch follow-up exposed that the HUD center tap activated only focused `InteractionManager` controls, while W10 uses the shared `input.on('interact')` action for nearby wilderness objects. `InputManager.triggerInteract()` now dispatches the normal interact action from the center tap, preserving the App's focus handling and allowing world listeners to respond. Installed Chrome touch emulation passed W10 pier center-tap entry, virtual-stick movement and glider pickup, plus W09 virtual-stick local-time advancement and freeze on release. This is browser touch emulation, not physical device acceptance. The final `npm run gate` after this shared change passed the same 149 files / 1,438 unit tests and all release checks. The standard museum browser suite is being rerun separately.

## World status

### W02 — Prehistoric Fern Island — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w02/` (`w02Layout`, `w02Landscape`, `w02Flora`, `w02Bridge`, `w02Finale`, `createW02World`, `registerW02Preview`). Codex spawn/climb/shelf/gorge/bridge coordinates preserved.
- Route: arrival (-42,0,8) → root climb → west shelf (seed, checkpoint) → bridge grows 4.2 s (collider only under fully grown planks, growth-front wall) → east shelf → ramp A → Fern Balcony (y6) → ramp C → Root Saddle (y10) → ramp E → Elder summit (y14) → wake Elder Fern (9 s finale: crown unfurls, gorge veil lifts, fog thins, herd appears) → root gate → `requestComplete()`. Optional fossil loop via fossil hollow and the north root ramp; studying it enlarges the finale herd.
- Unit: `npx vitest run tests/w02-prehistoric-fern.test.ts` → 9/9 (step-by-step walkability + wall-free probes of main route and fossil loop on low and high tiers; collider never ahead of grown planks; reduced-motion final state; idempotent completion; early exits award nothing).
- Browser (Metal headless): `tests/browser/w02-prehistoric-fern.e2e.ts` → 3/3: real-time keyboard journey (48 s) incl. entry via anchor + dialog, completion return, persistent passport byte-identical; fossil loop + Back button + 2 repeat visits; reduced motion (bridge instant).
- Defects found and fixed by play: (1) shadow-map GL failure made the island invisible; (2) terrace mass walls snagged ramp arrivals at the Root Saddle (regression test added and proven to fail on the old value).
- Evidence (inspected): `test-results/world-production-20261126/w02/01-entrance … 06-return, 07-optional-fossil-hollow, 08-reduced-motion-bridge`.
- Not yet proven for W02: touch play, failed/interrupted load, ten-visit resource growth (planned in the cross-world lifecycle test), owner visual review, representative-device performance.
- External holds: owner visual acceptance; W01→W02 promotion order; production registry stays dormant.

### W03 — Clockwork Sundial — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w03/` (`w03Layout` schedule + topology, `w03Machine` moving supports, `w03Crown` finale, `w03Scenery`, `createW03World`, `registerW03Preview`). Museum anchor: existing gnomon plinth on the astronomical terrace (geometry unchanged; `ExteriorSignatureFeatures.sundialGnomon`, `ExteriorWorld.getSundialPortalControl`, `App` `pocket-portal:w03` dormant/active control).
- Mechanic: one deterministic machine clock drives every moving support, collider, visual and forecast lamp. Turnstile arm (17 s cycle, 6 s aligned), piston lift (16 s), escapement shuttle (20 s), continuously turning crown gear. Riders are carried (position, and facing on rotating supports); every edge not meeting a landing is walled and both landings are gated while a crossing is away — no timing mistake can drop a visitor. Lamps: green open, amber within 2 s of a change, red closed, paired with lamp height (not hue alone).
- Route: Gnomon Plaza (0,0,30) → turnstile → Forecast Gallery (cp) → lift → Escapement Gallery (cp) → shuttle → Orrery Landing (cp; optional star-chart alcove east) → crown gear → ramp → Sundial Crown (cp). Act III: prime three sun latches; each releases when the gnomon's shadow sweeps over it (priming early just waits — no precision timing). Finale 10 s: cage opens, sun rises with its crown, dusk → dawn; sun gate → `requestComplete()`. Star chart adds a constellation ring to the sunrise.
- Reduced motion: turnstile held aligned, crown gear stopped (no camera rotation), latches release on priming, sunrise final state at once; lift and shuttle keep gentle linear schedules.
- Unit: `npx vitest run tests/w03-clockwork-sundial.test.ts` → 10/10 (schedule continuity + window lengths; arm support only when aligned, gates otherwise; rider carry incl. facing; lift/shuttle carry with gates; step-by-step walkability of every leg on low/high tiers; latch release only under the shadow; completion gated + idempotent; reduced motion; tier scaling; all dynamic colliders released on dispose).
- Browser (Metal headless): `tests/browser/w03-clockwork-sundial.e2e.ts` → 3/3: full real-time keyboard journey (1.8 min incl. machine waits) with entry via gnomon + dialog, completion return to the terrace approach, in-memory stamp only, persistent passport byte-identical; star chart + Back + 2 repeat visits (fresh machine clock and state); reduced motion (arm held aligned over 10 s, crossed without waiting).
- Perf observed: 60 fps (ANGLE Metal, M1), 38–128 draws, 11k–27k tris.
- Evidence (inspected): `test-results/world-production-20261126/w03/01-entrance … 06-return, 07-optional-star-chart, 08-reduced-motion-turnstile-held`; copy under `checkpoints/world-production-20261126/evidence/w03`.
- Authoring defects found by looking and fixed: armillary bands read as cables (moved to sky scale, unlit, translucent); cage petals swept into the visitor's view (opening limited, crown ring rides with the sun); evidence vantages reframed.
- Not yet proven: touch play, failed/interrupted load, ten-visit resource growth (cross-world lifecycle test), owner visual review, device performance.
- External holds: owner visual acceptance; production registry stays dormant.

### W04 — Digital Beat World — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w04/` (`w04Layout`, `w04Mechanisms` sequencer bridge + EQ stair, `w04Scenery`, `createW04World`, `registerW04Preview`). Museum anchor: the E19 DexTilt desktop display (named `dextilt-desktop-display`; the exhibit's phone and manual controls unchanged). Interior exhibits stream, so `InteriorWorld` asks `App.attachExhibitPocketAnchor` per registered exhibit control and the `pocket-portal:w04` anchor registers and releases with E19's mount.
- Mechanic: building terrain from rhythm. Act I: four step pads each record a beat that raises two Sequencer Bridge segments (support only when fully risen; every missing segment walled at both ends; recording is one-way). Act II: the EQ console cycles Flat / Wave / Rise; twelve equalizer bars take the preset's shape as moving floors that carry riders, each with a solid column exactly one step-up below its top (a taller bar is a wall, never a hole); only Rise forms 0.5 m steps to the Mezzanine. Act III: ramp to the Stage; Play the Drop (10 s: sky to magenta, beams, waveform swell, rails/grids/cubes brighten) → ring gate → `requestComplete()`. Optional B-side record adds an amber waveform to the Drop. Beat is visual only (96 BPM cosine pulse, no flashing); nothing depends on hearing or timing.
- Reduced motion: segments and bars reach final state at once (riders carried), Drop final state at once, decorative motion held still.
- Unit: `npx vitest run tests/w04-digital-beat.test.ts` → 7/7. Defects found by the tests and fixed: mezzanine slab too thin (a visitor on flat bars could walk under it); bar column height aligned to the 0.55 m step-up.
- Browser (Metal headless): `tests/browser/w04-digital-beat.e2e.ts` → 3/3 (1.7 min): interior entry via E19 + dialog, keyboard journey through all three acts, return to the interior entry pose, in-memory stamp only, persistent passport byte-identical; B-side + Back + 2 repeat visits; reduced motion. Defect found by play: aim points on pad top edges missed under pitch tolerance (aim at body centres).
- Perf observed: 60 fps in-world (37–118 draws, 3k–5k tris).
- Evidence (inspected): `test-results/world-production-20261126/w04/01-entrance … 06-return, 07-optional-b-side, 08-reduced-motion-segments-instant`; copy under `checkpoints/world-production-20261126/evidence/w04`.
- Owner-content note: no music was authored or added (W04 has no audio); a beat track is owner content to supply later.
- Not yet proven: touch play, failed/interrupted load, ten-visit growth, owner visual review, device performance.

### W05 — Impossible Greenhouse — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w05/` (`w05Layout`, `w05Mechanisms` lily pond + cistern raft, `w05Scenery`, `createW05World`, `registerW05Preview`). Shared: `orientedWall` moved into `kit/worldKit` (additive; W03 keeps its own copy). Museum anchor: the existing rooftop conservatory flower (`rooftop-greenhouse-flower-w05`), now registered through `createAnchorControl` with an active label and a live return anchor (the dormant production label and message are unchanged).
- Mechanic: light and water. Act I: the Sun Mirror sends skylight to the next seed pod; a lit pod grows into a lily pad (growth, once begun, always completes and never shrinks; a pad supports only when grown; each bank opening is walled until the pad meeting it has grown; the lily notch is open water). Act II: on the leaf raft, the flood valve fills the cistern and carries the rider 6 m up to the Vine Gallery; each landing opening is gated unless the raft is level with it; a Fern Hall lever calls the raft down. Act III: leaf ramp to the round Canopy leaf (railed except at the ramp); the bud needs light (canopy mirror on the bud) and water (dew valve) together → the Impossible Bloom (10 s: the bud rises and opens fourteen cupped petals high overhead, pollen lifts, dawn replaces the green night) → vine arch → `requestComplete()`. Optional night orchid behind the fern curtain adds a blue ring to the Bloom. Falling into the pond returns the visitor gently to the last checkpoint.
- Reduced motion: pads grow, the raft moves (rider carried) and the Bloom opens at once; pollen and decorative motion held still.
- Unit: `npx vitest run tests/w05-impossible-greenhouse.test.ts` → 7/7.
- Browser (Metal headless): `tests/browser/w05-impossible-greenhouse.e2e.ts` → 3/3 (1.9 min): rooftop flower entry + dialog, keyboard journey through all three acts (the Bloom keeps opening while the visitor walks down the ramp), return to the rooftop entry pose (same height), in-memory stamp only, persistent passport byte-identical; orchid + Back + 2 fresh repeat visits; reduced motion. Defects found by play and fixed: unaimed mirror discs lie edge-on (aim at pedestals); a 2-of-4 orchid flake traced to aiming at a 6 cm stem (aim at the pot) → 4/4 on repeat. Visual pass: finale vantage moved to the ramp, petals reshaped (cupped, graded colour, low emissive), pollen given a generated round sprite, gallery face given ivy, terrace sides stone with tile tops, water less glossy.
- Perf observed: 60 fps in-world (30–85 draws, 27k–35k tris).
- Evidence (inspected): `test-results/world-production-20261126/w05/01-entrance … 06-return, 07-optional-night-orchid, 08-reduced-motion-pad-instant`; copy under `checkpoints/world-production-20261126/evidence/w05`.
- Owner-content note: functional in-world text only; the Bloom, orchid and greenhouse look await owner visual review. No audio.
- Not yet proven: touch play, failed/interrupted load, ten-visit growth, owner visual review, device performance.

### W06 — Skyborne Gardens — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w06/` (`w06Layout` islands/updrafts/route, `w06Wind` glide + lift, `w06Islands` island and updraft builders, `w06Scenery`, `createW06World`, `registerW06Preview`). Museum anchor: the rooftop café Flight Pad II console (shared with W10); when W06 is playable its label is "Enter Skyborne Gardens Preview" and activation calls `requestEntry('W06', captureHostAnchor())`. The W10 branch is unchanged.
- Mechanic: wind, with no jumping anywhere. Act I: take a seed parasol in the Seed Meadow; the garlanded launch lip opens only once the visitor holds a parasol; walking off it becomes a slow, steerable glide (descent ≤ 2.2 m/s, drift ≤ 5 m/s) down to the wide Cloud Orchard. Act II: petal updrafts lift the visitor to hover level with the Wind Terrace and then the Sky Pavilion; walking steers off the hover. Act III: a long glide from the Pavilion lip into the Great Thermal (radius 4, reaching from below the reset line to the summit) lifts the visitor to the Summit Garden; the seed cairn (needs summit + parasol) begins the Great Migration (10 s: seeds and lanterns rise, golden sky, rainbow) → cloud door → `requestComplete()`. Optional: a spire updraft off the Terrace leads to the Sky Lantern; lighting it adds lanterns to the migration. A missed glide (below y −14) returns the visitor softly to the last island checkpoint with velocity cleared.
- Reduced motion: an updraft places the rider at hover height at once; petals, clouds and decorative motion are held still; the finale completes without motion.
- Unit: `npx vitest run tests/w06-skyborne-gardens.test.ts` → 8/8. A real `PlayerController` is driven by a fake keyboard through the whole route under real physics on both quality tiers, plus the spire leg, a missed-glide reset, finale gating, reduced motion and dispose.
- Browser (Metal headless): `tests/browser/w06-skyborne-gardens.e2e.ts` → 3/3 (2.0 min).
  - Journey: Flight Pad II entry, then a keyboard journey through all three acts (checkpoints orchard → terrace → pavilion → summit, 0 fall resets). The visitor returns to the rooftop entry pose (< 1 m, same height). The stamp is recorded only in the in-memory passport; the persistent passport stays byte-identical and there are no console errors.
  - Second test: lantern, then Back (no stamp), then 2 fresh repeat visits (parasol, lip, lantern and checkpoints all reset).
  - Third test: reduced motion.
- Visual-pass defects fixed:
  - Swollen flowers read as boulders; they are now small stemmed blossoms with a modest swell.
  - The updraft column read as a solid silo; it now uses vertex-colour fade at both ends.
  - The rainbow rendered white under additive blending; it now uses normal blending.
  - Migration seeds were too faint; they are now larger.
  - The updraft shot stared into rock; it now uses a level vantage.
- Unit defects fixed:
  - The cairn sat 6 cm out of reach; it was moved.
  - The mock reset did not move the player; it now teleports to the spawn point.
- Perf observed: 60 fps in-world (21–69 draws, 27k–62k tris); longest frame was a 1.3–1.5 s museum-exterior hitch before entry, not in-world.
- Evidence (inspected): `test-results/world-production-20261126/w06/01-entrance … 06-return, 07-optional-sky-lantern, 08-reduced-motion-updraft-instant`; a copy is under `checkpoints/world-production-20261126/evidence/w06`.
- Owner-content note: in-world text is functional only. The islands, migration and rainbow look await owner visual review. No audio.
- Not yet proven: touch play (gliding with the touch stick is untested), failed/interrupted load, ten-visit growth, owner visual review, device performance.

### W07 — Portal Slingshot Trials — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w07/` (`w07Layout` zones/panels/shell/route, `w07Portals` shot targeting + two-portal system, `w07Lab` lab materials and geometry, `createW07World`, `registerW07Preview`).
- Museum anchor: `src/world/TestLabDoor.ts`, a sealed test-lab door (calibration glass, hazard frame, push button) flush against the end wall of the Local Systems wing, the wing with the fewest exhibits (2). It is non-replacing: not one of the 35 exhibit slots, with no collider and no floor footprint. `App.attachTestLabAnchor` registers `pocket-portal:w07` through `createAnchorControl`. Dormant: "Inspect the Test Lab Door" (registry check message). Playable preview: "Enter Portal Slingshot Trials Preview". The return anchor is the interior pose captured at entry.
- Mechanic: a two-portal slingshot that fires only at approved white panels (fixed sockets, deterministic). A shot on an open portal closes it; a third portal replaces the oldest. Walking into a linked portal steps out of its partner, facing out. Wall entries are damped (≤ 8 m/s); only a fall carries full momentum.
  - Act I: take the slingshot from its stand (this opens the foyer gate); link A1 and A2 to pass the glass partition.
  - Act II: carry the dispenser block through B1 and B2 to the pressure plate behind the glass. The plate latches and the north door opens. A block carried out of the chamber returns to the dispenser.
  - Act III: open C1 in the shaft floor and C2 in the pylon aperture, then fall down the shaft. The fall momentum flings the visitor across the chasm to the ledge. Activating the calibration core starts an 8 s amber/teal ring calibration; then the exit portal opens → `requestComplete()`.
  - Optional: shoot A3 through the closet window to reach the first prototype; it adds gold rings to the finale.
  - Safety: walking or sprinting into C2 falls short onto a safety net, which returns the visitor gently to the last checkpoint with portals kept (the "Too slow…" hint is given once). A visitor stuck on the shaft floor for 1.2 s, or anyone below y −10, is lifted back the same way. Each chamber has a reset button, and portals outside the current chamber close on zone change.
- Touch: the slingshot is a registered interaction-only proxy in front of the camera, so the centre tap fires it just as F/Enter does. This is not yet exercised on a touch device.
- Reduced motion: a fling resolves at once to its landing (same arc, simulated with collision); the finale completes without motion.
- Unit: `npx vitest run tests/w07-portal-slingshot.test.ts` → 8/8. A real `PlayerController` is driven by a fake keyboard through the full route on high and low tiers. Also covered: walking- and sprint-speed failure, shaft-stuck reset, the slingshot rules (invalid shot, oldest replaced, close, optional, zone clearing, reset, block return), deterministic transform, reduced motion and dispose.
- Browser (Metal headless): `tests/browser/w07-portal-slingshot.e2e.ts` → 3/3 (3.3 min).
  - Journey: real interior walk to the test-lab door, then a keyboard journey through all three chambers, calibration and exit. The visitor returns to the entry pose (< 1 m). The stamp is recorded only in the in-memory passport; the persistent passport stays byte-identical.
  - Second test: optional prototype, then Back (no stamp), then 2 fresh repeat visits.
  - Third test: reduced-motion full route.
- Visual-pass defects fixed:
  - 01-entrance was captured before the interior first rendered (black); it now waits for a frame.
  - Wall tiles were too light for the white panels to read; they are darker now.
  - Hazard stripes were stretched and pixelated on the gate, the B door and the museum door frame; they now use metre-scaled UVs and soft-edged mipmapped 64 px stripes.
  - The slingshot on its stand was too small; it is now 1.6×.
- Unit and browser defects fixed:
  - The exit portal's torus hole let the aim ray pass through; it now has an unrendered hit disc.
  - Fling assertions polled stale transit counts.
  - A walk ended mid-fall; the test now idles until landing.
- Perf observed: 60 fps in-world (16–174 draws, 4k–6.5k tris). The longest frame was the 1.3 s museum-exterior hitch before entry, not in-world.
- Evidence (inspected): `test-results/world-production-20261126/w07/01-entrance, 02-arrival, 03-mechanic-linked-portals, 04-transformation-plate-latched, 04b-fling-across-the-gap, 05a-finale-calibration, 05b-finale-exit-portal-open, 06-return, 07-optional-first-prototype, 08-reduced-motion-fling-instant`; a copy is under `checkpoints/world-production-20261126/evidence/w07`.
- Owner-content note: in-world text is functional only. The lab, door and finale look await owner visual review. No audio.
- Not yet proven: touch play, failed/interrupted load, ten-visit growth, owner visual review, device performance.

### W08 — World Inside a Raindrop — LOCAL PREVIEW VERIFIED (behavioural); external holds

- Source: `src/world/pocket/w08/` (`w08Layout`, `w08Drop` skin/garden/splash visuals, `createW08World`, `registerW08Preview`). Museum anchor: `src/world/exterior/RillDroplet.ts`, a raindrop suspended over the reflecting rill. It has no collider and replaces nothing. `App` registers `pocket-portal:w08` through `createAnchorControl`. When the world is playable the anchor reads "Enter World Inside a Raindrop Preview".
- Mechanic: refraction lenses turn pore sunlight onto glass seeds, which set permanently into walkways.
  - Act I: lens 1 sets the Glass Stair up to the Glass Terrace.
  - Act II: a drift pad carries the visitor across to the Drift Terrace. It comes to the visitor, crosses only when the visitor boards, and does not carry an arrived rider back. There, lens 2 sets the Glass Span up to the Bubble Terrace.
  - Act III: lens 3 warms a bubble, which rises to the Crown. The mote of dust starts the 12 s fall and splash finale, which opens the surface ring → `requestComplete()`.
  - Optional: lens 1's third aim lights the far prism, where the visitor gathers a rainbow seed.
  - Forgiveness: falls of more than 2.5 m return softly to the last terrace. The bubble returns for a visitor left below. No jumping is needed and nothing is timed.
- Reduced motion: the pad and the bubble carry the visitor at once, and the finale completes without motion.
- Unit: `npx vitest run tests/w08-raindrop.test.ts` → 7/7. Uses real `PlayerController` physics on both quality tiers. Covers the full route, the optional prism, forgiveness (ring boundary, soft falls, pad call, bubble return, nucleus gating), determinism, reduced motion and dispose.
- Browser (Metal headless): `tests/browser/w08-raindrop.e2e.ts` → 3/3.
  - Journey: rill droplet entry → all acts → splash → return within 1 m. The stamp is written to the in-memory passport only; the persistent passport stays byte-identical.
  - Optional seed, then Back (no stamp), then 2 fresh repeat visits.
  - Reduced motion.
  - Fresh-boot cause found: the focused F reached `requestEntry`, but `WorldDirector` rejected it during background `PREPARING_INTERIOR`. `PocketWorldHost` now retains one request until preparation finishes; `PREPARING_RENDER_RESOURCES` also permits a pocket prompt. One F press opened the dialog on 3/3 fresh boots without retry. The full W08 journey passed in the final cumulative suite.
  - W08 reduced-motion browser case failed in the final suite because the test kept steering toward the original dock after instant transport moved the visitor. The test now holds forward only until `padCrossings === 1`, then exits the arrived pad. The focused rerun passed in 44.3 seconds; no runtime mechanics changed.
- Visual-pass fixes:
  - Fog and pale surfaces washed out the interior; fog is lighter and the floor and glass are deeper in colour.
  - The beams were blinding near spawn; they are thinner and dimmer, and the pool aim moved away from spawn.
  - The bubble rim showed as a bar across the rider's view; it is removed.
  - The splash was not visible from inside the drop; the rill is now a ring that rises around the skin, with ripples inside and out.
  - The rainbow washed out white under additive blending; it now uses normal blending and sits further away. `07-optional-rainbow-seed.png` was inspected and shows a multicolor arc.
- Perf observed: 60 fps in-world (13–60 draws, 14k–31k tris).
- Evidence: `test-results/world-production-20261126/w08/01…08`; a copy is under `checkpoints/world-production-20261126/evidence/w08`.
- Not yet proven: touch, failed load, ten-visit growth, owner visual review, device performance.

## Next action

W09 and L01 local previews exist and their keyboard journeys complete. W10 was implemented last, after inspecting approved Dexter visual references and the existing W06 traversal/camera interfaces. W01 has been reconciled locally from its separate branch without disturbing that worktree. The eleven-world [owner review](WORLD_OWNER_REVIEW_20261126.md) and consolidated checks are complete for the measured local scope. Next action: owner visual/audio review, full physical touch journeys and real-time repeat journeys, then repair the measured exterior-walk performance budget and obtain headed representative-device acceptance. An approved Dexter model is required before W10 art acceptance. Production promotion, exact-head CI and hosted verification remain gated.

### W01 — The Great Ocean Procession — RECONCILED LOCAL CANDIDATE

- Source lane: `feat/w01-great-ocean-procession` at `67e44fc`, clean and untouched. Copied only the W01 source, three owner-authored AAC music stems, provenance, tests and existing evidence into the cumulative visual-finishing worktree. Integrated its lagoon entrance, guided-current movement methods, asset declarations and development preview registration deliberately. No merge or branch publication occurred.
- Route: east lagoon bank → central current station → turtle, ray and whale reefs with distinct musicians and synchronized stem reveal → coral cathedral assembly → Conductor's Platform → completion and return. Production W01 stays dormant.
- Focused source test 3/3 includes full route, finale-only stamp and ten simulated visits. Existing browser suite 2/2 passes on the cumulative candidate, including full-resolution captures, mobile layout, reduced motion and bundled stem checks. That suite stops the normal loop and drives world controls programmatically; it is **not** a real-time physical-input journey. The completed-cathedral screenshot was inspected. Cross-world and final gate checks are still pending.
- Owner-authored music rights are recorded in the existing provenance and Bible. Human visual/audio approval, representative-device performance and release promotion remain pending.

### W09 — The Museum Between Seconds — PLAYABLE LOCAL

- Source: `src/world/pocket/w09/`; existing southern wooded observatory orrery anchor promoted only when `?preview=w09` is present in development. Production registry remains dormant.
- Route: frozen orrery and movement-built bridge → two constellation alignment stations (stationary interaction can advance the clock) → supported, railed meteor cascade with frozen-on-stop obstructions → final observatory and restored celestial crown → exit and safe return. Optional lost astronomer chart. Four checkpoint regions; a fall resets to the last checkpoint.
- Clock advances from measured horizontal displacement only while movement input is intentional, including touch stick. Camera turn, idle, involuntary teleport/fall and the global application loop do not drive it. Constellation stations advance local time explicitly while still. Meteor positions and their collision walls use the same local clock.
- Validation: `tests/w09-museum-between-seconds.test.ts` 2/2; `tests/browser/w09-museum-between-seconds.e2e.ts` 1/1 real-time keyboard journey, authentic observatory entry, all three acts, completion return, and persistent passport isolation. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:dist` pass. Production JavaScript has no W09 preview loader or world symbols. Browser screenshots `test-results/world-production-20261126/w09/01…06` were inspected. A real defect was found and fixed: the exit target was below the raised finale platform, preventing selection.
- Limits: The scene is a functional local preview with authored orrery, celestial rings, star field, constellation chamber and meteor passage. Its finale art is not owner accepted. A focused browser-emulated touch-stick clock test passed, but a full touch journey, reduced-motion browser journey, early exit/repeat visits, failed/interrupted load, ten-visit resource proof, representative-device performance and human visual acceptance are pending. The generic web-game skill client could not launch because its bundled Playwright Chromium executable is absent; the project's configured installed Chrome Metal browser journey passed.

### L01 — Lighthouse at World's End — PLAYABLE LOCAL, UNSTAMPED

- Source: `src/world/pocket/l01/`. Existing peninsula gallery lens is the only entry. The original tower and climbable approach are unchanged. Production L01 remains dormant.
- Route: lost coast arrival → three beam-revealed solid light paths with safe waiting islands and checkpoints → keeper beacon → fog opens on the far coast panorama → return to the same gallery. Path outlines precede illumination; revealed paths retain collision support, so a visitor is never stranded as the beam sweeps away. Optional tide-pool discovery. Reduced motion holds the beam and exposes each next path immediately.
- Validation: `tests/l01-lighthouse.test.ts` 2/2; real-time installed-Chrome browser `tests/browser/l01-lighthouse.e2e.ts` 3/3 (complete keyboard journey, optional discovery, early Back and repeat, reduced-motion first path). Browser completion returned to the lens pose; in-memory bonus completion was true while stamp count remained zero, L01 stamp false and persistent passport byte-identical. Unit tests independently check ten stamp definitions and bonus accounting. Typecheck, lint, build and `verify:dist` pass. Screenshots `test-results/world-production-20261126/l01/01…08` inspected; the panorama evidence was reframed past the beacon and shows the far coast.
- Limits: Local preview with coastal ruins and islands, sweeping beam, supported light paths and panorama. Human visual acceptance is pending; touch journey, ten-visit resource growth, failed/interrupted loading and representative-device performance are unproven. The current visual treatment is an authored first pass, not production art approval.

### W10 — Breath of the Weasel — PLAYABLE LOCAL WITH TEST RIG

- Source: `src/world/pocket/w10/`, `src/world/exterior/WeaselPierGuide.ts` and a separate rooftop wilderness signal. The original W06 Flight Pad II console still enters W06 independently. W10 remains dormant in production; the pier guide is hidden until W10 is registered and at least one W01–W09 stamp exists.
- Route: take the glider at the high plateau → wind-assisted descent to the valley → grip and stamina climb → move two shrine blocks three notches each onto their plates → cross the summit and wind channel → reveal the far coast and return to the entry pose. The optional cedar seed is independent. The host uses a third-person camera only while this world is active and restores first-person on Back or completion.
- Validation: `tests/w10-breath-of-the-weasel.test.ts` 2/2; installed-Chrome browser full real-time keyboard route 1/1 and separate W10 rooftop/W06 independence and Back camera restoration 1/1. That route uses a clearly labeled diagnostic in-memory W09 stamp after asserting W10 is initially locked. A separate real-time W09 journey then earned its stamp through the actual completion path and entered W10 through the pier on that same session; Back restored the museum and the persistent passport stayed unchanged. Screenshots `test-results/world-production-20261126/w10/01…08` were captured; the final panorama and test rig were inspected.
- Limits: The character is labeled `TEST_ONLY_NOT_APPROVED_DEXTER` in code and snapshot. The local Dex_Sculpt repository did not contain a production-ready Dexter model; approved tricolor/floppy-ear visual references were inspected, but model approval and integration remain open. A focused browser-emulated touch entry/movement/glider pickup passed; a full physical touch journey, ten-visit resource growth, failed/interrupted loading, representative-device performance and owner visual acceptance remain pending. This is a local functional preview, not production-ready W10 art.

### Final local integration checks and open gates

- `npm run gate` passed after the exterior corrections: 149 files / 1,438 unit tests, build, 17.53 MB initial bundle under 20 MB, and `verify:dist` (256 files). The production JavaScript excludes all new world factories and W01 music while the production registry is dormant.
- Standard `npm run test:e2e` on installed Chrome/ANGLE Metal: 115 passed, four failed, one skipped in the full run. The four failures were diagnosed and corrected: the L01/W09 dormant labels, W08's droplet intersecting the sphere-west lane, and the distant-islands GPU count assertion comparing before and after one-time quality resource warming. All four passed in one focused rerun; the W08 fresh-boot one-press entry also passed after the rill move. The full suite was not repeated after these narrow fixes. Generated exterior screenshots are local test observations, not owner acceptance.
- `npm run test:workshop`: 16/16 browser cases passed plus authored-placement offline standalone readback. Its temporary Workshop manifest was restored byte-identically. `npm run build:standalone && npm run verify:standalone`: passed static, offline browser (two round trips), 14/14 installations, 17/17 visitors and zero remote requests.
- `MUSEUM_PERF_HEADLESS=1 npm run perf:device`: three headless Chrome 158 workloads passed on MacBookAir10,1 (Apple M1, 8 GB), ANGLE Metal, 1440×900, DPR 1. Budget checker **FAILED 1/12 hard limits**: exterior-walk p99 33.4 ms against ≤20 ms. Cold start 1460 ms, walk FPS 58.5, interior p95 16.7 ms, return p99 16.8 ms, second-entry worst 33 ms and 10-trip growth (0 DOM nodes, 0.6 MB heap) met their limits; first-entry worst 217 ms passed its ≤900 ms hard limit but missed the 100 ms target. Raw results and checker output are in `docs/evidence/world-production-20261126/performance/`. This headless result does not establish headed representative-device acceptance, nor does it waive the failed budget.
- W01's return screenshot was recaptured and inspected after the actual host and pose assertions. Its stopped-loop browser route leaves diagnostic HUD text stale, so the final image hides the test overlay. W01 still lacks a real-time physical-input end-to-end browser journey.
- Production remains **NOT COMPLETE**. Full physical touch, world-specific failed/interrupted load and ten-visit lifecycle, approved W10 Dexter model, owner visual/audio acceptance, performance repair and headed representative-device proof, ordered production promotion, exact-head CI and hosted verification remain open. No branch commit, push, merge or deployment was made.

### L01 resource repair and cross-world host recovery

- A new ten-visit browser sweep used the actual W02–W10/L01 development factories through the real `PocketWorldHost` with a diagnostic supported exterior entry. W01's existing route already exercised ten host cycles. First sweep: 9/10 cases passed; L01 GPU geometries rose from 896 at visit 5 to 911 at visit 10. Each L01 light-path outline created an `EdgesGeometry` outside its `ResourceScope`, leaking three geometries per visit. Tracking those three outline geometries in the world scope fixed it; full rerun **10/10 passed** with no settled geometry or texture growth, no pocket root, unchanged pose/FOV, no UI capture, and no early-exit stamp.
- A separate injected-failure and in-flight-abort suite used each of the eleven actual preview registrations. **11/11 passed:** the museum remained usable after a rejected loader and after aborting a load following real factory creation but before host commit, then a normal retry entered and returned. W10's test used one diagnostic in-memory W09 stamp; the independent real-time W09→W10 earned-unlock journey remains the authentic proof. These host diagnostics do not establish full physical touch journeys or ten complete real-time routes.
- `npm run typecheck`, `npm run lint` and the final `npm run gate` passed after the L01 repair: 149 files / 1,438 unit tests, 17.53 MB initial bundle and `verify:dist` (256 files). The final checkpoint is listed below.
- Final reversible local source checkpoint: `refs/checkpoints/world-production-final-candidate-lifecycle-verified-local`. Resolve its exact commit with `git rev-parse` in the cumulative worktree; it is a snapshot ref, not the branch head or a published commit.

### V3 continuation — W01 ordinary-input journey and inherited exterior budget

- Recovered the exact cumulative tracked and untracked tree; it matched the prior lifecycle checkpoint (`62c63532aa4959aaeec2adab1b07e1ce447be3e6`) before V3 edits. A separate, reversible takeover checkpoint was recorded as `refs/checkpoints/world-production-v3-takeover-preserved` (`75342736a7d3f97f7d3986ab062d61ab698dd653`). Branch HEAD remained `3b59e96abdc90affae19d83bfbe8030e10f3942f`.
- Added `tests/browser/w01-real-journey.e2e.ts`. Installed Chrome/ANGLE Metal ran a continuous, live-loop, keyboard route **1/1 PASS in 1.7 minutes**: eastern lagoon pearl F entry; supported central arrival; all three guided currents; F activation of reef environment, three musicians, return currents and cathedral altar; keyboard ascent to conductor; F finale; museum return and in-memory stamp with unchanged persistent passport. The only diagnostic pose placement is on the museum side for the entrance approach. The previous scripted W01 browser test remains separate diagnostic evidence. Chronological new captures are in `docs/evidence/world-production-20261126/w01-real-journey/` and linked from the owner review.
- W01's three current bundled AAC stem bytes were SHA-256 checked and match the processed hashes in `docs/W01_MUSIC_SOURCE_PROVENANCE.md` (`aa871189…`, `ef77d196…`, `3a125859…`). That record includes the owner's 2026-11-23 authorship and ownership confirmation. This is byte/provenance verification, not an owner listening acceptance of the current experience.
- Clean visual-finishing HEAD was built in a separate detached baseline worktree. Matched M1/Chrome/Metal 1440×900 diagnostic walking probes found missed frames during interior prewarm on **both** clean baseline and cumulative candidate (baseline max 33.4 ms, candidate max 33.3 ms; both focused p99 16.8 ms). Additional candidate warm telemetry found a missed frame before geometry uploads, with only about 4 ms of app render CPU. The **full three-workload** governing headless `perf:device` runs were then executed serially: clean baseline **FAILED 3/12** hard limits (idle p99 33.4 ms, walk p99 35.4 ms, second-entry worst 84 ms); cumulative candidate **FAILED 1/12** (walk p99 33.3 ms versus ≤20 ms), with the other eleven hard limits passing. An earlier two-workload targeted checker result used stale transition data and is superseded. See [V3 performance report](../evidence/world-production-20261126/v3-performance/REPORT.md). No safe source bottleneck was isolated, so no speculative renderer or content cut was adopted.
- Fresh `npm run gate` passed after the W01 journey: 149 files / 1,438 tests; initial bundle 17.53 MB of 20 MB; `verify:dist` 256 files. These checks do not establish owner visual/audio approval, physical touch, headed device acceptance, or release readiness. All production destinations remain dormant.
- The unified installed-Chrome/ANGLE Metal world browser suite passed **54/54** on this cumulative source: L01 and W01–W10 route, optional and reduced-motion cases as present; W08's prior reduced-motion flake did not recur; W02–W10/L01 real-factory ten-visit diagnostic lifecycle; all eleven real-factory failed/interrupted-load recovery cases. This is a single exact-source browser run; the diagnostic ten-visit cases are not ten complete real-time visitor journeys.
- Fresh standard installed-Chrome browser suite passed **119, failed 0, skipped 1** on this source. The intentional skip is `tests/browser/visual-regression.e2e.ts`, whose image baselines exist only for Linux SwiftShader. The four exterior failures from the prior historical run passed in this unified run. Logs are under `docs/evidence/world-production-20261126/v3-validation/`.
- `npm run test:workshop` passed **16/16** on its dedicated software-rendered runner, then built an authored standalone and read two test placements offline (`zone=plaza`, no remote requests). The script restored the original Workshop manifest and release export bytes; both files show clean in the candidate status. Ordinary `npm run build:standalone && npm run verify:standalone` then passed on the non-test artifact: static SHA-256 `195c6bcbe7ce39c0b2a18185e447a37db1757ec8e6d08e7f9f7edbeac03969a7`, two offline round trips, 17 visitors, 14/14 installations and zero remote requests. These are local artifact checks, not hosted or owner acceptance.
- Final V3 reversible source/evidence checkpoint: `refs/checkpoints/world-production-v3-local-qualified-performance-held`. This is a local snapshot ref, not the branch HEAD or a publication. Resolve its exact object with `git rev-parse` in the cumulative worktree. Production remains **NOT COMPLETE** because the 20 ms walking p99 contract and external acceptance gates remain open.

### V5 continuation — exterior-walk cause isolated, production rehearsal, W01 touch journey

- Starting tree matched `refs/checkpoints/world-production-v3-local-qualified-performance-held` (`5d9e23f`). Branch HEAD remained `3b59e96`; no branch commit.
- **Exterior walk (Lane A).** The governing route's start (`z = 184`) is inside the doorway approach, so interior construction runs on the main thread for about 1.4 s while the visitor walks. Per-frame phase tags and Chromium traces put nearly every missed frame there (11 of 71 construction frames versus 1 of 474 steady walking frames). Hardware GPU timer queries refuted a GPU cause (median 7.1 ms). Retained repair: `SustainedFrameWait` lets build and warm slices grow only after three consecutive slow waits, so one hitch no longer inflates them. Longest construction task 62→20 ms; five matched alternating pairs: construction misses 11.4→8.4. Rejected and reverted: CPU-backed text canvases. The governing p99 **still fails**. Details: [V5 performance report](../evidence/world-production-20261126/v5-performance/REPORT.md).
- **Production rehearsal (Lane B).** `src/world/pocket/productionWorlds.ts` promotes worlds only as an ordered prefix of W01→…→L01→W10, using the same lazy factories as the previews; `PRODUCTION_ACTIVE_WORLDS` is empty. A rehearsal build (`VITE_POCKET_REHEARSAL=1`, `playwright.rehearsal.config.ts`) activated all eleven: no world byte on an ordinary visit (747 KB initial transfer), canonical titles, W10 locked, W06 and L01 enterable, each world fetched on first entry only, and no stamp or bonus written to the persistent passport. Full activation adds 3.18 MB of deferred content, which the current `check:budgets` definition would count as initial (about 20.7 MB of 20 MB): owner decision, definition unchanged. [Log](../evidence/world-production-20261126/v5-validation/rehearsal-v5.log).
- **Touch (Lane C).** New `tests/browser/helpers/touch-journey.ts` drives only visitor touch controls. W01 full touch journey passed 1/1 (2.7 min). It found and fixed two visitor defects: the cathedral announcement showed raw coordinates, and the touch cue showed an `F` key cap.
- **Lane D.** No approved Dexter model was found; W10 still uses `TEST_ONLY_NOT_APPROVED_DEXTER`.
- **Qualification on this source (installed Chrome/ANGLE Metal, serial).**
  - Unified world browser suite **55/55**, including the refactored W01 keyboard journey and the new touch journey.
  - Standard browser suite **119 passed, 0 failed, 1 intentional Linux-only skip**.
  - Workshop **16/16** with authored offline readback.
  - Standalone static, offline browser and 14/14 installations, 17/17 visitors, zero remote requests.
  - Release distribution contains no world chunk.
  - Gate re-run first failed `check:budgets` (20.49 MB). The cause was the rehearsal hook in `main.ts`: Rollup loads even a dead dynamic import, and that emitted the three W01 stems into ordinary `dist` as unreferenced files. Fixed: `main.ts` now imports `pocketRehearsal.ts`, which a `vite.config.ts` resolve gate swaps for an empty `pocketRehearsal.off.ts` unless `VITE_POCKET_REHEARSAL=1`. Final `npm run gate` **PASS**: 150 files / 1,445 tests, initial bundle 17.53 MB of 20 MB, release dist PASS. Rehearsal re-run after the fix 1/1 PASS. The browser suites and perf run above ran on builds that still had those unreferenced stem files; nothing loaded them at runtime.
  - Headless M1 `perf:device` **FAILED 1/12**: exterior-walk p99 33.3 ms versus ≤20 ms. Cold start 1,367 ms, walk 58.9 fps, idle p99 16.8 ms, second-entry 50 ms (at its limit), heap growth 1.2 MB. Logs: [../evidence/world-production-20261126/v5-validation/](../evidence/world-production-20261126/v5-validation/).
- Checkpoint: `refs/checkpoints/world-production-v5-final-local` (resolve with `git rev-parse`; local snapshot ref, not a branch commit). Production remains **NOT COMPLETE**. No push, merge or deployment.

### V6 continuation — construction performance, eleven touch journeys, authentic sessions, distribution, Dexter readiness

- **Start state.** The starting tree matched `refs/checkpoints/world-production-v5-final-local`. Branch HEAD was `3b59e96`, and everything stayed local until the owner asked for a commit and push at the end of V6.
- **A. Construction performance.**
  - The seven coarse interior build steps are now generator routines (`src/util/buildSteps.ts`) that yield at consistent boundaries. One routine serves both the cooperative and the synchronous build.
  - Matched A/B, five pairs: exterior-walk p99 went from 33.3–50.0 ms (V5) to 16.8 ms (V6) in 5/5 pairs.
  - `perf:device` run 1 passed 12/12. Runs 2 and 3 failed 9/12 and 10/12 under heavy machine load. [V6 performance report](../evidence/world-production-20261126/v6-performance/REPORT.md).
- **B. Touch.**
  - All eleven worlds have a full browser-emulated touch journey that drives only visitor touch controls: 11/11. [captures](../evidence/world-production-20261126/v6-touch/).
  - Physical-device touch is **UNVERIFIED**.
- **C. Authentic sessions.**
  - Natural approaches walk from the pier on foot to the seven ground entrances (W01, W02, W03, W08, W09, L01, W10 pier): 7/7.
  - Interior and rooftop entrances (W04–W07, W10 roof) still use labelled museum-side diagnostic placement.
  - Cross-world sessions on foot:
    - keyboard earned progression: W09 earned, W10 unlocked by that stamp and completed, L01 completed twice without stamp inflation;
    - touch earned progression, the same route (11.1 min);
    - early exits across W08 → W03 → W01 (music playing) → W08.
  - In every session, geometry, textures, programs and pocket roots return to the same values at the same spot. Music sessions return to 0. The heap did not grow (72–95 MB). The persistent passport was untouched.
  - [captures](../evidence/world-production-20261126/v6-sessions/).
- **D. Distribution.** [V6 distribution report](../evidence/world-production-20261126/v6-distribution/REPORT.md).
  - The analysis covers raw, gzip and brotli sizes for each class.
  - **Safe reduction:** the build no longer ships the 133 builder-catalog files the placement manifest does not reference (4.96 MB). The checker-counted size went 17.54 → 12.58 MB with the 20 MB rule unchanged. All eleven worlds active comes to about 15.7 MB.
  - Option A or B remains the owner's decision.
  - `verify:dist` now fails an ordinary build containing any world chunk, orphan stem or rehearsal code. Regression test 4/4.
  - Rehearsals 5/5:
    - staged prefixes 0/1/6/9/10/11;
    - earned progression in the production build, persisting across a reload;
    - failed and interrupted lazy loads;
    - activated offline package (25.9 MB, no network, W08 and W01 on foot).
  - The rehearsal found a **visitor defect**: after a failed download, focus fell out of the entry dialog, so "Back (Esc)" did nothing. Fixed in `PocketTransition`.
- **E. Bounded finishing.**
  - W10's third-person camera now stays in front of cliffs and walls (`thirdPersonBoom.ts`). With its back to the climb cliff the boom goes 5.42 → 3.98 m, then back to 5.42 m. [capture](../evidence/world-production-20261126/v6-finishing/).
  - An earlier note claimed the camera sat inside rock on the route. That was a misreading of the frames; the route frames are unchanged.
  - No other per-world art or gameplay was changed without owner direction.
- **F. Dexter readiness.**
  - W10 builds its character only through the `DexterCharacter` seam, with the labelled test-only rig.
  - Asset contract and validator done (4/4).
  - [Model-production handoff](W10_DEXTER_MODEL_HANDOFF.md).
  - No model was created or substituted; nothing was sent externally.
- **G. Final qualification** on candidate `refs/checkpoints/world-production-v6-candidate`.
  - Source identity (sha256 over the source file list): `6bb3cc108cb342bc`.
  - Installed Google Chrome 158.0.8127.88 (ANGLE Metal), run serially.
  - **Gate PASS:** 153 files / 1,458 tests; initial bundle **12.58 MB** of 20 MB; release dist PASS.
    - The first run failed lint only on scratch builds left in `perf-results/v6/`. They were moved out of the worktree; no source change.
  - **Content-isolation scan PASS:**
    - no world factory, activation module, stem or rehearsal code in the ordinary `dist`;
    - no world-internal text (positive control 11/11 in the rehearsal build);
    - protected checkouts untouched;
    - W01 audio identical to V5.
  - **Unified world suite: 74/76 in one invocation.**
    - The W01 keyboard journey missed one aim after an unexplained 5.8 m player displacement. It passed 1/1 when rerun alone; the cause is **unexplained**.
    - The touch cross-world session stalled twice at the same W09 meteor-cascade pinch point. The route now steps back as a visitor would, and the session passed 1/1 (9.3 min). That run never reached the pinch, so the step-back is not yet exercised.
    - W09 journeys 3/3 after the route change.
  - **Standard browser suite: 115 passed, 4 failed, 1 intentional skip in one invocation.**
    - All four failures were interruption tests whose hook still patched `SourceVisitors.fromKit`, which V6's stepwise build no longer calls. The hooks moved to `fromKitSteps` at the same boundaries.
    - The interruption file then passed 10/10, giving 119 passed + 1 skip overall.
  - **Workshop 16/16** plus the authored offline readback PASS.
  - **Ordinary standalone PASS:** static checks, offline browser with 2 round trips and 17 visitors, installations 14/14, visitors 17/17, remote requests 0.
  - **Rehearsal 5/5** in one invocation:
    - activated offline package 25.9 MB;
    - production activation with initial transfer 749 KB;
    - staged prefixes;
    - earned progression W09 → W10 surviving a reload;
    - failed and interrupted loads, with focus kept in the dialog.
  - **`perf:device` ×3, serial, headless installed Chrome:** **FAIL in all four runs:** 4/12, 5/12, 6/12 and 6/12 budgets passed.
    - Even exterior idle p99 missed (33–50 ms) while interior steady and Workshop often held 16.8 ms. The 1-minute load reached 32, with the system's `suggestd` (~85–90% CPU) and `replayd` screen capture (~68%) running outside this campaign.
    - **Matched control:** the 21:11 build that passed 12/12 at 21:15 was alternated with the candidate in the same conditions. The 21:11 build now misses just as badly (idle p99 33–50, walk 50–67 ms), while the candidate was clean in 2 of 3 trials (16.8 / 16.8 ms).
    - This points to the machine's current state, not a code regression. The repeated-trial acceptance criterion is **NOT MET** on the exact candidate.
    - [summary](../evidence/world-production-20261126/v6-validation/perf-final-summary.txt), [control](../evidence/world-production-20261126/v6-validation/ab-regress.txt).
  - Logs: [v6-validation](../evidence/world-production-20261126/v6-validation/).
- Checkpoint: `refs/checkpoints/world-production-v6-final-local`. At the owner's request (2026-11-27), the branch was committed and pushed to `origin/feat/world-production-20261126`. No merge, no deployment, no production activation. Production remains **NOT COMPLETE**.
