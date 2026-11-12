# Museum Builder — Complete OpenLife Asset Shelf

**Intake type:** existing user-project source, locally vendored assets.  
**Source repository:** [westkitty/Life_Sim](https://github.com/westkitty/Life_Sim) (OpenLife).  
**Pinned source revision:** `2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b`.  
**Source inventory:** `assets/generated/manifest.json`.  
**License:** MIT, copyright (c) 2026 OpenLife contributors. The full unmodified notice is vendored in `public/builder-assets/openlife/LICENSE.txt`. No remote asset hotlinking.

## Result

| Asset type | Previously cataloged | Newly copied | Final catalog | Total source bytes |
| --- | ---: | ---: | ---: | ---: |
| Self-contained GLB models | 23 | 96 | **119** | 1,065,580 |
| Local PNG material finishes | 4 | 9 | **13** | 4,117,128 |

The imported library includes furniture, fixtures, appliances, outdoor props, buildings, pets, low-poly characters, nature, vehicles and interactive-game props. Items are **available for authoring**; none are automatically placed in the existing museum.

## Integrity and provenance

- Every new binary was fetched at the pinned source revision and installed at its literal `public/builder-assets/openlife/...` path; source and destination Git blob SHA values were compared.
- `src/workshop/builderAssets.json` records stable ID, source path, pinned source revision, source-author label/category/tags where available, byte size and SHA-256 for all 119 models and 13 finishes.
- `tests/builder-asset-library.test.ts` reads **every** runtime file and verifies exact byte size, SHA-256 and GLB/PNG container signature. It enforces ID uniqueness, known local path rules, search/category discovery and rejection of remote URLs.
- The real Chromium Workshop test searches the 119-entry shelf, selects the Characters category, summons a telescope and an independently copied vehicle GLB, confirms actual parsed Three.js groups, then exercises texture and architectural-wall painting.
- CI and runtime asset-loading evidence are separate: source presence and catalog consistency do not prove MacBook GPU performance, every asset's artistic suitability or end-user visual acceptance.

## Integration and boundaries

- **On-demand loading:** the Vite-only local Builder exposes a searchable/category-filtered asset shelf. Models are fetched with the existing GLTF loader only when summoned. The public visitor scene does **not** preload 119 models.
- **Single engine:** no second rendering loop, no migration to Godot, no React framework, and no new dependency.
- **Authoring:** existing object transforms, scale, rotation, paint/texture, collision toggles, bounded interaction, local import, undo/redo and validated placement saves continue to apply.
- **Safety:** protected original structural geometry, navigation and exhibits remain authoritative. Public Pages serves the visitor experience; local Vite `?edit=1` alone has the private write bridge. Imported user-owned photos/models are not automatically committed or publicly released.
- **Budget:** the source asset family is 5.18 MB on disk and is not added to the startup JavaScript bundle. The release gate must verify all actual production budgets and offline packaging; no budget exception is presumed.

## Provenance status

**SOURCE BYTES COPIED / CATALOGED / TESTS IMPLEMENTED.** CI, browser, release and hosted SHA are pending at the initial authoring of this record. Do not mark the expanded shelf VERIFIED before those exact-head checks pass.
