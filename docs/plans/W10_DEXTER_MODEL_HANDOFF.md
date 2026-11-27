# W10 Dexter model: production handoff (2026-11-26, V6)

**Status: no approved Dexter model exists.** W10 (Breath of the Weasel) plays with a temporary quadruped named `W10 TEST-ONLY RIG — NOT APPROVED DEXTER`. Its snapshot reports `rigStatus: 'TEST_ONLY_NOT_APPROVED_DEXTER'`. It is a silhouette and camera stand-in only. It is not Dexter, and no generic dog or stock animal will be substituted.

This document covers only what an approved model must meet technically and how it will be wired in. **Dexter's likeness, markings, palette, proportions, expression and personality are the owner's to define.** Nothing here proposes them.

## What is ready (verified locally)

- **The character seam** in `src/world/pocket/w10/dexterCharacter.ts`.
  - W10 drives a `DexterCharacter` (`object`, `status`, `update(position, yaw, pose, dt, reducedMotion)`, `dispose()`). The world never builds the character itself.
  - Replacing the rig changes one constructor call. W10's mechanics, collision capsule, camera and checkpoints stay as they are.
- **Pose selection** (`chooseDexterPose`) is shared by every implementation. A real model therefore animates exactly where the test rig would.
  - The poses are `idle`, `walk`, `run`, `glide`, `climb` and `fall`.
  - Climbing takes priority. In the air, the visitor glides with the glider and falls without it.
  - Walking starts at 0.25 m/s and running at 4.2 m/s.
- **Technical contract and validator** (`DEXTER_ASSET_CONTRACT`, `validateDexterAsset`). The validator returns every reason a candidate cannot be wired in yet. Unit tests: `tests/w10-dexter-character.test.ts` (4/4).
- **The test-only rig** now lives behind the seam (`createTestOnlyDexterRig`). It keeps its label and stays inside the contract's scale. It frees everything it creates.
- **W10 is wired through the seam.** `createW10World.ts` builds its character only through `createTestOnlyDexterRig(scope)`. Each frame it passes `chooseDexterPose(...)`, takes the snapshot's `rigStatus` from `character.status`, and disposes the character on exit. W10's keyboard and touch journeys pass 4/4 after the change.
- **The third-person camera keeps the character in view** (`src/world/pocket/thirdPersonBoom.ts`). The boom shortens in front of opaque world geometry and eases back out.
  - `tests/browser/worlds-camera-boom.e2e.ts`: the visitor walks to the climb cliff and turns their back to it. The boom goes 5.42 → 3.98 m, then back to 5.42 m.
  - Model framing is therefore checked against the real cliff faces, not only open ground.

## Technical contract (an approved asset must meet all of it)

| Item | Requirement | Why |
|---|---|---|
| Format | glTF 2.0 binary (`.glb`), textures embedded | One lazy file inside W10's chunk budget, offline-packable |
| Axes | Y up, facing −Z, metres; origin on the ground under the body centre | Matches the player pose W10 already drives |
| Size | Height 0.6–1.1 m, length 0.9–1.6 m; the body runs along Z | The test rig is 0.93 m × 1.28 m; the third-person camera is framed for this |
| Weight | ≤ 3 MB, ≤ 30,000 triangles, ≤ 64 bones, textures ≤ 2048 px | Lazy-world transfer and the M1 frame budget |
| Animation clips | `idle`, `walk`, `run`, `glide`, `climb`, `fall` (exact names) | One clip per pose, chosen by `chooseDexterPose` |
| Optional node | `glider_mount` | Where the glider attaches; otherwise above the body centre |
| Reduced motion | Clips must read correctly when the loop holds still or is slowed | The museum's reduced-motion setting |

Scale and limits are proposed technical defaults derived from the current scene. The owner can change them.

## What the owner decides or supplies

1. **The source of the model.** Possible sources:
   - the owner's own model;
   - an artist the owner engages, with the owner's references;
   - a review-only candidate prepared locally from approved references, if the owner authorizes it.
   - No paid generation has been used.
   - No private asset or reference has been sent to any external service. Doing so needs explicit owner authorization.
2. **Likeness approval.** Owner visual acceptance comes before the status can change to `OWNER_APPROVED_DEXTER`.
3. **Provenance.** A provenance note in the style of `docs/HOT_DOG_MAN_ASSET_PROVENANCE.md`: who made it, rights and the source files.

## Wiring an approved model in (after approval)

1. Place the `.glb` beside W10 so it stays a lazy world asset. The verifier `scripts/verify-release-dist.mjs` must still pass for ordinary builds.
2. Read its measurements: bytes, triangles, bones, texture sizes, clip names, bounds and facing. Require `validateDexterAsset(...)` to return `[]`.
3. Add `createApprovedDexter(scope, gltf)` implementing `DexterCharacter` with an `AnimationMixer`. It crossfades on pose changes, holds still under reduced motion, and disposes the mixer, geometries, materials and textures through the world scope.
4. Swap the one constructor call in `createW10World.ts`. The snapshot's `rigStatus` already comes from `character.status`.
5. Re-run the following:
   - the W10 unit tests;
   - the W10 keyboard and touch journeys;
   - the cross-world sessions;
   - the W10 lifecycle check: 10 visits, with no geometry or texture growth;
   - the activated offline rehearsal;
   - `perf:device`.
6. Capture third-person framing screenshots for the owner's review: plateau, glide, climb, shrine and overlook.

## Not done, by design

- No model was created, generated, downloaded or substituted.
- No Dexter likeness work.
- No external transfer of private assets.
