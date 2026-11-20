# Uplift 2 — sub-agent C: interior wayfinding, map and architectural readability

**Status: ACTIVE DEVELOPMENT / PRE-1.0.** One local commit on the C worktree, based on `728fdea`. Nothing pushed,
merged or deployed. There is no human acceptance for any item.

Evidence states: **VERIFIED (browser)** means it was exercised in headless Chromium (SwiftShader) against the real app
on port 4183. **VERIFIED (unit)** means it was checked by `tests/uplift2-C.test.ts`. Captures are in
`docs/evidence/uplift2-C/` (1280×720; colour and lighting are approximate).

## Defects repaired (not counted in the 8)

| ID | Defect | Evidence | Repair | Test | State |
|---|---|---|---|---|---|
| C-D1 | On the grand stairs the guide floor line was hidden inside the treads. | Markers were set on the stair ramp collision, which lies up to one riser (0.42 m) below the visible tread. A capture of the stair approach showed no markers on the treads. With the repair removed, the new raycast test fails. | `stairTreadTopY()` in `Wayfinding.ts` lifts a marker over a flight to the top of the tread under it. The tread layout follows `Museum.buildStairs`/`GeometryKit.stair`. Layout and stair definitions are unchanged. | Unit: raycasts down onto the real built stair meshes at every visible marker while walking up the SE flight (more than 20 samples). Each marker must sit on or just above the hit surface. Browser: marker y values on the SE flight were 3.01, 4.26, 5.51, 6.76, 8.01, 9.26, which are tread tops. | VERIFIED (unit + browser) |
| C-D2 | Viewed from the ground floor, the upper-floor plan drew the visitor's solid "you" marker as if they were upstairs. | `C1-map-upper-route-to-E35-before-D2-fix.jpg` | On the other floor's plan the marker is now a hollow, dashed ring titled "You are on the ground floor, below". It has its own key entry. | Browser: `.map__you-elsewhere` = 1 and `circle.you` = 0 on the other floor. The existing `.you-heading` e2e expectations on the visitor's own floor are untouched. | VERIFIED (browser) |

## Improvements (8)

| # | Title | Weakness observed | Change | Files | Test | State |
|---|---|---|---|---|---|---|
| C1 | Map draws the real planned route | The map computed a route only to print a distance. The plan showed no path, so visitors could not see how to reach a target. | `routeForLevel()` splits the same `planVisitorRoute` result that the floor line walks into lines for each floor. A stair leg is cut where it crosses the plan threshold. The route is drawn as a dashed polyline. From outside, the interior part starts at the front door. | `MapPanel.ts`, `uplift2-C.css` | Unit: a two-floor route to E35 has exactly one floor change, continues at the same point on both plans, ends at the E35 doorway, and the change lies on a grand stair. A same-floor route stays on one plan. Browser: one route line and one change marker on each plan. | VERIFIED (unit + browser) |
| C2 | Target on the other floor is called out | With an upper-floor target the ground plan showed nothing, apart from a distance. | A note now says "E35 · … is on the upper floor. The dashed route reaches a grand stair (marked ↑) and continues there." It has a "Show the upper floor" button. ↑/↓ markers show where the route changes floor. `guideTargetLevel()` takes the floor from the layout. | `MapPanel.ts`, `uplift2-C.css` | Unit: the floor of every destination. Browser: the note text, then clicking the button switches to the upper plan and focus stays in the dialog. | VERIFIED (unit + browser) |
| C3 | Exhibit numbers on the plan | Bays were blank squares. The E-number appeared only in tooltips or the accessible name. | Each bay shows its E-number, with an outline so it reads on both visited and unvisited fills. The text is aria-hidden because the bay already has an accessible name. | `MapPanel.ts`, `uplift2-C.css` | Browser: 29 numbers on the ground plan and 6 on the upper plan, matching the layout. | VERIFIED (browser) |
| C4 | Map key | No legend. Fill, outline, dashes and dots were unexplained. | A key covers you, you on the other floor, unvisited, visited, guide destination, planned route, floor change, grand stair, and Visit Thread stop. Forced-colours and more-contrast variants are included. | `MapPanel.ts`, `uplift2-C.css` | Browser: legend entries read back (`C4-map-legend-upper.jpg`). | VERIFIED (browser) |
| C5 | Wing threshold signs say what is inside | Rotunda and balcony threshold signs gave only "Dex Systems / East Wing". | The subtitle now reads e.g. "East Wing · E17–E23 · 7 exhibits". It is derived from the layout's exhibit order (`wingExhibitRange`, `wingThresholdSubtitle`). | `Detailing.ts` | Unit: ranges, a total of 35, and one named sign per wing above its arch. Browser: `C5-threshold-sign-east.jpg`. | VERIFIED (unit + browser) |
| C6 | Bay-number blade signs along each hall | Doorway titles face across the hall, so from along the hall they are seen edge-on and the bay order cannot be read. | A double-sided blade sign projects from the wall just on the Rotunda side of every opening, at 3.9 m. It carries the E-number. All 70 faces share one atlas texture and material, so the static merge folds them together. | `Detailing.ts` | Unit: 2 faces per exhibit, one facing each way along the hall, within 1 m of the wall, on solid wall, clear of plants, pedestals, furnishings, wing motifs and pilasters. One shared material with a unique atlas cell per exhibit. Browser: `C6-*` captures. | VERIFIED (unit + browser) |
| C7 | Way-back cue inside every bay | A visitor stepping out of a bay faces a hall and has no cue for which way the Rotunda is. | A sign over the inside of each opening reads "← Rotunda" or "Rotunda →". On the upper floor it reads "Balcony & stairs down". In the entrance hall it reads "← Rotunda · Exit →". The hand is computed (`rotundaHandFromBay`). Identical copy shares one material. The sign is offset clear of the bay's central pendant. | `Detailing.ts` | Unit: an independent step-to-that-hand check reduces the distance to the Rotunda for all 35. The cue faces into the bay and sits between the lintel and the bay ceiling. Browser: `C7-way-back-E19.jpg`, `C7-way-back-E25.jpg`. | VERIFIED (unit + browser) |
| C8 | Walkable balcony arc marked on the floor | Since uplift 1, the south balcony pocket is cut off by the stair wells. Nothing on the balcony floor showed that the walk is the north arc ending at the two stair heads. | A paired trim inlay follows `BALCONY_WALK_FACES` from the SW landing to the SE landing, with a medallion at each stair head. It is built from the same `stairLanding` and `BALCONY_ROUTE_RADIUS` the router uses. | `RotundaWayfinding.ts` | Unit: the inlay is never over a well, always over walkable balcony floor (collision `supportHeight` = 10), and goes no further south than the landings. 6 strips and 2 medallions, all disposed by the scope. Browser: `C8-balcony-landing-se.jpg`. | VERIFIED (unit + browser) |

All signage is non-colliding and sits off the walking lines. Geometry, materials and textures are tracked by `ResourceScope`. There are no new loops, dependencies or network calls. Layout, stair and balcony definitions are unchanged. Exhibit ids are unchanged.

## Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint . --max-warnings 0` | PASS |
| `npx vitest run` | PASS, 1065/1065 (112 files), including 13 new cases in `tests/uplift2-C.test.ts` |
| Not run (per brief) | `npm run test:e2e`, `npm run gate` |

During the work, `tests/performance.test.ts` (merge ratio) failed when each blade had its own texture: 415 meshes left after merge, against a limit of < 411.7. Moving to the shared atlas and shared cue materials fixed it, and the test now passes.

## Limits

- Human visual acceptance, real-GPU legibility and representative-device performance are UNKNOWN.
- The headless browser emitted requests to `westkitty.github.io`, which the sandbox proxy refused. These came from app code outside this change set and were not investigated.
