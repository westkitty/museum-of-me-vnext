# Museum of Me — Development Status

**Current status: ACTIVE DEVELOPMENT / PRE-1.0**

This file exists because earlier repository history incorrectly promoted the project to a `v1.0.0` / release-ready state.

## Controlling correction — 2026-09-03

The project owner explicitly corrected that milestone claim:

- Museum of Me has **not** reached 1.0.
- The branch name `release/v1.0.0`, PR #1 title, and merge commit title `Release v1.0.0 — Museum of Me vNext` are historical records of an AI-created milestone interpretation, not current product authority.
- The code integrated by those commits remains useful development work and is not being rolled back merely because the milestone label was wrong.
- Automation that passed on those commits remains evidence about the tested code paths. It is **not** evidence that the museum as a product had reached 1.0 maturity.
- No GitHub Release object exists for this repository as of the correction.
- `package.json` remains version `0.1.0`, which is consistent with the corrected pre-1.0 project state.

## Current development baseline — October 29, 2026 readback

**Active implementation branch:** `main`. The latest source-code integration is merge commit `75f46293c04aea9a95c483b3dcd645c904dc517a` (subsequent documentation-only commits may advance HEAD), created by [PR #12](https://github.com/westkitty/museum-of-me-vnext/pull/12). The four-file shared Chromium workbench/map fix was reviewed and merged after its exact-head [PR CI run 40836121179](https://github.com/westkitty/museum-of-me-vnext/actions/runs/40836121179) passed gate, real Chromium browser, Workshop, and standalone. The resulting `main` [run 40844067459](https://github.com/westkitty/museum-of-me-vnext/actions/runs/40844067459) began after merge; its exact-head browser result must be read independently before promoting the merge commit to fully CI-verified status. The older October 14 `7968fc9` record is historical, not the latest `main` head.

**Museum scope is unchanged:** active development / PRE-1.0; 73 current project identities, 35 stable exhibits, six wings, two architectural levels and separate Dexter Sanctuary. Preserve 14 source installation paths, 17 authored visitor conversations, input/traversal, Workshop conservation, local artwork/offline, privacy, persistence and accessibility. Human visual/device performance acceptance remains UNVERIFIED.

**Pages reconciliation:** `pages-preview` deployed commit `d4ce33604728a45a1a216e67b08f89b07c47f02b` with successful [Pages deployment and hosted SHA verification 40833413214](https://github.com/westkitty/museum-of-me-vnext/actions/runs/40833413214). That commit and the new `main` merge commit have the same Git tree SHA `ab9f651d140da5e5edb87eefc09cdc1ac8f33ed9`; therefore the tracked source content matches even though the commit histories/SHAs differ. No further Pages deployment is justified solely for source parity. This is not physical-device or subjective art validation.

**Open branches and readiness:** Original Jules PRs [#10](https://github.com/westkitty/museum-of-me-vnext/pull/10) and [#11](https://github.com/westkitty/museum-of-me-vnext/pull/11) remain unmerged and have failed CI; separate `repair/drift-sentinel` and `repair/visitor-choreographer` contain source improvements but must be rebased/revalidated against this new `main`. The latter feature is a nominal route simulation, not verified live visitor telemetry. Visual-finishing [PR #9](https://github.com/westkitty/museum-of-me-vnext/pull/9) remains draft with green exact-head branch CI but 27 changed files, an out-of-date base, and unmet human visual acceptance. The conservation-ledger/X-ray branch and several arena branches retain unique source/history and are not approved for deletion.

**Branch hygiene / administration:** Read-only Git ancestry identified 12 historical feature/release/integration refs with zero unique commits ahead of `main`; `pages-preview` must remain the dedicated publishing branch and `repair/shared-chromium` should be retained until post-merge verification is closed. Remote branch deletion has not occurred. GitHub reports `main` as unprotected, with no required status checks and no repository rulesets at inspection; branch-protection setup remains unperformed because the available GitHub connector has no administrative mutation action. Intended protection: PR changes, require `gate`, `browser`, `workshop`, `standalone`, block force pushes and deletion, restrict bypass appropriately. Distinguish these intended controls from controls actually enabled.

The first post-correction development branch was (historical lineage):

`development/collection-revision-2-2026-09-03`

Its historical purpose was to bring the museum's collection and exhibit interactions closer to the projects that exist now. Its improvements are reflected in later merged `main` work.

## Collection policy after the correction

The building keeps **35 stable physical exhibit slots** across six wings. The represented project inventory is no longer frozen at the 64 identities known on 2026-08-19.

- `data/exhibit-mapping.json` is preserved as the historical 2026-08-19 collection snapshot.
- `data/exhibit-mapping.current.json` governs the current development collection when present.
- New projects may become the primary subject of an existing exhibit while older projects remain as lineage inside that exhibit.
- Project identities remain mapped exactly once in the current collection so interpretation does not silently duplicate a project across wings.
- Dexter remains outside the project mapping.
- A rotating **NOW BUILDING** surface may show current work without turning unfinished experiments into permanent collection entries.

## What 1.0 will mean later

There is no automatic date or branch name that makes this project 1.0. A future 1.0 decision should be made deliberately after the museum has reached a level the owner considers substantially complete, including the quality of its physical spaces, exhibit interactions, collection accuracy, visitor experience, visual presentation, representative-device behavior, and any remaining major design ambitions.

Passing automation is required evidence for code health. It is not, by itself, the definition of product completion.
