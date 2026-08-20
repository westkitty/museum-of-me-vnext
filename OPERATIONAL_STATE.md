# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/Users/andrew/museum of me/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 15,
  "last_updated": "2026-08-19",
  "linked_parent_state": "Museum_of_Me_vNext_Workspace/.../03_build_plan/OPERATIONAL_STATE_build_plan.md"
}
-->

## 1. Identity and scope

- **Implementation root (SELECTED):** `/Users/andrew/museum of me/museum-of-me-vnext`
- **Baseline classification:** new vNext project created **beside** preserved legacy Reliquary material.
- **Governed scope:** this repository only.
- **Explicitly not governed:** the handoff bundle, the handoff ZIP, the legacy Reliquary ZIPs and HTML
  artifacts. Those are read-only source evidence and are never modified from here.

## 2. Source authority (in force)

1. Explicit user instructions for this run.
2. This file.
3. `docs/MUSEUM_VNEXT_BUILD_PLAN.md` (byte-identical copy of the controlling plan,
   `sha256:03ca23f5…33226a`).
4. The vNext investigation/actualization handoff.
5. Verified repository/runtime evidence.
6. Historical Reliquary material — evidence, not implementation authority.
7. Inference.

## 3. Current baseline

| Item | State |
|---|---|
| Repository | initialised, branch `main`, first phase branch `feat/foundation` |
| Remote | `git@github.com:westkitty/museum-of-me-vnext.git` (private), pushing `feat/foundation` |
| Runtime | traversable graybox + exhibit lifecycle, streaming, interaction, full DOM interface, procedural audio |
| Toolchain | Node 26.7.0, npm 11.19.0, Vite 6, TypeScript 5.7, Three.js **0.185.0** (pinned) |
| Current phase | **Phase 14 complete — deployment prepared and validated.** The museum is release-ready; publication is blocked only on a hosting decision. |

## 4. Active invariants

| ID | Rule | Enforced by |
|---|---|---|
| INV-001 | Exactly one frame-loop owner: `src/app/Loop.ts`. | ESLint `no-restricted-globals` + `npm run validate:frameloop` |
| INV-002 | 64 project identities map to 35 exhibits, exactly once each. Mapping is frozen. | `npm run validate:mapping` |
| INV-003 | No visitor-facing placeholder prose (`TODO`, `placeholder`, `lorem`, `coming soon`, `TBD`). | `npm run validate:content` |
| INV-004 | No credentials, IP literals, private paths, private hostnames, or personal identifiers in visitor content. | `npm run validate:privacy` |
| INV-005 | Legacy Reliquary artifacts are never modified. Hashes recorded in `docs/INVESTIGATION_BASELINE.md`. | manual + hash record |
| INV-006 | Dexter Sanctuary is outside the 35-exhibit count and is never mascotised. | `docs/EXHIBIT_CONTRACT.md`, design review |
| INV-007 | No runtime asset is fetched from a host this project does not control. | `docs/ASSET_POLICY.md`, `npm run validate:assets` |
| INV-008 | Every exhibit's `ResourceScope` drains to zero on unmount. | `ExhibitHost` assertion + lifecycle tests |
| INV-009 | The museum requires no live AI, cloud API, or backend for the core experience. | architecture; no network code outside asset fetch of own files |
| INV-010 | Every dimension of the building derives from `src/world/layout.ts`. Geometry, collision, zones, the map and exhibit anchors may not hard-code a position. | code review; traversal tests fail if they disagree |
| INV-014 | An exhibit's build-time arrays are declared with `this.tracked()` so they empty before every mount. Streaming remounts modules many times per visit. | `tests/lifecycle.test.ts` allocation-parity check |
| INV-016 | No exhibit may resolve to `ProvisionalExhibit`; all 35 are bespoke. | `npm run validate:exhibits` |
| INV-015 | The Dexter Sanctuary contains no score, badge, collectible, paw-print, achievement, unlock or reward, and is never counted among the 35. | `tests/sanctuary.test.ts` |
| INV-012 | Every asset reaches the scene through `AssetManager.load`, which refuses any id without a manifest record. | `validate:assets` + unit tests |
| INV-013 | Procedural generators never call `Math.random`; they use the seeded `rng`. | code review + determinism test |
| INV-011 | The mandatory traversal must keep passing: entrance → every wing → upper floor → Sanctuary → entrance, with no teleport and no visible level load. | `tests/traversal.test.ts` |

## 5. Verified working behaviour

| Behaviour | Evidence | Verified |
|---|---|---|
| 64 → 35 mapping is complete, exclusive, and gap-free | `node scripts/validate-mapping.mjs` → PASS (35 exhibits / 64 projects / 64 records) | ✅ 2026-08-19 |
| No placeholder prose in authored content | `node scripts/validate-content.mjs` → PASS | ✅ 2026-08-19 |
| No sensitive material in authored content | `node scripts/validate-privacy.mjs` → PASS | ✅ 2026-08-19 |
| Controlling plan copied without weakening | sha256 matches bundle-recorded identity | ✅ 2026-08-19 |
| Toolchain installs and resolves | `npm install` clean; three@0.185.0 resolved | ✅ 2026-08-19 |
| Typecheck, lint, unit tests, production build all pass | `npm run gate` → all PASS; 29 unit tests green; build 1.0 s | ✅ 2026-08-19 |
| Application boots and renders in a real browser | dev server + browser probe: `loopRunning true`, WebGL2 context live, `contextLost false`, DPR capped to 1 on auto-selected `medium` tier, **zero console errors** | ✅ 2026-08-19 |
| **Mandatory traversal passes**: entrance → south → Rotunda → north → east → west → grand stair → balcony → NW mezzanine → NE mezzanine → Sanctuary → entrance, continuously | `tests/traversal.test.ts` simulates the walk against the real `CollisionWorld` using the player's own radius, height and step-up rule. 0 failures across the full route. | ✅ 2026-08-19 |
| Every one of the 35 exhibit bays can be entered and left on foot | same harness, 70 segments (in and out of each bay), 0 failures | ✅ 2026-08-19 |
| Museum geometry builds 35 exhibit mount points and 1,000+ colliders | traversal test + browser probe (`mounts: 35`, `colliders: 1064`) | ✅ 2026-08-19 |
| Zone resolution is correct for every zone, including diagonal mezzanines | `zoneAt` unit tests + live browser check (Sanctuary resolved correctly while standing in it) | ✅ 2026-08-19 |
| The graybox renders as architecture, with long sightlines from the south hall through the Rotunda to the north wing | browser screenshots at entrance, south hall, Rotunda and Sanctuary | ✅ 2026-08-19 |
| **Phase 3 lifecycle gate passes**: five deliberately different exhibits load, activate, deactivate, unload and reload independently | `tests/lifecycle.test.ts` — three cycles each, identical allocation per cycle, zero leaked resources on every unmount, idempotent deterministic reset | ✅ 2026-08-19 |
| Streaming loads on approach and releases on departure without leaking | same test — E01 goes active on approach, returns to `loaded` with a zero resource count on departure, and comes back clean | ✅ 2026-08-19 |
| Streaming respects a per-frame construction budget | same test — never exceeds `mountsPerFrame` | ✅ 2026-08-19 |
| Every one of the 35 exhibits produces accessible content with real interpretation and at least one control | same test, all 35 instantiated | ✅ 2026-08-19 |
| HUD, map, journal, deep panel and settings render and operate in a real browser | browser: entry prompt and location line correct at spawn; map draws the plan from `layout.ts` with all 35 bays and the Sanctuary; deep panel shows layered interpretation for E17 | ✅ 2026-08-19 |
| **Phase 4 asset gate passes**: one representative asset loads, displays, unloads and reloads with no leaked scene object or resource | `tests/assets.test.ts` — three cycles, identical allocation each time, parent group empty and scope drained after every unload | ✅ 2026-08-19 |
| An aborted load allocates nothing and leaves no partial object | same test | ✅ 2026-08-19 |
| An undocumented asset cannot reach the scene | `registerGenerator` and `load` both throw without a manifest record; unit-tested | ✅ 2026-08-19 |
| Procedural generators are deterministic | seeded xorshift; same seed produces identical sequences, unit-tested | ✅ 2026-08-19 |
| Exhibit tiers match the plan exactly (A=9, B=16, C=10) and the initial-visit bundle is 0.71 MB of its 20 MB budget | `npm run check:budgets` | ✅ 2026-08-19 |
| **Phase 5 vertical-slice gate passes**: five deliberately different exhibits built bespoke — E01 Starsilk Universe (spatial sculpture), E10 WorldsVault Lineage (sequence/history), E19 DexTilt (device interaction), E25 DnDex (miniature game), E13 Suno Studio (audio) | `tests/vertical-slice.test.ts` — real 3D volume in all three axes, >12 meshes each, controls that change observable state, usable under reduced motion, three clean streaming cycles, deterministic reset | ✅ 2026-08-19 |
| The Dexter Sanctuary exists, is outside the 35, and is not mascotised | `tests/sanctuary.test.ts` — Dexter modelled with the hanging Phalène ears, below and behind the Rotunda axis, holds still under reduced motion, and the implementation contains no score, badge, collectible, paw-print, achievement, unlock or reward | ✅ 2026-08-19 |
| The interaction architecture did not need repairing to carry five different exhibits | all five compose the same shared parts (Filament, Dial, Lever, Pulse, console) and the frozen contract; no exhibit-specific engine work was required | ✅ 2026-08-19 |
| **Phase 6 gate passes**: production architecture applied and all traversal tests remain valid | `Detailing` dresses geometry that already exists — cornices, pilasters, signage, jambs, benches, floor inlays — without moving a wall. `tests/traversal.test.ts` still green, 0 failures | ✅ 2026-08-19 |
| Every wing threshold and every bay opening carries its own signage | browser: Rotunda shows wing names over each arch; the north hall shows bay titles, jambs, pilaster rhythm, cornices and a floor runner | ✅ 2026-08-19 |
| **Phases 7–8 gate passes**: all 35 exhibits implemented bespoke, none still scaffolded | `npm run validate:exhibits` → 35 of 35; `tests/exhibit-quality.test.ts` runs the plan's per-exhibit gate over every one | ✅ 2026-08-19 |
| All 64 project identities are represented by a finished exhibit | mapping gate + exhibit gate together | ✅ 2026-08-19 |
| Every exhibit has real 3D volume, fits its bay, has described controls that change state, layered interpretation, reduced-motion usability, three clean streaming cycles, idempotent reset, and adds nothing outside its own group | `tests/exhibit-quality.test.ts`, 281 assertions across 35 exhibits | ✅ 2026-08-19 |
| **Phase 9 content gate passes**: no visitor-facing placeholder anywhere, and every project carries full layered interpretation | `validate:content` now scans 1,843 visitor-facing string literals across exhibits, UI and the accessible mirror in addition to the data layer; `tests/content-completion.test.ts` checks every project and exhibit field for length, finished prose and banned language | ✅ 2026-08-19 |
| Interpretation stays project-first across the entire corpus | creator-praise scan over every project paragraph, exhibit copy and wing blurb — zero matches | ✅ 2026-08-19 |
| Repository references are public paths, never local ones | content test | ✅ 2026-08-19 |
| **Phase 10 experience pass**: gradient sky, fog matched to the horizon, exterior massing lit, hall lighting rhythm, floor wayfinding and ambient visitors | `tests/experience.test.ts`; browser-verified at the plaza and in the vestibule with wayfinding running | ✅ 2026-08-19 |
| Wayfinding points from the entrance and clears itself on arrival | `tests/experience.test.ts`; browser screenshot shows the floor markers leading north from the vestibule | ✅ 2026-08-19 |
| Ambient visitors respect the plan's 4–8 range, vanish entirely on the low tier, and share one geometry | `tests/experience.test.ts` | ✅ 2026-08-19 |
| **Phase 11 accessibility gate passes**: the museum is fully usable with a keyboard alone, with touch alone, and with reduced motion on | `tests/accessibility.test.ts` — WASD moves and arrow keys look as separate bindings, keyboard turn rate is sensitivity-independent, the touch stick actually drives the player, pointer lock is never requested on touch, keys are never stolen from text fields, movement is suppressed while a panel has focus | ✅ 2026-08-19 |
| Accessible mirror carries the whole collection by keyboard | browser: 35 exhibit buttons, 10 headings, 9,157 characters of interpretation reachable without walking | ✅ 2026-08-19 |
| DPR is capped on every quality tier and the low tier drops shadows and crowds | `tests/accessibility.test.ts` | ✅ 2026-08-19 |
| **Phase 12 mandatory traversal passes**: entrance → north → east → south → west → upper level → Sanctuary → entrance, four times over, and memory settles rather than climbing | `tests/lifecycle-memory.test.ts` walks the real canonical route through the real StreamingManager and measures the exhibits' own tracked resource counts. Peak allocation does not creep between laps and the resting level is stable | ✅ 2026-08-19 |
| Streaming never holds the whole museum resident | same test — peak residency stays below 35 while never falling to zero | ✅ 2026-08-19 |
| Mounts and unmounts balance over a round trip | same test | ✅ 2026-08-19 |
| Draw calls reduced from 986 to 253 at the entrance | `mergeStatic` collapses static architecture per material; measured in-browser before and after; `tests/performance.test.ts` holds the ratio | ✅ 2026-08-19 |
| Simultaneous point lights reduced from 31 to a hard cap of 8 anywhere in the building | light director; measured in-browser at eight positions; `tests/performance.test.ts` asserts the cap | ✅ 2026-08-19 |
| Merging cannot move a wall | collision is recorded during construction, before any merge; traversal tests still green afterwards | ✅ 2026-08-19 |
| **Phase 13 full-museum QA passes**: every one of the 35 exhibits reached and activated in a real browser, zero uncaught errors, zero unhandled rejections, zero console errors | `validation/reports/WALKTHROUGH_2026-08-19.md` — driven through the museum's own loop, streaming, interaction and zone resolution, at each exhibit's visitor standing position | ✅ 2026-08-19 |
| Every exhibit has registered controls and ≥4 paragraphs of interpretation at runtime | same walkthrough | ✅ 2026-08-19 |
| All six wings resolve correctly while walking | same walkthrough, after the zone fix below | ✅ 2026-08-19 |
| Visual evidence captured for the plaza, vestibule, south hall, Rotunda, balcony, north wing, mezzanine and Sanctuary | same report | ✅ 2026-08-19 |
| Dexter reads as a tricolour Phalène at rest, with the hanging ears intact | close visual inspection in the Sanctuary | ✅ 2026-08-19 |
| **Production build runs and behaves identically to dev** | served from `dist/` and walked: 35 exhibit hosts, streaming, interaction, the 8-light cap and zone resolution all correct | ✅ 2026-08-19 |
| **No hotlinked runtime asset — verified at runtime, not just by static scan** | production build makes exactly **4 requests, all same-origin, zero external**, totalling 321 KB | ✅ 2026-08-19 |
| **Direct refresh works, and visitor state survives it** | against the production server: preferences, journal visits, bookmarks, high contrast, interface scale and reduced motion all persist across a real reload | ✅ 2026-08-19 |
| Shipped bundle is 2.9 MB against a 20 MB initial-visit budget | `npm run check:budgets` + `du` on `dist/` excluding source maps | ✅ 2026-08-19 |
| **Nothing is allocated in the frame loop or in an interaction handler** | `tests/exhibit-quality.test.ts` — "repeated reset allocates nothing" runs four control-then-reset cycles over all 35 exhibits and requires the scope size to be identical every time. Verified in the browser too: E02's resource count stays flat at 123 across interactions and reset | ✅ 2026-08-19 |
| GPU resources owned by an object rather than its geometry are released | `ResourceScope.trackObject` now tracks self-disposing objects, so `InstancedMesh` instance buffers are freed on unmount | ✅ 2026-08-19 |
| Shadow-map render target is released on teardown | `Lighting.dispose` disposes every light's shadow | ✅ 2026-08-19 |
| Single frame loop is structurally enforced | `validate:frameloop` PASS — `src/app/Loop.ts` is the only `requestAnimationFrame` owner across 13 source files | ✅ 2026-08-19 |
| Asset governance gate operational | `validate:assets` PASS — no hotlinked runtime asset in any source file | ✅ 2026-08-19 |

## 6. Implemented but NOT verified

| Item | Why not yet verified |
|---|---|
| Quality-tier switching at runtime | `setQuality` is implemented and typechecked; no runtime tier-change observation yet. Phase 12. |
| Context-loss recovery | Handlers are installed and typechecked; not exercised against a real context loss. Phase 12. |
| Absolute frame rate in ms | The automation surface throttles `requestAnimationFrame` and does not synchronise GPU work, so wall-clock render timings taken there are noise (the same view measured 1 ms and 99 ms on consecutive runs). Draw calls, triangle counts, light counts and resident-exhibit counts **are** reliable there and are the numbers recorded above. A human FPS reading on real hardware is the one remaining unmeasured performance figure. |
| Audio | The AudioManager is implemented and typechecked but browsers refuse audio before a real gesture, which automation cannot supply. Unverified until a human walk-through in Phase 13. |
| Pointer-lock capture and release | Implemented and wired; a real pointer lock needs a user gesture the automation surface cannot supply. Keyboard and touch paths are tested and require no lock at all, so no visitor is dependent on it. Confirmed in the Phase 13 walkthrough. |
| Gamepad support | Not implemented. The plan lists it as "retained gamepad support if implemented"; it was not, and no visitor path depends on it. |
| Interactive walking with keyboard and pointer lock | Input and controller are implemented and typechecked; traversal so far is proven by simulation against real collision, not by a human walking it. Phase 3 adds the interaction layer and Phase 13 captures the recorded walkthrough. |

## 7. Known blockers / unknowns

| Item | Status |
|---|---|
| Production hosting target | **Not configured, and deliberately not chosen.** Deployment is fully prepared and validated: `dist/` is a complete self-contained artifact, `public/_headers` carries the cache policy and a CSP that forbids every outbound connection, `docs/DEPLOYMENT.md` has the exact steps for Cloudflare Pages or GitHub Pages, and `.github/workflows/deploy-pages.yml` exists but is manual-only. The single remaining action is an account decision: **choose a destination and authorise publication.** Publishing makes the documentation of sixty-four projects public, which is the owner's call, so nothing has been published. |
| Runtime performance | Unmeasured until Phase 12. |
| Push remote | Recorded at the first push attempt. `gh` is authenticated as `westkitty` with `repo` scope. |

## 8. Phase ledger

| Phase | State |
|---|---|
| 0 — authority/source freeze | ✅ complete |
| 1 — repository/runtime foundation | ✅ complete |
| 2 — complete museum graybox | ✅ complete |
| 3 — core museum systems | ✅ complete |
| 4 — governed asset pipeline | ✅ complete |
| 5 — vertical slice | ✅ complete |
| 6 — production architecture | ✅ complete |
| 7 — exhibit wave one | ✅ complete |
| 8 — exhibit wave two | ✅ complete |
| 9 — content completion | ✅ complete |
| 10 — experience pass | ✅ complete |
| 11 — accessibility/input | ✅ complete |
| 12 — performance/lifecycle | ✅ complete |
| 13 — full museum QA | ✅ complete |
| 14 — deployment/release | ✅ prepared and validated; publication blocked on a hosting decision |
