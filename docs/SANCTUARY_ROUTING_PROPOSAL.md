# Proposal — "Guide me to the Dexter Sanctuary"

**Status: PROPOSED. Owner decision pending. Nothing in this document is implemented.**
Written 2026-11-09 during completion pass 2.

## What a visitor gets

Asking DexGPT "where is Dexter?" or "take me to the Sanctuary" already explains where the room is.
With this change the answer also offers one button, *Show me the way to the Sanctuary*, which draws the
same low floor line the museum already uses for exhibits. The line leads to the ramp threshold on the
northwest side of the Rotunda, then down the ramp, and removes itself on arrival.

## Rules it keeps

- The Sanctuary stays outside the 35 exhibits and outside the project mapping.
- No visited mark, no journal entry, no count, no "next unvisited" candidate, no Visit Thread stop.
- No teleport. The cue is a line on the floor, exactly as for exhibits.
- DexGPT stays distinct from Dexter; the reply text does not change voice.
- One navigation authority: `src/world/Wayfinding.ts`. No second system.

## Why it is not already possible

`Wayfinding.setTarget(exhibitId)` only accepts an exhibit: it looks up `PLACEMENT_BY_EXHIBIT` and the
wing threshold, and returns to "no target" for anything else. `UILayer.mapGuide(id)` writes the same id
to the map highlight and to `journal.setGuideTarget({ kind: 'exhibit', id })`. `GuideAction` carries
only an `exhibitId`. The Sanctuary has none of these, by design.

## Exact integration points

1. `src/world/Wayfinding.ts` — add `setPlaceTarget(place: { id: string; threshold: Vec3; destination: Vec3 })`.
   It fills the three existing private fields (`targetThreshold`, `targetDoorway`, `targetDirection`)
   from the supplied points and reuses `updateXYZ` unchanged. `currentTarget` returns the place id.
   The two points already exist in `src/world/route.ts` as the canonical route's
   `sanctuary threshold` (`place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM + 2, 0, GROUND_Y)`) and
   `dexter sanctuary` (`SANCTUARY_CENTER` at `SANCTUARY_FLOOR_Y`); export them as one constant rather
   than restating coordinates.
2. `src/guide/DeterministicMuseumGuide.ts` — widen `GuideAction` to
   `{ kind: 'guide'; exhibitId } | { kind: 'place'; placeId: 'sanctuary'; label }` and return the place
   action from `aboutDexter()` only.
3. `src/ui/MuseumGuidePanel.ts` — pass the whole action to its callback instead of `action.exhibitId`.
4. `src/app/UILayer.ts` — add `guidePlace('sanctuary')` beside `mapGuide`: calls
   `wayfinding.setPlaceTarget`, clears the map's exhibit highlight, does **not** call
   `journal.setGuideTarget` (its `GuideTargetRef` kinds stay as they are, so the persisted journal
   schema and its version do not change), and announces: "A line on the floor points the way to the
   Sanctuary. Nothing is expected of you there."
5. Tests — `tests/guide.test.ts` (action present for Dexter questions, absent elsewhere; journal
   untouched), a `Wayfinding` unit test (threshold stage then ramp stage, clears on arrival), and one
   Chromium case reusing the existing guide scenario.

Estimated change: four source files, about 60 lines, no data or save-format change.

## Known limits to accept or reject

- The floor line is planar. From the upper level it points toward the threshold but does not route
  down the stairs first. Exhibit wayfinding has the same limit today.
- The arrival radius is 3.5 m, so the line stops at the Sanctuary floor before the visitor reaches
  Dexter. That is the intended behaviour: it leads to the room, not to him.

## What needs an owner decision

- Whether a wayfinding cue toward the Sanctuary is in keeping with "nothing to collect and nothing to
  complete", or whether the room should stay something a visitor finds unaided.
- The button wording and the arrival announcement.
