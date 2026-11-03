# S4 lagoon depth — independent bounded hypothesis

**State:** committed to a sibling draft branch from PR #32. Not yet browser verified or aesthetically approved.

## Visible problem
Actual Chromium S2 `03-east-lagoon.png` and `05-high-topdown.png` show a flat broad pale-blue lagoon lacking the graduated shelf/depth visible in the owner's aspirational views. The previous luminosity-only fix was insufficient.

## Scoped correction
- One 128×128, ~64 KiB, locally synthesized `THREE.DataTexture`, based on Euclidean distance to the actual LAGOON_OUTLINE segments and low-amplitude deterministic ripple strokes. Existing ShapeGeometry UVs normalized in place. No image generation, network request, canvas, or animation update.
- Lagoon-only material change with darker center and brighter shallows, preserving fountain water and the original bed geometry.
- Recess the lagoon water surface by 0.30m to expose its upper bank. The existing physical dry/wet classification and collision world remain authoritative and unmodified.
- One dark mineral waterline shelf mesh with exactly the same 12 source edges; no extra collider or per-edge draw.
- Existing S2 coastline, ocean four-wave dispersion, Blood Ring night sky, museum facade and island geometry untouched.

## Validation
Four exact-head CI jobs (canonical gate, Workshop, standalone, browser) and exact seven-camera source PNGs with manifest. Compare `03-east-lagoon`, `05-high-topdown` and `07-mobile-pier-arrival` against S2 source renders; inspect color depth, waterline material, surface artifacts and GPU calls, then separately seek owner visual approval. Never call a green CI result aesthetic acceptance.
