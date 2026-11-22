# ISLAND-01 — woodland trunk/canopy repair and landmark visibility (2026-11-21)

Contract: master plan §5. Base: `main` `78b5996`. Baseline: `../world-expansion-baseline-20261121/`.

## What changed (IMPLEMENTED)

- `src/world/exterior/IslandLandmarks.ts` (new): the 15 existing named island
  landmarks as data, copied from their builders (no new positions): focus point,
  island-loop approach point, collision-supported inspection spot, clearing radius
  and walk-in corridor. Helpers `landmarkGroundExcluded` and `blocksLandmarkSightline`.
- `IslandLandscape` forest belt: every crown now stands on a visible, slightly
  leaning trunk (`woodland-forest-belt-trunks`, one instanced draw, open-ended
  6-sided cylinders, no shadows) with a trunk collider. Crown undersides sit at
  3.0–4.8 m (`CANOPY_UNDERSIDE_MIN` = 3.0 m; eye height 1.64 m).
- The trunk grid is quality-independent (the former low-tier grid, 845 trunks
  after landmark exclusions), so collision is identical on every tier and remains
  construction-time immutable. Medium/high add overhead crowns on those trunks:
  belt crowns 845 / 1,447 / 2,067 (was 888 / 1,457 / 2,093).
- Perimeter tree crowns lifted (crown 3.7→4.2 × scale, lobe 5.1→5.6 × scale);
  trunk, X/Z and colliders unchanged. Canopy infill underside ≥ 3.0 m.
  Understory tops lowered from ≤1.66 m to ≤1.38 m and kept out of landmark
  clearings/corridors.

## Verification (VERIFIED BY AUTOMATED TEST; Chromium/SwiftShader)

- `tests/island-landmark-visibility.test.ts` (6): features exist; approach and
  inspection spots supported; collider-free 0.35 m capsule corridor from path to
  every inspection spot against the **full exterior collision**, all tiers; every
  crown underside ≥ 3.0 m; understory < 1.4 m; zero foliage on any landmark
  eye-height sightline; trunks identical and collision-backed on every tier.
- `tests/browser/island-landmark-walk.e2e.ts` (2): real keyboard walk to all 15
  landmarks on low and high with reduced motion on, then raycast from eye to focus
  with no woodland hit; real touch move-stick walk (CDP touch events on the canvas)
  to 4 landmarks.
- Updated expectations: `forest-belt-visual-coverage.test.ts`,
  `browser/quality-transitions.e2e.ts` (new counts, trunks constant at 845, collision
  unchanged across 3×3 tier cycles), `browser/island-landscape.e2e.ts` (845 trunk
  colliders counted separately; all other exterior colliders still < 1,000).
- Sightline analysis after: 0 crowns below 2.2 m (was 888 low / 2,093 high);
  0 blocked landmark sightlines (was 4 landmarks, 8 crossings).

## Cost (renderer.info, matched capture views)

+1 draw call in every view; +9,000 (low), +8,920 (medium), +5,840 (high) triangles
per frame. Example: high pier overview 822→823 calls, 359,248→365,088 triangles;
low forest walk view 27→28 calls, 58,688→67,688 triangles. Exterior colliders
901→1,746 (+845 trunk boxes in the existing spatial grid); fixed-step cost while
walking the west loop stayed at the timer's resolution (mean ≈0.004–0.005 ms,
p99 0.1 ms, before and after). SwiftShader numbers only — not M1/Metal evidence;
`npm run perf:device` was not run.

## Screenshots

Medium-tier pairs (`../world-expansion-baseline-20261121/` vs this folder):
`medium-ap-pollinator-meadow`, `medium-ap-neolithic-circle`, `medium-ap-wings-of-dawn`,
`medium-walk-west-loop-into-forest`, `medium-ov-west-woodland`, `medium-ov-pier-arrival`,
plus `medium-ap-fern-ravine-mobile-portrait`. `capture-manifest.json` lists all
51 captures (3 tiers + mobile) with SHA-256.

## Not verified

Human visual acceptance of the forest look; real-device performance; hosted Pages
(ISLAND-01 alone is not a Pages milestone — the plan's first release is after the
island is functional). Pre-existing, unchanged: perimeter-tree colliders are
registered for the tier the exterior is built with (68/112/176), so a later tier
switch can leave some perimeter trees without colliders or vice versa.
