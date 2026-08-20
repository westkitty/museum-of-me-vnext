# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 24,
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
- Stronger garden-facing facade identity through `ExteriorIdentity.ts`: run #104 PASS.
- Three-phase environmental expansion — wing-specific furnishings, Rotunda route threads, and all-35 exhibit colour fields: canonical run #114 PASS.

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
- Every major wing owns a coherent palette plus non-text shape and furnishing identity.
- Exhibit threshold accents and interior colour fields derive from containing-wing palettes.
- Environmental overlays and authored furnishings remain non-colliding and may not narrow mandatory routes.
- Decorative atmosphere uses emissive geometry rather than extra dynamic scene lights.
- Rotunda wayfinding colour begins outside the neutral centre rather than recolouring the hub itself.
- Bespoke exhibit hero objects and their lifecycle contract remain untouched by persistent architectural colour fields.

## 4. Current refinement

### Verified

- Garden and daylight.
- Exterior start and continuous entry.
- Baseline-zero and wing palette grammar.
- Welcome desk, plants, benches, corridor furnishings.
- Wing threshold bands, transition strips, distinct motifs.
- Exhibit-derived threshold accent frames.
- Emissive per-wing atmosphere.
- Strengthened public-building facade identity.
- Two authored, palette-derived furnishing/sculptural stations in each of the six wings.
- Palette-derived Rotunda/balcony floor threads, medallions and ticks toward all six wing thresholds.
- Deterministic wing-derived floor fields, complementary backdrops and rails inside all 35 exhibit bays.

### Implemented but unverified

- None in the current code batch. Remaining uncertainty is perceptual/human-browser evidence rather than source or automated-gate status.

## 5. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 matcher issue is resolved; later canonical gates passed.

## 6. Unknown / perceptual evidence gaps

| Item | Decisive check |
|---|---|
| Garden frames museum cleanly at actual spawn camera | direct browser walkthrough |
| Daylight exposure is attractive rather than washed out | direct browser walkthrough |
| Facade overlays align cleanly with existing building mass | direct browser walkthrough |
| Rotunda remains luminous/neutral with six coloured route threads | direct browser walkthrough |
| Wing furnishings are rich without clutter or visual obstruction | direct browser walkthrough |
| Exhibit colour fields support rather than compete with hero objects | direct browser walkthrough |
| Representative-device FPS | human measurement |
| Pointer-lock feel and audible audio | human browser/device test |

## 7. Pending work

1. Direct browser walkthrough: garden → vestibule → Rotunda → all six wings → representative exhibit bays.
2. Tune clipping/exposure/density only from observed runtime evidence.
3. Add further furniture only where runtime still reads empty.

## 8. Active decisions / prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not deploy, publish, merge PR #1, or tag without explicit instruction.
- Reference images guide colour/design language only.
- Prefer deterministic, palette-derived geometry to arbitrary decoration.
- Do not add dynamic lights merely for colour identity.
- Exterior visual overlays must not alter the doorway or collision geometry.
- Persistent environmental colour may frame exhibits but may not replace, recolour, or lifecycle-couple bespoke exhibit hero objects.

## 9. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS |
| Outside spawn + continuous entry | verified-automated | run #50 PASS |
| Garden + daylight | verified-automated | run #60 PASS |
| Bright baseline + wing palettes | verified-automated | run #84 PASS |
| Furnishing / welcome / exhibit accents / wing identity | verified-automated | run #84 PASS |
| Wing emissive atmosphere | verified-automated | run #92 PASS |
| Stronger garden-facing facade identity | verified-automated | run #104 PASS |
| Distinct authored furnishings in all six wings | verified-automated | run #114 PASS |
| Palette-derived Rotunda route threads to all six wings | verified-automated | run #114 PASS |
| Wing-derived colour fields in all 35 exhibit bays | verified-automated | run #114 PASS |
| Full current runtime-code core gate | verified-automated | run #114 PASS |

## 10. Current change scope

Visual/environment refinement only. Layout, collision, controls, exhibit contracts/content, frozen mapping, streaming/resource ownership, Sanctuary semantics and deployment state remain protected.

## 11. Compact revision log

- **r24 — 2026-08-20:** Promoted the three-phase environmental expansion to automated-verified via canonical run #114. Remaining gaps are direct visual/browser/device evidence only.
- **r23 — 2026-08-20:** Implemented wing-specific authored furnishings, neutral-hub Rotunda wayfinding threads, and wing-derived interior colour fields for all 35 exhibit bays; added runtime wiring and regressions.
- **r22 — 2026-08-20:** Added non-colliding garden-facing facade identity; subsequently verified by run #104.
- **r21 — 2026-08-20:** Promoted WingAtmosphere via run #92.
- **r20 — 2026-08-20:** Promoted baseline/furnishing/exhibit/wing identity via run #84.
