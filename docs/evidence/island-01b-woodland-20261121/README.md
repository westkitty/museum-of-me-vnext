# ISLAND-01b — woodland character and perimeter-tree collision fix (2026-11-21)

Base: `main` `7bd839a` (ISLAND-01, PR #71). Before: `../island-01-woodland-20261121/`.
Responds to the ISLAND-01 design critique (fix-list items 1, 2, 3, 9, 13) and to a
collision defect found during ISLAND-01.

## What changed (IMPLEMENTED)

- **Collision fix.** Perimeter trees were planted 68 / 112 / 176 by tier, but
  colliders are registered once, for the tier the exterior was built with. After a
  later quality switch some visible trees had no collider (or invisible trees
  still collided). Every tier now plants the same 176 collision-backed perimeter
  trees; low tier uses 20-triangle crowns, and per-tree understory and infill
  densities were rebalanced on low and medium so the cost rise stays small.
- **Stands, not a tree farm.** Forest-belt trunks are pulled 40 % toward jittered
  clump centres on a 22 m grid (still one quality-independent set, 890 trunks),
  and may stand 7 m from a path centreline (was 10.5 m). Crowns vary in value
  per clump, so near and far canopy separate.
- **Warm bark.** Perimeter and belt trunks use warm dark browns per instance on
  more tapered cylinders (was one flat near-black).
- **Low tier** adds an overhead crown to about 40 % of belt trunks, so it no
  longer reads as an orchard.
- **Tighter landmark clearings:** meadow 15→14 m, fern ravine 13.5→12.5 m, stone
  circle 13→11 m, Wings of Dawn 12→10 m. Landmark positions are unchanged.
- **Wings of Dawn:** the rear-garden "Museum doors" fingerpost moved off the
  sculpture axis (x −3.6 → −9.5); the verdigris wings gained bronze leading
  edges with a thin amber line.

## Cost (landscape group, unit probe)

| Tier | Triangles before → after | Landscape colliders before → after |
|---|---|---|
| low | 60,184 → 70,288 | 933 → 1,086 |
| medium | 96,976 → 111,988 | 977 → 1,086 |
| high | 274,472 → 284,612 | 1,041 → 1,086 |

Draw calls unchanged (instanced). Belt crowns 1,239 / 1,532 / 2,181.

## Verification (VERIFIED BY AUTOMATED TEST; Chromium/SwiftShader)

- New unit test: perimeter trunk positions and collider counts identical on every
  tier, with a solid collider under every visible trunk.
- `npm run gate` PASS. Browser: `island-landmark-walk` (keyboard all 15 landmarks
  on low and high with reduced motion; touch), `island-landscape`,
  `quality-transitions`, `art-direction`, `asset-ownership`, `continuity-uplift`,
  `exterior-signature-evidence`, `performance-lifecycle`, `predictive-interior`.
- Captures: `tests/browser/island-landmark-views.capture.ts`, 51 views; a medium
  and low subset is committed here, `capture-manifest.json` lists all with hashes.

## Not verified / still open

Human visual acceptance; real-device performance; hosted Pages (not a release
milestone). Fix-list items 4–8, 10–12 and 14 remain open.
