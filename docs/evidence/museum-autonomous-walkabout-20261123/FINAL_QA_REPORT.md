# Great Museum Walkabout QA · 2026-11-23

**PARTIAL** · Physical routes, offline interactions, and the three implemented repairs have supporting evidence. The representative M1 budget did not pass, and one presentation finding remains open.

## Candidate

Independent clone on `feat/museum-autonomous-walkabout-20261123`, based on `ff6d983ebe47c0d4dc7980a9632f89925cb3f0d4`. The candidate is local and uncommitted. Four defects were recorded, one P1 and three P2. Three are addressed. E20's foreground plinth still obscures part of the workbench from the standard visitor spot. Cast focus and Cinema support have independent regressions and candidate browser evidence. The ledger describes exact reproduction, repair and proof.

## Acceptance matrix

| Scope | Evidence |
|---|---|
| Authored population | 17 role-specific procedural kits, one body batch, one contact-shadow batch. Source parity preserves 17 roles, 51 lines and 34 thoughts. The reduced-motion cold-entry raycast can focus all 17. |
| Collection and circulation | The baseline and candidate continuous grand tours cover 303 simulated legs across 2,179 metres with all 35 bays, kiosk F, entry, Sanctuary, exit and re-entry. Baseline and final candidate both passed 64 passages and 190 bidirectional lanes, including all 35 exhibit spots and all Cinema passages. The first candidate run was interrupted by a Vite reload. The stable retry completed the full passage and continuous tour checks on the final source. |
| Cinema and adjacent routes | Matched balcony frames and a fresh reverse view show a clean floor seam. The support regression and Chrome playback, exit, touch seating, step-free viewing and reduced-motion tests passed. The reduced-motion test passed on the isolated retry after a dev-server reload interrupted the first run. |
| Live visitor path | 42 active-loop legs completed a normal ticketed spawn → Atrium → Rotunda → exit → re-entry visit without diagnostic repositioning. Separately, 70 active-loop hall-to-bay and return legs passed for all 35 bays. Those individual probes had hall-side starting fixtures. Both runs recorded zero browser errors. A separate supported approach probe used genuine F input on one local control in each of the 35 bays and read back all 35 Journal entries. E27 and E31 needed detours around the plinth. |
| Island and rooftop | Chrome keyboard probes passed all 18 defined landmarks in low and high quality. Four mobile-portrait touch approaches passed. Rooftop approach, greenhouse, café, Hot Dog Man and Flight Pad II covered by the rooftop browser check. |
| Flight Pad I | The active browser loop took off from the existing pad, steered into the dome collision limit and landed safely back on the Rotunda floor. The capsule top stayed below the dome apex. The forensic collision suite also covers the balcony slab from below and at its edge. |
| Lifecycle and input | Quality switches, streamed artwork lifecycle, developer/ordinary flight gating, ticket gating, reduced-motion visitor focus and mobile Cinema controls exercised. Physical input feel requires owner review. |
| Adversarial pass | Reversed the Cinema viewing direction, approached from both sides, exercised a fresh save and reduced-motion visitor targeting, switched quality, and returned through the entry seam. No remaining P0/P1 defect was reproduced in the measured scope. |
| Technical checks | Canonical gate reported 133 files and 1,345 tests, lint, typecheck, validators, production build, 16.39 MB of 20 MB and release-dist verification. The last narrow Cinema visual adjustment was checked separately with 76 focused passing tests. |
| Standalone | Build and static fingerprint passed. SwiftShader timed out at boot or readiness. With Chrome on Metal the same offline suite passed two round trips, 14/14 installations, 17/17 focused and activated conversations and zero remote requests. |
| Representative device | Apple M1 Chrome/Metal ran all three device measurement cases on each revision. The candidate missed six budgets and all six also failed on the clean baseline. Steady interior p95 passed at 18.5 ms. The first-entry performance fixture did not enter the interior, so its preparation timing is classified separately from the successful live ticketed transition. |
| Owner review | Human art/accessibility review and sourced-model approval remain open. Product maturity remains active pre-1.0. |

## Evidence inventory

- [Baseline](BASELINE.md), [defects](DEFECT_LEDGER.md), [cast ledger](VISITOR_VISUAL_LEDGER.md), [performance](PERFORMANCE_REPORT.md)
- `test-results/walkabout/before-live/`, `before-matched/`, `cinema-before/`, `cinema-final/`, and `final-visuals/` contain individual PNGs and capture manifests.
- Browser logs live in `test-results/walkabout/browser/` and `test-results/walkabout/final/`. Raw route traces live in `test-results/traversal/` and the baseline copies in `test-results/walkabout/before-live/`. [The route and interaction manifest](WALKTHROUGH_MANIFEST.json) indexes the separate evidence runs.

The candidate changes Cinema architecture and the cast implementation only. W01, the pocket host, registry, passport, music transport, assets, renderer, and release surfaces received no edits. No GitHub or Bible publishing action occurred.


## Final change inventory

- `src/world/SourceVisitors.ts` and `src/world/VisitorVisuals.ts` own the cast changes.
- `src/world/Cinema.ts` owns the Cinema threshold correction.
- `tests/cinema.test.ts` and `tests/visitor-visuals.test.ts` add the focused regression checks.
- `validation/reports/runtime-source-qa.json` is the generated readback of all tested offline installation and visitor paths.
- `OPERATIONAL_STATE.md` and `docs/COMPLETION_MATRIX.md` carry append-only continuity. This evidence directory contains the baseline, defect and cast ledgers, route manifest, performance comparison, this QA receipt, and an append-ready Bible entry.
- Git HEAD remains the baseline commit. All candidate changes are unstaged in the isolated branch.
