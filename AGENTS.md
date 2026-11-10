# Museum of Me — workspace agent instructions

Museum of Me is a real first-person Three.js/WebGL museum/portfolio. Keep existing visitor journeys usable; do not replace it with a dashboard or progression game.

## First reads
Confirm repository identity, branch, HEAD, remotes and worktree status. Read OPERATIONAL_STATE.md, docs/COMPLETION_MATRIX.md and docs/ANTIGRAVITY_COMPLETION_HANDOFF.md. For edits, read architecture.project.json, docs/EXHIBIT_CONTRACT.md and the exact source/tests involved. The canonical continuity ledger is westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md; current repository and actual runtime govern what is implemented and verified.

The seven Fable completion commits already exist in the user's local feature branch. Do not reapply their archived patch series or overwrite that branch. Older brainstorming is not accepted implementation scope.

## Protected contracts
- Six wings, two levels, Rotunda, 35 exhibit slots with 73 current project identities; preserve historical 64-project mapping as a snapshot. The Dexter Sanctuary is separate from the exhibits and has no completion/score requirement.
- One authoritative frame loop at src/app/Loop.ts; existing ExhibitHost lifecycle, ResourceScope, collision, streaming, geometry ownership, wayfinding and 14 source installations / 17 authored visitor conversations.
- Deterministic, offline, locally sourced DexGPT guide; DexGPT is distinct from Dexter. No mandatory progression gates, online model backend, required network calls or new dependencies without permission.
- Preserve input/pointer-lock behavior, keyboard accessibility, reduced motion, privacy, visitor paths, Museum Workshop structural boundaries and existing working exhibits.
- Regenerate src/content/collection.generated.ts from data inputs; never hand-edit generated collection. Use established label/update disposal helpers.

## Execution and evidence
Use a bounded change slice: inspect the rendered exhibit, identify the real defect, repair it without disturbing the building, add tests, run impacted checks, inspect the diff and update OPERATIONAL_STATE.md plus docs/COMPLETION_MATRIX.md with evidence labels. Source presence is not a browser test, and a browser test is not human acceptance.

The immediate queue: measured plinth penetrations E02, E07, E08, E11; afterwards browser-review E20 and E35. Sanctuary guide routing is only PROPOSED. Do not implement historical brainstorm features without approval.

Use installed system Chrome through MUSEUM_BROWSER_EXECUTABLE for browser tests when available; do not run interactive dev-server work during npm run test:e2e. Run focused checks before the long suite. No invented test results.

Do not reset, force-push, merge main, deploy, change permissions, delete branches or tag v1.0 without explicit authorization. The museum remains ACTIVE DEVELOPMENT / PRE-1.0.
