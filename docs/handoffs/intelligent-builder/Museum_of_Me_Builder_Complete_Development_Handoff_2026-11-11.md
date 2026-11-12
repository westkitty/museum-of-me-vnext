# MUSEUM OF ME - COMPLETE BUILDER DEVELOPMENT AND RELEASE HANDOFF

**Project:** Museum of Me / The Reliquary of Iterative Becoming vNext  
**Implementation:** `westkitty/museum-of-me-vnext`  
**Canonical continuity:** `westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md`  
**Coverage:** Original unified/Sims-inspired Builder planning and implementation conversation, subsequent PR #46/#47 continuation, PR #48 integration, CI, GitHub Pages deployment, and continuity writes  
**Evidence cutoff:** 2026-11-11, 20:52 EST (2026-11-12, 01:52 UTC), plus final GitHub branch and Bible readbacks performed afterward  
**Audience:** A successor ChatGPT/Codex/developer who must continue without relying on earlier chats  
**Delivery state:** THIS HANDOFF IS A REPORT, NOT A NEW BUILDER IMPLEMENTATION  
**Confidence rule:** Repository / PR / CI / hosted receipts outrank older status summaries. The original preceding chat's full raw transcript was not available as one export. Its user requests and intermediate history were reconstructed from relevant prior-chat retrieval, the canonical append-only Museum Bible, actual GitHub PR metadata, source paths, Actions job records, and visible messages from the continuation chat. Do not claim verbatim access to every message in the predecessor chat.

---

## 0. STOP READING THIS AS A CLAIM OF COMPLETE SIMS PARITY

There are TWO different completion questions:

1. **Bounded Builder release and integration task:** **COMPLETE AND VERIFIED.** The code for PRs #46 and #47 was combined in PR #48, exact-head CI passed, PR #48 was merged, `main` and `pages-preview` were synchronized, the Pages workflow completed successfully, and its deployed SHA matched the merge commit.
2. **Longer-term aspiration of an exhaustive Sims-style museum construction/curation environment:** **PARTIALLY IMPLEMENTED, NOT COMPLETE.** The real editor has many useful capabilities, but protected original architecture cannot be freely demolished or repositioned; arbitrary scripts, full room-topology/navmesh regeneration, truly arbitrary mesh manipulation, large-scale automatic furnishing, every project asset, previews for every asset, on-device performance acceptance, and total Sims parity were not delivered by this bounded release.

**Exact released commit:** `ce1f33e09e0c89245f9cf17a00a332c1025b49da`  
**Verified `main`:** same commit  
**Verified `pages-preview`:** same commit  
**Live site:** https://westkitty.github.io/museum-of-me-vnext/  
**Release workflow:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134601183  
**Release proof:** build SUCCESS; deploy SUCCESS; deploy job `130915977827` printed `pages hosted: PASS` at `2026-11-12T01:52:15Z`, with HTTP 200, four reachable JS/CSS resources, exact `build-info.json` SHA, top-down Workbench reachable, and expected 404 fallback.

**Critical distribution distinction:** The Pages visitor site being published DOES NOT make the authoring editor publicly available. Local Vite development mode with `?edit=1` and loopback save endpoints remains the authoring environment. Some static licensed asset files may be served by Pages because they live under `public/`; the editor and write endpoint are not thereby exposed.

---

## 1. EXECUTIVE STATE SNAPSHOT

| Area | Final evidence state | Proof / limitation |
| --- | --- | --- |
| Original first-person Three.js museum | PRESERVED IN TESTED SOURCE | No renderer replacement; single frame loop and authored museum protected by source validators / browser gates |
| Home Plan-inspired unified Builder entry | IMPLEMENTED, TESTED | PR #39; dev-only Vite, same real Three.js renderer/scene/canvas |
| Select, scale, rotate, move, paint objects | IMPLEMENTED, TESTED | PR #39/#42; bounded eligible objects, transform gizmos and inspector |
| Image-backed wall art and local media import | IMPLEMENTED, TESTED IN CI | SHA256-named bounded WebP, integrity checks, local-only write bridge; no personal uploads published in this work |
| Select and repaint existing non-instanced architectural meshes | IMPLEMENTED, TESTED | PR #42; material overrides, not demolition of structural mesh |
| Search/summon project-owned models | IMPLEMENTED, TESTED | PR #42 started with 23 GLBs; PR #47 expanded to 119 licensed OpenLife GLBs |
| Finishes | IMPLEMENTED, TESTED | PR #42 4 PNG finishes; PR #47 expands to 13 |
| Import locally selected GLB2 models | IMPLEMENTED, TESTED IN CI | Local host/origin/size/path policy, hashed storage; not a public upload API |
| Off-axis entrance exterior-disappearance bug | SOURCE FIXED, CI TESTED, RELEASED | PR #41; physical MacBook re-test not evidenced |
| Draw independent partition walls, floors, roofs | IMPLEMENTED, TESTED | PR #43 |
| Real doorway/window voids and oriented collision | IMPLEMENTED, TESTED | PR #44 |
| Two-click room construction and single-step Undo | IMPLEMENTED, TESTED | PR #45 |
| Custom messages and reversible glow/tint actions | IMPLEMENTED, TESTED | PR #46 and integrated PR #48; no arbitrary script engine |
| PR #46 source | INTEGRATED | Head `c5e8c0b3...` became ancestor via merge commit `52c00b56...` |
| PR #47 source | INTEGRATED | Head `f6bdb8b2...` became ancestor via merge commit `50c27b15...` |
| Combined PR #48 | MERGED | https://github.com/westkitty/museum-of-me-vnext/pull/48 |
| Combined release CI | VERIFIED | 4/4 jobs on integration commit; 791 unit tests, 5 Workshop browser, 58 visitor browser, offline proof |
| Merged `main` CI | VERIFIED | Run `43134575462`, all four jobs successful; 791 unit and 58 Chromium browser |
| GitHub Pages | VERIFIED DEPLOYED | Run `43134601183`, exact hosted SHA `ce1f33e...` |
| Physical MacBook checkout / FPS / GPU memory | UNKNOWN | This workflow used GitHub server-side commits and hosted CI; no authenticated local checkout audit or user playtest |
| Complete Sims parity | NOT DELIVERED | See sections on exclusions and planned future capabilities |
| Canonical Bible | UPDATED AND READ BACK | Append-only release closure commit `d46426215418bd2a10a1d02a0f4ce85eafceb3e3` |

The project itself remains **ACTIVE DEVELOPMENT / PRE-1.0**, despite an internally named historical `release/v1.0.0` branch. The README specifically rejects treating an old v1.0 milestone name as final product maturity.

---

## 2. WHAT THE USER ACTUALLY WANTED IN THE PRECEDING CONVERSATION

### 2.1 Origin and source choice

The user was not asking for a separate game, a decorative mockup, or another static architectural picture. The goal was a genuinely functional **Sims-inspired build mode inside the existing Museum of Me** that could manipulate the actual physical Three.js museum while keeping its established experience intact. A prior attempt to compare this with another floor-plan tool was corrected: the relevant reuse source was **`westkitty/Home_Plan` (Home Plan - Apartment Workshop)**, not Dex_WIFI Floor Plan Studio.

Selected original user wording available from prior-chat retrieval:

- At approximately Nov 10 local, the user asked: **"What about our house plan tool"**, referring to Home Plan.
- The user required **"the ability to change the size and scale of any selected object"** and asked for wall attachments, uploaded images, collision/script targeting, and the ability **"to color and paint the walls and the sections and objects."**
- After the architectural reuse direction was established, the user said: **"Build it."**
- The user later instructed: **"Wow me. Awe. UPLIFT. Omni. QQQ. Then Merge to main. Stage commit push update pages."**
- Further follow-ups demanded continuation, including **"Continue until we've actually hit the goal we have in mind."**
- The later Builder expansion request asked for assets from existing projects that could be searched, summoned and imported, for selecting anything including walls, applying colors/textures, then staging/committing/pushing/merging and updating Pages.

These quotes are a *retrieved subset*, not the entire preceding conversation transcript. The canonical Bible records the same accepted direction and repeated continuation requests.

### 2.2 Accepted feature objectives

1. One local-first Builder operating on the **real Three.js museum** instead of a separate replacement runtime.
2. Borrow Home Plan's interaction vocabulary: model-first authoring, convenient contextual inspector, dollhouse/orbit/top views, grid snapping, scalable objects, paint, wall attachments, room planning, history and saves.
3. Place, select, edit and scale **eligible** things in the world; eventually broaden coverage beyond generic decorative primitives.
4. Import user-supplied images as real artwork surfaces, including width, height, thickness/depth, protrusion/recess-style positioning, and wall mounting.
5. Repaint eligible authored or existing wall/room/object surfaces independently, without shared-material contamination.
6. Searchable, categorized, summonable source-owned library drawing on existing projects; on-demand asset loading and local import.
7. Add collision and eventually meaningful interaction behaviors to user-authored objects.
8. Progress from prefab decoration to drawn walls, walkable floors, roofs, actual door/window voids, complete room authoring and robust Undo/Redo.
9. Validate real editor and visitor behavior, save data, offline distribution, security/privacy, accessibility and performance before merging or publishing.
10. Stage/commit/push/merge to the authoritative GitHub repository and publish to the existing Pages visitor site, checking the exact deployed SHA.

**This was aspirational scope, not a promise that any feature could bypass conservation rules.** Subsequent implementations narrowed some objectives to protect the museum. In particular, "select anything" does not currently mean editing skinned/instanced meshes or arbitrary original load-bearing structure. "Scripts" became an allowlisted data-driven action registry; untrusted arbitrary JavaScript was deliberately excluded.

### 2.3 Why Home Plan was mined for interaction patterns, not ported wholesale

The Home Plan source had model-based wall endpoints/fixtures, furniture transforms, room zones, 3D/dollhouse/top presentation, configurable snapping, palette and surface tools, undo/redo, JSON/local saves, advisory collision/path checking, underlays and a compact inspector. The museum already had a real Three.js runtime, a source-of-truth layout, collision ownership, visitor interaction and its own Workshop.

The controlling decision: **adapt Home Plan's UX contracts and tested formulas to the museum's Three.js renderer; do not replace Three.js with Home Plan's custom Canvas perspective renderer.** Home Plan's advisory collision checker was not interchangeable with the museum's authoritative collision system. Home Plan's source `package.json` was labeled `UNLICENSED`; this was a warning not to presume all code could be redistributed merely because a repository was visible.

### 2.4 Protected museum identity and constraints

- A coherent first-person Three.js/WebGL physical museum, not a generic simulation game.
- Main building with Reliquary Rotunda, two levels, six themed wings, and sacred Dexter Sanctuary.
- **35 stable visitor-facing exhibit slots** and a changing project inventory (later Bible identity refers to 73 project identities; older 64-project mappings are historical).
- Six wing names in continuity: Starsilk & Drakken; Archive & Canon; Games & Play; Dex Systems; Music / Promptcraft / Media; Local Systems / Infrastructure.
- Existing exhibits, visitor paths, original structure, collision, doorway, sensory/accessibility behavior, offline capability, and **one Three.js frame loop** must survive editing and release work.
- This remains a museum/portfolio, not a mandatory progression game. Dexter is not a disposable mascot or placeholder.
- The source authority for spatial rules is `src/world/layout.ts`; editorial/player presentation is not a license to mutate original protected geometry.
- Local-only authoring and private user imports cannot be silently exposed on GitHub Pages.
- The physical MacBook Air M1 / 8 GB was a practical target for editor usability; source CI on GitHub Ubuntu is not hardware proof.

---

## 3. AUTHORITY, EVIDENCE AND WHAT WAS ACTUALLY INSPECTED

| Evidence source | Actual use in this handoff | Authority and limits |
| --- | --- | --- |
| User-provided quoted prior status and full current continuation conversation | Exact task handoff, user demands, tool/action history and errors | Direct evidence of what was requested/claimed in the visible conversation |
| Relevant prior-chat context retrieval | Recovered preceding Home Plan / Sims Builder user requests and continuation wording | Not a complete raw export; only selected retrieved content |
| `westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md` | Read full file and relevant late-November ledger entries, including later source/release corrections | Authoritative history/decision continuity, but stale entries remain historical until superseded |
| `identity/Museum_of_Me.project-bible.json` and `PROJECT_INDEX.md` | Verified project identity and non-match with historical standalone Reliquary restoration | Identity file's older status/version descriptions may lag current repo |
| Uploaded `Museum_of_Me_Bible_Automation_Source(1).md` | Read continuity contract and evidence-state vocabulary | Governs Bible discipline, not proof of implementation |
| GitHub PRs #39-#48 | Read PR title/body, current state, feature head, merge commit and metadata | Direct GitHub source history; narrative body may predate final release |
| GitHub current branch and commit API | Verified `main` and `pages-preview` `ce1f33e...` | Remote state only; no local MacBook `git status` |
| GitHub CI runs and job logs | Verified exact heads, 791 unit tests, 5 Workshop tests, 58 browser tests, offline proof and release | CI environment, not physical MacBook |
| GitHub Pages deploy log | Verified hosted `ce1f33e...` and HTTP/assets/workbench/fallback | Site availability and SHA, not all human visual journeys or editor availability |
| `README.md`, `package.json`, `vite.config.ts`, `.github/workflows`, source modules and tests on current `main` | Verified entrypoints, scripts, runtime and implementing file ownership | Source code existence does not replace direct browser operation; CI covers specified paths |
| `OPERATIONAL_STATE.md` | Read metadata and tail / observed historical runtime states | Header is older than Builder work; not primary evidence for November 11 implementation |
| OpenLife provenance file and `builderAssets.json` | Verified catalog shape, pinned origin, license and asset metadata | Source import/byte integrity and selection tests do not prove every asset's aesthetic suitability |

**Not directly inspected:** the physical MacBook working tree, its current branch, any local uncommitted Builder changes, true on-device FPS/thermal/GPU use, any user-made Builder worlds saved locally since the release, and every frame of the original predecessor chat. The separate uploaded standalone Reliquary restoration handoff is a historical different-artifact workflow; it must not override the vNext implementation/Bible.

### Evidence-state vocabulary enforced

- **BRAINSTORMED**: discussed only.
- **ACCEPTED DESIGN DIRECTION**: user approved direction, not necessarily coded.
- **PLANNED**: scoped task or intended implementation.
- **IMPLEMENTED**: current source/commit shows code exists.
- **VERIFIED**: appropriate current-head test/runtime evidence passed.
- **REJECTED/SUPERSEDED**: explicitly displaced.
- **UNKNOWN/UNVERIFIED**: not established by evidence.

GitHub branch push is not Pages deployment. A successful build is not a browser pass. A completed Pages deployment is not proof that `?edit=1` works publicly. A CLI/GitHub commit is not MacBook local staging. Older Bible entries saying a PR was pending are historical, not fresh instructions to rerun completed work.

---

## 4. PRE-BUILDER PROJECT BASELINE AND CONTEXT

The release work built on the active V3 exterior museum; PR #38 (`feat/exterior-omni-awe-uplift-20261109`, merged commit `a96d2f74bc2057d25a6cc324c4f79a4588144a16`) had already supplied authored exterior features, the threshold vestibule and terrain/wildlife work while preserving the interior streaming boundary. It is relevant as the exact starting commit for the first unified Builder branch, but this handoff does not re-audit all 12 exterior additions.

The `?qa=1` read-only QA surface is distinct from the Vite DEV-only `?edit=1` Workshop. A prior access misunderstanding led to the important conclusion: **static GitHub Pages cannot serve the local on-disk Builder save bridge just by adding a query parameter.** The existing `/workbench/` top-down architectural planning surface was also not magically merged into the Builder; Builder shares museum runtime and incorporates Home Plan-inspired UI, while `/workbench/` remains separate and read-only in the published site.

Before Builder expansion, the project also had a historical exterior PR backlog. PR #40 reconciled twelve stale/deferred exterior PRs, preserving source history while closing superseded PRs without force-pushing or deleting original branches. This mattered because it established a clean active PR baseline and avoided accidentally merging old visual experiments into the Builder line.

The user supplied a MacBook screen recording of a real exterior traversal defect: walking on a side path near the building caused the entire island/exterior to disappear. This became PR #41 and was addressed **before** further Builder growth, since false world switching would undermine any real authoring preview.


---

## 5. ORIGINAL IMPLEMENTATION CONVERSATION - CHRONOLOGICAL PR AND RELEASE LEDGER

This section reconstructs the preceding conversation's actual work, not just its final summary. Dates on GitHub are UTC and can read as November 12 while the user's local clock in Michigan was still November 11.

### 5.1 PR #39 - initial unified Museum Builder (Home Plan-inspired)

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/39  
**Branch:** `feat/unified-museum-builder-homeplan-20261110`  
**Feature head:** `eaf4504ecdd52f90dd82bdc66e7be1ffa37508d0`  
**Merge:** `8a1fbd5e54cbf236359030fe3a5e58269035ea2f`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/42936151331 - four jobs success  
**Pages:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/42939225816 - hosted SHA PASS on `8a1fbd5...`  
**Files changed:** 14

**Implemented**

- `BuilderCamera.ts`: actual Three.js camera operating over the existing museum scene, offering orbit/dollhouse/top views and an authoring grid. Did not create a second scene or renderer.
- Workshop entry and inspector improvements, retaining the existing `Museum Workshop` heading, build-mode behavior, current selection, transform gizmos, history and local save.
- Movement snap choices including free/5/10/25/50/100 cm; object translation, rotation, scale and uniform-scale controls.
- Authorable sphere sculpture, `wall-art` and `wall-panel` prefabs, with dimensions and depth/thickness settings and wall-raycast placement.
- Object color, optional conservative dynamic AABB collision, fixed `none/announce` interaction, and world target identity (`exterior`, `interior`, `shared`).
- Browser-selected images converted to bounded content-addressed local WebP (historical design caps: 2048 px / 3 MB). SHA256 filename, local-only Vite save endpoint, source manifest validation.
- `Reveal original`: reversible comparison against the original registered source scene; hides authored changes without discarding unsaved transforms and restores the authored view afterward.
- Source/reference validation for wall-art media, including correct hash/container/path before saving, and source-referenced inline media for standalone offline HTML rather than broken `file://` lookups.
- Existing authored installations, protected original structure, visitor routes and collision were not supposed to move.

**Real regression discovered and repaired before release:** The first Chromium Workshop flow failed when activating Build Mode unexpectedly pulled back the camera and changed the target. Selection continuity was protected by initializing the orbit controls target along the existing camera forward direction without moving the camera. The accepted historical `Museum Workshop` title was also restored instead of replacing it. The corrected exact-head test suite passed before merge.

**What was explicitly NOT achieved:** wholesale unification of the independent `/workbench/` architecture-survey UI; arbitrary legacy structural geometry editing; true wall cutout CSG; full furniture grouping/cutaway; arbitrary JavaScript events; MacBook physical/editor visual acceptance.

**Publication proof:** The older Pages run's `verify-pages-hosted.mjs` reported shell 200, four JS/CSS assets reachable, exact SHA, Workbench route and 404 fallback. Pages did not expose Workshop editing.

### 5.2 PR #40 - repository/exterior PR cleanup supporting an unambiguous baseline

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/40  
**Feature head:** `a121c6288d61afc8cec597ac2b46648cff9ae44f`  
**Merge:** `fe3a133fa5b0c2e040cab37e29730109194cd2eb`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/42950276426 - 4/4 success  
**Pages:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/42952384816 - exact hosted SHA PASS  
**Files changed:** 2

The user also wanted stale/dirty PR inventory reconciled. The review identified ten old draft exterior PRs (#26-#35) as already fully contained in `main` (zero unique ahead commits), one obsolete test-only diff in #25, and one unaccepted canopy-scale visual experiment in #37. They were closed with provenance preserved; no destructive branch deletion or force-push. Useful coastline tests were adapted to the current annular water geometry in `tests/environment.test.ts` and documented in `docs/evidence/pr-reconciliation-2026-11-10.md`. No new visitor geometry was delivered by this PR. Its success cleared noise from future Builder merges.

### 5.3 PR #41 - actual entrance/streaming bug fix

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/41  
**Feature head:** `f523eb4c547bb123ab6260aa56600cfa0c1fd80e`  
**Merge:** `9c0067eafa62b11840a71f4f69241866d818b2fb`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/42968492658 (first documented gate; subsequent final green before merge recorded in PR/Bible)  
**Files changed:** 5

**Observed defect:** In a roughly 30-second 1280x686 MacBook recording, around 20-22 seconds a visitor walking beside the building saw the exterior world vanish, with night sky/pale interior ground exposed. This was not a minor decorative glitch: the scene was switching worlds at the wrong location.

**Source cause:** `src/app/WorldDirector.ts` previously used a global Z-plane at `ENTRANCE_PORTAL_Z` (128) to prepare/commit the interior and hide the entire exterior root, without adequate X lateral-position and height gating; the asynchronous prepare-completion and reverse switch also used unsafe Z-only criteria.

**Repair:** Gate transitions on the actual doorway opening (approximately 7 m wide), visitor capsule clearance and a bounded exterior vestibule (approximately 6 m depth); keep predictive preparation from committing visibility until a real crossing; preserve legitimate entrance/exit transitions; unify vestibule-depth reference with the exterior/layout. Added pure aperture and actual Chromium traversal tests including the off-axis case, overhead flight and proper doorway return. No second frame loop or museum rewrite.

**Boundary:** The user-observed MacBook symptom has source and CI repair proof, not a later user-supplied physical-device confirmation.

### 5.4 PR #42 - searchable source-owned asset shelf, import, existing-wall painting

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/42  
**Branch:** `feat/builder-asset-library-surface-paint-20261111`  
**Feature head:** `8a6c5e5b05e6dee8f02ff382287313baa1eed392`  
**Merge:** `217e371c3486e8bc0219fb59a091f951410b2976`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43002224382 - four jobs passed  
**Pages:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43011540139 - exact hosted SHA PASS  
**Files changed:** 49

**Source discovery:** Searched existing project repositories including `westkitty/Life_Sim` (OpenLife), `westkitty/modern_3d_browser_game_toolkit`, `westkitty/Home_Plan` and `westkitty/DEX_3js`. Selected the licensed OpenLife files rather than importing unrelated toolkit/game assets without item-level license confidence. The pinned OpenLife source SHA throughout this Builder line is `2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b`.

**Implemented:**

- First 23 actual locally vendored GLB models plus four local PNG material finishes; MIT notice preserved. No runtime hotlinks.
- A typed asset catalog and search/category filtering, provenance and safe local URL resolution.
- Summon actual parsed GLTF objects into the real scene; move/rotate/scale nonuniformly in bounded ranges (0.05 to 100 relative scale stated in PR), duplicate, delete, focus, snap and undo/redo.
- Browser local import of self-contained GLB2 models using a size-/host-/origin-limited Vite endpoint and SHA256-addressed local files, not arbitrary remote URLs. Browser-selected photos/finishes converted to local WebP.
- Actual raycast selection of eligible existing world meshes (including static wall surfaces) for non-destructive per-mesh paint/finish overrides. Materials cloned to avoid bleeding into other objects that share source material. Original geometry/structural ownership and original appearance are preserved.
- Save/reload of object placements and appearance overrides through existing schema version 1; `Reveal Original` and history maintain reversible presentation.
- **Collision correctness repair:** after numeric or gizmo transform of a solid authored object, its old cached dynamic AABB must be invalidated/replaced. Tests establish old collision removed and new collision bound to the changed transform.
- Non-instanced/non-skinned eligibility restriction; structural walls can be *painted* but their collision-authoritative mesh cannot be demolished or arbitrarily relocated.
- Regression suite for asset hashes/GLB containers, search, import, wall painting, material isolation, collision invalidation and Workshop browser authoring.

**During development:** type inference/category search issues were corrected. Earlier green CI on a prior head was not falsely carried forward over later source edits; a new exact-head test was required and ultimately passed before merge.

**Release boundary:** the first 23 and four were later extended by PR #47. Public Pages has a read-only visitor implementation and static assets, not a public authoring endpoint. Physical MacBook performance and a full catalog of all the user's projects were not proven.

### 5.5 PR #43 - authored partition walls, walkable floors and roofs

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/43  
**Feature head:** `9731ca299cae21faa3afbdccba0326aef9e32f8e`  
**Merge:** `a7bcf0f870f6d4b7418cf0f1d106f60bb6e3042f`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43015477653 - four jobs success  
**Pages:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43018681207 - exact hosted SHA PASS  
**Files changed:** 10

**Implemented:** `partition-wall`, `floor-slab` and `roof-panel` prefabs, individually editable/transformed/painted/textured/saved. Two clicked grid-snapped points produce a real authorable wall segment with visual preview and Escape cancellation. Newly authored floors contribute reversible dynamic support footprints matching rotated rectangles; a floor does not cause the player to stand on an invisible bounding rectangle outside the mesh. Original museum walls and paths are protected from accidental edit. A prior signed-zero yaw test issue and an initial Workshop wall-drawing interaction failure were investigated/corrected before the final green feature head. Arbitrary wall demolition and sloped ramps did not enter this slice.

### 5.6 PR #44 - real doorway/window geometry and oriented collisions

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/44  
**Feature head:** `209ba32555f24b5dd177b33e9b15cef4a7d19c79`  
**Merge:** `3753c4f94b9c09ddf50b2e4c60a99900fcc34dd0`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43020684900 - four jobs success  
**Pages:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43125365764 - exact hosted SHA PASS  
**Files changed:** 7

**Implemented:** Authored partition walls can be `Solid`, `Doorway` or `Window`, with bounded width/height/sill controls. `WallOpenings.ts` builds the remaining solid wall segments around actual absent-geometry openings. This is not a painted dark rectangle pretending to be a door. Collision is segmented and orientation-aware for yaw-rotated authored walls; doorway gaps are traversable, windows retain sill/lintel. The validation contract rejects nonsensical apertures and too-small door clearance (under roughly 1.0 m wide / 2.0 m high) or tipped construction walls. Artwork can anchor to newly authored partitions. Original source structural walls are still not cut, demolished or repositioned. Real Workshop browser tests validate the controls and geometric/collision behavior.

### 5.7 PR #45 - two-click rectangular rooms with atomic Undo

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/45  
**Feature head:** `0d202ada200edd21bb0108aeacbb534b7066e341`  
**Merge:** `669e5970e6c523aa4c3fa5ee32982dd9d28b317d`  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43126006561 - all four jobs passed  
**Pages:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43127816735 - exact hosted SHA PASS  
**Files changed:** 4

**Implemented:** Two snapped opposite floor corners generate a level axis-aligned room rectangle with **four individually authorable walls, one walkable floor and optionally one roof**. Bounds: 1.25-30 m extent per axis; reusable snap/grid; room preview and Escape cancel. Floor support uses existing dynamic collision, wall geometry uses existing partition primitives; door/window apertures can subsequently be applied to individual walls. One atomic history transaction means a single Undo removes all 5 or 6 components and Redo restores them. The walls are independent objects, not a synchronized semantic room entity with auto-regenerated navmesh.

**Regression caught before release:** an initial TypeScript test compile failed because a test fixture widened literal types (`schemaVersion` and `prefab`). Fixture types were corrected on the feature branch and exact-head CI re-run. Final gate recorded 786 unit tests in 62 files, 9.60 MB initial visit bundle under the 20 MB budget, real Workshop construction/Undo/doorway/browser/offline success.

**This PR established the last verified hosted site before the later PR #46/#47 continuation.** Its public Pages deployment at `669e5970...` was independently checked with the expected SHA, four JS/CSS resources, workbench, and fallback. This was the correct meaning of the previous chat's statement that the room-building features were finished while two newer branches were still pending.

### 5.8 PR #46 - custom message and reversible interaction modes

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/46  
**Feature branch:** `feat/builder-safe-interaction-actions-20261111`  
**Feature head:** `c5e8c0b3a1003948372e7faa34e70ad284d2d2a1`  
**Six changed paths:** `src/workshop/BuilderEvents.ts` (new), `src/workshop/MuseumPlacements.ts`, `src/workshop/Workshop.ts`, `src/workshop/schema.ts`, `tests/builder-events.test.ts` (new), `tests/workshop-browser/builder-events.workshop.e2e.ts` (new)  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43128684509 - all four jobs ultimately success  
**Integration ancestry merge:** `52c00b56a549e79cc6a53d9c68652b955fb15e07`

**Implemented:** Existing `none/announce` plus three bounded event modes: `message`, `toggle-glow`, `toggle-tint`. A literal authored `eventMessage` is 1-160 characters, and `eventColor` is validated six-digit hex. The Workshop inspector sets those fields; the existing visitor `InteractionManager` handles activation when the user faces and interacts with a placed object. `BuilderEvents.ts` clones each participant material before modifying it so shared GLB or prefab materials elsewhere remain unchanged; retains original diffuse/emissive/intensity state for the second activation to reverse the change. Supports material arrays and late-loaded GLB children; tracked cloned materials are disposed through `ResourceScope`. It does not add eval, arbitrary scripting, remote code loading, a second input loop or physical collision changes. The source schema remains version 1 with compatible optional fields.

**Tests:** Strict validation/malicious-value rejection, literal message content, independent material cloning, toggle/restore, arrays and late-loading; real Chromium authoring of an emissive sphere, switching out to the visitor runtime, interaction through existing manager, visible color change and restoration, and persistence of configured event fields. **Configured action data persists; persistent across-session on/off toggle state was not claimed or verified.**

### 5.9 PR #47 - full pinned OpenLife library in the Builder

**PR:** https://github.com/westkitty/museum-of-me-vnext/pull/47  
**Feature branch:** `feat/builder-complete-openlife-library-20261111`  
**Feature head:** `f6bdb8b2c11a902693c431c8b536f301ec80e805`  
**Changed paths:** 110 (96 newly copied GLBs, 9 PNG finishes, plus metadata/catalog/tests/evidence)  
**Feature CI:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43130282169 - all four jobs ultimately success  
**Integration ancestry merge:** `50c27b1538a4cfc4f580d260370cdf2bb87ac763`

**Implemented:** Completed the existing licensed OpenLife asset subset rather than silently claiming every asset in all of the user's repositories. The initial 23 GLBs + 4 finishes became **119 searchable/summonable GLBs and 13 local PNG finishes**, sourced from `westkitty/Life_Sim` at the pinned commit `2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b`. The 96 new GLBs and 9 new PNGs were brought over as exact Git blobs, with source/destination blob SHAs compared; `builderAssets.json` records per-item SHA256, byte count, original path, revision, license, categories/tags and nominal size. The MIT notice is preserved in `public/builder-assets/openlife/LICENSE.txt`.

**Total byte sizes recorded in the provenance report:** GLBs 1,065,580 bytes; PNG finishes 4,117,128 bytes. `tests/builder-asset-library.test.ts` reads/validates all **132** currently cataloged runtime files including exact sizes/hashes, GLB/PNG signatures, safe paths, unique IDs and search categories. The real Workshop browser fixture searches 119 entries and summons an additional `vehicle_compact` GLB through the existing GLTF loader. The asset shelf remains on-demand, not all 119 models preloaded into the visitor scene. A model name appearing in a catalog does not mean it has been placed into an exhibit.

**Important caveat:** "119 models" means 119 catalog file records; some procedural character variants share identical underlying Git blob hashes. It is not proof of 119 visually unique, artistically approved, fully animated museum characters. Nor is it the future search-every-repository, thumbnail-preview-every-item catalog.

### 5.10 What the ORIGINAL predecessor chat had not finished

At the handoff point supplied at the start of the continuation conversation, `main` and `pages-preview` were both **`669e5970e6c523aa4c3fa5ee32982dd9d28b317d`**, and Pages had confirmed a successful hosted release of the room-building feature. PR #46 and PR #47 existed as draft, unmerged and not published. Their CI jobs had begun; their combined compatibility was not proven. The previous assistant correctly reported a **partially complete** Builder milestone, not a new Pages release for those branches.

---

## 6. THIS CONTINUATION CONVERSATION - EVERY CONSEQUENTIAL ACTION

### 6.1 Initial resume and inspection

The user pasted the predecessor chat's status and ordered continuation from that exact point. The assistant loaded applicable project/implementation/authorization guidance, read the canonical Museum Bible from `westkitty/ChatGPT_Bible_Repo`, and inspected the live GitHub implementation repository. It verified PR #46 and #47 as draft/open at their exact feature heads, `main`/`pages-preview` equal at `669e5970...`, and the previous room release already hosted. It inspected both PR's changed-file lists, exact Git blob IDs, head/base relationships, check runs and CI workflow configuration.

**Integration finding:** PR #46 changed six source/test paths; PR #47 changed 110 paths and did **not** overlap those six. PR #47 diverged from `main` because it branched before the already-merged two-click room work; the seven main-side commits missing from its ancestry affected room tools / `Workshop.ts`, but PR #47 itself did not modify `Workshop.ts`. A clean combined source tree was possible without overwriting either new feature or existing rooms. The assistant preserved the underlying feature histories instead of retyping or recompressing GLBs.

### 6.2 Created and pushed the integration branch (not yet a release)

- Branch: `integration/builder-events-openlife-20261111`.
- Initial base: current `main` `669e5970e6c523aa4c3fa5ee32982dd9d28b317d`.
- Source tree base SHA: `378e849b22fd74f0632f87a21e28bb52abd29398`.
- Added all six exact PR #46 changed Git blob IDs to a new Git tree: `46613c5c7782f6a26fc85bd5be11d3d011dd3a01`.
- Created an authentic two-parent merge commit with parent main and parent PR #46 head: `52c00b56a549e79cc6a53d9c68652b955fb15e07`. Updated integration branch with expected-old-SHA non-forced ref update.
- Added all 110 PR #47 file blob IDs on that tree; verified exactly 96 `.glb` and nine `.png` additions, with no overlapping PR #46 paths. Result tree: `411c5f473af923192116b52d6ad8a8150347fe8d`.
- Created second two-parent merge commit, preserving ancestry of PR #47: `50c27b1538a4cfc4f580d260370cdf2bb87ac763`. Updated integration ref, non-forced and expected-SHA checked.
- Opened **draft PR #48**: https://github.com/westkitty/museum-of-me-vnext/pull/48. GitHub reported **116 changed paths**, **35 commits ahead**, **zero behind**, **mergeable=true**, and at PR creation approximately 2,674 added / 18 deleted lines relative to main. Exact figures are GitHub PR metadata, not an inferred local diff.
- The PR description explicitly required four exact-head checks, a guarded merge, fast-forward `pages-preview`, and hosted SHA proof. The previous public site remained unchanged while PR #48 was staged.

**First Bible continuation commit:** `cf5e3d49f7dfed28ad225df7a8b245463514650c` appended the staged-but-unverified integration state to `bibles/Museum_of_Me_Bible.md` without rewriting older entries.

### 6.3 User insisted that staged integration was not 'finished'

The user asked plainly whether the prior task had actually been completed. The assistant said **no** because PR #48 was only staged and CI/merge/Pages remained. The user then instructed: **"Okay, continue that until it's done."** This authorized the bounded CI-to-merge-to-Pages release continuation, not arbitrary new features or destructive changes.

Subsequent short user prompts (including `?` and `so?`) asked for current status, not permission to skip validation. The assistant repeatedly inspected the exact GitHub Actions run rather than inventing or assuming a completed outcome.

### 6.4 Exact-head integrated CI proof for PR #48

**Workflow:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43131307314  
**Run head:** `50c27b1538a4cfc4f580d260370cdf2bb87ac763`  
**Final outcome:** workflow completed SUCCESS; four jobs SUCCESS (`gate`, `workshop`, `standalone`, `browser`).

**Representative exact measurements from GitHub logs:**

- Canonical development gate: **791 Vitest unit tests passed across 63 files**; typecheck/lint/build/source/privacy/asset/frame-loop/hotpath/other standard validators completed green.
- Initial visit bundle: **14.40 MB of 20 MB budget**; dist/budget verification PASS. This was an initial bundle budget, not a measured runtime GPU peak.
- Workshop Chromium: **5 tests passed** in approximately **1.2 minutes**. The logged tests covered wall drawing/paint/Undo, asset search and real local GLB, new authored emissive object activation/restoration, two-click room + single Undo, and existing save bridge behavior.
- Fresh standalone static integrity: **PASS**, canonical standalone SHA256 `c8a0fc3375b6ed2559c58f175d5c238edaac755c5a4c9ebd7ce2a6aa98824432`.
- Fresh offline browser: **PASS**, cold exterior entry, two world round trips, 17 visitor cases. `runtime-source-qa` reported **14/14 installation paths**, **17/17 visitor conversations**, **zero remote runtime requests**. `requests=6` in one offline-browser line counts the test's request events, not six remote network dependencies; the explicit `remoteRequests=0` result is the relevant privacy/offline check.
- General visitor Chromium: **58 tests passed** in approximately **23.7 minutes**. This is why the run stayed `in_progress` for numerous user status checks even after the other three jobs were green.

Original PR #46 run `43128684509` and PR #47 run `43130282169` also independently completed 4/4 SUCCESS. They were useful corroboration, but **not** a substitute for combined PR #48's own checks.

### 6.5 Guarded merge into main and promotion of Pages branch

After current PR #48 exact-head 4/4 success, the assistant re-read the PR head/base/mergeability, CI head, `main` and `pages-preview`. A premerge check asserted the CI SHA and unchanged main base matched expectations. Then:

1. Marked PR #48 ready for review (changed `draft` from true to false).
2. Called GitHub `merge_pull_request` with merge method `merge` and **expected_head_sha `50c27b...`**.
3. GitHub reported success, resulting `main` merge commit **`ce1f33e09e0c89245f9cf17a00a332c1025b49da`**.
4. Re-read PR #48 and `main`: PR closed/merged, `main` exactly `ce1f33e...`.
5. Compared `pages-preview` against main: prior Pages `669e5970...` had zero unique commits ahead of new main; fast-forward was permitted.
6. Used `update_ref` with `expected_sha=669e5970...`, `force=false`, target `ce1f33e...` for `pages-preview`.
7. Read both branches back and verified **identical** `ce1f33e...`. No force-push, history rewrite, branch deletion or repo cleanup was performed.
8. GitHub subsequently marked PR #46 and PR #47 themselves as `merged=true` because their exact head histories were preserved as ancestors by the two-parent integration merges. Their separate `merge_commit_sha` metadata references the two integration ancestry commits; they were not individually squash-reimplemented on main after PR #48.

**Main CI, independently after merge:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134575462 completed **4/4 SUCCESS** against `ce1f33e...`; gate confirmed **791 unit tests / 63 files**, and visitor Chromium **58 passed** in roughly 10.7 minutes, alongside Workshop and standalone success.

### 6.6 GitHub Pages publication and hosted proof

**Workflow:** https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134601183  
**Event:** push to `pages-preview`  
**Head SHA:** `ce1f33e09e0c89245f9cf17a00a332c1025b49da`  
**Final workflow status:** COMPLETED / SUCCESS  
**Build job:** SUCCESS; reran canonical release gate, production dependency audit, Chromium visitor-path gate, Pages bundle and artifact validation  
**Deploy job:** SUCCESS  
**Deploy job ID:** `130915977827`  
**Recorded verifier time:** `2026-11-12T01:52:15Z` = local `2026-11-11 20:52:15 EST`

Deploy log's decisive result:

```text
pages hosted: PASS
  - shell 200
  - 4 deployed JS/CSS assets reachable
  - deployed sha ce1f33e09e0c89245f9cf17a00a332c1025b49da
  - top-down planning workbench reachable
  - 404 fallback returns the museum shell
```

The repository's `scripts/verify-pages-hosted.mjs` fetches the HTTPS shell, checks expected canvas/UI/accessibility mount roots, fetches referenced same-origin JS/CSS, reads `build-info.json` and matches `receipt.sha` against the exact expected source SHA, checks the top-down `/workbench/` pinned snapshot, and probes an unknown route for correct 404 fallback. Therefore **publication and exact hosted revision are VERIFIED**. The proof does not claim editor access on Pages or human playtesting of every visual interaction.

### 6.7 Bible writes performed in THIS conversation

Three append-only commits to the separate canonical Bible repository (not to the museum implementation repository):

| Commit | Purpose | State at the moment |
| --- | --- | --- |
| `cf5e3d49f7dfed28ad225df7a8b245463514650c` | Integration PR #48 created, features staged, CI pending | SOURCE INTEGRATED / NOT YET VERIFIED |
| `f8f57aae959e1e6f8d62f8b4c43a27cbf4e57d56` | PR #48 merged, main 4/4 green, Pages updated but deployment pending | SOURCE + MAIN CI VERIFIED / HOST UNVERIFIED |
| `d46426215418bd2a10a1d02a0f4ce85eafceb3e3` | Pages `build` and `deploy` jobs success, exact hosted SHA PASS | RELEASE / HOSTED VERIFIED |

The final Bible content was re-read and contains the most recent release verification entry. Older pending-state entries are **retained on purpose**: they record the chronology and are superseded by the later proof, not deleted or silently rewritten.

### 6.8 Actions NOT executed here

- No local MacBook Git `stage`, `commit`, `push`, reset or checkout was executed. GitHub connector operations wrote directly to the remote repository/branch refs. No local working tree cleanliness was established.
- No physical MacBook editor run, FPS/thermal/GPU profiling or user aesthetic sign-off occurred.
- No code modification to permit arbitrary JavaScript scripting or open the public Pages editor occurred.
- No asset from unsupported other repositories or user-private personal images was automatically committed to the published source.
- No original historical branch or user save was deleted; no force-push or destructive reset was used.
- No full 3D artist/editor GUI beyond the implemented bounded features was created in this continuation. Most code changes were already in PRs #46/#47 from the previous conversation; this conversation's code contribution was **integration and release**, not rewriting their features.
- No new GitHub Actions monitoring automation was created. GitHub's own CI jobs continued remotely while the conversation checked their state.


---

## 7. CURRENT SOURCE, SUBSYSTEM OWNERSHIP AND REPOSITORY MAP

The following paths were inspected on the merged `main` branch at `ce1f33e...`. This is an abbreviated *ownership map*, not an exhaustive tree dump. Most source paths shown below were identified directly by current file reads; detailed behavior comes from source/PRs/tests/Bible together.

```text
westkitty/museum-of-me-vnext/
  README.md                              product, run path, editor and visitor guidance
  OPERATIONAL_STATE.md                   historical operational ledger; header lags current Builder
  package.json                           npm/TypeScript/Vite/Three.js/test scripts
  vite.config.ts                         dev server, runtime base and local-only plugin
  data/
    workshop-placements.json             authoritative source manifest for saved authored placements
  src/
    main.ts                              Vite entry, DEV-only Workshop initialization
    app/
      App.ts                              central museum application and frame-loop ownership
      WorldDirector.ts                    exterior/interior streaming and entrance handoff
    world/
      layout.ts                           authoritative geometry/spatial spine/entrance constants
      CollisionWorld.ts                   dynamic authored collision and floor support
    interaction/
      InteractionManager.ts               existing visitor focus/activation path
    assets/
      ResourceScope.ts                    tracked lifetime of geometry/material resources
    workshop/
      Workshop.ts                         editor UI, inspector, asset shelf, authoring tools/history
      BuilderCamera.ts                    same-scene orbit/dollhouse/top survey and grid
      AuthorableSceneRegistry.ts          registered original authorable scene content
      MuseumPlacements.ts                 authored model/geometry instantiation and placement runtime
      WorkshopSurfaces.ts                 reversible paint/texture of eligible original meshes
      BuilderEvents.ts                    custom message + reversible glow/tint activation
      WallSketch.ts                       two-click snapped independent wall math
      RoomSketch.ts                       two-corner four-wall/floor/optional-roof room math
      WallOpenings.ts                     real doorway/window segmentation and bounds
      builderAssetCatalog.ts              typed search/filter/local resource URL logic
      builderAssets.json                  OpenLife model/finish manifest with provenance/hashes
      schema.ts                           schema v1; object and property validation/serialization
      conservation.ts                     placement/conservation guard contract
      catalog.ts                          authorable prefabs and type registry
  scripts/
    workshop-save-plugin.ts               Vite serve-only loopback save/media/model import endpoints
    build-standalone.mjs                  embedded referenced offline media, integrity checking
    verify-pages-hosted.mjs              HTTP shell/assets/build-SHA/workbench/404 release receipt
    verify-standalone-offline.mjs         standalone static integrity
    standalone-offline-browser.mjs        offline Chromium runtime proof
    runtime-source-qa.mjs                installation/visitor/runtime checks
  public/
    builder-assets/openlife/
      LICENSE.txt                         MIT attribution from source project
      *.glb                               119 total OpenLife catalog models
      *.png                               13 total material finishes
    workshop-media/                       local generated/imported authored WebP references
    workshop-models/                      local imported self-contained GLB references
  docs/
    evidence/builder-openlife-library-2026-11-11.md   asset/provenance proof
  tests/
    builder-asset-library.test.ts
    builder-events.test.ts
    room-sketch.test.ts
    entrance-aperture.test.ts
    workshop-browser/
      builder-assets.workshop.e2e.ts
      builder-architecture.workshop.e2e.ts
      builder-events.workshop.e2e.ts
      builder-room.workshop.e2e.ts
      workshop.workshop.e2e.ts
    browser/
      exterior-doorway-aperture.e2e.ts
  .github/workflows/
    ci.yml                                PR + main full development checks
    deploy-pages.yml                      manual or pages-preview-triggered release pipeline
```

### 7.1 Runtime architecture contract

- **Three.js/WebGL:** `package.json` declares exact `three: 0.185.1` and `@types/three: 0.185.0`. It is a vanilla Three.js/Vite/TypeScript application, not a React game, Godot migration or Canvas-2D fake 3D surface.
- **Build system:** Vite 6 range, TypeScript 5.7 range, Vitest 2.1 range and Playwright test framework in existing dev dependencies. GitHub workflows set up **Node.js 22**.
- **One ownership path:** `App` runs the museum's frame loop; BuilderCamera reuses the existing renderer/canvas and switches controls. It does not spawn an independent ticking Three.js world.
- **Original museum versus authored overlay:** `src/world/layout.ts` and original content/collision own the physical architecture, exhibit anchors, and routes. Builder-created placements/overrides are separate, validated layers. Reveal Original is a comparison tool, not an overwrite or rollback of original geometry.
- **Spatially safe changes:** `conservation.ts` and schema validators check authored placements against protected regions and capacity. Original visitor path and sanctuary access should survive new additions. Runtime tests confirm named protected paths but do not make all possible user placements automatically safe.
- **Resource lifecycle:** model and material clones are owned by `ResourceScope`. A GLB is parsed on demand and affected materials cloned per object for paint/reaction isolation. New authoring features should extend this ownership rather than leak GPU resources on repeated loads.
- **Collision:** Original static colliders remain authoritative. Authored solid objects bind dynamic colliders; transforms invalidate/rebind their footprints. Partition-wall openings use segmented, oriented collision; floor slabs supply reversible support.
- **Interaction:** newly authored object events register in the existing `InteractionManager`; they do not create a parallel keyboard event loop or executable scripting VM.
- **Persistence:** schema version 1 is retained. `data/workshop-placements.json` and referenced locally stored image/model assets are the authoritative source for authored changes. The runtime can consume that source in development, standalone and visitor builds. The local save endpoint does not exist on public Pages.

### 7.2 Local DEV interface versus the published experience

**Editor route on the MacBook running its Vite development server:**

```text
http://127.0.0.1:5173/?edit=1
```

The README documents opening Workshop via visible **BUILD MODE** or **F8**. Normal museum visitor movement is temporarily suppressed while Builder operates, pointer lock is released, then the visitor runtime resumes on exit.

Useful existing Workshop shortcuts documented in README:

```text
W / E / R              move / rotate / scale
G                      snap to supporting floor
Cmd/Ctrl+D             duplicate
Delete                 delete authored selected object
Cmd/Ctrl+Z             undo
Shift+Cmd/Ctrl+Z       redo
Cmd/Ctrl+S             save
```

The editor has a local-only save bridge. Actual authored objects and source-backed display may appear in exported builds after they are intentionally saved/committed, but public Pages does not accept unauthenticated authoring or directly expose `?edit=1` Workshop. A local `127.0.0.1` address refers to **the device running the server**, not a remote phone or another computer.

**Public visitor route:**

```text
https://westkitty.github.io/museum-of-me-vnext/
```

**Public top-down planning view, separate from authoring:**

```text
https://westkitty.github.io/museum-of-me-vnext/workbench/
```

**Read-only QA surface:** historical source indicates `?qa=1` can be available in production; that is distinct from `?edit=1` and must be tested against the currently deployed page if used for a new acceptance claim.

### 7.3 Source drift / documentation warnings

- `README.md` still describes some earlier Workshop Core constraints (e.g., that core edits only safe non-colliding placement objects). Later PRs added controlled collision-backed floors/walls and surface overrides. Treat the new code, schema and CI as more current than an older paragraph. This is a **documentation staleness issue**, not proof the later features are absent.
- `OPERATIONAL_STATE.md` metadata still says `last_updated: 2026-11-04` and has historical V3 entries; current Builder changes and release are more recent. Do not use its header as proof that PR #48 is missing. Any future operational-state refresh must preserve existing history and accurately cite current proof.
- `identity/Museum_of_Me.project-bible.json` was last updated October 29 and contains stale pre-Builder notes. It remains a strong project-identity key but a weak current technical-state snapshot.
- Old Bible ledger entries say PR #45/46/47/48 were pending *at those timestamps*. Later appended entries supersede those status statements. Do not rewrite them; they are chronological evidence.

---

## 8. EXACT FEATURE AND REQUIREMENT TRACEABILITY

The following table prevents the next AI from turning aspiration into a claim of completed functionality.

| User desire / current contract | What actually exists | Evidence level | Remaining work / limitation |
| --- | --- | --- | --- |
| Edit real museum in 3D | DEV Builder over actual Three.js canvas/scene | Source + Chromium verified | External Workbench still separate; no public editor |
| Dollhouse/orbit/top and snaps | BuilderCamera + Workshop inspector | Source + CI verified | Human MacBook usability unverified |
| Select and scale *any* object | Authored prefabs + eligible GLBs/meshes, nonuniform scale and bounded values | Implemented and tested for supported types | Not genuinely arbitrary skinned/instanced/protected world content |
| Wall-mounted imported pictures | Art prefabs, wall anchors, depth/size and validated WebP import | CI verified on source path | No user artwork was imported in this handoff; local real-file UX untested on MacBook |
| Paint walls and objects | Existing eligible scene meshes and authored objects can have local color/texture overrides | PR #42 verified | Cannot arbitrarily reshape original structural geometry; some mesh categories excluded |
| Preview all assets | Search/category shelf and summon into actual view | Tested search/load | Persistent per-item preview/thumbnail for every source asset is a separate future requirement, not proven |
| Search all own repositories | Licensed OpenLife subset 119 GLBs, 13 finishes; local imports | Source + hash tests + browser search | Not every asset in every owned repository; rights/compatibility needed |
| Import arbitrary user models | Bounded self-contained local GLB2 and image/WebP support | Source + CI | Not every format, remote URI, unbounded embedded dependency or publish-by-default |
| Copy/duplicate/delete/transform | Existing authorable object commands and manifest history | Browser + source | Only authored/eligible objects, not original load-bearing architecture |
| Dynamic collisions | Validated authored colliders, moving-object refresh, floor support | Source + unit + browser | Not general-purpose navmesh or topology regeneration |
| Build one wall | Two-click snapped partition wall | PR #43 browser PASS | Not demolishing the museum's existing original walls |
| Build floor and roof | Authorable slabs and panels | PR #43 browser PASS | No general ramp, staircase or integrated architectural compiler |
| Real door/window gaps | Segmented geometry and oriented wall collisions | PR #44 browser/unit PASS | Applies to *authored* partitions, not legacy structural CSG |
| Draw a room | Four walls + floor + optional roof, single Undo | PR #45 browser/unit PASS | Independently editable components; no persistent grouped room entity or automatic connected room graph |
| Attach interactions/messages | Message, glow toggle, tint toggle; literal data and reversible materials | PR #46 and PR #48 Chromium PASS | No arbitrary scripting, branching event graph, user-supplied code or animation timeline |
| One safe frame loop | Existing App loop, BuilderCamera/InteractionManager integration | Static validators + browser suites | Long-term device performance needs physical test |
| Offline operation | Standalone cold browser and source QA pass | Exact integration CI verified | Offline file may differ from hosted JS/CSS distribution; both paths have separate proof |
| Publish merged work | `main` + `pages-preview` + hosted SHA | Fully verified | Does not prove MacBook hardware work or completeness of product aspiration |
| Preserve original museum | Conservation constraints, 6 wings, 35 exhibit slots, Sanctuary, source path tests | Source + CI coverage | Human comparative visual QA still required |
| Support original project identities | Museum project inventory independent of Builder asset catalog | Current repo/Bible context | 119 GLB catalog != number of museum projects/exhibits |
| MacBook Air M1 usability | Stated as practical constraint | UNKNOWN / UNVERIFIED on device | Must inspect actual local setup and representative real-use performance |
| Full Sims-style editor | Bounded feature slices substantially advanced | PARTIAL | Many systems still absent or deliberately excluded |

### 8.1 Save/schema invariants that matter

Current `src/workshop/schema.ts` exposes:

```text
WORKSHOP_SCHEMA_VERSION = 1
WORKSHOP_MAX_OBJECTS = 256
WorkshopEventMode = none | announce | message | toggle-glow | toggle-tint
WorkshopWorldId = exterior | interior | shared
```

This means: **the current authored placement manifest is capped at 256 objects.** A future Auto-Curate or larger asset population cannot simply instantiate hundreds of resident objects or store them all in the existing manifest without an accepted schema/capacity and scene-lifecycle plan. Existing saves and imported artifacts need validation/migration before increasing limits or changing object semantics. The presence of 119 catalog assets does *not* mean 119 objects are currently placed or that the project supports unlimited residency.

### 8.2 Asset provenance contract

Source: https://github.com/westkitty/Life_Sim  
Pinned revision: `2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b`  
Full bundled license: `public/builder-assets/openlife/LICENSE.txt`  
Exact catalog: `src/workshop/builderAssets.json`  
Audit: `docs/evidence/builder-openlife-library-2026-11-11.md`  
Runtime typed adapter: `src/workshop/builderAssetCatalog.ts`

`builderAssets.json` is the actual exhaustive record of IDs, file paths, labels, categories, search tags, sourcePath, revision, SHA256, byte count, nominal dimensions and license. Do not paste or regenerate hundreds of lines of asset metadata from memory. If an asset changes, validate its bytes/hash and provenance in both registry and filesystem; a file with a suggestive name alone is not proof of compatibility or redistribution rights. Keep on-demand loading; do not make the visitor runtime load all 119 GLBs just because they are in the published `public` directory.

The copied OpenLife models include furniture, fixtures, appliances, low-poly characters, pets/animals, vehicles, outdoor props, nature, buildings and objects; examples verified by filenames include `bed_double.glb`, `kitchen_sink.glb`, `pet_dog.glb` and `vehicle_compact.glb`. Treat those as *available selectable assets*, not canonical replacements for authored museum characters or exhibits.

---

## 9. TEST AND RELEASE PROOF MATRIX

### 9.1 The four-job PR/main workflow

File: `.github/workflows/ci.yml`  
Triggers: PRs and pushes to `main` (with CI concurrency grouping to cancel duplicate obsolete runs)  
Jobs:

1. `gate`: `npm ci`, `npm run gate`. The gate includes source collection, TypeScript, ESLint, Vitest, release tooling tests, content/mapping/privacy/frame-loop/hotpath/asset/exhibit/source-parity validations, production Vite build, bundle budget and dist checks.
2. `browser`: after `gate`, dependency audit, production-style build, Chromium installation, `npm run test:e2e` across visitor and relevant Builder browser tests.
3. `workshop`: after `gate`, Chromium installation, `npm run test:workshop` against the local dev-only authoring flow.
4. `standalone`: after `gate`, Chromium installation, `npm run build:standalone` followed by `npm run verify:standalone` (static, fresh offline browser, runtime-source QA).

**Integration head proof:** `43131307314`, success for all four. 791 unit cases / 63 files, 5 workshop, 58 browser, standalone offline 14/14 & 17/17 with zero remote.

**Merged main proof:** `43134575462`, same merged SHA `ce1f33e...`, success for all four. 791 unit cases / 63 files and 58 visitor Chromium cases. Main passing tests means the integrated head remained valid after the GitHub merge; it is not a local MacBook GPU/UX benchmark.

**Earlier feature proof:** #46 `43128684509` (4/4 success), #47 `43130282169` (4/4 success). They should not be rerun solely because historical notes once said pending.

### 9.2 Pages pipeline

File: `.github/workflows/deploy-pages.yml`  
Triggers: manual `workflow_dispatch` or push to dedicated `pages-preview` branch. Ordinary pushes to other feature branches do not publish.  
Pipeline:

- `build`: npm ci, `npm run gate`, production dependency audit, real browser visitor suite, Pages build with `VITE_PUBLIC_BASE=/museum-of-me-vnext/`, Pages output/receipt validation, artifact upload.
- `deploy`: GitHub Pages deployment and authoritative `scripts/verify-pages-hosted.mjs <site_url> <expected_SHA>`.

**Current final proof:** Pages run `43134601183` completed SUCCESS on `ce1f33e...`; both jobs passed. The deploy log's exact receipt is quoted in section 6.6. This is stronger than an assertion that a branch was pushed or a PR merged.

### 9.3 Why the repeated 'in_progress' messages happened

The later integration browser job ran **58 tests in approximately 23.7 minutes**, and the Pages pipeline ran a separate full visitor-browser gate after the main CI suite. The assistant returned repeated status checks because the user asked for status while these remote GitHub Actions were running. The long duration itself was **not evidence of a crash**; the jobs eventually completed green. There was no need to kill/restart the existing jobs or start competing runs. The assistant had no background scheduler working autonomously; it responded to current messages by querying GitHub. GitHub Actions executed independently in the remote CI environment.

---

## 10. KNOWN FIXED REGRESSIONS AND RELEASE-SENSITIVE INVARIANTS

| Incident | Cause actually identified | Correction/proof | Regression to avoid |
| --- | --- | --- | --- |
| Builder camera jumps on entering Build Mode | Initial camera pullback moved targeting/selection | PR #39 revised BuilderCamera target; Chromium Workshop pass | Never move user's view involuntarily on opening editor |
| Local art silently disappears offline | Referenced media absent/broken in single-file build | SHA256 media validation, source-referenced inline embedding, offline proof | Do not substitute unvalidated local `file://` URLs for embedded exported assets |
| Exterior island vanishes on a side path | Global-Z auto interior commit hides exterior root | PR #41 doorway aperture + vestibule + browser test | Never key world visibility solely to portal Z without X/Y real doorway crossing |
| Shared material paint changes unrelated objects | Overlapping material pointers | Per-mesh material clones and Reveal Original support | Do not mutate shared source material directly |
| Moving authored solid object leaves collision in old place | Dynamic AABB not invalidated on gizmo/numeric edit | PR #42 collision invalidation and regression tests | Transform changes must synchronize collision |
| Walls draw incorrectly in actual browser | Initial wall sketch/input path issue and signed-zero yaw case | PR #43 corrected and full CI green | Pure geometric tests are insufficient; use real pointer interaction |
| A 'door' is only a visual mark | Would not allow true passage | PR #44 solid segment compiler + oriented collision | Openings must have actual absent geometry + passable collision gaps |
| Room test types broaden, block typecheck | Test fixtures widened `schemaVersion` / `prefab` | PR #45 fixture typing correction, exact-head 4/4 pass | Re-run exact source head after any test/code edit |
| Object glow bleeds into sibling object | Shared GLB/prefab material | PR #46 per-object clone, restore on second activation | Preserve isolation, baseline material and resource ownership |
| Model library labeled complete prematurely | Initial asset shelf held only 23 of source's 119 | PR #47 96 additional models/9 finishes with SHA and bytes | 119 is OpenLife source inventory, not all project assets |
| Two feature PRs released separately without integration check | PR #47 lacked later main ancestry/rooms; no combined proof | PR #48 two-parent merges, no path overlap, 4/4 exact-head CI | Never interpret separate green checks as merged integration proof |
| Pages SHA inferred from branch push | Branch ref can update before hosted site does | Exact deployed `build-info.json` SHA check in deploy job | Do not declare hosted until `pages hosted: PASS` matches expected SHA |

The `conservation.ts` protections, original structural collision, route safety, single frame loop, offline build and privacy validator are **release-critical**. Any next feature that modifies wall topology, model loading, persistence, input ownership or world transitions must include end-to-end regressions, not only pure unit tests.


---

## 11. IMPORTANT GAPS, EXCLUSIONS AND OPEN QUESTIONS

### 11.1 Things not implemented (do not disguise as regressions)

**Legacy structural editing:** Original load-bearing museum walls, ramps, stairs, roofs, central Rotunda, sanctuary-critical geometry and source-authored navigation are protected. The new Builder can paint eligible original meshes and create/modify *new authored* architectural pieces. It does not cut arbitrary existing walls or remake protected layout/collision/wayfinding to accommodate demolition. This was a conscious preservation boundary, not an unnoticed missing line of code.

**Full house architecture semantics:** A two-click room is a set of 5-6 individually editable primitives, not an authoritative floor-plan graph with room ownership, connected walls, multi-level topology, openings that remain correct under adjoining-wall edits, or automatically generated circulation/navmesh. Arbitrary sloped floors, true roof cutaway/isolation, multi-floor stairs and structural demolition are not part of the certified slice.

**Every selectable mesh:** Raycast editing of normal eligible meshes is not universal vertex/morph/rig editing. Skinned models, instanced foliage and other renderer-specific representations need their own safe object-adapter and disposal/transform approach. The 119 source GLBs are catalog inputs, not proof that every in-scene entity can be transformed without limits.

**User scripting:** PR #46 implements only an allowlisted, data-driven set of reactions. There is no arbitrary JS script, sandbox runtime, general programmable action graph, state machine editor, complex event branching, shared visitor quests or persistent on/off event-state proof. Untrusted scripting was intentionally excluded for local data integrity, privacy, security and reproducibility.

**Asset universality and previews:** The complete OpenLife 119-model shelf is not an inventory of all art/models from every project, and the current source/tests do not prove an independently previewable thumbnail for every model. Source rights, format conversion, scale, artistic quality, provenance and per-item display are separate pieces of work.

**Model-assisted furnishing and systemic curation:** No verified automatic aesthetically intelligent furnishing or clearance solver; no acceptance proof of curated layout generation, visitor evaluation, rollback of auto-placed drafts, automatic exhibit conversion, persistent curatorial learning or semantic placement system in the bounded PR #48 release.

**Physical-device quality:** No fresh on-device FPS, 1% low frame time, MacBook memory pressure/thermal test, GPU peak, long editor session, touch quality, or final owner judgment of look/feel in the Builder itself. GitHub's Chromium CI and source validators are not a substitute.

**Local Git state:** GitHub remote branches are synchronized, but the MacBook filesystem checkout might be behind, dirty or contain user work. No local `git status`, local `npm ci`, local `npm run dev`, or local Git stage/commit/push was carried out in this continuation. Do not silently run reset/clean/pull over uncommitted work.

### 11.2 Adjacent later design exploration, NOT part of this completed release

Separate, related conversations around the same period considered a much larger Builder future: prioritizing approximately **200 featured** museum-appropriate assets while still keeping the full underlying searchable source inventory accessible; actual preview for each selectable asset; placing assets with clearance and site-specific context rather than decorating blindly; Auto-Curate & Clear; and proposed systems such as curator memory, visitor-evaluation loops, exhibit kits, narrative placement/gravity, meaningful object behavior and health checks. One later discussion referenced a broader **1,883-model** inventory. These are **separate planning/research directions**; the entire referenced source set, per-item rights, exact counts, UI implementation and CI validation are not part of PR #48. Do not silently upgrade them to IMPLEMENTED merely because the user talked about them. The previous conversation's concrete shipped scope was the 119-model OpenLife shelf and bounded editing features.

A separate operational discussion also examined the concern that a browser-based GPT Builder session appeared to be running while the user's MacBook/DEX//REACH stack was under pressure. This handoff does not claim that remote ChatGPT code or GitHub Actions ran locally on the MacBook. The MacBook's actual process tree/resource pressure and whether a DEX//REACH job was running are separate diagnostic questions, not an established cause of CI runtime.

### 11.3 Open questions that need new real-world evidence

| Question | Why it matters | Decisive evidence |
| --- | --- | --- |
| Is the physical MacBook repository synced to `ce1f33e`? | User may see an older Builder or have uncommitted work | Read-only `git status`, `git rev-parse`, `git branch -vv`, `git ls-remote` in the verified local repo |
| Does the Builder launch, select, paint, import, save and restore on that MacBook? | Hosted CI != owner device | Actual Vite `?edit=1` inspection and annotated smoke-test result |
| Does FPS/memory remain acceptable with several GLBs + reactions + room tools? | M1 8 GB practical constraint | Device-level repeatable frame-time and resource samples at matched quality tier |
| Do new room walls/doors preserve readable traversal for a real human? | Browser fixtures are bounded cases | Walk through authored doorway/room, test read zones and exit/entry |
| Is every catalog model suitable/accurate for this museum? | Hash validity != visual/semantic suitability | Selected-item preview, license/source inspection, owner aesthetic review |
| Are locally imported personal files present in user's checkout? | Privacy/publication risks | Inspect `data/workshop-placements.json` refs and `public/workshop-*` contents locally without uploading them |
| Are there new changes beyond the recorded cut-off? | GitHub branches and actions are mutable | Fresh read-only GitHub branch/PR/Actions/Bible comparison before consequential work |
| Does the user want true original-wall structural editing or the current safe overlay? | Major change in architecture/conservation semantics | Explicit design/authority decision, prototype and rollback plan |
| Should future large-scale curation exceed the 256-object save cap? | Persistence, memory and streaming consequences | Accepted capacity/residency model, schema tests and representative load scenario |
| Should external `/workbench/` actually become the same editor UI? | Presently a separate read-only planning surface | Explicit design acceptance and protected-path migration plan |

---

## 12. FRAGILE AREAS AND PROTECTED SURFACES

| Area/path | Risk | Required handling |
| --- | --- | --- |
| `src/world/layout.ts` | Canonical geometry/collision/world map/threshold relationships | Never change an aperture or layout position without checking renderer, route, collision, waypoint and streaming consumers |
| `src/app/WorldDirector.ts` | Previous Z-only bug could hide exterior on side path | Retain real X/Y/Z aperture gating, prewarm/commit separation and reverse traversal regression |
| `src/app/App.ts` / single frame loop | Another loop or eager world load can cause large performance/behavior regressions | Keep one frame-loop owner; test world transition, idle/hidden lifecycle and teardown |
| `src/world/CollisionWorld.ts` | Invisible floors, stale AABBs, non-passable doorway voids | Test rotated footprint, transformation refresh, door gap, removal and protected static collision |
| `src/workshop/schema.ts` | V1 save compatibility and 256-object maximum | Treat schema changes as data migrations; never break existing saved placements silently |
| `data/workshop-placements.json` | User-authored source-of-truth placements | Back up/export before editing, revalidate conservation, never replace destructively without provenance |
| `scripts/workshop-save-plugin.ts` | Local write path, host/origin and content-addressed file validation | Preserve serve-only loopback/same-origin and path/hash/size guards; no unauthenticated remote edit |
| `src/workshop/MuseumPlacements.ts` | GLB loading, interaction, scope/disposal, dynamic geometry/collision | Update tests when changing object construction or teardown; preserve original scene authority |
| `src/workshop/WorkshopSurfaces.ts` | Material pointers and persisted source mesh identifiers | Material cloning and deterministic stable IDs; never let one repaint bleed into unrelated surfaces |
| `src/workshop/BuilderEvents.ts` | Reversible material state; late-loaded GLB children | Keep cloned-material baseline and restore semantics; no eval or cross-object side effects |
| `src/workshop/RoomSketch.ts` / `WallOpenings.ts` | Geometry/topology and colliders must agree | Pure numeric invariants + actual Chromium authoring/passage journey |
| `src/workshop/builderAssets.json` and source GLB/PNG files | Source rights, hashes, category/paths, deployed bytes | Pin original source revision, verify all bytes, preserve MIT attribution, avoid hotlinking |
| `.github/workflows/ci.yml` / `deploy-pages.yml` | Release gate and public publication | Never bypass/cancel checks to publish source; use exact SHA and non-forced branch updates |
| `scripts/verify-pages-hosted.mjs` / `build-info.json` | Final source-vs-hosted truth | Do not water down expected-SHA validation or treat branch head as hosted proof |
| `OPERATIONAL_STATE.md` and canonical Museum Bible | Durable history and user decisions; old entries are evidence | Append corrections; do not rewrite historical uncertainty into false success |
| Dexter Sanctuary / 35 exhibit slots / six wings | Museum purpose and curated content | Protect from generic asset overpopulation and accidental demo substitutions |

**Hard do-not-touch rules without a separate accepted decision:** No forced Git branch reset, no silent deletion of prior PRs/commits/locally imported art, no publishing unknown private media, no remote file-write bridge in Pages, no universal untrusted scripting, no replacing the museum's real WebGL renderer, no rewriting source-authoritative circulation into decorative proxies, no adding a second render loop, and no destructive migration of saved manifests just to enlarge the catalog.

---

## 13. AUTHORITATIVE LINKS, IDENTIFIERS AND RELEASE HISTORY

### 13.1 Repository and identity

- Implementation repo: https://github.com/westkitty/museum-of-me-vnext
- Canonical Bible repo: https://github.com/westkitty/ChatGPT_Bible_Repo
- Bible: `bibles/Museum_of_Me_Bible.md`
- Identity: `identity/Museum_of_Me.project-bible.json`
- Product URL: https://westkitty.github.io/museum-of-me-vnext/
- Release commit: `ce1f33e09e0c89245f9cf17a00a332c1025b49da`
- Combined integration feature head: `50c27b1538a4cfc4f580d260370cdf2bb87ac763`
- Integration branch: `integration/builder-events-openlife-20261111`
- Prior already-hosted room baseline: `669e5970e6c523aa4c3fa5ee32982dd9d28b317d`
- OpenLife pinned source: `2e8255d6743ebfbb8e51ab7b8dc3f9ca1e665d3b`
- After-release Bible commit: `d46426215418bd2a10a1d02a0f4ce85eafceb3e3`

### 13.2 PRs and full merge revisions

| PR | Purpose | Head SHA | Mainline integration SHA | Status |
| --- | --- | --- | --- | --- |
| [#39](https://github.com/westkitty/museum-of-me-vnext/pull/39) | Unified Home Plan-inspired Builder | `eaf4504ecdd52f90dd82bdc66e7be1ffa37508d0` | `8a1fbd5e54cbf236359030fe3a5e58269035ea2f` | Merged; Pages previously verified |
| [#40](https://github.com/westkitty/museum-of-me-vnext/pull/40) | Exterior stale-PR reconciliation | `a121c6288d61afc8cec597ac2b46648cff9ae44f` | `fe3a133fa5b0c2e040cab37e29730109194cd2eb` | Merged; Pages previously verified |
| [#41](https://github.com/westkitty/museum-of-me-vnext/pull/41) | Off-axis doorway / island disappearance | `f523eb4c547bb123ab6260aa56600cfa0c1fd80e` | `9c0067eafa62b11840a71f4f69241866d818b2fb` | Merged, CI verified |
| [#42](https://github.com/westkitty/museum-of-me-vnext/pull/42) | 23 GLBs / four finishes / wall paint/import | `8a6c5e5b05e6dee8f02ff382287313baa1eed392` | `217e371c3486e8bc0219fb59a091f951410b2976` | Merged; Pages previously verified |
| [#43](https://github.com/westkitty/museum-of-me-vnext/pull/43) | Draw walls/floors/roof | `9731ca299cae21faa3afbdccba0326aef9e32f8e` | `a7bcf0f870f6d4b7418cf0f1d106f60bb6e3042f` | Merged; Pages previously verified |
| [#44](https://github.com/westkitty/museum-of-me-vnext/pull/44) | Real door/window gaps and collision | `209ba32555f24b5dd177b33e9b15cef4a7d19c79` | `3753c4f94b9c09ddf50b2e4c60a99900fcc34dd0` | Merged; Pages previously verified |
| [#45](https://github.com/westkitty/museum-of-me-vnext/pull/45) | Two-click rooms | `0d202ada200edd21bb0108aeacbb534b7066e341` | `669e5970e6c523aa4c3fa5ee32982dd9d28b317d` | Merged; Pages previously verified |
| [#46](https://github.com/westkitty/museum-of-me-vnext/pull/46) | Messages and reversible reactions | `c5e8c0b3a1003948372e7faa34e70ad284d2d2a1` | `52c00b56a549e79cc6a53d9c68652b955fb15e07` (integrating parent) | Merged by ancestry through #48 |
| [#47](https://github.com/westkitty/museum-of-me-vnext/pull/47) | Full 119 OpenLife / 13 finishes | `f6bdb8b2c11a902693c431c8b536f301ec80e805` | `50c27b1538a4cfc4f580d260370cdf2bb87ac763` (integrating parent) | Merged by ancestry through #48 |
| [#48](https://github.com/westkitty/museum-of-me-vnext/pull/48) | Combined #46/#47 integration | `50c27b1538a4cfc4f580d260370cdf2bb87ac763` | `ce1f33e09e0c89245f9cf17a00a332c1025b49da` | Merged; main CI + Pages verified |

The feature heads in rows #46/#47 are **parents in the combined integration history**, not evidence that three independent unrelated releases occurred. The final published version is the one combined `ce1f33e` release.

### 13.3 High-value workflow receipts

| Subject | Run URL | What it proves |
| --- | --- | --- |
| Initial unified Builder | https://github.com/westkitty/museum-of-me-vnext/actions/runs/42936151331 | PR #39 feature-head 4/4 checks |
| Initial Builder hosted | https://github.com/westkitty/museum-of-me-vnext/actions/runs/42939225816 | PR #39 Pages SHA |
| PR inventory | https://github.com/westkitty/museum-of-me-vnext/actions/runs/42952384816 | PR #40 hosted SHA |
| Asset library initial | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43002224382 | PR #42 exact-head 4/4 |
| Asset library initial hosted | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43011540139 | PR #42 Pages SHA |
| Authored geometry | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43015477653 | PR #43 4/4 |
| Authored geometry hosted | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43018681207 | PR #43 Pages SHA |
| Wall openings | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43020684900 | PR #44 4/4 |
| Wall openings hosted | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43125365764 | PR #44 Pages SHA |
| Two-click room | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43126006561 | PR #45 4/4 |
| Two-click room hosted | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43127816735 | Previous latest Pages SHA `669e5970` |
| Object reactions | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43128684509 | PR #46 4/4 |
| 119/13 OpenLife shelf | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43130282169 | PR #47 4/4 |
| Combined integration | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43131307314 | PR #48 4/4, exact integrated head |
| New merged main | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134575462 | Current `main`, 4/4, 791 unit + 58 browser |
| FINAL Pages | https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134601183 | `ce1f33e...` hosted SHA PASS in deploy job `130915977827` |


---

## 14. NEXT-STEP QUEUE FOR A SUCCESSOR (NOT PERMISSION TO EXPAND SCOPE SILENTLY)

### Phase 0 - establish exact current state, without modification

1. Read the **latest** `bibles/Museum_of_Me_Bible.md` and the project-local `OPERATIONAL_STATE.md`. Apply the append-only distinction between source, verified, planned and brainstormed states.
2. Read fresh GitHub PR/branch/Actions data; confirm whether `main` and `pages-preview` still equal `ce1f33e...` or have legitimately advanced since this handoff.
3. Confirm the release run `43134601183` is still successful and its deploy job contains the matching `pages hosted: PASS` line. Do not re-run Pages simply because an old chat said pending.
4. Check the physical MacBook's **actual repo identity and working-tree status** before pulling or installing. Do not assume the current browser ChatGPT session and repository CI share files/processes.
5. Inspect `data/workshop-placements.json` and any local `public/workshop-media` or `workshop-models` references *without copying user assets into this chat or public commits*. Preserve local uncommitted state before a sync decision.

These checks should precede any further source change. They will distinguish a legitimate new task from a stale handoff replay.

### Phase 1 - first owner-visible MacBook Builder smoke test

The bounded code/release milestone is finished. The highest-value next proof is a fresh human-visible local editor journey, because it is the remaining material difference between CI and actual user success.

Suggested **scratch-only** manual sequence after verifying the physical checkout, existing saves and dependency environment:

1. Open the local Vite server at `http://127.0.0.1:5173/?edit=1`; enter BUILD MODE with the visible control/F8. Confirm the current viewpoint and selection do not jump.
2. Check top/dollhouse/orbit modes, grid snaps, object gizmo position/rotation/scale, Undo/Redo and `Reveal Original`.
3. Search 119-model shelf by name/category. Summon at least one newly added OpenLife GLB, verify visual model appears, transform it, change finish and verify no other mesh unexpectedly changes.
4. Draw an authored wall; open a valid doorway and window in scratch space; inspect the gap; physically walk/try collision against it after leaving Build Mode.
5. Draw a valid 2-click room and optional roof. One Undo should remove all generated components, one Redo restore them, and individual walls should remain independently editable.
6. Place a sphere or eligible GLB, assign `toggle-glow`/`toggle-tint` and a literal message, return to visitor mode, activate twice and verify exact restoration. Try a sibling with shared base material to ensure no bleed.
7. Save a **scratch** placement manifest in the controlled local workflow (after backup), reload the visitor build, confirm configured placement/action persistence and return to the original authored state if desired. Do not overwrite a cherished existing museum save casually.
8. Walk external side path, actual doorway and interior return to confirm the previously repaired off-axis world-switch issue does not visibly recur.
9. Note MacBook Air M1 frame pacing, memory pressure and editor responsiveness with multiple instances of the selected GLB and with room tools open. If source code differs or local testing fails, record exact revision and reproduction before editing.

This is a proposed **manual next verification**, NOT evidence these steps were performed by this handoff.

### Phase 2 - clarify future product target before architectural expansion

Do not use the phrase "finish the Sims Builder" as carte blanche to rework the entire museum. Ask which of the following independently accepted milestones is now desired: (a) polish/strengthen existing bounded Builder UX, (b) broaden the licensed model catalog and per-asset previews, (c) create model-assisted Auto-Curate with clearance validation, or (d) design real structural-authority editing of legacy walls and connected rooms. Each is materially different in risk. Preserve the current safe release as rollback baseline.

If the user selects a new implementation milestone, use one isolated feature branch with clear source provenance, functional acceptance, privacy/collision proof, exact-head four-job CI, non-forced merge and Pages release. Do not automatically publish new imported personal images/models.

### Phase 3 - improvement backlogs to consider only after Phase 1 acceptance

- Catalog expansion across additional repositories with explicit per-item license, hashes, file formats, de-duplication, thumbnails/previews and load budgets.
- Object residency and virtualized asset shelf, including safe behavior beyond the current `WORKSHOP_MAX_OBJECTS=256` cap, if actually required.
- Spatial clearance, traversal and interpretive-space constraints on automated/mass furnishing. Keep reversible preview and manual overrides; avoid clutter and blocked visitor routes.
- A true model-first connected room/wall semantic graph only with a strong conservation/collision/nav migration plan.
- More expressive but still bounded visitor interactions, if the user wants them, using an authored event contract rather than arbitrary JS execution.
- Device-level profile, accessible keyboard/touch authoring and graceful quality-tier behavior.
- A documentation/state-ledger synchronization pass for old README/OPERATIONAL_STATE metadata, performed additively and evidence-bound, not as a substitute for actual code/runtime testing.

---

## 15. SAFE COMMANDS AND EVIDENCE-ONLY CHECKS

**Machine:** Physical MacBook, inside the *real verified checkout* of `westkitty/museum-of-me-vnext`. The historical OPERATIONAL_STATE mentions a local root under `/Users/andrew/museum of me/museum-of-me-vnext`, but that path was NOT independently verified in this conversation. Navigate to the real repository first; do not trust a copied command to identify the machine.

### 15.1 Read-only local identity and cleanliness

```bash
pwd
git status --short --branch
git rev-parse HEAD
git branch --show-current
git remote -v
git ls-remote origin refs/heads/main refs/heads/pages-preview
```

**Purpose:** distinguish correct machine, correct repo, branch, uncommitted work and remote heads before any change. `git ls-remote` reads remote refs and does not change the working tree. **Not a cleanup command.** Do not follow a dirty-tree result with a blind reset, clean or pull.

### 15.2 Existing local code checks, after confirming no risk to local work

```bash
npm ci
npm run typecheck
npm run lint
npm test
```

`npm ci` installs exact lockfile dependencies and changes the local dependency directory. This is NOT read-only and should be run only in the proper verified checkout. `npm test` does not equal a browser runtime proof. For the canonical source CI gate use the project-defined `npm run gate`; it is resource-intensive and performs multiple validation/build tasks. Do not assume `npm ci` is appropriate when disk space/memory are constrained or a local agent job is already active.

### 15.3 Local Builder launch after dependency and state review

```bash
npm run dev
```

Then open `http://127.0.0.1:5173/?edit=1` **on that same MacBook**. The command starts a Vite server and rebuilds the collection source; it is not a read-only status probe. For a detailed regression run use existing `npm run test:workshop` and `npm run test:e2e` only when appropriate dependencies and Chromium are available, and avoid overlapping resource-heavy test runs on the 8 GB device.

### 15.4 Useful read-only URLs

```text
https://github.com/westkitty/museum-of-me-vnext/pull/48
https://github.com/westkitty/museum-of-me-vnext/actions/runs/43131307314
https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134575462
https://github.com/westkitty/museum-of-me-vnext/actions/runs/43134601183
https://westkitty.github.io/museum-of-me-vnext/
```

The Pages verification script itself accepts a site URL and an expected SHA, but it is an additional active HTTP check rather than a substitute for inspecting the existing successful deployment log. Run it from the correct local/CI environment when explicitly revalidating a changed deployment:

```bash
node scripts/verify-pages-hosted.mjs "https://westkitty.github.io/museum-of-me-vnext/" "ce1f33e09e0c89245f9cf17a00a332c1025b49da"
```

If the site has since legitimately advanced to a newer commit, an old expected SHA must fail; investigate freshness before treating that as a regression. Do not use `--force`, `git reset --hard` or destructive file cleanup as a normal continuation step.

---

## 16. CONFIDENCE AND CONTRADICTION RECORD

| Claim | Classification | Explanation |
| --- | --- | --- |
| All ten Builder/integration PRs #39-#48 have been merged | CONFIRMED | Current GitHub PR metadata shows merged, with exact integration ancestry for #46/#47 |
| The unified Builder release source is on remote `main` | CONFIRMED | Main SHA `ce1f33e...` read directly |
| `pages-preview` matches `main` | CONFIRMED at cutoff | Both branch readbacks exactly `ce1f33e...` |
| PR #48 exact-head integration tests passed | VERIFIED | Run `43131307314`, all 4 jobs green and logs read |
| Merge commit independent CI passed | VERIFIED | Run `43134575462`, all 4 jobs green |
| New GitHub Pages source was published | VERIFIED | Run `43134601183`, `pages hosted: PASS`, matching SHA |
| Complete OpenLife catalog 119/13 is in source | VERIFIED for scoped registry/assets | `builderAssets.json`, exact Git blob metadata, SHA tests and 119-result browser search |
| All 119 models have distinct artistic appearance | UNKNOWN / NOT CLAIMED | Some asset variants share identical blob hashes |
| Public Pages allows live Builder editing | FALSE / CONTRADICTED | Workshop and save plugin gated to Vite DEV; Pages is visitor-only |
| The physical MacBook has the latest source checked out | UNKNOWN | No local `git status` or checkout verification in this thread |
| A physical MacBook owner has tested the Builder visually | UNKNOWN | Not performed or supported by current evidence |
| Current code is a full Sims editor with all geometry mutable | FALSE / NOT IMPLEMENTED | Original structure and other object categories protected; no room graph/navmesh |
| Browser suite running for a long time meant the job had crashed | NOT ESTABLISHED | It eventually finished success; duration alone was not failure proof |
| Older Bible entries marked PR #48 pending | HISTORICAL, SUPERSEDED | Later append-only entry confirms completion; do not delete historical entry |
| `OPERATIONAL_STATE.md` proves the latest Builder CI status | STALE FOR THIS PURPOSE | Its frontmatter predates this release; use exact CI + current Bible |
| Hosted SHA PASS proves MacBook GPU performance | FALSE | Server-side HTTP and Ubuntu Chromium tests do not measure M1 device thermals/FPS |
| The full original predecessor-chat transcript was read verbatim | FALSE | Selective retrieval and canonical ledger, not one full transcript export |

If fresh evidence contradicts this report, record the **new evidence, affected exact claim, current authoritative SHA and correction** rather than silently rewriting the past. Prefer current repository/runtime to inferred history for present technical state; prefer explicit user decisions to assistant-invented future feature scope.

---

## 17. SUCCESSOR-AI CONTINUATION INSTRUCTION (ONE COPYABLE CONTRACT)

The following is a complete optional continuation instruction for a new GPT session or coding agent. It is intentionally read-first and conservative; it does not authorize unsolicited implementation, cleanup or release work. The current bounded release is already finished.

```text
PROJECT: Museum of Me / The Reliquary of Iterative Becoming vNext
TARGET: westkitty/museum-of-me-vnext
CANONICAL BIBLE: westkitty/ChatGPT_Bible_Repo/bibles/Museum_of_Me_Bible.md

You are continuing an already merged and successfully deployed Builder workstream.

FREEZE THE VERIFIED BASELINE:
- Published main/pages-preview SHA at handoff: ce1f33e09e0c89245f9cf17a00a332c1025b49da.
- PR #48 (integration of PR #46 object messages/glow/tint and PR #47 119 OpenLife models/13 finishes) was merged successfully.
- Combined exact-head CI 43131307314: 4/4 success; 791 unit tests/63 files, 5 Workshop Chromium tests, 58 visitor Chromium cases, offline source QA 14/14 installations, 17/17 visitors, zero remote requests.
- Main CI 43134575462: 4/4 success at the merged commit.
- Pages workflow 43134601183: build and deploy success, hosted verifier confirmed exact deployed SHA ce1f33e09e0c89245f9cf17a00a332c1025b49da.
- Canonical Bible includes the release closure append committed at d46426215418bd2a10a1d02a0f4ce85eafceb3e3.

DO NOT RE-DO OR MISREPORT:
- Do not say PR #46/#47/#48 are still open or Pages pending based on stale chat/Bible entries.
- Do not remerge, force-push, re-deploy or rerun long CI without a new evidence-based reason.
- Do not equate public Pages with the DEV-only ?edit=1 Builder.
- Do not claim complete Sims parity, MacBook device verification or user acceptance.
- Do not modify/delete protected original museum walls, routes, exhibits, six wings, Dexter Sanctuary, source data or private assets without an explicit scoped user decision.
- No arbitrary script injection, second Three.js render loop, external runtime asset hotlinking, or user personal artwork publication.

READ FIRST:
1. This handoff, then the latest canonical Bible and repository OPERATIONAL_STATE.
2. Current PR and branch/CI/Pages evidence. Current source wins for implementation truth.
3. src/main.ts; src/workshop/Workshop.ts, BuilderCamera.ts, MuseumPlacements.ts, WorkshopSurfaces.ts, BuilderEvents.ts, schema.ts, RoomSketch.ts, WallOpenings.ts, builderAssetCatalog.ts / builderAssets.json, conservation.ts.
4. src/world/layout.ts, src/app/WorldDirector.ts, src/world/CollisionWorld.ts, scripts/workshop-save-plugin.ts, .github/workflows and current regression tests.

CURRENT VERIFIED IMPLEMENTATION:
- DEV-only real-scene editor; transform gizmos/snap, selected-object size/depth, local WebP/artwork and GLB import, paint eligible original static surfaces non-destructively, undo/redo/save/reveal original.
- 119 pinned MIT OpenLife source GLBs and 13 local PNG finishes, on-demand source catalog with provenance/hashes.
- Real two-click authored walls/floor/roof, door/window voids with oriented collision, and two-click rooms (four walls+floor+optional roof, one Undo).
- Bounded literal custom message, toggle-glow and toggle-tint events through the existing InteractionManager, reversible per-object material clones.
- Previously fixed side-path doorway world-switch bug.
- Schema v1, WORKSHOP_MAX_OBJECTS=256.

CURRENT UNVERIFIED/ABSENT:
- Physical MacBook Air M1 8 GB working-tree state, hardware performance, end-user visual approval.
- Arbitrary original-wall demolition/repositioning, connected room/navmesh, skinned/instanced arbitrary editing, universal per-item thumbnail previews, arbitrary scripts and true full Sims parity.
- Any broader 1,883-item catalog or Auto-Curate/visitor-judgment proposal is planning, not PR #48 source proof.

NEXT ACTION ONLY IF ASKED:
- First run read-only repository + MacBook identity/dirty-tree checks; then arrange a scratch-mode local ?edit=1 manual smoke test to confirm the existing release is usable on the target device.
- If a specific bug appears, reproduce it and make only a bounded fix in an isolated branch, with exact source/CI/Pages proof.
- If the user asks to expand capabilities, obtain/derive a concrete milestone and preserve existing conservation, privacy, offline and visitor journey contracts.
- Append verified meaningful changes to the canonical Bible; never erase old historical entries.

STOP CONDITIONS:
- Stop if the intended machine, checkout or save authority is uncertain; preserve user files.
- Stop if an asset lacks verified license or real bytes, a proposed edit jeopardizes original architecture, or a release gate fails.
- Do not promote a BRAINSTORMED or PLANNED feature to IMPLEMENTED/VERIFIED without new evidence.
```

---

## 18. FINAL HANDOFF VERDICT

**Scoped feature implementation/integration/release:** VERIFIED COMPLETE.  
**Hosted latest SHA:** `ce1f33e09e0c89245f9cf17a00a332c1025b49da`.  
**Published Museum of Me:** https://westkitty.github.io/museum-of-me-vnext/  
**Canonical Bible release entry:** verified append-only write at `d46426215418bd2a10a1d02a0f4ce85eafceb3e3`.  
**Broader unlimited Sims-style Builder goal:** PARTIALLY IMPLEMENTED, NOT COMPLETE.  
**Highest-risk future work:** original structural geometry/collision/route editing, persistence/residency expansion beyond 256 authored objects, and private local-data publication boundary.  
**Most decisive next proof:** owner-observed local MacBook Vite Builder walkthrough and actual device resource measurements.

**Do not confuse this result with the historical single-file Reliquary restoration project.** This document is specifically about the GitHub-backed **Museum of Me vNext** Builder workstream. The project is not finished as a whole; the requested PR #46/#47 integration and Pages release **are** finished and proven.

