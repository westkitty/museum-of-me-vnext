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
| E02 | north | Drakken Terraforming Compendium | Drakken Terraforming Compendium; Drakken Field Anatomy Archive | revision 2 | PASS | UNVERIFIED | P006 not named in the bay source; MEASURED (pass 2): an exhibit part intersects the bay plinth |
| E03 | north | Orbital Tomb | Orbital Tomb | base | PASS | UNVERIFIED | — |
| E04 | north | Starsilk Possibility Cartographer | Starsilk Possibility Cartographer | base | PASS | UNVERIFIED | — |
| E05 | north | StarSilk Maker | StarSilk Maker | base | PASS | UNVERIFIED | — |
| E06 | north | Starsilk Compendium: Character & Canon Archive | Starsilk Compendium | revision 2 | PASS | UNVERIFIED | — |
| E07 | north | Drakken Terraforming Laboratory | The Drakken Terraforming Laboratory | revision 2 | PASS | UNVERIFIED | MEASURED (pass 2): an exhibit part intersects the bay plinth |
| E08 | north | Heliocide Observatory | Heliocide Observatory | base | PASS | UNVERIFIED | MEASURED (pass 2): an exhibit part intersects the bay plinth |
| E09 | west | Museum Evolution | Museum of Me / The Reliquary of Iterative Becoming; Modern 3D Browser Game Toolkit | revision 2 | PASS | UNVERIFIED | — |
| E10 | west | WorldsVault Lineage | WorldsVault Uplink; CanonForge; WorldsVault | base | PASS | UNVERIFIED | — |
| E11 | west | Selfsame: Continuity & Authority Systems | KinDex Handoff; ChatGPT Bible Repo; Project Forge; He-Maker; Selfsame; Project Sentinel | revision 2 | PASS | UNVERIFIED | 3 of 6 lineage projects not named in the bay source; MEASURED (pass 2): an exhibit part intersects the bay plinth |
| E12 | west | Rhetorical InDEX | Rhetorical InDEX | revision 2 | PASS | UNVERIFIED | — |
| E13 | media | Suno Studio | Suno AI Lyrics and Manual | base | PASS | UNVERIFIED | — |
| E14 | media | Promptcraft & Vibe Coding | Visual Prompt Systems Registry; Vibe Coding Nexus / DexGate Academy; DexEnhance | revision 2 | PASS | UNVERIFIED | 2 of 3 projects not named in the bay source |
| E15 | media | Agent Control & Capability Laboratory | Code Harness; Opencode Harness; RepoForge | revision 2 | PASS | UNVERIFIED | RepoForge named only through copy; predecessors on wall label |
| E16 | media | Performance Capture & Media Transformation | Guy_Cast; Gay_Cast; Media Getter; Character Performance Capture; ClearCut Local | revision 2 | PASS | UNVERIFIED | P069/P070 drive the mechanism but are not named on a label |
| E17 | east | Dex Voice Lab | DexDictate macOS; DexDictate Android; DexSpeak; DexTalk; BigMac Voice Tools | base | PASS | VERIFIED BY BROWSER (pass 2); human acceptance pending | Repaired in pass 2: station screens now show each stage’s output; every station names its projects; ring turned off the bay plinth; sign no longer clipped |
| E18 | east | Dex Companion & Agent Systems | DexGPT / DnDex Operating Project; DexClawdBot / Clawdbot; DexKeeper Bot | base | PASS | UNVERIFIED | — |
| E19 | east | DexTilt | DexTilt | revision 2 | PASS | UNVERIFIED | — |
| E20 | east | Utility & Privacy Bench | DexCleaner; DexSort; SpaceWise | base | PASS | UNVERIFIED | none of the 3 projects named in the bay source |
| E21 | east | Civic Support Studio | DexAid | revision 2 | PASS | UNVERIFIED | — |
| E22 | east | Creative Tools Studio | DexCraft; DexGen; DexDraw; 2D Game Factory | revision 2 | PASS | UNVERIFIED | — |
| E23 | east | Sensemaking Lab | DexEarth; Dexterpreter | base | PASS | UNVERIFIED | neither project named in the bay source |
| E24 | south | Era of Invincible Magic | Era of Invincible Magic: Lands Unknown | base | PASS | UNVERIFIED | — |
| E25 | south | DnDex / DM Hub | DnDex / DM_Hub | base | PASS | UNVERIFIED | — |
| E26 | south | WestCat Systems | WESTCAT Overlay; WestCat Goes East | base | PASS | UNVERIFIED | WESTCAT Overlay not named in the bay source |
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
2. **Bay plinth conflicts in E02, E07, E08 and E11.** Measured intersections between an exhibit part and
   the bay plinth; same class of defect repaired in E17 and E34. Look, then move the offending part.
3. **Look at the remaining nine "Lead" exhibits** (E02, E11, E14, E15, E16, E20, E23, E26, E35) for
   projects that are named only on the lectern. E17 and E34 showed the pattern is real: both had
   projects with no presence in the bay.
4. **Second look at long captions museum-wide.** The clipping repair is global, but only E17 and E34
   were viewed after it. Some captions may now be set small; a strip aspect may suit them better.
5. **Front corners of the 13 host bays.** Installations now stand there. Checked by measurement against
   exhibit geometry and by eye in E17 only; wing furnishings in those corners were not surveyed.
6. **Guide routing to the Dexter Sanctuary.** Bounded proposal written:
   `docs/SANCTUARY_ROUTING_PROPOSAL.md`. Owner decision pending; not implemented.
7. **Repository hygiene (owner).** Ten draft exterior PRs (#27–#37) predate the merged V3 work; `main`
   is unprotected.

Closed in pass 2: offline standalone, Workshop and Pages proofs and the full Chromium suite were run at
this revision (see `OPERATIONAL_STATE.md`).

## Release blockers

**Machine-verifiable, still open:** queue items 2–5; exact-head CI for this branch (not pushed).

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
