# Asset Pipeline

## Asset paths — deliberately not one choke point

`AssetManager` is the governed loader for registered procedural exhibit generators and glTF/GLB
assets. It is **not** the path for every visible object in the museum:

| Asset family | Runtime path | Ownership / evidence |
|---|---|---|
| Procedural shell, environment, exhibits and effects | Builders such as `GeometryKit`, scoped directly through `ResourceScope` | Deterministic source code; rendering and lifecycle contracts are covered by tests and budget validators. |
| Registered procedural exhibit payloads | `AssetManager.load(id, scope)` → registered generator | Must have a manifest ID and generator; zero transfer bytes. |
| Quaternius population models | `AssetManager.load(id, scope)` → `GLTFLoader` | Local GLBs; provenance and source/processed hashes in the manifest and `QUATERNIUS_ASSET_PROVENANCE.md`. |
| Curated raster artwork | Vite imports in `curatedAssets.ts`; consumed through CSS or the specialized local artwork/texture path | Manifest-recorded local bytes, checked against processed SHA-256 by `npm run validate:assets`. |
| Full Weasel | Deferred same-origin iframe bundle at E27 | 65-file tree with a manifest-bound SHA-256; checked by `npm run validate:assets`. |
| Ambient audio | `AudioManager` procedural Web Audio | No shipped audio file; muted by default until the visitor opts in. |

Every file-backed runtime asset stays local and offline-capable. No runtime hotlinks are permitted.
The manifest records stable identity and provenance; specialized systems may load a file without
routing it through `AssetManager` when that is the correct runtime boundary.

## `AssetManager`

`AssetManager.load(id, scope)` refuses an unknown ID. For `kind: 'procedural'`, it calls the
registered generator and tracks the resulting object in the caller's `ResourceScope`. For the
current `kind: 'glb'` assets, it uses `GLTFLoader` and returns the root plus animation clips and
measured transfer/load data. A caller owns disposal of the supplied scope.

The loader is wired with KTX2, Draco and Meshopt support, but those are capabilities, not claims
that the current production asset set uses those formats. Curated rasters and the Full Weasel bundle
have their own specialized runtime paths as listed above.

```ts
const scope = new ResourceScope('E19');
const { object } = await assets.load('dextilt.phone', scope, { detail: quality.detailScale });
group.add(object);
// …later
object.removeFromParent();
scope.dispose(); // asserts it drained to zero
```

## Registering a procedural exhibit asset

```ts
// 1. declare provenance in the governed registry
registerProcedural('starsilk.loom', 'Celestial loom', 'exhibit:E01', 'P001');

// 2. register its deterministic generator
assets.registerGenerator('starsilk.loom', (scope, detail) => { /* build geometry */ });
```

`registerGenerator` rejects an ID without a manifest record. Geometry that belongs to the museum
shell or another scoped world subsystem is built through that subsystem directly; it is still
tracked and disposed through `ResourceScope`.

## Determinism and cancellation

Procedural generators must not call `Math.random`. Use the seeded helpers in `generators.ts` where a
seeded arrangement is appropriate. Geometry regressions are tested from deterministic scene
construction; byte-identical GPU buffers are not claimed for every WebGL implementation.

`AssetManager.load()` accepts an `AbortSignal` for its procedural and glTF paths. A cancelled load
must not return a partially-built object; callers dispose their scope through the existing lifecycle
contract.

## Provenance and hashes

`src/assets/manifest.ts` defines the record shape. File-backed records identify their local URL,
creator/license, stable ID, transfer budget and processed hash; source hashes identify the original
when that original differs from the shipped derivative. The Full Weasel tree is represented by its
separately documented tree hash.

`npm run validate:assets` statically checks literal registrations for duplicate IDs and required
provenance fields, rejects obvious external HTTP(S) runtime URLs in `src`, checks local processed
SHA-256 values for the imported curated rasters and Quaternius GLBs, and verifies the Full Weasel
tree hash. In this checkout it reports **17 governed registrations**, **12 imported-file hashes**,
and the **65-file Full Weasel tree** verified. Three original Quaternius source hashes are retained
as provenance but cannot be rechecked from this checkout because the ignored `.asset-sources/`
acquisition cache is absent. The validator does not prove that every arbitrary scene mesh has its own
manifest record or re-download/re-license an external source.

`npm run check:budgets` separately measures the initial production transfer, a deferred-bundle byte
subtotal for its allowlisted web extensions, shipped binary declarations, and declared tier labels.
That subtotal omits files such as the Full Weasel `manifest.json`; `validate:assets` hashes every file
in the full bundle tree. The script prints A/B/C ceiling values but does **not** measure each
exhibit's asset bytes against them: the current mapping has no per-exhibit byte accounting. Runtime
`AssetManager.budgetViolations` is diagnostic evidence, not a substitute for the measured
initial-transfer check.

## Blender export conventions

For any future asset that is modelled rather than generated:

- metres, Y-up, `+Z` forward; apply transforms before export;
- use one material per mesh where practical; bake texture work rather than shipping procedural
  Blender nodes;
- export glTF 2.0 binary (`.glb`) with supported compression only when the runtime path is tested;
- name the root object with the stable asset ID;
- keep untouched source files outside `public/`; originals do not ship;
- record `sourceHash` (untouched source) and `processedHash` (shipped file) in the manifest.

## Validation commands

| Command | What it actually checks |
|---|---|
| `npm run validate:assets` | Registration/provenance fields, duplicate literal IDs, obvious runtime HTTP(S) hotlinks, local processed-file hashes, and the Full Weasel tree hash. |
| `npm run check:budgets` | Initial-transfer size, allowlisted deferred-bundle extension subtotal, shipped-binary declaration and tier-label validity; not whole-tree or per-exhibit byte-to-ceiling accounting. |
| `npm test` | Automated unit/regression contracts, including resource ownership and static-bake invariants; it does not replace a human visual review. |
