# Pocket world compatibility batches

These six batches assign development ownership and compatibility checks. Every world implements the same ISLAND-05 `PocketWorldDefinition` and lazy `PocketWorldFactory` in [the host contract](../../src/world/pocket/types.ts), with one scoped scene root, collision context, existing camera and existing Loop. The [master plan](WORLD_EXPANSION_GROKBOT_MASTER_20261121.md), [roster](WORLD_EXPANSION_WORLD_ROSTER_20261121.json), and [adversarial review](WORLD_EXPANSION_ADVERSARIAL_REVIEW_20261121.md) govern world identity and protected museum behavior. All destinations in this foundation are dormant.

## Integration and acceptance

Promote in this order: **W01 → W02 → W03 → W04 → W05 → W06 → W07 → W08 → W09 → L01 → W10**. Each production world requires its own playable, validated, owner-reviewed where required, merged and hosted release under the governing contract before the next is promoted. ISLAND-04 has a separate performance gate. Resolve dependency, device and island release requirements before Pages.

Each world must ship a source-verified entrance, a 3–7 minute authored route and one distinguishable mechanical learning beat. Capture a supported return pose at activation, own route state in the world, use the host checkpoint interface for safe pose reset, and call `requestComplete()` only after an observable world objective. Include immediate Back to Museum, keyboard and touch controls, reduced motion with a no-flash equivalent, and failure and reset routes that preserve museum access. Browser acceptance includes entry, checkpoint, failed load, completion, repeat completion, return, a ten-visit resource check, and screenshots of arrival, the mechanic and completion. Local assets and deterministic fallbacks must work offline. Measure initial museum transfer, lazy world transfer, shaders, texture and geometry churn, and representative-device frame budgets without changing existing thresholds. Do not introduce spiders or spider-like substitutes. Per the [owner’s locked design doctrine](https://github.com/westkitty/ChatGPT_Bible_Repo/blob/9f49a8338be19a35bc47197d48657a8537080c0e/bibles/Museum_of_Me_Bible.md), the worlds are enemy-free. Author a beginning, a playable reversal in the middle, and a legible resolution. Use broad supported traversal, generous timing and nearby nonlethal recovery. Before detailing assets, sketch the entrance, exit and return, three distinct spatial acts, landmarks and vertical circulation, an optional reconnecting branch, and accessible fallback. In browser, verify from the appropriate viewpoint that visitors can read what changed and how to finish without precision jump sequences.

All factories receive an AbortSignal. Use `scope` for owned geometry, textures, listeners, DOM and audio cleanup, and register controls through the scoped interaction interface. Supply drawable geometry and a supported spawn. Prove that pending loaders, inactive worlds, and disposed worlds take no input or updates. Any genuinely shared helper should follow implementations that demonstrate equivalent requirements. All batch notes below are planned design and acceptance work.

## A — Fluid and optical

**W01 Lagoon Depths · W08 World Inside a Raindrop**

Starting topology study for owner review. W01 basin loop with reconnecting musical alcoves. W08 concentric traversal layers with safe bubble landings.

- **Shared needs and interfaces.** Validate vessel boundaries, medium entry and exit, transparency ordering and a low-overdraw material path. Use the existing first-person camera, fixed updates, local collision, scope and signal. Author buoyancy, medium state and local visual/audio cues in each world before proposing shared utilities.
- **Distinct routes and anchors.** W01 starts from supported shore at the east lagoon, grounded in [IslandSiteLayout](../../src/world/exterior/IslandSiteLayout.ts) and the current lagoon safety tests. Swimming and musical discovery govern this world. W08 starts by the reflecting rill in [IslandLandmarks](../../src/world/exterior/IslandLandmarks.ts). Survey the proposed suspended-drop interactable first. Traverse bubbles and surface-tension routes at drop scale. Keep the rill's normal museum support.
- **Controls, assets and acceptance.** W01 needs swim up/down and an accessible surface/exit cue. W08 needs stable bubble-to-bubble steering, generous landing volumes and a static drop transition for motion-sensitive visitors. Provide visible counterparts to underwater and musical cues. Check mobile fill rate and underwater readability without layered full-screen effects. W01 checkpoints on a dry ledge or a stable swim station and completes at its musical discovery. W08 checkpoints on a bubble landing and completes at its authored drop route endpoint. Browser evidence must show surface-to-swim-to-safe return and bubble misses that reset without falling indefinitely.
- **Dependencies and next task.** Verify current lagoon support and [island lagoon safety](../../tests/browser/island-lagoon-safety.e2e.ts) before an entry affordance. Prototype one W01 descent, one audible and visual cue, and one return point in the host. Reserve W08 production promotion for its roster turn.

## B — Organic and scale

**W02 Prehistoric Fern Island · W05 Impossible Greenhouse**

Starting topology study for owner review. W02 coastal horseshoe with a Veiled Gorge crossing. W05 broad ascending botanical spiral.

- **Shared needs and interfaces.** Own vegetation instancing, collision proxy geometry, wide-turn camera clearance and placement of supported reset ledges in the world factory. Use host collision, first-person camera, fixed ticks, scoped assets and checkpoint pose.
- **Distinct routes and anchors.** W02 enters from the western Fern Ravine, exposed as `fern-ravine` in [IslandLandmarks](../../src/world/exterior/IslandLandmarks.ts). Keep an ancient recognizable island and its Veiled Gorge. W05 enters via `GREENHOUSE_FLOWER_ID` in the [rooftop layout](../../src/world/exterior/rooftopLayout.ts). Preserve the current glasshouse/café partnership and Cinema. Its mechanical beat is shrinking into a greenhouse universe with plant-scale routes, not a second prehistoric terrain walk.
- **Controls, assets and acceptance.** Provide forgiving climb input, rest shelves and step-free alternatives to precision climbs. Make the change in scale legible through static framing when motion is reduced. Use instanced foliage and bounded canopy shadow/alpha overdraw. Proof includes supported colliders under visible routes, no near-camera leaf occlusion at turns, and a safe recovery after a missed ledge. W02 completes at an authored Veiled Gorge discovery after learning terrain traversal. W05 completes after crossing from the flower to its authored small-scale objective, with a stable plant-surface checkpoint.
- **Dependencies and next task.** Survey the existing ravine collision and take approach screenshots. Build one W02 terrain-to-fern traversal beat when W01 clears promotion. Reuse any vegetation helper only after W05 supplies matching requirements.

## C — Time and dynamic geometry

**W03 Clockwork Sundial · W04 Digital Beat World · W09 Museum Between Seconds**

Starting topology study for owner review. W03 rotating loop around an observation hub. W04 folded three-zone return loop. W09 braided paths across time-affected chambers.

- **Shared needs and interfaces.** Tick local deterministic simulation through host fixed updates. Coordinate moving support, input/collision order and checkpoint state in each adapter. Record or derive any world clock phase on route reset and use the host only for supported pose restoration. The museum and UI continue to use their existing timing after return.
- **Distinct routes and anchors.** W03 uses the existing southwest `astronomical-terrace` in [IslandLandmarks](../../src/world/exterior/IslandLandmarks.ts). Survey its approach and existing gnomon geometry before adding a trigger. The clock advances on a schedule, driving gears and a captive sunrise. W04 uses the E19 DexTilt exhibit only after verifying the [collection](../../src/content/collection.generated.ts) and collision approach. Audio phrases drive safe geometry shifts, with an authoritative phase, an early warning and no gesture controls. W09 uses the broken orrery in [ExteriorObservatory](../../src/world/exterior/ExteriorObservatory.ts). Player movement advances environmental time. Allow explicit keyboard/touch advance as an accessibility alternative and leave input/UI responsive at rest.
- **Controls, assets and acceptance.** Use visual and audio forecasts, fixed safe platforms, stable cameras, simple moving collider proxies and reduced-motion cues. Check missed shifts, muted timing, reset during transit, pause/resume and no collision tunneling. W03 checkpoints at a gear station and completes after traversing a scheduled cycle. W04 checkpoints before a phrase change and completes after successful beat-guided traversal. W09 checkpoints before a time-driven obstruction and completes after the movement-driven route opens. Browser traces must show scheduled, soundtrack and movement-driven clocks run independently.
- **Dependencies and next task.** Locate and mark the W03 supported approach and record a single deterministic platform cycle with reset tests after W02. Do not construct a common audio/clock engine in advance.

## D — Momentum and spatial traversal

**W06 Skyborne Gardens · W07 Portal Slingshot Trials**

Starting topology study for owner review. W06 linked islands with alternate landings. W07 three original chambers connected by a testing-lab hub.

- **Shared needs and interfaces.** Use the existing player adapter, fixed updates, collision and checkpoint reset. Test momentum, swept crossing and supported landing. Author each transport implementation inside its factory. Use entry/return signaling at the museum edge only.
- **Distinct routes and anchors.** W06 starts at [Flight Pad II](../../src/world/exterior/rooftopLayout.ts). Destination-ready control offers a step-free path. The existing roof flight and the sky silhouettes retain their roles. W07 starts in a small testing lab behind the lowest-population wing verified against current authored visitor placement and circulation. Survey the lab site and license/audit the [planned audition prototype source](WORLD_EXPANSION_GROKBOT_MASTER_20261121.md) before reuse. Preserve the two-portal pairing, block puzzles and spatial momentum transform across three original rooms. Keep portal rendering nonrecursive.
- **Controls, assets and acceptance.** Use wide landing support, orientation hints, predictable fall reset, touch aim/action and an alternate launch/portal presentation with reduced motion. Give translated velocity a stable visual cue without compulsory camera roll. Budget flight vistas, portal render targets and block simulation. W06 checkpoints on a supported landing and completes the sky garden route. W07 checkpoints on a valid room floor with known block/portal state and completes the final room only after the distinct pairing and momentum puzzles. Browser tests exercise bad trajectories, blocked portal placements, orientation, block reset and return while airborne.
- **Dependencies and next task.** Measure the W06 pad→supported test landing and step-free route after W05. Prepare the W07 source and circulation audit read-only, without importing audition assets until rights and runtime fit are proven.

## E — Lighthouse bonus

**L01 Lighthouse at World's End**

Starting topology study for owner review. L01 beam-lit spiral with return sightlines and safe waiting areas.

- **Shared needs and interfaces.** Use the same first-person factory, fixed update, supported checkpoint, audio and resource scope. Keep rotating beam reveal and light-dependent navigation L01-specific.
- **Anchor and contract.** Bind the peninsula lens in [ExteriorLighthouse](../../src/world/exterior/ExteriorLighthouse.ts). Keep its existing physical route. The optional bonus records completion outside the ten stamp slots. This accounting remains provisional pending a stronger accepted contract and must be reviewed before a production change to persisted semantics.
- **Controls, assets and acceptance.** Author one safe waiting point and a readable beam cycle without flashing or dark-only mandatory cues. Give touch and keyboard the same safe timing, plus steady-state markers for reduced motion. Prefer simple beam materials and bounded shadows. Check that beam reveal is visible, a missed window has a safe fallback, a checkpoint restores the correct beam state, and completion gives zero passport stamps. Keep the approach usable during load failure and after return.
- **Dependencies and next task.** After W09, verify the lens approach and compare the accounting with accepted continuity. Prototype one rotating-beam crossing with a fixed reduced-motion cue before authoring the full route.

## F — Final world

**W10 Breath of the Weasel**

Starting topology study for owner review. W10 wide landmark-driven loops that reconverge at a high viewpoint.

- **Shared needs and interfaces.** Use the same lifecycle, collision and input, with a W10-owned third-person camera adapter on the existing camera. Validate player/avatar state handoff, follow-camera collision and scope-owned rig assets. Extend the host only for demonstrated camera ownership needs. No new renderer or frame loop.
- **Anchor and distinct route.** Use the [south pier](../../src/world/exterior/IslandSiteLayout.ts) NPC and the roof [second-pad console](../../src/world/exterior/rooftopLayout.ts). Both must use the registry readiness check and require a genuine earned W01–W09 stamp. Confirm that choosing W10 at the console leaves a separate accessible route into W06. Validate canonically accurate Phalène Dexter before shipping any rig. Keep original wilderness, stamina, climbing, gliding and shrine mechanics. Never use the badge or W10 completion itself as the unlock.
- **Controls, assets and acceptance.** Provide supported rest spots, an easy stamina cue, assisted climb/glide input for touch, stable follow and no-flash equivalents. Budget animated rig draw/skin costs, camera visibility, outdoor distance and shrine physics. Checkpoint at a shrine or stable wilderness rest. Stamp only after the authored learning and shrine objective. Verify safe falls, camera restoration and ten return cycles. Exercise readiness-only, stamp-only and both gates at both entry anchors, plus no stamp requirement to enter the main museum.
- **Dependencies and next task.** W10 starts only after L01 promotion. Verify Dexter reference canon, rig provenance, supported pier/roof approaches and independent stamp gates. Prototype one climb to a camp and short glide with safe landing using the existing camera before any production asset rollout.
