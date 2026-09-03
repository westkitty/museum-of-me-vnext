# Museum of Me vNext — Human QA Checklist

This checklist is intentionally human-only. Completing automated tests does not satisfy it.

## Capture setup

Use the current candidate on the representative device. Record the branch and exact commit (or
the dirty working-tree state) before starting. For a committed release candidate:

```bash
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/?qa=1` for the recording pass. `?qa=1` does not change the museum world or visitor behavior. It opens two evidence aids:

1. the existing read-only diagnostics overlay, showing FPS/1% low, draw/triangle/resource counts, current zone/position, quality tier, interaction-control count, audio-engine state, pointer-lock state, pending loads, and the nearest/current exhibit;
2. the **QA evidence** recorder, where the human tester manually marks the remaining perceptual/device checks, captures telemetry snapshots at meaningful locations, records notes, and generates a Markdown evidence report.

The QA recorder is intentionally session-only: it does not persist checkmarks, alter the journal/preferences, or decide any pass/fail state automatically. Generate the Markdown report before closing or refreshing the page and preserve it with the screen recording as the human evidence record.

Keep diagnostics visible for the performance checkpoints and pointer-lock/audio state transitions. Hide or collapse evidence UI when it obstructs a composition judgment. Telemetry is supporting evidence only: `audio on` does not prove playback was audible, `pointer locked` does not prove mouse-look feel or recovery quality, and an FPS number from non-representative hardware is not release performance evidence.

## Recording route

- [ ] Begin at the real exterior spawn and record the intentional night composition, readable dark facade, azure accents and garden-facing museum composition.
- [ ] Walk the central garden path and verify no furnishing clips or blocks the entrance.
- [ ] Enter through the vestibule and verify the neutral transition reads cleanly.
- [ ] Circle the Rotunda and balcony; verify the centre stays neutral while all six route threads are legible.
- [ ] Visit North, East, South, West, Media and Infrastructure; inspect threshold identity, atmosphere and wing-specific furnishings.
- [ ] Enter at least one early, middle and late exhibit bay in each wing; confirm colour fields frame rather than overpower bespoke hero objects.
- [ ] Inspect the Blood Ring from representative exterior viewpoints: scale, world-relative placement, crystalline/vitrified material, depth/refraction and readability.
- [ ] Inspect island shoreline and water for seams or horizon artifacts; confirm movement is restrained and believable. Confirm searchlight/flood lighting does not overwhelm the architecture.
- [ ] Inspect Quaternius ambient visitors for scale, floor contact, materials, animation and placement; keep them distinct from the 17 authored source visitors.
- [ ] Open E27 / The Full Weasel; verify it opens and plays usefully, and Escape closes it without breaking Museum input.
- [ ] Use DexGPT after entry; verify wording/presentation, existing wayfinding routing, and distinction from Dexter.
- [ ] Walk to Dexter Sanctuary and back without teleport or route confusion.
- [ ] Verify the Sanctuary threshold, approach and readable `STINK WEASEL DEN` sign; Dexter remains non-mascotized.
- [ ] Return to the exterior entrance.

Capture QA-recorder telemetry snapshots at minimum at the exterior spawn, Rotunda, one dense wing, one Tier A exhibit, Dexter Sanctuary, and the final return to the entrance.

## Device interaction

- [ ] Capture pointer lock with mouse and with keyboard activation of the entry prompt; record diagnostics changing from `pointer free` to `pointer locked`.
- [ ] Verify mouse look, Q/E turn and Page Up/Page Down vertical keyboard look.
- [ ] Press Escape or otherwise lose pointer lock; verify controls recover cleanly and recapture works, with diagnostics returning to `pointer locked` after recapture.
- [ ] Verify normal first-person movement, flight-pad affordance/launch/landing, and the curved grand stairs' visual smoothness and ascent/descent feel.
- [ ] Open Map, Journal, Settings and accessible contents using keyboard only; verify focus stays inside panels and returns on close.
- [ ] While a semantic UI control has keyboard focus, verify Enter/Space operates that control without also interacting with or jumping in the 3D museum behind it.
- [ ] Toggle reduced motion, high contrast and interface scale; verify each change is immediately visible/operative.
- [ ] Confirm touch fallback on a touch-capable device when available.

## Audio and performance

- [ ] Confirm Overall volume and Ambience begin at zero; entry, pointer-lock changes, interaction, and zone transitions produce no audible sound until a visitor raises them.
- [ ] Raise the Sound controls deliberately and verify opted-in ambience/reactive audio and subtitles behave as expected.
- [ ] Record FPS and 1% low from diagnostics on a representative device during exterior, Rotunda, a dense wing and a Tier A exhibit; CI software WebGL is not performance evidence.
- [ ] Watch for monotonic memory/resource growth during a long traversal if browser tooling is available; geometry/texture/residency counts provide a quick visible sanity check.

## Visual acceptance

- [ ] Facade overlays align with the entrance mass and do not look pasted on.
- [ ] Rotunda reads luminous rather than sterile.
- [ ] Wing furnishings add identity without clutter or blocked sightlines.
- [ ] Exhibit colour fields support content rather than competing with it.
- [ ] Starsilk areas read black/deep-blue/azure rather than generic purple science fiction.
- [ ] No visible voids, z-fighting, clipping, broken transparency or obvious texture/geometry failure.

## Workshop — development QA only

Run separately with the Vite development server at `?edit=1`. Do not treat this as production visitor QA.

- [ ] Workshop starts closed with the normal museum active; visible `BUILD MODE` control is present and `F8` remains a secondary toggle.
- [ ] Entering Build Mode releases pointer lock, freezes visitor movement, owns UI capture, suppresses the ordinary entry prompt, and enables TransformControls.
- [ ] Transform controls, current keyboard shortcut help, safe placement save/reload and protected-placement rejection behave correctly.
- [ ] Leaving Build Mode returns ordinary Museum input cleanly; production build does not expose the authoring UI or write path.

## Evidence closure

At the end of the pass:

- [ ] Every QA-recorder item is marked **Pass** or **Needs work**; no item is left Pending by accident.
- [ ] The generated Markdown report includes the device/browser details in Notes and the required telemetry snapshots.
- [ ] Any **Needs work** item names a concrete location and observed failure rather than a vague impression.
- [ ] Preserve the generated report together with the screen recording before making a release decision.
