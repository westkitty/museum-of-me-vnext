# Architecture

## Stack

TypeScript · Vite 6 · vanilla Three.js 0.185.1 · semantic DOM UI · Vitest · Playwright.

No React, no R3F, no physics engine, no state library. Plan §18.2: the museum needs explicit
lifecycle ownership and aggressive disposal across 35 independent modules, which a retained-mode
wrapper makes harder rather than easier.

## The single frame loop

`src/app/Loop.ts` is the **only** owner of `requestAnimationFrame` in the codebase.
Enforced by ESLint and by `scripts/validate-frameloop.mjs` (part of `npm run gate`).

```
requestAnimationFrame
  │
  ├─ accumulate real dt (clamped to 0.1 s to survive tab-restore)
  │
  ├─ FIXED STEP × n   (1/60 s)
  │     ├─ input sample → action state
  │     ├─ player: intent → velocity → collision resolve → position
  │     └─ active exhibits: update(dt)
  │
  ├─ VARIABLE STEP (once per frame)
  │     ├─ audio zones: crossfade by listener position (muted by default)
  │     ├─ streaming: evaluate zone residency, enqueue/cancel loads
  │     ├─ interaction: raycast focus, update cue
  │     └─ ui: HUD sync
  │
  └─ render: camera interpolated between fixed states, then renderer.render()
```

Fixed-step simulation keeps player physics and exhibit simulations frame-rate independent.
Rendering interpolates so motion stays smooth at any refresh rate.

## Module layout

```
src/
  app/          App, Loop, Diagnostics, Bootstrap        ← owns the frame
  render/       RendererHost, QualityTiers, Lighting
  world/        ExteriorWorld, island site, Museum geometry, wings, Rotunda, Sanctuary
                CollisionWorld; WorldDirector owns reversible world handoffs
  player/       PlayerController, capsule collision, input actions
  interaction/  InteractionManager, focus raycast, verbs (inspect/manipulate/…)
  exhibits/     ExhibitHost, registry, 35 modules by wing
  assets/       AssetManager, manifest, ResourceScope, procedural generators
  audio/        AudioManager, zones, synthesised ambience (muted by default)
  content/      generated living collection (73 projects, 35 exhibits)
  state/        preferences, journal, versioned persistence
  ui/           HUD, Map, Journal, DeepPanel, Settings — all DOM
  accessibility/ reduced motion, focus, DOM mirrors of world text
  workshop/     authored placement runtime + development-only authoring surface
```

Dependency direction is strictly downward: `exhibits` may import from `assets`, `interaction`,
`content`, `audio`. Nothing imports from `exhibits` except the registry. Nothing outside `app`
imports `Loop`.

## Museum Workshop authoring boundary

Museum Workshop does not create a second engine or scene model. The normal museum runtime always
loads the versioned declarative source `data/workshop-placements.json` through
`MuseumPlacements`. Those authored placement objects are deliberately non-colliding in Workshop
Core and own a bounded `ResourceScope`.

The editing surface itself is development-only. `src/main.ts` dynamically imports `Workshop` only
when both `import.meta.env.DEV` and `?edit=1` are true. That query exposes a visible `BUILD MODE`
control but leaves Workshop closed; `F8` is the secondary toggle. Workshop attaches Three.js
`TransformControls` to the real museum camera/canvas, releases pointer lock, captures UI ownership,
and freezes visitor movement only while active. The ordinary capture prompt is suppressed for that
interval and returns when Workshop closes. Semantic DOM owns the inspector, object palette, outliner,
commands, and save feedback.

Saving does not mutate TypeScript or expose arbitrary filesystem access. A Vite `apply: 'serve'`
plugin exposes one localhost-only POST endpoint with a 256 KiB body limit, shared schema and
conservation validation, a fixed target (`data/workshop-placements.json`), and atomic replacement.
`src/workshop/conservation.ts` derives deterministic protected areas from the authoritative layout,
installation, exhibit and visitor-route sources; rejected saves return placement ID/label, protected
area, rule and reason diagnostics before the target is opened. Production and standalone builds
consume the resulting manifest but do not contain that write endpoint or editor UI.
`scripts/verify-release-dist.mjs` rejects a release build if Workshop editor/write markers or styles
leak into production output.

Workshop Core may author only explicitly whitelisted safe placement prefabs. Structural and
collision-authoritative systems — walls, floors, stairs, ramps, the rotunda flight pad, Sanctuary
route geometry, source installations, authored visitor routes, and other verified spatial contracts —
remain outside its mutation surface. A later structural-authoring phase must derive render geometry,
collision, and dependent interaction/navigation data from one authoritative record before those
systems can be made editable.

The canonical night exterior keeps separate visual and spatial authorities. `Sky` owns the
camera-following star dome, while its complete crystalline Blood Ring is a tracked, world-relative
physical torus added directly to the scene; it does not follow the camera and does not paint a second
sky stripe. `ArrivalGarden` owns a visual-only water shader updated from the existing application
loop, with low-frequency organic motion and a reduced-motion freeze. Neither system adds collision or
another frame loop.

## Resource ownership — `ResourceScope`

Every subsystem that allocates GPU resources does so through a `ResourceScope`:

```ts
const scope = new ResourceScope('E19');
const geo = scope.track(new THREE.BoxGeometry(1, 1, 1));
// …
scope.dispose();          // disposes everything tracked, asserts count === 0
```

`ExhibitHost` creates one scope per exhibit and asserts it drains on unmount. This is what makes the
"memory settles rather than climbs" requirement (Phase 12) testable rather than aspirational.
File-backed `AssetManager` consumers receive separate scene graphs and skeletons. A manager-owned
prototype scope leases shared geometry/materials/textures until the last consumer releases its scope;
consumer cancellation cannot dispose another consumer's resources. Population clones release their
own skeletons, while their scoped prototype leases retain the shared GPU resources.

## Exterior-first residency and interior streaming

| Layer | Contents | Residency |
|---|---|---|
| Exterior world | Island, shoreline, lagoon, paths, woodland, pier, compact museum shell and exterior collision | built and active at cold start |
| Interior layer 1 | Rotunda, wing shells, silhouettes, major lighting, arches and interior collision | dynamically imported and built on entrance demand; retained after first entry |
| Interior layer 2 | Current wing, neighbours and visible entrances | proximity |
| Interior layer 3 | Exhibit payloads and activation-specific geometry | activation radius |

`WorldDirector` coordinates the separate exterior and interior collision/scene roots through the
vestibule threshold. Interior preparation begins only near the entrance; the exterior remains
playable while preparation runs, and leaving the approach cancels the pending handoff. The visible
transition is concealed by the vestibule and commits only after entrance readiness. After first
entry, the interior root may remain resident while its normal dynamics are suspended outside.
`StreamingManager` evaluates interior detail residency once per frame, uses cancellation tokens,
and budgets construction work. Neither manager owns a frame loop; `src/app/Loop.ts` remains the
single loop owner.

## Collision

Capsule player against a static broadphase of axis-aligned boxes and explicit ramp planes, built
alongside the architecture (`CollisionWorld`). Stairs get invisible ramp colliders. No physics engine.
Resolution is iterative depenetration with a grounded check and a grounded one-shot Space jump.
The Rotunda flight pad and development-only free flight retain their separate movement policies.

## Runtime cost: the two numbers that matter

Profiling the finished building in a browser found the two costs that actually
decide whether it runs, and both are now bounded by construction rather than by
discipline:

| Cost | Before | After | How |
|---|---|---|---|
| Draw calls at the entrance | 986 | 253 | `mergeStatic` collapses the static architecture into one mesh per material after detailing. Exhibit mounts and anything flagged `NO_MERGE` are excluded. Collision is recorded during construction, so merging changes only how the building is drawn, never where its walls are. |
| Simultaneous point lights | 31 | ≤ 8 | `Lighting.update(eye)` enables only the nearest few each frame, skipping any light the visitor is outside the falloff of. The sun, sky fill and ambient term are never touched, so the overall light level does not flicker as the budget moves. |

Both are covered by `tests/performance.test.ts`, so a future change that
reintroduces either cost fails the build.

## Quality tiers

`low` / `medium` / `high`, auto-selected at boot from CPU/memory, user-agent and screen signals,
manually overridable in settings. Tiers control device pixel ratio cap, shadow map presence and size,
ambient populations, landscape detail and streaming radii. DPR is capped at 2 on every tier.

`App.setQuality()` propagates to `ExteriorWorld` and rebuilds only the landscape's render-only
vegetation, coastal rocks and flower batches in a reusable child `ResourceScope`. Old instancing
buffers, geometry and materials are released on each change; paths, pier, landmarks, shell and
construction-time physical colliders remain intact. Each tier reproduces its deterministic initial
visual layout. Physical woodland colliders retain the boot tier's original layout during changes.
Ordinary `InstancedMesh` batching and tier-specific geometry detail are active; distance-driven
runtime LOD is not enabled. Wildlife retains its existing bounded capacity and tier counts.

## UI is DOM

Map, journal, deep panels, settings and all reading surfaces are semantic HTML with real focus order.
World-space plaques exist for atmosphere; every one of them has a focusable DOM equivalent
(`accessibility/DomMirror.ts`). This satisfies plan §31 without compromising the environment.
