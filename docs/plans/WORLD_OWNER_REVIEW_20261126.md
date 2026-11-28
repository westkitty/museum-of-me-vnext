# Eleven-world owner review — local candidate, 2026-11-26

**Status: NOT COMPLETE for production.** This package describes a local development preview in `feat/world-production-20261126`; the inherited state is preserved at `refs/checkpoints/world-production-final-candidate-lifecycle-verified-local`, with a newer V3 takeover checkpoint recorded in the ledger. All eleven canonical production destinations remain dormant. Captures were inspected by the agent; they are not owner visual acceptance. W01 now has a separate continuous keyboard journey in addition to its older scripted diagnostic. W10 uses an explicitly test-only character rig.

## Open the candidate

From `/Users/andrew/museum of me/worktrees/wt-world-production-20261126`, run `npm run dev -- --host 127.0.0.1 --port 4191 --strictPort`, then open [all development previews](http://127.0.0.1:4191/?preview=all). This uses the existing museum runtime. Follow its normal ticket and walking flow. The entry anchors below become playable only in this development preview. W10 appears after completing any stamped W01–W09 world; L01 gives no stamp. The optional `?qa=1&preview=all` URL skips the arrival and shows a diagnostics overlay.

Every completion uses the real host return path. Development preview passports are in memory and do not write a persistent stamp. [World ledger](../plans/WORLD_PRODUCTION_LEDGER_20261126.md) contains route details, focused checks and limitations. Historical checkpoint refs are local Git objects, not branch commits or publication.

V3 exact-source local checks: gate 149/149 files and 1,438/1,438 unit tests; unified world browser 54/54; standard museum browser 119 passed, zero failed, one intentional Linux-only visual-baseline skip; dedicated Workshop 16/16 plus authored offline readback; ordinary standalone static/offline/runtime-source verification passed. The full headless M1 candidate performance harness failed the exterior walking p99 budget at 33.3 ms versus ≤20 ms; clean baseline failed the same budget at 35.4 ms. [Performance evidence](../evidence/world-production-20261126/v3-performance/REPORT.md). These local checks do not establish physical touch, headed device performance or owner approval.

## World receipts

### W01 — Great Ocean Procession

- Entry: `?preview=w01`; East lagoon bank dive pearl.
- Route and completion: Guided currents connect the turtle, ray and whale reefs; musicians reveal three synchronized owner-authored stems; coral cathedral and conductor finale. Complete at the world exit and return to the museum.
- Checkpoint: `67e44fc` source lane; cumulative local checkpoint in the ledger. Checks: 3/3 inherited unit; 2/2 inherited scripted diagnostic browser; **1/1 fresh continuous keyboard journey** (1.7 minutes). The new journey uses F for every world control, W/Q/E/PageUp/PageDown/Shift for travel and aiming, and the live application loop throughout. Its museum-side anchor approach is diagnostically placed, as in the other world journeys.
- New chronological views: [Entrance](../evidence/world-production-20261126/w01-real-journey/01-lagoon-pearl.png) · [Arrival](../evidence/world-production-20261126/w01-real-journey/02-central-arrival.png) · [Turtle reef](../evidence/world-production-20261126/w01-real-journey/03-musician-turtle.png) · [Ray reef](../evidence/world-production-20261126/w01-real-journey/04-musician-ray.png) · [Whale reef](../evidence/world-production-20261126/w01-real-journey/05-musician-whale.png) · [Cathedral](../evidence/world-production-20261126/w01-real-journey/06-cathedral-assembled.png) · [Return](../evidence/world-production-20261126/w01-real-journey/07-return-to-lagoon.png). Captures include a QA overlay and are agent test evidence; its world field lags the immediate return frame, while the museum HUD, stamp message and browser world assertion show the return.
- V5: **1/1 full browser-emulated touch journey** (2.7 minutes, installed Chrome/ANGLE Metal) uses only the left-half stick, right-half look drags, centre-dot taps and a tapped Enter button, from the lagoon pearl to the conductor finale and museum return ([pearl](../evidence/world-production-20261126/v5-validation/w01-touch-journey/01-lagoon-pearl.png) · [cathedral](../evidence/world-production-20261126/v5-validation/w01-touch-journey/06-cathedral-assembled.png) · [return](../evidence/world-production-20261126/v5-validation/w01-touch-journey/07-return-to-lagoon.png)). Two defects found by that run and repaired: the cathedral announcement read out raw coordinates (`[0, 6, -44]`); it now names the Conductor's Platform. And the touch interaction cue showed an `F` key cap; it is hidden in touch mode. The cathedral capture predates the wording repair.
- Open: Physical-device touch, repeat real-time completion and owner visual/audio approval. Music authorship and ownership were confirmed by the owner on 2026-11-23 in [the provenance record](../W01_MUSIC_SOURCE_PROVENANCE.md). Production integration: dormant; no merge, push, install or deploy.

### W02 — Prehistoric Fern Island

- Entry: `?preview=w02`; Western Fern Ravine frond.
- Route and completion: Root climb, growing supported bridge, Elder Fern awakening and root gate. Complete at the world exit and return to the museum.
- Checkpoint: `0c665c6`. Checks: unit and keyboard browser pass.
- Views: [Entrance](../evidence/world-production-20261126/w02/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w02/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w02/03-mechanic-bridge-growing.png) · [Transformation](../evidence/world-production-20261126/w02/04-transformation-bridge-grown.png) · [Finale](../evidence/world-production-20261126/w02/05b-finale-island-revealed-west.png) · [Return](../evidence/world-production-20261126/w02/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W03 — Clockwork Sundial

- Entry: `?preview=w03`; Southwest astronomical terrace gnomon.
- Route and completion: Scheduled turnstile and shuttle carry the visitor to the orrery; captive sunrise restored. Complete at the world exit and return to the museum.
- Checkpoint: `43ec040`. Checks: unit and keyboard browser pass.
- Views: [Entrance](../evidence/world-production-20261126/w03/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w03/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w03/03-mechanic-turnstile-turning.png) · [Transformation](../evidence/world-production-20261126/w03/04-transformation-shuttle-to-orrery.png) · [Finale](../evidence/world-production-20261126/w03/05b-finale-dawn.png) · [Return](../evidence/world-production-20261126/w03/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W04 — Digital Beat World

- Entry: `?preview=w04`; E19 DexTilt desktop display.
- Route and completion: Played beats raise bridge sections; phrase shifts build the equalizer stair; final drop lights the world. Complete at the world exit and return to the museum.
- Checkpoint: `92e4fec`. Checks: unit and keyboard browser pass.
- Views: [Entrance](../evidence/world-production-20261126/w04/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w04/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w04/03-mechanic-beats-raise-bridge.png) · [Transformation](../evidence/world-production-20261126/w04/04-transformation-eq-stair.png) · [Finale](../evidence/world-production-20261126/w04/05b-finale-world-lit.png) · [Return](../evidence/world-production-20261126/w04/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W05 — Impossible Greenhouse

- Entry: `?preview=w05`; Rooftop glasshouse flower.
- Route and completion: Mirror-lit lilies grow across water; raft reaches Vine Gallery; light and dew open the bloom. Complete at the world exit and return to the museum.
- Checkpoint: `d254e3d`. Checks: unit and keyboard browser pass.
- Views: [Entrance](../evidence/world-production-20261126/w05/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w05/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w05/03-mechanic-light-grows-lily.png) · [Transformation](../evidence/world-production-20261126/w05/04-transformation-cistern-floods.png) · [Finale](../evidence/world-production-20261126/w05/05b-finale-dawn-bloom.png) · [Return](../evidence/world-production-20261126/w05/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W06 — Skyborne Gardens

- Entry: `?preview=w06`; Rooftop Flight Pad II console.
- Route and completion: Parasol glide, orchard and terrace updrafts, thermal to summit and Great Migration. Complete at the world exit and return to the museum.
- Checkpoint: `bc23ca9`. Checks: unit and keyboard browser pass.
- Views: [Entrance](../evidence/world-production-20261126/w06/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w06/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w06/03-mechanic-gliding-to-orchard.png) · [Transformation](../evidence/world-production-20261126/w06/04-transformation-updraft-lift.png) · [Finale](../evidence/world-production-20261126/w06/05b-finale-golden-gardens.png) · [Return](../evidence/world-production-20261126/w06/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W07 — Portal Slingshot Trials

- Entry: `?preview=w07`; Least-populated wing test-lab door.
- Route and completion: Three chambers use paired portals, momentum and latching plates; calibration opens exit. Complete at the world exit and return to the museum.
- Checkpoint: `5b6bb28`. Checks: unit and keyboard browser pass.
- Views: [Entrance](../evidence/world-production-20261126/w07/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w07/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w07/03-mechanic-linked-portals.png) · [Transformation](../evidence/world-production-20261126/w07/04b-fling-across-the-gap.png) · [Finale](../evidence/world-production-20261126/w07/05b-finale-exit-portal-open.png) · [Return](../evidence/world-production-20261126/w07/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W08 — World Inside a Raindrop

- Entry: `?preview=w08`; Reflecting-rill suspended droplet.
- Route and completion: Prism lenses set glass paths; drift pad and rising bubble reach crown; falling splash opens ring. Complete at the world exit and return to the museum.
- Checkpoint: `ed160e6; 8465317 entry fix`. Checks: 7/7 unit; 3/3 prior browser; 3/3 fresh-boot single F.
- Views: [Entrance](../evidence/world-production-20261126/w08/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w08/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w08/03-mechanic-light-sets-glass-stair.png) · [Transformation](../evidence/world-production-20261126/w08/04b-bubble-rising.png) · [Finale](../evidence/world-production-20261126/w08/05b-finale-splash.png) · [Return](../evidence/world-production-20261126/w08/06-return.png).
- Open: Owner visual/touch/device approval. The final-candidate W08 journey passed in the cumulative world run, and one-press entry passed again after the rill placement correction. Production integration: dormant; no merge, push, install or deploy.

### W09 — Museum Between Seconds

- Entry: `?preview=w09`; Southern ruined observatory orrery.
- Route and completion: Intentional movement advances local time; align constellations, cross meteor cascade, restore celestial crown. Complete at the world exit and return to the museum.
- Checkpoint: `f64db82`. Checks: 2/2 unit; 1/1 keyboard browser; earned stamp unlocked W10.
- Views: [Entrance](../evidence/world-production-20261126/w09/01-entrance.png) · [Arrival](../evidence/world-production-20261126/w09/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/w09/03-mechanic-orrery-bridge.png) · [Transformation](../evidence/world-production-20261126/w09/04-transformation-constellations.png) · [Finale](../evidence/world-production-20261126/w09/05b-final-alignment.png) · [Return](../evidence/world-production-20261126/w09/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### L01 — Lighthouse at World's End

- Entry: `?preview=l01`; Peninsula lighthouse gallery lens.
- Route and completion: Sweeping beam reveals three solid paths; keeper beacon restores distant coast panorama; bonus completion adds zero stamps. Complete at the world exit and return to the museum.
- Checkpoint: `523cfed`. Checks: 2/2 unit; 3/3 keyboard browser including reduced motion and repeat.
- Views: [Entrance](../evidence/world-production-20261126/l01/01-entrance.png) · [Arrival](../evidence/world-production-20261126/l01/02-arrival.png) · [Mechanic](../evidence/world-production-20261126/l01/03-mechanic-first-light-path.png) · [Transformation](../evidence/world-production-20261126/l01/04-transformation-third-light-path.png) · [Finale](../evidence/world-production-20261126/l01/05b-coastal-panorama.png) · [Return](../evidence/world-production-20261126/l01/06-return.png).
- Open: Owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

### W10 — Breath of the Weasel

- Entry: `?preview=w10`; Pier wind guide after an earned W01–W09 stamp; separate rooftop signal.
- Route and completion: Third-person glider and wind, cliff grip climb, two movable shrine blocks, optional cedar seed and far overlook. Complete at the world exit and return to the museum.
- Checkpoint: `8465317`. Checks: 2/2 unit; keyboard route and rooftop checks; earned W09-to-W10 entry.
- Views: [Entrance](../evidence/world-production-20261126/w10/01-entrance-pier.png) · [Arrival](../evidence/world-production-20261126/w10/02-arrival-plateau.png) · [Mechanic](../evidence/world-production-20261126/w10/03-mechanic-glide-to-valley.png) · [Transformation](../evidence/world-production-20261126/w10/05-shrine-opens.png) · [Finale](../evidence/world-production-20261126/w10/06-final-panorama.png) · [Return](../evidence/world-production-20261126/w10/07-return.png).
- Open: Approved Dexter model absent: TEST-ONLY rig; owner visual/touch/device approval. Production integration: dormant; no merge, push, install or deploy.

## Shared acceptance boundary

The final project gate passed 149 files / 1,438 unit tests plus its release checks after the touch-input correction. The cumulative world browser sweep passed 29/30, then the W08 reduced-motion case passed on a focused rerun after correcting its test route; all 30 cases pass on the pre-touch runtime, though not in one green invocation. Browser-emulated touch checks passed for W10 pier entry, movement and glider pickup, and for W09's movement-controlled clock. Full physical touch journeys, real-time repeated journeys, representative-device performance, owner visual review and exact-head continuous integration remain separate. W01 music is owner-authored and bundled, with provenance in [W01 music source provenance](../W01_MUSIC_SOURCE_PROVENANCE.md). W10 needs a production-approved Dexter model before any art sign-off.

The final source gate passed again after the four exterior regressions were repaired. The standard museum browser run was 115 passed, four failed, one skipped; all four failures passed a focused rerun after correcting dormant labels, lifting the W08 rill droplet out of a sphere walking lane, and comparing settled quality cycles. The W08 authentic entry passed again after the lift. Workshop authoring passed 16/16 and its authored offline readback; the ordinary standalone verifier passed two offline round trips, 14/14 installations, 17/17 visitors and zero remote requests. [Headless M1 results](../evidence/world-production-20261126/performance/headless-m1-budget-check.txt) failed one hard budget: exterior-walk p99 33.4 ms versus 20 ms. This is not headed representative-device acceptance.

Subsequent host diagnostics entered and exited the real W02–W10/L01 factories ten times each (10/10 cases pass); the preexisting W01 browser route covers its ten cycles. L01 initially leaked three untracked edge geometries per visit; the resource-scope fix passed the complete rerun. Injected failed and interrupted loads against all eleven preview registrations recovered to a usable museum, followed by successful retry (11/11 cases). These diagnostics do not replace ten complete real-time visitor journeys or physical touch acceptance. The final source gate after the L01 fix is recorded in the ledger.

## V5 consolidated owner request (2026-11-26)

Candidate: `refs/checkpoints/world-production-v5-exp1-rehearsal-touch` (resolve with `git rev-parse`; local object, not a branch commit). The review server at `http://127.0.0.1:4191/?preview=all` is Vite dev from this worktree, so it serves the current working tree, V5 included. Approval state for every world: **PENDING OWNER**. No world is owner-accepted or device-accepted.

Please decide, in one pass:

1. **Artistic and audio acceptance, in promotion order.** Start with W01, then W02 onward, using the world receipts above. For W01, listen with sound on and then muted: every musical cue has a visual counterpart (musician glow, reef awakening, cathedral assembly).
2. **W10 character.** No approved production Dexter model exists in the accessible files; the playable rig is `TEST_ONLY_NOT_APPROVED_DEXTER`. Either supply or approve a model source, or authorize preparing a REVIEW-ONLY candidate from your approved references. Nothing has been sent to an external or paid service.
3. **Exterior-walk performance strategy** (the hard 20 ms p99 still fails; see [V5 report](../evidence/world-production-20261126/v5-performance/REPORT.md)). Either (a) engineering continues splitting the six coarse interior build steps, with no design change, or (b) you approve building the interior during the arrival/ticket window instead of only on the doorway approach, which changes a documented choice.
4. **Release budget definition.** Activating all eleven worlds adds 3.18 MB of lazily fetched content (3.0 MB of W01 stems, about 250 KB of world code). First-visit transfer is unchanged (rehearsal: no world byte on an ordinary visit). But `check:budgets` counts every shipped file as "initial visit", so full activation would read about 20.7 MB against the 20 MB limit. Either declare pocket-world content as deferred (as `embedded/full-weasel` already is) or require smaller stems. The definition has not been changed.

### Physical-device touch acceptance (manual, per world)

On an iPhone or iPad and an Android phone, with Safari and Chrome, at the review URL (same network, `--host 0.0.0.0` if needed): walk with the left-half stick and look with a right-half drag; tap the centre dot on each world control and confirm the cue shows no keyboard key. Tap the entry dialog's Enter, complete the world and return. Then check:

- W01: currents and the cathedral, with sound on and muted.
- W02: the root climb and the bridge.
- W04: traversal without gestures.
- W06: glide and landing.
- W07: portal aiming.
- W08: bubbles.
- W09: time advancing only while you walk.
- W10: glide, climb and shrines.

Record device, OS, browser, world and pass/fail with a short note. Browser-emulated touch has passed only for W01 (full route), W09 (clock) and W10 (entry and glider).

## V6 owner request (2026-11-27)

Candidate: `refs/checkpoints/world-production-v6-final-local` (local snapshot), pushed as branch `feat/world-production-20261126`. Approval state for every world: **PENDING OWNER**. No world is owner-accepted or device-accepted. All touch results below are browser emulation in installed Chrome, not physical devices.

What changed for you to review:

- **Touch.** Every world now has a full browser-emulated touch journey, 11/11, driving only the visitor's stick, look drags and centre taps. [Captures](../evidence/world-production-20261126/v6-touch/). The physical-device checklist above still applies.
- **Natural approaches.**
  - The seven ground entrances are now reached on foot from the pier: W01, W02, W03, W08, W09, L01 and the W10 pier. [Captures](../evidence/world-production-20261126/v6-sessions/natural-approach/).
  - The interior and rooftop entrances (W04–W07, W10 roof) are still placed diagnostically in tests.
- **Long sessions.**
  - Earned progression on foot passes by keyboard and by touch: W09 completed, then W10 unlocked by that stamp and completed, then L01 completed twice without a stamp.
  - Early exits across four worlds pass.
  - Resources and music return to the same values each time, and your real passport is never written.
- **W10 camera.** The third-person camera now moves in front of cliffs instead of sitting behind them when you turn your back to a wall. [Facing vs back to the cliff](../evidence/world-production-20261126/v6-finishing/w10-boom-facing-vs-back-to-cliff.jpg).
- **Entry dialog.** After a failed world download, Esc ("Back (Esc)") now works straight away; before V6 it needed a click.

Decisions for you:

1. **Release budget definition: Option A or B** ([report](../evidence/world-production-20261126/v6-distribution/REPORT.md)).
   - With unreferenced builder-catalog files no longer shipped, the ordinary build counts 12.58 MB, and all eleven worlds active about 15.7 MB.
   - Both fit the unchanged 20 MB rule, so this is no longer blocking.
   - Option B (count world chunks as deferred) describes what a visitor actually downloads.
2. **Builder-catalog prune.** Applied as a build step. Public builds now carry only the catalog files your placements reference. The development Workshop still browses the whole catalog. Reverting is one plugin entry in `vite.config.ts`.
3. **The `interior` chunk loads at boot** (about 1.8 MB raw). Making it lazy would move that parse into the doorway-approach walk, which just came under budget. I left it alone; whether to try it is your call.
4. **W10 Dexter model.** The seam, technical contract and validator are ready. The [model handoff](W10_DEXTER_MODEL_HANDOFF.md) lists what you supply or approve. No model was made or substituted.
5. **W09 meteor cascade, gameplay finding.**
   - The stones move only while you move. A stone at rest beside the rail can leave too narrow a gap, and a visitor who keeps pushing forward is held until they step back.
   - The touch session stalled there twice. The test now steps back, as a visitor would; the rerun that passed never reached the pinch, so that behaviour has not been exercised yet.
   - Whether the world should hint at this or widen the gap is a design choice. Nothing was changed.
6. **Performance.**
   - The exterior walk now meets its 20 ms p99 in matched trials (16.8 ms in 5/5 pairs). One full `perf:device` run passed 12/12.
   - The final repeats on the exact candidate failed (4–6/12) while the machine was heavily loaded by other processes. The earlier passing build failed the same way in a matched control, so this is not attributed to code.
   - Please allow a repeat on a quiet machine, or on the headed representative device, before performance sign-off. Headed and physical-device performance remain unmeasured.

## V7 owner request (2026-11-27)

Candidate: `refs/checkpoints/world-production-v7-final-candidate` (local snapshot; its code and the V7 documentation were committed and pushed to PR #83 at the owner's request on 2026-11-27). Approval state for every world: **PENDING OWNER**. No world is owner-accepted or device-accepted. Touch results are browser emulation. Full report: [V7 report](../evidence/world-production-20261126/v7/REPORT.md).

What changed for you to review:

- **Every entrance is now reached on foot from the pier**, including the interior and rooftop ones:
  - W04 through the front door to the E19 bay;
  - W07 up the grand stair to the infra-wing lab door;
  - W05, W06 and the W10 roof up the West Flank Ascent.
  [Captures](../evidence/world-production-20261126/v7/museum-approach/).
- **W09, behaviour change for your acceptance.** A visitor pushing against something (a rail, a meteor stone) now moves the sky at walking pace. Before, they could be pinned by a stone that only moves with the sky, which is the V6 stall. Standing still still freezes time. This answers V6 decision 5 by repair rather than a hint or a wider gap. It is reversible in one line if you prefer the old rule.
- **W01.** The V6 "unexplained 5.8 m displacement" was the test walker, not your world. W01 is unchanged.
- **W10 Dexter.** The seam now refuses any character that lacks your recorded approval and provenance or fails the technical contract, and falls back to the labelled test rig. Nothing was made or approved.
- **Long sessions.** Two passes over six worlds, with completions, early exits and failed and interrupted loads, leave no residue.

Decisions for you:

1. **Accept or revert the W09 rule change** above.
2. **Physical-device acceptance.** About 30–40 minutes on one phone or tablet: [procedure](WORLD_DEVICE_ACCEPTANCE_V7_20261127.md). It is the only way to clear "physical touch: UNVERIFIED".
3. **Performance sign-off.** Performance is **FAILED, attribution unresolved.**
   - The final candidate scored 8/12, 10/12 and 9/12 over three admissible-start trials.
   - The misses are dropped-frame p99s (33 ms) and second-entry spikes.
   - The host load during those trials (15–35) was far above that during the passing baseline-1 (12/12, load 5), on effectively the same measured code.
   - **Decide:** run a matched, interleaved A/B on a quiet machine (about 45 minutes, nothing else open), or accept performance as not signed off for V7. Thresholds stay as they are either way.
4. **Still open from V6:**
   - per-world visual and audio acceptance;
   - an approved Dexter model ([handoff](W10_DEXTER_MODEL_HANDOFF.md));
   - budget definition A or B;
   - whether the `interior` chunk becomes lazy;
   - merging PR #83 (squash).
5. **Publication.** Approved on 2026-11-27. V7 was committed and pushed to PR #83, with no merge or deploy. The Bible entry still needs its own approval.
