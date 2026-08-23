# Asset Policy

## Governing decision: procedural-first

The build plan's asset hierarchy (§26) is:

1. authentic existing project artifacts
2. museum-safe derivatives of owned artifacts
3. **new original assets**
4. external third-party assets

This project produces category 3 **procedurally, in code**, as its primary asset strategy.
Plan §25.5 explicitly permits this: *"Many can be procedural or adapted from existing project assets
rather than modeled entirely from scratch."*

### Why

| Requirement | How procedural generation satisfies it |
|---|---|
| No hotlinked runtime assets (Law 14) | Nothing is fetched. Geometry is constructed at runtime from code that ships in the bundle. |
| Explicit ownership and licensing (Law 15) | Every asset is original, authored here, unambiguously owned. No third-party licence to verify. |
| Transfer budgets (§24) | A generator is kilobytes of code producing megabytes of geometry. Initial-visit budget is met by a wide margin. |
| Privacy (§29) | No source material is ingested, so no source material can leak. |
| Disposal (Law 15) | Generators allocate through a tracked `ResourceScope`; disposal is verifiable rather than hopeful. |
| Determinism | Seeded generators produce identical geometry every run, which makes visual regressions testable. |

### Approved exception: governed bundled population assets

Phase 3 adds a deliberately narrow exception for the ambient human population:
three local Quaternius CC0 models are bundled as runtime GLBs. They remain
ordinary governed file-backed assets: the manifest records their source and
processed hashes, budget and attribution; `AssetManager` owns loading; and the
application never requests a Quaternius host at runtime. Original sources are
kept in ignored `.asset-sources/`, never in `public/` or build output. The
evidence and conversion record is [QUATERNIUS_ASSET_PROVENANCE.md](QUATERNIUS_ASSET_PROVENANCE.md).

### Approved exception: deferred first-party Full Weasel artifact

E27 presents the real completed `westkitty/The_Full_Weasel` application through
a local same-origin iframe created only after the visitor explicitly engages its
projection. The committed production artifact is governed as
`full-weasel-complete`, belongs to `exhibit:E27`, has pinned provenance and a
tree hash in [FULL_WEASEL_PROVENANCE.md](FULL_WEASEL_PROVENANCE.md), and makes
no runtime request to GitHub Pages, Google Fonts, or any other remote host.

The complete artifact is intentionally large because it preserves the
first-party game's authored sprites, video backgrounds, and music. It is not
part of the initial Museum transfer: the iframe does not exist before E27 is
opened. `check:budgets` reports its bytes separately and verifies the initial
Museum budget independently; the standalone artifact still contains the local
files for offline use. The embedded build disables the original root-scoped
service-worker registration, uses relative paths, and forwards Escape only as
a parent close signal. It does not add another Museum frame-loop owner.

### What this does **not** mean

- It does not mean boxes. A procedural asset must still meet the exhibit contract's *physical presence*
  bar: real volume, real silhouette, deliberate material.
- It does not mean placeholders. Graybox primitives are permitted **only** in Phase 2, and Phase 9
  fails the build if any survive into visitor-facing space.
- GLB loading is fully implemented in the AssetManager. Where an authentic project artifact would be
  better than a generator, the pipeline is ready to carry it.

## Asset governance

Every asset — procedural or file-backed — has a record in `src/assets/manifest.ts`:

```
id                stable, kebab-case, unique
title             human name
kind              'procedural' | 'glb' | 'texture' | 'audio' | 'bundle'
source            'original-museum' | 'derived:<projectId>' | 'authentic:<projectId>' | 'external'
project           originating project ID, or null for museum architecture
creator           attribution
license           ownership statement
generatorHash     for procedural: hash of the generator source (integrity)
sourceHash        for file-backed: hash of the untouched original
processedHash     for file-backed: hash of the shipped runtime file
runtimeFormat     'procedural' | 'glb' | 'ktx2' | 'png' | 'ogg'
budgetKB          transfer budget
streamingGroup    which streaming layer/group owns it
attribution       required visitor-facing credit, or null
```

`npm run validate:assets` fails on: missing record, duplicate ID, missing licence, budget overrun,
external asset without provenance, or an asset referenced by an exhibit but absent from the manifest.

## Prohibited

- Downloading a model without a provenance record.
- Any runtime request to a host this project does not control.
- A texture named `final-final2.png`.
- Shipping originals into the public deployment tree. Untouched originals stay outside `public/`.
