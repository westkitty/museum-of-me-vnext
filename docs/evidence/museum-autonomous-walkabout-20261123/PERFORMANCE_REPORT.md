# Walkabout performance and resource evidence

The cast still uses 327 batched body instances plus 17 instances in the existing contact-shadow draw. The body material uses vertex colours. No new texture, external asset, application renderer, frame-loop owner, dependency or per-actor material was added. Temporary geometry inputs are disposed after packing. The source visitor cadence and ResourceScope tests passed.

## Browser render samples

These samples come from the real active frame loop on Apple M1 through ANGLE Metal at 1280 × 720, DPR 1, medium quality. Samples compare steady views from a diagnostic run. They are sensitive to concurrent macOS load and to zone streaming, and do not establish a performance improvement. One rendered frame records each scene counter.

| View | Draw calls, before → candidate | Triangles, before → candidate | Geometries | Textures | Shader programs |
|---|---:|---:|---:|---:|---:|
| Cold exterior arrival | 1,261 → 1,261 | 220,679 → 220,679 | 868 → 868 | 27 → 27 | 72 → 72 |
| Rotunda diagnostic | 941 → 941 | 103,378 → 108,682 | 2,247 → 2,229 | 184 → 194 | 88 → 88 |

Raw receipts are `test-results/walkabout/{before-matched,final-visuals}/inspection.json`. The same runs sampled 120 presented frames per exterior/interior state. Exterior p99 was 83.4/16.8 ms and interior p99 was 83.3/33.3 ms. The exterior states have identical render counts and the process load differed, so these diagnostic frame timings provide no basis to attribute a speedup. The Rotunda added 5,304 submitted triangles in the recorded view with unchanged calls and shader program count. The scene-wide geometry and texture counts include streamed installations and text whose residency differed.

Baseline and candidate production package checks each reported 16.39 MB of 20 MB and zero undeclared binaries. The historical 33.5 ms exterior walk p99 against 20 ms is an earlier development-branch measurement and does not establish this candidate's M1 budget verdict.

## Representative M1 device trials

Both used the repository's headed device harness on the same physical MacBookAir10,1 with 8 GB RAM, Chrome 157, ANGLE Metal, 1440 × 900 and DPR 1. The candidate ran first, then the clean baseline. All three measurement cases completed on each. These are single runs per revision with normal macOS load. Both revisions missed the same six limits, and the baseline missed two additional limits. The spread does not establish a performance improvement or attribute a regression.

| Budget | Baseline | Candidate | Limit |
|---|---:|---:|---:|
| cold-start | 2207 ms FAIL | 3267 ms FAIL | ≤ 2000 ms |
| exterior-idle-p99 | 48.3 ms FAIL | 35.3 ms FAIL | ≤ 20 ms |
| exterior-walk-p99 | 81.8 ms FAIL | 34.9 ms FAIL | ≤ 20 ms |
| exterior-walk-fps | 51.9 fps FAIL | 56.8 fps PASS | ≥ 55 fps |
| interior-steady-p95 | 18.6 ms PASS | 18.5 ms PASS | ≤ 20 ms |
| exterior-after-return-p99 | 34.7 ms FAIL | 32.7 ms FAIL | ≤ 20 ms |
| workshop-2000-p99 | 33.4 ms FAIL | 18.7 ms PASS | ≤ 20 ms |
| workshop-2000-sweep-p99 | 48 ms FAIL | 35 ms FAIL | ≤ 20 ms |
| first-entry-worst-frame | 235 ms WARN | 316 ms WARN | ≤ 900 ms |
| second-entry-worst-frame | 119 ms FAIL | 116 ms FAIL | ≤ 50 ms |
| round-trip-dom-growth | 0 nodes PASS | 0 nodes PASS | ≤ 20 nodes |
| round-trip-heap-growth | 0.7 MB PASS | 0.9 MB PASS | ≤ 5 MB |

Chrome resource timing measured cold arrival transfer of 657, 657, 657 KB at baseline and 660, 660, 630 KB in the candidate. After 10 round trips and forced garbage collection the measured DOM grew by zero nodes on both. Candidate listener counts stayed stable in all three repeats. The first-entry fixture ended in exterior, exterior, exterior at baseline and exterior, exterior, exterior in the candidate. Treat that timing row as a preparation-window sample unless its trace actually committed. The live ticketed visit supplies independent transition proof.

Raw device, transition and comparison output is under `test-results/walkabout/m1-baseline/` and `test-results/walkabout/m1-candidate/`. The M1 acceptance gate remains open.

## Authored visitor update sampling

A six-second diagnostic in the active Rotunda frame loop sampled the existing source visitor methods with motion enabled, at the same eye point and medium quality. Baseline recorded 3,432 matrix-pose synchronizations in 360 updates, with 44.6 ms of pose work and 105.4 ms for the complete cast updates. Candidate recorded 3,404 pose synchronizations in 359 updates, with 32.7 ms of pose work and 78.9 ms for complete updates. These single in-page instrumented samples include timer overhead and small differences in cast placement and pacing. They show the measured cost range under this fixture. No general speedup is inferred. Raw receipts are in `test-results/walkabout/visitor-cost-before/` and `test-results/walkabout/visitor-cost-after/`.

## Visitor construction performance repair (2026-11-24)

**Verdict: PARTIAL.** The longest synchronous slice of cast preparation fell back near clean main in headless Chrome. Headed Apple M1 (Chrome/ANGLE Metal) confirmation did not run: the owner asked that the screen-taking browser not be used. All 17 geometries are byte-identical to the pre-repair candidate.

### Original bottleneck (profile, not assumption)

The candidate builds 78 composed geometries (10 shared plus 4 per visitor × 17), 16,816 vertices, 46,728 indices and 327 batched instances where clean main builds 9 primitive templates. A CDP CPU profile of cold interior preparation (dev build, three runs, noisy machine) put `createVisitorGeometry → compose` at 12.6–51.4 ms inclusive of a 37.6–75.5 ms `SourceVisitors` constructor. Three's `applyNormalMatrix → normalize` per-vertex path dominated the high runs; `addGeometry` was 3–9 ms and the collision lookups in `build()` 1.5–10 ms. Cold-process Node timings: whole constructor 26 ms against 12 ms on main; kit composition ≈ 11 ms of that. Within composition: transform of 3,845 unique vertices 4.3 ms, index rebasing 1.9 ms, colour fill 0.8 ms, key/prep ≈1.4 ms. Stage timers wrap no single dominant loop: this is cold-start cost spread across many small loops.

### Rejected alternatives

- Fused single-pass transform of position and normal slices with identical float32 rounding (bit-identical to the original). Cold Node 11.1 to 11.4 ms before, 10.7 to 13.5 ms after; headless production medians 23.4 ms before and 24.6 ms after (n=5). No measurable benefit. Reverted.
- Single combined matrix (earlier experiment) was not repeated.
- Baked geometry asset: adds ≈0.8 MB binary to a build at 16.39 of 20 MB and needs its own parity and provenance proof. Not required by the evidence.

### Selected repair

Cooperative preparation inside the existing interior build. `createVisitorGeometry` became a generator of steps (shared kit, then one visitor per step). `prepareVisitorGeometry` drives it with the existing `EventLoopYieldBudget` checkpoint, and `InteriorWorld.buildCooperatively` awaits it before constructing `SourceVisitors` with the prepared kit. Bounds are computed inside the paced steps. `createVisitorGeometry` and `new SourceVisitors(...)` keep their synchronous contracts for tests and callers. Kits are CPU-side arrays until registered: no GPU object exists to leak if preparation is cancelled; a rejected checkpoint or construction failure disposes the partial kit. No new loop, worker or dependency. Total work is unchanged (this is not a work reduction); it is sliced so no single task approaches the old stage.

### Measurements (headless Chrome, production build, 1440×900, six alternating cold paired runs, concurrent unrelated system load)

| Arm | `source-visitors` sync stage (per run) | Median | Longest single sync slice |
|---|---|---:|---:|
| clean main | 4.7 / 4.6 / 6.1 / 6.6 / 5.2 / 4.9 ms | 5.2 | 5.2 |
| candidate before repair | 23.4 / 17.5 / 29.7 / 15.0 / 14.8 / 13.2 ms | 17.5 | 17.5 |
| candidate after repair | 6.8 / 12.2 / 12.9 / 6.5 / 6.6 / 6.7 ms (kit slices 1.1–2.0 ms each) | 6.8 | 6.8 |

Total synchronous cast work after repair (kit slices plus constructor) had median 12.8 ms. Time to interior: main 1591, before 1658, after 1591 ms (medians). Longest presented frame medians 50, 67 and 50 ms. Draw calls 1176 in all arms; triangles identical before and after (135,262). These are headless runs on a heavily loaded machine (system load average 8–13 from an unrelated process) and do not establish the Apple M1 headed figures. The earlier headed 83.1–98.9 ms increase was not reproduced headless (about 12 ms here), so the headed numbers remain the open question.

Raw rows: `perf-results/arms-trials3.jsonl` (also `arms-trials.jsonl`, `arms-trials2.jsonl` from earlier arm builds, and `profile-*.txt`).

### Character parity and lifecycle

SHA-256 over position, normal, uv, colour and index bytes of all 78 composed geometries matched the pre-repair candidate exactly after every step of the change. Tests prove the cooperative kit equals the synchronous kit, the batch (327 instances), positions, snapshot and ResourceScope size match for both construction paths, and a rejected checkpoint propagates cleanly. Disposal, interaction registration and the constructor contract are unchanged.

### Files changed in this pass

`src/world/VisitorVisuals.ts`, `src/world/SourceVisitors.ts`, `src/world/InteriorWorld.ts`, `tests/visitor-visuals.test.ts`.

### Process incident

Running the default `playwright.config.ts` suites cleared its `outputDir` (`test-results/`). That removed the ignored local receipt folder `test-results/walkabout/` including the raw receipts linked above and in earlier sections. It was not recoverable by this session. Tracked source, evidence markdown and the pre-edit checkpoint are intact. Re-capture the linked receipts on the headed M1 if they must exist as files.

## Continuation: boot-test classification, paced-construction audit and render parity (2026-11-24)

**Verdict stays PARTIAL.** No Apple M1 (Metal) measurement was taken: only software-rendered headless Chrome was available (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...))`, recorded in the capture reports). Nothing here is M1 validation.

### Boot test `museum.e2e.ts:34`
The earlier failure was `Timeout 15000ms ... scene.environment`, an assertion made before any interior or visitor code exists (the interior is lazy). Three repeats each with isolated output and the same flags: clean main 2 pass / 1 fail with the identical `scene.environment` predicate timeout; candidate 1 pass / 2 fail, both failures earlier in boot (`#museum-canvas` not visible; `page.evaluate` stuck until the 120 s test timeout). System load was 8 to 16 from an unrelated process throughout. Classification: **B, baseline failure reproduced on clean main (software GL, load-sensitive)**. The candidate's two different boot-stage timeouts are in the same starvation family, but n=3 cannot show the candidate is no worse, so candidate flakiness under load is **unresolved (D)**. No code or timeout change was made. Raw logs are scratch files and are not archived.

### Paced construction audit
- **Total work:** not reduced. Paired headless medians: kit steps plus constructor 12.8 ms, versus a 17.5 ms single stage before and 5.2 ms on main. The difference is inside run-to-run noise; treat total CPU as unchanged. The 78 geometries are still composed, bounds are still computed (now inside the steps), and 327 instances are still registered.
- **Longest slice:** kit steps 1.1 to 2.4 ms each (budget yields at about 3 ms); the remaining constructor (78 `addGeometry`, 327 instances, 17 hierarchy builds) is one synchronous slice of 6.5 to 12.9 ms headless. That slice is not paced and is the new longest. Its M1 cost is unmeasured.
- **Displacement vs. fix:** the user-visible stall was the single 13 to 30 ms stage; it is now a series of 1 to 2 ms slices plus one 7 to 13 ms slice. Wall time to interior is unchanged (1591 ms median either way) and the yields add frame waits. This is a displacement into smaller slices, not elimination of work.
- **Readiness and lifecycle:** all 17 visitors are constructed inside the interior build before commit, so they exist when the interior becomes active. Interior builds once per session (`museumBuildCount 1`), so re-entry does not recompose. Kits are CPU-side until registered; a rejected checkpoint disposes partial kits (tested), and a constructor failure disposes the kit. No new loop or worker.
- **Not directly tested:** disposing the interior scope mid-preparation (it relies on the constructor's `scope.track` throwing after dispose, then the catch).

### Rendered verification (headless, software GL)
All 17 visitors were captured on a pre-repair candidate build and the repaired build, entering through the real doorway walk, UI hidden. Pixel comparison: **0 differing pixels in 17 of 17 captures** (960×600). Frames show the seated Sketcher on the stool with the book, hair crowns intact and queue figures grounded. In the same page, `interactive=17/17`, every conversation cycles back to its first line (3 lines each), and anatomy counts are 19 (18 for the seated figure) on both builds. Reduced-motion was not re-run beyond the existing suites. Captures: `test-results/perf-repair-20261124/captures-{before,after}/` (ignored, local).

### Evidence safety
`playwright.config.ts` now writes to `test-results/playwright`; `tests/playwright-output-safety.test.ts` guards every Playwright config. See `EVIDENCE_LOSS_MANIFEST.md`.

### Validation
`npm run gate` exit 0 (134 files, 1,356 tests, including the guard). Earlier browser run: 26 of 27 passed, the one failure classified above. Standalone: static checks PASS, offline browser PASS (cold exterior, 2 round trips, 17 visitors, 7 requests), `runtime-source-qa` PASS (14/14 installations, 17/17 visitors, 0 remote requests) on retry; its first attempt timed out at 60 s under load 16 and overwrote the tracked QA reports with a FAIL stub, which I restored (JSON from the checkpoint, markdown from HEAD) before the passing rerun regenerated them. The Chrome installed on this machine was used because Playwright's managed Chromium is not installed.

### Changed files (full candidate, this commission marked *)
OPERATIONAL_STATE.md, docs/COMPLETION_MATRIX.md, playwright.config.ts*, src/world/{Cinema,GalleryPlinth,InteriorWorld*,Museum,SourceVisitors*,VisitorVisuals*,WingAtmosphere,layout}.ts, tests/{browser/cinema.e2e,cinema,environment,exhibit-plinth,visitor-visuals*,playwright-output-safety*}, validation/reports/{RUNTIME_SOURCE_QA.md,runtime-source-qa.json}, docs/evidence/museum-autonomous-walkabout-20261123/.

### Remaining
Headed or Metal M1 pairs and the twelve-budget matrix, M1 cost of the remaining constructor slice, candidate boot reliability under load, human review.

## Pass 3: build-time visitor geometry (2026-11-24)

**Verdict: PARTIAL.** Total synchronous construction work fell about 9 ms (27%) in paired trials; that is real work removal, not redistribution. The longest synchronous slice did not improve, remaining M1 overhead versus clean main persists, and no result here is project-harness (headed) M1 acceptance.

### Profile before the change (cold process, five fresh Node runs, medians)
Kit 15.5 ms: templates 1.8, per-piece transform 4.9, colour fill 0.7, index rebasing 2.1, key/prep 1.2, bounds 2.5, glue about 2. Constructor with a prepared kit about 12.7 ms: `addGeometry` 2.3, `addInstance`/`setColorAt`/`setMatrixAt` 0.8, initial `updateWorldMatrix` 2.2, interaction registration 0.05, the remainder (shadow mesh and mask, hierarchy, collision spawn) about 5. Resource counts: 78 geometries, 16,816 vertices, 46,728 indices, 327 instances. Whole path about 28 ms cold, of which the kit is over half. Profiling artifacts stay outside Playwright's output folders.

### Evaluated and chosen
Simpler options were already measured and rejected earlier (fused transform: no gain; paced composition: moves work). The remaining kit cost is cold-start execution of the composer itself, so the work-eliminating option was tested: `scripts/build-visitor-geometry.ts` runs the real composer at build time and embeds the 814 KB result (base64). At runtime `Uint8Array.fromBase64` decodes it and typed-array views become the 78 geometries, with bounds supplied.
- **Decode cost measured first:** native `Uint8Array.fromBase64` 0.7 to 2.9 ms; a JavaScript `atob` loop 11 to 36 ms, which is worse than composing. Browsers lacking the native call therefore keep composing procedurally (paced), so nothing regresses there.
- **Cold Node, five fresh processes:** compose plus bounds 13.9 to 16.1 ms; baked decode 1.05 to 2.9 ms.
- **Regeneration and staleness:** `npm run build:collection` (called by dev, build and the gate) regenerates `src/world/visitorGeometry.generated.ts`, so it is deterministic (two runs identical) and never stale in a build. `tests/visitor-geometry-bake.test.ts` fails if the committed bytes differ from the live composer in any position, normal, UV, colour, index, attribute order, index type or bound, for all 78 geometries. No second character definition exists.
- **Package:** initial-visit bundle 16.39 to 17.47 MB of the 20 MB budget (the interior chunk grew 0.68 to 1.81 MB); `check:budgets` passes. No network dependency or new package. Cross-engine caveat: baked bytes come from Node/V8 trigonometry; another engine composing procedurally may differ by an ulp that is not visible.

### Paired trials (headless Chrome on the Apple M1, six alternating cold runs, production builds)
Renderer string: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1)`. Headless, via the perf config's GPU flags; not the project's headed acceptance harness. The machine ran under heavy unrelated load (load average 7 to 48), so single runs are noisy.

| Arm | Constructor | Kit | **Total sync** | Longest slice |
|---|---:|---:|---:|---:|
| Clean main | 11.5 | none | 11.5 | 11.5 |
| Paced candidate (before) | 18.3 | 16.8 | **33.9** | 18.3 |
| Baked candidate (after) | 19.6 | 5.2 | **24.9** | 19.6 |

Per pair, total sync before to after: 38.3 to 15.8, 33.9 to 26.1, 38.3 to 21.8, 31.9 to 24.9, 33.5 to 37.4 (worse, during a load spike), 33.1 to 23.0. Five of six improve; the median saving is 9.0 ms. The constructor median did not change (18.3 vs 19.6, inside noise) and is now the longest slice; the baked kit is 3 to 5 ms. The remaining overhead above clean main is about 13 ms (was about 22), so the original regression is reduced, not closed. Cold time to interior (medians): main 3029, paced 3367, baked 2882 ms; differences are inside noise. Warm re-entry to interior: 1585, 1584, 1583 ms, with no rebuild. Draw calls 1176 in every arm; triangles 135,262 in both candidate arms; geometries 1819 vs 1824, textures 158 vs 154, JS heap 78.1 vs 75.5 MB (warm 89.2 vs 88.7). Every arm showed 17 visitors, 17 visitor interaction registrations on cold and on warm re-entry, and exactly one visitor group. Data: `perf-results/pass3-arms.jsonl`.

### Next measured bottleneck
The constructor (about 19 ms): `addGeometry` x78 about 2.3, initial world-matrix updates 2.2, instance setup 0.8, and about 5 ms of shadow, hierarchy and collision-spawn work introduced by the candidate. Not addressed in this pass.

### Visual and byte parity
Baked vs live composer: byte-identical, 78 of 78 geometries, bounds included. Rendered (headless SwiftShader, same viewpoints, UI hidden, real doorway entry): paced vs baked builds differ in **0 pixels in 17 of 17** captures; 17 of 17 interactive, every conversation cycles.

### Interrupted preparation (tests/visitor-lifecycle.test.ts, 7 tests)
Normal completion; cancelled before the first step and halfway (rejects, every geometry built before the cancel is disposed, a later entry succeeds, no unhandled rejection); scope disposed before registration (throws, kit released, zero interaction registrations); failure on the ninth interaction registration (all registrations unbound); dispose immediately after construction, twice (idempotent, updates and speech stop, scope size 0); four rapid leave and re-enter cycles (always 17 visitors, 17 registrations, reduced motion holds positions, normal motion moves them). Lifecycle repairs made: `SourceVisitors.fromKit` releases the kit on failure, the constructor unbinds partial registrations on failure, and `dispose()` is idempotent and silences `update`/`speak`. Frame waits resolve when the scope is disposed (`waitForNextFrame`), so a pending build ends at the constructor's `track()` rather than hanging. Not tested end to end: an `InteriorWorld` build interrupted at the app level.

### Validation actually completed
Focused: 36 tests across the visitor, bake, lifecycle, performance and cadence files. `npm run gate` exit 0 (136 files, 1,365 tests, includes eslint at zero warnings and the Playwright output guard). Standalone: static, offline browser (17 visitors, 2 round trips, 7 requests) and runtime-source QA (14/14, 17/17, 0 remote) pass; the first attempt of each timed out under load and a rerun at lower load passed. Browser (isolated output): grand tour, performance-lifecycle, 5 cinema, 5 predictive-interior (ticketed and committed entry paths) pass; art-direction timed out once at 120 s and passed twice on rerun (56 to 58 s). E19 and E20 are covered by the gate's geometry tests, not re-captured. Boot test `museum.e2e.ts:34` was not rerun; its classification is unchanged (baseline flakiness, unresolved candidate load sensitivity).

### Changed files this pass
`package.json` (build:collection), `scripts/build-visitor-geometry.ts`, `src/world/VisitorGeometryBake.ts`, `src/world/visitorGeometry.generated.ts` (generated), `src/world/InteriorWorld.ts`, `src/world/SourceVisitors.ts`, `tests/visitor-geometry-bake.test.ts`, `tests/visitor-lifecycle.test.ts`, plus these docs. The history, the evidence-loss manifest and the missing-raw-receipt limitation are unchanged.

### Open
Headed M1 harness pairs and the twelve budgets, the constructor slice, candidate boot reliability under load, human review. Bible: append-ready entry prepared locally in `BIBLE_ENTRY.md`; the canonical Bible was not written.

## Pass 4: constructor profile, rejected registration experiment, application-level interruption (2026-11-25)

**Verdict: PARTIAL.** Lifecycle closure achieved (one real defect found and fixed). The constructor experiment showed **no demonstrated improvement** and was not kept. No headed M1 measurement was taken; the original 83 to 99 ms regression is not shown resolved.

### Constructor profile (real cold interior build, dev server, headless Chrome)
Renderer string: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)` (reported by the page; machine load 7 to 10 during the five fresh runs). Temporary timers inside `SourceVisitors` (removed afterwards; the file is byte-identical to its pre-pass copy). Medians of five cold runs, with a prepared baked kit:

| Stage | ms | Calls |
|---|---:|---:|
| BatchedMesh allocation plus material | 0.5 | 1 |
| `addGeometry` (copies attributes, rebases indices, stores bounds) | 5.5 | 78 |
| Shadow mesh, mask, root matrix | 1.9 | 1 |
| Collision spawn (`supportHeight`, `resolveHorizontal`) | 1.3 | 17 |
| Semantic `Object3D` creation | 1.5 | 327 |
| `addInstance` | 0.6 | 327 |
| `setColorAt` | 0.6 | 327 |
| Remaining `build()` hierarchy and pose code | about 4.3 | 17 |
| Initial matrix sync | 0.6 | 17 |
| Interaction registration | 0.2 | 17 |
| **Constructor total** | **17.6** (runs 7.9 / 18.6 / 17.9 / 17.6 / 16.1) | |

Not dominated by one operation: it is accumulated work across 78 geometry registrations, 327 node and instance registrations and 17 spawn queries. The largest single group is `addGeometry` (31%). Bounds are no longer computed here (baked). The same stage run in a cold Node process (real museum collision) was about 13 ms, with spawn 1.3 to 4.1 ms; the fifth run's 7.9 ms shows how much of this is cold-start variance. Resource counts: 78 geometries, 16,816 vertices, 46,728 indices, 327 instances, 17 interaction proxies.

### Experiment: faster registration (rejected, rolled back)
Root cause of the `addGeometry` cost: three 0.185.1 rebases every index element through `setX(getX())` in a JavaScript loop (46,728 iterations) while attributes use bulk `set`. Hypothesis: a `BatchedMesh` subclass overriding `setGeometryAt` with raw typed-array loops removes it. Cold pages, six per arm, alternating, headless M1/Metal: stock 2.9 / 6.0 / 5.3 / 12.7 / 17.5 / 5.5 ms (median 6.0, very noisy), fast 4.3 / 3.5 / 3.6 / 4.5 / 4.4 / 3.7 ms (median 4.3). Resulting buffers and geometry records were identical (matching fingerprints). Saving about 1.7 ms of a roughly 22 ms total synchronous path, with large noise on the stock arm, and it would depend on three's underscore-private fields (`_geometryInfo`, `_validateGeometry`, `_visibilityChanged`) pinned to one exact version. Judged not worth keeping; nothing in `src/` changed for it. The experiment file is parked as `test-results/perf-repair-20261124/bakeexp.ts.rejected-experiment` (ignored). No before/after paired benchmark of a constructor change exists because no change was adopted. The pass-3 numbers (total sync 33.9 to 24.9 ms, longest slice about 19 ms) remain the latest measurements.

### Application-level interruption (tests/browser/visitor-interruption.e2e.ts)
The real app and real `InteriorWorld` build (Chrome, SwiftShader, dev server); the interior scope is disposed at a chosen point, then a second `ensureInteriorLoaded()` runs.
- before the first visitor step (paced fallback forced by removing `Uint8Array.fromBase64`), halfway through the 17 visitor steps (same), immediately before registration, immediately after construction.
- Asserted each time: the interruption fired; no interior left loaded; the loading promise cleared so a fresh build may start; scope disposed with size 0; zero visitor interaction registrations right after and 1.5 s later (no abandoned work); no unhandled rejection; no uncaught page error; then the legitimate entry yields exactly 17 visitors, 327 instances, 17 registrations, 17 interactive, one visitor group, all conversations available, reduced motion holding positions.
- **Defect found and fixed:** after "immediately after construction" the first run failed with 17 stale visitor registrations. `InteriorWorld.dispose()` never disposed `SourceVisitors`, whose 17 proxies are registered outside the scope, so any failed or abandoned build followed by a retry would have registered 34. `dispose()` now calls `this.sourceVisitors?.dispose()` (idempotent since pass 3). After the fix all four cases pass (two runs, then again in the final suite).
- Disposing the interior mid-build lets the cooperative build continue to its next `scope.track()`, which throws, and `App.ensureInteriorLoaded` converts that into a failed load; the frame wait resolves on disposal, so nothing hangs.
- Not covered: the exterior-to-interior world director around an interrupted load (existing predictive-interior tests exercise failure and retry); rapid exit and re-entry of a completed interior is the grand tour and the earlier unit cycles.

### Baked geometry contract
Unit tests now also cover both decoder paths: with native `Uint8Array.fromBase64` the default `SourceVisitors` batch equals one built from procedural geometry (attributes, index, snapshot, positions byte-equal); with the native call removed, the baked path declines, the paced composer still completes and a default `SourceVisitors` builds 17 visitors and 327 instances with composer-identical positions. The earlier 78-geometry byte test (positions, normals, UVs, colours, indices, attribute order, index type, bounds), deterministic regeneration (two runs identical) and `build:collection` regeneration are unchanged. Package 17.47 MB of 20. Offline and standalone pass; no network dependency.

### Validation actually completed
`npm run gate` exit 0 (136 files, 1,367 tests, eslint zero warnings). Standalone: static, offline browser (17 visitors, 2 round trips, 7 requests) and runtime QA (14/14, 17/17, 0 remote) all passed on the first attempt this pass. Browser (isolated output `test-results/playwright`; installed Chrome): 17 of 17 passed, 17.5 minutes: art-direction, 5 cinema, grand tour, performance-lifecycle, 5 predictive-interior (ticketed entry, failure and retry) and the 4 interruption cases. E19 and E20 remain covered by the gate's geometry tests, not re-captured. Rendered 17-visitor parity was not re-captured this pass (no geometry or render code changed; the pass-3 0-pixel result stands). The boot test `museum.e2e.ts:34` was not rerun; its classification is unchanged. No timeout needed a retry this pass.

### Remaining
Headed M1 harness pairs and all twelve budgets (the earlier absolute failures are unchanged), the roughly 18 ms constructor (no safely removable single cost), human review. Bible: append-ready entry in `BIBLE_ENTRY.md`; canonical Bible not written.

### Changed files this pass
`src/world/InteriorWorld.ts` (dispose also disposes the visitors), `tests/browser/visitor-interruption.e2e.ts` (new), `tests/visitor-geometry-bake.test.ts` (decoder-path tests) and these docs. Rollbacks: constructor timers removed (file restored byte-identically from its pre-pass copy); the registration experiment never entered `src/`.

## Pass 5: independent verification, application-disposal correction, benchmark bias found (2026-11-25)

**Verdict: PARTIAL.** Pass 4 had already spent the one authorised constructor experiment, so no second experiment was run. This pass checked its claims independently, found two lifecycle gaps its tests could not see, applied one bounded correction, and found a bias in the paired-trial harness. No headed M1 measurement was taken; the original 83 to 99 ms regression is **not** shown resolved. Executor: Claude Opus 5.5 (the commission named Sonnet). Checkpoint before edits: `/Users/andrew/museum of me/checkpoints/perf-rescue-20261125-verification-start/`.

### Constructor profile, re-measured independently
No source edits: prototypes wrapped at run time with a self-time stack; six uninstrumented controls alternating with six wrapped runs; cold pages, dev server, headless Chrome, renderer reported by the page `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)`; load 6.6 to 11.9. Uninstrumented constructor median **18.2 ms** (16.5 to 19.8). Wrapping added about 4.3 ms (wrapped median 22.4), so the rows below are slightly inflated. Median self time:

| Commission item | Operation | ms | Calls |
|---|---|---:|---:|
| A | BatchedMesh allocation, counts, material | 1.2 | 1 |
| B | `addGeometry` | 5.6 | 78 |
| C | bounding box and sphere computation | 0 | 0 (supplied by the bake) |
| D | `addInstance` | 0.9 | 327 |
| E | `setColorAt` | 0.4 | 327 |
| F | `updateWorldMatrix`, `setMatrixAt`, sync code | 1.9 | 447, 327, 17 |
| G | hierarchy: `part`, `build` pose code, `Object3D.add` | 7.3 | 327, 17, 432 |
| H, L | shadow mesh and mask, hit proxy, routes, other | 3.7 | 1 |
| I | `supportHeight`, `resolveHorizontal` | 1.4 | 17, 17 |
| J | interaction registration | under 0.1 | 17 |
| K | `ResourceScope.track` | under 0.1 | 8 |

The longest slice is accumulated work: the longest single leaf call was 0.95 ms (one `addGeometry`); the first cold `build()` call took 2.65 ms. This agrees with pass 4. The private-field experiment's data was recomputed (stock 5.75, fast 4.0 ms median; pass 4 quoted 6.0 and 4.3) with the same conclusion: about 1.75 ms, rejected.

### Harness bias: the worktree's own `dist/` measures slower
With identical bytes, the build served from the worktree's `dist/` measured total 17.0 ms while a copy of it measured 10.2 ms, the same as the pre-correction build served from a copy (10.2). Order alternated; six runs per arm; load 3 to 7.5. Museum build and cold-entry time were slower from that location too (787 vs 486 ms; 1960 vs 1584 ms). Cause not established. **Pass 3 served its "baked" arm from the worktree `dist/` and the other arms from copies, so its baked figures (19.6 ms constructor, 24.9 ms total) carry this penalty and understate the bake.** An uncontrolled first run of this pass (fixed order, load 5 to 50) showed the same false regression and is kept in `perf-results/verify-arms.jsonl`; do not use it as evidence of a regression.

### Fair production comparison (both arms served from equal copies, alternating order, six cold ticketed runs, load 3.4 to 6.6, headless)

| | Clean main | Candidate (after correction) |
|---|---:|---:|
| Total synchronous visitor work, median (runs) | 6.2 (4.3, 10.5, 7.9, 10.3, 4.5, 4.6) | 10.1 (12.6, 9.9, 9.0, 8.6, 10.3, 15.4) |
| Constructor (longest slice) | 6.2 | 6.8 |
| Baked kit decode | none | 3.0 |
| Cold to interior / warm re-entry | 1660 / 1591 | 1590 / 1589 |
| Draw calls / triangles | 1176 / 123,090 | 1176 / 135,262 |
| Geometries / textures | 1871 / 158 | 1871 / 158 |
| Heap cold / warm MB | 74.1 / 73.2 | 70.1 / 73.3 |

Before versus after this correction, served equally: total 10.2 vs 10.2 ms, constructor 7.6 vs 7.5 ms, no difference. The remaining excess over clean main is about 4 ms in this setting with overlapping run ranges (both arms are bimodal), so treat it as small and approximate. Headless Metal is not the headed M1 harness. Geometry-registration, instance and matrix times were measured once, on the dev server (table above): the constructor code did not change.

### Two defects found, one bounded correction
Red first, on unmodified source: 6 of 6 new browser tests failed.
1. **Application disposal during a build.** `App.dispose()` disposes `interiorWorld`, which is null until a build finishes, so the build in flight kept going, registered controls into the disposed interaction manager, attached the interior to the disposed scene and resolved successfully. This exists on clean main (`src/app/App.ts` was unmodified). Pass 4 called `InteriorWorld.dispose()` through a hook, so it could not see this.
2. **Supplementary cases.** `InteriorWorld.dispose()` skipped `SupplementaryCases`; a build abandoned after that stage left its 15 controls behind.

Correction: `App` keeps a reference to the interior being built and disposes it, and refuses to start, adopt or attach an interior once disposed; `InteriorWorld` also disposes the supplementary cases and throws if it was disposed during its final stage (nothing after that stage tracks a resource). No pocket-world code, loop, timer or worker was touched. Rollback: revert the `App.ts` hunks and the two `InteriorWorld.ts` hunks of this pass.

`tests/browser/visitor-interruption.e2e.ts` now has 10 cases: the 4 existing ones, abandonment after the cast and cases, and application disposal at module load, halfway, the registration boundary, after construction and the final stage. All 10 pass. Each ends with a legitimate entry: 17 visitors, 327 instances, 17 visitor controls, 17 interactive; the 6 new cases also check 15 unique case controls and exactly one interior.

With the render loop **running** (headless Metal, scratch spec): application disposal halfway settled in 42 and 48 ms with 0 controls, 0 attached interiors, no rejection and no page error. The kit composer finished its remaining CPU-only steps before the scope's `track()` threw. Abandon-then-enter equals a clean entry in 3 of 3 pairs: 1866 geometries, 132 textures, 1249 calls, 220,327 triangles, 68 controls, scope 3634.

### Validation
- `npm run gate`: exit 0, 136 files, 1,367 tests, 17.47 of 20 MB, lint at zero warnings.
- Bake: regenerated twice, identical SHA-256 `7de05fa3…`; the gate includes byte parity and both decoder paths.
- Standalone: static, offline browser (2 round trips, 17 visitors, 7 requests) and runtime QA (14/14, 17/17, 0 remote) pass on the first attempt.
- Browser, installed Chrome, software GL: 22 of 25 passed on the first run (choreographer, 5 cinema, exterior-first, impossible-threshold, grand tour, performance-lifecycle, predictive-interior).
- **First failures, documented:** three 120 s timeouts: `impossible-threshold.e2e.ts:505`, `predictive-interior.e2e.ts:229` and `:297`. Rerun alternately on the pre-correction source and the corrected source (three rounds each, counting the first run): pre-correction 1, 2 and 3 failures of 3; corrected 2, 1 and 1 of 3. Every test also fails on the pre-correction source and passes at least once on the corrected source. Classification: software-GL, load-sensitive timeouts close to the 120 s limit, **not attributed to this correction**. They were not run against clean main, and pass 4 reported predictive-interior passing, so their baseline status stays unresolved. No timeout was raised.
- Not rerun: rendered 17-visitor pixel parity (no geometry, material or render code changed; the pass-3 result stands), E19/E20 captures (gate geometry tests pass), the 64-passage and 190-lane Chrome traversal, and the boot test `museum.e2e.ts:34`.

### Files changed this pass
`src/app/App.ts`, `src/world/InteriorWorld.ts`, `tests/browser/visitor-interruption.e2e.ts`, these docs, `OPERATIONAL_STATE.md`, `docs/COMPLETION_MATRIX.md`. `validation/reports/runtime-source-qa.json` was regenerated with identical content. Ignored evidence: `perf-results/verify-*.jsonl`, `test-results/perf-verify-20261125/`. `src/app/App.ts` is new to this candidate's diff.

### Remaining
Headed M1 pairs and the twelve absolute budgets (earlier failures unchanged), the three timeouts' status on clean main, human review. The canonical Bible was not written.

## Pass 6: acceptance closure, browser-timeout classification and review matrix (2026-11-25)

No source, test, config, threshold or timeout changed in this pass. Executor model: the brief named Sonnet; this session runs Opus 5.5. Checkpoint before any write: `/Users/andrew/museum of me/checkpoints/perf-rescue-20261125-pass6-start/` (hashes verified).

### The three browser cases
Three arms, equal scratch copies, unmodified tests, default 120 s limit, Chrome 158.0.8127.88, SwiftShader, 1280×720, DPR 1, headless, one browser at a time. A = clean main `ff6d983e`; B = pre-Pass-5 snapshot; C = current candidate (B and C differ only in `App.ts` and `InteriorWorld.ts`). Test files are byte-identical in all arms. Three rounds, order ABC / BCA / CAB. A passive probe sampled state and load. **27 of 27 passed**, and a further unmodified run from the worktree itself passed 3 of 3.

| Case | Clean main A | Pre-Pass-5 B | Current C | Rank correlation, duration vs max load (n=9) |
|---|---|---|---|---:|
| `impossible-threshold.e2e.ts:505` | 93, 94, 73 s (median 93) | 78, 85, 74 (78) | 75, 75, 81 (75) | 0.59 |
| `predictive-interior.e2e.ts:229` | 100, 70, 65 (70) | 75, 76, 70 (75) | 68, 72, 76 (72) | 0.52 |
| `predictive-interior.e2e.ts:297` | 90, 86, 82 (86) | 88, 85, 82 (85) | 88, 111, 89 (89) | 0.59 |

Every arm follows the same timeline: boot about 20 s, 35 to 50 s from import request to first build stage, build 3 to 7 s, prewarm 25 to 30 s more. No page error or crash; the only console errors are the module-load failure injected by case 505. Free memory was 110 to 330 MB with swap nearly full. **Limits:** the 120 s timeout was not reproduced in any arm, so nothing observed here directly explains a Pass 5 timeout. None of the correlations reaches the usual 0.70 threshold for nine samples; three rounds cannot exclude a small difference. Clean main's first runs were cold.

| Case | Stall point in the Pass 5 failures | Classification | Basis |
|---|---|---|---|
| 229 | waiting for build and state (one run at line 280) | ENVIRONMENTAL / LOAD SENSITIVITY (moderate confidence) | clean main took 100 s with load peaking at 17.8, boot 40 s instead of 20, versus 65 to 70 s in quieter rounds |
| 297 | line 328, waiting for prewarm | ENVIRONMENTAL / LOAD SENSITIVITY (moderate confidence) | candidate took 111 s with load peaking at 43, versus 88 to 89 s otherwise; every phase stretched in step |
| 505 | line 540, `prepareInterior()` after reload | UNRESOLVED (probably load sensitivity) | clean main was slowest, one of its slow rounds at load 14.5 and the other only 7.9 and cold; direct evidence is weaker |

No candidate regression was demonstrated in any case: current medians are at or below clean main for 505, and within about 3 s for 229 and 297. Pass 5 counts (pre-correction 6 of 9 failures, corrected 4 of 9, uncontrolled load and unequal serving) establish no cause. Each test waits on a real user-visible capability, so no assertion is wrong and none was changed. All three render medium quality on software GL with a thin margin under 120 s; whether to run them on low quality, as their sibling does, is an owner decision. Raw data: `test-results/perf-verify-pass6/{probe.jsonl,round1.log,round2.log,round3.log,location-control.log,pass5-failure-context/}`.

### Lifecycle protection, rerun on current source
`visitor-interruption.e2e.ts` 10 of 10 (5.6 min): four abandonments, abandonment after cast and cases, application disposal at five points; each ends in a clean entry with 17 interactive visitors, no late attachment, no abandoned case controls, no duplicate or leaked registration. Unit tests `visitor-lifecycle`, `visitor-geometry-bake`, `visitor-visuals`, `playwright-output-safety`: 23 of 23 (idempotent disposal, reduced motion, deterministic geometry).

### Functional evidence, reconciled
| Claim | Evidence | Applies to current source? |
|---|---|---|
| 17 visitors present and interactive, exit and re-entry, interruption | rerun in Pass 6 | yes, direct |
| Gate 136 files / 1,367 tests; standalone 14/14, 17/17, 2 round trips; Cinema 5 cases, grand tour, performance-lifecycle, impossible-threshold, exterior-first | Pass 5, source unchanged since | yes, direct (not rerun in Pass 6) |
| Conversations, idle and gaze, visitor identity | gate unit tests (Pass 5) and Pass 3 per-visitor report | yes; `VisitorVisuals.ts` unchanged since |
| 17/17 pixel parity | Pass 3 (SwiftShader) | carried: later passes changed no geometry, material or render path (bake SHA-256 `7de05fa3…` unchanged); not rerun |
| E19 inlay, E20 workbench | closure run of 2026-11-23 | carried: Layout, Museum, WingAtmosphere, GalleryPlinth unchanged since; unit tests pass; not rerendered |
| 64 passages, 190 lanes, 35 approaches | closure run of 2026-11-23 | carried: `layout.ts` and collision sources unchanged since; not rerun in Chrome |
| Human presentation, physical input, M1 | none | open |

### Twelve-budget matrix
Latest verified values are the 2026-11-23 headed harness on MacBook Air M1 8 GB, Chrome 157, ANGLE Metal, 1440×900, DPR 1, three alternating trials (clean main A1–A3, candidate B1–B3, that candidate **predating performance passes 2 to 5**). The current revision has had no headed run, so its status is **UNVERIFIED for all twelve** and historical passes are not inherited. No budget changed. Raw JSON survives for trial 3 of each arm only; earlier raw trials are lost (loss manifest) and quoted from the continuation report.

| Budget (limit) | Candidate B1 / B2 / B3 | Candidate result | Clean main A1 / A2 / A3 | Fails on clean main? | Candidate-specific regression proven? |
|---|---|---|---|---|---|
| Cold exterior start (≤ 2,000 ms) | 1,600 / 2,220 / 2,391 | FAIL (2 of 3) | 1,380 / 1,845 / 3,238 | yes, 1 of 3 | no |
| Exterior idle p99 (≤ 20 ms) | 17.6 / 33.8 / 37.1 | FAIL (2 of 3) | 34.3 / 18.8 / 50.1 | yes, 2 of 3 | no |
| Exterior walk p99 (≤ 20 ms) | 33.3 / 49.9 / 66.2 | FAIL (3 of 3) | 50.0 / 49.6 / 67.6 | yes, 3 of 3 | no |
| Exterior walk FPS (≥ 55) | 58.9 / 57.5 / 53.3 | FAIL (1 of 3) | 57.7 / 57.0 / 53.6 | yes, 1 of 3 | no |
| Steady interior p95 (≤ 20 ms) | 17.0 / 33.5 / 33.3 | FAIL (2 of 3) | 17.7 / 18.4 / 17.6 | not in canonical trials; yes in the shorter matched follow-up (33.4 / 17.7 / 33.5) | no, unresolved |
| Return to exterior p99 (≤ 20 ms) | 17.6 / 34.3 / 50.0 | FAIL (2 of 3) | 49.3 / 33.4 / 33.5 | yes, 3 of 3 | no, unresolved |
| Workshop 2,000 p99 (≤ 20 ms) | 17.5 / 17.7 / 33.4 | FAIL (1 of 3) | 17.7 / 49.5 / 33.2 | yes, 2 of 3 | no |
| Workshop sweep p99 (≤ 20 ms) | 17.6 / 84.4 / 34.4 | FAIL (2 of 3) | 17.7 / 51.0 / 49.2 | yes, 2 of 3 | no, unresolved |
| First-entry worst frame (≤ 900 ms, target 100) | 151 / 250 / 301 | PASS hard, soft target missed | 200 / 284 / 533 | no (soft target missed) | no |
| Second-entry worst frame (≤ 50 ms) | 50 / 216 / 99 | FAIL (2 of 3) | 67 / 184 / 166 | yes, 3 of 3 | no, unresolved |
| Round-trip DOM growth (≤ 20) | 0 / 0 / 0 | PASS | 0 / 0 / 0 | no | no |
| Round-trip heap growth (≤ 5 MB) | 0.9 / 0.7 / 1.4 | PASS | 1.3 / 0.7 / 1.3 | no | no |

Separately proven candidate cost, not one of the twelve: +83.1 / +86.4 / +98.9 ms synchronous visitor construction (headed M1, 2026-11-23). Pass 5 headless Metal, equal serving, puts the current total at 10.1 ms versus 6.2 ms on main. That is supplementary and **does not close the M1 finding**; the headed pairs do.

### Human review checklist
Parity and interaction tests do not replace this. The 17 captures below are 960×600 SwiftShader renders of the Nov 24 baked build (pixel-identical to `captures-before/`), made with one fixed camera offset, so several figures are in profile, from behind or grouped (guard: side/rear, large dark slab beside, face not shown; analyst: three figures in profile; sketcher: frontal, seated, book and stool visible). Faces and props need in-museum viewing.

| Review item | What to look at | Surviving capture |
|---|---|---|
| 17 identities, appearance and differentiation | each figure, against `VISITOR_VISUAL_LEDGER.md` | `test-results/perf-repair-20261124/captures-after/visitor-{architect,conservator,curator-archive,docent,guard,pilgrim,research-pair-a,research-pair-b,sketcher,student-a,student-b,visitor-access,visitor-analyst,visitor-katamari,visitor-local,visitor-memory,visitor-myth}.png`, `report.json` |
| Faces and props readable | eye-height, frontal, normal museum lighting | MISSING for most figures (see limitation) |
| Movement and seated poses | watch two minutes; sketcher seated | only the static frame above; motion MISSING |
| E19 inlay / E20 workbench | doorway sightline; workbench from its visitor spot | MISSING (lost 2026-11-24, `EVIDENCE_LOSS_MANIFEST.md`). `docs/evidence/caption-repairs-pass5-20261110/E20-*.png` is older caption work, not this repair |
| Interaction clarity | F prompt, conversation text, 17 visitors | MISSING |
| Keyboard, touch, controller, reduced-motion comfort | physical input devices, `prefers-reduced-motion` on | MISSING (unit and browser reduced-motion tests pass) |
| General presentation | arrival, pier walk, interior entry | `test-results/p7-pier-walk.png`, `test-results/p7-interior-entry.png` |
| Headed M1 presentation and frame pacing | owner-run | MISSING |

### Remaining, and verdict
**PARTIAL.** Two cases are classified as load sensitivity with moderate confidence and one stays unresolved; E19, E20, traversal and pixel parity are carried, not rerun; twelve budgets are unverified on the current revision and historically fail on both sides; human acceptance is open. Next action: the owner authorizes one headed M1 run (three alternating current/clean-main pairs, plus ticketed pairs) and walks the checklist in the museum. The canonical Bible was not written: the local copy is behind its remote and carries another session's uncommitted edit.

## Pass 7: screen-free Apple M1 paired comparison (2026-11-25)

No source, test, config or budget changed. The brief named Sonnet; this session runs Opus 5.5. Revision: worktree at `ff6d983e` with the unstaged candidate. Arms: A clean main (`git archive` of `ff6d983e`), C current candidate; every tracked source, script, data and public file was compared byte for byte against its origin, the harness and budget files are identical in both, and the lockfile matches. Each was built and served from an equal scratch copy. Build hashes: `test-results/perf-verify-pass7/dist-{A,C}.sha256`. Starting checkpoint: `/Users/andrew/museum of me/checkpoints/perf-rescue-20261125-pass7-start/`, which also holds a copy of this pass's raw receipts.

### Environment and admission
MacBookAir10,1, Apple M1, 8 GB, AC power, no thermal warning. Chrome 158.0.8127.88, **ANGLE Metal Renderer: Apple M1** read from the WebGL context in every run (not SwiftShader), 1440×900, DPR 1, quality medium, motion on, fresh context per run, production preview on 4180 and the dev server on 5180 as in the official config. Trials ran one at a time, admitted below 4.5 load, with before and after load, swap and CPU snapshots. Free memory was low (38 to 68% "free", swap 2 to 4.5 GB used) and Apple background indexing (`mediaanalysisd`, `mds`) ran in places. No process was terminated.

### Harness equivalence
`device.perf.ts` and `transitions.perf.ts` ran unmodified through a config that differs from the official one only in `headless: true` and an isolated output folder; the closure `ticketed.perf.ts` ran unmodified. Known differences from the 2026-11-23 headed run: new headless instead of a visible window (no on-screen presentation), Chrome 158 instead of 157, same flags and adaptive resolution. Frame intervals are paced at 60 Hz by the headless compositor, so this is a comparative diagnosis and cannot certify the headed requirement. A second spec (`extra.perf.ts`) adds a trace and `BatchedMesh` call timing and is never used for budget numbers. The first-entry fixture stays in the exterior in every context, as in November.

### Trials
Order A C, C A, A C: **three pairs completed**. An earlier first trial was voided before any number was read because my own image processing overlapped it (`raw/aborted-t1-A`). Load at the end of each arm, 1 min:

| Pair | Clean main | Candidate | Condition |
|---|---:|---:|---|
| t1 | 5.2 | 7.8 | candidate arm moderately loaded |
| t2 | 3.6 | **28.0** | candidate arm heavily loaded; `mediaanalysisd`, `fileproviderd` and `mds` were among the top processes afterwards |
| t3 | 3.5 | 3.5 | quiet in both |

No value was excluded. This is a post-hoc reading: the load difference confounds t1 and t2, and it fell on the candidate both times; a contribution from the candidate itself to that load cannot be excluded from these snapshots, though the quiet t3 shows none. **Only t3 is a clean matched pair.**

### Visitor construction and preparation
Ticketed run with no added instrumentation; `total` is the constructor stage plus the candidate's baked-kit decode:

| | t1 A / C | t2 A / C | t3 A / C (quiet) |
|---|---|---|---|
| Constructor stage, ms | 13.3 / 6.6 | 4.3 / 13.7 | 4.7 / 7.9 |
| Geometry decode, ms | none / 2.7 | none / 5.0 | none / 1.0 |
| **Total visitor CPU, ms** | 13.3 / 9.3 | 4.3 / 18.7 | **4.7 / 8.9** |
| Paired delta, ms | −4.0 | +14.4 | **+4.2** |
| Interior build, ms | 1142 / 817 | 806 / 2251 | 771 / 784 |
| Ticket to first interior frame, ms (instrumented run) | 1827 / 2122 | 1645 / 2692 | 1624 / 1639 |
| Worst ticketed cold frame, ms | 67 / 33 | 33 / 950 | 67 / 50 |

Instrumented run:

| | t1 A / C | t2 A / C | t3 A / C (quiet) |
|---|---|---|---|
| Total visitor CPU, ms | 6.1 / 17.0 | 6.0 / 21.4 | **5.2 / 9.0** |
| Main-thread task containing the visitor build, ms | 6.2 / 18.1 | 9.1 / 22.6 | **8.2 / 11.7** |
| `BatchedMesh.addGeometry`, calls and ms | 9, 0.8 / 78, 3.5 | 9, 0.8 / 78, 3.8 | 9, 0.6 / 78, 2.2 |
| `addInstance` plus `setColorAt`, ms | 0.2 / 0.7 | 0.5 / 1.4 | 0.5 / 1.1 |
| Longest main-thread task during the build, ms | 36.0 / 50.5 | 63.5 / 137.1 | **27.3 / 28.1** |
| Longest task, ticket to first frame, ms | 67.4 / 73.2 | 63.5 / 137.1 | **43.7 / 41.7** |
| Tasks over 50 ms | 1 / 2 | 2 / 10 | **0 / 0** |
| Total main-thread task time in the build, ms | 831 / 1305 | 832 / 1766 | 624 / 630 |

Both arms: 17 visitors, 17 interactive, 17 visitor controls, 68 controls, one visitor group; first visitor visible in the same frame as first interior frame; unchanged after five further ticketed round trips; warm re-entry 1579 to 1606 ms; geometries 1986 to 1987, textures 177, programs 86 in both; no page errors. Heap after five trips was 64 to 109 MB on main and 68 to 104 MB on the candidate (not GC-forced). The candidate submits about 12,170 more triangles at this view.

**Reading.** The original +83 to +99 ms candidate stage did not recur: the largest measured total was 21.4 ms, under heavy load. In the quiet pair the candidate's visitor work is about 4 ms above main, well under one frame, and neither the longest build task nor the longest pre-entry task differs materially. Across the six instrumented and uninstrumented pairs the paired delta is positive in five of six (−4.0, +4.2, +14.4; +3.8, +10.9, +15.4), so a small excess is supported; its size outside t3 is confounded by load. The headed regression is **not certified as closed**: that needs the official headed harness.

### Work displaced to startup (found by this pass)
The baked geometry sits in the `interior` chunk, which the startup graph fetches on **both** arms (first request at about 50 ms, before `main` runs). The chunk is 1,808,336 B (287,436 gzip) against 669,197 B (215,233 gzip) on main: **+72 KB compressed, +1.14 MB raw** at startup (startup transfer 727 KB against 657 KB). The gate's 20 MB package budget is unaffected. Cold start, worst of three: main 1243 / 1319 / 1325 ms, candidate 1594 / 1444 / 1678 ms (+351, +125, +353), inside the 2,000 ms limit in every trial. Individual starts were slower on the candidate in 7 of 9 index-matched comparisons (mean 1162 against 1392 ms), and a single later diagnostic load showed no difference (1408 against 1357 ms, 1 run). Cold start is therefore a **consistent but unexplained and unproven** difference: the extra bytes are certain, the time is not attributed to them, and t3 is the only quiet pair (the candidate was slower at positions one and two, faster at three). No fix was attempted.

### Twelve budgets
P pass, F fail, worst of the samples in each trial. Column B (official headed acceptance) is **UNVERIFIED on the current revision for every row**; the 2026-11-23 headed results describe an older candidate.

| Budget (limit) | Main t1 / t2 / t3 | Candidate t1 / t2 / t3 | Paired delta | A: headless-Metal diagnostic |
|---|---|---|---|---|
| Cold start (≤ 2,000 ms) | 1243P / 1319P / 1325P | 1594P / 1444P / 1678P | +351 / +125 / +353 | both pass; small consistent candidate slowdown, unexplained |
| Exterior idle p99 (≤ 20 ms) | 16.8P / 16.8P / 16.8P | 16.8P / 33.4F / 16.8P | 0 / +16.6 / 0 | candidate failed only in the loaded t2 |
| Exterior walk p99 (≤ 20 ms) | 16.8P / 33.3F / 16.8P | 50.1F / 83.3F / 16.8P | +33.3 / +50.0 / 0 | candidate failed in t1 and t2, main failed in t2; unresolved |
| Exterior walk FPS (≥ 55) | 59.5P / 59.1P / 59.5P | 55.8P / 53.1F / 59.4P | −3.7 / −6.0 / −0.1 | candidate failed only in the loaded t2 |
| Steady interior p95 (≤ 20 ms) | 16.8P / 16.8P / 16.8P | 16.8P / 16.7P / 16.8P | 0 / −0.1 / 0 | both pass, no difference |
| Return to exterior p99 (≤ 20 ms) | 16.8P / 16.8P / 16.8P | 50.0F / 33.3F / 16.8P | +33.2 / +16.5 / 0 | candidate failed in t1 and t2 only; unresolved, confounded by load |
| Workshop 2,000 p99 (≤ 20 ms) | 16.8P / 16.8P / 16.8P | 33.4F / 16.8P / 16.8P | +16.6 / 0 / 0 | candidate failed only in t1 |
| Workshop sweep p99 (≤ 20 ms) | 33.3F / 16.8P / 16.8P | 33.4F / 33.4F / 16.8P | +0.1 / +16.6 / 0 | main also failed once; unresolved |
| First-entry worst frame (≤ 900, target 100) | 217 / 233 / 150 | 267 / 483 / 200 | +50 / +250 / +50 | all pass the hard limit, all miss the target; candidate higher in each pair |
| Second-entry worst frame (≤ 50 ms) | 83F / 33P / 33P | 100F / 83F / 50P | +17 / +50 / +17 | candidate higher in each pair; main failed once; unresolved |
| DOM growth (≤ 20) | 0P / 0P / 0P | 0P / 0P / 0P | 0 | both pass |
| Heap growth (≤ 5 MB) | 0.8P / 0.8P / 0.7P | 0.6P / 1.2P / 0.9P | −0.2 / +0.4 / +0.2 | both pass |

In quiet t3 both arms pass all twelve hard limits (both miss the 100 ms first-entry soft target; the candidate's second entry sits exactly at 50). Nothing here supports a candidate-specific failure in the quiet pair. The signed consistency of cold start, first entry and second entry across three pairs is a small unresolved signal, not a proven regression. Evidence: `test-results/perf-verify-pass7/raw/{t1,t2,t3}-{A,C}/` (device, transition and ticketed JSON, budget checker output, environment snapshots), `trials.log`, `analyse7.py`.

### Human review package
`test-results/perf-verify-pass7/human-review/index.html` (copy in the checkpoint folder): all 17 identities with their surviving captures, per-item approval and notes controls, and copy-out. **Nothing is approved.** Verified by opening each capture: readable faces on Game Visitor and Seated Sketcher only; the Sketcher's seated pose, book and stool are clear; the Gallery Attendant's face is obscured (rear view, dark slab); the Analyst shows in profile with the tabbed file visible, so its face cannot be judged; nine captures cannot support an artistic judgment (Archive Curator, Myth Systems Researcher, Memory Architect, Floor Docent, Gallery Attendant, both students, both researchers), six give partial support (Local-first Engineer, Forensic Analyst, Accessibility Visitor, Installation Conservator, Visiting Architect, System Pilgrim), two are usable. The Conservator and the Myth Systems Researcher nearly coincide in their frame, which the owner should check in motion.

**New E19/E20 captures (Metal, current revision, camera from the continuation report).** Four images: clean main and candidate at the E19 sightline (51, 1.64, −9.94) and the E20 spot (51, 1.64, 10.2), in `test-results/perf-verify-pass7/captures/{A,C}/`. They show main's panel across the E19 aperture and the plinth in front of the E20 bench, both absent in the candidate. They are new evidence and do not replace the lost historical before/after images. The pier and interior captures `test-results/p7-*.png` survive from 2026-11-25 02:11.

### Files changed, remaining, verdict
Appended: this report, `BIBLE_ENTRY.md`, `OPERATIONAL_STATE.md`, `docs/COMPLETION_MATRIX.md`. **PARTIAL.** Three pairs ran but only one was quiet in both arms, the cold-start, first-entry and second-entry directions are unresolved, and the headed acceptance and human approval are open. Next: the owner authorizes one official headed run (three alternating pairs, quiet machine) and completes the review page. Do not read this as merge or release readiness. Canonical Bible not written (local copy behind its remote with another session's uncommitted change).
