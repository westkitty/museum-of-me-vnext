# Uplift 2 — sub-agent A: exterior island, arrival, environment and ambient life

**Status: ACTIVE DEVELOPMENT / PRE-1.0.** One local commit on the agent worktree, based on `728fdea`.
Nothing pushed, merged or deployed. No human acceptance recorded.

Evidence states: **VERIFIED (browser)** = seen or measured in real headless Chromium (SwiftShader WebGL,
`localhost:4181`, render loop stepped explicitly); **VERIFIED (unit)** = `tests/uplift2-A.test.ts` (node).
Captures: `docs/evidence/uplift2-A/` (1280×720 JPEG; software GL, so colour and lighting are approximate).

## Defects found and repaired (not counted among the 8)

| ID | Defect | Evidence | Repair | Verification |
|---|---|---|---|---|
| D1 | The "moonlit lantern path" (6 bollards + light pools) stood at x = 16–38, z = −34…−68 — **inside the museum's east wing** (facade at x = ±38.8). Invisible to every visitor; its e2e checkpoint teleported the player inside the building. | Source coordinates vs `ExteriorMuseumShell` side walls; `D1-lantern-walk-before-inside-wall.jpg` (only wall visible) | Stations moved onto the real lagoon walk (path 2, z −26…−71): pools on the rendered spline, bollards 3.4 m to the lagoon side (`lanternWalkStations`, `LANTERN_WALK_Z`) | Unit (pools ≤ 0.8 m from path, bollards outside the shell, on land; path-clearance suite passes); browser capture `D1-lantern-walk-after.jpg` |
| D2 | The ancient-tree landmark was centred at x = 38 — **on the east facade wall**, half its trunk and canopy inside the building, collider straddling the wall. | `D2-ancient-tree-before-in-facade.jpg` | Moved to `ANCIENT_TREE_CENTER` (57, −84) across the lagoon walk; an 11 m clearing is kept free of woodland, understory, infill, forest belt, flowers and butterflies. The "tree-roots" secret stone moved with it (`src/content/secrets.ts`, one coordinate). | Unit (trunk/roots clear of facade and path ribbon; stone ≤ 4.5 m from trunk and reachable); browser `D2-ancient-tree-after.jpg` |
| D3 | Seated exhibit observers (E02, E04, E05, E06) were placed **exactly on `visitorSpot`** — the point the guide route delivers the visitor to — so a guided visitor arrived inside a figure. | `AmbientVisitors.populate` vs `visitorRoute.ts` | `observerSpot()` seats them 1.8 m to one side, turned to the exhibit | Unit over all 35 placements (> 1.5 m from the spot, inside the bay bounds) |
| D4 | Fish, birds and butterflies did not face their direction of travel (yaw formula rotated opposite to the orbit; fish swam backwards/sideways half the time). | Derivation in source (`rotation.y = angle + π` vs tangent) | Heading from the finite-difference velocity, per creature nose axis | Unit: > 95 % of moving fish samples nose-aligned with velocity |

## Improvements (8)

| # | Title | Weakness observed | Change | Files | Test | State |
|---|---|---|---|---|---|---|
| I1 | Fingerposts at the island forks, with true distances | The pier junction (z = 184) is the only fork on the way in, yet nothing named either way; the pier edge trim ran straight across the path like a kerb. Far side of the loop gave no hint which way back was shorter. | Four physical fingerposts (`ExteriorWaymarkers.ts`): pier east/west blades name landmarks with distances; rear-garden and spire-junction posts give the walk back to the doors both ways round. Distances are measured along the authored path centrelines (`projectOntoLoop`, `walkingDistancesToDoors`). Pier trim opens at the crossing (`PIER_TRIM_GAP`). Posts are real, slim colliders off the ribbon. | `ExteriorWaymarkers.ts`, `IslandSiteLayout.ts`, `IslandLandscape.ts`, `ExteriorWorld.ts` | Unit (placement, clearance, collision, distance arithmetic, ordering, trim gap vs spline) | VERIFIED (browser): blade text read from the live scene, e.g. rear garden "← by the spire garden about 530 m · by the lagoon walk about 420 m →"; `I1-*` captures |
| I2 | Path lighting rhythm | Edge lights were stepped every 22nd *spline-parameter* sample: spacing varied with segment length, and because the index was always odd **every light fell on the same side**. No lighting marked the fork. | Arc-length spacing (13 m), alternating sides, suppressed along the lantern walk and at posts; a lit pair at each path mouth of the pier junction. | `IslandLandscape.ts` | Unit (both sides ≥ 35 %, one spacing ±25 %, 4 junction lights) | VERIFIED (unit); visible in `I1-pier-junction-after.jpg` |
| I3 | Wildlife movement variation | Every butterfly, bird and fish moved on a perfect circle at constant speed. | Butterflies: two-lobed wander, varying pace, periodic glide down to perch with slow wing beats. Birds: tilted ellipses, altitude drift, flap/glide phases, banking. Fish: burst-and-coast that never reverses, orbit that only breathes inward (lagoon containment preserved). All bounded by each creature's original radius; same three draws, no new loop. | `ExteriorWildlife.ts` | Unit (900 steps: radius bounds, radius variation in all three populations, perching, heading) + existing 1000-step lagoon containment test | VERIFIED (unit) |
| I4 | Reduced-motion rest state | Reduced motion froze creatures wherever they were — butterflies and 20–34 m-high birds hanging motionless in the sky. | Rest pose: butterflies settled on the ground with closed wings, birds not drawn, fish still; clean resume. | `ExteriorWildlife.ts` | Unit; browser (`reducedMotion` → `isResting: true`, birds `visible: false`) | VERIFIED (browser) |
| I5 | Wildlife notices the visitor | Creatures ignored the visitor entirely. | Butterflies within 5 m lift away (smoothed, ≤ ~3 m, drift back); fish within 10 m of a visitor at the water speed along their own orbit (stays inside the lagoon). at most 80 distance checks on the existing throttled tick. | `ExteriorWildlife.ts` | Unit (A/B copies, same clock) | VERIFIED (unit) |
| I6 | Coastline outcrops in natural clusters | Rocks sat at the *same fractions* of every coast edge: an evenly spaced kerb (nearest-neighbour CV 0.11 measured on the old layout). | Arc-length distribution in clusters of 1–4 (anchor + satellites) straddling the waterline; same tier caps, still one draw, no colliders. | `IslandLandscape.ts` | Unit (CV > 0.6, every rock within 3.5 m of the coast, no bare edges on high) | VERIFIED (unit); `I6-coast-after.jpg` |
| I7 | Threshold continuity | The pale arrival walk and its bronze inlays stopped dead at the doors; inside, a dark floor and an unlit black soffit read as a void. | Walk runner and both inlays carried through the vestibule to the foyer backdrop; three warm soffit coffers. Visual only: no collider, no light, aperture and handoff volumes unchanged. | `ExteriorWorld.ts` | Unit (extent, alignment, still walkable, zero lights) | VERIFIED (browser capture) `I7-threshold-before/after.jpg` |
| I8 | Ambient walker pacing | Route time was split evenly per leg regardless of leg length (pace changed with every leg length, feet sliding against a fixed-rate Walk clip) and heading snapped at corners. | `walkerPoseAt`: constant 1.0–1.3 m/s, Walk clip time-scaled to speed, a 1.2–4.5 s linger at each corner with the clip paused and a smooth turn. | `AmbientVisitors.ts` | Unit (speed ≤ 1.02 × set pace, no heading jump > 0.25 rad per 50 ms, real pauses) | VERIFIED (unit); Quaternius actors not exercised in the browser |

## Other edits outside the area (minimal)

- `src/content/secrets.ts`: one coordinate (tree-roots stone follows the relocated tree).
- `tests/forest-belt-visual-coverage.test.ts`: low-tier calibrated band 890 → 880 (the tree clearing removes 13 crowns;
  the `2 × last release` floor of 876 still holds). Medium/high unchanged.
- `tests/browser/exterior-signature-evidence.e2e.ts`: camera views/checkpoints follow the moved tree and lantern walk
  (not run here: e2e suite excluded by the brief).
- No CSS, HUD, App or UILayer changes. No new realtime lights, loops, dependencies or network requests.

## Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint . --max-warnings 0` | PASS |
| `npx vitest run` | PASS — 1062/1062 (112 files), incl. 10 in `tests/uplift2-A.test.ts` |
| Browser (headless Chromium, port 4181) | Scene/blade text, reduced-motion state and 10 captures |
| Not run | `npm run test:e2e`, `npm run gate` (per brief) |

## Not verified

Human visual acceptance; device frame-rate; the ambient walkers' animation in a live interior; whether the pier
fingerposts sit well in the spawn composition at other aspect ratios (they are at the frame edges at 1280×720).
