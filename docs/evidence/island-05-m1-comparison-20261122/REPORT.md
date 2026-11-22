# ISLAND-05 Matched Apple M1 A/B Performance Comparison

- **Date:** 2026-11-22
- **Design:** Interleaved `A1 -> B1 -> B2 -> A2` sequential trials using unchanged `playwright.perf.config.ts` and `scripts/check-perf-budgets.mjs`
- **Build A (`main`):** `96145564f1fda5e8e37c775f53e5b2268790e863`
- **Build B (`feat/island-05-pocket-world-host`):** `c0ed9727eab50dbca46946f89cee08e3b2ad2350`
- **Verdict:** **VERDICT A — SHARED BASELINE DEFECT** (unchanged M1 release gate remains **BLOCKED**; PR #80 remains DRAFT and not merge-ready)

## 1. Environmental Comparability

- **Device / OS / Renderer:** Apple M1 MacBook Air (8 GB RAM), macOS Darwin 27.2.0 (`arm64`), Chrome `157.0.0.0`, `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)`, `1440x900` viewport, browser DPR `1`.
- **Quality & Effective DPR:** `device-results.json` prints `"quality": null` (because `window.__museum.quality` is undefined on `App`). By code inspection (`src/render/QualityTiers.ts`, `src/render/AdaptiveResolution.ts`), 8-core / 8 GB M1 resolves to `medium` (`maxPixelRatio: 1.5`, capped by DPR `1` -> `basePixelRatio: 1`), and steady/walk `p95` (`16.8–18.6 ms`) stayed below the `19.67 ms` downscale trigger so `resolutionScale` remained `1.0`.
- **Scene Parity (directly observed):** `exteriorWalk` (`2091` geom / `152` tex / `85` prog / `491` calls / `171,881` tris), `interiorSteady` (`2141` / `189` / `86` / `745` / `95,904`), and `exteriorAfterReturn` (`2141` / `187` / `86` / `529` / `190,911`) were identical across all four trials (`A1`, `B1`, `B2`, `A2`).
- **CPU & Memory Pressure:**
  - `A1`: CPU idle before `73.92% / 82.66%`, after `69.97% / 76.92%`, mem free `48% -> 53%`
  - `B1`: CPU idle before `84.9% / 87.94%`, after `57.36% / 79.47%`, mem free `52% -> 54%`
  - `B2`: CPU idle before `75.81% / 81.29%`, after `82.63% / 89.41%`, mem free `57% -> 56%`
  - `A2`: CPU idle before `77.41% / 89.44%`, after `61.72% / 85.53%`, mem free `58% -> 59%`

## 2. Matched A/B Comparison (All 12 M1 Budgets)

| Budget | Limit | A1 (`9614556`) | A2 (`9614556`) | B1 (`c0ed972`) | B2 (`c0ed972`) | Assessment |
|---|---|---|---|---|---|---|
| `cold-start` | <= 2000 ms | 2344 (FAIL) | 1307 (PASS) | 1450 (PASS) | 1372 (PASS) | B passed both trials (1372–1450 ms); A1 spiked on initial cold start only. |
| `exterior-idle-p99` | <= 20 ms | 17.8 (PASS) | 17.4 (PASS) | 17.7 (PASS) | 18.7 (PASS) | Both A and B passed cleanly; prior 31.6 ms single-run miss did not recur. |
| `exterior-walk-p99` | <= 20 ms | 33.4 (FAIL) | 33.5 (FAIL) | 33.5 (FAIL) | 33.5 (FAIL) | **Shared baseline defect** — all 4 trials failed identically at 33.4–33.5 ms (predictive prewarm route). |
| `exterior-walk-fps` | >= 55 fps | 58.4 (PASS) | 58.5 (PASS) | 58.4 (PASS) | 58.4 (PASS) | All 4 trials passed identically (58.4–58.5 fps). |
| `interior-steady-p95` | <= 20 ms | 16.8 (PASS) | 16.8 (PASS) | 16.8 (PASS) | 17.1 (PASS) | All 4 trials passed identically (16.8–17.1 ms). |
| `exterior-after-return-p99` | <= 20 ms | 17.6 (PASS) | 17.3 (PASS) | 17.4 (PASS) | 18.6 (PASS) | All 4 trials passed identically (17.3–18.6 ms). |
| `workshop-2000-p99` | <= 20 ms | 17.7 (PASS) | 17.6 (PASS) | 17.7 (PASS) | 18.7 (PASS) | All 4 trials passed cleanly; prior 31.4 ms single-run miss did not recur. |
| `workshop-2000-sweep-p99` | <= 20 ms | 34.3 (FAIL) | 17.6 (PASS) | 17.7 (PASS) | 18.6 (PASS) | B passed both trials (17.7–18.6 ms); A1 failed (34.3 ms), A2 passed (17.6 ms). |
| `first-entry-worst-frame` | <= 900 (target <= 100) ms | 84 (PASS) | 67 (PASS) | 134 (WARN) | 200 (WARN) | All 4 trials passed <= 900 ms limit; B1/B2 hit single-frame spikes > 100 ms target (WARN), with fewer >50 ms frames (1–3 vs A1 4–5). |
| `second-entry-worst-frame` | <= 50 ms | 51 (FAIL) | 18 (PASS) | 68 (FAIL) | 33 (PASS) | **Intermittent shared failure** — A1 (51 ms) and B1 (68 ms) failed; A2 (18 ms) and B2 (33 ms) passed. |
| `round-trip-dom-growth` | <= 20 nodes | 0 (PASS) | 0 (PASS) | 0 (PASS) | 0 (PASS) | All 4 trials passed with 0 DOM node growth across 10 round trips. |
| `round-trip-heap-growth` | <= 5 MB | 0.3 (PASS) | 0.4 (PASS) | 0.7 (PASS) | 0.4 (PASS) | All 4 trials passed cleanly (0.3–0.7 MB across 10 round trips). |

## 3. Classification: VERDICT A — SHARED BASELINE DEFECT

- **Pre-existing failure confirmed on `main` (`9614556`):** `exterior-walk-p99` failed identically in all four trials (`A1`: `33.4 ms`, `B1`: `33.5 ms`, `B2`: `33.5 ms`, `A2`: `33.5 ms` vs limit `<= 20 ms`), with `p50 = 16.7 ms`, `5–8` frames `> 33.4 ms`, and `2–4` frames `> 50 ms` across both builds. This matches the known predictive-prewarm exterior walk bottleneck on `9614556` (`[0, 0, 184]` triggers interior construction and Sanctuary texture upload).
- **Intermittent second-entry hitch:** Both `A1` (`51 ms`, with run 3 at `50 ms`) and `B1` (`68 ms`) failed `second-entry-worst-frame` (`<= 50 ms`), while `A2` (`18 ms`) and `B2` (`33 ms`) passed.
- **Prior single-run misses not reproduced:** Earlier single-run ISLAND-05 misses on `exterior-idle-p99` (`31.6 ms`), `workshop-2000-p99` (`31.4 ms`), and `workshop-2000-sweep-p99` (`48.3 ms`) all passed in both `B1` and `B2` (`17.7–18.7 ms`).
- **Release impact:** Shared baseline failure confirms ISLAND-05 did not introduce the `exterior-walk-p99` blocker, **but does not waive the M1 release gate**. All unchanged M1 budgets continue to govern merge readiness, so PR #80 remains a **DRAFT** and is **not merge-ready**.
