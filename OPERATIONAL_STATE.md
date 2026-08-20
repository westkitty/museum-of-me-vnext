# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 20,
  "last_updated": "2026-08-20",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root (SELECTED):** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Governed scope:** this repository only; preserved legacy Reliquary artifacts remain read-only evidence.

## 2. Source authority (in force)

1. Explicit user instructions for this run.
2. This file.
3. `docs/MUSEUM_VNEXT_BUILD_PLAN.md`.
4. vNext investigation/actualization handoff.
5. Verified repository/runtime evidence.
6. Historical Reliquary material.
7. Inference.

## 3. Current baseline

| Item | State |
|---|---|
| Active branch | `release/v1.0.0`; `main` remains stale for this work |
| PR | #1 remains open to `main`; do not merge without explicit instruction |
| Runtime | complete traversable museum with streaming, interaction, DOM UI and procedural audio |
| Verified refinement | controls run #36; exterior start run #50; garden/daylight run #60; baseline-zero + furnishings + exhibit accents + wing identity run #84 |
| Current unverified refinement | wing-specific emissive decorative atmosphere added after run #84; fresh gate pending |

## 4. Active invariants

| ID | Rule |
|---|---|
| INV-001 | Exactly one frame-loop owner: `src/app/Loop.ts`. |
| INV-002 | 64 project identities map to 35 exhibits exactly once. |
| INV-003 | No visitor-facing placeholder/private content. |
| INV-004 | Legacy Reliquary artifacts remain untouched. |
| INV-005 | Dexter Sanctuary stays outside the 35 and is never mascotised. |
| INV-006 | Building dimensions derive from `src/world/layout.ts`; continuous traversal remains passable. |
| INV-007 | ResourceScope/streaming/asset lifecycle guarantees remain intact. |
| INV-008 | Controls: W/Up forward, S/Down back, A/Left left, D/Right right, Q/E rotate, Shift sprint, Space grounded one-shot jump, F/Enter interact. |
| INV-009 | Experience starts outside on Arrival Plaza facing the museum. |
| INV-010 | Rotunda/balcony are bright neutral baseline-zero spaces. |
| INV-011 | Every major wing owns a coherent palette and non-text spatial identity. |
| INV-012 | Exhibit accents derive from their containing wing family. |
| INV-013 | Environmental dressing remains non-colliding and may not narrow mandatory routes. |
| INV-014 | Decorative atmosphere may use emissive geometry but may not inflate the managed point-light budget. |

## 5. Verified working behaviour

- Requested control grammar passed canonical run #36.
- Exterior start and continuous outside-to-inside route passed run #50.
- Garden + bright daylight passed run #60.
- Bright Rotunda/balcony, distinct major-wing palettes, stronger facade/vestibule, welcome/info furnishing, hall plants/furniture, all 35 wing-derived exhibit frames, and six wing-specific threshold/motif identities passed canonical run #84.

## 6. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 failed only because the new test used unsupported matcher `toHaveSize`; corrected before run #84, which passed.

## 7. Implemented but Unverified

| Item | Evidence missing |
|---|---|
| Each wing now carries repeated emissive ceiling fixtures and wall inlays using its palette and shape language, without extra scene lights | fresh canonical gate + browser observation |

## 8. Unknown or Evidence-Stale State

| Item | Decisive check |
|---|---|
| Garden composition frames the museum cleanly at real spawn camera | direct browser walkthrough |
| Daylight exposure is attractive rather than washed out | direct browser walkthrough |
| White Rotunda reads intentional rather than sterile | direct browser walkthrough |
| Furnishing/motifs/accents/atmosphere are rich without visual clutter | direct browser walkthrough |
| Facade additions align cleanly with entrance geometry | direct browser walkthrough |
| Representative-device FPS after procedural dressing | human measurement |
| Pointer-lock feel and audible audio | human browser/device test |

## 9. Pending Work

| Task | Priority |
|---|---|
| Reconcile fresh gate for `WingAtmosphere` head | high |
| Direct browser walkthrough: garden → vestibule → Rotunda → all six wings | high |
| Tune clipping/exposure/density from runtime evidence | next |
| Add further furniture only where runtime still reads empty | later |

## 10. Active Decisions / Prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not publish, deploy, merge PR #1, or tag without explicit instruction.
- Reference images guide colour/design language only, never floor-plan authority.
- Prefer deterministic, palette-derived geometry to arbitrary per-room decoration.
- Do not add dynamic lights merely for colour identity; emissive geometry is preferred.

## 11. Validation Matrix

| ID | Claim | State | Evidence |
|---|---|---|---|
| CTRL | Requested controls and sprint/jump/interact grammar | verified-automated | run #36 PASS |
| START | Outside spawn + continuous museum entry | verified-automated | run #50 PASS |
| GARDEN | Arrival garden + daylight preserve core gate | verified-automated | run #60 PASS |
| ENV-BASE | Bright neutral Rotunda + distinct wing palettes | verified-automated | run #84 PASS |
| ENV-FURN | Facade, vestibule, welcome, plants, benches and hall furnishing | verified-automated | run #84 PASS |
| ENV-EXHIBIT | All exhibits receive wing-derived threshold accents | verified-automated | run #84 PASS |
| ENV-WING | All six wings receive threshold bands, transition strips and distinct motifs | verified-automated | run #84 PASS |
| ENV-ATM | Repeated per-wing emissive fixtures/inlays | implemented-unverified | source + regression; fresh gate pending |
| CORE | Full mapping/content/privacy/lifecycle/traversal gate on newest head | evidence-stale | run #84 predates WingAtmosphere |

## 12. Current Change Scope

- **Classification:** visual/environment refinement without layout reconstruction.
- **Current additional files:** `src/world/WingAtmosphere.ts`, `src/main.ts`, `tests/environment.test.ts`.
- **Protected:** exhibit content/contracts, 64→35 mapping, layout/collision, controls, streaming/resource ownership, Sanctuary semantics, deployment state.

## 13. Compact Revision Log

- **r20 — 2026-08-20:** Promoted baseline-zero/furnishing/exhibit-accent/wing-identity batch to automated-verified via canonical run #84. Added wing-specific emissive decorative atmosphere without new scene lights; fresh gate pending.
- **r19 — 2026-08-20:** Recorded #78 matcher failure, corrected regression, added wing-specific threshold colour bands/transition strips/motifs, queued #84.
- **r18 — 2026-08-20:** Promoted exterior start via #50 and garden/daylight via #60; added baseline palette and furnishing batch.
