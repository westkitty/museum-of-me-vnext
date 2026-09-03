# Museum Workshop hardening — task intent

## Requested outcome

Bring `feature/museum-workshop-core-2026-08-26` to a truthful, conservation-protected, CI-green Workshop authoring baseline through the three bounded phases in the owner brief: reconcile project truth, repair the evidenced ordinary-browser gate failure, and enforce deterministic Museum conservation validation on the authoritative save path with author-to-visitor proof.

## Scope fence

- In scope: `OPERATIONAL_STATE.md`, the ordinary browser test boundary, shared Workshop manifest conservation logic, save-bridge enforcement, focused and end-to-end tests, standalone proof records, and task evidence.
- Explicitly out of scope: merge, main/release mutation, force operations, new editor features, widened prefab whitelist, structural scene authority changes, frozen mapping, source-installation semantics, authored visitor identities/conversations, Sanctuary purpose, flight mechanics, ordinary visitor controls, production privacy/offline rules, and the external ChatGPT Bible repository.

## Baseline lock

- Root: `/Users/andrew/museum of me/museum-of-me-vnext`
- Branch: `feature/museum-workshop-core-2026-08-26`
- HEAD at task start: `57abceb7b3d2d4e61667232ccdbd893342e5b81c`
- Upstream: `origin/feature/museum-workshop-core-2026-08-26`, 0 ahead / 0 behind at task start.
- Task-preexisting worktree: clean; no active Git operation.

## Required baseline read set

`OPERATIONAL_STATE.md`, `README.md`, `architecture.project.json`, `docs/ARCHITECTURE.md`, `.github/workflows/ci.yml`, `package.json`, Workshop source/schema/catalog/history/save plugin, Workshop tests, browser tests, and authoritative spatial modules under `src/world`, `src/interaction`, Sanctuary, and source-parity data.

## Evidence / stop conditions

- CI root cause must be evidenced before repair; no skipped or weakened browser assertions.
- Conservation must have one shared deterministic rule set, server enforcement, atomic rejection, useful structured diagnostics, and direct-source corruption coverage.
- Stop after the one primary implementation pass plus one bounded repair pass if validation requires it; report the earliest unresolved failure rather than widening scope.

## Change necessity

- User-visible need: Workshop saves must not damage protected Museum circulation, thresholds, interaction/read zones, or Sanctuary access.
- No-change option: schema validation alone cannot detect spatially harmful but schema-valid placements; existing save path would write them.
- Why code change is necessary: the requested conservation gate must run before the authoritative file write and share its rules with browser UX.
- Minimum boundary: add a pure Workshop conservation module fed by existing layout/installation authority, call it from schema-facing validation and the save bridge, and expose diagnostics without changing structural Museum systems.
- Decision: code-change.

## Execution Readiness View

- Intent lock: truthful, conservation-protected Workshop baseline.
- Compatibility boundary: safe prefabs and current manifest schema remain unchanged.
- Test obligations: focused conservation fixtures, browser Workshop journey, ordinary browser path, standalone/offline verification, canonical gate, production audit.
- Review gate: exact pushed HEAD CI; no merge.
