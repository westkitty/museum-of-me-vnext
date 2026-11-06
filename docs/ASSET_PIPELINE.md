# Asset Pipeline

## Governed loading and direct builders

`AssetManager.load(id, scope)` handles registered procedural generators and locally bundled GLB
models. It requires a manifest record, records load timing and byte budgets, and ties each consumer
to a caller-supplied `ResourceScope`. It is not a universal geometry-creation path: world/landscape,
exhibit and Workshop builders also construct scoped procedural geometry directly; curated raster
artwork has its own governed local asset records, and `AudioManager` synthesizes sound.

For GLBs, concurrent consumers share one load and a manager-owned prototype scope, while each gets
an independent scene graph and skeletons through `SkeletonUtils.clone`. Geometry, materials,
textures and immutable animation clips are shared under scoped leases, released when the last
consumer leaves. Caller scopes own the lease and clone-specific skeleton resources; do not call
`trackObject()` on a returned file object into another scope. Ambient population clones retain their
prototype lease and dispose their own skeletons when removed.

```ts
const scope = new ResourceScope('E19');
const { object } = await assets.load('dextilt.phone', scope, { detail: quality.detailScale });
group.add(object);
// …later
object.removeFromParent();
scope.dispose();          // asserts it drained to zero
```

## Asset kinds

| Kind | How it arrives | Budget | Provenance |
|---|---|---|---|
| `procedural` | a registered generator function, run at load time | 0 KB transferred | authored here, unambiguously owned |
| `glb` | GLTFLoader, with KTX2 + Meshopt + Draco wired | declared per asset | source hash + processed hash |
| local raster artwork | dedicated curated artwork builders | declared/validated local files | curated records + processed hashes |
| optional compressed formats | KTX2/Meshopt/Draco loader support wired, not activated by current models | per manifest when activated | source hash + processed hash |
| `audio` | synthesised at runtime by `AudioManager`, muted by default | 0 KB | authored here |

Procedural is the default (see `ASSET_POLICY.md`). The active file-backed path loads locally bundled Quaternius GLBs with verified animation clips.
The manifest's additional kind names do not establish a generic texture/audio loading API.

## Registering an asset

```ts
// 1. declare it — this is the provenance record
registerProcedural('starsilk.loom', 'Celestial loom', 'exhibit:E01', 'P001');

// 2. register how it is built
assets.registerGenerator('starsilk.loom', (scope, detail) => { … });
```

`registerGenerator` throws for an id with no manifest record, so an
unregistered procedural generator cannot be loaded through that API. Direct builders remain
subject to the asset, privacy, provenance and resource-scope checks.

## Determinism

Procedural generators must not call `Math.random`. Use `rng(seed)` from
`generators.ts`, which is a seeded xorshift. Two runs of the museum produce
byte-identical geometry, which is what makes visual regressions meaningful and
lets a specific arrangement be described by its seed rather than stored.

## Cancellation

`load()` accepts an `AbortSignal`. A cancelled load never returns a partially
built object. A pending lease is removed on cancellation without allocating a consumer scene or
skeleton. A cancelled consumer does not cancel another consumer's request; late results are released
when no consumers remain. Scope or manager teardown also cancels pending consumers. This lets the
StreamingManager change its mind when a visitor turns around mid-approach.

## Budgets

Declared per asset in KB, and per exhibit in MB by tier (A ≤ 15, B ≤ 8, C ≤ 4).
Overruns are recorded in `AssetManager.budgetViolations` and warned at runtime;
`npm run check:budgets` fails the build on a declared overrun.

## Blender export conventions

For any asset that is modelled rather than generated:

- metres, Y-up, `+Z` forward, apply all transforms before export
- one material per mesh; no procedural Blender textures — bake them
- glTF 2.0 binary (`.glb`), Draco or Meshopt compression on, textures as KTX2
- name the root object with the asset id
- keep the untouched `.blend` outside `public/` — originals never ship
- record `sourceHash` (the `.blend`) and `processedHash` (the `.glb`) in the manifest

## Validation

| Command | Checks |
|---|---|
| `npm run validate:assets` | no undocumented asset, no duplicate id, no missing provenance field, no external asset without attribution, **no hotlinked runtime asset anywhere in `src`** |
| `npm run check:budgets` | declared budgets are within their tier ceilings |
| `npm test` | load → display → unload → reload with zero leaked resources, abort safety, determinism |
