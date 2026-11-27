# V5 exterior walk: causal isolation and retained repair (2026-11-26)

## Equipment and method

- Apple M1 MacBookAir10,1, 8 GB; installed Chrome headless, ANGLE Metal, 1440×900, DPR 1. The owner's desktop was in use (Brave, the Claude app), so run-to-run variance is large; every comparison below is alternating and matched.
- `scripts/perf-trace-walk.mjs` reproduces the governing `tests/perf/device.perf.ts` sequence exactly up to the walk: one browser, three cold contexts, then on the third 3 s settle, a 10 s idle rAF sample, a CDP metrics read, and the same 10 s route from `[0, 0, 184]` with the same steering. It records per-frame app phase and optional Chromium tracing (renderer, GPU and viz threads). It is diagnostic only; the hard budgets and their checker are unchanged.
- Trace analysis scripts are in [diag/](diag/). Raw traces (≈18 MB each) are kept outside the tree at `perf-results/v5-trace-*/walk-trace.json.gz`.

## Measurement reconciliation (A1)

- p99 is `sorted[floor(0.99·n)]` over about 600 vsync-quantized intervals, so the walk fails whenever **six or more** frames miss a vsync in ten seconds. The V3 focused probe usually saw 2–4 misses and the governing run 6 or more. That is the whole "16.8 vs 33.3 ms" discrepancy: the same defect, sampled near the threshold.
- The probe differs from the governing harness: no prior cold contexts in the same browser, a wrapped `afterFrame` hook, PerformanceObservers, and a fresh `chromium.launch` with `executablePath` instead of Playwright's `channel: 'chrome'` plus a concurrent Vite dev server. None of these changes the cause; they shift how many misses land in the window.

## Captured missed frames (A2)

- Teleporting to the route start (`z = 184`) is inside the doorway approach, so **the interior import begins at frame 1 of the walk**. Interior construction then runs on the main thread for about 1.3–1.5 s while the visitor walks.
- In the governing sequence, per-frame phase tags put essentially every miss in preparation. Candidate trace: 11 of 71 construction frames missed, against 1 of 37 in GPU upload and 1 of 474 in steady walking.
- **Main thread (direct observation):** construction-phase utilization was 85%, with 16 tasks over 12 ms. Those were `TimerFire` construction slices of 30–62 ms plus a 102 ms tick at import start. V3's "4 ms in render" was true but looked only inside the render call; the cost sat in the tasks between frames.
- **GPU (refuted as primary cause):** hardware GPU time from `EXT_disjoint_timer_query_webgl2` during construction had a median of 7.1 ms and p90 of 10.7 ms. The GPU thread was about 40% busy in that phase, mostly WebGL command execution. Canvas2D raster added about 140 ms over the whole phase.
- Dev-build step attribution (`diag/stepgaps.mjs`, yield call sites) and CPU profile (`diag/build-profile.mjs`): the coarsest atomic build steps are cinema 33 ms (60 ms in production telemetry), source visitors 20, detailing:north 16, sanctuary 14, rotunda 13 and entrance 12. Total construction CPU is about 600 ms, spread across many steps with no single hot function.

## Experiments (A3)

| # | Hypothesis | Change | Result | Decision |
|---|---|---|---|---|
| 1 | One hitch (the 102 ms import tick, a GC) inflates `EventLoopYieldBudget`/warm slices to `waited×0.5`, so the next construction slices run 30–60 ms each | `SustainedFrameWait`: grow a slice only after three consecutive waits over 40 ms, sized from the fastest; same rule for `RendererHost` warm slices | Trace: longest construction task 62→20 ms, phase utilization 85→63%, tasks over 12 ms 16→10, phase 1,498→1,333 ms. Five alternating matched pairs: construction misses **11.4→8.4**, all walk misses 16.8→12.8; p99 still fails 5/5 in both arms | **Retained** (partial, mechanism and matched-trial supported) |
| 2 | Accelerated Canvas2D text raster and shared-image allocation overload GPU frames during construction | Build-time text canvases with `willReadFrequently` (CPU-backed) | Matched clean-idle runs indistinguishable (8, 11 vs 7, 9 misses); GPU timer queries show construction frames GPU-light | **Rejected and reverted** (files byte-equal to checkpoint) |
| 3 | Atomic build steps longer than a frame | Not run: expected effect (~1 miss per split step) is below trial noise here | — | Smallest decisive next experiment (below) |

The software-renderer contract is preserved: three consecutive slow waits still expand the slice (unit tests updated and extended, `tests/yield-budget.test.ts`).

## Verdict

Exterior walk p99 **remains over 20 ms** in every governing-sequence run (33–50 ms). The defect is now isolated: visible-frame misses come from main-thread interior construction overlapping the first ~1.4 s of the walk. No threshold, route, content or quality tier was changed.

## Smallest decisive next experiment

Choose one of two directions, each needing matched trials:

1. **Split the six named atomic steps** with internal yield points. A generator-style `buildCinemaArchitecture` keeps the synchronous `build()` path. Splitting source visitors, detailing zones, sanctuary, rotunda and entrance would target fewer than 3 construction misses.
2. **Product decision:** construct the interior during the arrival cinematic or ticket window (the title-prewarm window already exists), before the visitor can walk. This conflicts with the documented "prepare only on the doorway approach" choice, so it needs the owner's approval.
