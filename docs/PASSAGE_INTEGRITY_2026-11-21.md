# Passage integrity: complete walkthrough, doorway, collision and visual repairs (2026-11-21)

Base: `main` at `148c8d0` (PR #66, Obsidian Sphere). Pre-1.0; nothing merged or published by this work.

## What was built to find the defects

- **`src/world/passages.ts`: authoritative passage inventory**, derived from the same layout authority that builds the architecture. It lists:
  - every arrival, sphere, seam, atrium, vestibule, wing-arch, corridor-to-hall, exhibit-bay, stair and Sanctuary passage;
  - for each one, walking lanes across its usable width: the centre and both edges at (half-width − capsule radius 0.35 − tolerance 0.15).
- **`tests/browser/passage-traversal.e2e.ts`: walks every lane inbound and back out**, in the running app.
  - **What drives it:** the real held `W` key, the real `PlayerController`, and the world's fully assembled `CollisionWorld` (architecture, installations, dressing), through the app's own `fixedUpdate`/`variableUpdate`.
  - **Teleports:** only to place a lane's start. The return walk starts where the outbound walk actually ended.
  - **Each lane records:**
    - arrival;
    - floor support;
    - headroom;
    - stalls and blocking colliders;
    - any visible, solid-looking mesh the capsule enters (rays at knee, chest and head height, with penetration depth).
  - **Output:** `test-results/traversal/{manifest.json,report.md}`.
- **`tests/browser/museum-grand-tour.e2e.ts`: one continuous visit with no teleport after arrival.** The visitor:
  1. takes a ticket at the kiosk with F;
  2. walks through the sphere around its column, across the seam and through the atrium;
  3. visits all 35 exhibits by the guide's own routes, into each visitor spot and back;
  4. goes to the Sanctuary;
  5. leaves the museum through the seam and re-enters.

## Coverage

| | Baseline (`148c8d0`) | After |
|---|---|---|
| Passages inventoried | 57 | 57 |
| Passage verdicts | 43 PASS · 14 FAIL · 0 UNKNOWN | **57 PASS · 0 FAIL · 0 UNKNOWN** |
| Lanes walked in and back out | 152 / 169 | **169 / 169** |
| Exhibit visitor spots reached | 35 / 35 | 35 / 35 |
| Visible solid-looking geometry walked through | many (bays, arches, vestibule, sphere exit, stairs, Sanctuary) | **0** |
| Continuous grand tour | — | **2,179 m, 303 legs, 35/35 exhibits, ticket by F, exit and re-entry** |

The 57 passages are made up as follows:
- **Exterior and seam (6):** kiosk, sphere outer aperture, west and east column routes, and the sphere → atrium seam.
- **Atrium and vestibule (2):** the atrium inner portal and the vestibule → south hall doorway.
- **Wings (12):** an arch and a corridor → hall junction for each of the six wings.
- **Exhibit bays (35).**
- **Vertical circulation (2):** the two grand stairs.
- **Dexter Sanctuary ramp (1).**

Inventory note: the 35 exhibit doorways are hall-to-bay openings. No exhibit uses a different access topology, and each is approached from its hall.

## Defects found and repaired (root cause → fix)

### Collision

1. **Wall colliders padded into every opening.** `GeometryKit.wallCollision` padded each collider by half the wall's thickness at both ends. Every doorway, arch and bay opening was 0.6–1.2 m narrower in collision than it looked.
   - Diagonal walls were chunked into axis-aligned boxes padded on both axes. A 45° wall was about 0.3 m fatter per side than its visual.
   - **Fix:** the collider is the visible box. Axis-aligned walls pad only across their thickness; diagonal walls are one exact oriented collider.
   - **Side effect:** static colliders drop from 2,743 to 851 for the same architecture.
2. **Source-installation plinths in 13 of 13 host bay doorways.** The front corner behind the wall return is 3.5 m along the hall, but the frozen source footprint is 3.8 m, so each plinth spilled about 0.6 m into the doorway's span, 0.4 m behind the wall line.
   - **Fix:** plinths are now set back 1.55 m (`DOORWAY_SETBACK`).
   - **Three bays can't take the setback:** E01, E08 and E14. Their exhibits' real geometry, measured, or the exhibit-clearance contract would be hit.
   - **For those three, the hall wall now returns to the plinth's edge** (`bayOpeningSpan`). The doorway is slightly narrower and solid-jambed, and clear across its whole width. The doorways become: E01 8.3 m, E08 8.3 m, E14 6.8 m.
   - **Footprint:** frozen source-parity data (4.7 × 3.8 m), unchanged.
3. **Oversized installation colliders on diagonal wings.** Installation colliders were world-aligned boxes; on the diagonal media/infra wings the enclosure reached 1.15 m into the hall (E14).
   - **Fix:** exact oriented collider.
4. **Sphere column collider larger than the column.** The heptagonal column (radius 2.95) used a 5.9 m square collider whose corners reached 4.17 m, an invisible 1.2 m beyond the column on both walk-around routes.
   - **Fix:** four overlapping oriented bands, an octagon of 2.8–3.03 m.
5. **Grand stairs: walking surface below the visible treads at the edges.**
   - **Cause:** each curved flight's collision was axis-aligned linear ramps, so height followed the treads only along the centreline. At the edges of the 3.2 m-wide diagonal flights, the walking surface was up to about 1.3 m away from the visible steps.
   - **Fix:** a new oriented ramp type in `CollisionWorld`, with one ramp per chord. The surface now matches the treads within 0.05 m across the width.
   - **Consequence:** the guide's route network, the canonical route and the tests now step on and off each stair from in front of its foot (`stairApproach`), instead of diagonally across the lowest treads.

### Doorway obstructions and walk-through visuals

6. **Benches in exhibit doorways.**
   - **Cause:** Detailing placed "a bench opposite each bay"; where both hall sides have a bay at the same position, that bench stood in the other bay's doorway.
   - **Fix:** benches go on solid wall (`alongClearOfBayOpenings`).
7. **Pilasters standing in doorways.** On the 6 m pilaster rhythm, two 13 m pilasters fell inside most 9 m bay openings.
   - **Fix:** pilasters only on solid wall.
8. **Skirting across every threshold.** The hall skirting (0.13–0.47 m) ran straight across every bay doorway.
   - **Fix:** the skirting stops at each doorway. Each wall's skirting is still one merged mesh.
9. **Bay jambs inside the opening.** Jambs were centred on the opening edges, 0.21 m inside the clear span.
   - **Fix:** they frame the span from outside.
10. **Hall decor beside doorways.** The wing motif sculptures, furnishings and monumental ribs stood beside or in bay doorways.
    - **Fix:** all are placed on solid wall, using a shared `bayClearance.ts`.
11. **Wing-arch threshold markers** stood 0.29 m proud of the corridor wall.
    - **Fix:** they're flush with it.
12. **Plants in doorways.** Rotunda plants stood in the Sanctuary doorway (NW) and on both grand-stair feet (SW, SE), and the vestibule plants stood inside the 8 m south-hall doorway.
    - **Fix:** one plant kept in the real blind zone (NE); the vestibule plants moved to the walls.

### White surfaces and the sphere exit

13. **Large featureless white surfaces near the atrium doorway.** These were `EnvironmentDressing`'s "neutral baseline" vestibule overlays: two blank 8 m × 12.6 m white panels and a white floor strip.
    - Next to the dark-blue atrium they read as a white void.
    - Being non-colliding, they stood inside the 14 m atrium portal, so visitors walked through them.
    - Two old front-door columns (also non-colliding) stood in the same portal.
    - **Fix:** all removed. The vestibule shows its own south-wing walls.
14. **Facade piers in the inner portal.** The interior copy of `ExteriorIdentity` (facade piers) was built at the exterior door plane, so its piers stood in the atrium's inner portal.
    - **Fix:** it is built at the atrium front door with the seam offset.
15. **Opaque obstruction at the sphere's inner exit.**
    - **Cause:** the exterior "threshold vestibule" behind the z = 128 doorway was a lit slate foyer with a warm emissive backdrop, a bronze "rotunda portal" arch and amber sconces. From inside the sphere it read as a closed wall.
    - **Fix:** it now reads as the dark atrium beyond, with unlit deep navy on every surface (no edges or arch) and a faint azure glow where the hologram hangs. It adds no light, so there are no new light-count shader variants at the seam.

Before/after captures: `docs/evidence/passage-integrity-20261121/`.

## Obsidian sphere: movement and readiness

**Wading movement inside the chamber** (`isInsideObsidianChamber`, radius 8.8):
- Walking is 62% of normal walking speed; a sprint in the water stays below a normal walk.
- The change eases over about 0.45 s, in both directions.
- Acceleration, turning, collision and floor support are unchanged.
- Nothing changes outside the chamber, and keyboard and touch share the same path.
- There is no camera sway, blur or strobing.

**Predictive preparation now starts at the pier junction (z ≤ 184)** on the arrival axis, as well as on a ticket. It used to start at z ≤ 158.

**Production build, software WebGL** (`vite preview`, SwiftShader):

| Condition | Measured |
|---|---|
| Ticket → entrance ready, fresh page | 11.9 s normal; 17.5 s at 4× CPU throttle |
| Real-time walk with the render loop running: preparation request → ready | 5.2 s normal; 11.1 s at 4× |
| Real-time walk: doorway reached | 62 s (sprint, normal) and 80 s (sprint, 4×) of wall time |
| Doorway hold | none: preparation finished long before arrival |

Software WebGL also slows game time relative to wall time, so a fast device is the tighter case. At 60 fps, the walk from z 184 takes about 21 s (sprint about 10 s, including the wading pace), against roughly 5–12 s to prepare.

A device or network slower than that would still be held at the doorway. The hold is non-modal, with a one-time spoken/subtitled line; there is no loading screen, button or camera cut. The interior chunk is 608 KB uncompressed. Real-device timing remains unverified.

## Matched performance (production builds of `main` and this branch)

Conditions: `vite preview`, Chromium with SwiftShader, 800 × 450 CSS, DPR 0.5, low tier, render loop stopped, two runs each. These are render submissions, allocations and seam behaviour, not device FPS.

| Metric | `main` | This branch |
|---|---|---|
| Exterior arrival draw calls / triangles | 735 / 119,374 | 733 / 118,968 |
| Sphere interior draw calls | 387 | 385 |
| Atrium draw calls | 441 | 439 |
| North hall / rotunda draw calls | 90 / 169 | 90 / 169 |
| Exterior geometries / textures | 510 / 9 | 508 / 10 |
| Interior geometries / textures | 1,545 / 108 | 1,528 / 109 |
| Shader programs: exterior / interior | 32 / 63 | 33 / 63 |
| **New programs compiled at the seam (1st / 2nd entry)** | **0 / 0** | **0 / 0** |
| Commit time, 1st / 2nd entry | 131–133 / 30–39 ms | 135–157 / 32–33 ms |
| Worst frame in the 30 frames after commit | 15–19 ms | 16–27 ms |
| Static colliders | 2,743 | 851 |
| Merged interior meshes | 424 | 424 |

- **The extra exterior program and texture** come from the hologram-glow material behind the doorway. It's compiled with the exterior at boot, not at the seam.
- **No light-count shader variant was added.** The exterior root still has no lights, and the browser stability test (no shader compiled inside a visible frame while entering and touring) passes.
- **Timing differences are within run-to-run noise** on software WebGL.

## Validation (local, this branch)

| Check | Result |
|---|---|
| `npm run gate` (typecheck, lint, all Vitest, release tools, validators, build, budgets, `verify:dist`) | PASS |
| Full Playwright suite | 84/84 PASS, including the passage traversal, the grand tour, shader stability and the Workshop browser tests |
| Offline standalone (`build:standalone` then `verify:standalone`) | PASS: 14/14 installations, 17/17 visitors, 0 remote requests |
| Exact-head CI | see PR #67 |

## Protected and unchanged

- 73 identities, 35 exhibit slots and six wings.
- Exhibit modules.
- 14 source installations: footprint and state unchanged; seat moved deeper, and in three bays the wall returns.
- 17 authored visitors.
- Dexter Sanctuary.
- E09.
- The single frame loop.
- The seam and its single-active-world architecture.
- Persistence, Workshop and offline behaviour.
- No new dependencies and no network requests.
- No lights added to the exterior root.
