# Entrance atrium, ticket kiosk and impossible reveal (2026-11-20)

Owner requests: an atrium at the entrance; a kiosk where the visitor takes a
ticket instead of pressing "Enter the museum", with the loading hidden behind
that interaction; an impossible reveal; a floating "Museum of Me" hologram in
azure; a dark blue / sky blue palette; fountains down the sides; and an atrium
that waits in the dark and lights up in order as the visitor steps in.

## What a visitor experiences

1. **Arrival.** The welcome title is no longer a modal dialog and has no Enter
   button. It reads "Walk up to the doors and take a ticket at the kiosk", and
   fades on the first step, turn, pointer lock or Escape. "Browse the
   collection" remains.
2. **Kiosk.** A bronze admissions kiosk with a lit "Tickets" blade stands on the
   forecourt just right of the doors (`TICKET_KIOSK_POSITION`, [5.6, 0, 137.5]).
   Press F (or tap the reticle) on it: a ticket slides out, its screen changes to
   "Admit one", and a ticket card appears in the HUD with its number and the
   date. **Taking the ticket starts the interior's preparation**, so the
   galleries load while the visitor walks the last few metres. The threshold
   panel's button is now "Take a ticket": the same action, for visitors who
   prefer a button. It does not bypass the ticket.
3. **Doors.** Without a ticket, the doorway holds the visitor and says
   "Admission is by ticket. Take one from the kiosk beside the doors." With one,
   it admits them once the entrance is ready, as before.
4. **Impossible reveal.** Seen from outside, the doors open on a foyer 6 m deep
   (the exterior vestibule buffer). Step through and you stand in a hall 34 m
   long, 36 m wide and 20 m high. The interior door is at z = 162 while the
   exterior door is at z = 128 (`SEAM_OFFSET_Z` = 34). A plaque inside the door
   names it: the museum is larger inside than the building that holds it.
5. **Light-up.** The atrium waits nearly black. On entry it lights in sequence:
   - 0 s: the hologram (azure lettering, halo, projection beam, star motes);
   - 1.4 s: the six fountains;
   - 2.8 s: the sides (walls, ceiling, colonnade, skylight, wing banners, plaque);
   - 4.4 s: the floor and runner.

   It returns to dark when the visitor leaves the museum. Reduced motion lights
   it at once and keeps the hologram and water still.
6. **Atrium.** Deep blue walls with sky-blue piers, coffers and runner. Six wing
   banners hang in each wing's accent colour. Fountains (three per side) have
   solid basins. "Museum of Me" floats mid-room at 10.5 m, above the inner
   portal, readable from both ends.
7. **Exit.** Walk out of the atrium's front door (interior z > 162) and you are
   back outside the exterior door (z ≈ 128), facing the island.

## Implementation

| Area | File |
| --- | --- |
| Atrium constants, `SEAM_OFFSET_Z`, `ATRIUM_DOOR`, `INTERIOR_ENTRY_POSITION`, kiosk position, zone label "Entrance Atrium" | `src/world/layout.ts` |
| Atrium architecture, banners, plaque, hologram, fountains, light-up sequence (`updateAtrium`, `resetAtrium`) | `src/world/Museum.ts` |
| Light-up driven per frame; reset on leaving | `src/world/InteriorWorld.ts` |
| Facade dressing moved to the atrium front door | `src/world/EnvironmentDressing.ts` |
| Seam offset on door crossings only (`commitToInterior(true)` / `switchToExterior(true)`); ticket gate; new exit test | `src/app/WorldDirector.ts` |
| `PlayerController.shift`: moves position and interpolation origin together (no streak frame) | `src/player/PlayerController.ts` |
| Kiosk (core modules only: keeps the exterior cold boot free of the exhibit chunk) | `src/world/exterior/TicketKiosk.ts`, `ExteriorWorld.ts` |
| `App.ticket`, `issueTicket()`, `dismissArrival()`, ticket card | `src/app/App.ts` |
| "Take a ticket" button, ticket card | `src/ui/HUD.ts`, `src/ui/museum.css`, `src/app/UILayer.ts` |
| Non-modal welcome | `src/ui/CinematicArrival.ts`, `src/ui/cinematic-arrival.css` |
| Map draws the atrium; routes run on to the atrium door | `src/ui/MapPanel.ts`, `src/world/visitorRoute.ts` |

Programmatic callers (`switchToInterior()`, Workshop, tests calling
`commitToInterior()` with no argument) keep their coordinates; only a walked
door crossing applies the seam offset.

`?qa=1` and `?edit` sessions start holding a ticket, so automated walks are
not blocked. Tests set `app.ticket = null` to exercise the gate. The ticket
number is random per session; nothing new is persisted.

## Tests

- `tests/entrance-aperture.test.ts`: exit through the atrium door; the ticket
  gate holds without a ticket; the seam offset applies on entry and on exit.
- `tests/world-transitions.test.ts`: the phase sequence is unchanged, with
  atrium coordinates.
- `tests/continuity-uplift-2026-11-20.test.ts`, "entrance atrium":
  - walk from the atrium door into the south hall;
  - walls and fountain basins collide;
  - entrance guidance targets the atrium door;
  - dark → lit → reset light-up.
- `tests/browser/cinematic-arrival.e2e.ts`: no Enter button, and walking
  dismisses the title. Also checks that admission is by ticket in the real
  app.
- Updated for the new entrance:
  - browser tests: `continuity-uplift`, `visitor-menu`, `predictive-interior`, `impossible-threshold`;
  - scripts: `runtime-source-qa`, `standalone-offline-browser`.

## Not changed

- 35 slots / 73 identities / 6 wings.
- Exhibit content.
- Persistence schemas.
- The single frame loop.
- No new dependency or network request.
- Exhibit and wing interiors.
