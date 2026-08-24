# Release Gate

The plan's §39 gate, checked against the current `release/v1.0.0` release candidate. Automated evidence and human/device evidence are deliberately kept separate.

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
| 64 / 64 project mappings pass | ✅ | `npm run validate:mapping` requires every project identity to be represented exactly once through the frozen 35-exhibit mapping. |
| 35 / 35 bespoke implementations | ✅ | `npm run validate:exhibits`. |
| Whole-museum QA report is complete | ✅ | `npm run qa` reports 35 exhibits, 64 project identities, 35 bespoke implementations, and requires the whole-museum guard suites. |

## Assets and privacy

| Item | State | Evidence |
|---|---|---|
| No missing governed runtime assets | ✅ | Procedural assets are manifest-governed; `AssetManager.load` refuses unknown IDs and `npm run validate:assets` validates provenance/budgets. |
| No runtime hotlinks | ✅ | Current release content is same-origin/procedural and the CSP forbids outbound connections. |
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
| Real production-browser boot + semantic visitor path | ✅ automated contract | The committed Chromium suite boots the production WebGL app, proves keyboard input reaches the real controller, exercises map/focus/reduced-motion behavior, and reaches the complete accessible collection. The exact release head must have its browser job green before publication. |
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
| Hosted production verification | ⬜ | No production deployment has been authorized or performed. |

## Git state

| Branch | Role |
|---|---|
| `main` | remote default branch and PR #1 base; intentionally not treated as the current implementation baseline before merge. |
| `feat/foundation` | historical implementation lineage. |
| `release/v1.0.0` | current release branch and PR #1 head. |

PR #1 remains open from `release/v1.0.0` to `main`. No merge, auto-merge, release tag, or publication is implied by a green automated gate.

## Remaining actions, exactly

1. Complete the representative-device pass in `validation/reports/HUMAN_QA_CHECKLIST.md` and preserve a completed Markdown evidence record using the in-museum `?qa=1` recorder or `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md`. No acceptance item may remain accidentally Pending.
2. Repair only concrete **Needs work** observations from that pass, then rerun the exact-head automated gates if code changes.
3. Make an explicit owner decision to merge PR #1 and authorize the prepared hosting destination/publication.
4. Deploy the resulting reviewed `main` commit, run `npm run verify:hosted -- <production-url>`, and verify the real browser/device path.
5. Tag the verified deployed commit as `v1.0.0`; do not tag a known-bad or merely pre-deploy commit.
