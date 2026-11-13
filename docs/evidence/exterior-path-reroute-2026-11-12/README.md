# Exterior island path reroute — 2026-11-12

Owner-approved change (Museum Bible a1857cb): island paths 1, 2, 3 and 5 are rerouted around the
museum. Path 4 is unchanged. The source of truth is `PATH_CENTERLINES` in
`src/world/exterior/IslandSiteLayout.ts`. Rendering, wildlife avoidance, tree clearings and path lights
all derive from that constant.

## The new layout

The paths now form one ring around the building:

- **Path 1:** pier (0, 184), then the east side of the plaza, then down the east facade (centre x ≈ 44–46) to the junction at (46, 54).
- **Path 2:** east facade, between the shell (x 38.8) and the lagoon/pavilion, then around the NE corner clear of the NE tree, then the north promenade junction at (16, −109.5).
- **Path 3:** north promenade (z ≈ −109.5) between the north wall (z −104.3) and the north-court benches (z −113.5), then around the NW corner to the original spire-garden approach (−59, −83) … (−104, −48).
- **Path 4:** unchanged.
- **Path 5:** the west junction (−62, 82), then down the west facade, then the west side of the plaza, then back to the pier (0, 184). This mirrors path 1. Before the reroute, path 5 ended at the east junction through the building.

The paths also leave the pier between its lamp posts. They no longer clip the plaza lamps (±29, 155) or the east stone cluster (x 45–53, z 105–112).

## Evidence

All of this is from the real Three.js app in Playwright Chromium (SwiftShader). These are not concept renders.

- `real-player-walks.json`: the real `PlayerController`, driven through `app.input` at 60 Hz fixed steps, walked every path along its rendered spline (one waypoint every ~3 m).
  - All 5 paths completed. None got stuck, and the player was never airborne.
  - Maximum deviation was 0.52 m off-line.
- PNG frames:
  - `01` top-down ring
  - `02`–`05` and `10`: oblique views of each corridor and both junction areas
  - `06`–`09` and `11`: eye-level views at walking height
- `capture-script.e2e.ts.txt`: the Playwright spec that produced the files. It is kept out of the CI suite.
- Automated gates added with the change:
  - `tests/exterior-jury.test.ts`: all 7 exterior routes must pass.
  - `tests/island-path-clearance.test.ts`: the full ±2.3 m centripetal-spline ribbon must stay on land and off the lagoon, at least 0.5 m from every solid exterior collider and at least 1.0 m from building walls.
  - `tests/exterior-jury-shell.test.ts`: the legacy layout must still FAIL the jury.

## Observations

- Eye-level frames show moonlight shadow-map banding under the NE tree. This is existing lighting behaviour, not a path defect.
- Paths 1 and 5 cross the low pier-edge curb, which is visual only, between bollards. The original path 1 already left the pier this way.
- No physical-device performance claim is made here.
