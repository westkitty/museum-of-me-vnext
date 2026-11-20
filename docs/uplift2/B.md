# Uplift 2 — sub-agent B: interpretation and reading surfaces

**Status: ACTIVE DEVELOPMENT / PRE-1.0.** Local commit in a worktree only; nothing pushed, merged or deployed.
No human acceptance recorded. Base: `728fdea` (uplift 1). None of uplift 1's I12–I21 is repeated.

All relationships below are derived from `src/content/collection.generated.ts` (new module
`src/content/readingRelations.ts`). No project fact, date, link or canon was added. Starsilk content is
only presented differently (shared-repository connections), not extended.

## Improvements (8)

| # | Title | Weakness observed (evidence) | Change | Files | Test | State |
|---|---|---|---|---|---|---|
| B1 | Room outline and project anchors | E34 holds 7 projects (E11 6, E16/E17/E22 4–5) as one long scroll with no way to jump; no section could be linked | "Projects in this room" nav (authored `projectIds` order, kind + stage) with jump links; every project section has a readable id (`#project-worldsvault`), a focusable heading and a "Back to the projects in this room" link; in-world jumps never touch the URL | `ExhibitReading.ts`, `readingRelations.ts`, `uplift2-b.css` | unit B1; browser: 7 links on E34, jump focuses `project-…-title`, back focuses outline, hash unchanged in 3D | VERIFIED (browser) |
| B2 | Connections in the record | Only same-family links existed; the `Starsilk / Drakken` family links almost every north room, hiding the precise ones. Probe found 6 repositories listed by two projects in different rooms, 5 by-name references, 2 identical capabilities across rooms | Per project "Connections in the record": shared public repository, one record naming another (merged when mutual), identical capability in another room. Cross-room items open that room; in-room items jump to the section | `readingRelations.ts`, `ExhibitReading.ts` | unit B2 (symmetry, all real records, no self links); browser: E01 lists E04/E05/E08 shared repos, clicking opens E04; E10 "CanonForge … name each other" | VERIFIED (browser) |
| B3 | Source presentation | Repository links were an unlabelled list at the very end, opened a new tab without saying so, and projects with no repository said nothing | Room meta "Sources: N public repositories · k of n projects without one"; per project "Source" heading; links named "… on GitHub (opens in a new tab)" with a visual ↗; explicit "No public repository is listed" | `ExhibitReading.ts`, `readingRelations.ts` | unit B3; browser: E01 "3 public repositories", accessible name checked | VERIFIED (browser) |
| B4 | Lectern states unfinished / superseded work | Physical lectern listed names only; stages were visible only in the DOM reading | Lectern "Represents" line uses `projectNameWithStage` ("WorldsVault Uplink (superseded), CanonForge (superseded), WorldsVault"); status text unchanged | `Furniture.ts`, `readingRelations.ts` | unit B4; browser text-fit measurement with the lectern's own font/size/width: tallest lectern (E34) ends at 636 px of 740 before and after, no room overflows | VERIFIED (unit + browser measurement); in-world visual not captured |
| B5 | Journal: where you have been | Journal listed entries only; no way to see which rooms of a wing were still unseen or to reach them | "Where you have been": per wing (with floor) a collapsible list of opened and not-yet-opened rooms, each opening its reading (which carries "Guide me there"). Counts are information, no percentage, score or badge | `JournalPanel.ts`, `readingRelations.ts` | unit B5; browser: 6 wing summaries, a not-opened room button opens its reading | VERIFIED (browser) |
| B6 | Visit Thread clarity | Stops showed wing only; nothing said a route changes floor, nor where in the route the visitor is | Floor per stop, "Up/Down a grand stair" marker between stops that change floor (preview, route and copied text), "Stop n of m · Next:" and a route floor summary | `VisitThreadPanel.ts`, `readingRelations.ts` | unit B6; browser: authored tour "Stop 1 of 3", one stair-climb marker, floors listed | VERIFIED (browser) |
| B7 | Collection page find, jump, deep links, print | Text-only collection (no WebGL) had no search, no wing jump links, anchors were ignored on load, related rooms were not links there, print had dark nav/UI | Find box (shared `collectionSearch`, live count, `?q=` deep link), "Wings" jump nav, `#room-E17`/`#wing-…` anchors, focus to `#project-…` on load, print stylesheet (hides nav/controls, prints repo URLs) | `CollectionPage.ts`, `ExhibitReading.ts`, `uplift2-b.css` | unit B7; browser: "1 of 35 rooms match “dictation”", clearing restores 35 and drops `q`, `?exhibit=E10#project-worldsvault` focuses that heading, print hides nav and appends `github.com/…`; 0 external requests | VERIFIED (browser) |
| B8 | Study Lab tabs and field names | Tab buttons used `aria-selected` without `role=tab`, had raw lower-case ids as names, no tabpanel, no arrow keys; goal, collection-name, compare, queue and colour fields had no accessible name | `role=tab`/`tablist`/`tabpanel`, roving tabindex, Left/Right/Home/End, visible names ("Reading queue"), `aria-label` on every unlabelled field | `StudyPanel.ts` | unit B8; browser: 5 named tabs, ArrowRight selects Collections, "Comparison slot 1" combobox found | VERIFIED (browser) |

## Defect repaired (not counted)

| ID | Location | Reproduction | Root cause | Repair | Verification |
|---|---|---|---|---|---|
| BD1 | `DeepPanel.openFor` | Open E01's deeper reading, click a "Related rooms" entry | Panel title stayed "Starsilk Universe": `open()` returns early when already open, so the new room never rendered. Uplift 1's e2e check passed because the link text it looked for was already on screen | Re-render in place, scroll to top, keep focus in the dialog | Browser: before `changed:false`; after title "Drakken Terraforming Compendium" |

## Checks

- `npx tsc --noEmit` PASS; `npx eslint . --max-warnings 0` PASS; `tests/uplift2-b.test.ts` 13/13; full `npx vitest run` PASS 1065/1065 (112 files).
- Browser: own Vite server on 4182, headless Chromium (SwiftShader); 12/12 scripted checks pass, no page errors.
- Not run (per brief): `npm run test:e2e`, `npm run gate`.

Evidence: `docs/evidence/uplift2-b/` (B1, B2-B3, B5, B6, B7 find + print, B8).

## Limits

- Lectern stage text is measured, not photographed in-world.
- Collection-page "Wings" jump links stay visible for wings hidden by a search.
- Shared files (`UILayer.ts`, `App.ts`, `HUD.ts`, `museum.css`) were not edited.
