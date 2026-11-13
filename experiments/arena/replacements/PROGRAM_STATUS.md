# Museum of Me — Unified Eight-Exhibit Replacement Program Status

**Branch:** `arena/eight-replacements` (worktree off `origin/main` @ `392a138`; updated through AWE Iterations 1–8)  
**Integration Decision:** `NOT AUTHORIZED` (prototype evaluation only; active museum registry, incumbents, world, and production builds untouched)

## Incumbent Baseline (Reconfirmed)

Verified on `arena/eight-replacements` (`npm run typecheck`, `npm run lint`, `npm test` 100 files / 987 tests, plus `tests/exhibit-quality.test.ts` / `lifecycle` / `lifecycle-memory`):

| Slot | Incumbent | Tier (Budget) | Resources | Meshes | Tris | Controls |
|---|---|---|---:|---:|---:|---:|
| `E30` | `AetherVFX` | A (15 MB) | 77 | 38 | 1,010 | 3 |
| `E28` | `AgainstTheVoid` | B (8 MB) | 70 | 74 | 2,044 | 4 |
| `E26` | `WestCatSystems` | C (4 MB) | 79 | 49 | 498 | 4 |
| `E25` | `DnDexTable` | B (8 MB) | 68 | 56 | 1,244 | 2 |
| `E24` | `InvincibleMagic` | A (15 MB) | 100 | 64 | 1,550 | 4 |
| `E12` | `RhetoricalIndex` | B (8 MB) | 69 | 33 | 994 | 8 |
| `E20` | `UtilityBench` | C (4 MB) | 104 | 68 | 856 | 6 |
| `E13` | `SunoStudio` | B (8 MB) | 68 | 114 | 3,806 | 5 |

## Eight-Candidate Acceptance Matrix (Post-AWE Uplift Iterations 1–8)

| Slot | Candidate Path | Source Readiness | Authored Experience | Unit / Lifecycle | Browser Preview | Accessibility | Disposal | Performance vs Incumbent | Comparative Verdict | Blockers | Integration |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `E30` | `experiments/arena/replacements/E30-the-spell-that-leaves-a-scar/` | Grounded (`P053`) | PASS (Stepped terrain dais, bifurcated refraction telegraph + cascades + quench plates + undo) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, live announcements, reducedMotion) | PASS (0 leaks on remount) | 134 res / 125 meshes / 4,462 tris / 0 plinth hits (down from 7,874 tris; vs 4 incumbent plinth hits) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E28` | `experiments/arena/replacements/E28-ninety-seconds-to-vacuum/` | Grounded (`P051`) | PASS (4-strut open reactor cage, 3 shield arcs, decoupled venting wing, coupled O2/SHLD/CORE/EVAC conduits, 3 endings) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, untimed/timed parity, reducedMotion) | PASS (0 leaks on remount) | 123 res / 76 meshes / 1,938 tris / 0 plinth hits (fewer tris than incumbent 2,044) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E26` | `experiments/arena/replacements/E26-reality-becomes-a-cartridge/` | Grounded (`P037`, `P038`, synthetic stage labeled) | PASS (Diorama <-> Playable 5-stage Cartridge + Wall-Mount Cartridge + Blocking vs Click-Through Overlay rule) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, reducedMotion) | PASS (0 leaks on remount) | 152 res / 94 meshes / 1,762 tris / 0 plinth hits (Tier C pass) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E25` | `experiments/arena/replacements/E25-the-battlefield-inside-the-table/` | Grounded (`P015`) | PASS (Elevated DM battletable, pillar cover ward + Marksman intercept ray, GUARD shield dome, initiative rail, physical collapse on DEFEAT/VICTORY) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, init readout, reducedMotion) | PASS (0 leaks on remount) | 141 res / 87 meshes / 2,170 tris / 0 plinth hits (Tier B pass) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E24` | `experiments/arena/replacements/E24-the-campaign-that-can-break/` | Grounded (`P012`) | PASS (4 Wesnoth biome citadels, muster pennants, foreign-key schema arcs, dangling orphan shard & downstream citadel collapse + repair) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, reducedMotion) | PASS (0 leaks on remount) | 140 res / 73 meshes / 1,570 tris / 0 plinth hits (down from 2,284 tris; Tier A pass) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E12` | `experiments/arena/replacements/E12-the-headline-that-built-two-cities/` | Grounded (`P062`) | PASS (Twin skyline framing cities, shared 3-log harbor anchor strip, causal filaments, inference strip + dissolve to truth) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, neutral logs, reducedMotion) | PASS (0 leaks on remount) | 155 res / 89 meshes / 1,626 tris / 0 plinth hits (Tier B pass) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E20` | `experiments/arena/replacements/E20-the-impossible-cleanup/` | Grounded (`P024`, `P032`, `P061`) | PASS (4-category reclamation audit shrink, dependency claim shells, zero-delete policy refusal latch + 14.5 GB reversible quarantine) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (6 controls, synthetic disclaimer, reducedMotion) | PASS (0 leaks on remount) | 134 res / 73 meshes / 2,210 tris / 0 plinth hits (Tier C pass) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E13` | `experiments/arena/replacements/E13-the-disobedient-orchestra/` | Grounded (`P010`, synthetic local probe labeled) | PASS (4 choir caliper towers, vertical drift tethers, [STRICT META-CUES] bridge arc, 24-bar silent harmonic waveform ribbon) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, muted default, silent 3D legibility) | PASS (0 leaks on remount) | 107 res / 80 meshes / 2,978 tris / 0 plinth hits (down from 3,300 tris & 3,806 incumbent) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |

## Program-Level Validation (Closeout After AWE Iterations 1–8)

- **Scope & Isolation Check:** Strictly inside `experiments/arena/replacements/**`. Zero edits to `src/`, `data/`, `package.json`, incumbent modules, or `src/exhibits/index.ts`.
- **Arena Typecheck & ESLint:** `npx tsc -p experiments/arena/replacements/tsconfig.json --noEmit` (PASS), `npx eslint experiments/arena/replacements --max-warnings 0` (PASS, 0 warnings).
- **Arena Unit & Contract Suite (`vitest.arena.config.ts`):** 9 files passed, 25 tests passed (frozen `ExhibitModule` contract, zero `ResourceScope` leaks on remount, zero `PLINTH_BOX` intersections, zero allocations in `onUpdate`, reduced motion & low `detailScale` parity, and exhibit-specific causal simulations).
- **Arena Browser WebGL Suite (`playwright.arena.config.ts`, Chrome headless WebGL):** 9 Chromium WebGL tests passed with 0 console/page errors across `_shared/previewHost.e2e.ts` and all 8 replacement journeys.
- **Repository Regression & Integrity Gates:**
  - `npm run typecheck`: PASS
  - `npm run lint`: PASS (`eslint . --max-warnings 0`)
  - `npm test`: PASS (100 files, 987 tests)
  - `npm run build` & `npm run verify:dist`: PASS (238 files, 107.81 MB uncompressed build output, 14.44 MB initial visit bundle of 20 MB budget)
  - `npm run validate:source-parity`, `validate:exhibits`, `validate:hotpaths`, `validate:frameloop`, `validate:privacy`, `check:budgets`: ALL PASS.

**Final Authorization Status:** `NOT AUTHORIZED` — all 8 replacement candidates are delivered in the isolated arena worktree (`arena/eight-replacements`) for side-by-side review only.
