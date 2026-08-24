# Architecture

## Stack

TypeScript · Vite 6 · vanilla Three.js 0.185.0 · semantic DOM UI · Vitest · Playwright.

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
```

Dependency direction is strictly downward: `exhibits` may import from `assets`, `interaction`,
`content`, `audio`. Nothing imports from `exhibits` except the registry. Nothing outside `app`
imports `Loop`.

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

Capsule player against a static broadphase of axis-aligned boxes and explicit ramp planes, built
alongside the architecture (`CollisionWorld`). Stairs get invisible ramp colliders. No physics engine.
Resolution is iterative depenetration with a grounded check; no jump.

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

`low` / `medium` / `high`, auto-selected at boot from a short GPU probe, manually overridable in
settings. Tiers control device pixel ratio cap, shadow map presence and size, ambient particle
counts, and Layer-2 streaming radius. DPR is capped at 2 on every tier.

## UI is DOM

Map, journal, deep panels, settings and all reading surfaces are semantic HTML with real focus order.
World-space plaques exist for atmosphere; every one of them has a focusable DOM equivalent
(`accessibility/DomMirror.ts`). This satisfies plan §31 without compromising the environment.
