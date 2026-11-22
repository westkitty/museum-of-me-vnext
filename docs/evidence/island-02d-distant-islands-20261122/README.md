# ISLAND-02D — Distant Floating Sky Islands & Wild Island Silhouette (2026-11-22)

Base: `main` `f079f17` (ISLAND-02B, PR #74). Branch: `feat/island-02d-distant-islands`.
Contract: `docs/plans/WORLD_EXPANSION_GROKBOT_MASTER_20261121.md` §6D.

## What changed (IMPLEMENTED)

- **Distant Floating Sky Islands (W06 preview) & Wild Island Silhouette (W10 preview) (`src/world/exterior/ExteriorDistantIslands.ts`, `src/world/exterior/ExteriorWorld.ts`).**
  - **Sky Islands cluster (`SKY_ISLANDS_ANCHOR = [295, 74, -110]`):** `314.84 m` ENE from origin (`Y ≈ +55..+94 m`), featuring faceted tapered rock undersides, keel spires, terraced emerald/teal crowns, stone garden arches, glowing cyan/amber crystals, animated `DataTexture` hanging waterfalls + mist plumes, instanced botanical trees/rocklets, and gentle drift (`reducedMotion`-safe).
  - **Wild Island massif (`WILD_ISLAND_ANCHOR = [-275, -1, 350]`):** `445.11 m` SW across open water (`148.61°` from Sky Islands and `87.36°` from the SE lighthouse peninsula), featuring twin volcanic ridges (`> 45 m` peak elevation), offshore sea stack, instanced pine silhouettes seated via `sampleWildIslandElevation`, shoreline `DataTexture` mist bands, and a warm amber high-plateau shrine beacon.
- **Horizon visibility & LOD lifecycle (`src/world/Sky.ts`, `src/render/RendererHost.ts`).** Set `SKY_DOME_RADIUS = 850` (shader normalizes direction ray so sky appearance is unchanged) and `CAMERA_FAR = 1100` so neither the distant islands nor the sky dome clip from any shore or future rooftop elevation, with `fog: false` muted aerial palettes preventing fog washout at `300 m`. Quality tiers rebuild deterministically (`3/5/5` sky islands, `9/19/32` canopies, `0/14/28` rocklets, `24/56/96` wild pines across `low`/`medium`/`high`) with zero `ResourceScope` leaks.
- **Invariants preserved:** Strictly visual-only (zero `CollisionWorld` colliders added off-island), `0` `THREE.Light` objects inside `ExteriorWorld.root`, zero external network fetches.

## Verification (VERIFIED BY AUTOMATED TEST; Chromium/SwiftShader)

- `npm run gate`: PASS on rebased branch (`f079f17` base).
- `tests/distant-islands.test.ts` & `tests/uplift2-A.test.ts`: PASS.
- Playwright (Chrome + ANGLE SwiftShader software WebGL — not Apple Metal hardware FPS): `tests/browser/distant-islands.e2e.ts` (10 viewpoints across pier, lighthouse gallery, coast, rooftop elevation, and `390x844` mobile portrait, verified in `capture-manifest.json`), `quality-transitions.e2e.ts`, and `lighthouse-peninsula.e2e.ts` PASS.

## Not verified / still open

Human visual acceptance; CI Linux visual-regression verification; real-device performance (`perf:device` not run); hosted Pages (deferred to S3 visitor-ready island release).
