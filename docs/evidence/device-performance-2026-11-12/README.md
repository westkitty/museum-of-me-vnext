# Device performance — MacBook Air M1 / 8 GB — 2026-11-12

These are real measurements on the authorized device. Nothing here is estimated or simulated.

## Hardware and software

- **Machine:** MacBook Air, `MacBookAir10,1`, Apple M1, 8 GB unified memory.
  - Identified with `sysctl hw.model` and `system_profiler SPHardwareDataType`.
- **Power:** on AC power, battery 89 % and charging. The one-minute load average was 3.6 when the run started, because other local work was running.
- **OS:** macOS (Darwin 25.6.0).
- **Browser:** Google Chrome 157, a real installed channel, **headed** (not headless) at 1440×900 CSS px.
  - DPR 1 in this window.
  - WebGL renderer: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1)`. This is the hardware GPU, not SwiftShader.
- **Code:** branch `feat/intelligent-builder-20261111` at the island-path reroute (af19cc3, plus a test-only pin update).

## Method

The harness is Playwright driving Chrome. The files are `perf.config.ts.txt`, `device.perf.ts.txt` and `transitions.perf.ts.txt`. They are kept out of the CI suites.

- **Visitor build:** production build (`vite build`), served by `vite preview`.
- **2,000 placements:** the local Workshop, which only exists on the Vite dev server. Those numbers are therefore unminified dev-mode numbers.
- **Frame timing:** the page's own `requestAnimationFrame` intervals, recorded while the app runs its normal single loop. The display is 60 Hz, so 16.7 ms means one frame per refresh.
- **Memory:** Chrome DevTools Protocol `Performance.getMetrics` (JS heap, DOM nodes, listeners) plus three.js `renderer.info`. Leak checks force GC through `HeapProfiler.collectGarbage` first.
- **Startup:** three cold loads, each in a fresh browser context. "App rendering" is the moment the renderer has drawn more than 2 frames.

## Results

| Scenario | Frames | p50 | p95 | p99 | Worst | > 50 ms |
|---|---|---|---|---|---|---|
| Exterior idle at the pier spawn (10 s) | 59.9 fps | 16.7 | 16.8 | 17.4 | 17.7 | 0 |
| Exterior: real player walking path 1 (10 s) | 59.9 fps | 16.7 | 17.6 | 17.7 | 17.8 | 0 |
| Interior steady (10 s, soon after first entry) | 57.8 fps | 16.7 | 17.7 | 33.4 | 200 | 2 |
| Exterior after return (5 s) | 59.9 fps | 16.7 | 17.2 | 17.7 | 17.8 | 0 |
| Workshop, 2,000 placements, near the field (10 s) | 59.9 fps | 16.7 | 17.1 | 17.6 | 17.7 | 0 |
| Workshop, 2,000 placements, residency sweep: 28 teleports across the field, 400 ms apart (12 s) | 59.9 fps | 16.7 | 17.0 | 17.5 | 17.7 | 0 |

All frame times are in ms.

### Startup (production, three cold loads)

| Load | First contentful paint | App rendering | DOMContentLoaded | Transfer | Page errors |
|---|---|---|---|---|---|
| 1 | 1,052 ms | 1,331 ms | 628 ms | 508 KB | 0 |
| 2 | 804 ms | 1,086 ms | 439 ms | 508 KB | 0 |
| 3 | 724 ms | 962 ms | 364 ms | 508 KB | 0 |

### World transitions (production, three fresh pages)

- **Preparing the interior:** `prepareInterior` took 254, 813 and 385 ms.
- **First entry has a visible hitch:**
  - Worst presented frames across the three runs: 835, 585 and 334 ms.
  - There were 3–5 frames over 50 ms in the first ~4 s inside.
  - In one earlier, less controlled run, the first entry showed a single 6.3 s presented-frame gap. The controlled re-measurement did not reproduce it, so treat it as a possible cold-start outlier, not a typical value.
- **Later transitions:** later entries and returns were at most 34 ms per frame.

### 2,000 saved placements (dev Workshop)

- Replacing the manifest took 18 ms.
- 0 placements were live right after the load. 384 were live at the field, which is the cap. That stayed at 384 through the sweep.
- After clearing, geometry returned to the baseline of 464.
- No page errors.

### Memory and resources

- Exterior at spawn: about 14 MB JS heap, 465 geometries, 5 textures, 43 programs.
- After visiting the interior: about 33 MB (after GC), 597 geometries, 34 textures, 79 programs.
- After forced GC, across 10 more round trips, nothing grows:
  - DOM nodes stay at 701–702.
  - JS heap stays at 33.0–33.6 MB.
  - Listeners stay at 123.
  - Geometry and texture counts are stable.
- Without GC, DOM-node counts rose by about 105 per round trip in the first run. That was uncollected garbage, not a leak.

## Interpretation and limits

- On this device the exterior, including the rerouted paths and 2,000 placements under bounded residency, holds 60 fps with p99 under 18 ms.
- The open performance issue is the **first interior entry hitch**: 0.3–0.8 s of dropped frames, likely first-use shader and texture work. Later entries are smooth.
- **Not measured:**
  - Battery power, or high-DPR (Retina, DPR 2) windows. This window ran at DPR 1.
  - Long sessions (more than 5 minutes).
  - Thermal throttling.
  - Disk save and reload of 2,000 records.
  - Other browsers.
- Museum Health's in-app "Device frame time" check is about the currently edited manifest. It stays NOT TESTED, because these figures cover the canonical museum and a synthetic 2,000-placement field, not any arbitrary future scene.
