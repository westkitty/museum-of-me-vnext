# S4 lagoon bathymetry perception / stone waterline (visual candidate)

Parent: draft PR #33 `b8a256edb9f91917ea53f7c67c586af7b0bea6d6` (S3 canopy; CI and visual verdict must be evaluated independently). This proposed change addresses the S2 screenshot showing an over-bright, essentially flat lagoon. It does not claim to solve shoreline surf or forest density.

The lagoon now visibly recesses below the island edge, retaining the exact polygon and the same mineral bed. The original water mesh scales inward around its own centroid so the waterline approximately follows the already-authored sloped stone bank. The secondary strip is dark stone rather than neon surf. No new mesh collision, loop, texture, service, or ocean-wave changes.

**Acceptance:** four exact-head jobs, all seven real source-camera PNGs plus manifest, explicit S2-versus-S4 03-east-lagoon and 05-high-topdown pixel inspection, and no regressions to the pier/forest/entrance. The new water surface must not clip the actual angled wall or obscure bed depth. Device performance and human visual approval remain unverified until demonstrated. If the change makes the lagoon less convincing, revert this feature alone.
