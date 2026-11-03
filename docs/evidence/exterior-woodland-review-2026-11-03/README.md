# S1 / S2 seven-view visual review — and S3 woodland hypothesis

**Baseline:** PR #30 `3876b0c`, actual Chromium render set, seven independent frames.

**S1:** PR #31 `735c0f3` — all 4 jobs passed. Actual seven PNGs independently checked against SHA-256 manifest; 01-pier view opens central sightline, but the museum remains behind multiple smaller arch layers. 04-west grove has taller, more uneven tree silhouettes, yet reads as isolated trees rather than a forest. 05-topdown still has a sparse park-like perimeter.

**S2:** PR #32 `2299b62` — all 4 jobs passed. Actual seven PNGs independently checked against SHA-256 manifest. 03-east-lagoon is visually brighter and the edge is more distinguishable; the lagoon still resembles a broad flat surface with insufficient apparent basin depth. 05-topdown shows slightly stronger sea/land separation and broken coastal marks but far short of the lush and luminous aspirational images. 04-west visual density is essentially unchanged. All S2 screenshots have human acceptance = UNKNOWN; *machine verified capture* does not imply aesthetic approval.

**S3 goal:** Add one instance-batched canopy-only infill layer, quality-tier bounded, to create the continuous woodland visible in owner references. Keep existing trunks and every physical route, hitbox, site boundary and quality-tier invariants. Do not silently increase physical collisions. No image-generation substitutes.

**Acceptance:** identical seven cameras, hash manifest, strict CI four-job pass, no displaced trees or paths, inspect west and overhead as individual full-resolution images and judge actual visual improvement versus S2; then verify representative device. This report is evidence tied to actual pixels, not a user aesthetic sign-off. Do not merge/publicize without approval.
