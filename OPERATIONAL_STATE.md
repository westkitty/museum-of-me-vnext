# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 26,
  "last_updated": "2026-08-20",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root:** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Active branch:** `release/v1.0.0`
- **Governed scope:** this repository only; preserved legacy Reliquary artifacts remain read-only.
- **Official plan boundary:** `docs/MUSEUM_VNEXT_BUILD_PLAN.md` ends at Phase 14 — Deployment and Release. There are no official Phase 15/16 entries. Current work prepares three bounded Phase-14 release-readiness subphases without merging, deploying, publishing, or tagging.

## 2. Current verified baseline

- Controls: canonical run #36 PASS.
- Exterior start + continuous outside-to-inside route: run #50 PASS.
- Arrival garden + bright daylight: run #60 PASS.
- Bright baseline-zero Rotunda/balcony, coherent wing palettes, facade/vestibule welcome layer, plants/seating/hall furnishing, all 35 exhibit accent frames, six wing threshold/motif identities: run #84 PASS.
- Per-wing emissive hall fixtures and wall inlays: run #92 PASS.
- Stronger garden-facing facade identity: run #104 PASS.
- Wing-specific furnishings, Rotunda route threads and all-35 exhibit colour fields: run #114 PASS.
- Phase 11 accessibility/input completion, Phase 12 persistent-environment lifecycle budgeting, and Phase 13 automated QA contract/reporting: run #142 PASS.
- Phase-14 release-readiness browser/artifact/security preparation: run #170 PASS, including both canonical `gate` and the independent Chromium `browser` job.

## 3. Active invariants

- Exactly one frame-loop owner: `src/app/Loop.ts`.
- Frozen 64-project → 35-exhibit mapping remains exact.
- No visitor-facing private data/placeholders.
- Dexter Sanctuary remains outside the 35 and non-mascotised.
- Layout/collision dimensions remain governed by `src/world/layout.ts`; continuous traversal is mandatory.
- ResourceScope/streaming/asset lifecycle guarantees remain intact.
- Controls remain W/Up, S/Down, A/Left, D/Right, Q/E rotate, Shift sprint, Space grounded one-shot jump, F/Enter interact, Page Up/Page Down vertical look.
- The accessible text mirror must describe the same current input grammar as the runtime HUD/controller.
- Start remains outside on Arrival Plaza facing the museum.
- Pointer-lock entry prompt is keyboard focusable and activatable with Enter/Space; keyboard navigation does not require pointer lock.
- Map destinations remain operable through semantic buttons and keyboard-activatable SVG bays. A map re-render must return focus to the dialog so focus trapping and Escape remain functional.
- Explicit reduced-motion preference suppresses DOM transitions/animations in addition to system `prefers-reduced-motion`; high contrast and interface scaling remain immediate settings.
- Rotunda/balcony remain bright neutral baseline-zero spaces.
- Every major wing owns a coherent palette plus non-text shape and furnishing identity.
- Exhibit threshold accents and interior colour fields derive from containing-wing palettes.
- Environmental overlays and authored furnishings remain non-colliding and may not narrow mandatory routes.
- Decorative atmosphere uses emissive geometry rather than extra dynamic scene lights.
- Rotunda wayfinding colour begins outside the neutral centre rather than recolouring the hub itself.
- Bespoke exhibit hero objects and their lifecycle contract remain untouched by persistent architectural colour fields.
- The eight always-resident refinement systems are constructed through `PersistentEnvironment` so their aggregate resource footprint remains measurable and bounded.
- Production static output must pass `npm run verify:dist` before publication consideration.
- Release CI must keep deployed dependency auditing separate from dev-tool audit noise: `npm audit --omit=dev --audit-level=high` is the production-surface check.

## 4. Current refinement

### Verified

- Garden, daylight, exterior start and continuous entry.
- Baseline-zero Rotunda and wing palette grammar.
- Welcome/facade/furnishing layers, wing identity/atmosphere, Rotunda wayfinding and all-35 exhibit colour fields.
- Phase 11 automated accessibility/input gate: requested keyboard grammar, touch fallback, browser-blur recovery, keyboard activation semantics, map keyboard paths, reduced-motion/high-contrast/UI-scale contract.
- Phase 12 automated lifecycle/performance gate: repeated canonical traversals settle, streaming stays bounded, shell budgets pass, and the entire always-resident refinement layer has explicit mesh/triangle/material/light/resource budgets with zero tracked resources after disposal.
- Phase 13 automated QA contract: 35/35 exhibits, 64/64 projects and 35/35 bespoke implementations are reported and guarded.
- Browser release gate: committed Playwright configuration/suite boots the real production WebGL application at the exterior Arrival Plaza, proves keyboard input reaches the real `InputManager`/`PlayerController` path, operates visual-map wayfinding by keyboard, verifies Escape recovery after map re-render, toggles explicit reduced motion, and reaches the complete accessible collection without pointer lock. Run #170: 3/3 Chromium tests PASS.
- Headless-browser method is intentionally bounded: after proving the real WebGL application boots, the CI suite stops the render loop so SwiftShader/software rendering does not masquerade as representative performance evidence.
- Accessibility mirror stale-control copy was discovered during browser proof and corrected to the current arrows/Q-E/PageUp-PageDown/Space/F-Enter grammar.
- `verify:dist` is part of canonical `npm run gate` and checks hashed JS/CSS references, required `_headers`, CSP/frame protection, multiple production chunks, and a secret-like-file denylist.
- The independent browser job performs a production-only dependency audit; run #170 reports 0 vulnerabilities for `npm audit --omit=dev --audit-level=high`.
- `public/_headers` carries immutable hashed-asset caching, HTML revalidation, `nosniff`, referrer/permissions policies, frame denial, and the current same-origin CSP.
- `docs/RELEASE_RUNBOOK.md` records the prepared Cloudflare Pages build shape, live-verification sequence, and merge/deploy/tag boundary without performing those actions.
- `validation/reports/HUMAN_QA_CHECKLIST.md` remains the authority for the outstanding real-device/perceptual pass.

### Implemented but unverified

- None in the current repository code batch.

## 5. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 matcher issue is resolved; subsequent canonical gates passed.
- Initial browser run #162 overloaded the CI software renderer while leaving the live frame loop running; this was a test-harness limitation, not accepted browser evidence. The browser harness now proves boot and then stops the loop before semantic checks.
- Browser run #168 exposed a real map keyboard-focus regression: selecting a rebuilt SVG bay removed the focused element, so Escape stopped reaching the dialog. `MapPanel` now restores dialog focus after target/floor re-render; run #170 verifies the repair.
- GitHub Actions artifact storage quota prevented optional Playwright artifact upload during the initial attempt. Artifact upload was removed from the required browser gate so an account-storage quota cannot turn otherwise valid release evidence into a product failure. Job logs remain the current CI evidence.
- Full `npm ci` currently reports findings in the development-tool dependency tree; the deployed dependency audit reports 0 vulnerabilities at the configured high threshold. Do not conflate the two claims.

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
| Actual production URL, response headers, hard refresh and cache behaviour | post-deploy verification after explicit publication authorization |

## 7. Pending work

1. Execute `validation/reports/HUMAN_QA_CHECKLIST.md` with a real browser/device and screen recording.
2. Tune clipping/exposure/density only from observed runtime evidence.
3. If human/device evidence passes and the owner explicitly authorizes release, follow `docs/RELEASE_RUNBOOK.md`: exact-head checks → merge reviewed PR → deploy `main` → verify live URL → tag the verified deployed commit.
4. Do not add further environment furniture merely to continue polishing; require observed empty/problem areas.

## 8. Active decisions / prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not deploy, publish, merge PR #1, enable auto-merge, or tag without explicit instruction.
- Phase-14 preparation is not Phase-14 completion; live deployment and post-deploy verification remain absent.
- Reference images guide colour/design language only.
- Prefer deterministic, palette-derived geometry to arbitrary decoration.
- Do not add dynamic lights merely for colour identity.
- Exterior visual overlays must not alter the doorway or collision geometry.
- Persistent environmental colour may frame exhibits but may not replace, recolour, or lifecycle-couple bespoke exhibit hero objects.
- Automated/headless browser evidence does not satisfy the outstanding human visual/audio/pointer-lock/FPS checks.
- Do not claim a production URL, hosted headers, or cache behaviour until those are observed after an authorized deployment.

## 9. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS; revalidated through #170 |
| Outside spawn + continuous entry | verified-automated | run #50 PASS; browser boots at plaza in #170 |
| Garden + daylight | verified-automated | run #60 PASS; environment regression through #170 |
| Bright baseline + wing palettes | verified-automated | run #84 PASS; revalidated through #170 |
| Furnishing / welcome / exhibit accents / wing identity | verified-automated | run #84 PASS; revalidated through #170 |
| Wing emissive atmosphere | verified-automated | run #92 PASS; revalidated through #170 |
| Stronger garden-facing facade identity | verified-automated | run #104 PASS; revalidated through #170 |
| Distinct authored furnishings in all six wings | verified-automated | run #114 PASS; revalidated through #170 |
| Palette-derived Rotunda route threads to all six wings | verified-automated | run #114 PASS; revalidated through #170 |
| Wing-derived colour fields in all 35 exhibit bays | verified-automated | run #114 PASS; revalidated through #170 |
| Phase 11 keyboard/touch/comfort regression suite | verified-automated | run #142 PASS; browser semantics #170 PASS |
| Phase 12 repeated traversal + persistent-environment budgets | verified-automated | run #142 PASS; canonical gate #170 PASS |
| Phase 13 automated 35/64/bespoke QA reporting | verified-automated | run #142 PASS; canonical gate #170 PASS |
| Real production-build browser boot and keyboard semantic path | verified-automated-browser | run #170 browser job PASS, 3/3 tests |
| Production dependency surface at high audit threshold | verified-automated | run #170: 0 vulnerabilities with `--omit=dev --audit-level=high` |
| Static release artifact integrity | verified-automated | `verify:dist` inside canonical run #170 PASS |
| Static release headers/runbook prepared | verified-source | `public/_headers`, `docs/RELEASE_RUNBOOK.md` |
| Human visual/device QA | pending-human | `validation/reports/HUMAN_QA_CHECKLIST.md` |
| Hosted production verification | pending-owner-action | no deployment authorized/performed |
| Full current runtime-code core gate | verified-automated | canonical run #170 PASS |

## 10. Current change scope

Phase-14 release-readiness preparation only: real-browser semantic proof, production artifact/security verification, static-host release configuration/runbook, and the map-focus/accessibility corrections discovered by those gates. Layout, collision, exhibit contracts/content, frozen mapping, streaming semantics, Sanctuary semantics and deployment state remain protected.

## 11. Compact revision log

- **r26 — 2026-08-20:** Prepared three bounded Phase-14 release-readiness subphases without publishing: (1) committed real production-browser CI proof and repaired stale accessible-control copy plus map re-render focus loss, (2) added `verify:dist` and production-only dependency auditing, and (3) hardened static release headers and added the Cloudflare Pages release runbook. Canonical + browser run #170 PASS; browser 3/3, production audit 0 vulnerabilities. Human/device/perceptual evidence and actual deployment remain pending.
- **r25 — 2026-08-20:** Completed Phase 11 accessibility/input hardening, Phase 12 persistent-environment lifecycle/performance governance, and Phase 13 automated QA contract/reporting. Canonical run #142 PASS.
- **r24 — 2026-08-20:** Promoted the three-phase environmental expansion to automated-verified via canonical run #114.
- **r23 — 2026-08-20:** Implemented wing-specific authored furnishings, neutral-hub Rotunda wayfinding threads, and wing-derived interior colour fields for all 35 exhibit bays.
- **r22 — 2026-08-20:** Added non-colliding garden-facing facade identity; subsequently verified by run #104.
