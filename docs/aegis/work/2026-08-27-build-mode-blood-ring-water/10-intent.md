# Build Mode, Blood Ring and water repair — task intent

## Requested outcome

Repair the human-session Build Mode activation conflict and make the two requested bounded exterior visual corrections: a real world-relative crystalline orbital Blood Ring and smoother dark night water. Preserve the already-verified Museum Workshop implementation and all existing Museum authorities.

## Scope fence

- In scope: `?edit=1` Build Mode discoverability/ownership, HUD/UILayer/Workshop coordination, `Sky`, `ArrivalGarden` water presentation, focused structural and browser regressions, current operational-state evidence.
- Explicitly out of scope: Workshop conservation redesign, new prefabs, structural/collision changes, gameplay/water physics, new frame loops, remote assets/services, mapping/content/visitor-route changes, production authoring controls, and external Bible mutation.

## Baseline lock

- Root: `/Users/andrew/museum of me/museum-of-me-vnext`
- Branch: `feature/museum-workshop-core-2026-08-26`
- HEAD at task start: `c91a2e2de2bc55724be6a21ce2386c6e40b863fd`
- Upstream: `origin/feature/museum-workshop-core-2026-08-26`, 0 ahead / 0 behind at task start.
- Task-preexisting worktree: clean; no active Git operation; one worktree only.

## Required baseline read set

`OPERATIONAL_STATE.md`, `README.md`, `docs/ARCHITECTURE.md`, `src/main.ts`, `src/workshop/Workshop.ts`, `src/workshop/workshop.css`, `src/ui/HUD.ts`, `src/app/UILayer.ts`, `src/world/Sky.ts`, `src/world/ArrivalGarden.ts`, and directly related browser tests were read before editing.

## Change necessity

- User-visible need: human QA cannot meaningfully enter Build Mode because the automatic editor open collides with the ordinary pointer-lock prompt; the current sky/water treatments visibly fail their requested visual reads.
- No-change option: none. Existing Workshop and visual implementations cannot satisfy the requested activation and geometry/material boundaries without source changes.
- Why code change is necessary: Build Mode needs explicit inactive capability and shared input ownership; the Blood Ring needs persistent world geometry; water needs a lower-frequency material function.
- Minimum boundary: add one development-only toggle path, let Workshop own capture state only while active, add one celestial object under the existing app scope/loop, and revise only the existing water shader/update path.
- Decision: code-change.

## Execution readiness view

- Intent lock: unblock human Workshop use and correct Blood Ring/water source representations.
- Compatibility boundary: existing Workshop conservation, safe prefab catalog, pointer-lock entry, Museum controls, offline operation, and single-loop ownership remain intact.
- Test obligations: Build Mode browser flow, focused structural ring/water checks, existing Workshop/browser suites, full gate and standalone/audit ladder.
- Review gate: exact pushed HEAD CI; no merge or release action.

## TDD Route Guard

- Mode: off.
- Decision: skipped.
- Strict authority: not requested; tests will be added/updated as direct regression coverage within the owner brief.
- Test posture: focused structural/browser coverage plus existing repository gates.
- Verification: named validation ladder and exact-head CI.
