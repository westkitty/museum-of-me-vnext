# Drift Sentinel manual inspection

Museum of Me remains ACTIVE DEVELOPMENT / PRE-1.0. Scheduling is disabled: no timer, workflow, trigger, automated source repair, PR creation, history edit, deployment, or publishing is authorized or implemented.

Supply an owner-selected full commit SHA explicitly; Sentinel never derives authority from historical Operational State prose, an arbitrary log entry, or a fallback parent:

```bash
node scripts/sentinel/runner.js --baseline=<full-40-character-accepted-commit-SHA>
node scripts/sentinel/report.js
```

The default inspects Git only. Add `--checks` to request the documented targeted checks (`typecheck`, `lint`, `test`, `validate:mapping`, `validate:content`) for non-document changes. These are advisory checks, not the canonical `npm run gate`, browser, Workshop, standalone or human acceptance gates. Pure documentation/no-change comparisons select no tests; skipped work never counts as a pass. The complete gate remains a separate reviewer action.

Baseline existence and ancestry must be proven. Missing authority is UNKNOWN; missing objects in shallow history are incomplete history; Git errors are comparison failures. No fallback baseline is used. A dirty working tree, including nonignored untracked files, prevents revision-specific test evidence and resolution. This compares committed baseline and HEAD, and requires nonignored untracked source/test/config changes to be committed before revision-specific evidence can be established.

Each failure is keyed by its exact command. Resolution requires that same command to pass on a valid clean comparison. Unexecuted checks remain NOT RECHECKED, invalid context UNKNOWN. First-seen identity, prior finding snapshots, latest evidence and full run records are preserved. Legacy issues without a command cannot automatically resolve.

The only direct writes are `.sentinel/state.json` and `.sentinel/index.html` beneath the invocation directory, a private ignored directory. Invoke from the repository root. Output symlinks are rejected. The optional check commands are existing project verification tools; Sentinel does not execute arbitrary state-derived commands or fixes. Old `.sentinel.json` is ignored and never imported automatically; preserve it separately if it exists. No diagnostic is written under `public/`, shipped to the museum, or uploaded. Reports are static offline HTML with escaped source strings and a restrictive CSP; open `.sentinel/index.html` locally. Retain private evidence locally as needed, because command output can contain sensitive paths or diagnostics.

Inspection and executed-check elapsed durations are measured. Commands not attempted are listed; saved time remains UNKNOWN because no counterfactual duration is measured. No claim about FPS, thermal behavior, test counts or gate equivalence is inferred from skipped work.
