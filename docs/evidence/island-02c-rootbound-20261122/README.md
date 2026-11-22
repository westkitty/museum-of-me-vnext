# ISLAND-02C — Rootbound Hollow (2026-11-22)

Base: `main` `a358b66` (ISLAND-02A, PR #73). Branch: `feat/island-02c-rootbound-hollow`.

## What changed (IMPLEMENTED)

- **Rootbound Hollow beneath the Ancient Tree roots (`src/world/exterior/ExteriorRootboundHollow.ts`, `src/world/exterior/IslandSiteLayout.ts`).** Built a vaulted, moss-covered earthen grotto and arched root portal (`ROOTBOUND_HOLLOW_PORTAL = [55.2, -88.8]`, `ROOTBOUND_HOLLOW_CENTER = [61.8, -0.38, -88.6]`) tucked into the northern/eastern flank of the `11 m` Ancient Tree clearing (`ANCIENT_TREE_CENTER = [57, -0.48, -84]`) while preserving the Ancient Tree's trunk collider (`[57, -0.48 + 3.4, -84]`, half-extents `[2.3, 3.4, 2.3]`), all five buttress root colliders, and the existing `secret:tree-roots` carved stone (`[53.8, -0.48, -81.6]`).
- **Zero grass-plane clipping.** Instead of cutting below the continuous `Y = -0.5` island terrain plane, the portal threshold uses a two-sided mossy slate saddle (`Y = -0.46 -> -0.24 -> -0.38`) delivering visitors onto an opaque dark peat-slate chamber floor (`Y = -0.38`, `12 cm` above the `Y = -0.5` grass mesh and `8.5 cm` above the Ancient Tree moss ring at `Y = -0.465`), crowned by an extruded mossy arch vault, vaulted dome ceiling, instanced corner root columns, glowing cyan-jade bioluminescent fungi/mycelium, and soft additive glow `DataTexture` pools.
- **Self-contained relic discovery (`src/world/exterior/ExteriorWorld.ts`, `src/app/App.ts`, `src/world/exterior/IslandLandmarks.ts`).** Registered `rootbound-hollow-relic` on `InteractionManager` (excluded from `Journal` in `App.ts`; `SECRETS` remains 10 entries, not an 11th passport stamp), added `rootbound-hollow` to `ISLAND_LANDMARKS` (`17` total landmarks inside the existing Ancient Tree clearing with zero woodland count changes), maintained zero `THREE.Light` objects inside `ExteriorWorld.root`, tracked every GPU resource in `ResourceScope`, and honored `reducedMotion`.

## Verification (VERIFIED BY AUTOMATED TEST; Chromium/SwiftShader)

- `npx tsc --noEmit`: PASS (exit 0).
- `npx vitest run tests/rootbound-hollow.test.ts tests/uplift2-A.test.ts tests/island-landmark-visibility.test.ts tests/forest-belt-visual-coverage.test.ts tests/secrets.test.ts tests/exterior-jury.test.ts`: PASS (`6` files, `42` tests).
- Playwright (system Chrome + SwiftShader): `tests/browser/rootbound-hollow.e2e.ts`, `tests/browser/secrets.e2e.ts`, and `tests/browser/island-landmark-walk.e2e.ts` (all 17 landmarks including `rootbound-hollow` on `low` and `high`) PASS.
- Captures (`capture-manifest.json` with SHA-256): `01-approach-western-view.png`, `02-arched-root-threshold.png`, `03-chamber-interior-relic.png`, `04-relic-closeup-interact.png`, `05-exterior-mound-overlook.png`.
