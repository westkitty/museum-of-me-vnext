# ISLAND-02A — coastal lighthouse peninsula (2026-11-22)

Base: `main` `387912c` (ISLAND-01b, PR #72). Branch: `feat/island-02a-lighthouse-peninsula`.
Contract: `docs/plans/WORLD_EXPANSION_GROKBOT_MASTER_20261121.md` §6A.

## What changed (IMPLEMENTED)

- **Southeast coastal peninsula (`src/world/exterior/IslandSiteLayout.ts`, `src/world/ArrivalGarden.ts`).** Extended `ISLAND_OUTLINE` between `[158, 111]` and `[112, 151]` (`[190, 124]`, `[210, 148]`, `[198, 176]`, `[166, 180]`, `[140, 156]`) inside the `330 m` ocean annulus with true outward mitered polygon normals for `night-island-coastal-skirt` and `night-island-tidal-fringe` so concave peninsula necks seal cleanly.
- **Approach trail & woodland anchoring (`src/world/exterior/IslandLandscape.ts`).** Anchored the forest-belt grid to `FOREST_BELT_BOUNDS` (`-187..188`, `-182..216`) so existing trees elsewhere on the island stay identical, and cleared the southeast `LIGHTHOUSE_APPROACH_PATH` (`[44, 142]` to `[148, 152]`) and rocky peninsula (`x > 144 && z > 118`).
- **Climbable coastal lighthouse (`src/world/exterior/ExteriorLighthouse.ts`).** Built a rocky basalt headland ramp (`Y = -0.5` to `1.5`), cliff-parapet headland terrace (`Y = 1.5`), banded masonry tower with arched doorway (`lighthouse-peninsula-tower`), 8 continuous collision-backed switchback flights + landings (`Y = 1.5` to `11.5`), open-sky upper stairhead slot, 360° gallery deck with wrought-iron balustrades (`Y = 11.5`), glazed lantern room, rotating Fresnel lens with soft gradient light cones (`lighthouse-lens-l01-anchor`, `reducedMotion`-safe), and zero `THREE.Light` objects.
- **Dormant L01 anchor (`src/app/App.ts`, `src/world/exterior/IslandLandmarks.ts`).** Registered `lighthouse-lens-l01` on `InteractionManager` (excluded from `Journal` exhibit visits; announces dormant L01 passage without teleporting or granting a stamp) and added `lighthouse-peninsula` to `ISLAND_LANDMARKS` (16 total landmarks).

## Counts

- Forest-belt trunks: `881` (`9` cleared along the southeast lighthouse trail/headland; quality-independent).
- Forest-belt crowns: `1,228` (low) / `1,518` (medium) / `2,156` (high).
- Perimeter woodland trunks: `176` (unchanged, quality-independent).
- Exterior `THREE.Light` objects: `0` (preserved).
- Initial visit bundle: `11.53 MB` of `20 MB` budget (`0` new external binaries).

## Verification (VERIFIED BY AUTOMATED TEST; Chromium/SwiftShader)

- `tests/lighthouse-peninsula.test.ts` (4 tests PASS): polygon & site support validity, continuous `walkRoute` ascent & descent from Path 1 to the Fresnel lens and back, cliff/railing/wall blocking, zero lights, `reducedMotion`, dormant L01 activation, and `scope.size === 0` disposal.
- `npm run gate` PASS (`build:collection`, `typecheck`, `lint`, `vitest`, `validate:*`, `build`, `check:budgets`, `verify:dist`).
- Playwright (system Chrome + SwiftShader): `lighthouse-peninsula.e2e.ts` (keyboard walk up ramp/stairs/gallery, Fresnel lens focus/activation, quality switches, `reducedMotion`, mobile portrait `390x844`), `exterior-first.e2e.ts`, `island-landscape.e2e.ts`, `island-landmark-walk.e2e.ts` (all 16 landmarks), `quality-transitions.e2e.ts`, and `performance-lifecycle.e2e.ts` PASS.
- Captures (`capture-manifest.json` with SHA-256): `pier-view-lighthouse.png`, `headland-approach.png`, `stair-climb.png`, `gallery-overlook.png`, `lantern-lens.png`, `headland-mobile-portrait.png`.

## Not verified / still open

Human visual acceptance; real-device performance (`perf:device` not run); hosted Pages (deferred until full S3 island release milestone).
