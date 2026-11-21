# E28 Candidate — Ninety Seconds to Vacuum

- **Slot:** `E28` (`south` wing, Tier B · 8 MB)
- **Represented Project:** `P051` — `Against the Void`
- **Architectural Thesis:** A cutaway orbital crisis module with real sacrificial allocation tradeoffs across 4 power cells (`Shielding`, `Reactor`, `O2`, `Evac Bay`), an articulated outer-wing blast bulkhead door, an ascending Evac Pod launch rail, and 3 distinct endings (`STATION_HELD_OUTER_VENTED`, `CREW_EVACUATED_CORE_LOST`, `CONTAINMENT_FAILURE`). Supports both accessible `UNTIMED STEP` mode and automatic `TIMED SIM` mode with 100% outcome parity.

## Verification
- `E28.test.ts`: frozen contract, 0 leaks on remount, 0 plinth hits, all 3 endings, timed/untimed parity, reducedMotion.
- `E28.e2e.ts`: live Chromium WebGL rendering across contrasting crisis endings and clean reset.
