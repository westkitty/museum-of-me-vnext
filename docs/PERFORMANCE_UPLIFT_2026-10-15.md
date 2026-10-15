# Museum of Me — Performance Uplift / Evidence Ledger (2026-10-15)

**Project status:** ACTIVE DEVELOPMENT / PRE-1.0. **Evaluation candidate:** `perf/museum-lag-2026-10-15` on an isolated Big Mac checkout of `westkitty/museum-of-me-vnext`; source baseline `bfd755f42d536e8741a49bf9a25899fc223d887c`.

This packet separates **implemented changes**, **automated functional proof**, **measurements**, and **unverified device-performance outcomes**. Successful unit/browser tests prove functional contracts but do not prove that MacBook, Android tablet, and other real visitor devices have met frame-time targets. Do not describe this candidate as a v1.0 release or a Pages update.

## 16-point implementation matrix

| # | Intervention | Observed candidate implementation | Evidence state / remaining limitation |
|---|---|---|---|
| 1 | Full real-frame instrumentation | `Loop.afterFrame` sends unclamped presented-frame intervals to `Diagnostics.recordFrame` at render frequency; the 100-ms physics clamp remains isolated. The diagnostics expose p50/p95/p99, 1% low, CPU-phase timings, renderer info and current zone. | **IMPLEMENTED / UNIT VERIFIED.** No physical-device recording or valid GPU timer result yet. |
| 2 | Spatially bounded static batching | `MergeStatic` separates material-compatible geometry by bounded spatial cells and preserved top-level museum ownership, restoring frustum and wing filtering. Oversized structural spans remain unmerged. | **IMPLEMENTED / UNIT + BROWSER VERIFIED.** More potential draw submissions in some views; do not assume faster GPU time. |
| 3 | Room/portal visibility | `Museum.updateVisibility` filters remote wing render roots, preserves opposite axial sightlines, and uses conservative field-of-view + doorway angular margin at Rotunda. `PersistentEnvironment` respects the same visible-wing set. | **IMPLEMENTED / UNIT + BROWSER VERIFIED.** Conservative heuristic, not a general-purpose occlusion engine; human spatial/flightpad review still required. |
| 4 | Adaptive render resolution | `AdaptiveResolution` applies hysteresis and bounded 0.75–1.0 scale on automatic quality, respecting explicit quality and 30-fps cap and avoiding obvious CPU-bound downscale decisions. | **IMPLEMENTED / UNIT VERIFIED.** GPU-bound classification is heuristic; observe actual visual clarity and device GPU before accepting speedup. |
| 5 | Quality-tier propagation | `App.setQuality` updates `StreamingManager.setRadii`, background visitor policy, renderer pixel ratio/shadows, and low-tier water depth/transparency. | **IMPLEMENTED FOR THESE SYSTEMS / UNIT VERIFIED.** Reconfigure other quality-sensitive resident assets only if profiling justifies changes. |
| 6 | Bound exhibit construction spikes | Browser `requestIdleCallback` moves synchronous mounts out of rAF where available; E01/E02/E04 can enter preload earlier. Timing census observed ~22–37 ms for these individual CPU-only mounts. | **PARTIAL / UNIT + BROWSER VERIFIED.** `host.mount()` is still non-preemptible; splitting specific heavy exhibits into resumable tasks remains a larger targeted refactor. |
| 7 | Lazy world-space raster and text residency | Supplementary case textures use preview resolution outside 12 m; at most two full 1024×640 canvases are generated/resident near viewer. Canonical curated artwork loads close to visitors and releases outside hysteretic distance. | **IMPLEMENTED / UNIT + BROWSER VERIFIED.** Curated exact source bytes and interaction structure remain intact. |
| 8 | Zone-aware instances | 140 relief instances remain authored and addressable; the single batch submits only relevant wing instances. The authored source-visitor global BatchedMesh is preserved; ambient pedestrians receive distance visibility. | **PARTIAL / UNIT + BROWSER VERIFIED.** Splitting the 17-character batch into independent wings would need a justified benchmark. |
| 9 | Transparency overdraw | Low tier uses opaque, depth-writing water; medium/high preserve original transparent treatment. | **PARTIAL / UNIT + SOURCE VERIFIED.** No independently measured glass or mobile fill-rate profile yet. |
| 10 | Slower noncritical update rates | UI/HUD sync capped near 30 Hz; preexisting far-visitor throttling preserved. The physical 60 Hz fixed-step and all walking/interaction contracts remain unchanged. | **IMPLEMENTED FOR SELECTED SYSTEMS / UNIT VERIFIED.** No broad simulation-tick decimation without hotspot evidence. |
| 11 | Collision-query allocations | `CollisionWorld.near` reuses candidate scratch/seen generation array in the already-existing spatial grid, retaining collision geometry. | **IMPLEMENTED / UNIT + FULL GATE VERIFIED.** Real-device GC trace outstanding. |
| 12 | Raycast candidate narrowing | `InteractionManager` rejects out-of-range mesh bounding spheres while conservatively preserving group targets. | **IMPLEMENTED / UNIT + BROWSER VERIFIED.** No external BVH added absent complex-mesh bottleneck. |
| 13 | Shader and GPU warming | Prewarm dispatch is serialized; queued shader warmups can start in browser idle periods; wall-clock compilation and texture-initialization CPU timing exposed separately. | **PARTIAL / UNIT + BROWSER VERIFIED.** Browser wall times are not actual GPU timer-query measurements. |
| 14 | Visitor LOD | Distant Quaternius meshes can become invisible beyond 150 m while route progress and low-frequency distant animation continue. Original authored source-visitor BatchedMesh remains unchanged. | **PARTIAL / UNIT VERIFIED.** No new silhouette/geometry LOD asset was introduced because no evaluated low-detail variant is available. |
| 15 | Asset decode/upload/residency | `AssetManager.loadTimings` retains bounded load-wall evidence; curated artwork residency is distance-sensitive; existing Draco/Meshopt/KTX2 and deferred large embedded artifact remain intact. | **PARTIAL / STATIC + BROWSER VERIFIED.** Stage-separated decoder and GPU-upload timing, comparative encodings, and mobile texture budgets require profiling. |
| 16 | Long-session lifecycle and embedded contention | Full Weasel pauses museum RAF and idle mount/warm scheduling while foregrounded and resumes on close if visibility/context allow; texture and scope disposal audited. | **IMPLEMENTED FOR MODAL + EXISTING MEMORY TEST / BROWSER VERIFIED.** Real 10-minute device thermal/GPU settling and repeated iframe open/close benchmark outstanding. |

**Additional targeted improvement:** the shared `Filament` implementation now renders dynamic line segments through a single `InstancedMesh` per filament rather than a separate draw per segment. Starsilk Universe avoids redundant star-field matrix updates where only filament sway changes; preserved physical interaction and checked all 35 exhibits.

## Test and evidence inventory

- `npm run gate`: **PASS**, 36 permanent test files / 672 unit tests, collection 73 projects / 35 exhibits / 6 wings, TypeScript, lint, content, mapping, privacy, frame-loop ownership, hotpath, visual, budget and release-dist checks.
- `npm run test:e2e`: **PASS**, 20/20 real Chromium user journeys (including updated art-direction assertions, input restoration, Workshop, new portal/texture/iframe lifecycle test), software-rendered. Human usability signoff not implied.
- `npm run build:standalone`: **PASS**, self-contained HTML under `release/`; static `verify-standalone-offline.mjs`: **PASS**. `runtime-source-qa.mjs`: reported **14/14 authored installations, 17/17 visitor dialogues, zero remote requests**. The generated 14-line mesh-count report drift is due to intentional instanced segment replacement; original tracked report was preserved and new evidence copied outside Git to `/tmp/museum-perf-runtime-source-qa-20261015.json`.
- **Final standalone Chromium verification: EXIT 0, PASS** (`zone=plaza`, 17 authored visitors, 54 local requests) against the rebuilt candidate, with a bounded 90-second software-WebGL bootstrap allowance. An earlier diagnostic reached `window.__museum` after 64.2 seconds with zero JavaScript exceptions, confirming that the previous 60-second automated timeout could falsely fail. These are software-renderer startup numbers, not acceptable user-device startup targets.
- Protected domain: no current edits to the canonical Starsilk sources, gallery roster, collision-authoritative layout, Workshop placements, dependencies, gameplay meaning, persistence format, Pages deployment, or release label.

## Matched software-renderer experiment (NOT a real-device FPS verdict)

An identical architectural-shell Playwright procedure on Big Mac, Chromium + SwiftShader WebGL, 1280×720, low quality, DPR 1, fixed Rotunda/North/East/South/West/plaza camera poses, excluding timing-state-dependent exhibit payloads, compared source baseline against an intermediate optimized candidate. Each view had three timed render submissions after one warm render; below are single-run medians and static render statistics. This experiment has limited statistical power and is susceptible to CPU scheduling, warm-up, and driver noise.

| View | Baseline calls | Candidate calls | Baseline triangles | Candidate triangles | Baseline CPU ms | Candidate CPU ms |
|---|---:|---:|---:|---:|---:|---:|
| Rotunda | 355 | 408 | 88,756 | 64,388 | 13.2 | 12.2 |
| North | 769 | 861 | 120,676 | 113,012 | 32.2 | 17.9 |
| East | 691 | 701 | 115,472 | 103,128 | 30.2 | 12.9 |
| South | 742 | 802 | 115,940 | 109,392 | 37.1 | 14.8 |
| West | 588 | 656 | 112,392 | 101,276 | 29.9 | 12.2 |
| Plaza | 871 | 879 | 122,680 | 113,276 | 25.6 | 19.7 |

**Interpretation:** candidate frustum/portal filtering reduces submitted triangles in all six measured views but generally increases draw submissions. CPU values are suggestive only; any percentage speedup, FPS lift or thermal advantage needs repetitions on target hardware. The candidate was tuned after an earlier Rotunda regression and retains all six-wing scene roots.

## Real-device acceptance contract

1. Record a **matched baseline and candidate** with identical viewport, measured DPR, explicit quality tier, cache state, browser version, camera route and duration. Test native MacBook/Brave and Android tablet separately; no extrapolation from Big Mac/SwiftShader.
2. Capture a minimum 60-second segment in each of: night exterior, Rotunda/flightpad, two wing transitions with heavy E01/E02/E04 activation, Sanctuary, E27 embedded open/close. Include cold and warm runs, and an extended repeated-traversal session.
3. Compare per-presented-frame p50/p95/p99, long frames >50/100 ms, draw calls/triangles, CPU costs, shader/mount spikes, effective DPR, resident resources and any supported GPU counters. Watch for camera/portal pop-in, dialogue/visitor freezes and text-clarity loss.
4. Accept each optimization only when its measured contribution helps an actual hardware bottleneck without regressing protected functionality; revert individual interventions when inconclusive or harmful. Representative device and human perceptual acceptance remain **UNKNOWN / UNVERIFIED**.

## Safe delivery

Commit/push only the scoped performance source, tests, this evidence document and append-only operational-state addendum on the isolated performance branch. **Do not merge into `main`, update `pages-preview`, publish Pages, tag, or declare 1.0.** A branch commit does not prove hosted deployment or physical hardware performance.
