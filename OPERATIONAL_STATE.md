# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 27,
  "last_updated": "2026-08-20",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root:** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Active branch:** `release/v1.0.0`
- **Governed scope:** this repository only; preserved legacy Reliquary artifacts remain read-only.
- **Official plan boundary:** `docs/MUSEUM_VNEXT_BUILD_PLAN.md` ends at Phase 14 — Deployment and Release. There are no official Phase 15/16 entries. Additional work is therefore bounded Phase-14 release-readiness work, not invented numbered construction phases.

## 2. Current verified baseline

- Controls: canonical run #36 PASS.
- Exterior start + continuous outside-to-inside route: run #50 PASS.
- Arrival garden + bright daylight: run #60 PASS.
- Bright baseline-zero Rotunda/balcony, coherent wing palettes, facade/vestibule welcome layer, plants/seating/hall furnishing, all 35 exhibit accent frames, six wing threshold/motif identities: run #84 PASS.
- Per-wing emissive hall fixtures and wall inlays: run #92 PASS.
- Stronger garden-facing facade identity: run #104 PASS.
- Wing-specific furnishings, Rotunda route threads and all-35 exhibit colour fields: run #114 PASS.
- Phase 11 accessibility/input completion, Phase 12 persistent-environment lifecycle budgeting, and Phase 13 automated QA contract/reporting: run #142 PASS.
- Initial Phase-14 browser/artifact/security preparation: run #170 PASS.
- Software-WebGL timeout correction: exact-head run #174 PASS for both canonical gate and Chromium browser job.
- Current release-readiness batch through commit `740919bc70019318c7d6783a245c8b68712943a9`: run #202 PASS for both canonical gate and independent Chromium browser job. This validates the QA capture aid, hosted-verifier tests, release documentation reconciliation, existing runtime regressions, production build, production dependency audit, and browser visitor path. The r27 state reconciliation itself changes only this control-plane file.

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
- `?qa=1` is a human-recording aid only: it may expose the existing read-only diagnostics overlay but may not change movement, content, collision, streaming, exhibit behavior, audio behavior, or visitor state.
- Diagnostic-only exhibit lookup must remain conditional on the diagnostics overlay being visible; hidden diagnostics should not add a per-frame active-host lookup.
- `npm run verify:hosted -- <https-url>` is post-deploy transport/header/cache proof only. It may not be used to promote visual composition, audible output, pointer-lock feel/recovery, or representative-device FPS to verified.
- A fallback static host is release-eligible only if its live responses satisfy the same hosted verification contract; workflow existence alone is not evidence of header/cache parity.

## 4. Current refinement

### Verified

- Garden, daylight, exterior start and continuous entry.
- Baseline-zero Rotunda and wing palette grammar.
- Welcome/facade/furnishing layers, wing identity/atmosphere, Rotunda wayfinding and all-35 exhibit colour fields.
- Phase 11 automated accessibility/input gate: requested keyboard grammar, touch fallback, browser-blur recovery, keyboard activation semantics, map keyboard paths, reduced-motion/high-contrast/UI-scale contract.
- Phase 12 automated lifecycle/performance gate: repeated canonical traversals settle, streaming stays bounded, shell budgets pass, and the entire always-resident refinement layer has explicit mesh/triangle/material/light/resource budgets with zero tracked resources after disposal.
- Phase 13 automated QA contract: 35/35 exhibits, 64/64 projects and 35/35 bespoke implementations are reported and guarded.
- Production Chromium gate boots the real WebGL application at the exterior Arrival Plaza, proves keyboard input reaches the real `InputManager`/`PlayerController` path, operates visual-map wayfinding by keyboard, verifies Escape recovery after map re-render, toggles explicit reduced motion, and reaches the complete accessible collection without pointer lock.
- Headless-browser method is intentionally bounded: after proving the real WebGL application boots, the CI suite stops the render loop so software rendering does not masquerade as representative performance evidence.
- The CI software-WebGL boot timeout is now a bounded 30 seconds with short semantic assertion waits. Run #174 passed after the 15-second runner-variance false failure, and run #202 revalidated the current browser contract.
- `?qa=1` automatically opens the existing read-only diagnostics overlay for a human recording pass. The overlay exposes FPS/1%-low, draw/triangle/resource counts, zone/position, quality, interaction-control count, audio-engine state, pointer-lock state, pending loads, and current/nearest exhibit. Run #202 verifies the QA surface boots in the production Chromium path.
- `validation/reports/HUMAN_QA_CHECKLIST.md` now describes a decisive capture route using `?qa=1`, while explicitly keeping audible sound, pointer-lock feel, composition and device performance as human evidence.
- `verify:dist` remains part of canonical `npm run gate` and checks hashed JS/CSS references, required `_headers`, CSP/frame protection, multiple production chunks, and a secret-like-file denylist.
- The independent browser job performs the production-only dependency audit; run #202 passes that job.
- Deterministic hosted-verifier logic is implemented as `scripts/hosted-verifier-lib.mjs`, `scripts/verify-hosted.mjs`, and `scripts/hosted-verifier.test.mjs`. `npm run test:release-tools` is part of the canonical gate; run #202 passes it.
- `verify:hosted` requires an HTTPS public target, successful shell response, the three museum mount points, HTML revalidation, `nosniff`, frame denial, required CSP boundary, same-origin content-hashed JS/CSS, successful asset responses, and immutable one-year asset caching.
- `docs/RELEASE_CHECKLIST.md`, `docs/DEPLOYMENT.md`, `docs/RELEASE_RUNBOOK.md`, the PR #1 description, and the human QA checklist now agree on the release boundary and no longer contain the stale pre-Playwright input/browser claims.

### Implemented but unverified

- None in the current pre-deploy repository batch.

## 5. Known not working / superseded

- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 matcher issue is resolved; subsequent canonical gates passed.
- Initial browser run #162 overloaded the CI software renderer while leaving the live frame loop running; this was a test-harness limitation, not accepted browser evidence. The browser harness now proves boot and then stops the loop before semantic checks.
- Browser run #168 exposed a real map keyboard-focus regression; `MapPanel` restores dialog focus after target/floor re-render and subsequent browser runs verify the repair.
- A later browser run on the pre-r27 release work timed out at the entry-prompt assertion under the old 15-second total test timeout even though the application was constructing on software WebGL. The bounded test timeout was raised to 30 seconds rather than weakening semantic assertions; exact-head run #174 passed both jobs and run #202 passed the current expanded browser contract.
- GitHub Actions artifact storage quota prevented optional Playwright artifact upload during an earlier attempt. Artifact upload is not a required release gate; job logs remain CI evidence.
- Full `npm ci` may report findings in the development-tool dependency tree; the deployed dependency audit is the separate `--omit=dev --audit-level=high` check. Do not conflate the two claims.
- Older `docs/RELEASE_CHECKLIST.md` text saying arrows looked, no Playwright suite existed, or publication was the sole remaining action is superseded by the current checklist.
- Older `docs/DEPLOYMENT.md` text implying all engineering evidence was finished before human/device checks is superseded.

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
| Representative-device FPS | human measurement using the QA overlay as supporting evidence |
| Actual production URL, response headers, hard refresh and cache behaviour | post-deploy `verify:hosted` plus live browser check after explicit publication authorization |

## 7. Pending work

1. Execute `validation/reports/HUMAN_QA_CHECKLIST.md` with a representative real browser/device and screen recording; use `?qa=1` as the evidence aid.
2. Tune clipping/exposure/density or interaction feel only from observed runtime evidence; do not create speculative polishing work.
3. If human/device evidence passes and the owner explicitly authorizes release, follow `docs/RELEASE_RUNBOOK.md`: exact-head checks → merge reviewed PR → deploy `main` → run `verify:hosted` and live browser/device verification → tag the verified deployed commit.
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
- Automated/headless browser evidence and the QA telemetry overlay do not satisfy outstanding human visual/audio/pointer-lock/FPS checks.
- Do not claim a production URL, hosted headers, or cache behaviour until those are observed after an authorized deployment.
- Do not dispatch the manual GitHub Pages workflow as a shortcut around the explicit publication boundary.

## 9. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS; revalidated through #202 |
| Outside spawn + continuous entry | verified-automated | run #50 PASS; production browser path revalidated through #202 |
| Garden + daylight | verified-automated | run #60 PASS; environment regression through #202 |
| Bright baseline + wing palettes | verified-automated | run #84 PASS; revalidated through #202 |
| Furnishing / welcome / exhibit accents / wing identity | verified-automated | run #84 PASS; revalidated through #202 |
| Wing emissive atmosphere | verified-automated | run #92 PASS; revalidated through #202 |
| Stronger garden-facing facade identity | verified-automated | run #104 PASS; revalidated through #202 |
| Distinct authored furnishings in all six wings | verified-automated | run #114 PASS; revalidated through #202 |
| Palette-derived Rotunda route threads to all six wings | verified-automated | run #114 PASS; revalidated through #202 |
| Wing-derived colour fields in all 35 exhibit bays | verified-automated | run #114 PASS; revalidated through #202 |
| Phase 11 keyboard/touch/comfort regression suite | verified-automated | run #142 PASS; browser semantics revalidated through #202 |
| Phase 12 repeated traversal + persistent-environment budgets | verified-automated | run #142 PASS; canonical gate #202 PASS |
| Phase 13 automated 35/64/bespoke QA reporting | verified-automated | run #142 PASS; canonical gate #202 PASS |
| Real production-build browser boot and keyboard semantic path | verified-automated-browser | run #202 browser job PASS |
| QA recording telemetry surface (`?qa=1`) | verified-automated-browser | run #202 browser job PASS; production path asserts diagnostics visible with pointer/exhibit telemetry |
| Production dependency surface at high audit threshold | verified-automated | run #202 browser job PASS with `--omit=dev --audit-level=high` |
| Static release artifact integrity | verified-automated | `verify:dist` inside canonical run #202 PASS |
| Hosted verifier logic | verified-automated | `test:release-tools` inside canonical run #202 PASS |
| Static release headers/runbook/checklist prepared | verified-source | `public/_headers`, `docs/RELEASE_RUNBOOK.md`, `docs/DEPLOYMENT.md`, `docs/RELEASE_CHECKLIST.md` |
| Human visual/device QA | pending-human | `validation/reports/HUMAN_QA_CHECKLIST.md` |
| Hosted production verification | pending-owner-action | no deployment authorized/performed; `verify:hosted` cannot run against a nonexistent production URL |
| Current release-readiness code/docs/tool batch | verified-automated | exact-head commit `740919bc70019318c7d6783a245c8b68712943a9`, run #202 gate + browser PASS |

## 10. Current change scope

Phase-14 release-readiness only: reconcile release authority/evidence, make the remaining human checks easier to record decisively, and prepare deterministic post-deploy transport/header verification. Layout, collision, exhibit contracts/content, frozen mapping, streaming semantics, Sanctuary semantics and deployment state remain protected.

## 11. Compact revision log

- **r27 — 2026-08-20:** Completed the next three bounded Phase-14 readiness passes without publishing: (1) reconciled stale release/deployment evidence and documentation, (2) added the opt-in `?qa=1` human-recording telemetry surface and upgraded the human QA capture procedure, and (3) added deterministic hosted transport/header verification with canonical-gate tests and runbook integration. Exact release-readiness head `740919bc70019318c7d6783a245c8b68712943a9` passed run #202 in both canonical and Chromium jobs. Human/device evidence and actual deployment remain pending.
- **r26 — 2026-08-20:** Prepared the initial three bounded Phase-14 release-readiness subphases: committed production-browser CI proof, `verify:dist` plus production-only dependency auditing, static release headers and the release runbook. Run #170 passed.
- **r25 — 2026-08-20:** Completed Phase 11 accessibility/input hardening, Phase 12 persistent-environment lifecycle/performance governance, and Phase 13 automated QA contract/reporting. Canonical run #142 PASS.
- **r24 — 2026-08-20:** Promoted the three-phase environmental expansion to automated-verified via canonical run #114.
- **r23 — 2026-08-20:** Implemented wing-specific authored furnishings, neutral-hub Rotunda wayfinding threads, and wing-derived interior colour fields for all 35 exhibit bays.
- **r22 — 2026-08-20:** Added non-colliding garden-facing facade identity; subsequently verified by run #104.
