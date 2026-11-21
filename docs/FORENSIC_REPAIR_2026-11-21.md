# Forensic visual, camera and traversal repair (2026-11-21)

Base: `main` at `3840551` (PR #67), the same revision Pages serves. This is local work only: no commit, push, merge or deploy was authorized for this pass.

Leads came from the owner's written walkthrough notes (published museum, about 3 min 24 s). Each lead was reproduced in the running app (Vite dev server, headless Chromium with SwiftShader) before anything was changed.

## Findings

| # | Lead | Classification | Evidence and cause |
|---|---|---|---|
| 1 | Entrance reads nearly solid black | **CONFIRMED** (medium) | See below. |
| 2 | Atrium presentation | NOT A DEFECT | Hologram, six fountains, banners and floor are readable at entry and mid-atrium. The light-up sequence and timing are unchanged. |
| 3 | Games & Play / Rotunda wayfinding | HISTORICAL, FIXED in #67 | Benches, pilasters, skirting and decor in doorways were fixed in `3840551`. All 57 passages and 169 lanes walk clean at this base, and no new obstruction was reproduced. |
| 4 | Stink Weasel Den / Dexter Sanctuary | **CONFIRMED** (high) | See below. |
| 5 | Camera obstruction during flight | **CONFIRMED** (critical) | See below. |
| 6 | Stairs / elevated geometry | HISTORICAL, FIXED in #67 | Stair collision follows the treads across their width (oriented ramps). Stair lanes walk clean with no camera penetration. The fully white baseline frame came from a teleport into a step, not from walking. |
| 7 | "Click to resume museum look" | INTENTIONAL | This is the HUD's resume prompt after pointer-lock release. `pointerlockchange` and blur listeners are paired with removals (`Input`, `UILayer`, `Lifecycle`); blur releases held keys. Escape plus keyboard movement is covered by existing browser tests. Real pointer-lock feel is UNVERIFIED, since headless browsers can't grant it. |
| 8 | Ticket kiosk and entry | VERIFIED, protected | Kiosk F interaction, ticket-gated door, non-modal welcome and re-entry are covered by the existing browser tests and the grand tour. |

### Issue 1: entrance reads nearly solid black

The exterior "threshold buffer" behind the z = 128 doorway was unlit near-black (`0x03070f`) after PR #67. From inside the sphere, the opening showed no walking surface. The sphere's floor guide also dropped to opacity 0.10 when seen from outside.

**Source:** `ExteriorWorld.buildThresholdVestibule` and `buildThresholdContinuity`; `ObsidianSphereEntrance.update`.

### Issue 4: Stink Weasel Den / Dexter Sanctuary

Two causes:

1. **A ground plane across the trench.** The interior world's 600 m ground plane (plaza colour `0xd8d4ca`, y = −0.5) lay uncut across the Sanctuary ramp trench. On the upper half of the descent the eye is above it, so it read as a flat white floor at eye height that hid the ramp and the Sanctuary.
   - **Source:** `Museum.buildExterior`. The collision was already cut; only the mesh was not.
2. **The visitor floated above the ramp.** The ramp's collision was padded axis-aligned pieces on a diagonal. Overlapping pieces returned the higher surface, so the visitor stood about 0.5 m above the visible ramp (support −1.97 where the ramp is at −2.52).
   - **Source:** `GeometryKit.ramp`.

### Issue 5: camera obstruction during flight

**Contract:** `PlayerController.fixedUpdateFlight` (owner request, #64): *"collides like walking does … ceilings stop the climb … without this a flying visitor could pass into solid geometry or out of the building."*

**Reproduced with the real controller:**
- Flying toward the dome, the camera passed inside the dome mesh and left the museum (y 78).
- Sprinting up toward the south balcony, the visitor rose through the balcony slab and left the building (y 34, over the south wing).
- Flying level into a slab's thickness entered it.

**Cause:**
- Ceilings were only wall colliders.
- Floor slabs record only their top face, so they were never solid from below or from their edge.
- The glass dome had no collider.

**Not a defect:** a white viewport when pressed against a wall at 0.35 m (the capsule radius) is the normal wall press.

**After the fix:** in the same scenarios, the visitor stays inside the rotunda (max y 22.5 under the glass) with no penetration. A remaining "inside" signal in the probe was a false positive: the camera seen from below the double-sided dome glass.

## Repairs

- **Flight respects slabs and the dome.**
  - `CollisionWorld.walkableSurfaceBetween`: a new query that honours floor masks (so stair wells stay open) and oriented ramps.
  - `PlayerController.resolveFlightSlabs`: floors and ramps are solid slabs (`FLIGHT_SLAB_DEPTH` 0.6 m) to a flyer. A climb stops beneath the underside, and a sideways move into a slab's thickness is refused.
  - The rotunda dome gets tiled ceiling colliders just inside the glass (`Museum`). Walkers never reach them.
  - **Unchanged:** launch, look-steered flight, Shift speed, landing and resuming walking.
- **Sanctuary.**
  - The ground plane is a `ShapeGeometry` with the ramp trench cut out (UVs normalised as before).
  - `GeometryKit.ramp` emits one exact oriented ramp. The surface now matches the visible ramp within 0.05 m.
  - Dexter, the dais, the reference displays and the Sanctuary hierarchy are unchanged.
- **Entrance.**
  - The threshold buffer is deep navy with a lit walking surface: floor `0x10213a`, runner `0x24507a`, inlays and coffers in azure.
  - The sphere's floor guide holds at least 0.3 opacity.
  - Still darker than the lit exterior, still unlit (no lights, so no new shader variants).
- **Virtual Visitor Jury walker** (`src/workshop/VisitorJury.ts`).
  - Exact ramp geometry exposed a latent tunnelling bug: a lateral nudge could land the walker inside a thin obstacle, which was then expelled through its far side.
  - Strides and nudges whose path crosses a solid overlay box are now refused.

## Tests

- **New: `tests/forensic-repair-2026-11-21.test.ts`.** It covers:
  - flight stopping under the dome;
  - no rising through the balcony slab;
  - a level flight into the slab edge being refused, then landing;
  - the launch still rising;
  - the ramp surface matching the visual at five points;
  - no ground plane over the trench.

  5 of 6 fail on the unfixed code (the launch test passes on both, as it should).
- **Updated: `tests/obsidian-entrance-2026-11-20.test.ts`.** The reduced-motion floor-guide value follows the raised minimum; the stable-level assertion is unchanged.

## Validation (local working tree)

| Check | Result |
|---|---|
| Typecheck and lint | PASS |
| `npm run gate` | PASS: 119 files, 1,198 Vitest tests, validators, build, budgets, `verify:dist` |
| Full Playwright suite | 84/84 PASS, including passage traversal (57 passages, 169 lanes), the grand tour, cinematic arrival / ticket, shader stability and the Workshop browser tests |
| `build:standalone` + `verify:standalone` | PASS: 14/14 installations, 17/17 visitors, 0 remote requests |

Evidence: `docs/evidence/forensic-repair-20261121/`

## Not verified here

- Real pointer-lock and touch feel.
- Real-device FPS.
- Human visual acceptance of the brighter threshold floor and the Sanctuary ramp view.
- Exact-head CI, since nothing was pushed.
