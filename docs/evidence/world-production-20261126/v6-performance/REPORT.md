# V6 interior construction performance (2026-11-26)

Governing budget: headless M1 `perf:device` hard budgets.

- Route, thresholds and checker (`scripts/check-perf-budgets.mjs`) are **unchanged**.
- No content was removed.
- Installed Chrome; headless, so browser emulation on an M1. This is not a representative-device or physical-device measurement.

## Cause (from V5)

The governing exterior walk starts inside the doorway approach. Interior construction therefore runs on the main thread during the walk's first ~1.4 s. A handful of coarse build steps were each one long task:

- rotunda
- entrance
- cinema
- zone detailing
- sanctuary
- source visitors
- supplementary cases

## Change

`src/util/buildSteps.ts` adds `BuildSteps`: a construction routine written as a generator. Each bare `yield` is a boundary where the scene graph and collision are consistent.

- **Cooperative path.** `runStepsCooperatively` hands the frame back at every boundary through the existing `EventLoopYieldBudget.checkpoint`. The checkpoint only actually yields once the slice is spent, so fine boundaries cost nothing.
- **Synchronous path.** `runStepsSync` drains the same routine in one call, for tests, tools and the standalone.
- **Split into steps:** rotunda, entrance, cinema architecture, zone detailing, the Dexter sanctuary, source visitors, supplementary cases, and static-merge cloning (every 32 clones).
- **Unchanged:** what is built, the build order, and when anything becomes visible.

Telemetry now records CPU-only stage time plus grown and largest yield slices.

## Matched A/B (same machine, alternating, V5 source vs V6 candidate)

Exterior-walk p99 and frames over 20 ms per walk. The over-20 frames are split by phase: interior construction (int), render (ren) and other.

| Pair | Load | V5 p99 | V5 >20 ms (int/ren/other) | Load | V6 p99 | V6 >20 ms (int/ren/other) |
|---|---:|---:|---|---:|---:|---|
| 1 | 15.1 | 50.0 | 14 (13/1/0) | 13.5 | **16.8** | 3 (3/0/0) |
| 2 | 9.9 | 33.3 | 10 (8/1/1) | 8.0 | **16.8** | 5 (3/2/0) |
| 3 | 5.7 | 33.4 | 9 (7/1/1) | 5.7 | **16.8** | 3 (2/1/0) |
| 4 | 4.7 | 33.3 | 11 (9/1/1) | 4.3 | **16.8** | 4 (3/1/0) |
| 5 | 4.3 | 33.3 | 8 (7/1/0) | 5.3 | **16.8** | 3 (2/1/0) |

- A first pass of four pairs agreed: V6 16.8 ms in 4/4 pairs; V5 33.3–50.1 ms.
- Raw data: `perf-results/v6/ab-pass1.txt` and `ab-pass2.txt` in the worktree.

## Full `perf:device` (12 hard budgets in `tests/perf/budgets.json`, unchanged checker)

| Run | Result | Failing budgets |
|---|---|---|
| 1 | **PASS 12/12** | none. Walk p99 16.8 ms, walk 59.5 fps, cold start 1,539 ms, second entry 50 ms (at its limit); first entry 233 ms (within 900 ms limit; WARN above its 100 ms target) |
| 2 | FAIL 9/12 | cold start 2,362 ms; walk p99 33.3 ms; Workshop sweep p99 50 ms |
| 3 | FAIL 10/12 | walk p99 33.3 ms; second entry 83 ms |

- Runs 2 and 3 ran back to back while the machine was heavily loaded. Load averages ran from 8 to 15, partly from other processes not under this campaign's control.
- The failures moved between budgets from run to run, which points to contention rather than a fixed regression. Even so, **the repeated-trial acceptance criterion is not met.**
- **Final qualification on the exact candidate (2026-11-27, 01:26–01:50):**
  - Four runs passed 4, 5, 6 and 6 of 12 budgets. Even exterior idle p99 failed (33–50 ms), with the 1-minute load up to 32 from processes outside this campaign.
  - A matched control alternated the 21:11 build (the one that passed 12/12 at 21:15) with the candidate. The 21:11 build failed just as badly, while the candidate was clean in 2 of 3 trials. See [ab-regress.txt](../v6-validation/ab-regress.txt).
  - These failures are therefore attributed to machine state, not to code. **The repeated-trial acceptance criterion is still not met** and needs a quiet machine or the headed representative device.
- `second-entry-worst-frame` sits exactly at its 50 ms limit even in the passing run. It has no margin and is the next hard budget to watch.

## Not changed

- Thresholds, routes and content are unchanged.
- The `interior` chunk is still statically imported at boot (see the [distribution report](../v6-distribution/REPORT.md)). Making it lazy would move its parse into this same walk window.
