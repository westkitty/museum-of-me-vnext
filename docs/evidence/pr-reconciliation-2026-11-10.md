# Exterior Pull Request Reconciliation — 2026-11-10

**Target:** `westkitty/museum-of-me-vnext`, current `main` baseline `8a1fbd5e54cbf236359030fe3a5e58269035ea2f`.  
**Purpose:** Reconcile the twelve exterior-related open PRs without replaying old museum geometry over the current verified exterior and Museum Builder release.

## Source-grounded dispositions

GitHub compare results below use the exact `main` baseline above. **Ahead 0, behind N** means the PR head is already an ancestor of the current `main`, so an additional merge would add no commits.

| PR | Comparison to `main` | Disposition |
| --- | --- | --- |
| #26 Real lagoon | behind 46; ahead 0 | Already included in main; redundant stacked draft |
| #27 Facade depth | behind 45; ahead 0 | Already included in main; redundant stacked draft |
| #28 Pier procession | behind 44; ahead 0 | Already included in main; redundant stacked draft |
| #29 Roof and pier | behind 43; ahead 0 | Already included in main; redundant stacked draft |
| #30 Seven-view evidence pipeline | behind 42; ahead 0 | Already included in main; redundant stacked draft |
| #31 Composition and woodland | behind 39; ahead 0 | Already included in main; redundant stacked draft |
| #32 Night water | behind 38; ahead 0 | Already included in main; redundant stacked draft |
| #33 Canopy infill | behind 37; ahead 0 | Already included in main; redundant stacked draft |
| #34 Lagoon depth and surf | behind 36; ahead 0 | Already included in main; redundant stacked draft |
| #35 Forest belt | behind 33; ahead 0 | Already included in main; redundant stacked draft |
| #25 Frozen exterior candidate | diverged; ahead 1, behind 50 | One unique test-only commit; adapt its still-useful coastline invariants to the current water geometry, **not** its old RingGeometry inner-radius=0 assumption |
| #37 Canopy scale experiment | diverged; ahead 1, behind 29 | Not accepted; do not merge unverified scenery changes without seven-view visual/mobile comparison and owner acceptance |

## Recovered test coverage from #25

The only unique #25 change is to `tests/environment.test.ts`, not a missing world implementation. The frozen test expects a fully filled `RingGeometry` with inner radius 0, while current source `src/world/ArrivalGarden.ts` uses an annulus (inner radius 164, outer radius 330), a named polygon coastal skirt and tidal fringe. The current test already excludes shader-only `shoreFoam` and checks the tidal-fringe role. This reconciliation adds explicit assertions for the current annular water and coast-edge seal, instead of cherry-picking a stale assertion.

## Why #37 is held out

The one-commit #37 change reduces randomized woodland belt crown scales. It has a draft PR with a **DO NOT MERGE** condition until four CI gates, seven exact-head scene captures, existing-candidate visual comparison, mobile/offline proof and aesthetic approval. It is not safe to silently reinterpret a smaller crown as an improvement, particularly after the later approved exterior omni uplift. Preserve its branch as an experiment; an archived PR can be reopened if its evidence is obtained.

## Release and preservation boundaries

- No old exterior branch is force-pushed, rebased, reset or deleted.
- All original drafts, source revisions, commits, discussions and reproduction history remain in GitHub.
- The current deployed museum geometry, Sanctuary, visitor routes, six wings, exhibit identities, offline behavior and production-only restrictions stay unchanged.
- This change is a **test and PR hygiene** pass, not a visual redesign or a claim that the MacBook local working tree is clean.
- Final states (PR closure, CI, merge, Pages and hosted SHA) must be recorded from actual GitHub responses, not predicted here.
