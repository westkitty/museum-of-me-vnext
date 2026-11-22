# World expansion S0 baseline — 2026-11-21

Read-only reconnaissance recorded before the first island-first world-expansion
slice (ISLAND-01). Contract: `docs/plans/WORLD_EXPANSION_GROKBOT_MASTER_20261121.md` §4 / §14 S0.
Evidence state: **MEASURED** (automated, Chromium + SwiftShader). Not hardware
performance evidence and not human acceptance.

## Identity

| Item | Value |
|---|---|
| Repository | `westkitty/museum-of-me-vnext` (public) |
| `main` at S0 | `78b5996d0ea545a23f2621b924b502c79ba46f56` (PR #70, plan docs) |
| `pages-preview` at S0 | `de5daf3655ea35a077dcc2543d9313ce4b91c684` (PR #69); hosted museum unchanged by #70 |
| Branch protection on `main` | required checks `gate`, `browser`, `workshop`, `standalone`; strict; linear history; squash merge only |
| Open PRs | #57 (draft, experimental, not accepted) |
| Canonical Bible | `westkitty/ChatGPT_Bible_Repo` `9aa06f2e6b5085d9bfca8333e88817552c5611e2`, `bibles/Museum_of_Me_Bible.md` blob `00dc1d5d4c52040f76606b4dcb233146bf6f6608` (1,137,251 bytes); read by targeted search only |
| Unit baseline | `npm test` 1,283 Vitest tests (r107 record); CI at `de5daf3`: browser shards 33 + 30 + 31, workshop 16 |

## Woodland defect measured (ISLAND-01 input)

`sightlines-low.json` / `sightlines-high.json` come from a deterministic analysis
of `IslandLandscape` instance matrices (crown bounding spheres at 85 % radius):

- Every forest-belt crown (888 low / 2093 high) was **trunkless** and its
  underside sat **below 2.2 m** above ground (most below the ground itself):
  opaque, eye-level leaf masses with no trunk and no collider.
- Eye-height sightlines from the nearest island-loop point crossed belt crowns
  for the pollinator meadow (2), hare statue (1), neolithic stone circle (4) and
  Wings of Dawn (1).
- Landscape collision: 88 colliders (low) / 196 (high); whole exterior 901.

## Named viewpoints

`tests/browser/island-landmark-views.capture.ts` rendered 16 views × 3 tiers plus
3 mobile-portrait views (51 PNGs, 0 page errors). This folder keeps the medium-tier
subset; `capture-manifest.json` lists every capture with SHA-256, draw calls and
triangles. Examples: `medium-ap-neolithic-circle.png` (stones hidden behind
ground-level crowns), `medium-ap-pollinator-meadow.png`.

Render cost at S0 (renderer.info, per frame): medium pier overview 822 calls /
171,646 triangles; high pier overview 822 / 359,248; high west woodland 573 / 353,276.

## Asset leads checked read-only (for later slices)

- DEX//SCULPT `src/data/humanoidCatalog.json` (public metadata snapshot, 786 records)
  holds `polygonalmind-100-avatars-r1/character/87_hotdog`: CC0-1.0, 65 joints,
  5,324 triangles, **0 animations**, processed GLB SHA-256 `43a97ad1…f9eee9`,
  `VISUAL_APPROVAL_PENDING`. The catalog states private locators are omitted, so
  the processed GLB bytes are **not** available from that repository. The public
  original is Polygonal Mind's release `230412.1`, asset
  `2003_100AvatarsR1AssetPack.zip` (145,482,533 bytes, CC0 per the catalog's
  source record). Not downloaded or verified yet (ISLAND-04).

## Not yet surveyed (owned by later slices, before any change there)

Roof/cinema section (ISLAND-03), visitor and ambient NPC enumeration (ISLAND-04),
passport/journal state and world-host design (ISLAND-05), World Audition Lab
portal archive (W07). No source in those areas was changed by ISLAND-01.
