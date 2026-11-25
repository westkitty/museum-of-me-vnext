# Evidence-loss manifest (2026-11-24)

**Incident.** A default `playwright.config.ts` run (its `outputDir` was `test-results`, the parent of every evidence folder) emptied `test-results/`. The ignored folder `test-results/walkabout/` was removed. No `rm` was issued; Playwright cleans its own `outputDir`. `playwright.capture.config.ts` inherited the same setting.

**Prevention (this change).** `playwright.config.ts` now writes to `test-results/playwright`. `tests/playwright-output-safety.test.ts` fails if any Playwright config (e2e, capture, perf, workshop) has no explicit `outputDir`, uses `test-results` itself, or targets a known evidence folder (`walkabout`, `traversal`, `cinematic-review`). The guard runs in `npm test`, therefore in `npm run gate`.

## Verified surviving
- Tracked source, all evidence markdown in this folder, `OPERATIONAL_STATE.md`, `docs/COMPLETION_MATRIX.md`.
- Pre-edit checkpoint `/Users/andrew/museum of me/checkpoints/perf-rescue-20261124/` (SHA-256 verified; tracked patch plus 23 changed or untracked files).
- `test-results/traversal/` is present (it is also rewritten by the grand-tour test, so its current contents are regenerated, not original).
- `perf-results/` (arms-trials*.jsonl, profile-*.txt, device, transition, steady and ticketed JSON), a separate ignored folder.
- Reported historical measurements, which survive as figures in the markdown reports.

## Verified restored (byte-identical copies from the clean-main worktree's `test-results/walkabout/`)
`browser/{budgets.log,build.log,config.ts,log.txt,perf-device.log,run/.last-run.json}` and `closure/{steady.config.ts,steady.perf.ts,ticketed.config.ts,ticketed.perf.ts,steady-run/.last-run.json,ticketed-run/.last-run.json}`. These are the matched ticketed and steady harness scripts, so the pair runs can be reproduced.

## Reproducible (can be regenerated, not restored)
Matched M1 pair receipts under `closure/m1/` (needs a headed device run, which was not authorized this session), E19/E20 before/after captures, cast portraits, passage-traversal and gate logs, the profiling scripts written this session (recreated under `test-results/perf-repair-20261124/`).

## Lost, no verified recovery source
Everything else that was under `test-results/walkabout/`: raw M1 trial JSON and logs, `comparison.txt`, `steady-summary.txt`, `geometry-transform-experiment.log`, all PNG captures and `inspection.json` files, standalone and gate logs under `closure/` and `continuation/`. No Time Machine snapshot or second copy was found.

## Documentation links now pointing at missing files
`CONTINUATION_QA_REPORT.md`, `PERFORMANCE_REPORT.md`, `FINAL_QA_REPORT.md`, `VISITOR_VISUAL_LEDGER.md`, `OPERATIONAL_STATE.md` and `docs/COMPLETION_MATRIX.md` link to roughly 75 distinct `test-results/walkabout/...` paths. The links are left in place. The figures quoted in those reports stand as reported measurements whose raw artifacts are gone.
