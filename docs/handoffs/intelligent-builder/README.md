# Intelligent Museum Builder — verified source handoff

These **read-only research and release-reference files** were transferred intact from the Museum of Me project conversation. Their original bytes were preserved; do not treat them as implemented Builder features or approved assets.

## Files

| File | Purpose | Bytes | Git blob SHA |
| --- | --- | ---: | --- |
| [Museum Builder complete development handoff](Museum_of_Me_Builder_Complete_Development_Handoff_2026-11-11.md) | The released Builder chronology, verified CI/Pages receipt, existing source ownership, protected paths, regressions, and remaining work | 102,393 | `8f84319d6a97628a8025c9ea1ed39932b244184f` |
| [200 GLB candidate ledger](museum_of_me_200_glb_candidate_ledger.json) | Exact 200 screened model records and their museum associations; candidates, not canon-approved installations | 357,195 | `d3a464f11c9acf58fcca5b0219af0881730753db` |
| [Asset sourcing guide](museum_of_me_200_glb_source_guide.md) | Provenance, source validation, selection rationale, and production caveats | 120,344 | `a4a990c064a22fd83465f76d401f8d6be780b23b` |

## Read order for Codex or another implementation agent

1. Read the complete Builder development handoff.
2. Read the candidate ledger and sourcing guide. Validate their JSON and source pin independently before using entries.
3. Read the latest canonical Bible at `westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md`.
4. Inspect live `main`, current pull requests, `OPERATIONAL_STATE.md`, `src/workshop/`, `src/app/`, `src/world/`, and relevant tests. **Current Git evidence outranks stale status lines.**
5. Implement only the newly authorized Intelligent Museum Builder mission on an isolated branch, preserving the existing museum and local-only authoring boundaries.

### Historical baseline, not a current-work claim

As of the verified 2026-11-11 release, the published `main` and `pages-preview` source was `ce1f33e09e0c89245f9cf17a00a332c1025b49da` (PR #48 integrated and Pages hosted SHA verified). The shipped Builder then had 119 OpenLife GLBs and 13 finishes, authored room/wall/floor/roof tools, real wall openings, and limited safe object reactions. The proposed 1,883-model browsing, expanded persistence/residency, automatic curation and visitor intelligence were **not** implemented by that release.

The pinned external candidate source was `Hidencod/tge-assets` at `3ddcc695adbba9fb918cf31b7c139b3f95b76910`. A candidate listing is **not** per-item license clearance, in-museum inclusion, local byte verification, or canonical approval.

Keep the source library in `docs/handoffs/intelligent-builder/`, never in `public/`. This package alone changes no runtime code, save data, or release output.
