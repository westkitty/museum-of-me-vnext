# Museum of Me — The Reliquary of Iterative Becoming (vNext)

A persistent first-person Three.js museum in **active pre-1.0 development**. One continuous two-level building, six themed wings, a monumental central Rotunda, and a sacred Dexter Sanctuary. The building keeps **35 stable visitor-facing exhibit slots** while the represented project inventory remains a living collection rather than a frozen August 2026 snapshot.

The museum presents the projects. It does not glorify their creator.

> **Status correction, 2026-09-03:** earlier branch/PR/merge history labeled this project `v1.0.0` / release-ready. That milestone claim was wrong and is superseded. The integrated code remains useful development work; the release label does not govern product maturity. See `docs/DEVELOPMENT_STATUS.md`.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` regenerates the current collection from the versioned data layer before starting Vite.

Then walk in. `WASD` or `arrows` move · mouse look · `Q/E` rotate · `Shift` sprint · `Space` jump · `F` or `Enter` interact · `M` map · `J` journal · `Esc` release pointer. Keyboard-only vertical look uses `Page Up/Page Down`.

## Museum Workshop — development authoring

Museum Workshop is a development-only authoring layer over the real museum scene. Start the normal Vite dev server, then open `http://127.0.0.1:5173/?edit=1`. The normal museum remains active and Workshop starts closed; use the visible `BUILD MODE` control or `F8` to open it. Build Mode releases pointer lock, pauses visitor movement, and suppresses the ordinary entry prompt until it closes.

Workshop Core deliberately edits only safe, non-colliding placement objects. It supports direct Three.js transform gizmos, exact transform fields, world/local mode, floor snapping, add/duplicate/delete, an outliner, and command-style undo/redo. `Save to build` writes the validated, deterministic source manifest at `data/workshop-placements.json`; normal development, production-style, and standalone museum builds consume that same placement source.

The save bridge is a Vite `serve`-only localhost endpoint with a fixed target and shared schema plus conservation validation. Protected routes, interaction/read zones, source installations and structural geometry are rejected with deterministic diagnostics before the target is opened. Production-style builds contain the saved placement runtime but must not contain Workshop UI, styles, transform controls, or the filesystem write endpoint; `npm run verify:dist` enforces that boundary.

Structural/collision-authoritative museum systems remain locked in Workshop Core: walls, floors, stairs, ramps, the flight pad, Dexter Sanctuary route geometry, source installations, authored visitor routes, and other verified spatial invariants are not editable through this first slice.

Useful shortcuts while Workshop is open: `W/E/R` move/rotate/scale · `G` snap to supporting floor · `Cmd/Ctrl+D` duplicate · `Delete` remove · `Cmd/Ctrl+Z` undo · `Shift+Cmd/Ctrl+Z` redo · `Cmd/Ctrl+S` save.

The current exterior includes a complete world-relative crystalline Blood Ring orbit and a visual-only night-island water surface with slow organic motion. Neither changes collision ownership; reduced motion freezes the water. Their final visual quality remains a human judgment, not something an automated gate can declare finished.

## Validate it

```bash
npm run gate          # canonical development gate: collection, checks, QA, build, budgets
npm run test:workshop # real Chromium Workshop authoring + source-save/reload journey
```

Existing scripts whose filenames include `release` remain as readiness tooling and compatibility surfaces. Their names do not imply that the product is currently a release candidate.

## Collection model

The physical building has 35 stable exhibit slots. The project inventory is versioned and may grow.

- `data/exhibit-mapping.json` — preserved historical 2026-08-19 collection snapshot (64 project identities).
- `data/exhibit-mapping.current.json` — current development collection when present.
- `data/exhibit-content.json` — original exhibit interpretation.
- `data/exhibit-content.revision2.json` — current interpretation overrides for materially revised exhibits.
- `data/projects/*.json` — project records, including later additions.
- `src/content/collection.generated.ts` — generated current collection; do not hand-edit.

Every current project identity must map exactly once to one of the 35 exhibit slots. An older project may remain as lineage inside a room while a newer project becomes that room's primary subject. Dexter remains outside the project mapping. A rotating `NOW BUILDING` surface may show current experiments without promoting unfinished work into the permanent collection.

## Structure

| Path | What |
|---|---|
| `docs/DEVELOPMENT_STATUS.md` | controlling correction: active development / pre-1.0 |
| `docs/MUSEUM_VNEXT_BUILD_PLAN.md` | original construction plan; historical design authority, not a completion certificate |
| `docs/INVESTIGATION_BASELINE.md` | environment, source authority, and historical verification |
| `docs/ARCHITECTURE.md` | frame loop, streaming, collision, resource ownership |
| `docs/EXHIBIT_CONTRACT.md` | exhibit interface and lifecycle contract |
| `docs/ASSET_POLICY.md` | governed asset policy |
| `docs/PRIVACY_POLICY.md` | what may never appear in visitor-facing space |
| `data/exhibit-mapping.json` | frozen 2026-08-19 collection snapshot |
| `data/exhibit-mapping.current.json` | current living collection mapping |
| `data/projects/*.json` | museum copy for the current project inventory |
| `data/workshop-placements.json` | versioned authoring source written by the dev-only Museum Workshop |
| `src/workshop/` | placement runtime, schema/history, safe-prefab catalog, and dev editor |
| `validation/reports/QA_REPORT.md` | per-exhibit automated QA checklist and coverage |
| `OPERATIONAL_STATE.md` | additive truth ledger: built, verified, unknown, superseded, pending |

## Current state

The repository contains substantial working infrastructure: a continuous Three.js museum, 35 bespoke exhibit classes, Workshop authoring, source-installation paths, authored visitor conversations, local/offline verification tooling, Quaternius ambient visitors, night exterior, flight pad, curved stairs, the local Full Weasel integration, and a deterministic DexGPT guide.

Those are implementation facts. They do **not** mean the museum is close enough to finished to call 1.0.

The September 2026 collection revision updates several rooms to reflect projects that now exist in materially stronger forms: the Starsilk Compendium, Selfsame, Project Sentinel, RepoForge, Character Performance Capture, ClearCut Local, AndrewOS Mac Bridge, and the Modern 3D Browser Game Toolkit. The 35-room architecture is preserved while the collection becomes current again.

Future 1.0 status will require an explicit owner decision based on the museum as a product — collection accuracy, exhibit quality, spatial/visual presentation, visitor experience, representative-device behavior, and remaining major ambitions — not merely a branch name or a green CI run.

## Lineage

This is a new product lineage rather than another restoration pass. Historical Reliquary artifacts remain preserved as evidence. Likewise, the erroneous `v1.0.0` branch/PR/merge labels remain in Git history as evidence of what happened; current documentation corrects their authority instead of rewriting that history away.
