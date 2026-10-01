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
  ├─ record raw wall-clock frame interval; clamp simulation dt to 0.1 s after a tab restore
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
`Loop.frameTimeMs` retains the uncapped wall-clock interval for diagnostics and quality adaptation;
only the simulation delta is capped. `App.variableUpdate()` ignores hidden-page intervals and pauses over
1,000 ms when feeding `QualityGovernor`, so restoring a background tab cannot trigger a false quality
downgrade. Rendering interpolates between fixed states.

## Module layout

```
src/
  app/          App, Loop, Diagnostics, Bootstrap        ← owns the frame
  render/       RendererHost, QualityTiers, Lighting
  world/        Museum geometry, wings, Rotunda, Sanctuary, CollisionWorld
  player/       PlayerController, capsule collision, input actions
  interaction/  InteractionManager, focus raycast, verbs (inspect/manipulate/…)
  exhibits/     ExhibitHost, registry, 35 modules by wing
  assets/       AssetManager, manifest, ResourceScope, procedural generators
  audio/        AudioManager, zones, synthesised ambience (muted by default)
  content/      generated collection (64 projects, 35 exhibits)
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

## Static bake — interning, then merging

`src/world/MergeStatic.ts` owns two passes that run once, before the first render:

- `internMaterials(root, scope)` replaces every mesh material with a canonical
  instance that is *provably identical*. Two materials fuse only when
  `materialKey()` can describe every own property that affects a draw —
  textures by identity, colours by component, vectors and matrices by element.
  Any property it cannot describe exactly (a `ShaderMaterial`, an
  `onBeforeCompile` override, a custom program cache key, an opaque object)
  makes that material ineligible rather than approximately equal. Interning
  therefore cannot change what a single mesh renders; it only lets two meshes
  share one uniform block. Replacements are `untrack`ed from the scope.
- `mergeStatic(root, scope)` collapses static geometry into one mesh per
  material. It normalises the index buffer first, because a material group that
  mixed indexed and non-indexed geometry used to make `mergeGeometries()`
  reject the whole group silently — the meshes in it kept their draw calls and
  nothing reported the loss.

`bakeStatic()` runs both, in that order, because merging groups by material
identity and the museum builds hundreds of value-identical material instances.
Three callers own the decision to bake: `Museum.build()`,
`PersistentEnvironment.build()` and `ArrivalGarden.build()`. Each runs after
construction and before render for geometry that is not subsequently transformed
or material-mutated. Groups are split by material *and* cast/receive shadow
flags, so a merged mesh keeps its sources' flags rather than inventing or
removing shadows.

The current paired offline profiles report **2,151 → 1,385 scene meshes**
(−35.6%) and **1,698 → 1,067 live Three.js geometries** (−37.2%). This is the
whole scene after boot, not an isolated bake-only unit measurement. The bake
preserves source geometry/material values, but it changes object-level draw
sorting. Alpha-blended surfaces can be order-sensitive even with identical
materials; automated tests do not prove pixel-identical output, so the dome,
clerestory and exterior identity panels still require human visual review. Mark
an order-sensitive subtree `NO_MERGE` if that review finds a real regression.
Larger merged bounds also reduce fine-grained frustum culling: in the upward Rotunda-dome composition, submitted
triangles rose **35,500 → 41,310 (+16.4%)** even as draw calls fell **79 → 72**
and measured software-renderer rAF p50 fell **400.3 → 160.2 ms**. Thus a lower
draw count is not a claim that every view submits fewer triangles; current
profile evidence is in `validation/metrics/runtime-profile-before.json` and
`runtime-profile.json`.

**What must never be baked.** A merged mesh has no transform of its own left to
move and no individual geometry left to raycast, so two kinds of object are
excluded by construction:

- anything the `InteractionManager` has registered — the `userData.interactive`
  flag it already sets is the exclusion, so the focus raycast keeps working;
- anything marked `NO_MERGE` with `protectSubtree()`. `PersistentEnvironment`
  and `ArrivalGarden` apply it to every Workshop-authorable root, because the
  development editor attaches a transform gizmo to each of those objects by
  identity.

Everything with a per-frame `update()` — `Wayfinding`, `FlightPadAtmosphere`,
`Sky`, the source installations, the source visitors, the supplementary cases,
the Sanctuary, ambient visitors and every exhibit — stays outside the bake.

## Shadows are drawn on demand

`RendererHost` sets `renderer.shadowMap.autoUpdate = false` and redraws the map
only when the set of shadow casters can have changed: at boot, on a quality
tier change, on WebGL context restore, and once after the authored Workshop
placements land. This is sound because the museum's geometry is explicit about
casting: `GeometryKit` builds all architecture with `castShadow = false`, and
the authored casters are the environment/wing dressing, arrival-garden dressing,
exterior identity panels and Workshop placements — none of which moves. The museum
therefore does not pay a second full scene traversal and a 2048² depth pass on
every frame to redraw a map that cannot have changed.

If a future system adds a moving shadow caster, it must call
`renderer.requestShadowRefresh()`; the alternative is a visibly stale shadow. The paired runtime
profile starts at the `low` quality tier (`shadows: false`), so it does **not** measure a shadow-map
performance delta; current evidence for this path is code/tests, not the reported frame-time gain.

## Adaptive quality — `QualityGovernor`

The initial tier comes from `detectQualityTier()`, which reads
`hardwareConcurrency`, `deviceMemory` and screen width. Those three signals are
frequently wrong in both directions on real devices, and blind to whatever else
the machine is doing, so they are treated as a **ceiling** rather than a
verdict. `QualityGovernor` watches the real frame durations the loop reports and
steps the tier down after two consecutive evaluation windows whose rolling p95 frame time
exceeds 21 ms, and back up — never above the boot ceiling — only after four
evaluations below 14.5 ms, with evaluations every three seconds, a ten-second
cooldown and a settle zone between the two thresholds. Each p95 uses up to 240
recent frame samples, not a fixed-duration time percentile. It is disabled entirely when the visitor pins a tier by hand, it
is fed only while the frame rate is uncapped (a 30 fps cap would make a healthy
machine look slow), and it never writes preferences, so "Automatic" stays
automatic across visits. `tests/quality-governor.test.ts` exercises threshold windows, cooldown,
ceiling and reset behavior with synthetic traces. The current offline profile starts at its boot
ceiling (`low`) and records zero tier changes; an actual governor downshift on representative
hardware is not claimed.

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

## Streaming — three layers, no loading screens

| Layer | Contents | Residency |
|---|---|---|
| 1 — Museum proxy | Rotunda, wing shells, silhouettes, major lighting, arches, exterior | always resident |
| 2 — Wing detail | current wing + neighbours + visible entrances | proximity |
| 3 — Exhibit payload | hero objects and exhibit-specific geometry | activation radius |

`StreamingManager` evaluates residency once per frame from player position, enqueues work with
cancellation tokens, and budgets how much construction may happen per frame so streaming never
produces a hitch. Because Layer 1 is always resident, the visitor never sees a level transition.

## Collision

Capsule player against a static broadphase of axis-aligned boxes, floors and explicit ramp planes,
built alongside the architecture (`CollisionWorld`). Stairs get invisible ramp colliders. No physics
engine. Resolution is iterative depenetration with a grounded check; Space provides a grounded
one-shot jump, while the rotunda flight pad is a separate location-triggered flight mode.

## Runtime profile and cost evidence

`npm run build:standalone && npm run profile` boots the exact standalone HTML offline in Chromium and
writes `validation/metrics/runtime-profile.json`. The paired `runtime-profile-before.json` was built
from Git HEAD `901ec91496f533638c978a3846bd3ea0c7914f48` without switching this working branch. Both
profiles use Chromium 131 / ANGLE Vulkan SwiftShader, WebGL2, DPR 1, offline `file://`, a 640×360
viewport, low quality, and 45 rAF samples per view. The fixed positions/yaw are recorded, and each
view asserts the expected `app.currentZone`.

| View | Draw calls, before → candidate | Triangles, before → candidate | rAF p50, before → candidate |
|---|---:|---:|---:|
| Arrival Plaza, facing entry | 3,275 → 1,081 (−67.0%) | 218,988 → 120,696 (−44.9%) | 916.8 → 445.9 ms (−51.4%) |
| South vestibule, facing Rotunda | 3,154 → 1,035 (−67.2%) | 213,588 → 115,996 (−45.7%) | 1,176.7 → 560.0 ms (−52.4%) |
| Rotunda floor, facing north | 1,548 → 520 (−66.4%) | 137,292 → 82,662 (−39.8%) | 1,135.4 → 571.9 ms (−49.6%) |
| Rotunda centre, looking up | 79 → 72 (−8.9%) | 35,500 → 41,310 (+16.4%) | 400.3 → 160.2 ms (−60.0%) |

These are measured in **CPU-rasterized SwiftShader**, not representative-device FPS. `rAF p50`
includes renderer/browser/software-raster work; it is not a GPU timer. Application callback totals
and renderer-submit call durations are reported separately in the JSON. The environment did not
expose `EXT_disjoint_timer_query_webgl2`, so GPU execution time is `UNKNOWN`. The 1% and 0.1% tail
fields are included, but at 45 samples they are order statistics (effectively the maximum), not
stable device percentiles. Increase `PROFILE_FRAMES` for better 1% sampling; a 0.1% tail needs many
more frames than this offline profile collects.

Whole-scene boot counters were 2,151 → 1,385 meshes (−35.6%), 1,698 → 1,067 live renderer geometries
(−37.2%) and 87 → 86 textures. Shader compile calls were 98 → 60. These are profile counters, not
GPU memory bytes. `performance.memory` is coarse; the run's start/end delta is not a reliable heap
measurement. Startup, HTML image `src`-to-load events, buffer/texture upload call timings, streaming,
and quality state are also in the snapshots with their measurement limits documented inline.

A same-artifact control isolates the Blood Ring's transmission switch. With the candidate artifact
unchanged, a diagnostic runtime override from transmission 0 to 0.03 changed Rotunda counts from
520 to 996 draw calls (+91.5%) and rAF p50 from 571.9 to 1,321.6 ms (+131.1%) in this same
SwiftShader setup. Arrival Plaza, vestibule and dome controls are recorded in
`runtime-profile-transmission-control.json`. This is evidence of added submissions in this software
backend, **not** proof of the visual difference or a real-device slowdown. The shipped Ring keeps
its red emissive facets and clearcoat; a human still owns visual acceptance.

The paired files identify each standalone build by SHA-256 and are summarized with limitations in
[`validation/reports/QUALITY_UPLIFT_2026-10-01.md`](../validation/reports/QUALITY_UPLIFT_2026-10-01.md).
They measure the combined candidate changes; do not attribute every before/after delta to one code
change. The transmission control is the separate isolated experiment.

The Light director still enforces a maximum of eight managed point lights at once (`tests/performance.test.ts`),
but this profile pass does not claim an isolated before/after benefit for that cap. The static-shadow
map change is likewise not exercised by this low-quality profile because low quality disables
shadows.

## Quality tiers

`low` / `medium` / `high` are initially selected from `hardwareConcurrency`, `deviceMemory`, screen
width and mobile user-agent signals; this is **not a GPU benchmark**. The initial tier is treated as
a ceiling. `QualityGovernor` observes uncapped visible-tab wall-clock frame times and can step down
after sustained p95 over-budget windows; recovery takes longer and never exceeds the ceiling. A
visitor-pinned tier disables adaptation. Tiers control DPR cap, shadow-map presence/size, detail and
streaming radii, and ambient population. DPR is capped at 2. The governor's synthetic tests pass,
but the current offline profile starts at low and shows zero tier changes; a representative-device
downshift is not claimed.

## UI is DOM

Map, journal, deep panels, settings and all reading surfaces are semantic HTML with real focus order.
World-space plaques exist for atmosphere; every one of them has a focusable DOM equivalent
(`accessibility/DomMirror.ts`). This satisfies plan §31 without compromising the environment.
