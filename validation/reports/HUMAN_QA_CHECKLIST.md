# Museum of Me vNext — Human QA Checklist

This checklist is intentionally human-only. Completing automated tests does not satisfy it.

## Capture setup

Use the production build on the representative device:

```bash
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/?qa=1` for the recording pass. `?qa=1` does not change museum behavior; it only opens the existing read-only diagnostics overlay automatically. The overlay records FPS/1% low, draw/triangle/resource counts, current zone/position, quality tier, interaction-control count, audio running state, pointer-lock state, pending loads, and the nearest/current exhibit. Backtick still toggles the overlay manually.

Keep the overlay visible for the performance checkpoints and pointer-lock/audio state transitions. Hide it when it obstructs a composition judgment. Overlay state is supporting evidence only: `audio on` does not prove sound was audible, and `pointer locked` does not prove mouse-look feel or recovery quality.

## Recording route

- [ ] Begin at the real exterior spawn and record the garden-facing museum composition.
- [ ] Walk the central garden path and verify no furnishing clips or blocks the entrance.
- [ ] Enter through the vestibule and verify the bright neutral transition reads cleanly.
- [ ] Circle the Rotunda and balcony; verify the centre stays neutral while all six route threads are legible.
- [ ] Visit North, East, South, West, Media and Infrastructure; inspect threshold identity, atmosphere and wing-specific furnishings.
- [ ] Enter at least one early, middle and late exhibit bay in each wing; confirm colour fields frame rather than overpower bespoke hero objects.
- [ ] Walk to Dexter Sanctuary and back without teleport or route confusion.
- [ ] Return to the exterior entrance.

## Device interaction

- [ ] Capture pointer lock with mouse and with keyboard activation of the entry prompt; record the overlay changing from `pointer free` to `pointer locked`.
- [ ] Verify mouse look, Q/E turn and Page Up/Page Down vertical keyboard look.
- [ ] Press Escape or otherwise lose pointer lock; verify controls recover cleanly and recapture works, with the overlay returning to `pointer locked` after recapture.
- [ ] Open Map, Journal, Settings and accessible contents using keyboard only; verify focus stays inside panels and returns on close.
- [ ] Toggle reduced motion, high contrast and interface scale; verify each change is immediately visible/operative.
- [ ] Confirm touch fallback on a touch-capable device when available.

## Audio and performance

- [ ] Hear each wing ambience and at least one exhibit audio event; use the overlay's `audio on` state only to confirm the engine believes audio has started.
- [ ] Verify subtitles correspond to audible museum speech/audio cues.
- [ ] Record FPS and 1% low from the overlay on a representative device during exterior, Rotunda, a dense wing and a Tier A exhibit.
- [ ] Watch for monotonic memory/resource growth during a long traversal if browser tooling is available; the overlay's geometry/texture/residency counts can provide a quick visible sanity check.

## Visual acceptance

- [ ] Daylight is bright but not washed out.
- [ ] Facade overlays align with the entrance mass and do not look pasted on.
- [ ] Rotunda reads luminous rather than sterile.
- [ ] Wing furnishings add identity without clutter or blocked sightlines.
- [ ] Exhibit colour fields support content rather than competing with it.
- [ ] No visible voids, z-fighting, clipping, broken transparency or obvious texture/geometry failure.
