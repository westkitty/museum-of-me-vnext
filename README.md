# Museum of Me — The Reliquary of Iterative Becoming (vNext)

A persistent first-person Three.js museum. One continuous two-level building, six themed wings, a
monumental central Rotunda, and a sacred Dexter Sanctuary. It presents **64 project identities
through 35 visitor-facing exhibits**.

The museum presents the projects. It does not glorify their creator.

## Run it

```bash
npm install
npm run dev
```

Then walk in. `WASD` or `arrows` move · mouse look · `Q/E` rotate · `Shift` sprint · `Space` jump ·
`F` or `Enter` interact · `M` map · `J` journal · `Esc` release pointer. Keyboard-only vertical look
uses `Page Up/Page Down`.

## Museum Workshop — development authoring

Museum Workshop is a development-only authoring layer over the real museum scene. Start the normal
Vite dev server, then open `http://127.0.0.1:5173/?edit=1`. The normal museum remains active and
Workshop starts closed; use the visible `BUILD MODE` control or `F8` to open it. Build Mode releases
pointer lock, pauses visitor movement, and suppresses the ordinary entry prompt until it closes.

Workshop Core deliberately edits only safe, non-colliding placement objects. It supports direct
Three.js transform gizmos, exact transform fields, world/local mode, floor snapping, add/duplicate/
delete, an outliner, and command-style undo/redo. `Save to build` writes the validated, deterministic
source manifest at `data/workshop-placements.json`; normal development, production, and standalone
museum builds all consume that same placement source.

The save bridge is a Vite `serve`-only localhost endpoint with a fixed target and shared schema plus
conservation validation. Protected routes, interaction/read zones, source installations and
structural geometry are rejected with deterministic diagnostics before the target is opened.
Production builds contain the saved placement runtime but must not contain Workshop UI,
styles, transform controls, or the filesystem write endpoint; `npm run verify:dist` enforces that
boundary.

Structural/collision-authoritative museum systems remain locked in Workshop Core: walls, floors,
stairs, ramps, the flight pad, Dexter Sanctuary route geometry, source installations, authored
visitor routes, and other verified spatial invariants are not editable through this first slice.

Useful shortcuts while Workshop is open: `W/E/R` move/rotate/scale · `G` snap to supporting floor ·
`Cmd/Ctrl+D` duplicate · `Delete` remove · `Cmd/Ctrl+Z` undo · `Shift+Cmd/Ctrl+Z` redo ·
`Cmd/Ctrl+S` save.

The canonical exterior includes a complete world-relative crystalline Blood Ring orbit and a
visual-only night-island water surface with slow organic motion. Neither changes collision ownership;
reduced motion freezes the water.

## Validate it

```bash
npm run gate          # canonical automated release gate: checks, QA report, build, budgets
npm run test:workshop # real Chromium Workshop authoring + source-save/reload journey
```

## Structure

| Path | What |
|---|---|
| `docs/MUSEUM_VNEXT_BUILD_PLAN.md` | the controlling build plan, byte-identical to the handoff |
| `docs/INVESTIGATION_BASELINE.md` | environment, source authority, and what was verified |
| `docs/ARCHITECTURE.md` | frame loop, streaming, collision, resource ownership |
| `docs/EXHIBIT_CONTRACT.md` | the frozen exhibit interface |
| `docs/ASSET_POLICY.md` | procedural-first asset governance |
| `docs/PRIVACY_POLICY.md` | what may never appear in visitor-facing space |
| `data/exhibit-mapping.json` | the frozen 64 → 35 mapping |
| `data/projects/*.json` | museum copy for all 64 projects |
| `data/workshop-placements.json` | versioned authoring source written by the dev-only Museum Workshop |
| `src/workshop/` | placement runtime, schema/history, safe-prefab catalog, and dev editor |
| `docs/DEPLOYMENT.md` | how to host it, and the one decision that remains |
| `docs/RELEASE_CHECKLIST.md` | the release gate, item by item, with the evidence for each |
| `validation/reports/QA_REPORT.md` | per-exhibit QA checklist and coverage |
| `validation/reports/WALKTHROUGH_2026-08-19.md` | runtime evidence from the full 35-exhibit browser walkthrough |
| `OPERATIONAL_STATE.md` | current truth: what is built, what is verified, what is not |

## State

The implementation scope through the governing build plan's Phase 13 is complete, and Phase 14
release preparation is documented. Thirty-five bespoke exhibits represent 64 project identities
exactly once; traversal and lifecycle gates are automated through the canonical release gate.

The current implementation candidate is `feature/museum-workshop-core-2026-08-26` at committed
HEAD `bf2fe0611c5c06e69316ec1bbc3cbf81bfac41e2`; the checkout may contain newer uncommitted
candidate changes, so exact-head checks must be rerun after the candidate is frozen. The older
`release/v1.0.0` branch and `main` are not the current implementation. Publication remains a
separate owner decision because it exposes the documentation of sixty-four projects publicly.
`docs/RELEASE_CHECKLIST.md` distinguishes automated proof, human/device acceptance, and hosted
verification.

## Lineage

This is a **new product**, not a restoration. The historical Reliquary artifacts — five single-file
HTML builds and three handoff archives — are preserved unmodified in the parent directory and hashed
in `docs/INVESTIGATION_BASELINE.md`. Nothing here overwrites them.
