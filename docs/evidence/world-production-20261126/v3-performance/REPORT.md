# V3 exterior walk: M1 headless investigation (2026-11-26)

## Candidate and equipment

- Source: cumulative `feat/world-production-20261126` worktree at branch HEAD `3b59e96abdc90affae19d83bfbe8030e10f3942f`, with preserved uncommitted world source. Baseline: clean detached worktree at that HEAD, built independently. Focused probe preview ports were 4180 (candidate) and 4181 (baseline); each full governing harness later used 4180 and 5180 serially.
- Apple M1 MacBookAir10,1, 8 GB; Chrome 158 Headless with ANGLE Metal; 1440×900; device pixel ratio 1. No heavy browser suites ran concurrently with the measurements.
- The full governing harness used the same three workloads, ten-second exterior walking route from `[0, 0, 184]`, 3-second settling plus 10-second idle run, browser flags and resolution on both trees, in serial. Focused probes added after-frame diagnostics; their frame statistics do not replace the governing harness.

## Measurements

| Run | Exterior walking p99 | Other hard-budget failures | Result |
|---|---:|---:|---|
| Clean baseline, full `MUSEUM_PERF_HEADLESS=1 npm run perf:device` | **35.4 ms** | Idle p99 33.4 ms; second-entry worst 84 ms | **FAIL 3/12** |
| Preserved candidate, full same command | **33.3 ms** | None | **FAIL 1/12** |
| Clean baseline, matched focused probe | 16.8 ms | 3/597 frames >20 ms, max 33.4 ms | Diagnostic only |
| Preserved candidate, matched focused probe | 16.8 ms | 2/598 frames >20 ms, max 33.3 ms | Diagnostic only |

Both full runs passed all three workload tests and then failed the budget checker. The candidate passed **11/12** hard limits: cold start worst 1,435 ms, exterior walk 59 fps, interior steady p95 16.8 ms, return p99 16.8 ms, Workshop 2,000-placement p99 and sweep p99 each 16.8 ms, second-entry worst 50 ms (at its hard limit), and ten-trip growth of 0 DOM nodes / 0.7 MB heap. First-entry worst 167 ms passed the 900 ms hard limit but missed the 100 ms target. The baseline's first-entry worst was also 167 ms. The baseline p99 walk failure confirms inheritance, while the candidate's narrower failure set is not a performance acceptance pass. Headed device acceptance remains unverified.

An earlier targeted `PERF_MATCH=device.perf.ts` run measured only two workloads. Its candidate budget checker read four transition values from an older local file; the baseline checker reported those four as missing. Those partial checker totals are **superseded** by the fresh full three-workload runs above. The targeted raw file and log are retained, labeled as such, for audit only.

The missed frames in both matched probes cluster during `PREPARING_INTERIOR` and `PREPARING_RENDER_RESOURCES`. On the candidate, an observed 33.3 ms frame spent about 4 ms inside the app render call; another observed prewarm miss had zero geometry uploads pending. The baseline also had a 33.4 ms miss in resource preparation. The candidate's interior construction and environment stage timings were comparable to the clean baseline. These data support an inherited prewarm/frame-pacing issue but do not isolate a safe code-level bottleneck. No threshold, content, quality tier, or prewarm behavior was changed to manufacture a pass.

The focused probe often records only 1–4 missed frames and a 16.8 ms p99, while the governing baseline and candidate workloads recorded 35.4 and 33.3 ms p99. The probe's hooks and exact setup differ from the governing harness; this is unresolved variability, not proof that the hard limit passes. A decisive next experiment is a trace of the governing workload's missed frame with render-thread, GPU and driver events, followed by one isolated prewarm scheduling change and matched remeasurement. There is no optimized code candidate yet because no safe source-level bottleneck was isolated. The source remains **NOT COMPLETE FOR PRODUCTION** on performance.

## Raw evidence

- [Clean baseline full output](baseline-perf-full.log), [device results](baseline-device-results.json), and [transition results](baseline-transition-results.json).
- [Candidate full output](candidate-perf-full.log), [device results](candidate-device-results.json), and [transition results](candidate-transition-results.json).
- [Clean baseline matched probe](baseline-matched-probe.json), [candidate matched probe](candidate-matched-probe.json), and [candidate warm telemetry probe](candidate-warm-probe.json).
- Superseded targeted candidate [output](candidate-targeted-perf.log) and [device results](candidate-targeted-device-results.json).
