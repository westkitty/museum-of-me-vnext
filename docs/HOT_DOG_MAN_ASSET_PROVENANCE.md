# Hot Dog Man Asset Provenance (ISLAND-04)

**Owner approval:** Andrew visually approved `polygonalmind-100-avatars-r1/character/87_hotdog` as Hot Dog Man (relayed decision recorded in the Museum of Me Bible, 2026-11-21).
**Publisher/creator:** Polygonal Mind, 100 Avatars Round 1.
**Licence:** CC0-1.0. DEX//SCULPT source record `polygonalmind-100-avatars-r1`: official release <https://github.com/PolygonalMind/initiative-opensource-release/releases/tag/230412.1>, "CC0-1.0 (verified in License.md inside 2003_100AvatarsR1AssetPack.zip)".
**Runtime policy:** no hotlink. The single GLB ships locally and loads through `AssetManager`.

## Physical inspection (re-verified 2026-11-22)

| Property | Value |
|---|---|
| Source file | `~/Library/Application Support/DEX_Sculpt/VerifiedModels/polygonalmind-100-avatars-r1/87_hotdog.glb` |
| Bytes | 1,580,256 |
| SHA-256 | `43a97ad1a349e139e7ffbc224774514c2cfe0d3c35fe1d60ff97c79f48f9eee9` |
| Generator | UniGLTF-1.28 (VRM converted to glTF 2.0) |
| Triangles | 5,324 |
| Skin | 1 skin, 65 joints, `mixamorig:` names |
| Animations | 0 clips (T-pose default) |
| Images | 1 embedded texture |
| Extensions | `KHR_materials_unlit`, `KHR_texture_transform` |

The world-expansion master plan quotes this SHA-256 as `43a97ad1…2cfe1d60ff…`. That copy is missing eight hex characters (`0d3c35fe`); the full value above matches the bytes and the owner's brief.

## Runtime conversion

- Shipped unmodified as `src/assets/npc/hotdog-man.glb` (processed hash = source hash).
- At runtime each instance gets lit `MeshStandardMaterial`s that reuse the prototype's texture, so the character responds to the island's moonlight instead of glowing flat. Shared prototype geometry and textures stay leased by `AssetManager`.
- No clip is borrowed from another rig. Quaternius clips target a different skeleton family (`quaternius-universal-65`), so the idle and serving gesture are authored procedurally against this rig's own bones (`HotDogManPose.ts`): facing comes from foot→toe, arms are aimed in world space from the measured shoulder and elbow positions.
