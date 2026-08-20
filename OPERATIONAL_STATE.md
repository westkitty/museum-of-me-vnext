# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 16,
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
| Current refinement | Control overhaul committed at `545ff801bf29d8aeeb254a21334b4cf46ce63807`; canonical GitHub Actions gate is running |

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

## 5. Verified working behaviour

The pre-refinement `release/v1.0.0` baseline at commit `a4a6578c04beb87738a0380c41f3ef7fe420c33a` had a passing canonical automated gate, continuous traversal, all 35 bespoke exhibits, bounded streaming/resources, content/privacy validation, same-origin production runtime, touch controls, keyboard-only accessibility under the superseded arrow-look mapping, and production build validation. Those facts remain historical evidence; behavior inside the input/controller/HUD impact radius requires refreshed evidence after the control change.

## 6. Known not working

| Item | State |
|---|---|
| Previous control mapping | superseded: arrow keys looked rather than moved; E interacted; Space had no jump action |

## 7. Implemented but Unverified

| Item | Evidence missing |
|---|---|
| New directional mapping, Q/E rotation, Shift sprint, Space jump, F/Enter interaction | source + tests committed; GitHub Actions `museum gate` is currently in progress |
| HUD and README control instructions | source committed; no fresh browser observation yet |

## 8. Unknown or Evidence-Stale State

| Item | Decisive check |
|---|---|
| Real pointer-lock capture/look/release | human browser/device test |
| Audible audio | human browser/device test |
| Representative-device FPS | human measurement |
| Human feel of new movement/jump/sprint | direct browser walkthrough after automated gate |

## 9. Pending Work

| Task | Priority | Blocks completion |
|---|---|---|
| Reconcile canonical gate result for commit `545ff801...` | high | yes for claiming Phase 1 verified |
| Direct browser walkthrough of revised controls | high | yes for perceptual/control-feel verification |
| Exterior/garden refinement | next phase | no for this commit |

## 10. Active Decisions, Defaults, and Prohibitions

- Continue refinement from `release/v1.0.0`; do not implement against stale `main`.
- Do not publish, deploy, merge PR #1, or tag a release as part of refinement work without explicit instruction.
- Do not modify preserved legacy Reliquary artifacts.
- Arrow keys are directional movement, not look controls.
- E is rotate-right, not the primary interaction key.
- Jump is edge-triggered and grounded; holding Space must not auto-bunny-hop.

## 11. Validation and Evidence Matrix

| ID | Claim | State | Current evidence | Recheck trigger |
|---|---|---|---|---|
| CTRL-001 | Directional mappings match requested scheme | implemented-unverified | commit `545ff801...`, accessibility tests updated | input/controller change |
| CTRL-002 | Q/E keyboard yaw remains sensitivity-independent | implemented-unverified | updated unit test | look/input change |
| CTRL-003 | Shift is materially faster than walk | implemented-unverified | regression asserts >1.5x one-second distance | movement tuning change |
| CTRL-004 | Space jumps once from ground and does not repeat while held | implemented-unverified | grounded jump regression | vertical physics/input change |
| CTRL-005 | F/Enter interact and E does not | implemented-unverified | interaction regression | input binding change |
| CORE-001 | Mapping/content/privacy/lifecycle/traversal invariants remain intact | evidence-stale until gate completes | pre-change gate PASS | shared runtime/control change |

## 12. Current Change Scope and Impact Radius

- **Classification:** localized cross-cutting input/controller repair.
- **Changed:** `src/player/Input.ts`, `src/player/PlayerController.ts`, `src/ui/HUD.ts`, `tests/accessibility.test.ts`, `README.md`.
- **Protected:** exhibit contract/content, 64→35 mapping, world layout, collision geometry, streaming/resource ownership, Sanctuary semantics, deployment state.
- **Mandatory validation:** canonical `npm run gate`, then direct browser control-feel walkthrough.

## 13. Compact Revision Log

- **r16 — 2026-08-20:** Recorded explicit control grammar and Phase-1 implementation at commit `545ff801...`. New mappings/jump are implemented but not yet promoted to verified because the canonical GitHub Actions gate is still running and no fresh human browser walkthrough has occurred.
