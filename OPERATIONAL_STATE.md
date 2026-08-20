# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 22,
  "last_updated": "2026-08-20",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root:** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Active branch:** `release/v1.0.0`
- **Governed scope:** this repository only; preserved legacy Reliquary artifacts remain read-only.

## 2. Current verified baseline

- Controls: canonical run #36 PASS.
- Exterior start + continuous outside-to-inside route: run #50 PASS.
- Arrival garden + bright daylight: run #60 PASS.
- Bright baseline-zero Rotunda/balcony, coherent wing palettes, facade/vestibule welcome layer, plants/seating/hall furnishing, all 35 exhibit accent frames, six wing threshold/motif identities: run #84 PASS.
- Per-wing emissive hall fixtures and wall inlays: run #92 PASS.

## 3. Active invariants

- Exactly one frame-loop owner: `src/app/Loop.ts`.
- Frozen 64-project → 35-exhibit mapping remains exact.
- No visitor-facing private data/placeholders.
- Dexter Sanctuary remains outside the 35 and non-mascotised.
- Layout/collision dimensions remain governed by `src/world/layout.ts`; continuous traversal is mandatory.
- ResourceScope/streaming/asset lifecycle guarantees remain intact.
- Controls remain W/Up, S/Down, A/Left, D/Right, Q/E rotate, Shift sprint, Space grounded one-shot jump, F/Enter interact.
- Start remains outside on Arrival Plaza facing the museum.
- Rotunda/balcony remain bright neutral baseline-zero spaces.
- Every major wing owns a coherent palette plus non-text shape identity.
- Exhibit accents derive from containing-wing palettes.
- Environmental overlays remain non-colliding and may not narrow mandatory routes.
- Decorative atmosphere uses emissive geometry rather than extra dynamic scene lights.

## 4. Current refinement

### Verified

- Garden and daylight.
- Baseline-zero and wing palette grammar.
- Welcome desk, plants, benches, corridor furnishings.
- Wing threshold bands, transition strips, distinct motifs.
- Exhibit-derived accent frames.
- Emissive per-wing atmosphere.

### Implemented but unverified

- `ExteriorIdentity.ts` strengthens the garden-facing facade with a wider cornice/frieze, tall pilasters, glazed side bays, an abstract central crest, and side plinths while leaving the real entrance wall, doorway, collision and route untouched.
- Runtime wiring and environment regression for the new exterior layer are committed; fresh canonical gate pending.

## 5. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 matcher issue is resolved; runs #84 and #92 passed afterward.

## 6. Unknown / perceptual evidence gaps

| Item | Decisive check |
|---|---|
| Garden frames museum cleanly at actual spawn camera | direct browser walkthrough |
| Daylight exposure is attractive rather than washed out | direct browser walkthrough |
| New facade overlays align cleanly with existing building mass | direct browser walkthrough |
| Rotunda reads luminous rather than sterile | direct browser walkthrough |
| Furnishing/motifs/accents/atmosphere are rich without clutter | direct browser walkthrough |
| Representative-device FPS | human measurement |
| Pointer-lock feel and audible audio | human browser/device test |

## 7. Pending work

1. Reconcile fresh canonical gate for the exterior-identity head.
2. Direct browser walkthrough: garden → vestibule → Rotunda → all six wings.
3. Tune clipping/exposure/density only from observed runtime evidence.
4. Add further furniture only where the runtime still reads empty.

## 8. Active decisions / prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not deploy, publish, merge PR #1, or tag without explicit instruction.
- Reference images guide colour/design language only.
- Prefer deterministic, palette-derived geometry to arbitrary decoration.
- Do not add dynamic lights merely for colour identity.
- Exterior visual overlays must not alter the doorway or collision geometry.

## 9. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS |
| Outside spawn + continuous entry | verified-automated | run #50 PASS |
| Garden + daylight | verified-automated | run #60 PASS |
| Bright baseline + wing palettes | verified-automated | run #84 PASS |
| Furnishing / welcome / exhibit accents / wing identity | verified-automated | run #84 PASS |
| Wing emissive atmosphere | verified-automated | run #92 PASS |
| Stronger garden-facing facade identity | implemented-unverified | source + regression, fresh gate pending |
| Full newest-head core gate | evidence-stale | latest PASS #92 predates ExteriorIdentity |

## 10. Current change scope

Visual/environment refinement only. Layout, collision, controls, exhibit contracts/content, mapping, streaming/resource ownership, Sanctuary semantics and deployment state remain protected.

## 11. Compact revision log

- **r22 — 2026-08-20:** Added non-colliding garden-facing facade identity (cornice/frieze, pilasters, glazing, crest, side plinths) and regression coverage; fresh gate pending.
- **r21 — 2026-08-20:** Promoted WingAtmosphere via run #92.
- **r20 — 2026-08-20:** Promoted baseline/furnishing/exhibit/wing identity via run #84.
