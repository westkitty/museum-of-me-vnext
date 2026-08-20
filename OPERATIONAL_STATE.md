# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 18,
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
| Repository topology | `main` is the remote default; `feat/foundation` is historical lineage; active work continues on `release/v1.0.0` |
| Remote / PR | private `git@github.com:westkitty/museum-of-me-vnext.git`; PR #1 remains open from `release/v1.0.0` to `main` |
| Runtime | complete traversable museum with exhibit lifecycle, streaming, interaction, DOM interface and procedural audio |
| Toolchain | Node/npm/Vite/TypeScript; Three.js 0.185.0 pinned |
| Current refinement | Phase 1 controls are automated-verified. Phase 2 exterior start is automated-verified by canonical gate #50. Arrival garden + daylight passed canonical gate #60. Current head adds coherent zone palettes, facade/vestibule/Rotunda/hall furnishing, and explicit environment regressions; fresh gate pending. |

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
| INV-019 | The experience begins outside on the authored Arrival Plaza, facing the museum; entering the building requires continuous player movement across the exterior threshold. | explicit user correction + start/traversal tests |
| INV-020 | The Rotunda/balcony form the bright neutral baseline; each major wing has a distinct coherent colour family. | explicit user direction + environment tests |
| INV-021 | Environmental furnishing must not invalidate proven circulation geometry. | dressing is non-colliding + traversal gate |

## 5. Verified working behaviour

- Phase 1 control grammar and associated automated invariants passed canonical GitHub Actions run #36.
- Phase 2 exterior-start foundation passed canonical GitHub Actions run #50.
- Arrival garden + bright daylight package through commit `958973988b4e1ca585a72dba097e889f48a40a10` passed canonical GitHub Actions run #60.
- Earlier complete museum behavior remains verified outside the current visual/furnishing impact radius.

## 6. Known not working

| Item | State |
|---|---|
| Previous interior spawn | superseded; runtime now begins outside |
| Previous dark exterior sky | superseded; runtime now uses bright daylight |
| Previous beige Rotunda baseline | superseded in source by bright neutral palette; fresh gate/browser evidence pending |

## 7. Implemented but Unverified

| Item | Evidence missing |
|---|---|
| Rotunda and balcony use luminous white/ivory baseline palette | source + environment regression committed; fresh canonical gate/browser observation pending |
| Major wings use distinct coherent palette families | source + uniqueness regression committed; fresh canonical gate/browser observation pending |
| Exterior facade has stronger canopy/columns/sign identity | source committed; fresh canonical gate/browser observation pending |
| Vestibule receives neutral white baseline overlays and a welcome sign | source committed; fresh canonical gate/browser observation pending |
| Rotunda receives information desk, plants and seating islands | source committed; fresh canonical gate/browser observation pending |
| Wing halls receive recurring plants and sculptural furniture rhythm | source committed; fresh canonical gate/browser observation pending |

## 8. Unknown or Evidence-Stale State

| Item | Decisive check |
|---|---|
| Garden composition frames the museum cleanly at the real spawn camera | direct browser walkthrough |
| Daylight exposure/color balance is attractive rather than washed out | direct browser walkthrough |
| White Rotunda reads as intentional baseline zero rather than sterile | direct browser walkthrough |
| Furnishing density fills circulation spaces without visual clutter | direct browser walkthrough |
| Facade additions align cleanly with existing entrance geometry | direct browser walkthrough |
| Real pointer-lock capture/look/release | human browser/device test |
| Audible audio | human browser/device test |
| Representative-device FPS after added procedural dressing | human measurement |

## 9. Pending Work

| Task | Priority | Blocks completion |
|---|---|---|
| Reconcile fresh canonical gate for environment-furnishing head | high | yes for automated verification |
| Direct browser walkthrough: garden → vestibule → Rotunda → each wing | high | yes for perceptual verification |
| Derive exhibit-level accent splashes from containing wing palettes | next | no for current environment subphase |
| Additional wing-specific furnishing/detail variations | next | no for current environment subphase |
| Tune any visual collisions, clipping, exposure or density found in runtime | next | yes if observed |

## 10. Active Decisions, Defaults, and Prohibitions

- Continue refinement from `release/v1.0.0`; do not implement against stale `main`.
- Do not publish, deploy, merge PR #1, or tag a release without explicit instruction.
- Do not modify preserved legacy Reliquary artifacts.
- Arrow keys are directional movement, not look controls.
- E is rotate-right, not the primary interaction key.
- Jump is edge-triggered and grounded; holding Space must not auto-bunny-hop.
- Exterior spawn is derived from the authored plaza zone rather than duplicated coordinates.
- Reference images are inspiration for colour/design language, not floor-plan authority.
- New dressing may add visual density but must not move validated walls or narrow mandatory routes.

## 11. Validation and Evidence Matrix

| ID | Claim | State | Current evidence | Recheck trigger |
|---|---|---|---|---|
| CTRL-001 | Directional mappings match requested scheme | verified-automated | canonical gate run #36 PASS | input/controller change |
| CTRL-002 | Q/E keyboard yaw remains sensitivity-independent | verified-automated | canonical gate run #36 PASS | look/input change |
| CTRL-003 | Shift is materially faster than walk | verified-automated | canonical gate run #36 PASS | movement tuning change |
| CTRL-004 | Space jumps once from ground and does not repeat while held | verified-automated | canonical gate run #36 PASS | vertical physics/input change |
| CTRL-005 | F/Enter interact and E does not | verified-automated | canonical gate run #36 PASS | input binding change |
| START-001 | Runtime start is in the plaza zone outside the museum | verified-automated | canonical gate run #50 PASS | start/layout change |
| START-002 | Canonical route is continuous from exterior start through entrance | verified-automated | canonical gate run #50 PASS | exterior/collision/layout change |
| ENV-001 | Arrival garden and daylight package preserve canonical automated invariants | verified-automated | canonical gate run #60 PASS | exterior/lighting/garden change |
| ENV-002 | Rotunda is materially brighter than themed wings | implemented-unverified | palette source + `tests/environment.test.ts` | palette/material change |
| ENV-003 | Major wing accents are distinct | implemented-unverified | palette source + `tests/environment.test.ts` | palette/material change |
| ENV-004 | Welcome/facade/plants/seating/hall dressing exists in runtime layer | implemented-unverified | `EnvironmentDressing.ts` + main wiring + regression | furnishing change |
| CORE-001 | Mapping/content/privacy/lifecycle/traversal invariants remain intact after current visual batch | evidence-stale until fresh gate | run #60 PASS before current batch | current environment batch |

## 12. Current Change Scope and Impact Radius

- **Classification:** broad visual/environment refinement without layout reconstruction.
- **Changed in current batch:** `src/world/palette.ts`, `src/world/EnvironmentDressing.ts`, `src/main.ts`, `tests/environment.test.ts`.
- **Previously verified visual foundation:** `src/world/ArrivalGarden.ts`, `src/world/Sky.ts`, `src/render/Lighting.ts` through run #60.
- **Protected:** exhibit contract/content, 64→35 mapping, building dimensions, mandatory circulation, player controls, streaming/resource ownership, Sanctuary semantics, deployment state.
- **Mandatory validation:** fresh canonical `npm run gate`, then direct browser walkthrough across arrival and representative wings.

## 13. Compact Revision Log

- **r18 — 2026-08-20:** Promoted exterior start to automated-verified via run #50 and garden/daylight package to automated-verified via run #60. Added bright neutral Rotunda/balcony palette, strengthened facade and neutral vestibule, added information desk/plants/seating/corridor furnishing, and added environment regressions. Current visual batch remains implemented-unverified pending fresh gate and browser walkthrough.
- **r17 — 2026-08-20:** Promoted Phase 1 controls to automated-verified from canonical run #36. Implemented Phase 2 exterior start derived from the Arrival Plaza zone, rewired runtime/canonical traversal/wayfinding tests, and added explicit exterior-start regressions.
- **r16 — 2026-08-20:** Recorded explicit control grammar and Phase-1 implementation at commit `545ff801...`; verification was pending at that revision.
