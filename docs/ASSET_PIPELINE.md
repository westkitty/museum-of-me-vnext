# Asset Pipeline

## The one entry point

Everything visible in the museum comes through `AssetManager.load(id, scope)`.
There is no second path. That single choke point is what makes every asset
governed: it refuses any id without a manifest record, it tracks bytes against
the declared budget, and it hands ownership to a caller-supplied `ResourceScope`
so disposal is the caller's explicit responsibility rather than a hope.

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
| `texture` | KTX2Loader | declared per asset | source hash + processed hash |
| `audio` | synthesised at runtime by `AudioManager` | 0 KB | authored here |

Procedural is the default (see `ASSET_POLICY.md`). The file-backed path is fully
implemented and tested so an authentic project artifact can be carried in
whenever one is better than a generator.

## Registering an asset

```ts
// 1. declare it — this is the provenance record
registerProcedural('starsilk.loom', 'Celestial loom', 'exhibit:E01', 'P001');

// 2. register how it is built
assets.registerGenerator('starsilk.loom', (scope, detail) => { … });
```

`registerGenerator` throws for an id with no manifest record, so an
undocumented asset cannot reach the scene even by accident.

## Determinism

Procedural generators must not call `Math.random`. Use `rng(seed)` from
`generators.ts`, which is a seeded xorshift. Two runs of the museum produce
byte-identical geometry, which is what makes visual regressions meaningful and
lets a specific arrangement be described by its seed rather than stored.

## Cancellation

`load()` accepts an `AbortSignal`. A cancelled load never returns a partially
built object and never allocates into the caller's scope. This is what lets the
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
