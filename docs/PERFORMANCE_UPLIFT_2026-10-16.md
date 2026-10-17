# Museum of Me — Performance Uplift & Comparative Decision Record
**Date:** 2026-10-16
**Source baseline:** `westkitty/museum-of-me-vnext` commit `dfc7349aee6406be19b2534442494829d3053588`
**Project maturity:** ACTIVE DEVELOPMENT / PRE-1.0
**Scope:** Low-risk frame-work reduction, artwork streaming shader stability, and protected visualization behavior. No dependencies or engine changes.

## Why this pass exists
After the previous performance uplift, Museum source still performed a full BatchedMesh body-transform submission for each nearby authored visitor on every 60Hz simulation tick. When each of 17 visitors is near the Rotunda, this creates hundreds of matrix writes per simulation frame. Two other local hotspots were observed: E22 constructed fresh CatmullRom curves and point vectors repeatedly during ordinary ambient updates; curated art swapped between a material with no texture and one with a texture, changing the `USE_MAP` shader variant. Supplementary cases also replaced textures with unnecessary `material.needsUpdate` flags and had no resident-detail hysteresis. These are source-grounded issues; the actual fraction of the user's perceived GPU stutter attributable to each is not known.

## Frozen implementation groups

| ID | Implementation | Fidelity and authority constraints | Evidence |
|---|---|---|---|
| U1 | Author-controlled visitors continue **60Hz simulation, collision and interaction**. Batched-body matrix updates are 60Hz only within 12m conversational proximity, approximately 30Hz at middle distance and 10Hz at far range. Reuse one batch-root inverse matrix per visual update. E22 caches six mutable CatmullRom curves/7 points each per mount; ambient redraws cap at 30Hz, deliberate drawing/target changes redraw immediately. | Preserve all 17 identities, 327 original part instances, every route/line, user-triggered interaction, anatomy and joint geometry. No new rendering loop. | Focused tests for final positions, body writes, E22 curve identities, remount hygiene, existing exhibit tests. |
| U2 | Curated local artwork uses one tracked 1×1 sRGB fallback texture so `map` stays defined across loading and unloading; swaps no longer change the material's shader variant. Supplementary previews and full detail likewise swap maps without shader recompilation, use 12m-in/15m-out hysteresis and a mild 4m² residency preference to prevent thrashing. | Preserve exact source-authorized image bytes, true imagery when resident, all 15 readable cases, full-resolution text nearby and explicit resource disposal. No external assets. | Real browser asserts unchanged material version across loading/unloading and resource counts; preexisting artwork/open-close browser checks. |
| U3 | Already-merged immutable architectural meshes seed their world matrices explicitly from their owning static parent, then disable automatic world-matrix recalculation. | Workshop-owned roots remain excluded from merges; no collision or spatial-authority mutation. Important Three.js 0.185.1 nuance: `updateWorldMatrix` does not force calculation if `matrixWorldNeedsUpdate` is false, so simply toggling `matrixWorldAutoUpdate=false` without seeding would break transforms. | New translated-parent/frozen-world-space test; six-wing art-direction and full visitor-path browser tests. |

## Quantitative comparison (CPU simulation census; no GPU renderer)

A temporary, non-shipping Vitest census constructed a 17-visitor museum on Big Mac (Apple ARM64, Node 26), then exercised **2,400 fixed steps at 60Hz** with observer position in the Rotunda. The exact same test was run separately on two clean checkouts based on the same repository, with no feature-specific mocks. The returned figures are **CPU phase duration and number of BatchedMesh.setMatrixAt calls, not browser frame rate or real GPU time**.

| Metric | Baseline `dfc7349` | Initial 30Hz-only experiment | Final 60Hz conversational/30Hz mid-range candidate |
|---|---:|---:|---:|
| Authored visitors | 17 | 17 | 17 |
| Authoritative body part instances | 327 | 327 | 327 |
| Matrix submissions, 2,400 steps | 678,060 | 339,001 | 399,462 |
| Matrix submissions saved | — | ~50.0% | **~41.1%** |
| Stable 2,400-step CPU samples (ms) | 297.7, 315.4 | 143.8, 200.1 | 180.8 in first post-fidelity run |

An earlier baseline CPU sample measured 3,339.5 ms under apparent transient contention; it was excluded from the short stable comparison and retained as evidence of noise. Short CPU samples are not a statistically rigorous performance verdict. The 41.1% decrease in submitted matrices is directly repeatable; FPS, thermal, and perceived walking smoothness remain **unverified on physical devices**.

## Contrast with comparable systems

- **PlayCanvas** uses batch groups with a maximum AABB size, explicitly describing the tradeoff between draw-call count and camera culling. We kept Museum's previous spatial partitioning rather than making batches even finer by instinct. Source: https://developer.playcanvas.com/user-manual/graphics/advanced-rendering/batching/
- **Babylon.js** documents freezing world matrices and static shader/material work. We adapted its *principle* only to our demonstrably immutable merged meshes and added a regression test for translated parents; generic freezing of exhibit objects would be unsafe. Source: https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/scene/optimize_your_scene.md
- **Three.js 0.185.1** supports opt-in matrix-world ownership and shader precompilation; `matrixWorldAutoUpdate=false` requires the caller to keep world matrices valid. Source: https://threejs.org/docs/pages/Object3D.html and https://threejs.org/docs/pages/WebGLRenderer.html
- **PlayCanvas performance guidance** warns that on-demand shader variants can cause frame glitches; keeping the same material-map define through artwork loading is the analogous preventive strategy here. Source: https://github.com/playcanvas/developer-site/blob/main/docs/user-manual/optimization/guidelines.md

**Rejected:** replacing Three.js with another engine, globally freezing all scene transforms, cutting all authored animation to 10Hz, rewriting the 35-exhibit streaming system, adding shader plugins or new dependencies, or reducing gallery quality to placeholders. These would add unacceptable architectural, fidelity or validation costs.

## Verification and acceptance

- Test new conservation invariants and shader-version transitions; run `npm run gate`, `npm run test:e2e`, `npm audit --omit=dev --audit-level=high`, `npm run build:pages`, and `npm run verify:pages-dist`.
- The deployed site must return the exact final SHA in `build-info.json`; no green-ci or local-build success is interchangeable with this proof.
- Continue to require matched real MacBook/Brave and Android tablet p50/p95/p99, foreground battery/thermal behavior, multi-wing traversal, artwork clarity, and 10-minute resource-settlement evidence before claiming device-level improvement.
- Any future optimization of runtime engine ownership, visual continuity, or canonical source metadata requires independent scope review.

## Local validation receipt (pre-Git delivery)
- `npm run gate`: **EXIT 0**; 37 Vitest files / 675 tests, 73 mapped projects, 35 exhibits, six wings, privacy, budgets and dist checks PASS.
- `npm audit --omit=dev --audit-level=high`: **EXIT 0**, zero vulnerabilities.
- Focused real software-WebGL Chromium journeys: existing art-direction (six wings) and updated artwork/portal/Full Weasel lifecycle each **PASS**.
- Full 20-scenario browser suite and hosted exact-SHA proof: **PENDING GitHub Actions** (do not claim passed until evidence exists).

**Remaining uncertainty:** No matched physical MacBook/Brave or tablet FPS or thermal/long-session proof. Successful local CPU tests do not prove perceptible GPU improvement.

**Delivery at authoring:** Not yet committed, pushed or published; update canonical Project Bible after actual provider receipts. Museum remains **PRE-1.0**.
