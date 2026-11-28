# World production V7: report (2026-11-27)

**Candidate:** `refs/checkpoints/world-production-v7-final-candidate`. This is a local snapshot of the tracked and untracked worktree on top of branch commit `bf171e5`, taken before the final V7 documentation; resolve it with `git rev-parse`. It is a local object, not a branch commit.
**Browser:** installed Google Chrome with ANGLE Metal, run serially on the representative M1 (headless).
**Touch:** all touch results are browser emulation (`hasTouch`), not physical devices.

## B. W01 displacement: diagnosed and repaired (VERIFIED)

**Cause:** the test walker, not W01.
- Running is fast (15.5 m/s). The V6 keyboard walker checked its position once per poll and held Shift+W until a poll found it inside the tolerance.
- On a loaded host the polls and key events were far apart. The visitor covered metres at full run between "arrived" and the key release, then slid on: a released run stops in about 2.3 m, measured 2.24–2.38 m.
- The V6 miss was a ~6 m overshoot along the walk to the whale departure.

**Reproduction without touching the app:** `tests/browser/w01-arrival-overshoot.e2e.ts`.
- It delays every runner read and key event, as when the runner process is starved while the browser keeps rendering. (Throttling the browser CPU does not reproduce it, because the game slows too.)
- With the V6 walker and a 150 ms delay, the walk times out at (−6.94, −9.15), past the target, as in V6.

**Repair (test harness):** `tests/browser/helpers/world-journey.ts` and `touch-journey.ts`.
- The walker predicts its stopping distance (`travelAhead`) and lets go early.
- It settles, then rechecks.
- It finishes with timed presses (`keyboard.press` with a hold, so a starved runner cannot stretch a press).
- `aimAt` settles before aiming.

**After the repair:** drift 0.04–0.43 m across runner delays of 150–350 ms, and the aim succeeds every time.
- W01 journeys: keyboard 1/1, touch 1/1, and both great-ocean-procession tests.
- **Limit:** at 400 ms or more of runner delay the walker can still time out. That is far beyond anything observed, and is documented in the test.
- W01's movement feel and geometry are unchanged.

## C. W09 cascade pinch: diagnosed and repaired (VERIFIED in browser emulation and unit test)

**Cause: a softlock in the product.**
- W09's clock advanced only when the visitor both meant to move and actually moved.
- The first meteor stone moves only with the clock. At rest it can pin a visitor against the rail, so they push but cannot move, the clock never advances, and the stone never moves.
- `tests/browser/w09-cascade-pinch.e2e.ts` reproduced this deterministically: 12 s of pushing, no progress.

**Repair:** `src/world/pocket/w09/createW09World.ts`.
- While the visitor holds a movement intent and is blocked, the clock runs at walking pace (3.4 m/s, the controller's walk speed).
- Standing still still freezes the sky. A frozen visitor (a dialog, a transition) never moves it, even with a key held.
- The V6 step-back retry in `routes.ts` (`crossCascade`) was removed; it is no longer needed.

**Proof:**
- Unit test (3/3) fails on the old code.
- Pinch test: touch 1/1, keyboard 2/2. The first keyboard run missed one time-dial aim (focus null at a correct pose); it did not reproduce in 60/60 focus samples or two reruns, and is recorded as an unexplained intermittent miss.
- **Owner note:** this changes the W09 rule from "time moves when you move" to "time moves when you try to move". It is reversible in one line.

## D. Authentic journeys for every entrance (VERIFIED in browser emulation)

`tests/browser/helpers/museum-approach.ts` and `tests/browser/worlds-museum-approach.e2e.ts`.
- **Interior:** the visitor walks from the arrival pier, round the obsidian sphere and through the front door. The museum opens it as for any visit; the doorway holds the visitor until it is ready.
- **Inside**, the route follows the authored passage centre lanes:
  - W04: atrium, vestibule, south hall, rotunda, then the east wing to the E19 bay.
  - W07: up the south-east grand stair, round the balcony, then the infra wing to the test-lab door.
- **Roof:** Path 5 to the West Flank Ascent, both ramps, the bridge and the west walkway.
  - W05: on to the greenhouse flower.
  - W06: the café's west aisle to the Flight Pad II console, staying off the pad.
  - W10 roof: the destination beside the pad, approached from the north.
- Nothing is placed or teleported. The only reads are the pose, the active world and the position of the entrance object.
- **Results:** keyboard 5/5 (W04 1.5 min, W07 1.6, W05 1.6, W06 and W10 roof 3.4 for both); touch W04 and W05 2/2.
- With the V6 ground approaches (7/7), all eleven worlds' entrances, and the W10 roof, are now reached on foot.
- **Earned progression:** W09 → W10 → L01, keyboard and touch, from V6. It is re-run in the world suite below.

## E. Controls and accessibility (PARTIALLY VERIFIED)

- **Automated:**
  - the input and accessibility unit suites in the gate;
  - touch affordance checks (no key caps in touch mode);
  - the reduced-motion journeys in W02, W03 and W08;
  - focus retention in the entry dialog after a failed load (rehearsal).
- **Physical device:** NOT ATTEMPTED (no device in this environment). Procedure for the owner: [WORLD_DEVICE_ACCEPTANCE_V7_20261127.md](../../../plans/WORLD_DEVICE_ACCEPTANCE_V7_20261127.md).

## G. W10 Dexter engineering readiness (VERIFIED; identity gate CLOSED)

- **`selectDexterCharacter`** is now the only way W10 obtains its character. A candidate is used only when all three hold:
  - it carries an owner approval with provenance;
  - it reports itself approved;
  - it meets the technical contract.
  Anything else is disposed and the labelled test-only rig is used instead, with the reasons.
- **`describeDexterAsset`** reads a loaded glTF scene into the contract description: triangles, bones, texture size, clips, bounds and origin. Facing must be declared, because a bounding box cannot tell a nose from a tail.
- **Unit tests (7/7) cover:**
  - every rejection path (no approval, blank provenance, self-labelled test rig, contract failures);
  - disposal of rejected candidates;
  - the acceptance path, with a synthetic empty fixture rather than an asset;
  - W10 using the seam;
  - the rig's description failing only on its missing clips.
- **Repeat entry:** 10× lifecycle. **Camera boom:** `worlds-camera-boom`. Both are in the world suite.
- No model was made, generated or substituted. The rig remains `TEST_ONLY_NOT_APPROVED_DEXTER`.

## H. Long-session lifecycle (VERIFIED in diagnostic scope)

`tests/browser/worlds-long-session.e2e.ts`: one page, two passes over W01 (music), W02 (traversal), W03 (moving geometry), W09, W10 and L01.

**Pass 1:**
- W01, W02 and W03 left early.
- A failed load: injected loader rejection, through the real dialog; the dialog keeps focus and Esc returns control.
- An interrupted load: cancelled while "Opening…"; it never opens later.
- W09 completed, then W10 completed, unlocked by that stamp, then L01 completed.

**Pass 2:** all six re-entered and left early.

**Ledger after every return:** exterior, 0 pocket roots, 0 music sessions, not frozen, no UI capture.

**Same spot at the end of each pass:**

| | End of pass 1 | End of pass 2 |
|---|---|---|
| Geometries | 992 | 992 |
| Textures | 30 | 30 |
| Programs | 61 | 61 |
| DOM elements | 473 | 473 |
| Heap after forced GC | 39.6 MB | 40.1 MB |

Stamps: 2 after pass 1, unchanged by early exits. Persistent passport untouched. 1/1 in 4.3 min.

**Diagnostic placements:** the visitor is placed at each entrance; the walks are proven in D. Faults are injected by swapping the loader, because the preview has no separate download to cut; the network-level cut is proven in the rehearsal suite.

## J. Failure and interruption recovery (VERIFIED, real UI)

- **Rehearsal suite** (production build): the W08 world chunk is aborted on the network.
  - The dialog says "Passage did not open. You remain safely in the museum."
  - Focus stays on Enter, Esc returns control, and a retry opens the world.
  - An interrupted W03 download, cancelled during "Opening…", never opens later.
  - These protect the V6 PocketTransition focus fix.
- **Long session (H):** the same paths through the dialog in the preview build.
- **Defect found in final qualification, and fixed:** Esc during "Opening…" was ignored once focus had left the disabled Enter button, so the world opened anyway.
  - Focus now waits on Back while the world loads.
  - Regression test: `tests/browser/worlds-entry-cancel.e2e.ts`. Details under Final qualification.

## Final qualification (VERIFIED with stated exceptions)

**Scope, by owner decision (2026-11-27):**
- The standard suite was stopped at 67 passed and 0 failed.
- Workshop and standalone were not re-run; their code is untouched since V6.
- Kept: the gate, distribution, the full world suite, rehearsal, an isolation scan and three performance trials.

| Check | Result |
|---|---|
| Gate, first run | PASS: 153 files / 1,462 tests; assets, exhibits, source parity, QA and budgets pass; release dist PASS; initial bundle 12.58 MB / 20 MB |
| Standard suite | 67 passed, 0 failed when stopped (owner decision) |
| World suite, first full run | 83 passed, 4 failed (1.5 h). Every failure was diagnosed and rerun; see below |
| Rehearsal, first run | 0/5. **Invalid:** my run omitted `MUSEUM_WORLDS_GL=metal`, so Chrome used SwiftShader software rendering. At those frame rates a timed key press can begin and end between frames. The failing test passed 1/1 alone once Metal was set. |
| Rehearsal, Metal | **5/5 passed** (6.5 min). Offline package 25.9 MB; initial transfer 749 KB; worlds load lazily. |
| Gate, final tree | PASS: 153 files / 1,462 tests; frame-loop, hot paths, assets, exhibits, source parity, QA and budgets pass; release dist PASS; initial bundle 12.58 MB / 20 MB. Local checkpoint `refs/checkpoints/world-production-v7-final-candidate`. |
| Isolation scan, final tree | PASS:
- In the ordinary build (shipped files, excluding sourcemaps): 0 files name a world factory; 0 W01 stem files; 0 rehearsal markers; 0 calls to the rehearsal activator.
- World-internal ids: 11/11 absent from the ordinary build and 11/11 present in the rehearsal build (positive control).
- W01 audio masters: unchanged against HEAD.
- Protected checkouts: listed.
- A first scan reported FAIL on one sourcemap (`main-*.js.map`). It quotes `main.ts` comments that mention the rehearsal flag, which is already public source. The scanner was corrected to exclude sourcemaps, which it now lists separately. |

**Run conditions:**
- For part of the first rehearsal attempt the owner's Brave browser was using about 165 % CPU, and the load was 11–14. The owner closed it.
- Every rerun below ran on a quiet machine (load 1.7–3.6), one at a time, with Metal.

### The four world-suite failures

| # | Test | Cause | Fix | After the fix |
|---|---|---|---|---|
| 1 | W03 touch journey | **Test walker.** A world-fixed waypoint on the turning crown gear. The V7 walker released, settled and made short pushes, and each settle lost more to the gear's carry (about 1 m/s) than a push gained. Gear carry moves the position, not the velocity. A pose trace showed a second loss: turning in place cost 1.2–1.6 s, during which the gear carried the visitor back about 1 m. | `touch-journey.ts`: when the visitor drifts with no input held, the walker pushes continuously, as the V6 walker did, and steers while walking. It stops to turn only when facing more than 1.2 rad away. | Failed once with only the first half of the fix. With both halves: 2/2 pass, plus one traced pass. |
| 2 | W08 touch journey | **Test walker.** Same cause, on the drift pad (1.2 m/s) at its dock. | Same | 1/1 with the first half, 1/1 with both |
| 3 | W09 pinch, keyboard | Time-dial aim: no focus at a geometrically correct pose. This is the second miss in five keyboard runs. | `aimAt` failures now also report the camera position, world, freeze and UI-capture state. | 1/1 pass, so the miss did not recur and is still **unexplained and intermittent** |
| 4 | Long session | **Product defect.** Pressing Esc while a world showed "Opening…" was ignored, and the world opened anyway. Disabling the focused Enter button moves focus to the page, out of reach of the dialog's Esc handler. A probe in the real app reproduced it in 3 of 4 tries; the rehearsal's Esc test had passed only on timing. | `src/ui/PocketTransition.ts`: while loading, focus waits on Back, which stays enabled; after a failed load it returns to Enter (retry). | New `tests/browser/worlds-entry-cancel.e2e.ts`: 3 tries per run; passes with the fix, fails on the old code (focus not on Back, then the world opens). Long session 1/1. The rehearsal failed-load test, which checks focus on retry, was re-run on the final tree: 1/1 PASS (production build with Metal; after the failed load, focus is on Enter, inside the dialog) |

**Walker sanity check:** W01 touch 1/1 with the first half of the fix. The second half changes behaviour only on moving supports and was not re-run for W01.

## A. Performance (FAILED; attribution UNRESOLVED)

Governed by [performance/PROTOCOL.md](performance/PROTOCOL.md). Every trial is listed in [performance/TRIALS.md](performance/TRIALS.md).

| Series | Trial | Result | Peak load during |
|---|---|---|---|
| 1 (early V7 tree) | baseline-1 | **12/12** | 5.2 |
| 1 | baseline-2, baseline-3 | INVALID: no measurement (build broke mid-series) | — |
| 2 (final candidate, frozen) | final-1 | 8/12 | 14.9 |
| 2 | final-2 | 10/12 | 15.6 |
| 2 | final-3 | 9/12 | 35.4 |

**What failed:**
- Exterior idle and walk p99, and Workshop p99, at 33.2–33.5 ms. That is exactly two 60 Hz frames: a single dropped frame, not slow frames.
- The second-entry worst frame: 83 ms in final-2 and 233 ms in final-3 (limit 50).

**What held throughout:** cold start ≤ 1.54 s, walk ≥ 58.7 FPS, interior p95 16.8 ms, flat DOM and heap.

**Why the cause is unresolved:**
- All three final trials started admissibly, but the load during them rose to 15–35, against 5 during the passing trial. Outside processes ran mid-trial: `secd`, and macOS `replayd`.
- The ordinary build that perf measures is effectively the same code as baseline-1. Its only V7 product change since then is the entry-dialog focus fix, which the perf routes never open. This is reasoned from the code, not measured.
- Only a matched, interleaved A/B on a machine that stays quiet throughout can separate host effects from a regression.
- No threshold, route or interval was changed, and no trial was discarded or repeated to obtain a pass.

## Diagnosis records (raw lines from the runs)

**W01, starved-runner sweep (`w01-arrival-overshoot.e2e.ts`).**
- Legacy walker, 150 ms runner delay: `walkTo(0, -5.5) timed out at -6.94, 0.00, -9.15`, an overshoot past the departure (FAIL).
- Fixed walker:
  - drift by runner delay: 150 ms 0.10 m, 200 ms 0.05 m, 250 ms 0.04 m, 300 ms 0.06 m, 350 ms 0.12 m; the aim focused `w01-depart-whale` every time;
  - with the W01 journeys, 5 passed in 6.5 min.
- Released-run slide characterization: 2.24–2.38 m (asserted 1.5–3 m).

**W09, pinch (`w09-cascade-pinch.e2e.ts`).**
- Before the fix: `visitor must pass the first stone in the left lane`, FAIL (deterministic).
- After the fix:
  - keyboard 2/2 (2.4 and 2.0 min);
  - touch 1/1;
  - one earlier keyboard run failed one time-dial aim at a correct pose (`aim at w09-time-dial from (0.00, 0.00, 20.00)`); it did not reproduce in 60 focus samples or two reruns.
