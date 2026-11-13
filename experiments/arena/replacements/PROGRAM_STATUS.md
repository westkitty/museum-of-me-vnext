# Museum of Me — Unified Eight-Exhibit Replacement Program Status

**Branch:** `arena/eight-replacements` (worktree off `origin/main` @ `392a138`)  
**Integration Decision:** `NOT AUTHORIZED` (prototype evaluation only; active museum registry, incumbents, world, and production builds untouched)

## Incumbent Baseline (Reconfirmed)

Verified on `arena/eight-replacements` prior to candidate builds (`npm run typecheck`, `npm run lint`, `vitest run tests/exhibit-quality.test.ts tests/lifecycle.test.ts tests/lifecycle-memory.test.ts`: 3 files / 333 tests PASS):

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

## Eight-Candidate Acceptance Matrix

| Slot | Candidate Path | Source Readiness | Authored Experience | Unit / Lifecycle | Browser Preview | Accessibility | Disposal | Performance vs Incumbent | Comparative Verdict | Blockers | Integration |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `E30` | `experiments/arena/replacements/E30-the-spell-that-leaves-a-scar/` | Grounded (`P053`) | PASS (Causal scar matrix + refraction + undo) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, live announcements, reducedMotion) | PASS (0 leaks on remount) | 173 res / 111 meshes / 7,874 tris / 0 plinth hits (vs 4 incumbent plinth hits) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E28` | `experiments/arena/replacements/E28-ninety-seconds-to-vacuum/` | Grounded (`P051`) | PASS (4 power presets + bulkhead seal + 3 endings) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, untimed/timed parity, reducedMotion) | PASS (0 leaks on remount) | 107 res / 62 meshes / 2,532 tris / 0 plinth hits | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E26` | `experiments/arena/replacements/E26-reality-becomes-a-cartridge/` | Grounded (`P037`, `P038`, synthetic stage labeled) | PASS (Diorama <-> Playable 5-stage Cartridge + Overlay) | PASS (3/3 Vitest) | PASS (Chromium WebGL, 0 console errors) | PASS (5 controls, reducedMotion) | PASS (0 leaks on remount) | 85 res / 45 meshes / 1,180 tris / 0 plinth hits (Tier C pass) | `ACCEPT FOR REVIEW` | None | `NOT AUTHORIZED` |
| `E25` | `experiments/arena/replacements/E25-the-battlefield-inside-the-table/` | Grounded (`P015`) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | None | `NOT AUTHORIZED` |
| `E24` | `experiments/arena/replacements/E24-the-campaign-that-can-break/` | Grounded (`P012`) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | None | `NOT AUTHORIZED` |
| `E12` | `experiments/arena/replacements/E12-the-headline-that-built-two-cities/` | Grounded (`P062`) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | None | `NOT AUTHORIZED` |
| `E20` | `experiments/arena/replacements/E20-the-impossible-cleanup/` | Grounded (`P024`, `P032`, `P061`) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | None | `NOT AUTHORIZED` |
| `E13` | `experiments/arena/replacements/E13-the-disobedient-orchestra/` | Grounded (`P010`) | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | None | `NOT AUTHORIZED` |
