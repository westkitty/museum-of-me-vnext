# E25 Candidate — The Battlefield Inside the Table

- **Slot:** `E25` (`south` wing, Tier B · 8 MB)
- **Represented Project:** `P015` — `DnDex` / `DM_Hub`
- **Architectural Thesis:** A crafted 5×3 tactical battletable showing deterministic turn order, stone cover occlusion, live sightline beam rendering (`Filament`), and causal replay: shifting 1 square behind the West Cover Pillar flips the exact 3-turn combat outcome from `DEFEAT` to `VICTORY`.

## Verification
- `E25.test.ts`: frozen contract, 0 leaks, 1-square outcome flip proof, reset & initiative order.
- `E25.e2e.ts`: live Chromium WebGL rendering comparing exposed `DEFEAT` vs covered `VICTORY`.
