# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 31,
  "last_updated": "2026-08-23",
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
- Release-verifier/QA-telemetry readiness through `740919bc70019318c7d6783a245c8b68712943a9`: run #202 PASS in both jobs.
- r27 state-only head `20466855999f7c33d520a3a947c73ab07157a940`: run #204 PASS in both jobs.
- Structured human-evidence and semantic-input-isolation batch through `347e7f1b2eb18ada820d0d7af891597c81d0368e`: run #224 PASS in both jobs.
- Human-evidence completeness verification plus automated-QA checklist immutability through `034ef1e48400acca8632b4c8e2478d0663b30549`: run #238 PASS in both canonical and Chromium jobs. This is the verified release-branch baseline that the r30 restoration integrates onto.
- **Reliquary source-parity and runtime restoration (r30), integrated onto remote base `25cc3121e599ccf7ce535d8853501d81b659f0c4`:** canonical `npm run gate` PASS, standalone build and `npm run verify:standalone` PASS. `scripts/runtime-source-qa.mjs` executes **14/14 source installation runtime interaction paths and 17/17 authored visitor conversations** against the real production runtime inside the offline canonical artifact, with zero remote requests. Three real defects found by that exercise were repaired (movement mirrored about Z at off-axis yaw, a physically unreachable Dexter Sanctuary, and a rotunda slab overhanging the ramp mouth). The historical 200-observation ledger remains **MISSING HISTORICAL EVIDENCE** and was not fabricated; the museum itself is proven against all surviving authoritative source evidence.
- **Collision/traversal repair batch plus rotunda flight pad (r31), exact head `1b25224e2ebbe5dfc40af9b6996316e988e370f9` on top of r30 head `138c65a53590b21283c0941049047a5fd24dac48`:** local `npm run gate` PASS, `npm run verify:standalone` PASS (14/14 installations, 17/17 visitors, 0 remote requests), local production dependency audit PASS (`npm audit --omit=dev --audit-level=high`, 0 findings), local `npm run test:e2e` PASS (all 3 Chromium visitor-path specs). **GitHub Actions run #243 PASS in both the canonical `gate` job and the `browser` job** (production dependency audit + Chromium visitor-path suite) on this exact pushed head. Eight collision/traversal defects found by inspection were repaired: a rejected `requestPointerLock()` could leave the focused entry-prompt div silently eating WASD/jump/interact (`src/player/Input.ts`); diagonal-wall collision chunking left up to ~1.2 m of invisible extra thickness on angled walls (`src/world/GeometryKit.ts`, chunk length 1.5 m → 0.4 m); adjacent balcony-ring wall segments left an uncovered sliver at each octagon corner (`src/world/Museum.ts`, added corner overlap); the Sanctuary dais used an impassable `wall` collider instead of a steppable `floor` one; the north wing's bay side walls (`bayHeight: 12`) poked through the media/infra wing floor above it at `LEVEL_1_Y = 10` (reduced to 9); the SW/SE grand stairs' 26 m run swung landings into the neighbouring wing's solid archway lintel (`run: 26` → `10`, centred); the balcony route cut straight chords across the open atrium void between distant wing thresholds instead of following the ring (`route.ts` now walks balcony-ring waypoints); and the traversal test walker could exhaust its step budget short of a target without failing (`tests/helpers/walk.ts` now checks final distance explicitly). None of these were previously recorded in this file; they were found auditing an uncommitted working tree against this document before the r31 commit landed. **New scope, added at explicit owner direction, not part of the frozen build plan:** the rotunda's central orientation plinth is now a walkable low kerb (collision changed from an impassable `wall` box to a steppable `floor`, height capped at the player's 0.55 m step-up) and doubles as a flight pad. The decorative torus "armature" that previously sat above the plinth was removed to make room for it. Stepping onto the plinth while grounded (`isOnFlightPad`, `src/world/layout.ts`) launches the visitor upward with a brief decaying impulse and suspends gravity/wall collision (`PlayerController.enterFlight`/`fixedUpdateFlight`); flying is free look/WASD movement with no gravity, and landing on any floor hands normal walking control back. This is a deliberate, owner-directed exception to the "Space grounded one-shot jump" invariant below — flight is entered by standing in one location, not by a key press, and does not add any extra jump. Covered by three new unit cases in `tests/accessibility.test.ts` (`rotunda flight pad (regression)`): pad-radius geometry, launch-then-hold-altitude, and fly-down-to-land-returns-control.

## 3. Active invariants

- Exactly one frame-loop owner: `src/app/Loop.ts`.
- Movement intent must be rotated by the same basis as the camera. Forward is `(-sin yaw, -cos yaw)`; right is `(cos yaw, -sin yaw)`. Mirroring either axis makes the visitor walk away from where they are looking.
- No floor collider may roof the Dexter Sanctuary ramp trench. `supportHeight` returns the highest surface at or below the step-up, so any slab laid across the trench makes the Sanctuary unreachable on foot. Exterior ground and the rotunda slab are added through `Museum.addFloorClearOfSanctuaryRamp`.
- The fourteen source installations are live objects with the source keyed state machines, an interpretive lectern, a collision footprint and persistence — never labels. Their governing behaviour is `src/content/installationState.ts`.
- Source installation control codes reach an installation only while it is engaged; `InputManager.setCodeCapture` must stay inert otherwise so museum movement and UI keys are unaffected.
- Semantic and custom UI controls (INPUT, TEXTAREA, SELECT, BUTTON, A, contenteditable, `role="button"`) own their own keyboard events. `InputManager.isSemanticControlTarget` is decided once per keydown and is the single gate for BOTH the global BINDINGS and the raw installation code capture, so the two can never disagree. Raw capture is additionally blocked while `uiCaptured` is true. A panel or QA surface must never mutate an installation behind itself. Key release is never gated, so a key cannot be stranded as held when focus moves into a panel mid-press.
- Installations stand clear inside the bay of the exhibit their project was frozen onto. They may not move, recolour or lifecycle-couple a bespoke hero object, and must keep at least 4 m of clearance from it.
- The `INSTALLATION_THESES` silhouette and required-part contract is byte-identical in CURATED and Version B and outranks either builder's own part naming.
- Exact old-hall installation coordinates are implementation detail: the two source authorities disagree on 14/14 of them. Room grouping, activation radius, reading zone, interaction radius and camera safe distance are governing and are preserved exactly.
- ESLint 9 flat config does not read `.gitignore`. Generated output directories must be listed in `eslint.config.js` explicitly.
- Frozen 64-project → 35-exhibit mapping remains exact.
- No visitor-facing private data/placeholders.
- Dexter Sanctuary remains outside the 35 and non-mascotised.
- Layout/collision dimensions remain governed by `src/world/layout.ts`; continuous traversal is mandatory.
- ResourceScope/streaming/asset lifecycle guarantees remain intact.
- Controls remain W/Up, S/Down, A/Left, D/Right, Q/E rotate, Shift sprint, Space grounded one-shot jump, F/Enter interact, Page Up/Page Down vertical look, with one deliberate exception: the rotunda flight pad (below).
- The accessible text mirror must describe the same current input grammar as the runtime HUD/controller.
- The rotunda centre plinth is a walkable low kerb and doubles as a flight pad (r31, owner-directed). Stepping onto it while grounded launches the visitor and suspends gravity/wall collision until they descend back onto a floor. This is the sole exception to "Space grounded one-shot jump": flight is triggered by location, not an extra key press, and does not itself grant any additional jump.
- Start remains outside on Arrival Plaza facing the museum.
- Pointer-lock entry prompt is keyboard focusable and activatable with Enter/Space; keyboard navigation does not require pointer lock.
- Map destinations remain operable through semantic buttons and keyboard-activatable SVG bays. A map re-render must return focus to the dialog so focus trapping and Escape remain functional.
- Semantic HTML controls and custom `role="button"` controls own their keyboard events. Global museum bindings must not consume Enter/Space/etc. from INPUT, TEXTAREA, SELECT, BUTTON, A, contenteditable, or custom button-like targets.
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
- `?qa=1` is a human-evidence aid only. It may expose read-only diagnostics and the QA evidence recorder but may not change movement, content, collision, streaming, exhibit behavior, audio behavior, journal state, preferences, or ordinary visitor state.
- The QA evidence recorder is session-only and human-authored: it may hold manual Pending/Pass/Needs-work choices, notes, telemetry snapshots, and generated report text in memory, but it may not persist judgments or infer acceptance automatically.
- A release human-QA record is not complete while an acceptance item is accidentally Pending. Any Needs-work item is a release blocker until the concrete observed issue is repaired and rechecked.
- `npm run verify:human-evidence -- <record>` validates completeness of an already human-authored record only. It may reject incomplete evidence but may not create, infer, or upgrade human visual/audio/pointer-lock/performance judgments.
- `npm run qa` may regenerate `validation/reports/QA_REPORT.md` but must preserve the hand-maintained `validation/reports/HUMAN_QA_CHECKLIST.md` byte-for-byte.
- Diagnostic-only exhibit lookup must remain conditional on diagnostics being visible; hidden diagnostics should not add a per-frame active-host lookup.
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
- The CI software-WebGL boot timeout remains a bounded 30 seconds with short semantic assertion waits. Run #174 verified that correction; later runs through #238 revalidated the browser contract.
- `?qa=1` exposes the existing read-only diagnostics overlay and the session-only `QACapture` evidence recorder. A human can mark the nine remaining perceptual/device acceptance areas, capture timestamped runtime telemetry, record notes, and generate a Markdown evidence record. Browser runs through #238 verify the production-path recorder surface without auto-promoting any human judgment.
- Semantic-control input isolation is fixed: native controls and custom `role="button"` targets no longer leak their activation keys into global museum interaction/jump bindings. `tests/input-ui-guard.test.ts` covers native controls, custom buttons, and preservation of the ordinary canvas/global path.
- `validation/reports/HUMAN_QA_CHECKLIST.md` defines the decisive recording route, required telemetry checkpoints, semantic-control isolation check, and evidence-closure rules.
- `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md` provides a durable record for device/browser identity, nine acceptance judgments, required telemetry snapshots, concrete observations, and final disposition.
- `scripts/human-evidence-verifier-lib.mjs`, `scripts/verify-human-evidence.mjs`, and deterministic tests now provide an evidence-completeness gate. It requires exactly nine PASS acceptance entries, at least six telemetry snapshots, and non-empty human notes while explicitly refusing to substitute for human observation. Run #238 canonical gate passes these release-tool tests.
- `scripts/qa-report-runner.mjs` now protects the hand-maintained human checklist from the older generated scaffold embedded in `qa-report.mjs`, restoring the exact original bytes after automated QA generation. Run #238 canonical gate proves the wrapper executes successfully inside the real gate.
- `docs/RELEASE_RUNBOOK.md` requires `verify:human-evidence` PASS before merge/publication consideration and documents the QA checklist immutability boundary.
- `verify:dist` remains part of canonical `npm run gate` and checks hashed JS/CSS references, required `_headers`, CSP/frame protection, multiple production chunks, and a secret-like-file denylist.
- The independent browser job performs the production-only dependency audit; run #238 passes that job.
- Deterministic hosted-verifier logic remains implemented as `scripts/hosted-verifier-lib.mjs`, `scripts/verify-hosted.mjs`, and `scripts/hosted-verifier.test.mjs`. `npm run test:release-tools` now covers both hosted verification and human-evidence completeness verification.
- `verify:hosted` requires an HTTPS public target, successful shell response, the three museum mount points, HTML revalidation, `nosniff`, frame denial, required CSP boundary, same-origin content-hashed JS/CSS, successful asset responses, and immutable one-year asset caching.

- **VERIFIED (r29):** all 14 source primary installation runtime interaction paths, individually exercised in the real production runtime — reached, object present, thesis parts complete, lectern present, focus acquired by the real raycast, interaction invoked, engaged, every source control driven through real keyboard events, state transitioned, persisted, examined, restored after reload, journal, guide target, study subject, touch control table, reset.
- **VERIFIED (r29):** all 17 authored visitor conversations, individually exercised — identity, appearance, staff badge, route, in scene, focus acquired, conversation started through the real interaction manager, every authored line spoken, re-entry returns to the first line, journal heard and journal history.
- **VERIFIED (r29):** the Dexter Sanctuary is reachable by walking the real museum route with real collision, descending to `y = -5`, arriving with interaction focus on the `dexgpt` installation.
- **VERIFIED (r29):** movement agrees with the camera at every yaw (8 explicit cases plus a 16-step full-circle sweep).
- **VERIFIED (r29):** installation persistence round-trips, and malformed, future-version and tampered payloads are quarantined rather than discarded.
- **VERIFIED (r29):** the standalone canonical artifact boots offline from `file://` with zero remote requests while all of the above is exercised.

### Implemented but unverified

- None in the current pre-deploy repository batch.

### Missing historical evidence

- `Reliquary_200_Observation_Closure_Ledger.md` — **UNRECOVERED**. Searched by name, by Spotlight content index, in all four archives, and across all 111 commits of git history. Every occurrence of its name on this machine is a statement of its absence. See `Reliquary_200_Ledger_Recovery_Report.md`. Recorded as missing historical documentation, **not** as a museum failure and **not** as superseded.
- `Reliquary_Restoration_Validation_Report.md` — **UNRECOVERED**, same search.
- `Reliquary_Restoration_SHA256SUMS.txt` — **UNRECOVERED**, same search.

## 5. Known not working / superseded

- **BROKEN, NOW REPAIRED (r29):** `PlayerController` rotated movement intent by `+yaw` against a `-yaw` camera basis, so the visitor walked mirrored about Z at every heading off the main axis. Automated routes had only ever travelled the main axis and the pointer-look human check was still pending, so nothing caught it. Every earlier human impression of off-axis walking is invalid.
- **BROKEN, NOW REPAIRED (r29):** the Dexter Sanctuary was physically unreachable on foot. A single 600x600 exterior ground collider at `GROUND_Y - 0.5` roofed the descending ramp, and `supportHeight` always chose it, so the visitor walked over the trench. The Sanctuary could only be entered by teleport.
- **BROKEN, NOW REPAIRED (r29):** the rotunda slab overhung the sanctuary ramp mouth by about 9 m, leaving a 1.15 m drop onto the ramp.
- **BROKEN, NOW REPAIRED (r29):** `npm run lint` was linting the 6 MB generated `dist-standalone` bundle, because ESLint 9 flat config does not read `.gitignore`.
- **SUPERSEDED, cited:** source hall ordering within a room, and the West Systems Workshop room grouping, both yield to the frozen 64->35 mapping (`data/exhibit-mapping.json`, `frozen: true`, `frozenAt: 2026-08-19`). Project association is preserved instead. See `Reliquary_Installation_Spatial_Matrix.md` section 2.
- Interior spawn, dark exterior sky and beige Rotunda baseline are superseded.
- Gate #78 matcher issue is resolved; subsequent canonical gates passed.
- Initial browser run #162 overloaded the CI software renderer while leaving the live frame loop running; this was a test-harness limitation, not accepted browser evidence. The browser harness now proves boot and then stops the loop before semantic checks.
- Browser run #168 exposed a real map keyboard-focus regression; `MapPanel` restores dialog focus after target/floor re-render and subsequent browser runs verify the repair.
- A pre-r27 browser run timed out at the entry-prompt assertion under the old 15-second total test timeout even though the application was constructing on software WebGL. The bounded test timeout was raised to 30 seconds rather than weakening semantic assertions; exact-head run #174 and subsequent runs pass.
- Browser run #214 on the first QA-recorder test failed its later movement assertion because report generation intentionally focused/selected a TEXTAREA; the hardened `InputManager` correctly ignored W while a text control owned focus. The browser harness now explicitly blurs the report before proving the global movement path. Later runs pass; this was a harness sequencing error, not an accepted museum regression.
- Before r29, `qa-report.mjs` rewrote the tracked human QA checklist from a stale embedded scaffold whenever `npm run qa` ran. `qa-report-runner.mjs` now preserves and restores the hand-maintained checklist exactly; run #238 passes the canonical gate with that guard active.
- GitHub Actions artifact storage quota prevented optional Playwright artifact upload during an earlier attempt. Artifact upload is not a required release gate; job logs remain CI evidence.
- Full `npm ci` may report findings in the development-tool dependency tree; the deployed dependency audit is the separate `--omit=dev --audit-level=high` check. Do not conflate the two claims.
- Older release-checklist/deployment language that predated the current Playwright, human-evidence, or semantic-input contracts is superseded by the current documents.

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
| Representative-device FPS | human measurement using diagnostics/QA snapshots as supporting evidence |
| Actual production URL, response headers, hard refresh and cache behaviour | post-deploy `verify:hosted` plus live browser check after explicit publication authorization |

## 7. Pending work

1. ~~Locate or reconstruct `Reliquary_200_Observation_Closure_Ledger.md`~~ — **closed as far as the evidence allows.** The original is unrecoverable (`Reliquary_200_Ledger_Recovery_Report.md`). A separately named reconstruction built from primary evidence exists: `Reliquary_Reconstructed_Source_Regression_Ledger.md`, 115 `R-nnn` rows, no FAIL and no governing UNVERIFIED row. Do not relabel it as the historical ledger.
2. ~~Exercise all 14 source installation interaction paths and all 17 visitor conversations~~ — **closed.** `npm run verify:standalone` runs `scripts/runtime-source-qa.mjs` every time and fails the chain if any path regresses.
3. Execute `validation/reports/HUMAN_QA_CHECKLIST.md` with a representative real browser/device and screen recording using `?qa=1`.
4. Preserve the generated Markdown evidence output or complete `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md`; include device/browser details and required snapshots, with every acceptance item explicitly resolved to Pass or Needs work.
5. Run `npm run verify:human-evidence -- <completed-human-qa.md>` against the preserved human record. A verifier PASS proves completeness only; the human observations remain the decisive evidence.
6. The human walkthrough must be run from scratch rather than carried over: the r30 movement repair changes how the museum handles at every heading off the main axis, so impressions recorded before it do not transfer.
7. Tune clipping/exposure/density or interaction feel only from concrete Needs-work observations; do not create speculative polishing work.
8. If the human/device evidence passes and the owner explicitly authorizes release, follow `docs/RELEASE_RUNBOOK.md`: exact-head checks → merge reviewed PR → deploy `main` → run `verify:hosted` and live browser/device verification → tag the verified deployed commit.
9. Do not add further environment furniture merely to continue polishing; require an observed empty/problem area.

## 8. Active decisions / prohibitions

- Continue from `release/v1.0.0`; do not implement against stale `main`.
- Do not deploy, publish, merge PR #1, enable auto-merge, or tag without explicit instruction.
- Phase-14 preparation is not Phase-14 completion; live deployment and post-deploy verification remain absent.
- Reference images guide colour/design language only.
- Prefer deterministic, palette-derived geometry to arbitrary decoration.
- Do not add dynamic lights merely for colour identity.
- Exterior visual overlays must not alter the doorway or collision geometry.
- Persistent environmental colour may frame exhibits but may not replace, recolour, or lifecycle-couple bespoke exhibit hero objects.
- Automated/headless browser evidence, diagnostics, QA snapshots, generated evidence structure, and evidence-completeness verification do not satisfy outstanding human visual/audio/pointer-lock/FPS judgments.
- Do not claim a production URL, hosted headers, or cache behaviour until those are observed after an authorized deployment.
- Do not dispatch the manual GitHub Pages workflow as a shortcut around the explicit publication boundary.

## 9. Validation matrix

| Claim | State | Evidence |
|---|---|---|
| Requested controls | verified-automated | run #36 PASS; revalidated through #238 |
| Outside spawn + continuous entry | verified-automated | run #50 PASS; production browser path revalidated through #238 |
| Garden + daylight | verified-automated | run #60 PASS; environment regression through #238 |
| Bright baseline + wing palettes | verified-automated | run #84 PASS; revalidated through #238 |
| Furnishing / welcome / exhibit accents / wing identity | verified-automated | run #84 PASS; revalidated through #238 |
| Wing emissive atmosphere | verified-automated | run #92 PASS; revalidated through #238 |
| Stronger garden-facing facade identity | verified-automated | run #104 PASS; revalidated through #238 |
| Distinct authored furnishings in all six wings | verified-automated | run #114 PASS; revalidated through #238 |
| Palette-derived Rotunda route threads to all six wings | verified-automated | run #114 PASS; revalidated through #238 |
| Wing-derived colour fields in all 35 exhibit bays | verified-automated | run #114 PASS; revalidated through #238 |
| Phase 11 keyboard/touch/comfort regression suite | verified-automated | run #142 PASS; browser semantics revalidated through #238 |
| Semantic UI control isolation from global museum bindings | verified-automated | `tests/input-ui-guard.test.ts`; canonical + browser run #238 PASS |
| Phase 12 repeated traversal + persistent-environment budgets | verified-automated | run #142 PASS; canonical gate #238 PASS |
| Phase 13 automated 35/64/bespoke QA reporting | verified-automated | run #142 PASS; canonical gate #238 PASS |
| Human checklist protected from automated QA regeneration | verified-automated | `scripts/qa-report-runner.mjs`; canonical gate #238 PASS |
| Real production-build browser boot and keyboard semantic path | verified-automated-browser | run #238 browser job PASS |
| QA diagnostics + structured human-evidence recorder (`?qa=1`) | verified-automated-browser tool contract | run #238 browser job PASS; recorder/report behavior verified without human acceptance claims |
| Human evidence completeness verifier | verified-automated tool contract | deterministic release-tool tests in canonical run #238 PASS; no completed human record exists yet |
| Production dependency surface at high audit threshold | verified-automated | run #238 browser job PASS with `--omit=dev --audit-level=high` |
| Static release artifact integrity | verified-automated | `verify:dist` inside canonical run #238 PASS |
| Hosted verifier logic | verified-automated | release-tool tests inside canonical run #238 PASS |
| Static release headers/runbook/checklist prepared | verified-source + gate | `public/_headers`, release docs, canonical run #238 PASS |
| Durable human QA evidence structure | verified-source | checklist + `HUMAN_QA_EVIDENCE_TEMPLATE.md` + recorder output contract |
| Human visual/device QA | pending-human | no completed representative-device evidence record yet |
| Hosted production verification | pending-owner-action | no deployment authorized/performed; `verify:hosted` cannot run against a nonexistent production URL |
| Current release-readiness code/docs/tool batch | verified-automated | exact-head commit `034ef1e48400acca8632b4c8e2478d0663b30549`, run #238 gate + browser PASS |
| Automated QA cannot rewrite the governing human checklist | verified-automated | `scripts/qa-report-runner.mjs`; checklist byte-identical after `npm run qa` |
| Human-evidence completeness verification | verified-automated | `npm run verify:human-evidence` plus its deterministic tests |
| 14/14 source installation runtime paths | verified-automated-browser | `scripts/runtime-source-qa.mjs` against the offline canonical artifact; `validation/reports/RUNTIME_SOURCE_QA.md` |
| 17/17 authored visitor conversations | verified-automated-browser | same harness; every authored line spoken, re-entry proven |
| Dexter Sanctuary reachable on foot | verified-automated-browser | walked rotunda → ramp → sanctuary, descended to y=-5, focus acquired |
| Movement agrees with the camera at every yaw | verified-automated | `tests/accessibility.test.ts`, 8 cases + 16-step sweep |
| Semantic UI controls isolated from global actions AND installation capture | verified-automated | `tests/input-ui-guard.test.ts` |
| Installation/spatial parity matrix | verified-source | `Reliquary_Installation_Spatial_Matrix.md`, 14 rows, no unexplained row |
| Version B builder disposition | verified-source | same document section 4; every builder ported, repaired, or excluded with a reason |
| Installation persistence, quarantine and reset | verified-automated | `tests/source-installations.test.ts` |
| Visitor contract matches the CURATED authority | verified-automated | `tests/source-visitors.test.ts`, `validate:source-parity` |
| Historical 200-observation ledger | **missing historical evidence** | `Reliquary_200_Ledger_Recovery_Report.md` — unrecovered, not fabricated |
| Human visual/audio/pointer-lock/device FPS | pending-human | governed by the remote human-QA process; restoration automation must never auto-promote it |
| Eight collision/traversal repairs (r31) | verified-automated | local + CI `npm run gate`/`verify:standalone` PASS; exact-head run #243 PASS both jobs |
| Rotunda flight pad (r31, owner-directed new scope) | verified-automated | `tests/accessibility.test.ts` `rotunda flight pad (regression)`; local + CI gate/standalone/e2e PASS; exact-head run #243 PASS both jobs |

## 10. Current change scope

Phase-14 release-readiness only: protect the hand-maintained human QA contract from automated regeneration and add a deterministic completeness check for the eventual human evidence record without automating or inferring the human judgments themselves. Layout, collision, exhibit contracts/content, frozen mapping, streaming semantics, Sanctuary semantics and deployment state remain protected.

**r31 addendum:** eight collision/traversal defects repaired (see §2). One item of owner-directed new scope outside the frozen build plan: the rotunda centre plinth is now a walkable flight pad (see the invariant in §3). The 64/35 mapping, all 35 bespoke exhibit hero objects, the Sanctuary, and source-parity/visitor-conversation behaviour are untouched by either.

## 11. Compact revision log

- **r31 — 2026-08-23:** Audited the working tree against this file before continuing release-readiness work and found nine uncommitted, undocumented changes on top of the r30 head. Kept eight as genuine collision/traversal repairs (pointer-lock focus/rejection handling, diagonal-wall collision over-thickness, balcony-ring corner gap, Sanctuary-dais wall-vs-floor collider, north-wing bay wall poking through the floor above, grand-stair landings swinging into a neighbouring wing's lintel, balcony route cutting across the atrium void, and a traversal-walker step-budget blind spot) — see §2 for specifics. The ninth, a "flight pad" mechanic, was new invented scope with no basis in any governing document and in direct conflict with the frozen control/invariant contract, so it was held rather than folded in silently; the owner was asked how to proceed and explicitly directed keeping it, relocated onto the rotunda's central plinth (replacing its decorative armature) with a launch-then-free-flight behaviour, rather than its original stand-alone-pad location. Implemented exactly that, dropped an unrequested always-on double-jump that had been bundled into the same uncommitted diff, added three regression tests, and recorded the deliberate invariant exception in §3. Local `npm run gate`, `npm run verify:standalone`, the production dependency audit, and the local Playwright browser suite all PASS on the resulting exact head; pushed and confirmed GitHub Actions run #243 PASS in both jobs on that same exact head (`1b25224e2ebbe5dfc40af9b6996316e988e370f9`).
- **r30 — 2026-08-21:** Re-landed the Reliquary source-parity and runtime restoration on top of the remote human-QA release line (base `25cc3121e599ccf7ce535d8853501d81b659f0c4`) by cherry-pick rather than by merging stale history. Restored the fourteen source installations' governing behaviour (keyed state machines, forms corrected against the shared thesis contract, interpretive lecterns, collision, persistence with quarantine) and proved 14/14 installation runtime paths and 17/17 authored visitor conversations against the real production runtime in the offline canonical artifact. Adjudicated the spatial question on evidence: the two source authorities disagree on 14/14 old coordinates while agreeing on every semantic field, so coordinates are implementation detail and the shared semantics are preserved exactly; hall ordering is superseded by the frozen mapping, cited. Repaired three defects the runtime exercise exposed (movement mirrored about Z off-axis, an unreachable Dexter Sanctuary, a rotunda slab overhanging the ramp mouth). Deliberately reconciled the overlapping input work: the r28 semantic-control isolation contract is now the single gate for BOTH global bindings and the new raw installation code capture, so a panel control can never mutate an installation behind itself. The historical 200-observation ledger remains UNRECOVERED and was not fabricated.
- **r29 — 2026-08-20:** Continued Phase-14 readiness without publishing. Found and fixed an automated-QA authority bug where `npm run qa` rewrote the current human checklist from a stale embedded scaffold; the new runner preserves the hand-maintained checklist byte-for-byte. Added `verify:human-evidence` plus deterministic tests so an eventual human evidence record can be rejected for Pending/Needs-work checks, insufficient telemetry, or missing notes without pretending automation made the observations. Updated the runbook to require that completeness check before merge/publication consideration. Exact implementation head `034ef1e48400acca8632b4c8e2478d0663b30549` passed run #238 in both canonical and Chromium jobs. Human/device evidence and actual deployment remain pending.
- **r28 — 2026-08-20:** Continued Phase-14 readiness without publishing. Added session-only structured human QA evidence recording under `?qa=1`, a durable Markdown evidence template and closure rules; fixed semantic-control keyboard events leaking into global museum interact/jump actions and added dedicated regressions; reconciled the release checklist/runbook/PR around that evidence boundary. Browser run #214 exposed a harness focus-sequencing issue after report generation; the harness was corrected and exact-head `347e7f1b2eb18ada820d0d7af891597c81d0368e` passed run #224 in both canonical and Chromium jobs. Human/device evidence and actual deployment remain pending.
- **r27 — 2026-08-20:** Completed the previous bounded Phase-14 readiness passes without publishing: reconciled stale release/deployment evidence, added the opt-in diagnostics capture aid, and added deterministic hosted transport/header verification. Exact release-readiness head `740919bc70019318c7d6783a245c8b68712943a9` passed run #202 in both jobs.
- **r26 — 2026-08-20:** Prepared the initial Phase-14 release-readiness subphases: committed production-browser CI proof, `verify:dist` plus production-only dependency auditing, static release headers and the release runbook. Run #170 passed.
- **r25 — 2026-08-20:** Completed Phase 11 accessibility/input hardening, Phase 12 persistent-environment lifecycle/performance governance, and Phase 13 automated QA contract/reporting. Canonical run #142 PASS.
- **r24 — 2026-08-20:** Promoted the three-phase environmental expansion to automated-verified via canonical run #114.
- **r23 — 2026-08-20:** Implemented wing-specific authored furnishings, neutral-hub Rotunda wayfinding threads, and wing-derived interior colour fields for all 35 exhibit bays.
- **r22 — 2026-08-20:** Added non-colliding garden-facing facade identity; subsequently verified by run #104.
