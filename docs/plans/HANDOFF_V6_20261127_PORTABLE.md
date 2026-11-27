# Handoff: Museum of Me, World Production V6 (portable)

This is a repository-safe handoff for picking up the V6 world-production campaign in a new session or on another machine. It is context, not authority: every permission listed below must be granted again by the owner in the new session.

Paths are relative to the repository root unless marked as placeholders:
- `<museum-root>`: the local folder that holds the main checkout and its `worktrees/` folder.
- `<bible-clone>`: a local clone of the Bible repository.

---

## Snapshot: branch and PR state as of 2026-11-27

This section is a dated snapshot. Re-check before acting (`git fetch`, `gh pr view 83`).

| Item | Value at snapshot |
|---|---|
| Repository | `westkitty/museum-of-me-vnext` |
| Branch | `feat/world-production-20261126`, local and `origin` both at `6f5126b` before this document was committed |
| Pull request | westkitty/museum-of-me-vnext#83 → `main` |
| PR status | Open, not a draft, mergeable. 7 CI checks reported SUCCESS: gate, browser ×3 shards, browser, workshop, standalone |
| Merge | Not merged. It must be squash-merged by the owner |
| Base | Merge base with `origin/main` is `ff6d983` |

## What can be fetched and what cannot

**From the remote** (anyone can `git fetch origin`):
- branch `feat/world-production-20261126`;
- its commits `8d77457`, `8e3c9c4`, `c25941c`, `3b59e96`, `a24ecda`, `6f5126b`, and this handoff's commit;
- PR #83.

**Only in the original working machine's clone.** These were never pushed, and `origin` has no `refs/checkpoints/*` at all:

| Local checkpoint ref | Commit | Note |
|---|---|---|
| `refs/checkpoints/world-production-v6-final-local` | `5375f84` | Same `src/`, `tests/` and `scripts/` content as remote `6f5126b`. The remote commit replaces it |
| `refs/checkpoints/world-production-v6-latest` | `5375f84` | Same as above |
| `…-v6-candidate`, `…-construction-split-1`, `…-construction-split-2`, `…-construction-telemetry`, `…-takeover-preserved`, `…-touch-w02-w06`, `…-touch-11`, `…-sessions`, `…-rehearsal-finishing` | various | Intermediate states. Their code differs from the final commit. They are history only and not needed to continue |

On a fresh clone, treat the checkpoint SHAs as unavailable. Everything needed to continue is on the remote branch.

## Protected, never touch without owner instruction

- **The main checkout** (`<museum-root>/museum-of-me-vnext`). It is on `feat/w01-great-ocean-procession`, the original W01 work.
- **The older island and W02 worktrees** under `<museum-root>/worktrees/`. These include `wt-island-02c`, `wt-island-02d`, `wt-island-03`, `wt-island-04`, `wt-island-05` and `wt-lagoon-safety`, as well as the W02 worktrees.
- **The Bible repository** (`westkitty/ChatGPT_Bible_Repo`, file `bibles/Museum_of_Me_Bible.md`). It is append-only. Never overwrite it, rebase it or force-push it.

**Owner rules:**
- The owner designs all content. Never invent secrets, exhibit text, places or Dexter's likeness; ask first.
- Merges to `main` are **squash** merges. Never bring branch commits in through a merge commit.

## What the branch contains

`git log origin/main..feat/world-production-20261126`, oldest first:

1. **`8d77457`, `8e3c9c4`, `c25941c`, `3b59e96`** (from `feat/visual-finishing-20261125`, which has no PR of its own):
   - visitors: authored cast visuals, baked geometry, E19/E20 repairs;
   - the ten-round visual finishing pass, the exposure contract, and the refreshed Linux baseline.
2. **`a24ecda` feat(worlds):** eleven pocket worlds with production activation, rehearsals and V6 hardening. 149 files.
3. **`6f5126b` docs(worlds):** world-production evidence, ledger and V6 continuity. 314 files, about 61 MB, mostly screenshots.
4. **This portable handoff.**

**Deliberately not committed** in the original worktree:
- 61 re-captured pre-existing evidence images under:
  - `docs/evidence/exterior-omni-v2`
  - `docs/evidence/island-02a-lighthouse-20261122`
  - `docs/evidence/island-02b-observatory-20261122`
  - `docs/evidence/island-02c-rootbound-20261122`
  - `docs/evidence/island-02d-distant-islands-20261122`
- A machine-specific copy of this handoff, kept local only.

Whether to commit or discard the images is the owner's decision.

## What V6 did, by workstream

### A. Interior construction performance (**acceptance NOT MET**)

- **Cause.** Interior construction ran as a few long main-thread tasks during the first ~1.4 s of the governing exterior walk.
- **Fix.** `src/util/buildSteps.ts` (`BuildSteps`, `runStepsSync`, `runStepsCooperatively`):
  - Builders became generators. Each `yield` is a safe boundary where scene graph and collision are consistent.
  - Builders converted: rotunda, entrance, cinema, zone detailing, sanctuary, source visitors, supplementary cases, and static-merge cloning (every 32 clones).
  - The output and the build order are unchanged.
- **Matched A/B.** Walk p99 went from 33–50 ms (V5) to **16.8 ms (V6) in 5/5 pairs**.
- **Full `perf:device`** (12 hard budgets in `tests/perf/budgets.json`, checker unchanged; headless installed Chrome on an Apple Silicon M1 development machine):
  - One clean run: 12/12.
  - The four final runs on the exact candidate: **4, 5, 6, 6 of 12**, with the 1-minute load average up to 32 from unrelated system processes.
  - In a matched control, the build that once passed 12/12 failed just as badly. The cause is attributed to the machine, but **repeated-trial acceptance is still not met.**
- **Watch item.** `second-entry-worst-frame` sits exactly at its 50 ms limit even when the run passes.
- **Evidence:**
  - `docs/evidence/world-production-20261126/v6-performance/REPORT.md`
  - `docs/evidence/world-production-20261126/v6-validation/ab-regress.txt`
  - `docs/evidence/world-production-20261126/v6-validation/perf-final-summary.txt`

### B. Touch journeys: 11/11 (browser emulation only)

- Evidence is in `docs/evidence/world-production-20261126/v6-touch/`.
- Physical-device touch is **UNVERIFIED**.

### C. Authentic visitor and long sessions: passed, with caveats

- Seven ground entrances are reached on foot from the pier. Interior and rooftop entrances still use labelled diagnostic placement.
- Cross-world earned progression W09 → W10 → L01 ×2 passes by keyboard and by touch:
  - no stamp inflation;
  - resources and music return flat;
  - the persistent passport is untouched.
- Early exits work across four worlds.
- Evidence: `docs/evidence/world-production-20261126/v6-sessions/`.
- **Unresolved:**
  - **W01 aim miss.** It passed on rerun. A 5.8 m displacement is still unexplained.
  - **W09 cascade pinch.** The visitor stalled at (-3.65, -33.8), the meteor/rail pinch. `crossCascade` in `tests/browser/helpers/routes.ts` adds step-back retries. The passing rerun never reached the pinch, so the retry is **unexercised**.

### D. Production distribution

- **Diagnostic tool:** `scripts/analyze-distribution.mjs`.
- **Builder-catalog pruning.** The `museum-builder-catalog-prune` plugin in `vite.config.ts` uses `scripts/builder-asset-prune.mjs` (tests 3/3). It drops builder-catalog files the placement manifest doesn't reference. Checker-counted size went **17.54 → 12.58 MB**; the 20 MB rule is unchanged.
- **Budget options:** with all eleven worlds active the total is about 15.7 MB. Option A (keep the current definition) and Option B (count world chunks as deferred) are the owner's decision.
- **Ordinary-build guard.** `scripts/verify-release-dist.mjs` (`verify:dist`) now rejects world chunks, orphan stems and rehearsal code in ordinary builds. Test: `scripts/release-dist-worlds.test.mjs`, 4/4.
- **Rehearsals: 5/5.** They cover staged prefixes, earned progression in the production build, failed and interrupted loads, and the activated offline package. They use isolated storage and never touch the owner's passport.
- **Real defect fixed** in `src/ui/PocketTransition.ts`. After a failed world download, focus fell to the page, so Esc and Tab didn't reach the dialog. Focus now returns to Enter.
- **Not changed.** The `interior` chunk is still statically imported at boot. Making it lazy would move its parse into the governing walk window.
- **Evidence:** `docs/evidence/world-production-20261126/v6-distribution/REPORT.md` and its `distribution-analysis*.json`.

### E. Finishing

- `src/world/pocket/thirdPersonBoom.ts` is wired into `src/app/App.ts`. `PocketWorldHost.activeRoot` was added.
- The W10 camera boom shortens in front of cliffs and eases back. Measured 5.42 → 3.98 → 5.42 m.
- Test: `tests/browser/worlds-camera-boom.e2e.ts`. Evidence: `docs/evidence/world-production-20261126/v6-finishing/`.

### F. W10 Dexter readiness

- **The character seam** is in `src/world/pocket/w10/dexterCharacter.ts`:
  - `DexterCharacter`, `chooseDexterPose`, `createTestOnlyDexterRig`;
  - the asset contract and its validator.
- `createW10World.ts` builds its character only through the seam.
- Still `TEST_ONLY_NOT_APPROVED_DEXTER`. No model was made, generated or substituted.
- **Handoff:** `docs/plans/W10_DEXTER_MODEL_HANDOFF.md`.

### G. Final qualification on the exact candidate (local)

| Check | Result |
|---|---|
| `npm run gate` | PASS (153 files / 1,458 tests) |
| Content isolation scan | PASS, positive control 11/11 |
| `npm run test:workshop` | 16/16 |
| Standalone | PASS |
| Rehearsal suite | 5/5 |
| World suite | 74/76 in one run (W01 aim miss and W09 pinch, both above) |
| Standard suite | 115/119 at first, because the interruption hooks still patched `fromKit`. After the `fromKitSteps` fix: 119 + 1 skip |
| `perf:device` | **NOT MET** (see A) |

Validation logs: `docs/evidence/world-production-20261126/v6-validation/`.

### Continuity docs

- `docs/plans/WORLD_PRODUCTION_LEDGER_20261126.md` (V6 section).
- `docs/plans/WORLD_OWNER_REVIEW_20261126.md` (six owner decisions).
- `docs/COMPLETION_MATRIX.md`.
- `OPERATIONAL_STATE.md` (`state_revision` 138).
- **Bible entries** awaiting append into the Bible repository:
  - `docs/plans/BIBLE_APPEND_READY_V5_20261126.md`
  - `docs/plans/BIBLE_APPEND_READY_V6_20261126.md`
  - Check the Bible repository for whether they have since been appended.

## How to run things

The campaign's ad-hoc wrapper scripts were temporary and are not part of the repo. To recreate the browser environment, set:

```bash
export MUSEUM_BROWSER_EXECUTABLE="<path to an installed Google Chrome binary>"
export MUSEUM_WORLDS_GL=metal
```

On macOS, the default Chrome binary is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

| Suite | Command | Notes |
|---|---|---|
| Gate | `npm run gate` | Keep scratch `dist` folders out of the repo, or lint fails |
| Standard | `npx playwright test` | Dev server on 4173 |
| Worlds | `npx playwright test -c playwright.worlds.config.ts` | Dev server on 4191 |
| Rehearsal | `npx playwright test -c playwright.rehearsal.config.ts` | Builds a `VITE_POCKET_REHEARSAL=1` dist, served on 4193 |
| Workshop | `npm run test:workshop` | Needs `MUSEUM_BROWSER_EXECUTABLE` |
| Performance | `env MUSEUM_PERF_HEADLESS=1 npm run perf:device` | Installed Chrome |
| Release tools | `npm run test:release-tools` | Includes the ordinary-build exclusion regression |

**Before running anything expensive on the development machine:**
- Never run two expensive suites at once.
- Check `uptime` first. `perf:device` only means something when the load average is low.
- Never kill processes you don't own.
- Never label browser emulation as real-device testing.

## Open items

**Engineering (needs the owner's go-ahead):**
1. Rerun `perf:device` several times on a quiet machine, or on the headed representative device, to settle Workstream A.
2. Investigate the W01 aim-miss displacement.
3. Exercise the W09 `crossCascade` step-back, or get the pinch-point design changed (owner).
4. Keep watching CI on PR #83.

**Owner decisions:**
- Per-world visual and audio acceptance.
- An approved Dexter model, plus provenance.
- Physical-device touch testing.
- Budget definition: Option A or B.
- The W09 pinch-point design.
- Whether to make the interior chunk lazy.
- Whether to commit or discard the 61 re-captured images.
- Merging PR #83 (squash).

## Never implied

Each of these needs explicit owner authorization in the new session:
- merge;
- deploy;
- production world activation;
- budget or threshold changes;
- changes to the 20 MB checker or the W01 audio masters;
- paid generation or external transfer of private assets;
- new worlds;
- owner-acceptance claims;
- destructive cleanup of historical work;
- pushing or committing to the Bible repository.

Never weaken thresholds, change benchmark routes or remove content to make numbers pass.
