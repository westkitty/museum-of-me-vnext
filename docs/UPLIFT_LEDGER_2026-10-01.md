# Museum of Me — Uplift Ledger (2026-10-01)

**Pass:** Quality-foundation integration onto the living collection line.
**Base:** `development/collection-revision-2-2026-09-03` at `fe534716d0cdb32073e954897b52b8ac8a42bd14` (73-project living collection, Visit Thread).
**Status after this pass:** see each row. Human visual/audio/pointer-lock/representative-device acceptance remains distinct and unverified throughout.

## What this pass is, and what it is not

A parallel quality-uplift session (`arena/01a0f545-museum-of-me-vnext`, based on the older `main`@`901ec91` snapshot) measured and repaired real weaknesses of the shared museum foundation: arrival-screen duplicate copy, render-submission pressure, missing adaptive quality, and unverified imported-asset bytes. That work was CI-green on its own branch but **stranded**: the living 73-project collection line does not contain it, and a wholesale merge was impossible because the two lines' documentation narratives disagree about which collection is current.

This pass selectively integrated the **code-level quality work** onto the living line, re-validated it against the living collection (637 automated tests, full canonical gate, real-browser journeys, offline standalone verification, and a fresh paired runtime profile), repaired two defects the integration itself surfaced, and recorded the result here. The sibling branch's documentation narrative was **not** imported; the living line's collection truth is untouched.

## Corrections discovered during the pass

| ID | Correction | Evidence | State |
|---|---|---|---|
| CORR-01 | The sibling arrival fix clipped the entry prompt's semantic copy but left `html[data-transparency='reduced']` and forced-colors modes painting an **empty, textless full-screen entry button**, because both modes replace the entrance plate background. The clipped copy now becomes the visible affordance again exactly when the plate is suppressed. Found during integration review; not covered by the sibling's tests. | `src/ui/museum.css`, browser e2e entry assertions | IMPLEMENTED |
| CORR-02 | The Workshop browser journey persists test-authored plinths and a shrub override into the **tracked** `data/workshop-placements.json` through the real save bridge, and only the standalone proof wrapper restored it. Running `test:e2e` alone therefore dirtied the authoring source (this is the mechanism behind the "unconfirmed provenance" placements observed in the sibling session's worktree), broke the next Workshop run's outliner count, and could ship test props into every build if committed. The test now snapshots and restores the manifest bytes itself; the standalone proof opts into keeping the authored source via `MUSEUM_WORKSHOP_KEEP_AUTHORED_SOURCE=1` and still restores the original bytes when done. | `tests/workshop-browser/workshop.workshop.e2e.ts`, `scripts/workshop-authoring-proof.mjs` | IMPLEMENTED |

## Arrival / entry presentation

| ID | Integrated improvement | Primary evidence | State |
|---|---|---|---|
| ARR-01 | The authored entrance plate is no longer overpainted by a second, competing column of HTML title and control instructions; the instructions remain in the accessibility tree via `aria-describedby` and return visibly when the plate is suppressed (CORR-01). | browser e2e entry assertions; runtime DOM probe; automated before/after screenshots for human review: `validation/reports/visual-review-arrival-2026-10-01-baseline.png` / `-candidate.png` | IMPLEMENTED + AUTOMATED VERIFIED (visual composition remains human judgment) |
| ARR-02 | Landscape-phone and coarse-pointer layout rules for the HUD footers, subtitle, entry prompt scrolling, and frequently used panel/select controls; the living line's own small-screen bottom-sheet system for panels is untouched and takes precedence. | `src/ui/museum.css` | IMPLEMENTED (real-device feel unverified) |

## Render cost

| ID | Integrated improvement | Primary evidence | State |
|---|---|---|---|
| PERF-01 | Value-exact material interning plus shadow-flag-aware static merging (`bakeStatic`) for the museum shell, persistent-environment layers and arrival garden; authorable Workshop roots and single-mesh features are protected from both. | `src/world/MergeStatic.ts`, `tests/static-bake.test.ts` | IMPLEMENTED + AUTOMATED VERIFIED |
| PERF-02 | The Blood Ring's shipped material no longer carries `transmission` (0.03), which forced Three.js to re-render the visible opaque list every frame; the red emissive facets, clearcoat and flat shading that define the ring are pinned by `tests/environment.test.ts`. | `src/world/Sky.ts`, `tests/performance.test.ts`, `validation/metrics/runtime-profile-transmission-control.json` | IMPLEMENTED + MEASURED; human visual acceptance of the removed subtle refraction remains pending |
| PERF-03 | On-demand shadow-map refresh: every shadow caster in the museum is static, so the 2048² depth map redraws only after boot, quality changes, WebGL context restore, or newly added shadow-casting geometry. | `src/render/RendererHost.ts`, `src/main.ts` | IMPLEMENTED + AUTOMATED VERIFIED |
| PERF-04 | Hot-path allocation removal: the lighting director and streaming evaluator no longer build short-lived objects/Sets every frame; `validate:hotpaths` now guards those two named per-frame methods explicitly. | `src/render/Lighting.ts`, `src/exhibits/StreamingManager.ts`, `scripts/validate-hotpaths.mjs` | IMPLEMENTED + GUARDED |

### Paired measurement on the living line (2026-10-01)

Same harness, same method, offline `file://` standalone artifacts, Chromium 153.0.8010.0 on ANGLE/SwiftShader, 640×360, 45 rAF samples per view. Baseline artifact built by `git archive fe534716…`; candidate built from this branch's tree. Full counters: `validation/metrics/runtime-profile-before.json`, `runtime-profile.json`, `runtime-profile-transmission-control.json`, checksums in `ARTIFACT_SHA256SUMS.txt`.

| View | Draw calls | Triangles | rAF p50 |
|---|---|---|---|
| Arrival Plaza | 3,275 → 1,080 (−67.0%) | 218,988 → 120,616 (−44.9%) | 825.2 → 292.9 ms |
| South vestibule | 3,154 → 1,034 (−67.2%) | 213,588 → 115,916 (−45.7%) | 1,094.6 → 429.9 ms |
| Rotunda | 1,548 → 520 (−66.4%) | 137,292 → 83,942 (−38.9%) | 1,132.6 → 470.9 ms |
| Rotunda dome | 79 → 72 (−8.9%) | 35,500 → 42,590 (+20.0%) | 308.9 → 151.3 ms |

**MEASURED, software-rendered:** these are CPU-side draw-submission and frame-interval counts in a non-representative renderer, not device FPS. The dome-view triangle increase is recorded, not hidden: merged meshes carry wider bounding volumes, so more geometry survives frustum culling in the upward-looking dome view even though submissions still fall. A same-artifact control re-enabling ring transmission 0.03 nearly doubled submissions again (1,080 → 2,081 arrival; 520 → 996 rotunda), isolating PERF-02's cost on this line's own artifact.

## Adaptive quality

| ID | Integrated improvement | Primary evidence | State |
|---|---|---|---|
| QUAL-01 | A `QualityGovernor` watches real p95 frame time (uncapped, visible tab only), steps the rendered tier down when the museum is missing frames and back up when it demonstratively is not, never exceeds the boot-detected ceiling, never overrides a visitor-pinned tier, and never persists its choice. | `src/render/QualityGovernor.ts`, `tests/quality-governor.test.ts` | IMPLEMENTED + SYNTHETIC-TEST VERIFIED |
| QUAL-02 | Settings reports the tier the visitor is actually getting ("Automatic — now running at …"), and adaptations are announced through the existing HUD status line. | `src/ui/SettingsPanel.ts`, `src/app/UILayer.ts` | IMPLEMENTED + BROWSER-PROBED |
| QUAL-03 | The render loop now records the true wall-clock frame interval for diagnostics/governor feed while still clamping simulation time after a long pause. | `src/app/Loop.ts`, `tests/loop.test.ts` | IMPLEMENTED + AUTOMATED VERIFIED |

Note: this environment boots the museum at the low tier, so the paired profile records **zero** runtime tier changes; an actual downgrade/upgrade cycle is proven only by the synthetic tests, exactly as recorded in `architecture.project.json`.

## Governance

| ID | Integrated improvement | Primary evidence | State |
|---|---|---|---|
| GOV-01 | `validate:assets` now verifies the SHA-256 of every imported file-backed runtime asset (12 files) and the Full Weasel bundle tree against their manifests, instead of trusting paths and declarations. | `scripts/validate-assets.mjs` | IMPLEMENTED + GATE-VERIFIED |
| GOV-02 | `npm run profile` exposes the paired runtime profiler, including `PROFILE_BROWSER_EXECUTABLE` for hosts that cannot reach the Playwright CDN. | `scripts/runtime-profile.mjs`, `package.json` | IMPLEMENTED |
| GOV-03 | `architecture.project.json` records adaptive quality and corrects `world.instancing` to true (`InstancedMesh` is genuinely used by exhibit asset generators). | `architecture.project.json` | IMPLEMENTED |

## Protected invariants re-proven after integration

- 35 physical exhibit slots, six wings, 73 current project identities — unchanged (`validate:mapping`, `validate:content`, collection tests).
- 14/14 source installation interaction paths and 17/17 authored visitor conversations in the offline standalone runtime, zero remote requests (`npm run verify:standalone`).
- Real-browser journeys: arrival/keyboard input, map + reduced motion, accessible collection, DexGPT entry gating and wayfinding, Full Weasel open/close, Visit Thread build/guide/narrow-viewport, command palette, journal search — all PASS locally (10/10, including the Workshop journey with its repaired isolation).
- Single frame loop, ResourceScope disposal, streaming budgets, frame-loop ownership, privacy and source-parity validators — all PASS in the canonical gate.
- `data/workshop-placements.json` remains byte-identical to the committed empty manifest after every browser/proof run in this pass.

## Corrections to older records

- `docs/OPERATIONAL_STATE_ADDENDUM_2026-09-03.md` states "Current authored project records: 72." The living collection at `fe534716` carries **73** authored identities (P073 2D Game Factory was added later the same day; `npm run build:collection` reports 73). The addendum is a dated record and is not rewritten here; this ledger records the correction.
- The `Reliquary_Final_SHA256SUMS.txt` historical 2026-08-21 record is not modified by this pass; current artifact checksums live in `validation/metrics/ARTIFACT_SHA256SUMS.txt`.

## Evidence still intentionally absent

Human visual composition of the arrival plate standing alone, the Blood Ring without transmission-based refraction, adaptive-quality announcement feel, representative-device FPS/frame pacing, pointer-lock feel, and touch behavior remain **UNKNOWN / UNVERIFIED** until a fresh human walkthrough on representative hardware. `validation/reports/HUMAN_QA_CHECKLIST.md` points the human tester at each of these.
