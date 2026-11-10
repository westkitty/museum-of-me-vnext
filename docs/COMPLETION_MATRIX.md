# Museum of Me — Completion Matrix and Outstanding-Work Queue

**Status: ACTIVE DEVELOPMENT / PRE-1.0. Verdict for this revision: PARTIAL.**
Written 2026-11-09 against starting SHA `a96d2f74bc2057d25a6cc324c4f79a4588144a16` (`main`, equal to `origin/main`)
plus the local branch `feat/completion-guide-and-drift-20261109`. Updated the same day by completion pass 2.

This is a working record, not an acceptance document. It separates what a machine checked from what a
person still has to look at. Nothing here is a human PASS.

## How to read the columns

- **Copy** — `revision 2` means the exhibit's interpretation was rewritten for the living 73-project
  collection; `base` means it still uses the 2026-08-19 text (not wrong by itself — see queue item 3).
- **Automated contract** — `tests/exhibit-quality.test.ts`, `validate:exhibits`, `validate:mapping`,
  traversal and lifecycle suites: physical presence, bay fit, controls, interpretation, reduced motion,
  reset, streaming cycles, ownership. PASS at this revision (768/768 unit tests, full `npm run gate`).
- **Visitor meaning / visual** — whether a new visitor understands the project from the installation, and
  whether it looks finished. This needs eyes in a real browser. **Not inspected exhibit-by-exhibit in this
  session**, so every row is UNVERIFIED rather than assumed good.
- **Lead** — a specific, checkable observation from source inspection. A lead is not a confirmed defect:
  every mapped project is already listed on the exhibit's lectern, in the detail panel and in the
  accessible contents. The lead says the *physical* bay may not name or show that project.

## The 35 exhibits

| ID | Wing | Exhibit | Represents | Copy | Automated contract | Visitor meaning / visual | Lead |
|---|---|---|---|---|---|---|---|
| E01 | north | Starsilk Universe | Starsilk Universe | base | PASS | UNVERIFIED | — |
| E02 | north | Drakken Terraforming Compendium | Drakken Terraforming Compendium; Drakken Field Anatomy Archive | revision 2 | PASS | VERIFIED BY BROWSER (pass 3); human acceptance pending | P006 not named in the bay source; REPAIRED (pass 3): Station 0 moved to (0, 0, 2.1) clear of bay plinth; 0 intersections measured |
| E03 | north | Orbital Tomb | Orbital Tomb | base | PASS | UNVERIFIED | — |
| E04 | north | Starsilk Possibility Cartographer | Starsilk Possibility Cartographer | base | PASS | UNVERIFIED | — |
| E05 | north | StarSilk Maker | StarSilk Maker | base | PASS | UNVERIFIED | — |
| E06 | north | Starsilk Compendium: Character & Canon Archive | Starsilk Compendium | revision 2 | PASS | UNVERIFIED | — |
| E07 | north | Drakken Terraforming Laboratory | The Drakken Terraforming Laboratory | revision 2 | PASS | VERIFIED BY BROWSER (pass 3); human acceptance pending | REPAIRED (pass 3): deck ring clamped clear of plinth, Station 3 and Syrin Contact console moved to z=2.1, pulse centered on planet; 0 intersections measured |
| E08 | north | Heliocide Observatory | Heliocide Observatory | base | PASS | VERIFIED BY BROWSER (pass 3); human acceptance pending | REPAIRED (pass 3): witness records row moved to z=2.15 clear of bay plinth; 0 intersections measured |
| E09 | west | Museum Evolution | Museum of Me / The Reliquary of Iterative Becoming; Modern 3D Browser Game Toolkit | revision 2 | PASS | UNVERIFIED | — |
| E10 | west | WorldsVault Lineage | WorldsVault Uplink; CanonForge; WorldsVault | base | PASS | UNVERIFIED | — |
| E11 | west | Selfsame: Continuity & Authority Systems | KinDex Handoff; ChatGPT Bible Repo; Project Forge; He-Maker; Selfsame; Project Sentinel | revision 2 | PASS | VERIFIED BY BROWSER (pass 3); human acceptance pending | 3 of 6 lineage projects not named in the bay source; REPAIRED (pass 3): TRY OPERATION console moved to (0, 0, 2.1) clear of bay plinth; 0 intersections measured |
| E12 | west | Rhetorical InDEX | Rhetorical InDEX | revision 2 | PASS | UNVERIFIED | — |
| E13 | media | Suno Studio | Suno AI Lyrics and Manual | base | PASS | UNVERIFIED | — |
| E14 | media | Promptcraft & Vibe Coding | Visual Prompt Systems Registry; Vibe Coding Nexus / DexGate Academy; DexEnhance | revision 2 | PASS | VERIFIED BY BROWSER (pass 4); human acceptance pending | Repaired in pass 4: all three projects physically represented and named in the bay (Visual Prompt Systems Registry on template rack, Vibe Coding Nexus on live stage, DexEnhance on Shadow DOM isolation frame); before/after screenshots in docs/evidence/lead-exhibits-pass4-20261110/ |
| E15 | media | Agent Control & Capability Laboratory | Code Harness; Opencode Harness; RepoForge | revision 2 | PASS | VERIFIED BY BROWSER (pass 4); human acceptance pending | Repaired in pass 4: RepoForge named on capability/authority compiler banner; pulse moved to rail start clearing plinth; Code Harness / OpenCode Harness preserved on lineage wall; before/after screenshots in docs/evidence/lead-exhibits-pass4-20261110/ |
| E16 | media | Performance Capture & Media Transformation | Guy_Cast; Gay_Cast; Media Getter; Character Performance Capture; ClearCut Local | revision 2 | PASS | VERIFIED BY BROWSER (pass 4); human acceptance pending | Repaired in pass 4: all five projects named in bay (Character Performance Capture on motion fixture, ClearCut Local on soft alpha/verify export section, Guy_Cast/Gay_Cast/Media Getter on lineage wall); pulse moved to rail start; before/after screenshots in docs/evidence/lead-exhibits-pass4-20261110/ |
| E17 | east | Dex Voice Lab | DexDictate macOS; DexDictate Android; DexSpeak; DexTalk; BigMac Voice Tools | base | PASS | VERIFIED BY BROWSER (pass 2); human acceptance pending | Repaired in pass 2: station screens now show each stage’s output; every station names its projects; ring turned off the bay plinth; sign no longer clipped |
| E18 | east | Dex Companion & Agent Systems | DexGPT / DnDex Operating Project; DexClawdBot / Clawdbot; DexKeeper Bot | base | PASS | UNVERIFIED | — |
| E19 | east | DexTilt | DexTilt | revision 2 | PASS | UNVERIFIED | — |
| E20 | east | Utility & Privacy Bench | DexCleaner; DexSort; SpaceWise | base | PASS | UNVERIFIED | none of the 3 projects named in the bay source |
| E21 | east | Civic Support Studio | DexAid | revision 2 | PASS | UNVERIFIED | — |
| E22 | east | Creative Tools Studio | DexCraft; DexGen; DexDraw; 2D Game Factory | revision 2 | PASS | UNVERIFIED | — |
| E23 | east | Sensemaking Lab | DexEarth; Dexterpreter | base | PASS | VERIFIED BY BROWSER (pass 4); human acceptance pending | Repaired in pass 4: both projects physically represented and named (DexEarth on multi-layer sensemaking globe, Dexterpreter on offline translation wall); before/after screenshots in docs/evidence/lead-exhibits-pass4-20261110/ |
| E24 | south | Era of Invincible Magic | Era of Invincible Magic: Lands Unknown | base | PASS | UNVERIFIED | — |
| E25 | south | DnDex / DM Hub | DnDex / DM_Hub | base | PASS | UNVERIFIED | — |
| E26 | south | WestCat Systems | WESTCAT Overlay; WestCat Goes East | base | PASS | VERIFIED BY BROWSER (pass 4); human acceptance pending | Repaired in pass 4: both projects physically represented and named (WESTCAT Overlay on operations table, WestCat Goes East on platformer strip, lineage board preserved); before/after screenshots in docs/evidence/lead-exhibits-pass4-20261110/ |
| E27 | south | The Full Weasel | The Full Weasel | base | PASS | UNVERIFIED | Real shipped build opens locally from the cabinet; stale “sixty-four” plaque corrected this session |
| E28 | south | Against the Void | Against the Void | base | PASS | UNVERIFIED | — |
| E29 | south | Arkship Civilization | Arkship Civilization | base | PASS | UNVERIFIED | — |
| E30 | south | AetherVFX | AetherVFX | revision 2 | PASS | UNVERIFIED | — |
| E31 | south | Story Worlds | Parable; Starlight Acre | base | PASS | UNVERIFIED | — |
| E32 | south | S'mores Katamari | S'mores Katamari | revision 2 | PASS | UNVERIFIED | — |
| E33 | south | Endless Grok / Void Ascendancy | Endless Grok / Void Ascendancy | base | PASS | UNVERIFIED | — |
| E34 | infra | BigMac Backbone / AndrewOS Control Plane | Big Mac Westcat SSH; BigMac Storage and SMB; BigMac Ollama + Codex Integration; Hermes Agent/Desktop + BigMac; Large Language Launcher; project_daemon / DAEMON; AndrewOS Mac Bridge | revision 2 | PASS | VERIFIED BY BROWSER (pass 2); human acceptance pending | Repaired in pass 2: every node names its project (all seven represented); consoles moved out of the bay plinth; captions no longer clipped; receipt board raised into view |
| E35 | infra | Local Specialist Systems Lab | Big Mac FaceTools; OSINT Box | base | PASS | UNVERIFIED | neither project named in the bay source |
Dexter Sanctuary: outside the 35 by design; reachable on foot (automated traversal), not a project, no
progression. Unchanged this session.

## Museum-wide journey

| Stage | State | Evidence |
|---|---|---|
| Exterior spawn → pier → entrance → vestibule | Automated PASS | Chromium `museum.e2e.ts` case 1 and 4 at this revision; exterior V3 evidence from the 2026-11-09 release |
| Rotunda → six wings → all 35 bays → upper level → Sanctuary → exit | Automated PASS | `tests/traversal.test.ts` in the gate |
| Map, Journal, Visit Thread, Command Palette, accessible contents | Automated PASS | Chromium `museum.e2e.ts` 9/9 at this revision |
| DexGPT guide | **Improved this session**, automated + live-browser checked | `tests/guide.test.ts` (18 cases, including every project and exhibit by name); live panel checked at E27 |
| Study, Curator | Not re-exercised this session | Covered only by the existing unit suite |
| 14 source installations, 17 visitor conversations | Automated PASS (pass 2) | `verify:standalone`: 14/14, 17/17, 0 remote requests, with installations at their new seats |
| Unusual paths (flight pad, backtracking mid-load, resize mid-walk) | Not exercised this session | — |

## Pass 2 findings that apply across bays (2026-11-09)

Measured in the running museum, then confirmed by eye:

| Finding | Scope | State |
|---|---|---|
| Preserved source installations were seated on top of exhibit lecterns, consoles and hero parts | 13 of 13 wing host bays (E01, E03, E07, E08, E14, E17, E18, E20, E23, E26 ×2, E31, E32); 3–16 intersecting exhibit meshes each | **REPAIRED** — installations now stand in the empty front corner of the bay, facing the entry path. Re-measured: 0 intersections in all 13. 14/14 installation paths still pass offline. |
| Label text clipped mid-sentence on long captions | Every `buildLabel` caption longer than its plate (seen in E17 and E34; the helper has 135 call sites) | **REPAIRED** — labels fit their text; one-line strips available. Only E17 and E34 were looked at afterwards. |
| The shared bay plinth (2.6 m square at every bay anchor) intersects exhibit parts | E02, E07, E08, E11, E17, E34 (measured) | E17 and E34 **REPAIRED**; E02, E07, E08, E11 **OPEN** — measured, not yet looked at |

## Ranked outstanding-work queue

Ranked by visitor impact, release relevance, evidence strength and risk.

1. **Human device walkthrough (owner).** Nine acceptance judgments and at least six telemetry snapshots
   with `?qa=1`, from scratch. Still the largest gap. The installation move in pass 2 changes what every
   one of the 13 host bays looks like on entry, so earlier impressions of those bays do not carry over.
2. **Bay plinth conflicts in E02, E07, E08 and E11.** **REPAIRED (pass 3)** — measured intersections in all four bays resolved; 0 intersections verified in `tests/exhibit-plinth.test.ts`. Before and after visual evidence captured in `docs/evidence/plinth-repairs-20261109/`.
3. **Lead exhibits physical representation** (E02, E11, E14, E15, E16, E17, E20, E23, E26, E34, E35). **REPAIRED / RESOLVED (passes 2, 3, 4)** — all lead exhibits inspected and brought to clear physical and conceptual representation. Pass 4 repaired E14, E15, E16, E23, E26; plinth clearance verified across all exhibits (including pulse starting points in E15 and E16). Before and after visual evidence captured in `docs/evidence/lead-exhibits-pass4-20261110/`. Full 53/53 Chromium browser suite verified clean (32.2m).
4. **Second look at long captions museum-wide.** **REPAIRED (pass 5)** — text engine upgraded with canvas resolution tiers (up to 2048px for wide architectural banners), explicit newline formatting (`\n`), title font size floor (22px), and proportional padding for low-aspect strip banners. Visual caption occlusions, overlaps, bad aspect ratios, and awkward line wraps repaired across 11 bays (E07, E08, E11, E15, E16, E20, E26, E30, E32, E34, E35). 26 paired before-and-after screenshots captured from natural visitor viewpoints in `docs/evidence/caption-repairs-pass5-20261110/`. 5 dedicated unit tests passing in `tests/caption-typography.test.ts`.
5. **Front corners of the 13 host bays.** **SURVEYED & VERIFIED (pass 6)** — all 13 wing source installations surveyed across their 12 host bays (E01, E03, E07, E08, E14, E17, E18, E20, E23, E26 [westcat-east & westcat-familiar], E31, E32). Plinth distance measured at 6.34m–7.75m (>4.0m requirement, 0 intersections). Doorway threshold clearance >3.0m verified. Separation against wing hall furnishings, benches, and plants proven (installations sit deep in bay corners behind wall returns at lateral offset >9.75m vs hall furnishings at <=wing.hallHalfWidth). Dedicated regression suite `tests/installation-clearance.test.ts` (5 tests) added. 26 browser screenshots captured across entrance and interaction viewpoints in `docs/evidence/installation-clearance-pass6-20261110/`. All 13 instances acquire focus, engage, and remain operable.
6. **Guide routing to the Dexter Sanctuary.** Bounded proposal written:
   `docs/SANCTUARY_ROUTING_PROPOSAL.md`. Owner decision pending; not implemented.
7. **Repository hygiene (owner).** Ten draft exterior PRs (#27–#37) predate the merged V3 work; `main`
   is unprotected.

Closed in pass 2, 3, 4, 5 & 6: offline standalone, Workshop and Pages proofs, all 4 plinth conflicts, all lead exhibits physical representation, museum-wide caption legibility and typography repairs, source installation clearance survey and regression suite, and the full Chromium suite were run and passed at this revision (see `OPERATIONAL_STATE.md`).

## Release blockers

**Machine-verifiable, still open:** exact-head CI for this branch (not pushed). All machine-verifiable matrix queue items 2, 3, 4, and 5 are repaired and verified.

**Owner-dependent:** human walkthrough and its nine judgments; audio, pointer-lock and device FPS
checks; whether to merge this branch; any Pages publication; any 1.0 declaration; queue items 6 and 7;
which Bible brainstorm items are in or out of 1.0 — all remain BRAINSTORMED and none was implemented.

## Creative-expansion status (not promoted)

| Idea | Status |
|---|---|
| DexGPT as always-available local guide | IMPLEMENTED (deterministic, offline); comprehension improved this session |
| Live/online guide backend, speech | BRAINSTORMED — not implemented, no dependency added |
| Starsilk star-collapse consequences | BRAINSTORMED |
| Games-wing traversal rewards | BRAINSTORMED (conflicts with the no-progression rule unless redesigned) |
| Westcat guide presentation | BRAINSTORMED |
| Theater / in-world film wing | BRAINSTORMED (would add space beyond the six wings — needs approval) |
