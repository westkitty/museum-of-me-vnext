# Intelligent Museum Builder mission state

Mission: MUSEUM-INTELLIGENT-BUILDER. Status: NOT COMPLETE; Phase 0 in progress.

- Implementation repository: `westkitty/museum-of-me-vnext`. Isolated worktree: `/Users/andrew/Developer/museum-intelligent-builder`, branch `feat/intelligent-builder-20261111`, based on `ce1f33e09e0c89245f9cf17a00a332c1025b49da`.
- On 2026-11-11 local time, remote `main`, `pages-preview`, and hosted `build-info.json` reported the base SHA above. Historical main CI run 43134575462 and Pages run 43134601183 reported success. This is baseline evidence, not proof of new features or physical-device acceptance.
- PR #49 is open at `b613a08838e9f912b629f4fd1b4dbc8b71c44ebb`, one commit ahead of the baseline. Its handoff, candidate ledger, guide and README tree blob IDs match the mission's specified originals. The ledger parses and contains 200 entries. The source pack is not yet integrated into main; consult that exact commit without overwriting it.
- Bible main was `ee745752e8daca90477fe083aaea0718cee0219b` at preflight; its latest source-pack entry classifies the new mission as planned. No Bible write has been made for this preflight.
- Checkout began clean. This worktree's baseline placement manifest is empty; no private media/model directories were present in it. Other checkouts and private data were not modified. The originally supplied working directory was empty and was not a Git checkout.
- Host: MacBook-Air.local, 8 GiB RAM, approximately 6.8 GiB available at checkout. CI specifies Node 22; local Node 26.13.0 and npm 11.20.0 were used for isolated `npm ci`, which emitted install-script policy warnings. Local baseline `npm run typecheck` passed, and `npm test -- tests/workshop.test.ts tests/workshop-builder.test.ts` passed 33 tests. These are not full CI or browser proof.
- Existing schema is v1 with a 256-object limit. `MuseumPlacements.rebuild()` constructs all saved objects, while collision currently depends on live roots. Raising the limit alone would not satisfy the mission and risks runtime and navigation regressions.
- No implementation, migration, asset imports, physical-device performance proof, or new release has been completed. All mission phases and acceptance items remain open.

Next action: finish reading the complete source-pack documents and current Bible, inspect the named source files, save endpoint/body limits, streaming and collision ownership, then design and implement a tested migration and bounded residency together. Verify the installed Node/toolchain policy before relying on local test results. Preserve existing data, compare against current remote refs before integration, and never publish private imports.
