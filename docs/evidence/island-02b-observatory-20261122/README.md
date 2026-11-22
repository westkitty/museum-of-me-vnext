# ISLAND-02B — southern wooded ruined observatory (2026-11-22)

Base: `main` `a358b66` (ISLAND-02A, PR #73). Branch: `feat/island-02b-ruined-observatory`.
Contract: `docs/plans/WORLD_EXPANSION_GROKBOT_MASTER_20261121.md` §6B.

## What changed (IMPLEMENTED)

- **Southern wooded ruin site & approach trail (`src/world/exterior/IslandSiteLayout.ts`, `src/world/exterior/IslandLandscape.ts`).** Placed `OBSERVATORY_CENTER` at `[88, 2.5, 96]` (128 m east-northeast of the existing southwest astronomical terrace/sundial at `[-34, -0.48, 134]`, leaving it untouched) with winding woodland approach `OBSERVATORY_APPROACH_PATH` (`[44.5, 94]` -> `[54, 91]` -> `[62, 95]` -> `[70, 96]`). Preserved woodland density around the knoll while clearing only the ruined clearing (`r < 16 m`) and trail corridor so the observatory silhouette glimpses naturally between deciduous trees.
- **Hill ramp & raised observatory rotunda (`src/world/exterior/ExteriorObservatory.ts`).** Built a winding woodland gravel trail with lantern bollards, a continuous collision-backed stone slope/stair ramp (`x: 70..80`, `Y: -0.5` to `2.5`) with an under-ramp masonry prism and separate entrance bollards, mossy mound skirt kept clear of ramp & terrace interiors, solid cliff/ruin perimeter walls (`80..96 × 88..104`), NE octagonal support columns holding a weathered copper dome fragment open cleanly to zenith & SW starry sky, 4 bronze meridian ribs joined to a partial zenith oculus collar, procedural zodiac mosaic floor inlay, `Northern`/`Southern Constellations` chart lecterns, a weathered brass refracting telescope (`[92.4, 2.5, 91.6]`), fractured central mechanical orrery (`observatory-orrery-w09-anchor`, `reducedMotion`-safe), and zero `THREE.Light` objects.
- **Dormant W09 anchor & land-route registration (`src/app/App.ts`, `src/world/exterior/IslandLandmarks.ts`).** Registered `observatory-orrery-w09` on `InteractionManager` (excluded from `Journal` exhibit visits; announces dormant W09 passage without teleporting or granting a stamp) and added `ruined-observatory` to `ISLAND_LANDMARKS` (17 total landmarks).

## Counts

- Forest-belt trunks: `863` (was `881`; `18` cleared along the southern woodland observatory trail & knoll; quality-independent).
- Forest-belt crowns: `1,204` (low) / `1,489` (medium) / `2,114` (high).
- Perimeter woodland trunks: `176` (unchanged, quality-independent).
- Exterior `THREE.Light` objects: `0` (preserved).
- Initial visit bundle: `11.54 MB` of `20 MB` budget (`0` external assets).

## Verification (VERIFIED BY AUTOMATED TEST; Chromium/SwiftShader)

- `tests/ruined-observatory.test.ts` (4 tests PASS): separation from SW sundial, continuous `walkRoute` from Path 1 up hill stairs around orrery & telescope and back down, perimeter cliff/wall/curb guard checks, zero `THREE.Light`, `reducedMotion` freeze, dormant W09 interaction, and `scope.size === 0` disposal.
- `npm run gate` PASS (`125` test files, `1,298` Vitest tests, `typecheck`, `lint`, `validate:*`, `build`, `check:budgets`, `verify:dist`).
- Playwright (system Chrome + ANGLE SwiftShader software WebGL — not Apple Metal hardware FPS): `ruined-observatory.e2e.ts` (woodland glimpse, full approach/stair walk, rotunda interiors, dormant W09 orrery interaction + HUD readability, mobile portrait `390x844`), `island-landscape.e2e.ts`, `island-landmark-walk.e2e.ts` (all 17 landmarks on `low`/`high` + touch), and `quality-transitions.e2e.ts` PASS.
- Visual audit receipt: Initial Subagent D (`907f6d61`) PNG inspection caught a flat protruding `underRamp` block covering the lower 5 stairs, buried ramp-foot bollards, mossy knolls clipping stairs/rotunda floor, splayed meridian rib ends, blunt `ringBeam` ends, and `.hud__lock` overlap; all 5 visual defects were repaired, Playwright re-run cleanly, and all 5 refreshed captures (`woodland-glimpse.png`, `hill-approach-ramp.png`, `rotunda-orrery-telescope.png`, `orrery-interaction.png`, `observatory-mobile-portrait.png`, tracked in `capture-manifest.json`) were visually verified clean.

## Not verified / still open

Human visual acceptance; real-device performance (`perf:device` not run); hosted Pages (deferred to S3 visitor-ready island milestone).
