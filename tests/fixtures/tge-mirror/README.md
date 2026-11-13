# Pinned TGE source mirror for tests

The Workshop browser tests point the dev server at this directory through
`MUSEUM_TGE_SOURCE_MIRROR` (set in `playwright.workshop.config.ts`). Source-catalog imports and
thumbnails are then read from here and never from the network. Files missing from the mirror
answer 404.

The layout copies the pinned source URL: `<sourceRevision>/<path>` from `Hidencod/tge-assets`.
Every file must be the exact pinned bytes, because the importer still checks size, git blob and
GLB/WebP validity.

All files are CC0-1.0 models by Kenney, from the Blocky Characters and Blaster Kit packs. They are exactly the files the Workshop browser tests click or import:

| File under `3ddcc695…/packs/` | Pinned git blob | Bytes | Used by |
|---|---|---|---|
| `blocky-characters/character-b.glb` | `f118dfc9aaece66aea3e8e5e4e82de83cdb833a4` | 127160 | catalog test import |
| `blocky-characters/thumbs/character-b.webp` | `7970bcde80d29c791b665131f194762b81044d34` | 2554 | catalog test tile |
| `blocky-characters/thumbs/character-a.webp` | `b70ca2579887fab72cabc399f7a0c9c718606201` | 3400 | catalog test tile (withheld from verification) |
| `blaster-kit/blaster-a.glb` | `826731460c39648b81ebcdd58532f6f30e21c4b6` | 55204 | import and main Workshop tests |
| `blaster-kit/thumbs/blaster-a.webp` | `2c388bf7335ead25f0b678fe62ac786766cf94fa` | 2528 | import and main Workshop tests |

Every other thumbnail answers 404, and the Workshop shows "Thumbnail unavailable" for it, as it already does offline.

`tests/tge-source-mirror.test.ts` re-checks these hashes against `tge-index.json`.
