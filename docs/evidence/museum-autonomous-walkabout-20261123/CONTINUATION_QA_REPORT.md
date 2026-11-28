# Great Museum Walkabout continuation · 2026-11-23

**PARTIAL.** E20 and the three cast crowns passed their rendered and focused checks. The final M1 run missed seven budgets. WA-06 and human acceptance remain open.

The work resumed from the existing unstaged candidate on `feat/museum-autonomous-walkabout-20261123` at `ff6d983ebe47c0d4dc7980a9632f89925cb3f0d4`. The historical report remains in [FINAL_QA_REPORT.md](FINAL_QA_REPORT.md). This pass addressed the open E20 finding and checked the existing cast and architecture independently.

## E20 workbench

**Implemented and verified in Chrome/Metal.** The empty common plinth in E20 covered the lower bench and occupied the centre approach. The regression failed before the repair on three plinth layers between the authored 1.64 m eye point and the underside of the built workbench. E20 now omits both the plinth and its collider. The floor medallion remains as the room's existing viewing marker. The mount, bespoke bench, sort console and DexVault installation were not moved. The focused tests cover the sightline, traversal through the former footprint, the adjacent E21 plinth and installation clearance.

The matched 1280 × 720 captures use the same camera at (51, 1.64, 10.2), the same heading and the same medium-quality setting. Held-W probes walked from the hall, across the former footprint and back. A separate input probe focused **Audit and sort the files**, pressed F and observed E20 in the Journal.

- [Before](../../../test-results/walkabout/continuation/e20-before/standard-view.png) · [After](../../../test-results/walkabout/continuation/e20-after/standard-view.png)
- [Oblique bench and console](../../../test-results/walkabout/continuation/e20-after/oblique-workbench.png) · [Reverse approach and DexVault](../../../test-results/walkabout/continuation/e20-after/reverse-to-hall.png)
- [Before camera and walk trace](../../../test-results/walkabout/continuation/e20-before/inspection.json) · [After camera and walk trace](../../../test-results/walkabout/continuation/e20-after/inspection.json) · [Input trace](../../../test-results/walkabout/continuation/interaction-near/inspection.json)

## Authored cast

Reviewed all 17 individual portraits in their gallery context. Checked the seated and Sanctuary figures from oblique angles with nearby visitors rendered together. The Gallery Attendant, Forensic Analyst and Systems Student showed intermittent scalp patches at the crown. Their common crop shell was shorter than the head mesh. The regression failed at the crown before the repair and passed after the existing shell was brought above the scalp. The body batch, geometry count, materials, routes, animation update cadence and interaction registrations retain their existing design. The [visitor ledger](VISITOR_VISUAL_LEDGER.md) records each visual outcome.

## Apple M1 comparison

The unchanged budget checker evaluated the archived comparison and a fresh candidate-then-clean-main pair. All four runs used the same physical MacBook Air M1, 8 GB, Chrome 157, ANGLE Metal, 1440 × 900 and DPR 1. Clean main was `ff6d983ebe47c0d4dc7980a9632f89925cb3f0d4` in the separate baseline worktree. All three measurement cases completed in each run.

| Original six misses and additional current miss | Limit (ms) | Earlier main | Earlier candidate | Fresh main | Final candidate |
|---|---:|---:|---:|---:|---:|
| Cold start | 2,000 | 2,207 | 3,267 | 3,205 | 3,374 |
| Exterior idle p99 | 20 | 48.3 | 35.3 | 33.8 | 33.4 |
| Exterior walking p99 | 20 | 81.8 | 34.9 | 50.2 | 50.1 |
| Exterior after return p99 | 20 | 34.7 | 32.7 | 17.7 (pass) | 50 |
| Workshop sweep p99 | 20 | 48 | 35 | 34.2 | 34.4 |
| Second entry worst frame | 50 | 119 | 116 | 84 | 283 |
| Fixed 2,000-placement Workshop p99 | 20 | 33.4 | 18.7 (pass) | 33.3 | 33.6 |

The final candidate meets five of twelve hard limits, including steady interior p95 at 17.6 ms (fresh main 17.4 ms). The additional Workshop miss reproduced on both clean-main runs. Exterior return was worse in the fresh pair after running slightly better in the earlier pair. The final second-entry run had per-repeat peaks of 283, 67 and 118 ms, against 84, 50 and 84 ms on fresh main. The earlier candidate and main peaks were 116 and 119 ms. Cold-start maxima were higher on both candidate runs. Fresh cold-start medians were 2,308 ms for the candidate and 3,023 ms for main. These are measurable sample differences. The sequential runs do not establish a repeatable regression attributable to the visitor or E20 changes. All seven miss categories have failed on clean main, and every hard limit still applies.

All four production first-entry fixtures recorded the exterior. Their warning row represents preparation, with actual ticketed entry and re-entry independently verified by the live browser walk. A bounded performance follow-up should alternate clean main and the candidate in a quiet session, capture a genuinely ticketed first entry, and profile cold-start, exterior return and second-entry stalls before attributing or changing runtime work. Shared pocket-world and music systems remain outside this commission.

[Earlier comparison and raw paths](PERFORMANCE_REPORT.md) · [Fresh candidate device log](../../../test-results/walkabout/continuation/m1-final/perf-device.log) · [Fresh clean-main device log](../../../test-results/walkabout/continuation/m1-baseline-repeat/perf-device.log)

## Rendered walkabout and final checks

- **Live Chrome/Metal.** The continuous ticketed visit completed 42 legs, including the Rotunda, exit and re-entry, with no diagnostic repositioning after spawn. Separately, all 35 bay probes walked in and out from hall-side fixtures, completing 70 legs. Each bay was captured facing its exhibit and again facing the hall from the reached position. Both runs recorded zero browser errors. [Continuous visitor trace](../../../test-results/walkabout/continuation/after-live/inspection.json) · [Bay trace and camera index](../../../test-results/walkabout/continuation/rendered-bays/inspection.json)
- **Adversarial visual views.** The final walk inspected both stair edges from up and down the run, the Rotunda, Cinema threshold, Sanctuary and reverse bay mouths. The broad coloured wall inlay visible across the E19 reverse sightline is a current presentation defect with a matching mesh hit. Similar reverse framing appears in other wings. Standing approaches and returns remained traversable. See [WA-06](DEFECT_LEDGER.md#continuation--2026-11-23).
- **E20 performance scope.** The matched view dropped from 277 to 273 renderer draw calls and from 18,292 to 16,804 submitted triangles. The crop correction changes existing vertex positions. It adds no body batch, material, animation update or acquisition path.
- **Automated.** All 111 focused cases passed. The unchanged project gate passed all 1,347 tests in 133 files and all subsequent validators, with 16.39 MB in the 20 MB initial package budget. The standalone build was verified offline in Chrome/Metal, with two round trips, 14/14 installations, 17/17 conversations and zero remote requests. [Focused log](../../../test-results/walkabout/continuation/focused-final.log) · [Project gate](../../../test-results/walkabout/continuation/gate.log) · [Standalone log](../../../test-results/walkabout/continuation/verify-standalone.log)
- **Browser traversal.** The current inventory passed 64/64 passages, 190/190 lanes in both directions and 35/35 exhibit approaches. The continuous grand tour recorded 303 legs and 2,179 m with a ticket, all 35 visits, and successful exit and re-entry. The rooftop case passed, and I inspected its rendered ramp, Greenhouse doorway, Café and Hot Dog Stand, and Flight Pad II views. The reviewed standing routes showed no missing floor or wall, hidden display beyond the repaired bench, or circulation blocker. [Passage report](../../../test-results/traversal/report.md) · [Grand tour trace](../../../test-results/traversal/grand-tour.json) · [Rooftop captures](../../../test-results/walkabout/continuation/browser-run/browser-rooftop.e2e.ts-ISL-6d9a8-Dog-Stand-and-Flight-Pad-II-chromium/rooftop-evidence/capture-manifest.json)

- **Cinema browser controls.** The eight-case selection finished 7/8 on the first pass. The local-film case reached playback and pause, then the immediate restart check read 0.0018 s against exact zero. An isolated rerun of the unchanged case passed, including restart, seek, stand and exit. This leaves one observed intermittent exact-time assertion with no further Cinema edit. [Initial browser log](../../../test-results/walkabout/continuation/browser.log) · [Isolated retry](../../../test-results/walkabout/continuation/cinema-retry.log)

## Changed-file audit

| Ownership | Files |
|---|---|
| Continuation runtime | `src/world/Museum.ts`, `src/world/GalleryPlinth.ts`, `src/world/VisitorVisuals.ts` |
| Continuation regressions | `tests/exhibit-plinth.test.ts`, `tests/visitor-visuals.test.ts` |
| Continuation documentation | `OPERATIONAL_STATE.md`, `docs/COMPLETION_MATRIX.md`, this report, `DEFECT_LEDGER.md`, `VISITOR_VISUAL_LEDGER.md` |
| Earlier candidate changes preserved | `src/world/Cinema.ts`, `src/world/SourceVisitors.ts`, `tests/cinema.test.ts`, `validation/reports/runtime-source-qa.json`. In this evidence folder, `BASELINE.md`, `BIBLE_ENTRY.md`, `FINAL_QA_REPORT.md`, `PERFORMANCE_REPORT.md`, `WALKTHROUGH_MANIFEST.json` |

Local captures, browser output and run logs live under ignored test output. Git history and the index stayed at their starting state. Antigravity's checkout, W01, the shared registry and music systems were outside the changes.

## Human acceptance

The owner review still covers E20 presentation at normal player height, cast artistic direction and prop legibility, accessibility and comfort with physical input and representative devices, and approval for any future sourced visitor models. The browser captures, synthetic touch checks and device timings establish their own measured scope.

## Final correction and performance adjudication

### E19 inlay

Chrome reproduced the overlay from inside E19 at (51, 1.64, −9.9383), looking straight out. The same screen-space ray hit `wing-wall-inlay:east` at (49.1323, 2.6906, −6.94) before the repair. The east hall placed a 6.5 m inlay at its fixed 33% station (47.76 m), across the left-side E19 opening (46.5–55.5 m). The prior model treated a wall location as solid without testing the complete panel width or the opening.

The inlays now fit their full width to the closest available solid span on the authored side. They use the same `bayOpeningSpan` geometry contract as the hall walls, clear the opening edges by 0.15 m, and sit at the shared hall-wall inner face so the panels remain visible on the solid wall. E19's inlay now lies beside the aperture, centred at 43.10 m. Both inlays per wing retain their dimensions and materials. The wall thickness, collisions, bay openings and installation placements retain their original values.

The new geometry regression failed against E19 before the repair. It projects the actual rendered panel vertices along the hall against each of the 35 same-side apertures and checks full inlay width and visible wall mounting. Chrome walked in and out of E17, E19, E20 and E21 with held movement, eight successful legs and no browser errors. The matched reverse ray now reaches the far side of the hall.

- [Same camera before](../../../test-results/walkabout/closure/e19-before/e19-reverse.png) · [Same camera after](../../../test-results/walkabout/closure/e19-after/e19-reverse.png) · [Panel on the solid wall](../../../test-results/walkabout/closure/e19-after/e19-inlay-on-solid-wall.png)
- [Approach before](../../../test-results/walkabout/closure/e19-before/e19-approach.png) · [Approach after](../../../test-results/walkabout/closure/e19-after/e19-approach.png) · [Final ray and held-walk trace](../../../test-results/walkabout/closure/e19-after/inspection.json)

### Cinema restart

The archived failure read 0.0018 s in the first browser task after the R key. Five fresh repeats with the unchanged restart action all reached exact zero while paused. Three of the five immediate reads still reported an active seek, which confirms that the assertion could run before the operation completed. The exact historical nonzero sample did not recur. The video starts at timestamp zero. The updated test seeks away first, returns keyboard focus to the museum, presses R, and waits for a settled, paused element at exactly zero. The production playback and cleanup code received no change.

[Archived failure](../../../test-results/walkabout/continuation/browser.log) · [Five diagnostic repeats](../../../test-results/walkabout/closure/cinema-probe.log)

### Final functional verification

- Focused environment, E20, visitor visual/focus and Cinema unit tests passed 40/40. The project gate passed 1,348 tests across 133 files, typecheck, lint, validators, production build, package budget and distribution verification.
- Chrome/Metal passed all seven selected cases, including five Cinema cases, the continuous 303-leg, 2,179 m grand tour and the complete 64-passage, 190-lane traversal with 35/35 exhibit approaches. The revised local-film scenario then passed three additional runs.
- Offline standalone verification passed in Chrome/Metal. It covered two world round trips, 14/14 installations, 17/17 visitors and zero remote requests. The build fingerprint was `348e9d01ab599fd7b7522c6571f1adc2bb1a1fac079a5ce9ec27ccf53314f06f`.

[Focused](../../../test-results/walkabout/closure/focused.log) · [Gate](../../../test-results/walkabout/closure/gate.log) · [Browser](../../../test-results/walkabout/closure/browser.log) · [Cinema repeats](../../../test-results/walkabout/closure/cinema-final.log) · [Passage inventory](../../../test-results/traversal/report.md) · [Grand tour](../../../test-results/traversal/grand-tour.json) · [Offline](../../../test-results/walkabout/closure/verify-standalone.log)

### Apple M1 adjudication

The unchanged headed device harness ran in order A1, B1, A2, B2, A3, B3 against isolated builds on the same 8 GB MacBook Air M1, Chrome 157 and ANGLE Metal. A is clean `ff6d983e`, B is the working candidate. Each arm used the same routes, fresh Chromium contexts, 1440 × 900 and DPR 1. The project uses production preview for the museum and the unminified local development server for Workshop. The supplemental ticketed runs confirmed medium quality, motion enabled, identical viewport and initially exterior-only worlds. The canonical runner and budget files have matching digests across both trees. No competing QA browser run overlapped these trials. OS CPU idle before the runs varied from 29% to 62%, swap use was about 5.8–6.4 GiB, and macOS reported no thermal warnings at the recorded boundaries. Fresh contexts isolate browser storage/cache. System load, driver cache and GPU scheduling remain sources of variation.

Entries below are the repository checker's within-trial worst values across its available samples. P is a hard-budget pass, F is a fail, and W is a hard-budget pass with the 100 ms soft target missed. Each delta is B−A for its numbered pair.

| Budget | Limit | Clean main A1 / A2 / A3 | Candidate B1 / B2 / B3 | Paired deltas | Median delta |
|---|---:|---|---|---|---:|
| Cold exterior start | ≤ 2,000 ms | 1,380 P / 1,845 P / 3,238 F | 1,600 P / 2,220 F / 2,391 F | +220 / +375 / −847 | +220 |
| Exterior idle p99 | ≤ 20 ms | 34.3 F / 18.8 P / 50.1 F | 17.6 P / 33.8 F / 37.1 F | −16.7 / +15.0 / −13.0 | −13.0 |
| Exterior walk p99 | ≤ 20 ms | 50.0 F / 49.6 F / 67.6 F | 33.3 F / 49.9 F / 66.2 F | −16.7 / +0.3 / −1.4 | −1.4 |
| Exterior walk FPS | ≥ 55 fps | 57.7 P / 57.0 P / 53.6 F | 58.9 P / 57.5 P / 53.3 F | +1.2 / +0.5 / −0.3 | +0.5 |
| Steady interior p95 | ≤ 20 ms | 17.7 P / 18.4 P / 17.6 P | 17.0 P / 33.5 F / 33.3 F | −0.7 / +15.1 / +15.7 | +15.1 |
| First 5 s after exterior return p99 | ≤ 20 ms | 49.3 F / 33.4 F / 33.5 F | 17.6 P / 34.3 F / 50.0 F | −31.7 / +0.9 / +16.5 | +0.9 |
| Fixed 2,000-placement Workshop p99 | ≤ 20 ms | 17.7 P / 49.5 F / 33.2 F | 17.5 P / 17.7 P / 33.4 F | −0.2 / −31.8 / +0.2 | −0.2 |
| Workshop residency sweep p99 | ≤ 20 ms | 17.7 P / 51.0 F / 49.2 F | 17.6 P / 84.4 F / 34.4 F | −0.1 / +33.4 / −14.8 | −0.1 |
| First-entry fixture maximum | ≤ 900 ms | 200 W / 284 W / 533 W | 151 W / 250 W / 301 W | −49 / −34 / −232 | −49 |
| Second-entry maximum | ≤ 50 ms | 67 F / 184 F / 166 F | 50 P / 216 F / 99 F | −17 / +32 / −67 | −17 |
| DOM growth after 10 round trips and GC | ≤ 20 nodes | 0 P / 0 P / 0 P | 0 P / 0 P / 0 P | 0 / 0 / 0 | 0 |
| JS heap growth after 10 round trips and GC | ≤ 5 MB | 1.3 P / 0.7 P / 1.3 P | 0.9 P / 0.7 P / 1.4 P | −0.4 / 0 / +0.1 | 0 |

Cold-start time ends when three frames have rendered in the exterior. The p95 and p99 figures are ranks of presented animation-frame intervals within their named windows. FPS uses the count and sum of those intervals. The first- and second-entry rows are individual maximum frame intervals from their own windows. The first-entry fixture stayed in the exterior in all 18 contexts. It therefore samples a preparation window. The warmed second-entry fixture reached the interior in all 18 contexts. The separate supplemental harness issues the real ticket, crosses the portal under held input, and records preparation, commit to first interior render and warmed re-entry separately.

[Raw trials, harness logs and machine snapshots](../../../test-results/walkabout/closure/m1) · [Unchanged budget definitions](../../../tests/perf/budgets.json)

#### Regression assessment and attribution

- **Cold exterior start and exterior idle:** Unresolved, low confidence. The paired deltas change sign. The cold exterior loads before the visitor build, and the run-to-run navigation timings vary. The isolated snapshot blocks any attribution of those measures to the cast.
- **Exterior walking p99 and FPS:** Shared deficit, moderate confidence. Both arms missed the walking p99 limit in all three trials. FPS passed in the first two pairs and failed in the third on both arms. The paired deltas give little evidence of a candidate penalty.
- **Steady interior p95:** Unresolved, moderate confidence that steady-state frame loss is load-sensitive. The canonical candidate missed in two pairs. The shorter matched follow-up at the same interior position gave clean main 33.4 / 17.7 / 33.5 ms and candidate 33.4 / 33.3 / 33.4 ms. In pair two, 27 of 572 main frames and 31 of 568 candidate frames exceeded 20 ms, enough to move p95 across the 60 Hz frame boundary. Mean intervals were 17.49 and 17.61 ms. Pair one had the same 18.53 ms mean and 59 frames above 20 ms on both arms. Pair three's mean favoured the candidate, 17.96 versus 20.01 ms. Browser DPR was 1. The internal adaptive pixel ratio moved between 0.85 and 0.90.
- **Exterior return p99 and second-entry maximum:** Shared budget misses with unresolved delta, low confidence in attribution. The canonical deltas change sign. The ticketed return produced p99 by pair of 35.3→33.4, 33.3→149.7, and 33.3→33.4 ms. Ticketed warm-entry maximums were 50.9→33.4, 33.2→116.9, and 33.3→34.4 ms. The large samples recur intermittently and do not establish a repeatable transition penalty.
- **Workshop fixed and sweep p99:** Shared, intermittent misses with unresolved delta, moderate confidence in the shared deficit. Both use the dev fixture. The fixed case varied from about 17 to 50 ms on main. Sweep varied from about 18 to 84 ms across the two builds, with one large positive paired delta and one negative.
- **First-entry preparation maximum:** All six passed the hard limit and missed the soft target. The canonical candidate maximum was lower in every pair. Confidence is high about the measured exterior state and low about inferring ticketed admission performance from that fixture. In the physical ticketed run, commit to first interior render was 110.5 / 76.2 / 85.6 ms on main and 99.3 / 138.2 / 149.4 ms on candidate. Its delta remains unresolved.
- **Round-trip DOM and JS heap growth:** No measured growth penalty in the 10-round-trip scope, moderate confidence. DOM growth was zero throughout and all post-GC heap growth results were at or below 1.4 MB.

**Confirmed candidate cost and merge blocker.** The existing `source-visitors` timer measures a synchronous construction stage. On the three valid ticketed pairs, clean main took **11.3 / 10.7 / 15.4 ms**, and the candidate took **94.4 / 97.1 / 114.3 ms**. The paired increases of **83.1 / 86.4 / 98.9 ms** represent five to six 60 Hz frame intervals of additional main-thread work during preparation. The whole interior build and doorway wait vary independently. This evidence establishes a candidate-specific cold preparation cost with high confidence and leaves its contribution to the earlier exterior return and warm-entry spikes unresolved.

The steady renderer submitted 103,754 triangles versus 95,904 on main at 745 draw calls, with equal sampled program, geometry and texture counts. The supplemental steady window also showed equal median draw calls and program counts, with 171,834 candidate triangles versus 159,662 on main. Candidate visitor update time over ten seconds was 48.3–51.2 ms across 602 calls, versus 46.6–51.9 ms across 601–602 calls on main. The update timing, equal batch draw count, and flat round-trip growth give little support to a recurring visitor CPU, draw submission, or persistent leak explanation. These counters do not directly time GPU uploads or shader compilation.

A single-transform composition prototype preserved the sampled geometry attributes within 0.000001 and kept indices and colours exact. It improved the isolated all-cast composition median from 29.9 to 27.3 ms across 30 alternating samples. That reduction is too small to resolve the browser construction gap. The prototype stayed out of the candidate. A cooperative build or a baked geometry path needs its own cancellation, resource-ownership, rendered parity and paired device proof. The cast, budgets and shared systems stay intact.

[Full trial summary and within-run values](../../../test-results/walkabout/closure/m1/comparison.txt) · [Steady CPU and renderer comparison](../../../test-results/walkabout/closure/m1/steady-summary.txt) · [Geometry prototype measurements](../../../test-results/walkabout/closure/m1/geometry-transform-experiment.log)

#### Final scope and disposition

**BLOCKED for merge on measured cold visitor construction cost.** E19, Cinema's restart proof, the complete traversal, the project gate and standalone are verified locally. Absolute device budgets and the unresolved frame-pacing deltas remain open. Museum and cast presentation, physical accessibility and input comfort, and any future sourced-model approval still require human review.

This correction changed `src/world/WingAtmosphere.ts`, `src/world/layout.ts` and the hall-wall constant uses in `src/world/Museum.ts`. It added the inlay geometry case to `tests/environment.test.ts` and corrected the settle condition in `tests/browser/cinema.e2e.ts`. Continuity updates are in this report, the defect ledger, the local Bible entry draft, Operational State and Completion Matrix. The [saved path audit](../../../test-results/walkabout/closure/changed-files.txt) lists the complete working candidate, including earlier work. Test captures and prototypes are local ignored artifacts. The canonical Bible was read; the local continuity entry is prepared for authorized append. No staging, commit, push, PR, merge, release or deployment occurred. W01, the shared registry, music and Antigravity's checkout were outside the edits.
