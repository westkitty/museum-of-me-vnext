# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 1,
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
| Remote | see §7 |
| Runtime | not yet built |
| Toolchain | Node 26.7.0, npm 11.19.0, Vite 6, TypeScript 5.7, Three.js **0.185.0** (pinned) |
| Current phase | **Phase 0 complete.** Next: Phase 1 — repository/runtime foundation. |

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

## 5. Verified working behaviour

| Behaviour | Evidence | Verified |
|---|---|---|
| 64 → 35 mapping is complete, exclusive, and gap-free | `node scripts/validate-mapping.mjs` → PASS (35 exhibits / 64 projects / 64 records) | ✅ 2026-08-19 |
| No placeholder prose in authored content | `node scripts/validate-content.mjs` → PASS | ✅ 2026-08-19 |
| No sensitive material in authored content | `node scripts/validate-privacy.mjs` → PASS | ✅ 2026-08-19 |
| Controlling plan copied without weakening | sha256 matches bundle-recorded identity | ✅ 2026-08-19 |
| Toolchain installs and resolves | `npm install` clean; three@0.185.0 resolved | ✅ 2026-08-19 |

## 6. Implemented but NOT verified

Nothing yet — Phase 0 produced documents and data only, all of which are machine-validated above.

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
| 1 — repository/runtime foundation | ▶ next |
| 2 — complete museum graybox | pending |
| 3 — core museum systems | pending |
| 4 — governed asset pipeline | pending |
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
