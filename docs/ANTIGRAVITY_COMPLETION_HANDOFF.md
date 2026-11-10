# Museum of Me — Antigravity IDE completion handoff (after Fable passes 1–2)

This is an implementation handoff, not a declaration of release readiness.

## Identity and starting state

Implementation repo: westkitty/museum-of-me-vnext
Existing MacBook local checkout: /Users/andrew/museum of me/museum-of-me-vnext
Existing local feature branch: feat/completion-guide-and-drift-20261109
Fable base and merge base: a96d2f74bc2057d25a6cc324c4f79a4588144a16
Fable pass-2 HEAD: 9ce00a5a211b0c37ebefd566ef6228e3e7167a9b
Seven Fable commits, oldest first: 67e4934, 5faffdc, 69fe4a3, a98f01f, 3fa2af8, 8c77775, 9ce00a5.

These commits were independently observed in the clean local MacBook checkout. No GitHub feature branch existed at the last remote check. Never replay the Fable patch ZIP in that checkout. Verify state afresh. A documentation-only branch, handoff/antigravity-20261109-9ce00a5, contains this handoff and AGENTS.md as a separate commit from a96d2f7; cherry-pick that commit into the real local feature branch only after checking identity and worktree cleanliness. Do not merge main or treat the documentation-only branch as the Fable implementation.

Canonical Bible: westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md; append-only. ChatGPT already wrote evidence-bounded continuity receipts on 2026-11-09; the repository's older docs/MUSEUM_BIBLE_APPEND_2026-11-09_COMPLETION_PASS_1.md should not be blindly appended again. The source and runtime remain authoritative for current capabilities.

Read: AGENTS.md, OPERATIONAL_STATE.md (revision 94 before this prep), docs/COMPLETION_MATRIX.md, docs/EXHIBIT_CONTRACT.md, architecture.project.json, then only sources directly relevant to the next exhibit slice.

## Model selection

Prefer Gemini 3.8 Flash in Google Antigravity IDE. Choose the deepest option visibly supported for Flash: Google's published November 2026 menu shows Medium and Fast, not a verified Flash High option. Choose Medium unless High is actually offered. Gemini 4 Argon High is a possible opt-in fallback for a proven complex reasoning blocker only when available with the user's plan and in the IDE; do not consume Argon on routine tests or file edits. No external paid service or API key.

Reference: https://antigravity.google/docs/models/
Rules: https://antigravity.google/docs/rules/

## Completed Fable changes — preserve

Pass 1: fixed two obsolete present-tense 64-project visitor claims to reflect 73 projects; count validator hardened to allow explicitly historical totals; deterministic DexGPT guide now resolves natural visitor questions, subjects, project/wing/status, current exhibit, Rotunda and stairs; guide panel has seven example questions; completion matrix created.

Pass 2: moved source installations out of existing exhibit furniture into front corners of 13 host bays (Sanctuary unchanged); introduced fitting for long label captions; repaired E17 Voice Lab output visibility, represented projects and layout; repaired E34 BigMac Backbone consoles, receipt board, captions and all seven represented project names; documented Sanctuary wayfinding as a proposal only.

Keep all 35 exhibit slots, 73 identities, six wings, source paths and established interaction logic. Do not equate source-level completion with owner visual acceptance.

## Reported verification evidence

The packaged Fable final-run logs state:
- npm run gate PASS with 775/775 tests across 59 files plus validators/build/budgets.
- npm run build:standalone PASS.
- npm run verify:standalone PASS for 14/14 source installations, 17/17 authored visitors, zero required remote requests.
- npm run test:workshop PASS.
- VITE_PUBLIC_BASE=/museum-of-me-vnext/ npm run build:pages PASS.
- npm run verify:pages-dist PASS.
- npm run test:e2e PASS with 53/53 cases in installed Chrome, around 25 minutes.

These ran on the final source working tree before last pass-2 commits; typecheck and unit tests were reportedly rechecked at 9ce00a5. Exact-head GitHub CI, mobile/hardware/audio/pointer-lock QA and owner acceptance remain UNVERIFIED. E17/E34 browser screenshots were not saved. Do not fabricate visual proof.

System Chrome path at extraction: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
Environment variable: MUSEUM_BROWSER_EXECUTABLE
The browser suite uses port 4173. Avoid parallel runs or editing source while e2e is running. Workshop writes an ignored release/ output; a standalone rebuild may be needed. E2e may change an evidence manifest's createdAt; restore only confirmed test artifacts after inspecting Git status.

## First implementation slice — fix verified leads, not write another plan

Fable measured exhibit parts intersecting the 2.6m central host plinth (1.3m half-extent X/Z, 0.9m height) in E02, E07, E08, E11. Those are measured source leads; actual browser obstruction remains to inspect.

1. Verify exact local identity and protect the seven Fable commits. Ensure only the expected documentation-only commit was cherry-picked; preserve unrelated changes.
2. Inspect docs/COMPLETION_MATRIX.md and the specific four exhibit implementations, their placement, installation seating and collision geometry.
3. Open each bay in real Chrome if available. Identify exactly which part overlaps/occludes the plinth and how it affects the visitor. Capture four separate named before screenshots; if browser unavailable, label visuals UNVERIFIED.
4. Correct minimum exhibit geometry/label defects, preserving physical plinth, collider, source installation and visitor paths. Do not rearchitect the wing, alter permanent structures or add features.
5. Re-measure all four; add or extend assertions to catch plinth and newly seated installation intersections. Capture separate after screenshots and exercise actual interaction when available.
6. Run focused typecheck/lint/tests, then npm run gate, npm run verify:standalone and the appropriate full Chrome browser suite ONCE after stabilizing the geometry. Record actual results with stdout/log evidence.
7. Inspect entire diff; update docs/COMPLETION_MATRIX.md and OPERATIONAL_STATE.md honestly. Commit locally only when authorized, not remotely.
8. If quota permits, next browser-review E20 and E35. Other lead exhibits not browser reviewed: E02, E11, E14, E15, E16, E20, E23, E26, E35. Leads are not established failures.

Stop after one completed, verified cohesive slice or one bounded repair cycle with an unresolved failure. Avoid endless planning, new models, external packages and redundant reruns.

## Owner gates remain outstanding

Visual acceptance of the front-corner placement for 13 installations; nine human judgments and at least six representative-device QA telemetry snapshots; possible long-caption readability reductions; Sanctuary floor-line guide routing proposal; exact-head CI; historical exterior draft PRs and main branch protection. Do not claim 1.0 complete or merge/deploy without owner approval.

Return a concise report: current branch/HEAD, observed defects per bay and evidence files, edited files, regression coverage, commands/results, local commit if any, unresolved decisions and next specific task. Always distinguish implemented / static test / browser / device / human acceptance.
