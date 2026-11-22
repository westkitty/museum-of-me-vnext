# GrokBot Three.js Museum Execution Playbook — Project-Local Specialist Reference
Date: 2026-11-21. Read alongside docs/plans/WORLD_EXPANSION_GROKBOT_MASTER_20261121.md.
This is a portable self-contained agent procedure, not an assertion that an external ChatGPT Skill is installed or can be invoked by GrokBot. It is tailored to actual museum code. If GrokBot has stronger equivalent skills, those may support execution but may not override the museum's protected architecture.

## Inputs and protected authority
Review AGENTS.md, architecture.project.json, src/app/Loop.ts, src/assets/ResourceScope.ts, src/assets/AssetManager.ts, docs/ASSET_PIPELINE.md, docs/ASSET_POLICY.md, src/world/exterior/ExteriorWorld.ts, IslandSiteLayout.ts, IslandLandscape.ts, ExteriorMuseumShell.ts, src/world/cinemaLayout.ts, src/world/SourceVisitors.ts and AmbientVisitors.ts.
- Three.js exact pinned dependency: `three@0.185.1`, imported via ESM and TypeScript; do not migrate engines/render backends or add physics framework without measured need.
- Only src/app/Loop.ts owns requestAnimationFrame. Update worlds through existing fixedUpdate/variableUpdate/render callbacks; no independent RAF or hidden timelines.
- Existing museum remains first-person; only W10 Breath of the Weasel intentionally uses third-person camera.
- ExteriorWorld and interior live in separate scene ownership/residency. ExteriorMuseumShell is a visual proxy of the building, NOT proof that the full indoor cinema or rooftop structure resides there.
- Workshop safe-placement authoring cannot edit structural floors/roofs/colliders; use authored source geometry with dedicated tests for new roof/coast.
- Preserve all currently valid exhibit, sanitation, sanctuary, routing and cinema behaviors.

## Contract-first implementation slice
1. Open correct repo, branch, HEAD; refresh documentation and baseline browser screenshots. Name no nonexistent path.
2. Write exact acceptance assertions and a FAIL list. Identify which existing class owns geometry, collision, feature flags, interaction and return anchor.
3. Implement one vertical slice with real colliding paths and working interaction. Bounded scope only; no decorative placeholder as substitute for playable requirement.
4. Add unit tests of geometry/registry/nav, plus browser tests with real pointer/keyboard/touch. Test fail and recovery paths.
5. Measure performance on matched conditions; capture 'before' and 'after' proof, not subjective claims.
6. Run full required gates and report exact commands/results; inspect diff, licenses, privacy; stage/commit/push, PR, merge, Pages per master.
7. Revisit the previous milestone's smoke path before completing the next one. Shared systems are vulnerable to regression.

## Scene/world adapter
Plan a minimal typed contract preserving existing app ownership:
- worldId; activation from an authored interaction or trigger; lazy asset loader with AbortSignal; factory/attach/detach/dispose; scoped colliders/interactions/audio; spawn/return anchors; fixed-step update(dt); variable update(dt); checkpoint/reset/complete; quality setting.
- Have one authoritative active world at a time and explicit states IDLE, PREPARING, TRANSITIONING, ACTIVE, EXITING, FAILED. All transitions idempotent; stale async completions cannot resurrect a world after exit.
- On FAIL: release partial assets, restore saved camera/controls, unlock input and return to last safe collision-backed anchor. Do not send a visitor into a world that has not passed its activation release gate.
- Keep each world state in typed gameplay data, not encoded solely by mesh transforms. Serialize only minimal progress/completion and version it.
- Cumulative ten-stamp state has immutable IDs W01–W10, not array order alone. Lighthouse L01 is not an eleventh stamped world. Award only on completion, exactly once.

## Geometry and navigation
- Author everything in meters, Y-up; verify coordinate transform between interior and exterior shell. Use a schematic before building roof pieces.
- Every walkable platform must have collision support and predictable slope/ramp/edge behavior. Any new shoreline must update closed island support, water boundary and collision; check against Lagoon poly and paths.
- For tree visual changes, raise foliage crown separately from trunk collision, preserve deterministic planted seeds and density. Don't raise collision trunk or visual crown independently in ways that make navigation untrue.
- Use explicit static box/floor/ramp colliders consistent with existing CollisionWorld; don't install full rigid-body physics just to make three simple puzzles.
- Use authored local coordinates and route markers to protect doorways, foreground signs, viewpoints and NPC interactions. Test human- and eye-level, not just overhead screenshots.
- Build a recenter/fall recovery for portal jumps and floating islands; never let museum player fall forever.

## Portals and motion — independent of fancy rendering
- A slingshot shot is deterministic: raycast using actual camera transform, validate hit surface (normal, size, portal spacing, clearance), reject invalid shots visibly, and assign A/B portals with stable colors distinguishable without color vision.
- On traversal, map position through entry frame and output frame using orthonormal basis: local=entry.inverse * position; exit=exit.frame * transformed(local) with handedness/axis reversal documented and unit-tested. Transform velocity and camera orientation using the same rotation; prevent immediate re-trigger with bounded cooldown and distance away from exit plane.
- Puzzle simulation: pressure plate occupancy uses cube physical position, not mesh visuals. Treat "pick up / carry / drop", reset, reachable cube spawn and portal-through-cube as unit-tested state, including softlock recovery.
- Render portal view only when a real portal is on screen and quality permits, with strict depth and recursion limits. Safe fallback is stylized interior surface/edge and mathematically true teleportation, not an infinite render-target nest. Test GPU memory after repeated portal resets.
- Momentum room: teach drops using clear visual indicators and safe floor/collision/teleport. Prefer a fixed worked solution to emergent physics complexity at first.

## Time, rhythm and scale
- Observatory W09: environmental simulation time t_env advances proportionally to *intentional movement magnitude* or explicit accessible "advance time" action, bounded by fixed dt; keep input, pointer look, UI, audio, collision, timers and exit responsive even when environment frozen. Test standing still, turning only, crouching, jumping, teleports and accessibility alternate action.
- Sundial W03: normal continuous mechanical phase and scheduled gear motion, not movement-controlled time. Keep the two experiences distinct.
- Digital Beat W04: musical phase is a shared scalar (AudioContext playback clock or deterministic silent virtual phase). Do not have a separate setTimeout for animation and media element time. Include visible countdown, safe surfaces and backfill all states after tab resumes. 30s is an approximate musical period; align to phrase boundaries and give predictable teaching sections.
- Greenhouse W05: apply growth inside world-local scene with controlled anchors/checkpoints; do NOT mutate exterior greenhouse mesh scale/colliders.
- Raindrop W08: transparency depth order, controlled additive effects and refraction budget; on lower tiers use convincing Fresnel/animated normals instead of expensive multiple real-time cube captures. Visual clarity outweighs realism.
- Floating islands W06 and wilderness W10: show distant low-cost proxies in island scene, then transition near a bounded threshold to independently loaded play scene. Do not build a continuous kilometer-long world; choose artistically matched travel cut.

## Asset and NPC engineering
- The DEX//SCULPT gallery is a metadata/thumbnail browser, not a GLB CDN. Read original catalog and thumbnail manifest; inspect exact selected files and licenses before importing. Original source hash != processed shipped bytes; record both.
- Recorded Hot Dog candidate: `polygonalmind-100-avatars-r1/character/87_hotdog`, SHA256 `43a97ad1a349e139e7ffbc224774514c2cfe0d3c35fe1d60ff97c79f48f9eee9`, 65 joints, zero recorded animation clips. Verify actual bytes and licensing/rights; source record alone is not a usable character. Create original appropriate idle/serving animations or verified rig-compatible retarget, then physically place behind café stand.
- SourceVisitors = 17 BatchedMesh authored identities; semantic visitors and their 17 conversations must remain. AmbientVisitors = separate animated Quaternius clones. When changing visuals, retain route/interaction ownership, compare draw submissions, mixer CPU and texture memory. Keep an atlas/instancing/LOD design appropriate to scale; don't make 17 65-bone skinned rigs with unique materials by default.
- Prefer perceptibly distinct vetted characters (frog, cactus, goldfish-bag, cosmic, eye wizard, mushroomy). Only after verifying exact GLBs in source catalog, preview, user suitability and licenses. No false visual-approval status, no model ID based on mere filename similarity.
- AssetManager owns prototype reuse and ResourceScope leases. Geometry/materials/textures created in-world must be disposed in the rightful scope; no double disposal of shared prototypes. Use SkeletonUtils clone for skinned assets and release clone skeletons. For a model with no animation, no pretend idle walk.
- Do not ship private source GLBs/Drive IDs or exceed first-view transfer budget. Explicit offline test has no third-party network requests; separate consented YouTube path in cinema stays intact.

## Performance and reliability
- Read tests/perf/budgets.json; initial first visit must stay within encoded transfer/package gates, which need a reality check with actual network logs. Do not reduce a checker threshold just to turn CI green.
- Capture actual JS heap before/after ten world round trips, renderer.info geometries/textures/render targets, active audio node count, DOM node count, load times, frame-time p95/p99, quality switching and camera collision. Assess M1/Metal separately from software WebGL.
- Use InstancedMesh/BatchedMesh for repeated foliage or props; selective shadows, shared materials and culling. Use measured evidence for any proposed LOD, worker, renderer or physics migration.
- Per world release needs low/medium/high tiers, offline/cold cache, resize, WebGL context loss, corrupted save, repeated transition, touch and keyboard, accessible audio-muted gameplay, reduced-motion.

## Pages and Git gates
- `npm run gate` is a required broad quality check; CI includes browser shards. `npm run test:workshop` and `npm run verify:standalone` may be needed depending on modifications; consult package.json scripts. `npm run perf:device` is hardware-dependent; don't claim hardware test when executed under SwiftShader.
- Stage only scoped files, inspect staged diff including generated output and licensing, commit, push isolated branch, open PR, await required checks on exact head, squash merge as permitted. Re-check main SHA, then publish only complete visitor-visible milestones via verified pages-preview fast-forward or workflow_dispatch from an exact known commit. Verify deployed SHA and actual visitor journey.
- A fail blocks that milestone, but not safe unrelated planning. Preserve last good main/Pages and a precise resumable receipt.

## Failure red-team
Common bad shortcuts: relocating the existing cinema to make a roof plan easy; assigning new GLB by thumbnail; inventing a source portal prototype; putting an interactive island as a cheap skybox; awarding stamps on entry; enabling incomplete worlds; adding a second RAF; adding music without opt-in; disabling touch; long grass obscuring tidepools; world transition leaking audio; 'CI passed' from an old SHA; calling main merge a deployment; shipping Nintendo characters as direct copies. Reject them.

For extra context, consult the supplied Modern 3D Browser Game Architecture Toolkit (v1.0, Aug 19 2026) when accessible; this playbook is distilled for the museum and is sufficient to start without additional externally installed Skills.
