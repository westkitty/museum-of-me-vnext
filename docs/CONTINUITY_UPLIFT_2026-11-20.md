# Continuity, Design & Implementation Uplift — 2026-11-20

**Status: ACTIVE DEVELOPMENT / PRE-1.0.** Local working-tree change only: nothing committed, pushed,
merged or deployed. Human acceptance has not been recorded for any item below.

## Baseline

| Fact | Value |
|---|---|
| Repository | `westkitty/museum-of-me-vnext` |
| Branch / HEAD at start | `claude/new-session-wyjula` at `666869587009e27ffd38a02ca1a181c0bc7419ca` (= `main` #60), clean worktree |
| Canonical Bible read | `westkitty/ChatGPT_Bible_Repo` `bibles/Museum_of_Me_Bible.md` at `61a2711`, last museum entry 2026-11-14. It has **no entries for merged #58, #59, #60** (continuity gap, recorded, not filled in by inference). |
| Runtime | Three.js 0.185.1, Vite 6 dev server, headless Chromium (Playwright 1.62.1, SwiftShader WebGL) |
| Baseline checks | `tsc` PASS; Vitest 1040/1040 (110 files) |

Live traversal was driven through the real app: real keyboard events into `InputManager`, the real
`PlayerController`, collision, world handoff and streaming, with the render loop stepped explicitly
(the established method in `tests/browser/museum.e2e.ts`). Steering used direct yaw (the mouse-look
equivalent); movement used held keys. Areas walked: arrival plaza → forecourt → doors → vestibule →
south hall → Rotunda; every wing via the guide floor line (E01, E04, E09, E14, E20, E27, E35); both
grand stairs up and down; balcony; the Sanctuary ramp and chamber; map, journal, settings, thread,
curator, study, contents (H), command palette, DexGPT; 1280×720, 844×390 and touch mode.

## Defect ledger (6 confirmed, all repaired)

| ID | Severity | Location | Reproduction | Expected vs observed | Root cause | Repair | Verification |
|---|---|---|---|---|---|---|---|
| D03 | **Severe** (traversal / softlock of level change) | `src/world/Museum.ts` balcony + stairs | Climb either grand stair, turn round, walk back down the treads | Walk down to the Rotunda floor / stays at y = 10 walking over thin air across the whole flight; no on-foot way back down. Climbing up passes the camera through the balcony slab. | The balcony ring slab (visual `ExtrudeGeometry` and its collision strips) covers the annulus 11–16 m at y = 10, and both stairs (r = 13.8 ± 1.6) rise underneath it. `supportHeight` returns the highest surface within step-up, i.e. the slab. The stair landing collider was also laid back over the top 1.5 m of treads. `tests/traversal.test.ts` passed because its walker settled each waypoint onto any surface up to 5 m above and never flagged a fall. | Open railed well over the upper flight (`t ≥ 0.7`, 2.3 m headroom kept below): shared `isOverStairOpening` / `stairOpeningOutline` in `layout.ts` drive the slab hole and a collision mask; outward-only landing; guard rails on both long sides and a low-end rail run to the balustrade (a thin rail let the capsule be squeezed through). Balcony routes now use the walkable north arc (`BALCONY_WALK_FACES`) and the real stair landings. Test walkers (`tests/helpers/walk.ts`, `VisitorJury`) now settle at the declared height and fail on >1 m drops. | Real Chromium: before — after descending, y = 10 on the balcony; after — y = 0.58 at the stair foot (`D03-*` captures). New unit regression cases; canonical traversal, jury, guide-route suites pass. |
| D01 | Major (first impression) | `CinematicArrival.ts`, `HUD.ts` | Load `/` | One welcome / two title cards drawn on top of each other (dialog + HUD arrival card) | HUD lock prompt stayed visible under the modal dialog | HUD defers its card (`setCinematicArrivalActive`) while the dialog is open; inert HUD corner text hidden under it | Browser e2e D01/D05; `D01-arrival-before/after` |
| D05 | Major (mobile) | `cinematic-arrival.css` | 844×390 landscape phone | Enter button visible / off-screen inside an overflowing dialog | Fixed vertical rhythm and 7 rem title | Viewport-height-bounded title; short-height layout | Measured: before `buttonVisible:false, overflowY:true`; after `true/false` (desktop and portrait also checked) |
| D02 | Moderate | `HUD.ts`, `museum.css` | Enter, release mouse | Key hints readable / "CLICK TO RESUME MOUSE LOOK" (and touch "Museum") button covers the second hints line | Both absolutely positioned bottom-right | `hud--corner-action` lifts hints above the button | Browser e2e: no rect overlap |
| D04 | Moderate (keyboard a11y) | `DomMirror.ts` | Press H, then Escape, then W | Return to museum / contents stay on screen and movement keys are dead (focus left on a link, which owns its keys) | No Escape handling in the contents mirror | Escape (and a new button) drops focus back to the museum; listener removed on dispose | Browser e2e: focus = body and the visitor moves 1.5 m |
| D06 | Moderate (camera clipping) | `EnvironmentDressing.ts` | Guide to E09 | Arrive looking into the bay / eye inside a potted tree's canopy | Hall plants and pedestals spaced evenly with no regard for bay openings | `alongClearOfBayOpenings` keeps them against solid wall | Measured mesh containment at arrival; unit test over all 35 doorways; `D06-*` captures |

## Improvement ledger (21 implemented)

Evidence states: **VERIFIED (browser)** = exercised in real Chromium by test or capture;
**VERIFIED (unit)** = automated only. None has human acceptance.

| # | Title | Weakness observed | Change | Visitor benefit | Files | Risk | Acceptance test | State |
|---|---|---|---|---|---|---|---|---|
| I1 | Grand stairs on the map | Neither floor plan showed any stairs | Both arcs drawn from `STAIRS`; ground "Stairs up", upper "Stairs down" at the landings | Can see how floors connect | `MapPanel.ts` | Low | e2e I1; `I1-map-*` | VERIFIED (browser) |
| I2 | Physical stair signage | Nothing at either stair said where it goes | Wall signs at both feet (upper wings by name) and both landings ("Stairs down to the Rotunda") | Wayfinding in space, not HUD | `Detailing.ts` | Low (non-colliding) | unit sign placement/facing; capture | VERIFIED (browser capture) |
| I3 | Return-to-hub signs | Five halls end at a blank wall | "Back to the Rotunda" sign on each dead-end hall wall | Dead ends read as turn-around points | `Detailing.ts` | Low | unit; capture | VERIFIED (browser capture) |
| I4 | Floor in the HUD location | Location never said which floor | "Ground floor / Upper floor / Lower level · …" from zone authority | Orientation on two levels + Sanctuary | `HUD.ts` | Low | e2e I4 | VERIFIED (browser) |
| I5 | Arrival names the room | "You have arrived." only | Names exhibit and next action | Confirms the right place | `UILayer.ts`, `App.ts` | Low | e2e (E14) | VERIFIED (browser) |
| I6 | Guide start says where and how far | "Follow the floor lights to X." | Adds floor, walking metres (existing route planner) and "up/down a grand stair" | Sets expectations before walking | `UILayer.ts` | Low | capture text "about 155 m" | VERIFIED (browser) |
| I7 | Threshold copy in visitor language | "Enter museum begins preparation; its galleries are not loaded yet." | Plain, calm phrasing for each phase | Less engineering jargon at the door | `WorldDirector.ts`, `predictive-interior.e2e.ts` | Low | capture | VERIFIED (browser) |
| I8 | Arrival composition | Title sat over the facade/portal | Welcome anchored low, lighter top gradient | Building is the first view | `cinematic-arrival.css` | Low | before/after capture | VERIFIED (browser capture); taste pending |
| I9 | HUD hint legibility | Hints sat on pale floors with thin shadow | Backing plate; contrast and reduced-transparency variants | Readable on every floor | `museum.css` | Low | capture | VERIFIED (browser capture) |
| I10 | Interaction cue settle | Cue appeared with an opacity flick only | 260 ms settle, collapsed by both reduced-motion paths | Notice when something can be used | `museum.css` | Low | computed `animationName` = `hud-cue-arrive` | VERIFIED (browser) |
| I11 | Panel command styling | Curator/map/settings buttons were browser-default grey | One museum style, focus ring, forced-colors, disabled | Consistent, visible focus | `museum.css` | Low | captures | VERIFIED (browser capture) |
| I12 | Project lifecycle stages | Status was free text only | Stage chip per project (status text kept) + room summary "1 active · 2 superseded" | Living vs historical at a glance | `projectStage.ts`, `ExhibitReading.ts`, `museum.css` | Low | unit (all 73 statuses classify); e2e | VERIFIED (browser) |
| I13 | Related rooms | No cross-room links | Rooms holding a project of the exact same `family`, each openable | Source-supported connections | `ExhibitReading.ts`, `DeepPanel.ts` | Low | unit | VERIFIED (unit); e2e conditional |
| I14 | Where to find it | Reading said wing only | Floor + walking distance / stairs from the visitor | Decide whether to walk now | `ExhibitReading.ts`, `UILayer.ts` | Low | e2e "about N m on foot" | VERIFIED (browser) |
| I15 | DexGPT stair directions from where you stand | Generic Rotunda paragraph regardless of floor | Position-aware answer naming the nearer stair end | Practical help without a new route authority | `DeterministicMuseumGuide.ts`, `UILayer.ts` | Low (deterministic, local) | unit + e2e | VERIFIED (browser) |
| I16 | DexGPT contextual first question | Static suggestion list | First chip fits the floor ("How do I get downstairs?") | Discoverability | `MuseumGuidePanel.ts`, `UILayer.ts` | Low | e2e | VERIFIED (browser) |
| I17 | Contents: floor and route per wing | Text contents did not say which floor or how to get there | Floor line under each wing | Non-visual route understanding | `DomMirror.ts` | Low | e2e | VERIFIED (browser) |
| I18 | Contents: explicit exit | No visible way back from the contents | "Back to the museum (Escape)" button | Accessible exit path | `DomMirror.ts`, `museum.css` | Low | e2e | VERIFIED (browser) |
| I19 | Restore default settings, with undo | No way back from a bad combination | One button restores every comfort setting; one-step undo | Recovery without clearing storage | `SettingsPanel.ts` | Low | e2e (FOV 80 → 65 → 80) | VERIFIED (browser) |
| I20 | Touch menu parity | Contents (H) and Curator (C) had no touch entry; no way to clear the line | Added "Read every exhibit (text)", "Curator Desk", "Clear the floor line" | Touch visitors reach the same tools | `UILayer.ts` | Low | e2e | VERIFIED (browser) |
| I21 | Lifecycle stages in indexes | Index lists showed bare names | Non-active stages appended in collection page and contents | Scan history across the building | `CollectionPage.ts`, `DomMirror.ts` | Low | unit | VERIFIED (unit) |

Candidates examined and not counted: Dexter Sanctuary (reached on foot, nothing defective; canon-sensitive,
left unchanged), wildlife, performance (no measured bottleneck in this pass), Starsilk presentation
(no authorised source change identified). The proposed Sanctuary guide routing remains **PROPOSED**.

## Quality

| Check | Result |
|---|---|
| `npm run gate` | PASS — typecheck, lint, 1052/1052 tests (111 files), all validators, build, budgets, `verify:dist` |
| Full Chromium suite (`npx playwright test`) | PASS — 82/82 (16.3 min), incl. 5 new `continuity-uplift.e2e.ts` cases |
| `build:standalone` + `verify:standalone` | PASS — 14/14 installations, 17/17 visitors, 0 remote requests |
| Not run | `test:workshop`, Pages build/verify, `perf:device`, exact-head CI |

Performance: no performance claim is made. The change adds 8 sign meshes, 10 rail segments and their
colliders; budget checks in the gate pass.

Visual evidence: `docs/evidence/continuity-uplift-20261120/` (1280×720 unless named; SwiftShader, so
colour and lighting are approximate).

Verdict: **VERIFIED UPLIFT** for automated and headless-browser evidence — repairs 6, improvements
implemented 21, improvements verified 21 (19 in the browser, 2 by unit test), known regressions 0.
Bible state: temporary note only. Publication state: nothing committed, pushed or deployed. Human
acceptance remains pending.

## Remaining limitations

- Human visual acceptance, representative-device FPS, audio and real pointer-lock remain UNKNOWN.
- The south balcony pocket (S face between the two wells) is no longer reachable on foot: the stairs
  occupy the ring there. It held no exhibit, sign or required route; owner may wish to review.
