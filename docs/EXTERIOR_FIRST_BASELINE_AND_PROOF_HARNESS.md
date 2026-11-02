# Museum of Me — Exterior-First Baseline & Proof Harness

> **Document Status:** CANONICAL VERIFICATION BASELINE — PHASE P0 LOCK
> **Repository:** `westkitty/museum-of-me-vnext`
> **Target Branch:** `feature/exterior-first-impossible-threshold-20261102`
> **Baseline Source HEAD:** `6950ab9401d2d957c801afba6f86c11ce5b29267` on `main` and `pages-preview`
> **Execution Date:** 2026-11-02
> **Operating Environment:** macOS Darwin 24.3.0 arm64
> **Toolchain:** Node.js v26.13.0, npm 11.20.0, TypeScript 5.7.2, Vite 6.4.3, Three.js 0.185.1, Playwright 1.49.0

---

## 1. Baseline Implementation Architecture Audit

### 1.1 Current Application Startup Path (Source-Observed)
In current `main` at `6950ab9401d2d957c801afba6f86c11ce5b29267`:
1. `src/main.ts` instantiates `App` (`new App(canvas)`).
2. The `App` constructor unconditionally calls `new Museum(this.rendererHost.scene, this.resourceScope).build()`.
3. `Museum.build()` creates the entire interior building: Rotunda, central skylight, two levels, grand staircases, six wings, Dexter Sanctuary ramp/chamber, and all 35 exhibit mount anchors.
4. `App` constructor then creates `SourceInstallations`, `SourceVisitors`, `PersistentEnvironment`, `AtmosphereDirector`, and mounts exhibit interactables.
5. `ArrivalGarden.buildIsland()` constructs a simplified visual island extruded mesh and annular water ring, while a full 600m collidable ground plane is attached to `Museum`.
6. Only after this complete interior construction does `CinematicArrival` present the initial arrival overlay.

### 1.2 Current Production Bundle Analysis
Inspection of `npm run build` output demonstrates that indoor code is bundled eagerly into the initial client bundle:
- `dist/assets/three-DJMJB1qe.js`: 716.16 kB (gzip: 189.93 kB)
- `dist/assets/exhibits-CBnQ_Nqi.js`: 430.23 kB (gzip: 133.36 kB)
- `dist/assets/museum-BWcB8Iqg.js`: 248.70 kB (gzip: 79.75 kB)
- `dist/assets/PersistentEnvironment-CB4avQP-.js`: 89.12 kB (gzip: 29.16 kB)
- Total initial visit payload: 9.31 MB (within the 20 MB budget ceiling checked by `scripts/check-budgets.mjs`).

**Target for Phase P1:** Defer `Museum.build()`, interior exhibit modules, source installations, and interior-specific assets into on-demand dynamic chunks so that a cold arrival executes **zero** interior constructors.

---

## 2. Preflight Baseline Test Suite Execution

All primary validation suites were executed against clean base HEAD `6950ab9401d2d957c801afba6f86c11ce5b29267`:

| Command / Check | Result | Scope & Evidence | Notes / Failure Signature |
|---|---|---|---|
| `npm run typecheck` | **PASS** | `tsc --noEmit` across full codebase | 0 errors |
| `npm run lint` | **PASS** | `eslint . --max-warnings 0` | 0 warnings |
| `npm run build` | **PASS** | Collection build + tsc + Vite production bundle | Emits `dist/index.html` and assets |
| `npm run check:budgets` | **PASS** | Asset size, category ceilings, declared binaries | Initial bundle: 9.31 MB of 20 MB |
| `npm run validate:assets` | **PASS** | 17 governed assets verified | No undeclared binaries |
| `npm run validate:mapping` | **PASS** | 35 exhibit slots, 73 projects | Source parity with mapping json |
| `npm run validate:content` | **PASS** | 25 data files, 66 sources, 3404 literals | Content safety rules pass |
| `npm run validate:privacy` | **PASS** | 148 files scanned | No remote telemetry or external CDNs |
| `npm run validate:frameloop` | **PASS** | 150 files scanned | Single rAF owner: `src/app/Loop.ts` |
| `npm run validate:hotpaths` | **PASS** | Checks `onUpdate` constructor allocations | Zero allocations in tight hotpaths |
| `npm run validate:exhibits` | **PASS** | 35 bespoke exhibit implementations | All exhibits valid |
| `npm run validate:source-parity`| **PASS** | 14 installations, 17 authored visitors | Parity verified |
| `npm run test:release-tools` | **PASS** | 9/9 Node native test runner tests | Release verifiers pass |
| `npm run qa` | **PASS** | `scripts/qa-report-runner.mjs` | Reports generated |
| `npm run test:workshop` | **PASS** | Playwright Chromium workshop authoring + standalone test | Persisted bridge and offline checks pass |
| `npx playwright test tests/browser/workbench3d.e2e.ts` | **PASS** | 5/5 Chromium headless shell tests | 3D inspection, pins, cutaway pass |
| `tests/sentinel.test.ts` (local) | **KNOWN FINDING** | 1 failed / 11 passed (out of 12) | Local macOS `/var` vs `/private/var` symlink mismatch in temp fixture `outputDirectory`. Passes in Linux CI (`ubuntu-latest`). Recorded per P0.1/P0.3 doctrine; no source modification in P0. |

---

## 3. Scaffolding for Future Verification

### 3.1 Benchmark & Telemetry Record Schema
Future phases (especially P1, P5, and P7) must capture performance and runtime telemetry adhering to the following schema:

```text
scenario_id: <PERF-E01 .. PERF-E09>
build_sha: <40-hex commit SHA>
phase: <P0 .. P7>
browser_environment: <Chromium / SwiftShader / WebGL>
os_device: macOS Darwin arm64 / Linux CI
viewport: 1280x720
dpr: 1.0
quality_tier: low | medium | high
cache_state: cold | warm
first_useful_interaction_ms: <number>
interior_construction_start_ms: <number | null>
interior_ready_ms: <number | null>
transition_commit_duration_ms: <number | null>
frame_p50_ms: <number>
frame_p95_ms: <number>
frame_p99_ms: <number>
max_long_task_ms: <number>
initial_transfer_bytes: <number>
draw_calls_sampled: <number>
triangles_sampled: <number>
geometries_count: <number>
textures_count: <number>
```

### 3.2 Negative Cold-Start Test Specification (For Phase P1)
To ensure the exterior-first promise is genuine and not an illusion created by `group.visible = false`:
1. Launch cold browser at root route `/`.
2. Inspect global constructor count for `Museum`: must equal `0`.
3. Inspect `window.__museum`: `activeWorld` must equal `'exterior'`.
4. Inspect Network Resource Timing: the deferred chunk containing interior building and exhibit modules must NOT be requested.
5. Move player capsule across pier and outdoor terrace: player stays supported on exterior colliders; `Museum.build()` execution count remains `0`.

### 3.3 Atomic World-Switch State Machine (For Phase P2 / P5)
State transitions must be deterministic and reversible:

```
[EXTERIOR_ACTIVE] ──(approach vestibule)──► [PREPARING_INTERIOR]
        ▲                                           │
        │ (backtrack/cancel)                        ▼
        ├───────────────────────────────── [READY_TO_COMMIT]
        │                                           │ (cross seam)
        │ (reverse exit)                            ▼
[INTERIOR_ACTIVE] ◄──(restore control)──── [COMMITTING_INTERIOR]
        │
        ├──(approach outer door)──► [PREPARING_EXTERIOR]
        │                                   │
        ▼                                   ▼
 [ERROR_RECOVERABLE] ◄───────────────── [COMMITTING_EXTERIOR]
```

**Invariants during state transition:**
- `activeWorldRootCount == 1`
- `activeCollisionWorld == collisionOf(activeWorld)`
- Zero frames with visual-collision mismatch
- Zero duplicate event listeners or competing rAF callbacks

---

## 4. Protected Invariants Traceability Ledger

| Invariant ID | Name & Description | Current Baseline Status | Validation Method |
|---|---|---|---|
| `INV-01` | Correct Project: `westkitty/museum-of-me-vnext` | **VERIFIED** | Remote origin and local checkout confirmed |
| `INV-02` | Museum Identity: *The Reliquary of Iterative Becoming* | **VERIFIED** | `package.json`, title, metadata checked |
| `INV-03` | Existing Full Interior: 6 wings, Rotunda, 35 slots | **VERIFIED** | `validate:mapping`, `validate:exhibits` pass |
| `INV-04` | Dexter Sanctuary: ramp trench & chamber intact | **VERIFIED** | `sanctuary.test.ts` pass, trench collider clear |
| `INV-05` | Authored Content & People: 14 installations, 17 visitors | **VERIFIED** | `validate:source-parity` pass |
| `INV-06` | Visitor Controls: WASD, explicit pointer-lock, noclip dev | **VERIFIED** | `dev-flight-sky.test.ts`, input tests pass |
| `INV-07` | Save Integrity: Journal, Study, VisitThread | **VERIFIED** | `visit-thread.test.ts`, `state.test.ts` pass |
| `INV-08` | One Application Loop: `src/app/Loop.ts` | **VERIFIED** | `validate:frameloop` pass (150 files scanned) |
| `INV-09` | One Visitor Renderer: `RendererHost` canvas/camera | **VERIFIED** | Verified by code architecture inspection |
| `INV-10` | Explicit Resource Lifecycle: `ResourceScope` | **VERIFIED** | `resource-scope.test.ts` pass |
| `INV-11` | Collision Authority: active world collision only | **VERIFIED** | Exterior/interior collision decoupling planned in P1/P4 |
| `INV-12` | Night/Canon Continuity: Drakken Blood Ring & night sky | **VERIFIED** | `drakken-source-grounding.test.ts` pass |
| `INV-13` | Privacy & Offline: zero telemetry, full offline standalone | **VERIFIED** | `validate:privacy` and `test:workshop` pass |
| `INV-14` | Accessibility: reduced-motion, focus, semantic DOM | **VERIFIED** | `accessibility.test.ts` pass |
| `INV-15` | Workshop & Workbench: 2D plan, 3D survey preserved | **VERIFIED** | `workbench3d.e2e.ts` pass |
| `INV-16` | Performance Law: adaptive resolution, quality tiers | **VERIFIED** | `performance.test.ts`, `check:budgets` pass |
| `INV-17` | No Unsanctioned Fauna: no spiders, monsters, or extra NPCs | **VERIFIED** | Zero unrequested models or entities |
| `INV-18` | Reference Fidelity: consistent 3D geometry across views | **VERIFIED** | Reference contract locked in P0; P3/P4 implementation target |
| `INV-19` | Honest Evidence: distinct proof tiers and human pending | **VERIFIED** | Evidence states labeled rigorously |
| `INV-20` | Exact Git Delivery Boundary: feature branch per phase | **VERIFIED** | Dedicated branch created, no direct push to main/pages |
