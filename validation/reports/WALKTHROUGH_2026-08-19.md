# Full Museum Walkthrough — Runtime Evidence

**Date:** 2026-08-19
**Build:** `feat/foundation`, Phase 13
**Method:** driven in a real browser against the running dev server, stepping the
museum's own `fixedUpdate` / `variableUpdate` / `render` through the real
StreamingManager, InteractionManager and zone resolution.

## What was walked

Every one of the 35 exhibits, visited at its own visitor standing position, with
enough frames at each to let the Layer-3 payload preload and the mount queue
drain at its per-frame budget.

## Result

| Check | Result |
|---|---|
| Exhibits reached and activated | **35 / 35** |
| Uncaught errors | **0** |
| Unhandled promise rejections | **0** |
| Browser console errors | **0** |
| Exhibits with zero registered controls | **0** |
| Exhibits with fewer than 4 paragraphs of interpretation | **0** |
| Distinct wings resolved while walking | **6 / 6** — north, east, south, west, media, infra |

## Defect found and fixed during this walkthrough

**Mezzanine bays resolved to the ground wing beneath them.** Standing in a
north-west mezzanine bay at balcony height reported `west`, and a north-east bay
reported `north`. The ground wings' zone slabs extended vertically past the
balcony floor (their halls are taller than one storey) and laterally far enough
to reach under the diagonal mezzanine wings. Four exhibits — E13, E14, E34, E35 —
therefore never streamed in at all, because streaming is zone-aware.

Zone volumes are now level-aware: a ground wing's volume stops below the upper
floor even where its hall is taller than that. Regression tests added in
`tests/ui.test.ts` assert that every one of the 35 bays resolves to its own wing,
on both levels. Re-walked afterwards: 35 / 35 active, zero errors.

## Visual evidence captured

| View | Confirms |
|---|---|
| Arrival plaza | exterior massing lit and readable, sky gradient, entrance facade signed |
| Vestibule with wayfinding active | floor markers leading north; orientation sign legible |
| South hall | wing palette, pilaster rhythm, bay signage, benches, long sightline through to the Rotunda |
| Reliquary Rotunda | octagonal volume, balcony ring and balustrade, clerestory drum, dome ribs, central orientation installation, wing signage over every arch |
| Rotunda balcony looking north | two-level spatial continuity — both mezzanine signs and the north wing arch visible from one position |
| North wing at E01 | the celestial loom reading as a Tier A installation: suspended ring, star field, threads, world miniatures, four consoles |
| Northwest mezzanine | brass and wood palette, bay openings, an ambient visitor mid-hall |
| Dexter Sanctuary, wide | resting platform under a single shaft from the oculus, benches around the edge, inscription panel. Nothing else in the room. |
| Dexter Sanctuary, close | tricolour Phalène at rest: white ground, black saddle and mask split by a white blaze, plumed tail carried over the back, and the long hanging fringed ears the variety is named for |

## A note on the evidence format

The plan asks for a screen recording. The browser surface available here cannot
capture video, so this walkthrough produced still frames at each of the views
listed above instead, alongside the machine-readable runtime results in the
table at the top. The stills and the runtime results together cover what a
recording would have shown; a human reviewer walking the museum would still be
worth doing before publication.

## Not covered by this walkthrough

- **Absolute frame rate.** The automation surface throttles `requestAnimationFrame`
  and does not synchronise GPU work, so wall-clock render timings taken there are
  noise. Draw calls, triangle counts, active light counts and resident-exhibit
  counts are reliable and are recorded in `OPERATIONAL_STATE.md`.
- **Audio.** Browsers refuse to start an AudioContext without a real user gesture,
  which automation cannot supply. The AudioManager is implemented and typechecked
  but unverified in sound.
- **Pointer lock.** Same reason. The keyboard and touch paths need no lock at all
  and are tested, so no visitor depends on it.
