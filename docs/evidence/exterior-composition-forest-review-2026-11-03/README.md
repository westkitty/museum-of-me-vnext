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
