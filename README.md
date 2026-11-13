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

The first visit opens outside on the island plaza. Walk the pier and paths to explore the lagoon,
woodland and northwest gold-spire garden. Approach the south entrance to prepare the interior;
the short vestibule conceals the handoff to the much larger museum. `WASD` or `arrows` move ·
mouse look · `Q/E` rotate · `Shift` sprint · `Space` jump · `F` or `Enter` interact · `M` map ·
`J` journal · `Esc` release pointer. Keyboard-only vertical look uses `Page Up/Page Down`.

## Museum Workshop — development authoring

Museum Workshop is a development-only authoring layer over the real museum scene. Start the normal Vite dev server, then open `http://127.0.0.1:5173/?edit=1`. The normal museum remains active and Workshop starts closed; use the visible `BUILD MODE` control or `F8` to open it. Build Mode releases pointer lock, pauses visitor movement, and suppresses the ordinary entry prompt until it closes.

Workshop Core deliberately edits only safe, non-colliding placement objects. It supports direct Three.js transform gizmos, exact transform fields, world/local mode, floor snapping, add/duplicate/delete, an outliner, and command-style undo/redo. `Save to build` writes the validated, deterministic source manifest at `data/workshop-placements.json`; normal development, production-style, and standalone museum builds consume that same placement source.

The save bridge is a Vite `serve`-only localhost endpoint with a fixed target and shared schema plus conservation validation. Protected routes, interaction/read zones, source installations and structural geometry are rejected with deterministic diagnostics before the target is opened. Production-style builds contain the saved placement runtime but must not contain Workshop UI, styles, transform controls, or the filesystem write endpoint; `npm run verify:dist` enforces that boundary.

Structural/collision-authoritative museum systems remain locked in Workshop Core: walls, floors, stairs, ramps, the flight pad, Dexter Sanctuary route geometry, source installations, authored visitor routes, and other verified spatial invariants are not editable through this first slice.

Useful shortcuts while Workshop is open: `W/E/R` move/rotate/scale · `G` snap to supporting floor · `Cmd/Ctrl+D` duplicate · `Delete` remove · `Cmd/Ctrl+Z` undo · `Shift+Cmd/Ctrl+Z` redo · `Cmd/Ctrl+S` save.

The current exterior includes a complete world-relative crystalline Blood Ring orbit and a visual-only night-island water surface with slow organic motion. Neither changes collision ownership; reduced motion freezes the water.

### Exterior Omni & Island Experience (V3 Uplift)

The island exterior features an authored, walkable visitor landscape featuring 12 signature additions and outdoor furnishings that frame the museum entrance, shoreline, woodlands, and rear grounds:

1. **Arrival Axis Luminous Inlay:** Luminous pale stone walkway embedded with bronze fossil and leaf medallions extending from the pier to the forecourt.
2. **Sculpted Reflecting Rill & West Basin:** Flowing water rill connecting the central forecourt fountain to a sunken west reflecting basin, spanned by a flush stone step-over bridge.
3. **Living Fern Ravine:** Deep emerald fern garden nestled among mossy boulders and roots along the west woodland approach.
4. **Wildflower Pollinator Meadow:** Native wildflower meadow with purple coneflowers, bluebells, and fluttering bounded butterflies.
5. **Neolithic Stone Circle & Altar:** Eight weathered menhirs with petroglyphic engravings, uplighting, center offering altar, and interpretive plinth.
6. **Wildlife Observation Hide:** Slotted timber bird-hide on the eastern lagoon bank with bench seating and a panoramic viewing aperture.
7. **Sculptural Kinetic Wind Grove:** Four bronze aerodynamic pylons with gentle breeze-driven rotating vanes.
8. **Ancient-Tree Landmark:** Gnarled centuries-old oak with buttress roots, weeping canopy, and naturalist bird perches.
9. **Moonlit Lantern Bollard Path:** Shielded bronze path bollards casting amber ground light pools along the north perimeter route.
10. **Coastal Tidepool Garden:** Stepped basalt pools along the southeast coast with transparent seawater, shells, and sea anemones.
11. **Terrace of Astronomical Markers:** Southwest stone terrace featuring eight engraved seasonal markers and a central bronze gnomon.
12. **Monumental Rear-Garden Reveal:** Symmetrical stone terracing behind the north museum facade, with accessible dual ramps, stone stairs, manicured boxwood parterres, and the soaring bronze "Wings of Dawn" raptor sculpture.

**Outdoor Furnishings & Statuary:** Teak and bronze seating along promenades, bronze animal sculptures (Hare, River Otter, Horned Owl), and Neolithic megaliths (Sandstone Stele, Dolmen).

**Hard Streaming Boundary:** When `activeWorld === 'exterior'`, 0 interior render/update objects reside in the active scene graph. The entrance vestibule at `z=128` presents a warm, illuminated interior foyer visible from outside. Crossing the threshold executes an atomic one-frame world transition, with exterior landscape visible back through the entrance portal.

Full evidence, collision verification, and performance data are documented in `docs/evidence/exterior-omni-v2/FEATURE_MATRIX.md` with full-resolution screenshots in `docs/evidence/exterior-omni-v2/`.

## Developer free flight and manual sky clock

On the Vite dev server, open `/?edit=1` (alongside Workshop) or `/?devtools=1` (flight/sky controls without Workshop). A compact **DEV / FLIGHT + SKY** panel appears only in those development sessions, starts with normal walking, and is absent from production and ordinary visitor mode.

Press **V** or **Enable Free Flight** to start direct noclip movement anywhere in the museum. **WASD** and look fly in the camera direction, **Space** rises, **Ctrl** descends, and **Shift** moves faster. Press **V** to exit and resume ordinary gravity/collision; if the visitor ends up inside geometry or without floor support, exit returns to the safe position where flight began. Close Workshop or an input-capturing museum panel before flying. The existing Rotunda flight pad remains unchanged.

Use the **Sky time of day** slider to preview 00:00–24:00 in quarter-hour increments, including sunrise, noon, and sunset. It updates the real sky shader, horizon fog, and exterior lighting without a second scene or render loop. **Restore Canonical Night** resets the approved night appearance. The clock does not run automatically and is never written to visitor preferences or production builds.

## Visitor Choreographer — development preview

Start the Vite development server and open `/?choreo=1`. After entering the museum, use the visible **Visitor Choreographer** button. Its ordinary accessible Panel supports Close/Escape, focus trapping and focus restoration. Play/Pause, Restart, the time scrubber, floor selection and route visibility operate on a nominal source-route simulation through the existing app loop. Closing pauses playback; reopening retains the selected time. Restart resets to zero and pauses.

The projection preserves all 17 authored identities and vNext routes. It uses horizontal route distance, mean authored pauses and interpolated height; it is **not runtime telemetry**, collision resolution, conversation/seated behavior, congestion analysis or a competing architectural authority. Source visitor behavior and museum geometry remain unchanged. The tool is dynamically loaded only in development and is excluded from production and standalone artifacts. Empty, unused Jules script/proof placeholders were removed; regression proof lives in the unit and browser suites.

## External spatial workbench — 2D plan and opt-in 3D survey

Open `/workbench/` on the dev server to use the source-pinned architectural planning map. **2D Plan** is the default and retains its search, floors, source-installation/visitor overlays, measure/ruler, notes, pins, proposed moves, undo, JSON import/export and SVG export.

Choose **3D Museum** to lazy-load a separate local Three.js 0.185.1 page. Its **Museum** view builds
the real indoor architecture with `Museum.build()` and the canonical exhibit placements used by the
playable world. Its **Full Island** view uses the same `ExteriorWorld` builder as the playable
exterior and does not build the interior until Museum view is selected. Drag to orbit, right-drag to
pan, scroll/pinch to zoom, use the island camera presets, isolate museum floors or wings, toggle roof
cutaway, select any of the 35 exhibit anchors or Dexter Sanctuary, and inspect/annotate positions.
In **+ Pin** mode click a physical surface; indoor pins retain their floor and optional Y, while
exterior pins keep exact X/Y/Z with `worldId=exterior` and a stable feature ID when the surface is
tagged. Legacy pins without a world ID continue to load as interior pins. Proposed-move ghosts and
authored visitor routes remain read-only layers. Select a room in either view to update the shared
workbench inspector.

3D mode is a **read-only architectural survey**: it never edits the authoritative museum mesh, collisions, routes, gameplay, or curated exhibit content. It does not claim to reproduce streamed live exhibit simulations. It adds no remote runtime assets and does not load a second WebGL renderer until the 3D mode is selected. Switching back to 2D unloads/disposes the viewer. A complete Vite build/served folder is necessary for the 3D view; simply opening the lone original 2D HTML through `file://` still provides the original 2D plan, not the bundled 3D viewer.

**Full Island survey:** Choose `Full Island` from the 3D viewer, or open `/workbench/?view=island` to enter it directly. This view builds the shared `ExteriorWorld`, including the island terrain, irregular shoreline, lagoon, paths, woodland, spire garden, pier, compact shell and canonical night sky. The interior museum is not built in Island view. Switch to `Museum` to inspect the full indoor architecture, both floors and all six wings with the existing cutaway tools.

The 3D presentation now prioritizes the model: both outer sidebars start folded, at most one opens, and its desktop width cannot exceed **29% of the viewport** (mobile uses a bottom drawer capped at **29% of viewport height**). The 3D viewer's secondary tools/layers also fold down. Select an exhibit or place a planning pin to open the inspector when needed. Switching back to the 2D plan restores the existing layout and original version-1 planning data. Full Island is a planning/render survey, not a second gameplay engine or live exhibit simulation; source-island surface and water remain visual-only and do not change museum collisions. The survey holds the water at a still shader frame to preserve the museum's single-loop invariant; the separate playable museum retains its own water animation. The opt-in viewer disposes its resources when unloaded.

This feature is being reviewed on its own branch; passing CI does not by itself certify real-device visual quality or 1.0 maturity.

Quality settings apply live to deterministic landscape detail, wildlife, water and streaming. Landscape
changes preserve the existing physical colliders, paths, pier and landmarks; visual detail batches
release their old GPU resources rather than retaining High detail on Low. Instancing and tier-specific
geometry detail are active; distance-based runtime LOD remains disabled.

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

The September 2026 collection revision currently represents **73 project identities** across the same 35 physical exhibit slots. It updates rooms to reflect projects that now exist in materially stronger forms, including the Starsilk Compendium, Selfsame, Project Sentinel, RepoForge, Character Performance Capture, ClearCut Local, AndrewOS Mac Bridge, the Modern 3D Browser Game Toolkit, and 2D Game Factory. The 35-room architecture is preserved while the collection becomes current again.

Future 1.0 status will require an explicit owner decision based on the museum as a product — collection accuracy, exhibit quality, spatial/visual presentation, visitor experience, representative-device behavior, and remaining major ambitions — not merely a branch name or a green CI run.

## Lineage

This is a new product lineage rather than another restoration pass. Historical Reliquary artifacts remain preserved as evidence. Likewise, the erroneous `v1.0.0` branch/PR/merge labels remain in Git history as evidence of what happened; current documentation corrects their authority instead of rewriting that history away.

## Shared Three.js AI development toolkit

The user-level shared toolkit is documented in [docs/THREEJS_AI_TOOLKIT.md](docs/THREEJS_AI_TOOLKIT.md). It reuses this repository's existing play, Workshop, flight/sky and Museum/island workbench entry points; its MCP tools and browser bridge are not Museum runtime dependencies. Launch with `3d-lab museum --project "$PWD" [play|workshop|flight|island|workbench]` after installing the global toolkit.
