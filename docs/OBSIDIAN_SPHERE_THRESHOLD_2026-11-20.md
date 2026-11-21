# The Obsidian Sphere — seamless entrance, November 20 2026

Source: owner sketch (green exterior, yellow approach, kiosk, two flanking fountains, central round chamber, rectangular atrium) and approved cinematic concept. This is a **replacement of the entrance journey**, not a new exhibit or separate game.

## Walkable spatial order

1. Arrival across the existing island and plaza, with the existing night environment and paths preserved.
2. Physical ticket kiosk on the approach at (-5.6, 0, 153.5). F/touch the kiosk to print the ticket and invisibly start gallery preparation. A ticket is an admission token, **not** a teleport button. Ticket semantics and existing accessible interaction manager remain.
3. Exterior fountain pair at west (-18.5, 0, 142) and east (18.5, 0, 142). The west basin reuses/upgrades an existing feature; it is not a new third water installation. The west rill and step-over bridge remain.
4. Obsidian spherical chamber centred at z=138, radius 10.2m. Outer aperture roughly z=147.15, inner aperture roughly z=128.85. Dark sphere shell, curved solid lower wall and actual open front/back passage. Solid faceted central obelisk forces a physical walk around its western or eastern flank. Both alternatives are collision-tested with the genuine player controller. Reflective obsidian details, subdued meridians, low floor-guide arc and low-intensity luminous accents brighten as the visitor advances. No separate frame loop, extra network request or overlay.
5. Existing exterior interior coordinate seam at the rear physical doorway z=128 maps to atrium entrance at interior z=162 (34m displacement). It preserves the visitor's motion, facing and interpolation history. The handoff is automatic on a physical crossing, never a screen/button/dialog.
6. Existing 34m × 36m × 20m impossible atrium. It remains mostly dark at arrival: azure "Museum of Me" hologram leads, then its six interior fountains, then walls/banners/ceiling, finally floor. Real visitor walking depth controls the progression; backtracking does not strobe or undo the welcome. Reduced motion switches to a calm stable lit state. The galleries remain beyond the far end.

## Critical interaction contract

- **There is no user-clicked interior loading/entry screen.** The physical kiosk issues tickets. Normal threshold HUD entry buttons are hidden. Any real preparation failure exposes a recoverable, non-modal error, not a fictional success.
- Exterior and interior continue to use the existing WorldDirector state machine and one visible world root at a time; the sphere does not create a third world or teleport pipeline.
- Without a ticket or ready destination, admission still holds at the physical rear seam. A one-time non-modal spoken/subtitled explanation states why; the visitor does not need to click to enter. A slow renderer cannot be magically made ready: avoid false "guaranteed zero delay" claims.
- Geometry follows CollisionWorld. Do not replace the solid column with visual-only scenery or weaken collision/routing tests. The exterior visitor route and Virtual Visitor Jury now follow a genuine arc around the column. Both directions must remain navigable.
- Do not silently change exhibit geometry, 35 exhibit slots, 73 represented identities, six wings, 14 source installation paths, 17 conversations, Dexter Sanctuary, state schemas, dev Workshop, E09, or offline/first-party asset boundaries.

## Evidence and acceptance

- Source implementation: `src/world/exterior/ObsidianSphereEntrance.ts`, `ExteriorWorld.ts`, `ExteriorSignatureFeatures.ts`, `layout.ts`, `WorldDirector.ts`, `Museum.ts`, `InteriorWorld.ts`, `visitorRoute.ts`, `VisitorJury.ts`.
- Unit path and regression: `tests/obsidian-entrance-2026-11-20.test.ts`; original `tests/entrance-aperture.test.ts`, `tests/world-transitions.test.ts`, `tests/exterior-jury*.test.ts`.
- Browser: actual keyboard kiosk F interaction in `tests/browser/cinematic-arrival.e2e.ts`; shared walk-around visitor route in `tests/browser/helpers/obsidian-entrance-walk.ts`; real doorway return/re-entry in `tests/browser/impossible-threshold.e2e.ts`; existing map/DexGPT and predictive tests adjusted.
- Authoritative standard: full CI, production build, offline standalone, Workshop, browser shards, rendered screenshots and representative human device check must pass before public release claims. A successful screenshot or build alone is insufficient.
- On November 20, current development branch is **not** a live Pages release. Do not claim visual acceptance until separately observed.
