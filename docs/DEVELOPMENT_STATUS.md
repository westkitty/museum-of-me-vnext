# Museum of Me — Development Status

**Current status: ACTIVE DEVELOPMENT / PRE-1.0**

This file exists because earlier repository history incorrectly promoted the project to a `v1.0.0` / release-ready state.

## Controlling correction — 2026-09-03

The project owner explicitly corrected that milestone claim:

- Museum of Me has **not** reached 1.0.
- The branch name `release/v1.0.0`, PR #1 title, and merge commit title `Release v1.0.0 — Museum of Me vNext` are historical records of an AI-created milestone interpretation, not current product authority.
- The code integrated by those commits remains useful development work and is not being rolled back merely because the milestone label was wrong.
- Automation that passed on those commits remains evidence about the tested code paths. It is **not** evidence that the museum as a product had reached 1.0 maturity.
- No GitHub Release object exists for this repository as of the correction.
- `package.json` remains version `0.1.0`, which is consistent with the corrected pre-1.0 project state.

## Current development baseline

The latest integrated code on `main` is the starting implementation baseline. New work is being developed on bounded development branches and must preserve known-good traversal, collision, resource ownership, accessibility, offline behavior, Workshop conservation, authored visitor conversations, source-installation paths, Dexter Sanctuary boundaries, and the deferred local Full Weasel integration unless a later owner decision explicitly changes one of those contracts.

The first post-correction development branch is:

`development/collection-revision-2-2026-09-03`

Its purpose is to bring the museum's collection and exhibit interactions closer to the projects that actually exist now.

## Collection policy after the correction

The building keeps **35 stable physical exhibit slots** across six wings. The represented project inventory is no longer frozen at the 64 identities known on 2026-08-19.

- `data/exhibit-mapping.json` is preserved as the historical 2026-08-19 collection snapshot.
- `data/exhibit-mapping.current.json` governs the current development collection when present.
- New projects may become the primary subject of an existing exhibit while older projects remain as lineage inside that exhibit.
- Project identities remain mapped exactly once in the current collection so interpretation does not silently duplicate a project across wings.
- Dexter remains outside the project mapping.
- A rotating **NOW BUILDING** surface may show current work without turning unfinished experiments into permanent collection entries.

## What 1.0 will mean later

There is no automatic date or branch name that makes this project 1.0. A future 1.0 decision should be made deliberately after the museum has reached a level the owner considers substantially complete, including the quality of its physical spaces, exhibit interactions, collection accuracy, visitor experience, visual presentation, representative-device behavior, and any remaining major design ambitions.

Passing automation is required evidence for code health. It is not, by itself, the definition of product completion.
