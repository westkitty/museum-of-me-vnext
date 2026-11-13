# Museum Builder — Governed Local Asset Shelf

## Source, rights, and byte identity

The Builder model shelf begins with original procedural models from the connected
[OpenLife / Life_Sim](https://github.com/westkitty/Life_Sim) repository. The
source's `assets/generated/manifest.json` documents asset ID, role, tags,
nominal dimensions, byte size, and SHA-256 hash; its `LICENSE` is MIT
(Copyright (c) 2026 OpenLife contributors). The full MIT license and copyright
notice must remain in redistributed substantial portions.

Twenty-three source GLBs and four PNG finishes were copied into
`public/builder-assets/openlife/` **without modifying their bytes**. Each
binary Git blob SHA matched the original. Corresponding provenance, sizes and
SHA-256 checks are committed to `src/workshop/builderAssets.json`, and
`tests/builder-asset-library.test.ts` independently validates all current
model source hashes on CI. The source commit was pinned as
`2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b` when recorded.

For the complete MIT license see:
https://github.com/westkitty/Life_Sim/blob/2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b/LICENSE

## Import and publication rules

- Builder searches the embedded verified catalog. It does **not** scrape other
  repositories on each visit, hotlink a third-party model, or make the
  production museum download an unreviewed asset.
- Developers can import a self-contained GLB <=8 MB and images converted into
  local WebP <=3 MB only through same-origin loopback Vite endpoints. SHA-256
  addresses the imports in `public/workshop-models/` or `public/workshop-media/`.
- This is **local development authoring**, not a public upload service. Imported
  files remain locally under `public/` until the project owner explicitly
  reviews them for licensing, privacy, suitability, and publication.
- Source manifest references to absent, replaced, remote, unsafe, or tampered
  media fail validation. Standalone builds embed only media actually referenced
  by saved authored placements/finishes and verify the source SHA before release.
- Exterior and interior structural meshes may be selected for reversible
  per-mesh appearance overrides. Their geometry, collision, navigation,
  floors, doors and routes are **not** rewritten by a paint action.
- Instanced individual foliage elements, skinned meshes, architecture demolition,
  new room/floor layout, arbitrary scripts, and full Sims parity are outside
  this bounded implementation and require a dedicated safety-proven structural
  authoring design.

## Verified asset-source decisions

- **Life_Sim / OpenLife:** MIT license and current generated model manifest
  verified; 23 GLBs and 4 PNGs selected and pinned.
- **modern_3d_browser_game_toolkit:** demo GLB manifest inspected, but exact
  redistribution rights not established, so demo assets were not copied.
- **Home_Plan:** useful snap-and-grid interaction patterns; the Builder already
  supports grid sizes, cameras, transforms, undo/redo; no unverified data migration.
- Other project GLBs were not silently copied without provenance review.

## Visitor/runtime ownership

`src/workshop/Workshop.ts` is imported only in local Vite development with
`?edit=1`. Public Pages does not expose the editor, local authoring API, or
model-import endpoint. Saved placements are declarative source data consumed by
the visitor runtime. One existing App frame loop remains authoritative.
