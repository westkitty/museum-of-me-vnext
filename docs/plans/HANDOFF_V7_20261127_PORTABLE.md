# Handoff: Museum of Me world production, V7 (2026-11-27, portable)

This document is context, not authority. Every permission must come from the owner again in a new session. Branch and PR states are a **snapshot dated 2026-11-27**; verify them before acting.

## Identity (verify first)

| Item | Value |
|---|---|
| Repository | `westkitty/museum-of-me-vnext` |
| Branch | `feat/world-production-20261126`. Remote head at snapshot: `bf171e5` (portable V6 handoff). |
| PR | #83 → `main`. Open, unmerged; merges are **squash** only. |
| V7 | Pushed to the PR branch on 2026-11-27. The local checkpoint `refs/checkpoints/world-production-v7-final-candidate` holds the same tree, before the final docs; it exists only on the original machine. |

Check with `git rev-parse --show-toplevel`, `git remote -v`, `git branch --show-current` and `gh pr view 83`.

## Retrievability

- **Remotely retrievable:** the PR branch, including the V7 commit pushed at the owner's request on 2026-11-27 (`git log origin/feat/world-production-20261126`).
- **Local only:**
  - the V7 checkpoint refs `refs/checkpoints/world-production-v7-*`;
  - the governed performance trials' raw outputs (session scratch area; summaries are in `docs/evidence/world-production-20261126/v7/performance/`);
  - the 61 protected images and the local V6 handoff, both deliberately uncommitted.

## What V7 did

| Workstream | Result |
|---|---|
| B. W01 aim miss | CLOSED. The keyboard test walker overshot at full run on a slow host. Walker helpers repaired; W01 unchanged; regression test `tests/browser/w01-arrival-overshoot.e2e.ts`. |
| C. W09 pinch | CLOSED. Product softlock: the clock needed real displacement, and a stone that moves only with the clock pinned the visitor. A blocked movement intent now runs the clock at walking pace (`src/world/pocket/w09/createW09World.ts`). Tests: unit, plus `tests/browser/w09-cascade-pinch.e2e.ts`. **Owner acceptance of the rule change pending.** |
| D. Entrances on foot | All eleven worlds plus the W10 roof, from the pier. New: `tests/browser/helpers/museum-approach.ts` and `tests/browser/worlds-museum-approach.e2e.ts` (keyboard 5/5, touch 2/2). |
| E. Controls | Automated checks pass. Physical-device procedure: `docs/plans/WORLD_DEVICE_ACCEPTANCE_V7_20261127.md`. Devices NOT ATTEMPTED. |
| G. Dexter seam | `selectDexterCharacter` guards W10's character; `describeDexterAsset` reads a candidate. Identity gate closed; rig `TEST_ONLY_NOT_APPROVED_DEXTER`. |
| H. Long session | `tests/browser/worlds-long-session.e2e.ts` 1/1; resources flat across two passes over six worlds. |
| I. Distribution | Ordinary build 12.58 MB of 20 MB (unchanged); release dist PASS. Rehearsal offline package 25.9 MB; rehearsal initial transfer 749 KB, with worlds lazy. |
| J. Recovery | Rehearsal suite (network abort and interrupted download through the real dialog) plus the long session. **Defect fixed:** Esc during "Opening…" was ignored once focus left the disabled Enter button. Focus now waits on Back (`src/ui/PocketTransition.ts`); test `tests/browser/worlds-entry-cancel.e2e.ts`. |
| A. Performance | FAILED, attribution unresolved. The final candidate ran three admissible-start trials on a frozen tree: 8/12, 10/12 and 9/12. The misses were p99s at 33 ms (two 60 Hz frames) and second-entry worst frames of 83 and 233 ms. Peak host load during those trials was 15–35, against 5 during baseline-1, which passed 12/12 on effectively the same measured code. A matched A/B on a quiet machine is the owner's call. See `docs/evidence/world-production-20261126/v7/performance/TRIALS.md`. |
| Qualification | Gate PASS (153 / 1,462). World 83/87 on the first full run. All four failures were diagnosed and pass on rerun: two were the touch test walker on moving supports (W03 gear, W08 pad; fixed), one an unexplained intermittent W09 time-dial aim miss, and one a product defect (Esc during "Opening…" was ignored; fixed, with a new regression test). Rehearsal 5/5 with Metal; a first run without Metal was invalid (0/5). The failed-load test was re-run on the final tree, 1/1. Isolation PASS. Standard 67/67 before an owner-directed stop. Workshop and standalone not re-run. |

Full report: `docs/evidence/world-production-20261126/v7/REPORT.md`. The ledger, owner review, completion matrix and `OPERATIONAL_STATE.md` (revision 139) all have V7 sections.

## Running things

Set `MUSEUM_BROWSER_EXECUTABLE` to the installed Google Chrome binary. For the world suite, also set `MUSEUM_WORLDS_GL=metal`.

| Suite | Command |
|---|---|
| Gate | `npm run gate` |
| Worlds | `npx playwright test -c playwright.worlds.config.ts` |
| Standard | `npx playwright test` |
| Rehearsal | `npx playwright test -c playwright.rehearsal.config.ts` |
| Performance | `env MUSEUM_PERF_HEADLESS=1 npm run perf:device`, governed by `docs/evidence/world-production-20261126/v7/performance/PROTOCOL.md` |

**Rules for running:**
- Run one expensive suite at a time.
- Freeze the tree during a perf series: a test file edited mid-series broke two V7 builds.
- Never kill processes you did not start.

## Preserve

- The 61 re-captured historical evidence images under `docs/evidence/exterior-omni-v2` and `docs/evidence/island-02*` stay uncommitted and untouched. Tests that used to overwrite them now write to `test-results/doc-evidence/` unless `MUSEUM_REFRESH_DOC_EVIDENCE=1` is set.
- The local V6 handoff `docs/plans/HANDOFF_V6_20261127.md`, untracked.
- The original W01 checkout, the older island and W02 worktrees, and the Bible clone.

## Open for the owner

1. Accept or revert the W09 rule change.
2. Physical-device acceptance.
3. Performance sign-off.
4. Per-world visual and audio acceptance.
5. A Dexter model.
6. Budget definition A or B.
7. Whether the interior chunk becomes lazy.
8. Appending the V7 Bible entry (V7 itself is on PR #83).
9. Merging PR #83.

Never implied: merge, deploy, production world activation, threshold or budget changes, W01 audio master changes, paid or external services, Dexter's likeness, destructive cleanup, force-push.
