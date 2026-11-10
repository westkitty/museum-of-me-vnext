# Museum of Me — Completion Matrix and Outstanding-Work Queue

**Status: ACTIVE DEVELOPMENT / PRE-1.0. Verdict for this revision: PARTIAL.**
Written 2026-11-09 against starting SHA `a96d2f74bc2057d25a6cc324c4f79a4588144a16` (`main`, equal to `origin/main`)
plus the local branch `feat/completion-guide-and-drift-20261109`.

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
| E02 | north | Drakken Terraforming Compendium | Drakken Terraforming Compendium; Drakken Field Anatomy Archive | revision 2 | PASS | UNVERIFIED | P006 not named in the bay source |
| E03 | north | Orbital Tomb | Orbital Tomb | base | PASS | UNVERIFIED | — |
| E04 | north | Starsilk Possibility Cartographer | Starsilk Possibility Cartographer | base | PASS | UNVERIFIED | — |
| E05 | north | StarSilk Maker | StarSilk Maker | base | PASS | UNVERIFIED | — |
| E06 | north | Starsilk Compendium: Character & Canon Archive | Starsilk Compendium | revision 2 | PASS | UNVERIFIED | — |
| E07 | north | Drakken Terraforming Laboratory | The Drakken Terraforming Laboratory | revision 2 | PASS | UNVERIFIED | — |
| E08 | north | Heliocide Observatory | Heliocide Observatory | base | PASS | UNVERIFIED | — |
| E09 | west | Museum Evolution | Museum of Me / The Reliquary of Iterative Becoming; Modern 3D Browser Game Toolkit | revision 2 | PASS | UNVERIFIED | — |
| E10 | west | WorldsVault Lineage | WorldsVault Uplink; CanonForge; WorldsVault | base | PASS | UNVERIFIED | — |
| E11 | west | Selfsame: Continuity & Authority Systems | KinDex Handoff; ChatGPT Bible Repo; Project Forge; He-Maker; Selfsame; Project Sentinel | revision 2 | PASS | UNVERIFIED | 3 of 6 lineage projects not named in the bay source |
| E12 | west | Rhetorical InDEX | Rhetorical InDEX | revision 2 | PASS | UNVERIFIED | — |
| E13 | media | Suno Studio | Suno AI Lyrics and Manual | base | PASS | UNVERIFIED | — |
| E14 | media | Promptcraft & Vibe Coding | Visual Prompt Systems Registry; Vibe Coding Nexus / DexGate Academy; DexEnhance | revision 2 | PASS | UNVERIFIED | 2 of 3 projects not named in the bay source |
| E15 | media | Agent Control & Capability Laboratory | Code Harness; Opencode Harness; RepoForge | revision 2 | PASS | UNVERIFIED | RepoForge named only through copy; predecessors on wall label |
| E16 | media | Performance Capture & Media Transformation | Guy_Cast; Gay_Cast; Media Getter; Character Performance Capture; ClearCut Local | revision 2 | PASS | UNVERIFIED | P069/P070 drive the mechanism but are not named on a label |
| E17 | east | Dex Voice Lab | DexDictate macOS; DexDictate Android; DexSpeak; DexTalk; BigMac Voice Tools | base | PASS | UNVERIFIED | none of the 5 voice projects named in the bay source |
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
| E34 | infra | BigMac Backbone / AndrewOS Control Plane | Big Mac Westcat SSH; BigMac Storage and SMB; BigMac Ollama + Codex Integration; Hermes Agent/Desktop + BigMac; Large Language Launcher; project_daemon / DAEMON; AndrewOS Mac Bridge | revision 2 | PASS | UNVERIFIED | 5 of 7 projects not named in the bay source |
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
| 14 source installations, 17 visitor conversations | Not re-run this session | `verify:standalone` not run (see blockers) |
| Unusual paths (flight pad, backtracking mid-load, resize mid-walk) | Not exercised this session | — |

## Ranked outstanding-work queue

Ranked by visitor impact, release relevance, evidence strength and risk.

1. **Human device walkthrough (owner).** Nine acceptance judgments and at least six telemetry snapshots
   with `?qa=1`, from scratch. This is the largest remaining gap and cannot be done by automation.
2. **Run the offline and Workshop proofs at this revision.** `build:standalone`, `verify:standalone`,
   `test:workshop`, `build:pages`, `verify:pages-dist` were not run this session. Earlier sessions hit a
   managed-Chromium `file://` block; system Chrome via `MUSEUM_BROWSER_EXECUTABLE` worked for the
   Playwright suite here and may unblock these.
3. **Look at the eleven "Lead" exhibits in a real browser** (E02, E11, E14, E15, E16, E17, E20, E23,
   E26, E34, E35) and decide, per bay, whether a lineage project that is only named on the lectern needs
   a physical label or object. Start with E17 (five voice projects) and E34 (seven infrastructure
   projects), where the gap between "represents" and "shows" is widest.
4. **Full Chromium suite.** Only `tests/browser/museum.e2e.ts` (9 cases) was run here; the wider
   52-case suite including exterior evidence capture was not.
5. **Guide cannot route to the Dexter Sanctuary.** It now explains where the Sanctuary is, but
   wayfinding targets are exhibits only. Adding a non-exhibit target touches the map/wayfinding
   contract and the Sanctuary's "nothing to complete" rule — owner decision before implementation.
6. **Second-person visual pass of each wing** for clipping, unreadable labels and weak compositions.
   No such defect is recorded; none was looked for bay-by-bay this session.
7. **Repository hygiene (owner).** Ten draft exterior PRs (#27–#37) predate the merged V3 work; `main`
   is unprotected. Closing or keeping them is an owner call.

## Release blockers

**Machine-verifiable, still open:** queue items 2 and 4 at this exact revision; exact-head CI for this
branch (not pushed).

**Owner-dependent:** human walkthrough and its nine judgments; audio, pointer-lock and device FPS
checks; whether to merge this branch; any Pages publication; any 1.0 declaration; queue items 5 and 7;
which Bible brainstorm items (star-collapse consequences, Games-wing traversal rewards, Westcat guide
presentation, theater wing, live guide backend) are in or out of 1.0 — all remain BRAINSTORMED and
none was implemented.

## Creative-expansion status (not promoted)

| Idea | Status |
|---|---|
| DexGPT as always-available local guide | IMPLEMENTED (deterministic, offline); comprehension improved this session |
| Live/online guide backend, speech | BRAINSTORMED — not implemented, no dependency added |
| Starsilk star-collapse consequences | BRAINSTORMED |
| Games-wing traversal rewards | BRAINSTORMED (conflicts with the no-progression rule unless redesigned) |
| Westcat guide presentation | BRAINSTORMED |
| Theater / in-world film wing | BRAINSTORMED (would add space beyond the six wings — needs approval) |
