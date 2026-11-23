# E24 Candidate — The Campaign That Can Break

- **Slot:** `E24` (`south` wing, Tier A · 15 MB)
- **Represented Project:** `P012` — `The Era of Invincible Magic`
- **Architectural Thesis:** 4-region miniature campaign board (`Westmarch`, `Saltfen`, `Thornwood`, `Last Keep`) with banner movement, fortification, synthetic broken-ID injection (`loc_thornwood_MISSING`) that physically collapses the Saltfen–Thornwood supply bridge and blocks marching, plus schema diagnosis & repair.

## Verification
- `E24.test.ts`: frozen contract, 0 leaks, broken-ID march block, repair, fortify, and reset.
- `E24.e2e.ts`: live Chromium WebGL rendering across intact, broken-bridge, repaired, and reset states.
