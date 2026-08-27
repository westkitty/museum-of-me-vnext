# Museum Workshop hardening — checkpoint 3

## TodoCheckpointDraft

- Completed: live branch/source readback; exact CI failure adjudication; browser stop-order repair; shared conservation validator; runtime and save-bridge enforcement; focused fixtures; ordinary five-journey browser suite; two-placement authoring proof; standalone/offline verification; canonical gate; production dependency audit; append-only truth-spine reconciliation.
- Active slice: scoped Git closeout and exact-head CI verification.
- Pending: commit/push and the exact-head GitHub Actions result. Merge, main/release mutation, and external Bible update remain out of scope.
- Next step: inspect the final diff, stage only task-owned paths, commit, push the feature branch, and inspect the resulting exact-head workflow.

## Evidence

- Handoff branch/head: `feature/museum-workshop-core-2026-08-26` / `57abceb7b3d2d4e61667232ccdbd893342e5b81c`.
- Prior exact-head GitHub Actions run `33038039499`: first ordinary `?qa=1` test timed out at the telemetry-capture click while four later journeys passed; the render-loop stop was moved before semantic assertions.
- `npm run typecheck`: PASS.
- `npm test -- --run tests/workshop.test.ts`: PASS, 16 tests.
- `npm run test:e2e`: PASS, 5 Chromium journeys.
- `npm run test:workshop`: PASS; two authored placements saved through the real bridge, rebuilt into standalone output, and found in the real standalone scene; checked-in source restored to the empty manifest.
- `npm run build:standalone`: PASS; `npm run verify:standalone`: PASS, offline browser boot, 14/14 installations, 17/17 visitors, zero remote requests.
- `npm run gate`: PASS, 26 files / 565 tests plus validators, QA, build, budgets and release-dist checks.
- `npm audit --omit=dev --audit-level=high`: PASS, 0 vulnerabilities.
- Conservation diagnostics are structured with placement ID/label, protected area, rule and reason; invalid target bytes remain unchanged and valid writes use temporary-file plus atomic rename.

## DriftCheckDraft

- Scope: aligned; all implementation remains inside the owner-authorized Workshop, browser-harness and truth-spine boundary.
- Compatibility: safe prefab whitelist/schema and Museum structural authority are unchanged.
- New owner/fallback/branch: one conservation owner at `src/workshop/conservation.ts`; no fallback, duplicate geometry authority or new production write path.
- Truth records: active branch and current hardening status are reconciled; exact pushed head and CI result are intentionally not asserted until observed.
- Decision: continue to Git closeout and exact-head CI inspection.

## Risk / Unknown

The current local evidence is strong but exact-head CI remains unverified until push. Human visual/audio/pointer-lock/device-performance acceptance remains governed by the existing human-QA boundary and is not inferred from automation.
