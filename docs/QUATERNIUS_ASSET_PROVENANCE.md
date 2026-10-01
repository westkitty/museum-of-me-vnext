# Quaternius Phase 3 Asset Provenance

**Acquired:** 2026-08-23
**Publisher/creator:** Quaternius
**License:** CC0 1.0 Universal, evidenced by the official Quaternius pages and
their linked official distribution surfaces.
**Runtime policy:** no hotlinks. Only the three listed local GLBs ship.

**Checkout audit (2026-10-01):** the ignored `.asset-sources/quaternius/` acquisition cache is
absent from this checkout. The source hashes below remain recorded provenance from the acquisition
work; they were not independently re-hashed here. All three shipped GLB byte hashes were verified
against `src/assets/quaterniusAssets.ts` by `npm run validate:assets`.

## Official source chain and retained originals

| Approved pack | Official page / official linked distribution | Source filename at acquisition | Source SHA-256 recorded at acquisition |
|---|---|---|---|
| Ultimate Modular Men | <https://quaternius.com/packs/ultimatemodularcharacters.html> → [publisher-linked Google Drive folder](https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX) | `Casual_2.gltf` | `55c654d09a2a5ff6e3bd6158d4a1b462f181cd6f1e12a0f5e9d959f9c3abc438` |
| Ultimate Modular Women | <https://quaternius.com/packs/ultimatemodularwomen.html> → [publisher-linked Google Drive folder](https://drive.google.com/drive/folders/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf) | `Casual.gltf` | `b0fe6e92219cd71808844a20a1a8b960fd1cf640a6546dc6362b5add6604e87c` |
| Background Posed Humans | <https://quaternius.com/packs/backgroundposedhumans.html> → [publisher-linked Google Drive folder](https://drive.google.com/drive/folders/18dWyZlA53euzsc1WobITqFYLcT5sFULz) | `Female_Sitting.fbx` | `3239140d393bab68bee18fa7fffe9336f872ce6c91025f626583d9159b4c8907` |
| Universal Base Characters | <https://quaternius.itch.io/universal-base-characters> | `Universal Base Characters[Standard].zip` (123 MB) | `fdbf1804c90dfc1ea03e992bff7da2dfd1a79318e13270a660180f9308455f40` |
| Universal Animation Library | <https://quaternius.itch.io/universal-animation-library> | `Universal Animation Library[Standard].zip` (15 MB) | `cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724` |

The first three official Google Drive distributions provide selected source
files rather than a single pack archive. Those exact downloaded source files
are retained; no unverified mirror or substitute was used.

## Physical inspection and selection decision

| Candidate | Inspection result | Decision |
|---|---|---|
| Men `Casual_2.gltf` | 3,058,092 B; 67 nodes; 4 meshes; 5,776 triangles; 9 materials; one 62-joint skin; 24 named clips including `Walk`; embedded buffer and no external URI. | Runtime walker prototype. |
| Women `Casual.gltf` | 3,131,788 B; 67 nodes; 4 meshes; 6,424 triangles; 7 materials; one 62-joint skin; 24 named clips including `Walk`; embedded buffer and no external URI. | Runtime walker prototype. |
| Background Posed Humans `Female_Sitting.fbx` | Static posed source; centimetre-scale (about 296 source units high), no required animation. | Converted to the seated/exhibit observer at `0.006` scale. |
| Universal Base Characters standard glTFs | Female: 15,060 triangles; male: 14,318; each has 65 joints, 7 external PNG textures and no clips. The source is a valid retargeting candidate but the texture-heavy external-URI layout and absence of locomotion would increase the runtime subset without improving the selected walkers. | Retained and inspected; not shipped. |
| Universal Animation Library `UAL1_Standard.glb` | 13,744 triangles, two skinned meshes, 130 joints, two materials, zero textures, 43 clips. Current locomotion clips include root translation. | Retained and inspected; not bound to the older selected Modular Men/Women rigs. Their verified own `Walk` clips are in-place enough for the existing route owner, avoiding an unproven cross-rig retarget/root-motion path. |

The Base Characters source demonstrates the current Quaternius humanoid rig but
is not a safe drop-in substitute for the selected animated Modular Men/Women
without a separate retargeting and texture-budget decision. “Approved” did not
mean “ship every inspected file.”

## Deterministic runtime conversions

The source files were converted locally with the installed Three.js r185
`GLTFLoader`/`FBXLoader` plus `GLTFExporter` on Node 26.7.0. The exact command
is `node scripts/convert-quaternius-assets.mjs`. The exporter closes each
selected scene into a standalone GLB; no manual binary edits are made. The
utility supplies Node-compatible `FileReader` and `ProgressEvent` shims only.
It adds no dependency and produces no external URIs.

| Runtime artifact | Source | Runtime path | Bytes | SHA-256 |
|---|---|---|---:|---|
| `quaternius-men-casual.glb` | `Casual_2.gltf` | `src/assets/npc/quaternius-men-casual.glb` | 2,588,348 | `cb5a335837288e2a2be7a9d3e1e7f0755723384f6e8763acdd24a55f49fe2779` |
| `quaternius-women-casual.glb` | `Casual.gltf` | `src/assets/npc/quaternius-women-casual.glb` | 2,628,220 | `6e20483dad0a557b294844f299438278a8c9fa8d894fdebe39fac44dde8ba8a5` |
| `quaternius-posed-sitting.glb` | `Female_Sitting.fbx` | `src/assets/npc/quaternius-posed-sitting.glb` | 164,772 | `06e2962f7b965121f9d83aff843db4ca858d8a1edfaca99b9a79eaf09c8acf2f` |

## Runtime ownership

`AssetManager.load()` returns a stable `LoadedAsset` with both the root object
and verified `THREE.AnimationClip[]`. `AmbientVisitors` loads the three
manifest-governed prototypes once into the app scope, uses
`SkeletonUtils.clone()` for each skinned walker, and owns one animation mixer
per walker. Quality changes rebuild only clones, not the prototypes. Static
observers receive no animation mixer. The existing authored routes remain the
sole movement authority; reduced motion pauses both route transforms and walk
actions. Source visitors/staff are not changed.
