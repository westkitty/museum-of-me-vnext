# Exterior S4 — Lagoon Depth & Visible Surf (2026-11-03)

**Candidate only.** Source parent: `b8a256edb9f91917ea53f7c67c586af7b0bea6d6` (draft S3 PR #33). New child branch `feat/exterior-lagoon-depth-surf-correction-20261103`. PR #32 (S2) demonstrated actual machine-green renders but aesthetically failed on flat lagoon and invisible surf; S3 explores canopy separately.

## Root causes grounded in real code and images
1. Lagoon water Y=-0.64 versus site edge Y=-0.5, leaving only 0.14m exposed bank; bright low-roughness uniform material reads as a cyan sticker in 03-east-lagoon.
2. Ocean baseline Y=-0.94 and four bands with max crest +0.335 => max Y=-0.605, but S2 static surf was at Y=-0.69. Parts could disappear behind water crests; width/opacity too small for top-down.
3. The night island remains under-articulated; S3 canopy is still a separate, unaccepted visual hypothesis.

## S4 correction
- Existing polygon, cutout, mineral bed and sloped wall remain exact. Only water surface is inset 3.4% from lagoon polygon vertices toward centroid at Y=-0.95; this exposes actual existing bank geometry without moving any dry land or collision.
- Water uses one small generated 128x128 sRGB DataTexture with static shoreline-distance gradient and caustic ripples, lower emissive and higher roughness. No network dependency, no extra shader pass, no new frame loop, no new mesh draw versus S2.
- Broken surf remains one offshore-validated Instanced-free indexed mesh; widened discontinuous patches are moved to Y≈-0.56, between maximum crest Y=-0.605 and dry land at -0.5, so the ocean cannot hide them.
- Preserve all entrances, dry/wet masks, six wings, 35 exhibits, Dexter Sanctuary, low-quality/offline, authored water physics, current exact camera arrays and SHA manifest.
- Added deterministic local tests covering waterline position, texture variance/disposal, surf elevation, and unchanged topology.

## Required proof
All four exact-head CI jobs, no WebGL errors, seven actual 1280x720 and 390x844 PNGs with manifest/checksums, matched comparison to S2/S3 especially 03-east-lagoon and 05-high-topdown. See whether the bank is really exposed and water has depth variation (not merely more pixels changed); inspect broken surf for a bright detached ring. Human aesthetic approval and representative device FPS are separate gates; neither is implied by green CI. Do not merge or publish until visual judgment.
