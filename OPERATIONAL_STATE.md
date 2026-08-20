# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 19,
  "last_updated": "2026-08-20",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root (SELECTED):** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Baseline classification:** new vNext project beside preserved legacy Reliquary material.
- **Governed scope:** this repository only.
- **Explicitly not governed:** handoff/legacy Reliquary artifacts; they remain read-only evidence.

## 2. Source authority (in force)

1. Explicit user instructions for this run.
2. This file.
3. `docs/MUSEUM_VNEXT_BUILD_PLAN.md`.
4. The vNext investigation/actualization handoff.
5. Verified repository/runtime evidence.
6. Historical Reliquary material — evidence, not implementation authority.
7. Inference.

## 3. Current baseline

| Item | State |
|---|---|
| Repository topology | `main` is the remote default; active refinement continues on `release/v1.0.0` |
| Remote / PR | PR #1 remains open from `release/v1.0.0` to `main`; do not merge without explicit instruction |
| Runtime | complete traversable museum with exhibit lifecycle, streaming, interaction, DOM interface and procedural audio |
| Toolchain | Node/npm/Vite/TypeScript; Three.js 0.185.0 pinned |
| Current refinement | Controls verified by run #36; exterior start verified by run #50; garden + daylight verified by run #60. Current environment batch adds baseline-zero Rotunda, coherent wing palettes, furnishing, exhibit-derived accents, and wing-specific threshold/motif identity. Gate #78 failed only because a Vitest matcher unavailable in this toolchain was used in a new regression; matcher is replaced and fresh gate #84 is queued. |

## 4. Active invariants

| ID | Rule | Enforced by |
|---|---|---|
| INV-001 | Exactly one frame-loop owner: `src/app/Loop.ts`. | ESLint + `validate:frameloop` |
| INV-002 | 64 project identities map to 35 exhibits exactly once; mapping remains frozen. | `validate:mapping` |
| INV-003 | No visitor-facing placeholder prose. | `validate:content` |
| INV-004 | No credentials, IP literals, private paths/hostnames, or personal identifiers in visitor content. | `validate:privacy` |
| INV-005 | Legacy Reliquary artifacts are never modified. | manual + hash record |
| INV-006 | Dexter Sanctuary stays outside the 35 and is never mascotised. | contract + design review |
| INV-007 | No uncontrolled runtime asset host. | asset policy + validator |
| INV-008 | Every exhibit ResourceScope drains to zero on unmount. | lifecycle tests |
| INV-009 | Core experience requires no live AI/cloud/backend. | architecture |
| INV-010 | Building dimensions derive from `src/world/layout.ts`. | traversal + review |
| INV-011 | Mandatory continuous traversal remains passable without teleport/load screen. | traversal tests |
| INV-012 | Assets enter scene through AssetManager governance. | asset tests |
| INV-013 | Procedural generators use seeded RNG, not Math.random. | determinism checks |
| INV-014 | Exhibit build-time arrays use tracked lifecycle handling. | lifecycle tests |
| INV-015 | Sanctuary contains no score/badge/collectible/reward mechanics. | sanctuary tests |
| INV-016 | All 35 exhibits remain bespoke. | exhibit validator |
| INV-017 | Canonical keyboard movement is W/Up forward, S/Down backward, A/Left left, D/Right right; Q/E rotate left/right; Shift sprints; Space performs a grounded single-press jump; F or Enter interacts. | explicit user correction + accessibility tests |
| INV-018 | Keyboard-only accessibility remains complete; Page Up/Page Down provide vertical look now that arrows are movement. | accessibility tests |
| INV-019 | The experience begins outside on the authored Arrival Plaza, facing the museum; entering requires continuous player movement across the exterior threshold. | start/traversal tests |
| INV-020 | Rotunda/balcony form the bright neutral baseline; each major wing has a distinct coherent colour family. | environment regressions |
| INV-021 | Environmental furnishing must not invalidate proven circulation geometry. | non-colliding dressing + traversal gate |
| INV-022 | Exhibit accents derive from the containing wing family rather than introducing unrelated palettes. | `ExhibitThresholds` regression |
| INV-023 | Every major wing has a non-text visual identity at its threshold using its palette and a distinct shape motif. | `WingIdentity` regression |

## 5. Verified working behaviour

- Phase 1 controls passed canonical GitHub Actions run #36.
- Exterior-start foundation passed canonical run #50.
- Arrival garden + bright daylight package through `958973988b4e1ca585a72dba097e889f48a40a10` passed canonical run #60.
- Earlier complete museum behavior remains verified outside the current visual/furnishing impact radius.

## 6. Known not working

| Item | State |
|---|---|
| Previous interior spawn | superseded |
| Previous dark exterior sky | superseded |
| Previous beige Rotunda baseline | superseded in source |
| Environment gate #78 | failed at TypeScript compile because `toHaveSize` is not available in the installed Vitest assertion types; regression was corrected to `.size` + `toBe` |

## 7. Implemented but Unverified

| Item | Evidence missing |
|---|---|
| Luminous white/ivory Rotunda and balcony baseline | fresh canonical gate + browser observation |
| Distinct major-wing palette families | fresh canonical gate + browser observation |
| Stronger facade, neutral vestibule, welcome sign and information desk | fresh canonical gate + browser observation |
| Rotunda plants/seating and recurring hall furnishing | fresh canonical gate + browser observation |
| Every exhibit threshold receives a deterministic wing-derived accent frame | fresh canonical gate + browser observation |
| Every wing threshold receives colour bands, transition strips and two wing-specific motifs | fresh canonical gate + browser observation |

## 8. Unknown or Evidence-Stale State

| Item | Decisive check |
|---|---|
| Garden composition frames the museum cleanly at the real spawn camera | direct browser walkthrough |
| Daylight exposure/color balance is attractive rather than washed out | direct browser walkthrough |
| White Rotunda reads as intentional baseline zero rather than sterile | direct browser walkthrough |
| Furnishing density fills circulation without visual clutter | direct browser walkthrough |
| Wing motifs and exhibit accents are elegant rather than noisy | direct browser walkthrough |
| Facade additions align cleanly with existing entrance geometry | direct browser walkthrough |
| Real pointer-lock capture/look/release | human browser/device test |
| Audible audio | human browser/device test |
| Representative-device FPS after added procedural dressing | human measurement |

## 9. Pending Work

| Task | Priority | Blocks completion |
|---|---|---|
| Reconcile canonical gate #84 for current environment head | high | yes for automated verification |
| Direct browser walkthrough: garden → vestibule → Rotunda → all six wings | high | yes for perceptual verification |
| Tune clipping/exposure/density based on runtime observation | next | yes if observed |
| Add further wing-specific furnishings only where runtime still reads empty | next | no |

## 10. Active Decisions, Defaults, and Prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not publish, deploy, merge PR #1, or tag a release without explicit instruction.
- Do not modify preserved legacy Reliquary artifacts.
- Reference images are inspiration for colour/design language, not floor-plan authority.
- New dressing may add visual density but must not move validated walls or narrow mandatory routes.
- Prefer deterministic geometry and shared wing palettes over arbitrary per-room decoration.

## 11. Validation and Evidence Matrix

| ID | Claim | State | Current evidence | Recheck trigger |
|---|---|---|---|---|
| CTRL-001 | Requested directional mappings | verified-automated | run #36 PASS | input/controller change |
| CTRL-002 | Shift materially faster; Space grounded one-shot jump | verified-automated | run #36 PASS | movement change |
| START-001 | Runtime starts outside and route remains continuous | verified-automated | run #50 PASS | start/layout change |
| ENV-001 | Arrival garden and daylight preserve automated invariants | verified-automated | run #60 PASS | garden/lighting change |
| ENV-002 | Rotunda materially brighter than themed wings | implemented-unverified | palette + regression; #78 did not reach tests | palette change |
| ENV-003 | Major wing accents are distinct | implemented-unverified | palette + regression | palette change |
| ENV-004 | Welcome/facade/plants/seating/hall dressing exists | implemented-unverified | source + runtime wiring + regression | furnishing change |
| ENV-005 | Every exhibit has wing-derived threshold accents | implemented-unverified | source + corrected regression | threshold change |
| ENV-006 | Every wing has threshold bands and distinct motifs | implemented-unverified | `WingIdentity.ts` + regression | wing identity change |
| CORE-001 | Full core gate remains intact after current visual batch | evidence-stale | latest applicable PASS is run #60; run #84 queued | current batch |

## 12. Current Change Scope and Impact Radius

- **Classification:** broad visual/environment refinement without layout reconstruction.
- **Current batch:** `src/world/palette.ts`, `src/world/EnvironmentDressing.ts`, `src/world/ExhibitThresholds.ts`, `src/world/WingIdentity.ts`, `src/main.ts`, `tests/environment.test.ts`.
- **Protected:** exhibit contract/content, 64→35 mapping, building dimensions, mandatory circulation, player controls, streaming/resource ownership, Sanctuary semantics, deployment state.
- **Mandatory validation:** canonical `npm run gate`, then direct runtime walkthrough.

## 13. Compact Revision Log

- **r19 — 2026-08-20:** Recorded run #78 as a test-typing failure caused by unsupported `toHaveSize`; corrected regression. Added wing-specific non-text spatial identity (threshold colour bands, transition strips and motifs) and expanded environment regression coverage. Fresh gate #84 queued.
- **r18 — 2026-08-20:** Promoted exterior start via run #50 and garden/daylight via run #60. Added bright neutral Rotunda/balcony palette, strengthened facade and neutral vestibule, information desk/plants/seating/corridor furnishing, and environment regressions.
- **r17 — 2026-08-20:** Promoted Phase 1 controls from run #36. Implemented exterior start derived from Arrival Plaza and rewired traversal/wayfinding regressions.
- **r16 — 2026-08-20:** Recorded explicit control grammar and Phase-1 implementation.
