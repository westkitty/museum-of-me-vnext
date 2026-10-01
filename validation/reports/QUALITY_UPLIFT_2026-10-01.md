# Quality Uplift Audit — 2026-10-01

## Verdict

**UPLIFT PARTIALLY VERIFIED.** The paired offline measurements show large draw-submission and software-renderer frame-time reductions, the entry-screen duplicate-copy defect is fixed, and asset processed hashes are now checked by the existing asset validator. This does **not** meet the scorecard floor (four categories remain below 15/20), the 85+ POLISHED target, or human visual/audio/pointer-lock/device acceptance. GPU execution time and representative-device FPS remain **UNKNOWN**.

No new raster, model or audio asset was generated for this audit. The authored entrance raster was kept; only the competing visible HTML copy was repaired. No deployment, tag, release, merge, PR, or hosted verification is claimed here.

## Evidence labels

- **MEASURED** — produced by a repeatable command or observed runtime counter; the environment and limitations are stated.
- **OBSERVED** — visible in a local source asset, screenshot, browser/test output or GitHub record.
- **INFERRED** — a code/renderer explanation consistent with evidence but not isolated experimentally.
- **UNKNOWN** — no decisive evidence in this checkout/audit.

Automated and headless results support engineering claims. They do not substitute for human visual, audio, pointer-lock, touch-feel or representative-device acceptance.

## Repository and documentation reconciliation

**Observed on 2026-10-01:** this session branch is `arena/01a0f545-museum-of-me-vnext`, based on local/remote `main` at `901ec91496f533638c978a3846bd3ea0c7914f48`. The remote `release/v1.0.0` branch is at `0360bdd1c86692dd1e28f6a0dbad3f5a97040252`. GitHub shows PR #1 merged on 2026-09-03; exact-head run [33746867357](https://github.com/westkitty/museum-of-me-vnext/actions/runs/33746867357) reports `gate`, `browser`, `standalone`, and `workshop` success. The queried GitHub release list contained no release and `git ls-remote --tags` contained no `v1.0.0` tag. These are repository records, not hosted-response evidence.

An **open, unmerged PR #4** at `ad5fa1d706d9d5c76f83842cc41c0510101f96c8` proposes an active pre-1.0 status and a 73-identity development collection. The checked-out `main` source still contains the historical frozen 64→35 map. That disagreement is recorded; this task did not switch to or import PR #4. The current map remains protected by `data/exhibit-mapping.json` and the mapping/content validators.

| Contradiction found | Resolution applied |
|---|---|
| README, `OPERATIONAL_STATE.md`, release checklist and runbook said `release/v1.0.0` was current while `main` was an older unpublished baseline and PR #1 remained open. | Updated them to record `main` at `901ec914…`, remote release branch `0360bdd…`, PR #1 merged, and PR #4 open/unmerged. The PR #4 collection proposal is not represented as current source. |
| Operational metadata named a workstation path and `release/v1.0.0` as the active branch. | Replaced with the current Arena branch/base and dated remote observations; human/hosted gaps remain explicit. |
| `Reliquary_Final_SHA256SUMS.txt` looked like a current checksum manifest, but the rebuilt standalone and later runtime-source reports no longer matched; parent-directory historical sources were absent. | Preserved its original hashes as a **2026-08-21 historical record**, marked expected mismatches/missing parent files, and added a separate current artifact/profile checksum manifest. |
| Asset docs claimed all visible objects load through `AssetManager`, and `validate:assets` checked file hashes/budgets more broadly than it actually did. | Rewrote `docs/ASSET_PIPELINE.md` and `docs/ASSET_POLICY.md` to describe the separate procedural, GLB, curated-raster, Full Weasel and generated-audio paths. Extended `validate:assets` to verify 12 imported file hashes and the Full Weasel tree. Budgets remain `check:budgets`' responsibility. |
| Quaternius documentation said original source files were retained in `.asset-sources`, but that ignored cache is not in this checkout. | Kept acquisition hashes as historical provenance, marked the originals not locally reverified, and verified the three shipped GLBs' processed hashes. |
| Asset policy/pipeline wording implied `check:budgets` measures each exhibit against its A/B/C byte ceiling. | Corrected to the script's actual scope: initial transfer, deferred bundle and shipped-binary declaration are measured/checked; tier labels are validated, but per-exhibit byte-to-ceiling accounting is not implemented. |
| `Full Weasel` documentation said 128.24 MiB. | Re-measured the 65-file tree as 134,484,501 bytes / 128.25 MiB and verified its tree hash. |
| `ARCHITECTURE.md` described the initial tier as a GPU probe, and collision controls as having no jump. | Corrected to the actual hardwareConcurrency/deviceMemory/screen/mobile signals and the separate Space jump / location-triggered flight pad. |
| Earlier source/test comments claimed a 3%-transmissive Ring added 296 draws to a 325-draw scene, with no matching snapshot in this checkout. | Replaced that unsupported number with the controlled same-artifact measurement below: 520→996 Rotunda draws (45-frame SwiftShader run). |
| The earlier profiler's labels/coordinates did not match `PlayerController` yaw, player feet/eye convention, or `currentZone`. | Replaced them with fixed player-foot positions, yaw 0 facing north, and per-view expected-zone assertions; regenerated both paired profiles using the same final harness. Earlier profile figures are superseded. |
| Readiness language implied that code or CI proved a production URL, hosted headers/cache behavior, human visual/audio/pointer-lock quality or representative FPS. | Reworded README, deployment/release docs and operational status to say only what was observed. The hosted deployment endpoint was inaccessible to this audit's GitHub integration; deployment existence is therefore not asserted either way. |

The initial investigation and August walkthrough remain dated historical documents; their old “current” state is not this checkout's current truth. See `docs/INVESTIGATION_BASELINE.md`, `validation/reports/WALKTHROUGH_2026-08-19.md`, and the historical checksum file.

## Visual DNA and identity anchors

### Extracted visual DNA — OBSERVED / INFERRED

- **Nocturnal, dark-grounded setting:** navy/black field, restrained cold blue/cyan architecture and deep-purple shadows; local curated raster `embedded-00` shows the Central Nave's saturated violet, blue, cyan and gold installation against near-black.
- **Crimson orbit / crystalline facet:** the world-relative Blood Ring is the sky landmark. Its source material keeps a deep red base, red emissive facets, flat shading and clearcoat; the current material sets transmission to zero. The subtle refraction change is a performance tradeoff, not human-approved visual equivalence.
- **Threshold composition:** the authored entrance plate uses a fine gold arch, serif title, centered CTA and the museum's own copy over a dark architectural view. The direct current screenshot shows that plate without a second readable HTML copy. The local 3D arrival screenshot shows a nested entrance portal framing the central approach.
- **Project-specific artwork:** nine curated rasters carry distinct source/project identities; preserve them per project rather than applying one generic retouch or color grade.
- **Procedural museum identity:** six wing palettes, route threads, neutral Rotunda, geometric shell and night-island/water remain deliberate authored systems. No new dynamic lights or particle spray were added.

### Identity anchors with veto power

A candidate visual or asset change is **not an uplift** if it breaks one of these:

1. `src/assets/curated/embedded-01.avif` — authored entrance plate; SHA-256 `d62490ef9b64a76ddbf5057aa0573e036832464d0f5783f2216b997c5932dafa`. It is kept pixel-identical; tests preserve its role as the visible background while accessible instructions remain in the DOM.
2. `src/world/Sky.ts` Blood Ring — recognized crimson orbital silhouette; `tests/environment.test.ts` pins red hue/saturation, emissive intensity, flat facets, clearcoat and zero transmission. Transmission remains a configurable experimental override only in the profiler, not in shipped code.
3. `data/exhibit-mapping.json` — frozen 64 project identities → 35 physical exhibit slots; mapping/source-parity validators veto movement or identity drift.
4. `src/world/layout.ts`, collision, interaction focus/hitboxes and Workshop conservation — protected spatial contracts. The 14 source installations and 17 authored visitor conversations must remain live runtime behavior.
5. Persistent data, visitor controls, touch fallback, accessible DOM mirror, reduced motion and mobile layout — no optimization may trade these away.

### Asset-family disposition

| Family / disposition | Decision and evidence |
|---|---|
| Entrance raster — **KEEP** | Keep original AVIF and hash; visible duplicate DOM text is **REPAIRED** by visually clipping the semantic control instructions. `tests/browser/museum.e2e.ts` checks the relationship, dimensions and background; [visual-review-arrival.png](visual-review-arrival.png) is the before screenshot and [visual-review-entry-current.png](visual-review-entry-current.png) is the automated after screenshot. [visual-review-live-arrival.png](visual-review-live-arrival.png) records the automated view after entry. None is human approval. |
| Shell background / curated project rasters — **KEEP** | Keep all nine exact files and per-project identity; their imported bytes match declared processed SHA-256. No derivative was generated. |
| Procedural shell, plaza, wings, Rotunda, Sanctuary, garden and water — **KEEP + OPTIMIZE** | Maintain procedural-first ownership and identity; exact-value material interning and static batching reduce submissions. The dome-view triangle increase is recorded, not hidden. No geometry upscaling/subdivision or art rebuild. |
| Blood Ring — **REFINE** | Keep its red emissive/clearcoat facet treatment; omit the 3% transmission feature in shipped code after controlled measurement. Human review of the visual difference remains outstanding. |
| Quaternius population — **KEEP** | Keep three local, manifest-recorded GLBs; processed hashes pass. External source originals/hashes cannot be revalidated from this checkout because `.asset-sources/` is absent. No new third-party imports. |
| Full Weasel — **KEEP** | Keep the actual local first-party E27 application deferred in its iframe; 65-file tree hash passes. No replacement mock or network asset. |
| World material values — **UNIFY** | Intern only materials whose current own properties can be compared exactly; unsupported/custom shader states are refused. This is value deduplication, not a global color redesign. |
| Arrival enrichment — **ENRICH: deferred** | The current worktree's `data/workshop-placements.json` contains two display-plinth records and one arrival-shrub override. Its provenance and visual merit are unconfirmed; no additional props are proposed from this headless pass. |
| **REBUILD / REPLACE / REMOVE** | None justified by current evidence. Rebuilding the entry art, replacing project art, or removing a deliberate scene feature would require a concrete defect and regression review. |

**No asset was generated** in this audit. The current worktree's `data/workshop-placements.json` diff contains placement/scene-override records, not image, model or audio bytes; their provenance is unconfirmed and the file is not treated as part of the verified uplift scope. No new asset is claimed integrated.

## Performance experiment

### Method and environment

The baseline is a standalone build from `git archive 901ec91496f533638c978a3846bd3ea0c7914f48` in `/tmp/museum-baseline-901ec91/`, built without changing branches. Both baseline and candidate were profiled by the same final `scripts/runtime-profile.mjs` with browser context offline, Chromium `131.0.6778.0`, WebGL2 on ANGLE/Vulkan SwiftShader, DPR 1, viewport 640×360, `hardwareConcurrency=2`, `deviceMemory=4`, low quality, 900 ms per-view settle, and 45 rAF intervals per view.

The profiled candidate was built from this session worktree. At capture time, `data/workshop-placements.json` differed from `main` and contained two display plinths plus an arrival-shrub override. `src/main.ts` imports that file, so the candidate artifact and screenshots include those records. Their provenance is unconfirmed and they are excluded from the verified uplift scope; the measurements compare the complete worktree candidate to the archive baseline and do not isolate those placement changes.

| View | Profile player feet / yaw / pitch | Expected zone |
|---|---|---|
| Arrival Plaza → entrance | `[0, 0, 138]` / `0` / `0` | `plaza` |
| South vestibule → Rotunda | `[0, 0, 121]` / `0` / `0.02` | `south` |
| Rotunda floor → north | `[0, 0, 6]` / `0` / `0.02` | `rotunda` |
| Rotunda dome | `[0, 0, 0]` / `0` / `1.2` | `rotunda` |

`view.position` is the player's feet, the controller supplies 1.64 m eye height, and yaw 0 faces north (-Z). The profiler asserts the actual app zone for every view. Full methodology/counters are preserved in the three JSON files under `validation/metrics/`.

### Paired baseline → candidate

| View | Draw calls | Triangles | rAF p50 | Tracked app callback total mean |
|---|---:|---:|---:|---:|
| Arrival Plaza | 3,275 → 1,081 (−67.0%) | 218,988 → 120,696 (−44.9%) | 916.8 → 445.9 ms (−51.4%) | 51.202 → 12.096 ms (−76.4%) |
| Vestibule | 3,154 → 1,035 (−67.2%) | 213,588 → 115,996 (−45.7%) | 1,176.7 → 560.0 ms (−52.4%) | 88.916 → 14.576 ms (−83.6%) |
| Rotunda | 1,548 → 520 (−66.4%) | 137,292 → 82,662 (−39.8%) | 1,135.4 → 571.9 ms (−49.6%) | 27.231 → 9.262 ms (−66.0%) |
| Dome | 79 → 72 (−8.9%) | 35,500 → 41,310 (+16.4%) | 400.3 → 160.2 ms (−60.0%) | 6.893 → 4.602 ms (−33.2%) |

**MEASURED, not representative FPS:** SwiftShader's frame wall intervals remain hundreds of milliseconds; software raster/compositing dominates this environment. GPU timer queries were unavailable. CPU phase numbers include instrumented renderer submission and are CPU-side wall time, not GPU completion. Low quality has shadows disabled, so the static-shadow-map path is not exercised. The low boot ceiling means the current profile records zero governor changes; it does not verify an adaptive downshift.

**INFERRED visual risk:** batching preserves geometry/material values but changes object-level draw sorting. Alpha-blended surfaces can be order-sensitive even when their material is identical; no automated test here proves pixel-identical output. This is another reason the visual score is partial and a human must review the dome/clerestory/identity-panel views before claiming visual equivalence. A changed look that harms the museum's identity is a veto, not a trade accepted by the draw-call table.

### Same-artifact transmission control

The shipped candidate artifact was left unchanged at SHA-256
`b243d8e846863c6648397cd7ff1730ce857358f3f42e9958e747c21068e25937`. The profiler applied a
runtime-only Blood Ring material override from `transmission=0` to `0.03` after first render; this was
not integrated into the artifact.

| View | Draw calls, off → 0.03 | rAF p50, off → 0.03 |
|---|---:|---:|
| Arrival Plaza | 1,081 → 2,083 (+92.7%) | 445.9 → 997.0 ms (+123.6%) |
| Vestibule | 1,035 → 1,992 (+92.5%) | 560.0 → 1,327.7 ms (+137.1%) |
| Rotunda | 520 → 996 (+91.5%) | 571.9 → 1,321.6 ms (+131.1%) |
| Dome | 72 → 130 (+80.6%) | 160.2 → 453.4 ms (+183.0%) |

This is a **controlled render-submission result in the measured software backend**, not evidence that a
real GPU slows by the same percentage, nor evidence that the visual effect was unimportant. The
visible anchors kept are red emissive facets and clearcoat; human review of the refraction difference
is still needed. The experiment is retained at
`validation/metrics/runtime-profile-transmission-control.json`.

### Startup, uploads, shaders, memory and streaming

| Counter | Baseline → candidate | Interpretation |
|---|---:|---|
| Standalone bytes | 16,146,074 → 16,158,046 (+11,972 / +0.074%) | Artifact identity is in each JSON SHA-256. |
| DOMContentLoaded | 1,773.8 → 2,166.7 ms | Slower in this one noisy run; do not claim all startup phases improved. |
| App ready / first rendered frame | 9,001.2 → 7,751.2 ms / 10,869.1 → 8,668.5 ms | Lower in this run, but one run per side; noisy offline startup, not a stable boot benchmark. |
| Scene meshes / live renderer geometries | 2,151 → 1,385 / 1,698 → 1,067 | Lower scene/resource counters; not bytes of GPU memory. |
| Shader compile calls / CPU call time | 98 / 0.6 ms → 60 / 0.3 ms | Counts fell; timings are CPU-side WebGL calls. |
| Program link calls / CPU call time | 49 / 0.4 ms → 30 / 0.4 ms | Fewer calls; measured total call duration rounded to the same 0.4 ms. |
| Texture upload calls / CPU call time | 94 / 306.6 ms → 93 / 351.6 ms | One fewer call but +14.7% call time; CPU-side only. |
| Buffer upload calls / known typed-array bytes / CPU call time | 6,627 / 5,011,432 B / 22.3 ms → 4,256 / 5,427,696 B / 17.1 ms | −35.8% calls, +8.3% known bytes, −23.3% CPU-call time. The bake creates fewer larger uploads. |
| HTML image `src`→load events | 7 / 30,889 ms → 7 / 28,811.7 ms | Includes request and browser decode time for assigned `src`; not decode-only and sums overlapping lifetimes. |
| `HTMLImageElement.decode()` / `createImageBitmap()` calls | 0 / 0 in both runs | Does not imply zero image decode work; those API calls were not used. |
| Renderer end counters | 1,698 geometries / 87 textures → 1,067 / 86 | Live Three.js resource counts, not allocations in bytes. |
| JS heap | ~103 MB start/end → ~91.7 MB start/end | Coarse `performance.memory` samples; GC/platform variance prevents a before/after heap claim. |
| Streaming end | 4 resident, 0 active; 6 mounts / 2 unmounts in both | Telemetry is captured; no residency regression was observed in this scenario. |

Resource Timing reports zero entries for the offline single-file `file://` artifact; that does not
mean zero bytes were loaded. `textureUploadKnownBytes` counts typed-array sources only. GPU completion,
asset-specific decode time, exact device memory, shader GPU compilation time and power are **UNKNOWN**.

## Performance lever ranking

| Rank | Lever | Decision / evidence |
|---|---|---|
| **A — CRITICAL** | Remove redundant Three.js transmission pass for the Blood Ring | Keep the existing zero-transmission material; controlled same-artifact profile showed ~81–93% more submitted draws with 0.03. Maintain emissive/clearcoat and human-review the visual tradeoff. |
| **A — CRITICAL** | Exact-value material interning + static bake, with mixed-index normalization | Keep; paired full-view profiles show 35.6% fewer scene meshes and 66–67% fewer calls in the three horizontal approach views. The dome's submitted triangles rose 16.4%; do not describe it as universally lower geometry. |
| **B — HIGH** | Preserve raw frame time while capping simulation delta | Keep; `tests/loop.test.ts` proves a 60 s pause remains visible to diagnostics while simulation receives only the capped delta. Hidden pages and >1 s intervals are not governor samples. |
| **B — HIGH** | Remove frame-loop transient allocations in Lighting/StreamingManager | Keep; pool/cache changes have regression tests and aggregate CPU callback timings improved, but this profile does not isolate their individual contribution. |
| **B — HIGH** | Static shadow-map refresh | Code path retained; only static casters trigger refresh. **Not measured here**, since the profile's low quality disables shadows. Recheck at medium/high on a real device. |
| **B — HIGH** | Adaptive quality governor | Code and synthetic threshold/cooldown tests retained; no downshift was observed because this profile starts at low ceiling. Real device behavior remains unknown. |
| **C — OPPORTUNISTIC** | Spatially bucket large merged meshes | Hypothesis: recover some dome-view frustum culling while accepting extra draw calls. Do not implement unless a representative-device, per-view trace shows the 16.4% triangle increase matters. |
| **C — OPPORTUNISTIC** | 1%/0.1% tails on representative device | Collect at least 1,000 intervals for a minimally useful 1% tail; a 0.1% tail requires much larger samples. Current 45-sample tail values are not stable percentiles. |
| **REJECTED** | Upscale raster textures, subdivide geometry, add dynamic lights/particles, or add a dependency | No evidence of a defect that justifies these costs. They risk identity, mobile budgets, accessibility and frame stability. |
| **REJECTED** | Regenerate/replace entrance artwork | Existing authored plate is intact and byte-verified; defect was duplicate UI copy, not poor art. |
| **REJECTED** | Report SwiftShader wall time as device FPS/GPU time | Unsupported timer query and software renderer make that claim false. |

## First-five-minutes opportunity map

No aesthetic redesign was made without human observation. The implementation already has an exterior
spawn, entry plate, nested threshold, garden/water, central landmark, map/journal, floor-line
wayfinding and a deliberate reduced-motion/accessibility path. Automated source and screenshots
establish presence, not awe.

| Opportunity | Quality-delta hypothesis | Next decisive evidence | State |
|---|---|---|---|
| Entry copy hierarchy | Removing the visible duplicate makes the authored title/CTA clearer without losing accessible controls. | Human compare at desktop/mobile/zoom with keyboard and screen reader. | Code and automated screenshot observed; human **UNKNOWN**. |
| Arrival-to-vestibule framing | The current nested portal and central approach can make the route legible without new objects. | Human walk from exact spawn, video plus composition notes; test touch controls too. | Headless screenshot/source only; feel **UNKNOWN**. |
| Blood Ring landmark | Red emissive facets/clearcoat maintain color identity after transmission removal. | Human compare on real device at horizon and Rotunda; reject if it reads flat or ceases to be the same ring. | Performance cost measured; visual equivalence **UNKNOWN**. |
| Rotunda/dome | Batching lowers software profile p50 but submits 16.4% more dome-view triangles. | Medium/high representative-device profile and human vertical-look inspection. | Tradeoff **MEASURED** here; significance on target device **UNKNOWN**. |
| Sound/ambience | Existing audio is muted by default; deliberate opt-in could support arrival. | Real browser/device listen for clipping, subtitle match and volume control. | Code exists; audible result **UNKNOWN**. |
| Mobile touch | Narrow-screen HUD and 44 CSS px coarse-pointer targets reduce overlap/target risk. | Real iOS/Android portrait/landscape checks, touch walk/look, focus and panel scroll. | CSS/tests only; physical feel **UNKNOWN**. |
| Asset provenance | Local processed hashes now fail fast if curated/GLB/bundle bytes drift. | Restore source archive if owner needs independent original-source recheck. | Processed hash validation **MEASURED**; three third-party sources **UNKNOWN** locally. |

## Comprehensive Quality Uplift Scorecard

Rubric: 0 absent/unsafe; 1 weak or unknown; 2 partial / automated presence without decisive acceptance; 3 strong with stated caveats; 4 independently measured or fully evidenced for the dimension. Confidence is separate from score. Scores describe the current checkout after this candidate work, not a promise of future quality.

| Category / dimension | Score /4 | Confidence | Evidence / reason |
|---|---:|---|---|
| **1. Experience & first five minutes — 13/20** ||||
| Entry/onboarding clarity | 3 | Medium | Entry screenshot and browser assertion; no screen-reader or human usability acceptance. |
| Arrival composition and landmark read | 2 | Low | Source/screenshot observed, but first-person human composition review absent. |
| Movement and route continuity | 3 | Medium | Controller/collision/traversal contracts and browser paths; feel remains human. |
| Discovery / map / wayfinding | 3 | Medium | Real map/wayfinding systems and regression tests; no complete human walkthrough. |
| Atmosphere / audio / emotional pacing | 2 | Low | Procedural sky/water/lighting code exists; sound and awe are unreviewed. |
| **2. Visual DNA & asset quality — 14/20** ||||
| Identity anchors preserved | 4 | High | Original rasters and Blood Ring color/geometry contracts remain explicit. |
| Visual grammar / coherent world | 3 | Medium | Palette systems and actual local screenshots; full visual judgment remains open. |
| Asset provenance and file integrity | 3 | Medium | 12 processed-file hashes + 65-file tree checked; three original source files absent. |
| Rendering/geometry tradeoff | 3 | Medium | Draw-call/profile gains measured; dome triangle submission increases 16.4%. |
| Human visual acceptance | 1 | High confidence that it is **not recorded** | No human evidence record exists for this pass. |
| **3. Performance & efficiency — 13/20** ||||
| Draw-call / scene-graph efficiency | 4 | High for this harness | Measured 66–67% draw-call reductions in three horizontal views; not general hardware. |
| App CPU phases / allocations | 3 | Medium | Callback totals lower and allocation regressions tested; individual fixes not isolated. |
| Startup / shader / asset work | 2 | Low | One paired startup run is noisy; texture upload call time increased. |
| Memory / streaming | 3 | Medium | Geometry/resource/stream counters captured; JS heap is coarse and GPU bytes unknown. |
| GPU and tail-frame confidence | 1 | High confidence in limitation | GPU timer unavailable; 45-sample p99/p99.9 are weak order statistics. |
| **4. Protected contracts & robustness — 17/20** ||||
| Frozen mapping/content identity | 4 | High | `validate:mapping`, content/source parity and protected 64→35 data. |
| Collision/traversal | 4 | High | Automated route/geometry contracts; no human feel inference. |
| Controls/accessibility/reduced motion | 3 | Medium | Unit/browser paths plus semantic entry copy; physical touch/screen-reader acceptance open. |
| Persistence/resources/lifecycle | 4 | High | Existing integrity/quarantine and lifecycle regression suites. |
| Current-session regression and dependency hygiene | 2 | Medium | Fresh gate passed 594 tests; browser suites are blocked by missing Chromium. Production audit is clean, but the development dependency graph still reports 7 advisories. |
| **5. Evidence, docs & release truth — 14/20** ||||
| Reproducible machine snapshot | 4 | High | Three diffable JSON files identify artifact hashes, method and limitations. |
| Documentation claim traceability | 3 | Medium | Core current docs reconciled; remote PR #4 maturity conflict remains explicit. |
| Processed checksum/provenance chain | 3 | Medium | Current processed files verify; external original bytes are absent. |
| Automated exact-head/release evidence | 3 | Medium | Main exact-head CI is linked; Arena patch requires its own remote run after push. |
| Human/hosted/device evidence | 1 | High confidence in absence | Not performed/observed in this audit. |
| **TOTAL** | **71 / 100** | **Medium overall** | **Below 85+ POLISHED; four categories below the 15/20 floor.** |

The floor and target are **not met**. The score does not promote automated checks into human acceptance.

## Intervention ledger

| ID | Intervention | State | Evidence / caveat |
|---|---|---|---|
| PERF-01 | Material interning + static bake in Museum, environment and garden | **REAL** | Profile meshes 2,151→1,385; per-view calls/p50 above. Dome triangles +16.4% disclosed. |
| PERF-02 | Blood Ring transmission disabled in shipped material | **REAL** | Same-artifact runtime-only 0→0.03 control nearly doubled Rotunda calls; local artifact remains 0. |
| PERF-03 | Normalize mixed indexed/non-indexed geometries before merge | **REAL** | `tests/static-bake.test.ts`; fresh `npm run gate` passed. |
| PERF-04 | Reuse light/streaming state instead of frame-loop transient allocations | **REAL** | Fresh full suite passed the regression tests in `tests/performance.test.ts`; aggregate profile cannot isolate each change. |
| PERF-05 | Stop redrawing unchanged static shadow maps | **PARTIAL** | Source path and explicit refresh callers; low-tier profile has shadows disabled, so performance effect not measured. |
| PERF-06 | Adaptive quality governor | **PARTIAL** | Synthetic unit tests; actual profile at low ceiling had zero transitions. |
| LOOP-01 | Preserve raw wall time; clamp simulation separately; ignore hidden/resume hitches for governor | **REAL** | Fresh full gate passed `tests/loop.test.ts`; source is in current `App.ts`. |
| UX-01 | Hide visible duplicate entry copy but retain semantic instructions | **REAL** | Browser assertion and current screenshot; no human accessibility signoff. |
| UX-02 | Responsive HUD / coarse-pointer targets | **PARTIAL** | CSS present; physical phone and touch feeling unverified. |
| ASSET-01 | Verify imported processed hashes and Full Weasel tree in asset gate | **REAL** | `npm run validate:assets`: 12 imported file hashes and 65-file tree pass; external originals absent. |
| ASSET-02 | Generate/integrate new artwork | **NOT_INTEGRATED** | No asset generation was justified or claimed. |
| QA-01 | Human visual/audio/pointer-lock/representative-device review | **NOT_INTEGRATED** | Human acceptance record remains outstanding; automation cannot supply it. |
| PERF-07 | Spatially bucket static batches to improve dome culling | **NOT_INTEGRATED** | Opportunity only; reject until representative-device evidence justifies the draw-call tradeoff. |
| SEC-01 | Update vulnerable development-tool dependencies | **NOT_INTEGRATED / FOLLOW-UP** | `npm audit --omit=dev --audit-level=high` reports 0 production vulnerabilities; full graph has 7 dev advisories (3 moderate, 3 high, 1 critical). A breaking Vitest-major upgrade was not attempted in this performance/asset pass. |

No intervention is marked FAILED or ROLLED_BACK because no accepted candidate was knowingly left broken or reverted in this pass.

## Fresh validation outcome — 2026-10-01

| Check | Result |
|---|---|
| `npm ci` + `npm run gate` | **PASS** — typecheck, lint, all validators, production build/budgets/distribution; 594/594 Vitest tests across 28 files and 9/9 release-tool tests. |
| Fresh asset validation within gate | **PASS** — 17 governed registrations, 12 imported processed hashes, 65-file Full Weasel tree; 3 external original-source hashes not locally rechecked. |
| Standalone artifact rebuild | **PASS** — `b243d8e846863c6648397cd7ff1730ce857358f3f42e9958e747c21068e25937`, matching the current candidate and transmission-control profiles. |
| `sha256sum -c validation/metrics/ARTIFACT_SHA256SUMS.txt` | **PASS** — standalone output, 3 profile JSONs and 3 screenshots match. |
| Production dependency audit | **PASS** — `npm audit --omit=dev --audit-level=high`: zero findings. |
| Full development dependency audit | **FOLLOW-UP** — 7 advisory findings: 3 moderate, 3 high and 1 critical, all in the development dependency graph. No dependency upgrade was attempted; the available Vitest fix requires a major version change. |
| `npm run test:e2e` | **BLOCKED, not a product-test verdict** — all 6 cases stopped before test execution because Playwright's Chromium 151 binary was absent. |
| `npx playwright install chromium` | **BLOCKED** — repeated CDN download attempts ended with `ECONNRESET` before TLS establishment. |
| `npm run verify:standalone` | **PARTIAL** — static standalone SHA/source checks passed; offline browser launch and downstream runtime-source check could not run. |
| `npm run test:workshop`; `npm run qa:runtime-source` | **BLOCKED, same missing-browser cause** — both fail at `chromium.launch`, before product assertions. |

The Full Weasel tree validator hashes all 65 files (134,484,501 bytes / 128.25 MiB). The separate
`check:budgets` print of `128.24 MB` is its allowlisted-extension subtotal and omits the 14,503-byte
`manifest.json`; it is not a conflicting full-tree measurement or per-exhibit budget proof.

The current browser-blocked commands are **not** recorded as product failures or passes. Previously
captured Chromium 131/SwiftShader profile snapshots and the automated entry screenshots remain
separate, dated evidence; the clean lock now selects Playwright 1.62.1, which expects Chromium 151.
The Playwright package version used for the earlier Chromium 131 capture was not recorded, so that
exact browser-tool pair cannot currently be reconstructed from the lock alone. The standalone
artifact itself is reproducibly rebuilt to the stored SHA. After the profile snapshots, the harness
received a non-functional lint cleanup (discard the unused return value from the awaited probe
installation); sampling logic/schema and runtime artifact bytes are unchanged, so the stored
measurements were not rewritten for that cleanup. Human visual/audio/touch/pointer-lock/device
performance and hosted behavior remain **UNKNOWN**.

## Reproduction and validation

```bash
npm ci
npm run validate:assets
npm run typecheck
npx vitest run tests/loop.test.ts tests/performance.test.ts tests/environment.test.ts tests/quality-governor.test.ts tests/static-bake.test.ts
npm run gate
npm audit --omit=dev --audit-level=high
npx playwright install chromium
npm run test:e2e
npm run build:standalone
npm run verify:standalone
npm run test:workshop
sha256sum -c validation/metrics/ARTIFACT_SHA256SUMS.txt
```

The baseline reproduction starts from an archive, not a branch switch:

```bash
mkdir -p /tmp/museum-baseline-901ec91
git archive 901ec91496f533638c978a3846bd3ea0c7914f48 | tar -x -C /tmp/museum-baseline-901ec91
(cd /tmp/museum-baseline-901ec91 && npm ci && npm run build:standalone)
PROFILE_HTML=/tmp/museum-baseline-901ec91/release/The_Reliquary_of_Iterative_Becoming.html \
PROFILE_SOURCE_REVISION=901ec91496f533638c978a3846bd3ea0c7914f48 \
PROFILE_SOURCE_STATE='clean git archive baseline' \
PROFILE_OUTPUT=validation/metrics/runtime-profile-before.json PROFILE_FRAMES=45 npm run profile
```

The candidate was profiled from the rebuilt ignored artifact with these commands (the output paths
are repository-root-relative):

```bash
PROFILE_SOURCE_REVISION=901ec91496f533638c978a3846bd3ea0c7914f48 \
PROFILE_SOURCE_STATE='uncommitted working tree based on main at 901ec914' \
PROFILE_FRAMES=45 npm run profile
PROFILE_RING_TRANSMISSION=0.03 \
PROFILE_SOURCE_REVISION=901ec91496f533638c978a3846bd3ea0c7914f48 \
PROFILE_SOURCE_STATE='uncommitted working tree based on main at 901ec914' \
PROFILE_OUTPUT=validation/metrics/runtime-profile-transmission-control.json \
PROFILE_FRAMES=45 npm run profile
```

The harness writes the exact renderer, quality state, viewport, scenarios and artifact SHA into each
JSON. The candidate artifact was rebuilt after the docs/comment reconciliation; its SHA still matches
both candidate profiles. The checksum command validates that artifact, the three profile JSON files
and the three screenshots listed in the manifest.

Fresh local gate / standalone / Workshop / manifest outcomes are recorded in `OPERATIONAL_STATE.md`
and `docs/RELEASE_CHECKLIST.md`. GitHub exact-head CI and push results are recorded only after a
branch push. Human/hosted unknowns are not upgraded by those results.
