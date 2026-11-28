# V7 performance qualification protocol (declared 2026-11-27 before any V7 trial)

**Governing measurement (unchanged).**
- Command: `env MUSEUM_PERF_HEADLESS=1 npm run perf:device`. It builds the production bundle, runs `tests/perf/device.perf.ts`, then runs `scripts/check-perf-budgets.mjs`.
- The 12 hard budgets in `tests/perf/budgets.json`.
- Installed Google Chrome (`channel: 'chrome'`), headless, 1440×900, DPR 1, ANGLE Metal, on the MacBookAir10,1 (Apple M1, 8 GB).
- Routes, warm-up (3 s), frame sampling (the page's own rAF deltas), thresholds and the checker are not changed by V7.
- Headless on the M1 is a diagnostic on the target hardware. It is **not** the headed representative-device acceptance run.

**Host record for every trial.**
- Before the trial: `uptime`, the six busiest processes, and `memory_pressure`.
- During the trial: the load average and the top process, sampled every 15 s.

**Admissibility (fixed before any result is seen).** A trial is admissible only if all three hold at its start:
1. The 1-minute load average is ≤ 3.0.
2. No process outside this campaign uses ≥ 50 % CPU.
3. Free memory is ≥ 20 %.

A trial is also inadmissible if, during the run, the 1-minute load exceeds 6.0 or an outside process holds ≥ 50 % CPU in two consecutive samples.

Inadmissible trials are still run to completion where possible, kept, and reported with their reason. No trial is dropped because of its result.

**Acceptance (the V7 minimum, since budgets.json defines no repeat rule).** Three consecutive admissible complete trials on the same candidate, each passing all 12 hard budgets. Any admissible failure resets the count and is reported.

**Matched comparisons for code changes.** Alternate before/after builds in the same session (ABAB…), with at least three pairs. Report each pair, not only medians.
