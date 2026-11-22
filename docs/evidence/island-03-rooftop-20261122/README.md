# ISLAND-03 — Rooftop Café, Hot Dog Stand, Glass Greenhouse, Flight Pad II (2026-11-22)

Branch `feat/island-03-rooftop-architecture`. Draft authored by Antigravity Worker 03 on `a358b66` (uncommitted when its quota ran out); preserved as WIP `a7ed0aa`, then completed and integrated on current `main` by Claude Code.
Contract: `docs/plans/WORLD_EXPANSION_GROKBOT_MASTER_20261121.md` §6 (rooftop), handoff blueprint §5.1.

## What is built (IMPLEMENTED)

- West Flank Ascent from Path 5 (`[-42, -0.5, 114]`): lower ramp → landing (Y 9.5) → upper ramp → bridge onto the roof at `ROOF_DECK_Y = 18.6` (slab 0.35, underside 18.25 above barrel peak 18.17). Guardrails on every ramp and deck edge.
- Rooftop Café terrace with tables (collision-backed) and the Hot Dog Stand at `[7.5, 18.6, 29.0]` (`rooftop-hot-dog-stand`; awaits its chef, ISLAND-04).
- Glass Greenhouse (X −35..−17.5, Z −2..22) with the exotic W05 portal flower at `[-26, 18.6, 10]` (`rooftop-greenhouse-flower-w05`, dormant).
- Flight Pad II at `[0, 18.6, 54]`, stronger than the Rotunda pad (`ROOF_FLIGHT_PAD_II_LAUNCH_SPEED`), with two aim arcs (NE → W06, S → W10). Exterior-only; the Rotunda Flight Pad I is interior-only and unchanged.
- Reduced motion: Pad II does not launch; a step-free console (`rooftop-flight-pad-ii-teleport`) gives the same destination information. Both destinations are dormant (master plan line 85: Skyborne when W06 is ready; Wilderness after the first earned stamp and W10 ready).
- All `rooftop-*` interactables are excluded from the visit journal. Zero `THREE.Light`. Protected Cinema envelope untouched; a unit test derives the Cinema bounds from `cinemaLayout.ts` and checks the envelope contains them.

## Verification (Chrome + SwiftShader software WebGL, not Apple Metal FPS)

- `tsc --noEmit` PASS; full Vitest suite 128 files / 1,309 tests PASS on the integrated branch.
- Playwright: `rooftop.e2e.ts` (walk up, greenhouse, café, stand, pad, back down), `cinema.e2e.ts` (5), `cinema-youtube.e2e.ts` (5), `quality-transitions.e2e.ts` — 12/12 PASS.
- Captures in this folder were regenerated on the integrated branch and inspected. The vertical brass line above the flower in `greenhouse-w05-flower.png` is the greenhouse ridge bar seen end-on, not a stray object.

## Not verified

Human visual acceptance; real-device performance (`perf:device`); hosted Pages (deferred to the island release). Hot Dog Man himself is ISLAND-04.
