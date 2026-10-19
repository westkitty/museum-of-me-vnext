# Museum of Me — Visual Direction (Pre-1.0)

**Status:** Accepted visual direction, implemented in a bounded scene-wide pass; human visual acceptance remains **UNKNOWN / UNVERIFIED**. This document does not declare a version 1.0 or a commercial-quality finish.

## Thesis

**An inhabited reliquary, not a neon tech demo.** The real first-person museum is an architectural archive of working projects, with a bright, intentional neutral Rotunda, six legible wing identities, earned technological accents, and a quiet Dexter Sanctuary outside the 35 exhibits. The geometry, collections, interaction contracts, traversal, and source-installation semantics outrank decorative ambition. Museum-wide styling should frame authored exhibits rather than replace their hero objects.

## Spatial colour and light

- **Rotunda/balcony:** limestone white with restrained warm gilt; preserve the neutral baseline and open sightlines to all six routes. Three *blind lower-wall faces only* may display the archive compass; the NW Dexter threshold and every wing opening remain clear.
- **North / Starsilk & Drakken:** obsidian, midnight blue, restrained azure. No generic purple science-fiction styling.
- **East / Dex systems:** blue slate, teal and cyan.
- **South / games and play:** russet, coral and warm amber.
- **West / archive and canon:** ink-plum and muted rose.
- **Media:** ochre, bronze and warm gold.
- **Infrastructure:** forest, moss and restrained mint.
- **Plaza:** monumental dark entrance against authored night sky, island and Blood Ring; stay visually separate from the interior's white baseline.
- **Sanctuary:** quiet, material-rich and distinct; never mascotize Dexter or count the Sanctuary as a 36th exhibit.

The existing RoomEnvironment/ACES renderer remains authoritative. `AtmosphereDirector` uses the **existing Fog object** and tone-map exposure for subtle wing-dependent atmospheric transitions. It does not add lights, post-processing, a camera rig, gameplay motion, or a frame loop. Reduced motion must disable visual interpolation.

## Surface and detail grammar

- `src/world/SurfaceFinish.ts` supplies a **single resource-owned, deterministic, locally generated 128×128 tileable mineral finish** per ResourceScope. No CDN, licensed texture, lookup, or additional mesh call.
- Apply the finish to architectural floors/walls/ceilings and the backdrops/floors of all 35 galleries. Maintain the original `PaletteSet` colour families and the legible difference between Rotunda and themed wings.
- Broad, saturated corridor carpets read as placeholder geometry. Keep walkable runner dimensions and collision intact but use a darker, mineral-tinted surface with thin color-coded signal rails at the edges.
- Use **material-only, shallow architectural relief** on *three existing blind Rotunda walls*, clear of circulation, threshold apertures, sanctuary approach and sightlines. Never introduce a decorative barrier.
- All 35 gallery backdrops retain their source-derived theme, existing bounds, installed hero objects and interaction volumes. The four fine witness marks per gallery share **one instanced draw** (140 instances), rather than 140 static draw calls.
- Reuse the existing museum's sculptural furnishing and framing grammar; extra props should answer a composition problem, not fill empty space indiscriminately.

## HUD / overlays

Use charcoal mineral surfaces, warm brass hierarchy, restrained cyan for active focus, and larger, explicit touch targets. Interactions stay semantic and keyboard-operable. Reduced transparency, high contrast, forced colours, reduced motion, accessible contents and the one-time cinematic arrival remain authoritative. The HUD must not camouflage important gameplay cues with ornament.

## Engineering limits

- ONE render-loop owner, ONE WebGLRenderer, no newly introduced post-processing chain.
- ZERO new real-time scene lights from decorative refinements.
- Reuse textures, geometry and managed `ResourceScope` disposal.
- Preserve adaptive renderer tiers, fps/residency diagnostics, streamed exhibit lifecycle and memory budgets.
- Preserve 73 living project identities mapped to 35 stable exhibit slots; keep source 14 installation state machines, 17 authored visitors, local Full Weasel and Workshop conservation intact.
- High-impact screenshot comparisons are insufficient: review actual gameplay movement, both levels, all six wings, gallery focus, and the full offline journey before claiming readiness.

## Validation and limits

Focused unit tests: `tests/aaa-art-direction.test.ts`, `tests/environment.test.ts`, `tests/persistent-environment.test.ts`.

Real browser: `tests/browser/art-direction.e2e.ts` checks the live scene's shared texture, all six runners, three Rotunda seals, 140 gallery relief instances, and nine atmosphere targets. `MUSEUM_VISUAL_PROOF=1` captures **individual** local screenshots from the actual renderer; they are inspection aids, not acceptance proof. The opt-in `MUSEUM_BROWSER_EXECUTABLE` variable can select an existing Chromium-compatible browser if the managed Playwright cache is unavailable; CI continues using its installed Chromium.

The canonical `npm run gate` covers typecheck, lint, unit tests, mapping/content/privacy/frame-loop/hotpaths/assets/exhibits/source parity, production build and transfer budgets. Offline verification separately exercises real source installations and authored visitors.

**Unverified:** subjective finish/lighting/readability, physical tablet frame pacing, long-running GPU behavior, contact shadows and fine ambient character animation, hero-by-hero visual acceptance, gamepad behavior if any, and public Pages deployment of the current commit. Do not claim these from generated screenshots or passing automated tests. Additional per-hero visual overhaul belongs in later evidence-led slices, not a fake one-click AAA completion declaration.


## 2026-10-19 continued visual pass (isolated branch; validation pending)

**Intent, not a 1.0 declaration.** Building on `visual/reliquary-finish-2026-10-19`, introduce a shared locally generated 64x64 soft alpha mask for two actual-world improvements: one subtly tinted, spatially culled gallery floor wash per 35 exhibit stages; one faint moving contact shadow per 17 distinct authored visitors. The gallery wash is presentation-only additive colour; it does not cast dynamic scene light or change project artwork. Visitor shadows use the existing body-visual update cadence and do not change 60Hz routes/collision/interaction. The location HUD now carries six existing wing palette signals while retaining explicit location text.

**Resource contract:** One shared per-scope alpha texture, one gallery instance draw with current portal culling, one visitor shadow instance draw, zero new lights, dependencies, animation loops, collision surfaces, remote assets, or save/asset authority changes. Low-tier devices retain the existing renderer tier, DPR guard and static look; physical frame-time impact is not claimed before measurement. The ongoing campaign's earlier flight-pad, six-wing fixtures and inlaid gallery rims are preserved.

**Proof contract:** Unit tests validate mask edge and centre, shared identity/disposal, 35-to-north-culling-to-35 recovery, 17 visitor instances, and scene source-contract; existing `npm run gate`, `npm run test:e2e`, `npm run test:workshop`, and offline standalone paths remain mandatory. Human per-exhibit aesthetics, physical MacBook/Brave and Android performance and exact hosted Pages revision remain **UNKNOWN / UNVERIFIED** until independent receipts exist.


### Validation continuation (2026-10-19, feature branch)
Exact code commit `580f9fa406009fdcf69645557548b2a134075448` passed the complete canonical development gate, full offline standalone, 14/14 source installations, 17/17 authored visitors, and Museum Workshop. The prior artwork-eviction Chromium regression is repaired and passed in the fresh 20-journey suite. That browser suite reported 19/20 PASS: the remaining failure was a stale expectation of one visitor-visible mesh despite the intentional second instanced contact-shadow draw. `tests/browser/museum.e2e.ts` now guards the explicit two-draw, 327-body-part, 17-shadow contract. The final subsequent exact-head browser run remains **PENDING** at documentation write. Human visual and physical-device acceptance remain UNKNOWN.


### Sculptural gallery plinths and playable S'mores town — 2026-10-19 next art candidate

Every one of the 35 original identical box plinths is visually replaced with a four-layer bevelled curatorial pedestal assembled from the existing architectural palettes. The original collider remains exactly 2.6 x 0.9 x 2.6 metres, and mounting/camera/traversal/interaction geometries remain unchanged. Four scope-managed geometries are shared across all bays and remain subject to the static geometry merge.

Playable E32 S'mores Katamari now has five physically different, locally compiled, vertex-coloured collectible meshes for bottle caps, garden gnomes, mailboxes, parked cars and sheds. Pickup thresholds/radii, 54 seeded item positions, growth maths, figure-eight movement, stop/reset, reduced-motion behaviour and live controls are preserved. A miniature neighbourhood replaces individual generic house primitives with four InstancedMeshes (26 house shells, 26 pitched roofs, 52 windows, 26 doors), plus one instanced road-marking mesh (36 segments). The ball acquires three small attached wafer/marshmallow/chocolate rings which inherit the original movement and reset. No separate frame loop, 3D package, game ability, external texture/model or real-time light is introduced.

The previous feature-head c582a98085206ef5959013c28dcf551a7de1e5cf was subsequently verified in all four jobs (gate, 20 Chromium journeys, Workshop, offline standalone) by https://github.com/westkitty/museum-of-me-vnext/actions/runs/39245022421. New committed candidate is IMPLEMENTED but new exact-head CI and human/device visual acceptance are PENDING at this note; code shape and batching are not themselves proof of FPS. Product remains active development / PRE-1.0.
