# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 25,
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
- Stronger garden-facing facade identity: run #104 PASS.
- Wing-specific furnishings, Rotunda route threads and all-35 exhibit colour fields: run #114 PASS.
- Phase 11 accessibility/input completion, Phase 12 persistent-environment lifecycle budgeting, and Phase 13 automated QA contract/reporting: canonical run #142 PASS. The preceding code head also passed run #138 with 19 test files / 467 tests.

## 3. Active invariants

- Exactly one frame-loop owner: `src/app/Loop.ts`.
- Frozen 64-project → 35-exhibit mapping remains exact.
- No visitor-facing private data/placeholders.
- Dexter Sanctuary remains outside the 35 and non-mascotised.
- Layout/collision dimensions remain governed by `src/world/layout.ts`; continuous traversal is mandatory.
- ResourceScope/streaming/asset lifecycle guarantees remain intact.
- Controls remain W/Up, S/Down, A/Left, D/Right, Q/E rotate, Shift sprint, Space grounded one-shot jump, F/Enter interact.
- Start remains outside on Arrival Plaza facing the museum.
- Pointer-lock entry prompt is keyboard focusable and activatable with Enter/Space; keyboard navigation does not require pointer lock.
- Map destinations remain operable through semantic buttons and the visual SVG bays are also keyboard activatable.
- Explicit reduced-motion preference suppresses DOM transitions/animations in addition to system `prefers-reduced-motion`; high contrast and interface scaling remain immediate settings.
- Rotunda/balcony remain bright neutral baseline-zero spaces.
- Every major wing owns a coherent palette plus non-text shape and furnishing identity.
- Exhibit threshold accents and interior colour fields derive from containing-wing palettes.
- Environmental overlays and authored furnishings remain non-colliding and may not narrow mandatory routes.
- Decorative atmosphere uses emissive geometry rather than extra dynamic scene lights.
- Rotunda wayfinding colour begins outside the neutral centre rather than recolouring the hub itself.
- Bespoke exhibit hero objects and their lifecycle contract remain untouched by persistent architectural colour fields.
- The eight always-resident refinement systems are constructed through `PersistentEnvironment` so their aggregate resource footprint remains measurable and bounded.

## 4. Current refinement

### Verified

- Garden, daylight, exterior start and continuous entry.
- Baseline-zero Rotunda and wing palette grammar.
- Welcome/facade/furnishing layers, wing identity/atmosphere, Rotunda wayfinding and all-35 exhibit colour fields.
- Phase 11 automated accessibility/input gate: requested keyboard grammar, touch fallback, browser-blur recovery, keyboard activation semantics, map keyboard paths, reduced-motion/high-contrast/UI-scale contract.
- Phase 12 automated lifecycle/performance gate: repeated canonical traversals settle, streaming stays bounded, shell budgets pass, and the entire always-resident refinement layer now has explicit mesh/triangle/material/light/resource budgets with zero tracked resources after disposal.
- Phase 13 automated QA contract: 35/35 exhibits, 64/64 projects and 35/35 bespoke implementations are reported; whole-museum accessibility/traversal/lifecycle/environment guard suites are required by the QA generator; canonical gate #142 passes.
- `validation/reports/HUMAN_QA_CHECKLIST.md` records the exact remaining visual/device route without representing it as completed evidence.

### Implemented but unverified

- None in the current code batch.

## 5. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 matcher issue is resolved; subsequent canonical gates passed.

## 6. Unknown / human evidence gaps

| Item | Decisive check |
|---|---|
| Garden frames museum cleanly at actual spawn camera | recorded direct browser walkthrough |
| Daylight exposure is attractive rather than washed out | recorded direct browser walkthrough |
| Facade overlays align cleanly with existing building mass | recorded direct browser walkthrough |
| Rotunda remains luminous/neutral with six coloured route threads | recorded direct browser walkthrough |
| Wing furnishings are rich without clutter or visual obstruction | recorded direct browser walkthrough |
| Exhibit colour fields support rather than compete with hero objects | recorded direct browser walkthrough |
| Pointer-lock capture, Escape/loss recovery and recapture feel correct | real browser/device test |
| Audible ambience/exhibit audio matches subtitles | real browser/device test |
| Representative-device FPS | human measurement |

## 7. Pending work

1. Execute `validation/reports/HUMAN_QA_CHECKLIST.md` with a real browser/device and screen recording.
2. Tune clipping/exposure/density only from observed runtime evidence.
3. Do not add further environment furniture merely to continue polishing; require observed empty/problem areas.
4. Deployment/release remains a separate explicit owner decision and is not authorized by the current refinement work.

## 8. Active decisions / prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not deploy, publish, merge PR #1, or tag without explicit instruction.
- Reference images guide colour/design language only.
- Prefer deterministic, palette-derived geometry to arbitrary decoration.
- Do not add dynamic lights merely for colour identity.
- Exterior visual overlays must not alter the doorway or collision geometry.
- Persistent environmental colour may frame exhibits but may not replace, recolour, or lifecycle-couple bespoke exhibit hero objects.
- Automated evidence does not satisfy the outstanding human visual/audio/pointer-lock/FPS checks.

## 9. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS; revalidated through #142 |
| Outside spawn + continuous entry | verified-automated | run #50 PASS; traversal revalidated through #142 |
| Garden + daylight | verified-automated | run #60 PASS; environment regression through #142 |
| Bright baseline + wing palettes | verified-automated | run #84 PASS; revalidated through #142 |
| Furnishing / welcome / exhibit accents / wing identity | verified-automated | run #84 PASS; revalidated through #142 |
| Wing emissive atmosphere | verified-automated | run #92 PASS; revalidated through #142 |
| Stronger garden-facing facade identity | verified-automated | run #104 PASS; revalidated through #142 |
| Distinct authored furnishings in all six wings | verified-automated | run #114 PASS; revalidated through #142 |
| Palette-derived Rotunda route threads to all six wings | verified-automated | run #114 PASS; revalidated through #142 |
| Wing-derived colour fields in all 35 exhibit bays | verified-automated | run #114 PASS; revalidated through #142 |
| Phase 11 keyboard/touch/comfort regression suite | verified-automated | run #142 PASS |
| Phase 12 repeated traversal + persistent-environment budgets | verified-automated | run #142 PASS |
| Phase 13 automated 35/64/bespoke QA reporting | verified-automated | run #142 PASS |
| Human visual/device QA | pending-human | `validation/reports/HUMAN_QA_CHECKLIST.md` |
| Full current runtime-code core gate | verified-automated | canonical run #142 PASS |

## 10. Current change scope

Accessibility/input hardening, lifecycle/performance governance and QA evidence only. Layout, collision, exhibit contracts/content, frozen mapping, streaming semantics, Sanctuary semantics and deployment state remain protected.

## 11. Compact revision log

- **r25 — 2026-08-20:** Completed the next three build-plan phases available to automated implementation: Phase 11 accessibility/input hardening, Phase 12 persistent-environment lifecycle/performance governance, and Phase 13 automated QA contract/reporting. Canonical run #142 PASS. Human screen-recorded visual/audio/pointer-lock/FPS evidence remains explicitly pending.
- **r24 — 2026-08-20:** Promoted the three-phase environmental expansion to automated-verified via canonical run #114.
- **r23 — 2026-08-20:** Implemented wing-specific authored furnishings, neutral-hub Rotunda wayfinding threads, and wing-derived interior colour fields for all 35 exhibit bays.
- **r22 — 2026-08-20:** Added non-colliding garden-facing facade identity; subsequently verified by run #104.
