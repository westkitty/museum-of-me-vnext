# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 17,
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
| Current refinement | Phase 1 control overhaul passed canonical GitHub Actions run #36. Phase 2 exterior-start change is committed through `19c960d92078c4988d3998b0cdeac860da96be51`; fresh gate pending. |

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

## 5. Verified working behaviour

- Phase 1 control grammar and associated core automated invariants passed canonical GitHub Actions run #36.
- The earlier complete museum baseline remains verified outside the Phase 2 spawn/arrival impact radius.

## 6. Known not working

| Item | State |
|---|---|
| Previous interior spawn | superseded by Phase 2; runtime should no longer begin inside the south vestibule |

## 7. Implemented but Unverified

| Item | Evidence missing |
|---|---|
| Runtime starts at the Arrival Plaza centre and faces north toward the entrance | source committed; fresh canonical gate and browser observation pending |
| Canonical traversal now begins at the same exterior start used by runtime | traversal regression committed; fresh canonical gate pending |
| Wayfinding test origin follows the real exterior start | regression committed; fresh canonical gate pending |

## 8. Unknown or Evidence-Stale State

| Item | Decisive check |
|---|---|
| Exterior start visually presents the museum entrance clearly | direct browser walkthrough |
| Walk from start across plaza/threshold into museum feels deliberate and unobstructed | direct browser walkthrough |
| Real pointer-lock capture/look/release | human browser/device test |
| Audible audio | human browser/device test |
| Representative-device FPS | human measurement |
| Human feel of movement/jump/sprint | direct browser walkthrough |

## 9. Pending Work

| Task | Priority | Blocks completion |
|---|---|---|
| Reconcile canonical gate for Phase 2 head | high | yes for automated Phase 2 verification |
| Direct browser walkthrough from exterior start through entrance | high | yes for perceptual Phase 2 verification |
| Garden/park exterior dressing and stronger building exterior identity | next | no for spawn-only subphase |
| Distinct visual/color identity for each museum area | next | no for spawn-only subphase |

## 10. Active Decisions, Defaults, and Prohibitions

- Continue refinement from `release/v1.0.0`; do not implement against stale `main`.
- Do not publish, deploy, merge PR #1, or tag a release without explicit instruction.
- Do not modify preserved legacy Reliquary artifacts.
- Arrow keys are directional movement, not look controls.
- E is rotate-right, not the primary interaction key.
- Jump is edge-triggered and grounded; holding Space must not auto-bunny-hop.
- Exterior spawn is derived from the authored plaza zone rather than duplicated coordinates.

## 11. Validation and Evidence Matrix

| ID | Claim | State | Current evidence | Recheck trigger |
|---|---|---|---|---|
| CTRL-001 | Directional mappings match requested scheme | verified-automated | canonical gate run #36 PASS | input/controller change |
| CTRL-002 | Q/E keyboard yaw remains sensitivity-independent | verified-automated | canonical gate run #36 PASS | look/input change |
| CTRL-003 | Shift is materially faster than walk | verified-automated | canonical gate run #36 PASS | movement tuning change |
| CTRL-004 | Space jumps once from ground and does not repeat while held | verified-automated | canonical gate run #36 PASS | vertical physics/input change |
| CTRL-005 | F/Enter interact and E does not | verified-automated | canonical gate run #36 PASS | input binding change |
| START-001 | Runtime start is in the plaza zone outside the museum | implemented-unverified | `src/world/start.ts` + App wiring + traversal regression | start/layout change |
| START-002 | Canonical route is continuous from exterior start through entrance | implemented-unverified | route + traversal regression | exterior/collision/layout change |
| CORE-001 | Mapping/content/privacy/lifecycle/traversal invariants remain intact after Phase 2 | evidence-stale until fresh gate | Phase 1 gate PASS | Phase 2 runtime/test change |

## 12. Current Change Scope and Impact Radius

- **Classification:** localized arrival/spawn correction.
- **Changed:** `src/world/start.ts`, `src/app/App.ts`, `src/world/route.ts`, `tests/traversal.test.ts`, `tests/experience.test.ts`.
- **Protected:** exhibit contract/content, 64→35 mapping, wing dimensions, collision architecture, streaming/resource ownership, Sanctuary semantics, deployment state, Phase 1 controls.
- **Mandatory validation:** fresh canonical `npm run gate`, then direct browser walkthrough from exterior start into museum.

## 13. Compact Revision Log

- **r17 — 2026-08-20:** Promoted Phase 1 controls to automated-verified from canonical run #36. Implemented Phase 2 exterior start derived from the Arrival Plaza zone, rewired runtime/canonical traversal/wayfinding tests, and added explicit exterior-start regressions. Fresh gate and human walkthrough remain pending.
- **r16 — 2026-08-20:** Recorded explicit control grammar and Phase-1 implementation at commit `545ff801...`; verification was pending at that revision.
