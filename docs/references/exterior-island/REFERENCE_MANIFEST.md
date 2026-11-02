# Exterior Island Reference Manifest & Visual Contract

> **Document Status:** CANONICAL REFERENCE CONTRACT — PHASE P0 LOCK
> **Repository:** `westkitty/museum-of-me-vnext`
> **Master Implementation Handoff:** `Museum_of_Me_Exterior_First_Impossible_Threshold_MASTER_IMPLEMENTATION_HANDOFF.md`
> **Target Branch:** `feature/exterior-first-impossible-threshold-20261102`
> **Base SHA:** `6950ab9401d2d957c801afba6f86c11ce5b29267`

---

## 1. Reference Asset Inventory

The exterior architecture and island landscape design are governed by the six original 1536 × 1536 user-provided reference images. These images represent the aesthetic authority for the nighttime exterior environment, building silhouette, color palette, and site features.

| Reference Filename | SHA-256 Checksum | Dimensions | Image Type | Role in Contract | Availability Status |
|---|---|---|---|---|---|
| `1000230575.png` | `c6df6aa9c02c15dffafb8a491e8c0621b4c7898d57bbd0407eb0ada4c588042d` | 1536 × 1536 | Standalone | Oblique exterior view with lagoon beyond building and gold spire in foreground-left | Hash recorded; byte upload pending |
| `1000230574.png` | `3e4e4fc522d3369b999a190c1390cd3ece5e6f3a8d7d9880c250d7ed4f63f01a` | 1536 × 1536 | Standalone | Opposing oblique view with lagoon near camera and spire at opposite far edge | Hash recorded; byte upload pending |
| `1000230573.png` | `5f0f4e5e1a8100d0560cc78af8b412f334ac5c84ede83def79487f121186025d` | 1536 × 1536 | Standalone | Longitudinal view showing facade massing, twin roofs, central skylight, and pier in distance | Hash recorded; byte upload pending |
| `1000230572.png` | `b738528889bc92ba754864e66bf594470d9887b9c8a6a0e172d81e933bfaa6df` | 1536 × 1536 | Standalone | High aerial view: **Provisional Master Site Orientation** | Hash recorded; byte upload pending |
| `1000230571.png` | `ad1b3c2d2c4c6ed66fdf3ca55bd5f33dd5af419d885c5af0152fd788c0642087` | 1536 × 1536 | 2×2 Composite | Alternate island views with spatial/mirror differences | Hash recorded; byte upload pending |
| `1000230568.png` | `462ba9d43c19817689020f2a145eab6913956989c0e801dc99892697ee370215` | 1536 × 1536 | 2×2 Composite | Atmosphere, color, and alternative mirrored landscape angles | Hash recorded; byte upload pending |

*Note on byte availability:* As specified in §4.2 and §13 of the master handoff, the original PNG bytes were generated/uploaded in the preceding ChatGPT design session. In P0, their authoritative hashes, dimensions, and visual properties are strictly locked. When actual PNG bytes are placed in `docs/references/exterior-island/`, their SHA-256 checksums must match the table above.

---

## 2. Provisional Master Site Orientation

The six reference images contain mirrored relative arrangements and perspective variations. To guarantee a single, coherent, non-contradictory 3D world topology, **`1000230572.png` (high aerial view)** is designated as the **provisional master site layout**:

```
                       NORTH (-Z)
                           ▲
                           │
       [NW: Circular Spire │
        Garden Grove]      │       [Northeast Forest]
                           │
  WEST (-X) ───────────────┼───────────────► EAST (+X)
  [Dense Woodland          │               [Calm Turquoise
   & Perimeter Path]       │                Inland Lagoon]
                           │
                   [MUSEUM SHELL]
                    (Center 0,0)
                           │
                   [Formal Stairs]
                   [South Terrace]
                           │
                   [Approach Pier]
                           │
                           ▼
                       SOUTH (+Z)
```

- **Axial Approach & Pier:** Extends south (+Z) into the deep navy ocean, aligned with the formal museum entrance stairs.
- **Museum Shell:** Positioned at the central site anchor `(0, Y, 0)`.
- **Inland Lagoon:** Positioned to the east (+X), enclosed by natural banks and a surrounding pedestrian footpath.
- **Golden Spire Grove:** Positioned to the northwest (-X, -Z) as a distinct landscaped circular clearing with concentric plantings.
- **Perimeter Woodland:** Sweeps across the west, north, and perimeter borders, leaving clear sightlines and walkable sand/gold paths.
- **Shoreline Edge:** Irregular organic boundary with stone/sand seam and restrained cyan-lit foam highlights.

---

## 3. Canonical QA Camera Views

Five deterministic camera viewpoints are locked for reproducible QA inspection, automated Playwright captures, and visual comparison across all implementation phases:

| Camera ID | Position `[X, Y, Z]` | Target `[X, Y, Z]` | FOV | Viewport | Target Features |
|---|---|---|---|---|---|
| `front-south` | `[0, 18, 140]` | `[0, 8, 0]` | 55° | 1280 × 720 | Formal arrival, pier, entrance stairs, front facade, rounded entrance glazing, twin curved roofs, central dome finial |
| `east-lagoon` | `[140, 35, 30]` | `[0, 10, 0]` | 55° | 1280 × 720 | Eastern lagoon, lagoon bank paths, east facade window strips, curved roof barrels in profile, dome side silhouette |
| `west-woodland` | `[-140, 30, -20]` | `[0, 10, 0]` | 55° | 1280 × 720 | West forest belt, perimeter paths, northwest golden spire monument clearing, west building flank |
| `high-topdown` | `[0, 220, 0.1]` | `[0, 0, 0]` | 50° | 1280 × 720 | Complete site topology: island polygon closure, lagoon vs ocean boundaries, building footprint symmetry, spire location |
| `rear-north` | `[0, 25, -140]` | `[0, 10, 0]` | 55° | 1280 × 720 | North rear building elevation, spine termination, roof barrel continuity, back forest density |

All cameras use the project's standard tone mapping (`ACESFilmicToneMapping`), exposure `1.0`, canonical night lighting, and default canvas DPR/quality.

---

## 4. Visual Feature Traceability Matrix

Every architectural and landscape element from the reference contract is tracked to its target module, reference view, observation camera, and verification state:

| Feature ID | Visual Feature Description | Source View(s) | Target Implementation Module | Primary QA Camera | Human Approval State |
|---|---|---|---|---|---|
| `VF-01` | Twin elongated parallel curved roof shells (dark blue-black, segmented panels) | `1000230572`, `1000230573`, `1000230575` | `ExteriorMuseumShell.ts` | `front-south`, `east-lagoon` | `HUMAN_PENDING` |
| `VF-02` | Luminous turquoise/gold central dome with radial convergent ribs and finial | `1000230572`, `1000230573`, `1000230574` | `ExteriorMuseumShell.ts` | `front-south`, `high-topdown` | `HUMAN_PENDING` |
| `VF-03` | Low horizontal structural spine connecting roof wings | `1000230573`, `1000230575` | `ExteriorMuseumShell.ts` | `front-south`, `rear-north` | `HUMAN_PENDING` |
| `VF-04` | Warm amber horizontal window strips along building sides | `1000230573`, `1000230574` | `ExteriorMuseumShell.ts` | `east-lagoon`, `west-woodland` | `HUMAN_PENDING` |
| `VF-05` | Rounded cyan-glazed entrance projection and vestibule | `1000230573`, `1000230575` | `ExteriorMuseumShell.ts` | `front-south` | `HUMAN_PENDING` |
| `VF-06` | Symmetrical raised stone entrance terrace with broad formal stairs | `1000230572`, `1000230573` | `ExteriorMuseumShell.ts` | `front-south` | `HUMAN_PENDING` |
| `VF-07` | Axial south arrival pier/causeway extending into deep ocean | `1000230572`, `1000230573` | `IslandLandscape.ts` | `front-south`, `high-topdown` | `HUMAN_PENDING` |
| `VF-08` | Calm turquoise-blue inland lagoon with defined walkable shore | `1000230572`, `1000230574`, `1000230575` | `IslandLandscape.ts` | `east-lagoon`, `high-topdown` | `HUMAN_PENDING` |
| `VF-09` | Circular northwest landscaped clearing with slender gold spire | `1000230572`, `1000230574`, `1000230575` | `IslandLandscape.ts` | `west-woodland`, `high-topdown` | `HUMAN_PENDING` |
| `VF-10` | Winding pale gold/sand footpaths looping the island and landmarks | `1000230572`, `1000230574` | `IslandLandscape.ts` | `high-topdown`, walking view | `HUMAN_PENDING` |
| `VF-11` | Dense rounded woodland/canopy across island perimeter | `1000230571`, `1000230572`, `1000230568` | `IslandLandscape.ts` | `west-woodland`, `high-topdown` | `HUMAN_PENDING` |
| `VF-12` | Restrained cyan-lit shoreline foam edge on deep navy ocean | `1000230571`, `1000230572`, `1000230568` | `IslandLandscape.ts` | `front-south`, `high-topdown` | `HUMAN_PENDING` |

---

## 5. Non-Euclidean Topological Independence Invariant

The interior of the Museum of Me (comprising six wings, two levels, Rotunda, and subterranean Dexter Sanctuary with all 35 exhibit mounts) is topologically and geometrically independent of the compact exterior shell.

- The exterior shell does **not** contain or fit the interior geometry.
- The entrance transition conceals the non-Euclidean spatial expansion behind an architectural vestibule sightline break.
- No interior museum dimensions, bay placements, corridor lengths, or wing orientations may be compressed or modified to force fit inside the exterior building.
