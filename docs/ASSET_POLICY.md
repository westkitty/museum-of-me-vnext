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
kind              'procedural' | 'glb' | 'texture' | 'audio'
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
