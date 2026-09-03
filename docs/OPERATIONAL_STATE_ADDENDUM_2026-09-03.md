# Operational State Addendum — 2026-09-03

This addendum supersedes **product-maturity interpretations** in older `OPERATIONAL_STATE.md` entries that described Museum of Me as `v1.0.0`, release-ready, or already at a publication boundary.

It does **not** erase those entries. They remain historical evidence of what the repository and earlier AI workflows claimed at the time.

## Owner correction

**Evidence state: ACCEPTED / CONTROLLING USER DIRECTION**

The owner explicitly stated on 2026-09-03 that Museum of Me has not come close to 1.0 and that an AI incorrectly decided it had reached that milestone.

Therefore:

- the historical branch name `release/v1.0.0` is not current maturity authority;
- PR #1 and merge commit `901ec91496f533638c978a3846bd3ea0c7914f48` remain evidence that code was integrated, not evidence that the museum reached 1.0;
- prior automated gates remain evidence for the code paths they actually exercised;
- prior human-acceptance gaps remain gaps;
- no GitHub Release object existed when this correction was made;
- `package.json` remains version `0.1.0`;
- current project state is **ACTIVE DEVELOPMENT / PRE-1.0**.

`docs/DEVELOPMENT_STATUS.md` is the concise controlling status correction for current development work.

## Current implementation branch

`development/collection-revision-2-2026-09-03`

Base: `main` at `901ec91496f533638c978a3846bd3ea0c7914f48`.

The branch preserves the integrated museum code rather than rolling it back because the milestone label was wrong.

## Collection Revision 2

**Evidence state: IMPLEMENTED ON DEVELOPMENT BRANCH**

The physical building remains 35 exhibit slots across six wings. The represented project inventory is no longer frozen at the 64 identities known on 2026-08-19.

- Historical snapshot preserved: `data/exhibit-mapping.json`.
- Current development mapping: `data/exhibit-mapping.current.json`.
- Current authored project records: 72.
- Current mapping invariant: every authored current project identity maps exactly once to one of the 35 physical exhibit slots.
- Dexter remains outside the project mapping.
- A `NOW BUILDING` surface may show current experiments without promoting them into the permanent collection.

New project identities added to the current collection:

- Starsilk Compendium
- Selfsame
- Project Sentinel
- RepoForge
- Character Performance Capture
- ClearCut Local
- AndrewOS Mac Bridge
- Modern 3D Browser Game Toolkit

## Exhibit changes implemented

- **E06**: Drakken Field Anatomy Archive replaced as primary subject by **Starsilk Compendium: Character & Canon Archive**. The older anatomy work remains lineage under the Drakken Compendium.
- **E07**: expanded to the current six-station Drakken laboratory model: Planet, Macro, Starbinding, Siege Wall, Incubator, Telemetry; shared state, hard zero-Starsilk collapse, Syrin nullification, and explicit non-canon specimen labeling are represented.
- **E09**: Museum Evolution now ends in active development rather than finished 1.0; adds the Modern 3D Browser Game Toolkit and a rotating `NOW BUILDING` surface initially showing *Every Fight Is Followed By A Century* outside permanent mapping.
- **E11**: rebuilt around Selfsame-style authority resolution, contradiction/evidence states, temporary constraint capsules, and hard-stop preflight; Project Sentinel remains visible as recovery lineage.
- **E12**: rebuilt as a movable Rhetorical InDEX passage lens with overlapping findings, separate pressure/confidence, passage pinning, and Pattern Mode; no article-level truth/trust score.
- **E15**: rebuilt as Agent Control & Capability Laboratory using RepoForge semantics: read-only discovery, evidence-backed candidates, separate authority, refusal of unapproved invocation, postcondition verification, proof.
- **E16**: rebuilt as Performance Capture & Media Transformation: source motion → portable performer state → character rig → soft alpha matte → composite → verified artifact. Earlier media applications remain lineage.
- **E30**: upgraded from a particle workbench to semantic AetherVFX sequence and persistent mutation/undo: telegraph → travel → impact → field → residue.
- **E34**: AndrewOS Mac Bridge becomes the control plane in front of the existing BigMac infrastructure; registered operations, permission classes, the Dexter Gate preview, and evidence receipts are represented.

Existing interactions retained after repository inspection because they already matched the desired upgrade direction:

- E05 StarSilk Maker
- E19 DexTilt
- E22 Creative Tools / DexDraw
- E32 S'mores Katamari museum slice
- E27 Full Weasel local first-party artifact

## Preserved capabilities / invariants

This revision is not authorized to regress:

- continuous exterior-to-interior traversal;
- existing collision and floor/ramp authority;
- 35 physical exhibit slots and six wings;
- 14 source-installation paths;
- 17 authored visitor conversations;
- Dexter Sanctuary separation from ordinary exhibits;
- single authoritative frame loop and `ResourceScope` disposal discipline;
- offline/privacy boundaries;
- development-only Workshop conservation boundaries;
- locally deferred Full Weasel artifact behavior;
- deterministic local DexGPT guide foundation.

## Validation evidence — first complete Revision 2 head

Exact development head `2671b36a6542a852a03e08e60901755bed5fc7b6` was verified by GitHub Actions run `33748583580` after the initial Revision 2 implementation and hot-path repairs.

That exact-head workflow completed successfully in all four jobs:

- canonical development gate: PASS;
- production real-browser visitor-path gate: PASS;
- standalone/offline verification: PASS;
- development-only Workshop authoring gate: PASS.

The canonical gate included 567 passing Vitest tests, current mapping/content/privacy/frame-loop/hot-path/asset/exhibit/source-parity validation, production build and budget/dist verification. Standalone runtime-source QA exercised all 14/14 source-installation paths and 17/17 authored visitor conversations with zero remote runtime requests.

This proves the tested code paths for that exact development head. It does not prove subjective visual quality or product maturity.

## Curation correction after Revision 2 review

**Evidence state: IMPLEMENTED; FINAL EXACT-HEAD WORKFLOW MUST BE READ FROM THE COMMIT THAT CONTAINS THIS ADDENDUM**

A second repository review found two project identities that were technically mapped exactly once but were still living in semantically wrong exhibits because the current collection had inherited their old August grouping.

- **P029 DexEnhance** was incorrectly carried inside **E21 Civic Support Studio**. Its actual project record describes a local-first browser extension whose durable architectural idea is Shadow DOM isolation from frequently changing host-page interfaces. It now belongs to **E14 Promptcraft & Vibe Coding**, where the room contains a synthetic host-page redesign demonstration and a separately controlled DexEnhance layer that remains isolated from the host layout.
- **P060 He-Maker** was incorrectly carried inside **E16 Performance Capture & Media Transformation**. Its actual project record describes source reconstruction, repository establishment, and project-record recovery from cloud/sync-folder evidence. It now belongs to **E11 Selfsame: Continuity & Authority Systems**, where a dedicated recovery station presents the concrete path from loose files to a resumable project with reconstructed source, intent, history, and durable records.
- **E21** is now curated solely around DexAid's chronology/evidence/next-action casefile problem rather than mixing in unrelated browser tooling.
- **E16** remains focused on media/performance transformation and its actual media lineage rather than repository archaeology.
- `tests/collection.test.ts` now locks these two corrected homes so a future regeneration cannot silently restore the stale grouping while still satisfying the weaker exact-once mapping invariant.

The historical `data/exhibit-mapping.json` remains unchanged. These corrections apply only to the current development collection.

## QA truth-layer repair discovered during verification

**Evidence state: IMPLEMENTED; FINAL EXACT-HEAD WORKFLOW PENDING AT TIME OF THIS FILE WRITE**

The first post-curation canonical gate exposed a contradiction inside its own successful output: `build:collection` and `validate:mapping` correctly reported **72** current project identities, while `npm run qa` still printed **64**.

Root cause inspection showed `scripts/qa-report.mjs` was still:

- reading the frozen historical `data/exhibit-mapping.json` rather than the current mapping when present;
- reading only base `data/exhibit-content.json` rather than current revision overlays;
- hard-coding `64` as both the displayed coverage denominator and the success condition;
- containing an obsolete generated human-checklist scaffold even though `qa-report-runner.mjs` had to restore the newer hand-maintained checklist afterward.

Repair:

- `qa-report.mjs` now selects the same live mapping source as the collection builder;
- it merges current exhibit-content overlays;
- it enumerates authored project records from `data/projects/*.json` and fails on duplicate mapped identities, mapped identities with no authored record, authored identities left unmapped, wrong exhibit count, or bespoke implementations absent from the current map;
- project coverage is derived from current data rather than a historical literal;
- the generated QA language now says **development evidence**, not release proof, and describes the intentional night exterior;
- `qa-report.mjs` no longer writes or regenerates the human-authored checklist at all;
- the tracked `validation/reports/QA_REPORT.md` has been refreshed to the 72-project current collection.

This defect is important because the old QA step could pass while describing a collection state that the rest of the same gate had already superseded. A green final workflow is required again after this repair.

Because this documentation update itself changes the branch head, the authoritative final automation result is the GitHub Actions workflow attached to the exact commit containing this addendum. Do not infer that result from an earlier head and do not edit this file merely to paste its own future workflow result back into itself.

## Human evidence

**UNKNOWN / UNVERIFIED** for the new collection revision's final visual composition, room readability, interaction feel, representative-device performance, and subjective quality.

Automated success does not promote those states.

## Living collection omission repair — 2D Game Factory

**Evidence state: IMPLEMENTED; EXACT-HEAD AUTOMATION PENDING AT TIME OF THIS WRITE**

A further collection-coherence sweep compared the Museum's living project inventory against current Project Bible records rather than checking only whether the already-authored Museum identities were mapped once. That exposed a different class of error: an active substantial project could be missing from the Museum entirely and the exact-once invariant would still pass.

`2D Game Factory` is such a project. Its current continuity record describes an established local-first visual browser-game workbench and generator with a 74-preset catalogue, Asset Lab, semantic role mapping, Scene Composer, preview through the actual generated Phaser runtime, and Validate / Build / Pack paths. Its starter-kit catalogue is still expanding, but the project itself is materially implemented and therefore belongs in the permanent collection rather than being reduced to a NOW BUILDING teaser.

Repair:

- **P073 2D Game Factory** was added as a current project identity with source repository `westkitty/2d_Game_Factory`;
- P073 is mapped exactly once to **E22 Creative Tools Studio**;
- E22 now preserves the existing DexDraw shared-surface and DexCraft prompt-target interactions and adds a museum-scale Factory station that advances through **Import → Asset Lab → Role Map → Scene → Preview → Validate → Build → Pack**;
- the Factory station explicitly explains that the real project's preview uses the actual generated Phaser game rather than an editor-side mock, while the Museum itself only represents that workflow and does not execute or embed the external project;
- E22 interpretive copy now explains the shared design principle across its projects: creative state and user-owned assets remain governed as they move from editing surfaces toward durable output;
- `tests/collection.test.ts` now locks P073 into E22;
- the tracked QA report now states **73 / 73** current project identities.

The earlier 72-project counts in this addendum remain true historical evidence for the previously verified Revision 2 head. This section supersedes them for the current living collection. The physical museum remains 35 exhibit slots across six wings; Dexter remains outside project mapping.

A new exact-head four-job workflow is required after this addition before P073/E22 may be called automation-verified. Human readability and interaction feel for the new Factory station remain UNKNOWN/UNVERIFIED regardless of automation outcome.
