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

**Evidence state: IMPLEMENTED ON DEVELOPMENT BRANCH / FINAL EXACT-HEAD CI PENDING AT ADDENDUM CREATION**

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

## Validation evidence before this addendum

A development workflow on an earlier revision of the branch established:

- collection generation: 72 projects / 35 exhibits / 6 wings;
- TypeScript: PASS;
- lint: PASS;
- Vitest: 26 files / 567 tests PASS;
- mapping: PASS;
- content: PASS;
- privacy: PASS;
- frame-loop ownership: PASS.

That run then correctly failed the hot-path allocation validator on eight new per-frame temporary allocations. Those allocations were repaired without weakening the validator.

Because this addendum itself creates a new branch head, **final exact-head CI must be read from the workflow attached to the final branch commit before merge or completion claims are made.**

## Human evidence

**UNKNOWN / UNVERIFIED** for the new collection revision's final visual composition, room readability, interaction feel, representative-device performance, and subjective quality.

Automated success does not promote those states.
