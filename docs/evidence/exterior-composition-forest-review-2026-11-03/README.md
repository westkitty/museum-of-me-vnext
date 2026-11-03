# Exterior composition + western woodland correction — 2026-11-03

**Status: implemented in a child feature branch; visual comparison and user acceptance are required.**

- Parent baseline: PR #30 `3876b0ce43c599d9dc12c2239a530a1e48f65b8b`
- Independently verified before-state: `Museum_of_Me_Exterior_Renders_2026-11-03_3876b0c.zip`, manifest revision `11a3a274c1c1116c8a46b54c9e4e7a0fd81b20a6`
- Branch: `feat/exterior-composition-forest-review-20261103`
- Exactly the same seven camera positions, viewport dimensions and PNG filenames as the existing screenshot test; do not silently move or crop cameras.
- Each CI image is a separate actual Three.js Chromium render, uploaded as an Actions artifact. No new screenshot belongs in production asset folders.
- Priority A: open the museum entry axis by replacing the dark 76-metre overhead beam with unobtrusive side caps and reduced shaft intensity.
- Priority B: make the west woodland higher, layered and uneven while retaining tree count, X/Z centers, dry-land clearances and existing colliders.
- Not in scope: lagoon depth, island relief, facade redesign, sky/Blood Ring, new effects, exhibit layout or collision changes.

## Comparison checklist
Review **before and after** at the full original pixel resolution, especially:
1. `01-pier-arrival.png`: museum/dome visible as focal point; unobstructed entry alignment.
2. `04-west-woodland.png`: strong height variety and convincing roof-to-canopy proportions.
3. `07-mobile-pier-arrival.png`: entry remains readable at narrow width.
4. `02-front-south.png`, `03-east-lagoon.png`, `05-high-topdown.png`, `06-rear-north.png`: no unintended silhouette or sightline regressions.

Cross-check each new PNG's dimensions, byte count and SHA-256 against the generated manifest. A passing test suite only verifies software/runtime properties; aesthetic success and device performance remain unverified until separately inspected.


## Owner-supplied aspirational visual references (received 2026-11-03)

**Authority:** current owner-provided image references establish an **ACCEPTED ART-DIRECTION TARGET**, not evidence of current Three.js visuals or authorization to reconfigure museum floor plan. The references include several single aerial viewpoints plus contact-sheet-style concept comparisons. They are illustrative, with apparent rotation / horizontal swaps between viewpoints. They have not been deposited as original binary assets in this PR and must not be mistaken for captured runtime or existing Drive archive files.

### Visual target distilled from the supplied images

| Area | Aspirational visual signature | 2026-11-03 real Chromium before-state | Source owner and bounded direction |
|---|---|---|---|
| Silhouette & arrival | Building and centered glowing turquoise dome remain the hero, formal pier/terrace approach is understandable | Giant black overhead arrival frame interrupts line of sight in `01-pier-arrival.png` and the narrow portrait | `ArrivalBeacons.ts`, `ExteriorIdentity.ts`; remove competing visual mass without changing portal, trigger, spawn or collision |
| Roof & elevations | Two substantial ribbed curved roofs, legible front/rear modules, restrained blue stone, warm inhabited window rhythm | Recognizable long roofs, but broad opaque walls and weak material separation | `ExteriorMuseumShell.ts`; strengthen facade depth and surface articulation without moving colliders or altering geometry authority |
| Forest | Dark, densely interlocking multilayer canopies with an irregular treeline that encloses the island and gives architectural scale | Isolated small geometric round trees with open flat gaps (especially `04-west-woodland.png`) | `IslandLandscape.ts`; retain deterministic instance tiers and all X/Z/dry-land/path exclusion guards; focus on silhouette and clusters over crude object-count increases |
| Island edge & terrain | Readable island thickness, subtle rocks/beach edge and broken moonlit cyan surf, not a perfectly flat sheet | Overhead island surface merges into dark ocean; shoreline/landform has little contrast | `ArrivalGarden.ts` and `IslandSiteLayout.ts`; site-aligned coastline and visually grounded low-poly depth, not a floating neon circle; collision polygon remains source of truth |
| Lagoon | Large sheltered asymmetrical eastern pool with luminous blue water, interior bank separation, specular/ripple variation and obvious basin depth | Geometric cut-out exists but reads like a flat dark sticker in `03-east-lagoon.png` and `05-high-topdown.png` | `ArrivalGarden.ts`; preserve `LAGOON_OUTLINE`, holes, water exclusions, bank geometry and player physics; make existing geometry perceivable |
| Paths, clearings & spire | Winding ivory stone paths with warm, spaced low lamps; northwest spire on a distinct circular court | Paths are flat pale lines; spire court present but visually understated | `IslandLandscape.ts`; protect `PATH_CENTERLINES`, `SCENIC_GROVE_POINTS`, clearance and static light budgets |
| Night & water atmosphere | Luminous deep-blue night, moonlit ocean, dark green canopy, cyan highlights and sparse warm points | Night render too low-contrast to read landscape from overhead or side; in images the museum is often a black mass | `Sky.ts`, exterior lighting and water shaders; diagnose exposure / shader response before adding bloom or time-based effects. **Do not erase the canonical vitrified Drakken Blood Ring** |
| Camera intent | The whole island is a coherent designed landscape from elevated views **and** the pier works at human eye level | Existing seven screenshots reveal both composition and first-person problems | Preserve the seven canonical source cameras, viewport sizes, scene and renderer; compare real Chromium PNGs, not generated concept art |

### Geography lock

Use **actual `IslandSiteLayout.ts` coordinates** as the spatial authority: south pier on the +Z approach, east lagoon on +X, northwest spire court at [-104, -82] in site X/Z. Do **not** flip the east and west features to reproduce a rotated or mirrored reference rendering. The dome remains centered and the established six wings, 35 exhibit slots, Dexter Sanctuary and two-world lazy lifecycle remain intact.

### Ordered transformation programme (PROPOSED, not already implemented)

1. **S1 — entrance and western forest silhouette:** the narrow patch in draft PR #31. Await CI, seven exact-camera renders and owner visual judgment. This does **not** close the complete art-direction gap.
2. **S2 — night readability and coastline:** fix silhouette legibility and water-versus-ground contrast, develop site-aligned moonlit surf and accessible illumination with bounded shader and draw budgets.
3. **S3 — lagoon legibility and terrain relief:** perceptible depth, separated walls/banks, and shaded water surface; fake terrain relief must stay visual unless collision is separately authored and proven safe.
4. **S4 — forest density and formal garden/path refinement:** contiguous layered canopy, variable heights and richer foreground/understory while protecting route clearance and quality tiers.
5. **S5 — facade and roof visual authorship:** materials, structural rhythm, illuminated window pockets, roof/dome/glazing refinements. Re-check blocked sightlines and readability.
6. **S6 — seven-view matched before/after acceptance:** equal cameras, output size, PNG hash manifest, source commit identity, runtime errors, triangle/draw budgets, regression checks, and a separate human aesthetic verdict.

### Non-substitution and proof requirements

These supplied illustrations are **aspirational examples**, not source assets and not proof that any feature is already implemented. A single static/isometric beauty render cannot replace visitor-level navigation, physical geometry, water exclusions, lighting semantics or real WebGL rendering. Automation success only proves bounded technical checks; aesthetic fidelity requires direct comparison and visitor/device acceptance. Rejected visual hypotheses must be reversible without disturbing the previous verified baseline.
