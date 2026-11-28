# V7 performance trials (governing `perf:device`, protocol in PROTOCOL.md)

Every trial run is listed, including invalid and unfavourable ones. Each trial's raw output (perf log, budget lines, device and transition JSON, and host records before, during and after) was kept in the session scratch area. The figures below are copied from those records.

## Series 1: baseline (candidate `bf171e5` + V7 worktree)

| Trial | Start admissibility | During | Result | Notes |
|---|---|---|---|---|
| baseline-1 | ADMISSIBLE (waited 260 s; start load 2.81, free memory 49 %) | Admissible: peak 1-min load 5.17, top processes the run's own node/Chrome | **12/12** | second-entry-worst-frame 50 ms (limit ≤ 50); first-entry-worst-frame 167 ms (limit ≤ 900, target 100: WARN) |
| baseline-2 | ADMISSIBLE (waited 80 s) | n/a | **INVALID: no measurement** | The build failed type-checking (`TS6133` unused import in a new test helper written during the series). The candidate changed mid-series, so this was not a measurement of the declared candidate. |
| baseline-3 | ADMISSIBLE (waited 40 s) | n/a | **INVALID: no measurement** | Same build failure as baseline-2. |

Series 1 does not meet the acceptance rule (three consecutive admissible 12/12 trials), because two of its trials never measured anything. Neither result is unfavourable; there is no result.

**Process correction.** A series now runs only on a frozen tree. No source or test file changes between the series start and its last trial.

## Series 2: final candidate (`refs/checkpoints/world-production-v7-final-candidate`), frozen tree

The series ran after the final gate, the cancel regression test, the rehearsal failed-load test and the isolation scan. No file changed during it. Shortly before it, the owner closed two busy applications (a browser and a notes app).

| Trial | Start admissibility | During (peak 1-min load; notable outside processes) | Result | Misses |
|---|---|---|---|---|
| final-1 | ADMISSIBLE (waited 220 s) | 14.86; `secd` 54 % | **8/12: FAIL** | exterior-idle-p99 33.4 ms, exterior-walk-p99 33.3 ms, workshop-2000-p99 33.4 ms, workshop-2000-sweep-p99 33.5 ms (each limit ≤ 20) |
| final-2 | ADMISSIBLE (waited 140 s) | 15.55; `secd` 80 % | **10/12: FAIL** | exterior-idle-p99 33.2 ms; second-entry-worst-frame 83 ms (limit ≤ 50) |
| final-3 | ADMISSIBLE (waited 180 s) | **35.38**; `replayd` (macOS screen-capture service) 75 % | **9/12: FAIL** | exterior-idle-p99 33.3 ms, exterior-walk-p99 33.3 ms; second-entry-worst-frame 233 ms |

Passing metrics in every final trial:
- cold start 1,481–1,539 ms (limit ≤ 2,000);
- walk 58.7–59.5 FPS (limit ≥ 55);
- interior p95 16.7–16.8 ms;
- after-return p99 16.8 ms;
- round-trip DOM growth 0 nodes;
- heap growth 0.5–0.7 MB.

First-entry worst frame was 167–317 ms (limit ≤ 900, target 100: WARN).

**Verdict: FAILED.** The acceptance rule (three consecutive admissible 12/12 trials) is not met. No threshold, route or measurement interval was changed, and no trial was discarded or repeated to obtain a pass.

**Attribution: UNRESOLVED.**
- **The misses look like dropped frames.** Every p99 miss is at about 33.3 ms, exactly two 60 Hz frames. This is the same single-dropped-frame signature that r122 recorded on both arms of a matched A/B.
- **The host was much busier than for the passing trial.** All three trials started admissibly, but during them the peak load was 15–35, against 5.2 during the passing baseline-1.
- **The measured code is effectively unchanged since baseline-1 (12/12).**
  - The ordinary build's only V7 product change since then is the entry-dialog focus fix, which the perf routes never open.
  - The W09 clock and the Dexter seam live in world chunks the ordinary build does not ship.
  - Test helpers do not enter the bundle.
  This is reasoned from the code, not measured.
- **What would settle it:** a matched, interleaved A/B (baseline-1's tree against the final candidate, A1 → B1 → B2 → A2) on a machine that stays quiet throughout. That decision is the owner's.
  - Baseline-1 ran at 14:50. The closest local checkpoint before it is `refs/checkpoints/world-production-v7-w09-softlock` (14:44). The next, `refs/checkpoints/world-production-v7-dexter-seam-routes` (14:57), already includes the Dexter seam, which was edited during baseline-2 and 3.
