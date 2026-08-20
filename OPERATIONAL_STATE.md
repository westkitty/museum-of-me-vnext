# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 21,
  "last_updated": "2026-08-20",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root:** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Active branch:** `release/v1.0.0`
- **Governed scope:** this repository only; preserved legacy Reliquary artifacts remain read-only.

## 2. Source authority

1. Explicit user instructions.
2. This file.
3. `docs/MUSEUM_VNEXT_BUILD_PLAN.md`.
4. vNext handoff evidence.
5. Verified repository/runtime evidence.
6. Historical Reliquary material.
7. Inference.

## 3. Current baseline

| Area | State |
|---|---|
| Controls | verified by canonical run #36 |
| Exterior start | verified by run #50 |
| Garden + daylight | verified by run #60 |
| Baseline-zero Rotunda, furnishing, exhibit accents, wing threshold/motif identity | verified by run #84 |
| Wing-specific emissive atmosphere | verified by run #92 |
| Perceptual/runtime visual quality | still requires direct browser walkthrough |

## 4. Active invariants

- Exactly one frame-loop owner: `src/app/Loop.ts`.
- Frozen 64-project → 35-exhibit mapping remains exact.
- No visitor-facing private data/placeholders.
- Dexter Sanctuary remains outside the 35 and non-mascotised.
- Layout/collision dimensions remain governed by `src/world/layout.ts`.
- Continuous traversal remains mandatory.
- ResourceScope/streaming/asset lifecycle guarantees remain intact.
- Controls remain: W/Up forward, S/Down back, A/Left left, D/Right right, Q/E rotate, Shift sprint, Space grounded one-shot jump, F/Enter interact.
- Experience starts outside on Arrival Plaza facing the museum.
- Rotunda/balcony are bright neutral baseline-zero spaces.
- Every major wing owns a coherent palette plus non-text shape identity.
- Exhibit accents derive from containing-wing palettes.
- Added environment dressing remains non-colliding and may not narrow routes.
- Decorative atmosphere uses emissive geometry rather than extra dynamic scene lights.

## 5. Verified working behaviour

- Controls: run #36 PASS.
- Exterior start and outside→inside route: run #50 PASS.
- Arrival garden + daylight: run #60 PASS.
- Bright neutral Rotunda, distinct wing palettes, facade/vestibule/welcome/furnishing, all 35 exhibit frames, six wing threshold/motif identities: run #84 PASS.
- Repeated per-wing emissive ceiling fixtures and wall inlays: run #92 PASS.

## 6. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 test matcher issue is resolved; later gates #84 and #92 passed.

## 7. Implemented but Unverified

None currently in source. Automated gates are green through run #92.

## 8. Unknown / Evidence-Stale

| Item | Decisive check |
|---|---|
| Garden frames museum cleanly at the actual spawn camera | direct browser walkthrough |
| Daylight exposure is attractive rather than washed out | direct browser walkthrough |
| Rotunda feels luminous/intentional rather than sterile | direct browser walkthrough |
| Furnishing, motifs, exhibit accents and atmosphere are rich without clutter | direct browser walkthrough |
| Facade overlays align visually with entrance geometry | direct browser walkthrough |
| Representative-device FPS | human measurement |
| Pointer-lock feel and audible audio | human browser/device test |

## 9. Pending work

- Direct browser walkthrough: garden → vestibule → Rotunda → all six wings.
- Tune clipping/exposure/density from observed runtime evidence.
- Continue exterior architectural refinement only where it improves the garden arrival composition without changing collision/layout.

## 10. Active decisions / prohibitions

- Do not implement against stale `main`.
- Do not deploy, publish, merge PR #1, or tag without explicit instruction.
- Reference images guide colour/design language only.
- Prefer deterministic palette-derived geometry to arbitrary decoration.
- Do not add dynamic lights merely for colour identity.

## 11. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS |
| Outside spawn + continuous entry | verified-automated | run #50 PASS |
| Garden + daylight | verified-automated | run #60 PASS |
| Bright baseline + wing palettes | verified-automated | run #84 PASS |
| Facade/vestibule/welcome/plants/benches/hall dressing | verified-automated | run #84 PASS |
| Exhibit wing-derived threshold accents | verified-automated | run #84 PASS |
| Wing threshold bands/transition strips/motifs | verified-automated | run #84 PASS |
| Wing emissive fixtures/wall inlays | verified-automated | run #92 PASS |
| Full newest-head core gate | verified-automated | run #92 PASS |

## 12. Current change scope

Visual/environment refinement only; layout, collision, controls, exhibit contracts/content, mapping, streaming/resource ownership, Sanctuary semantics and deployment state remain protected.

## 13. Compact revision log

- **r21 — 2026-08-20:** Promoted wing-specific emissive atmosphere to automated-verified via canonical run #92. All current source changes are now automated-green; perceptual browser QA is the remaining evidence gap.
- **r20 — 2026-08-20:** Promoted baseline/furnishing/exhibit/wing identity via run #84; added WingAtmosphere pending gate.
- **r19 — 2026-08-20:** Corrected unsupported test matcher and added wing spatial identity.
