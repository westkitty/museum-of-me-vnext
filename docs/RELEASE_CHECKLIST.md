# Museum of Me — Pre-1.0 Development and Acceptance Gate

**Controlling status (October 12, 2026): ACTIVE DEVELOPMENT / PRE-1.0.** A green implementation is not a release declaration. The authoritative code is GitHub `main` at `4a464ebd5c6d09265e559b7b1299f025c399aa56`. Its GitHub Actions run [38310708395](https://github.com/westkitty/museum-of-me-vnext/actions/runs/38310708395) passed all four jobs: `gate`, `browser`, `standalone`, and `workshop`. The automated contract covers **73 project identities, 35 bespoke physical exhibits, six wings, 14 source installations, and 17 authored visitors**.

**Hosted state:** The public GitHub Pages preview still serves `pages-preview` SHA `e6b0a5f63ae37a9ef0d915f7bec6d9567206aa89`, not the green `main` build. Advancing it is a separate owner-controlled publication action. Human visual/device acceptance is pending.

**Historical milestone note:** The earlier `release/v1.0.0` branch and PR #1 title reflected a subsequently rejected 1.0 interpretation. PR #1 merged into `main` on September 3, 2026; it is not an open release blocker. PR #3 and its test receipts remain historical engineering evidence, not current release authority. The underlying §39 acceptance categories below remain useful, but must be evaluated against current source and the human evidence record.

## Architecture

| Item | State | Evidence |
|---|---|---|
| No inaccessible intended public space | ✅ | `tests/traversal.test.ts` walks entrance → every wing → upper floor → Sanctuary → entrance against real collision, plus into and out of all 35 bays. |
| No collision holes | ✅ | The same harness fails on floor holes and route discontinuities. |
| No unintended traps | ✅ | The same harness requires measurable progress through the mandatory visitor route. |
| Exterior-to-interior continuity | ✅ | Spawn is on the Arrival Plaza, the garden path remains non-colliding, and automated traversal reaches the complete building without teleporting. |

## Exhibits

| Item | State | Evidence |
|---|---|---|
| 35 / 35 visitor-facing exhibits pass | ✅ | `tests/exhibit-quality.test.ts` exercises physical presence, bay fit, controls, interpretation, reduced-motion behavior, reset, streaming cycles, and ownership boundaries. |
| 73 / 73 current project identities mapped | ✅ | `npm run validate:mapping` requires each current project identity to be represented exactly once across 35 stable exhibits; the older 64-identity inventory remains historical. |
| 35 / 35 bespoke implementations | ✅ | `npm run validate:exhibits`. |
| Whole-museum automated QA report | ✅ | Exact-head CI validates 35 exhibits, 73 project identities and 35 bespoke implementations; this does not replace human visual acceptance. |

## Assets and privacy

| Item | State | Evidence |
|---|---|---|
| No missing governed runtime assets | ✅ automated contract | `AssetManager.load` refuses unknown IDs and `npm run validate:assets` validates provenance/budgets; current candidate includes governed local Quaternius GLBs and the deferred local Full Weasel artifact. |
| No unnecessary runtime hotlinks | ✅ automated contract | Current local assets are provenance-governed and standalone verification records zero remote requests; the CSP forbids outbound connections. |
| No secrets/private operational data | ✅ | `npm run validate:privacy` scans public content and exhibit source for credential/private-data signatures. |
| Production artifact secret-file denylist | ✅ | `npm run verify:dist` rejects secret-like files in `dist/`. |

## Accessibility and input

| Item | State | Evidence |
|---|---|---|
| Requested keyboard movement grammar | ✅ | W/Up forward, S/Down back, A/Left left, D/Right right; Q/E turn; Page Up/Page Down vertical look; Shift sprint; Space grounded one-shot jump; F/Enter interact. Unit/regression tests plus Chromium visitor-path gate. |
| Complete keyboard-accessible collection | ✅ | The DOM mirror exposes all exhibit interpretation without requiring pointer lock; Chromium gate verifies representative access including Starsilk Universe and BigMac Backbone. |
| Map and modal keyboard semantics | ✅ | SVG bays are keyboard activatable; rebuilt map content restores dialog focus so Escape/focus trapping continue to work. Browser regression covered. |
| Semantic-control input isolation | ✅ | `InputManager` leaves Enter/Space/etc. to native controls and custom `role="button"` surfaces instead of leaking those keys into global museum interact/jump actions. `tests/input-ui-guard.test.ts` protects native controls, SVG/custom buttons, and the ordinary canvas/global path. |
| Reduced motion / high contrast / interface scaling | ✅ | Preference contracts are covered by regression tests; the Chromium gate exercises explicit reduced motion in the production build. |
| Touch path | ✅ automated contract | Touch movement/look/interact fallbacks remain under the accessibility suite. A physical touch-device feel check is still optional human evidence. |

## Runtime and lifecycle

| Item | State | Evidence |
|---|---|---|
| No uncaught core-path exceptions | ✅ | Canonical tests plus production Chromium visitor-path checks fail on page/console errors. |
| Load/unload lifecycle stable | ✅ | Repeated traversal/lifecycle tests require bounded residency and balanced disposal. |
| Persistent environment bounded | ✅ | Always-resident refinement systems are measured by explicit mesh/triangle/material/light/resource budgets and dispose to zero tracked resources. |
| Quality tiers work | ✅ | Auto-detection, settings override, DPR limits, shadow/crowd reductions, and budget contracts are covered. |
| Real production-browser boot + semantic visitor path | ✅ automated contract | Exact-head GitHub Actions run #38310708395 passed 16/16 Chromium browser scenarios on current `main`; human representative-device behavior remains separate. |
| Museum Workshop authoring path | ✅ automated contract | Pull-request workflow run #321 passed the dedicated development-only Workshop job after correcting a stale test assertion so X/Z edits explicitly preserve the registered shrub's original Y. Runtime authoring behavior was not weakened. |
| Offline standalone path | ✅ automated contract | Pull-request workflow run #321 passed the fresh standalone build and offline verification on the integrated feature head. |
| Human QA evidence recorder | ✅ automated tool contract | `?qa=1` exposes read-only diagnostics plus a session-only manual recorder for Pass/Needs work judgments, telemetry snapshots, notes, and Markdown report generation. Browser CI proves the tool operates; it does not satisfy the human judgments it records. |
| Production dependency surface | ✅ automated contract | The browser job runs `npm audit --omit=dev --audit-level=high`. Development-tool audit findings are not represented as deployed dependency findings; the exact release head must pass this job before publication. |
| Audio muted by default | 🟨 human check required | Sound controls begin at zero; a real browser/device must confirm deliberate opt-in playback and subtitle agreement. |
| Pointer-lock capture/look/release/recapture feel | 🟨 human check required | Runtime implementation is present; actual device capture, Escape/loss recovery and recapture remain a human acceptance check. |
| Representative-device FPS | 🟨 human check required | Draw-call/light/residency/lifecycle/bundle budgets are automated. CI software rendering is not representative hardware performance. |

## Production artifact

| Item | State | Evidence |
|---|---|---|
| Production build succeeds | ✅ | `npm run build` inside the canonical gate. |
| Hashed JS/CSS and multiple production chunks | ✅ | `npm run verify:dist`. |
| Static security/cache policy emitted | ✅ source + build | `public/_headers` is copied into `dist/_headers`; `verify:dist` requires the CSP, frame denial, `nosniff`, and immutable hashed-asset caching. |
| Hosted transport/header verification prepared | ✅ tool contract | `npm run verify:hosted -- <url>` checks the live shell, security/cache headers and same-origin hashed assets after an authorized deployment; its deterministic tests run inside the canonical gate. |
| Release runbook prepared | ✅ | `docs/RELEASE_RUNBOOK.md`. |
| Durable human QA evidence structure | ✅ source | `validation/reports/HUMAN_QA_CHECKLIST.md` defines the decisive route and `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md` defines the durable record. The in-museum recorder can generate the same kind of Markdown evidence. |
| Human visual/device QA | ⬜ | No completed representative-device evidence record exists yet. Automated/headless evidence cannot promote these perceptual/device checks. |
| Current `main` hosted verification | ⬜ | A previous public GitHub Pages preview is live at `e6b0a5f`; new `main` at `4a464eb` has not been deployed or verified as hosted. |

## Git state — authoritative 2026-10-12 snapshot

| Branch | Role |
|---|---|
| `main` | Current 73-project development implementation, `4a464eb`; exact-head GitHub Actions 4/4 green. |
| `pages-preview` | Existing public GitHub Pages preview, `e6b0a5f` (57 commits behind `main` at this snapshot). It does not auto-follow `main`. |
| `release/v1.0.0` | Historical, incorrectly named development/release line, not an accepted 1.0 milestone. |
| `feat/foundation` and `feature/museum-workshop-core-2026-08-26` | Historical implementation lineage, not active publication candidates. |

PR #1 **merged on September 3, 2026**; no open-PR merge step is required for the present `main`. Commit names and branch labels do not override owner-confirmed **PRE-1.0** status.

## Remaining acceptance actions

1. Preserve passing exact-head CI for the current candidate. The October 12 run `38310708395` already passed all four automated jobs.
2. Perform the private real-device visitor walkthrough using `validation/reports/HUMAN_QA_CHECKLIST.md`; record the nine human acceptance judgments and at least six location-specific telemetry snapshots, plus audio, pointer-lock and visual observations.
3. Preserve the completed recorder Markdown and screen capture, then run `npm run verify:human-evidence -- <completed-human-qa.md>`. Pending or Needs-work observations are not automatic passes.
4. Repair confirmed human-facing defects only; rerun the affected checks and all exact-head CI jobs after any implementation changes.
5. Explicitly decide whether to promote the reviewed code to the *existing public preview* (`pages-preview` or manual Pages dispatch). Verify the deployed revision and rendered experience; a green `main` push alone never deploys it.
6. Make any future 1.0 declaration and tag only after separate owner acceptance. Do **not** infer `v1.0.0` from this checklist, earlier PR titles, or historical branch names.
