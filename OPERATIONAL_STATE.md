# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 4,
  "last_updated": "2026-08-19",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root (SELECTED):** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Baseline classification:** new vNext project created **beside** preserved legacy Reliquary material.
- **Governed scope:** this repository only.
- **Explicitly not governed:** the handoff bundle, the handoff ZIP, the legacy Reliquary ZIPs and HTML
  artifacts. Those are read-only source evidence and are never modified from here.

## 2. Source authority (in force)

1. Explicit user instructions for this run.
2. This file.
3. `docs/MUSEUM_VNEXT_BUILD_PLAN.md` (byte-identical copy of the controlling plan,
   `sha256:03ca23f5…33226a`).
4. The vNext investigation/actualization handoff.
5. Verified repository/runtime evidence.
6. Historical Reliquary material — evidence, not implementation authority.
7. Inference.

## 3. Current baseline

| Item | State |
|---|---|
| Repository | initialised, branch `main`, first phase branch `feat/foundation` |
| Remote | `git@github.com:westkitty/museum-of-me-vnext.git` (private), pushing `feat/foundation` |
| Runtime | traversable graybox + exhibit lifecycle, streaming, interaction, full DOM interface, procedural audio |
| Toolchain | Node 26.7.0, npm 11.19.0, Vite 6, TypeScript 5.7, Three.js **0.185.0** (pinned) |
| Current phase | **Phase 3 complete.** Next: Phase 4 — governed asset pipeline. |

## 4. Active invariants

| ID | Rule | Enforced by |
|---|---|---|
| INV-001 | Exactly one frame-loop owner: `src/app/Loop.ts`. | ESLint `no-restricted-globals` + `npm run validate:frameloop` |
| INV-002 | 64 project identities map to 35 exhibits, exactly once each. Mapping is frozen. | `npm run validate:mapping` |
| INV-003 | No visitor-facing placeholder prose (`TODO`, `placeholder`, `lorem`, `coming soon`, `TBD`). | `npm run validate:content` |
| INV-004 | No credentials, IP literals, private paths, private hostnames, or personal identifiers in visitor content. | `npm run validate:privacy` |
| INV-005 | Legacy Reliquary artifacts are never modified. Hashes recorded in `docs/INVESTIGATION_BASELINE.md`. | manual + hash record |
| INV-006 | Dexter Sanctuary is outside the 35-exhibit count and is never mascotised. | `docs/EXHIBIT_CONTRACT.md`, design review |
| INV-007 | No runtime asset is fetched from a host this project does not control. | `docs/ASSET_POLICY.md`, `npm run validate:assets` |
| INV-008 | Every exhibit's `ResourceScope` drains to zero on unmount. | `ExhibitHost` assertion + lifecycle tests |
| INV-009 | The museum requires no live AI, cloud API, or backend for the core experience. | architecture; no network code outside asset fetch of own files |
| INV-010 | Every dimension of the building derives from `src/world/layout.ts`. Geometry, collision, zones, the map and exhibit anchors may not hard-code a position. | code review; traversal tests fail if they disagree |
| INV-011 | The mandatory traversal must keep passing: entrance → every wing → upper floor → Sanctuary → entrance, with no teleport and no visible level load. | `tests/traversal.test.ts` |

## 5. Verified working behaviour

| Behaviour | Evidence | Verified |
|---|---|---|
| 64 → 35 mapping is complete, exclusive, and gap-free | `node scripts/validate-mapping.mjs` → PASS (35 exhibits / 64 projects / 64 records) | ✅ 2026-08-19 |
| No placeholder prose in authored content | `node scripts/validate-content.mjs` → PASS | ✅ 2026-08-19 |
| No sensitive material in authored content | `node scripts/validate-privacy.mjs` → PASS | ✅ 2026-08-19 |
| Controlling plan copied without weakening | sha256 matches bundle-recorded identity | ✅ 2026-08-19 |
| Toolchain installs and resolves | `npm install` clean; three@0.185.0 resolved | ✅ 2026-08-19 |
| Typecheck, lint, unit tests, production build all pass | `npm run gate` → all PASS; 29 unit tests green; build 1.0 s | ✅ 2026-08-19 |
| Application boots and renders in a real browser | dev server + browser probe: `loopRunning true`, WebGL2 context live, `contextLost false`, DPR capped to 1 on auto-selected `medium` tier, **zero console errors** | ✅ 2026-08-19 |
| **Mandatory traversal passes**: entrance → south → Rotunda → north → east → west → grand stair → balcony → NW mezzanine → NE mezzanine → Sanctuary → entrance, continuously | `tests/traversal.test.ts` simulates the walk against the real `CollisionWorld` using the player's own radius, height and step-up rule. 0 failures across the full route. | ✅ 2026-08-19 |
| Every one of the 35 exhibit bays can be entered and left on foot | same harness, 70 segments (in and out of each bay), 0 failures | ✅ 2026-08-19 |
| Museum geometry builds 35 exhibit mount points and 1,000+ colliders | traversal test + browser probe (`mounts: 35`, `colliders: 1064`) | ✅ 2026-08-19 |
| Zone resolution is correct for every zone, including diagonal mezzanines | `zoneAt` unit tests + live browser check (Sanctuary resolved correctly while standing in it) | ✅ 2026-08-19 |
| The graybox renders as architecture, with long sightlines from the south hall through the Rotunda to the north wing | browser screenshots at entrance, south hall, Rotunda and Sanctuary | ✅ 2026-08-19 |
| **Phase 3 lifecycle gate passes**: five deliberately different exhibits load, activate, deactivate, unload and reload independently | `tests/lifecycle.test.ts` — three cycles each, identical allocation per cycle, zero leaked resources on every unmount, idempotent deterministic reset | ✅ 2026-08-19 |
| Streaming loads on approach and releases on departure without leaking | same test — E01 goes active on approach, returns to `loaded` with a zero resource count on departure, and comes back clean | ✅ 2026-08-19 |
| Streaming respects a per-frame construction budget | same test — never exceeds `mountsPerFrame` | ✅ 2026-08-19 |
| Every one of the 35 exhibits produces accessible content with real interpretation and at least one control | same test, all 35 instantiated | ✅ 2026-08-19 |
| HUD, map, journal, deep panel and settings render and operate in a real browser | browser: entry prompt and location line correct at spawn; map draws the plan from `layout.ts` with all 35 bays and the Sanctuary; deep panel shows layered interpretation for E17 | ✅ 2026-08-19 |
| Single frame loop is structurally enforced | `validate:frameloop` PASS — `src/app/Loop.ts` is the only `requestAnimationFrame` owner across 13 source files | ✅ 2026-08-19 |
| Asset governance gate operational | `validate:assets` PASS — no hotlinked runtime asset in any source file | ✅ 2026-08-19 |

## 6. Implemented but NOT verified

| Item | Why not yet verified |
|---|---|
| Quality-tier switching at runtime | `setQuality` is implemented and typechecked; no runtime tier-change observation yet. Phase 12. |
| Context-loss recovery | Handlers are installed and typechecked; not exercised against a real context loss. Phase 12. |
| Preference persistence in a browser | Unit-tested against an in-memory Storage; not yet observed against real `localStorage`. Phase 11. |
| Frame rate | The browser-automation tab throttles `requestAnimationFrame`, so measured FPS there is not meaningful. Real measurement is Phase 12 work. |
| Audio | The AudioManager is implemented and typechecked but browsers refuse audio before a real gesture, which automation cannot supply. Unverified until a human walk-through in Phase 13. |
| Pointer-lock capture and release | Implemented and wired; not exercised by a real pointer lock yet. Phase 11. |
| Interactive walking with keyboard and pointer lock | Input and controller are implemented and typechecked; traversal so far is proven by simulation against real collision, not by a human walking it. Phase 3 adds the interaction layer and Phase 13 captures the recorded walkthrough. |

## 7. Known blockers / unknowns

| Item | Status |
|---|---|
| Production hosting target | **Not configured.** No account decision has been made. Phase 14 will prepare deployment completely and stop short of publishing to an unidentified destination. |
| Runtime performance | Unmeasured until Phase 12. |
| Push remote | Recorded at the first push attempt. `gh` is authenticated as `westkitty` with `repo` scope. |

## 8. Phase ledger

| Phase | State |
|---|---|
| 0 — authority/source freeze | ✅ complete |
| 1 — repository/runtime foundation | ✅ complete |
| 2 — complete museum graybox | ✅ complete |
| 3 — core museum systems | ✅ complete |
| 4 — governed asset pipeline | ▶ next |
| 5 — vertical slice | pending |
| 6 — production architecture | pending |
| 7 — exhibit wave one | pending |
| 8 — exhibit wave two | pending |
| 9 — content completion | pending |
| 10 — experience pass | pending |
| 11 — accessibility/input | pending |
| 12 — performance/lifecycle | pending |
| 13 — full museum QA | pending |
| 14 — deployment/release | pending |
