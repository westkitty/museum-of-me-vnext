# Exterior S5: Shoreline-Authored Forest Belt — 2026-11-04

**Status:** Independent reversible candidate on draft child branch `feat/exterior-forest-belt-visibility-20261104`, parent source `92de69b31ad55290b21258eacba16355a58575f7` (S4 PR #34). Neither this feature nor S4 has owner aesthetic approval.

## Evidence and reason for change
S3's approved *machine tests* validated foliage lobe instancing, but the matched real S2/S3 screenshots demonstrated minimal visual impact (west 1.19% meaningful pixel delta; overhead 0.06%); canopies remain scattered isolated islands of trees. Do not keep adding foliage centred on the same trees.

## One bounded change
Generate irregular low-poly forest crowns in 2/3/4 quality-tier lanes along the *authored island shoreline polygon*, **inward** only. Lane centres are jittered deterministically, with repeated mask checks for dry land and 6.4m footprint, 10.5m from existing path centreline, building, entrance/pier, lagoon, and northwest spire garden. Continuous forest coverage should emerge from overlapping crowns, not new navigation blockers. The layer is a single `InstancedMesh` and has no colliders, no new floor support, animation loop, textures, expensive shadow or new physical tree positions. Existing 68/112/176 trunks and previous S3 infill are unchanged.

## Evidence/acceptance
1. Canonical development gate; Workshop; standalone/offline; full Chromium visitor-path gate.
2. **Seven unchanged camera poses**, original filenames, full-resolution PNGs with independent hash/bytes/viewport manifest. Must inspect `04-west-woodland.png`, `05-high-topdown.png`, `01-pier-arrival.png`, then the other four. Compare against parent S4 and S3 actual application screenshots.
3. Observe a meaningful forest-continuity uplift, dark natural canopy variation and clear visitor routes/architectural skyline. Reject if forest becomes a hedge ring, too smooth, too dark, covers landmarks or costs too many tris.
4. Human aesthetic and representative-device FPS are independent unknowns; CI green is not sign-off.

No changes to the site outline, lagoon hole, island physics, pier spawn, threshold, six wings, 35 exhibits, Sanctuary, `main`, or Pages.

## S5b candidate: twofold forests and nature, requested for final public release

Twofold **accepted visual forest** relative to S5 sampled sites (independent deterministic calibration, browser confirmation required): low 213 → 429, medium 358 → 731, high 513 → 1041. The original physically colliding trunks remain 68/112/176, with no extra locomotion barriers. Understory candidate density attempts double from 1/2/3 to 2/4/6 per trunk; shoreline rock target attempts double from 24/48/72 to 48/96/144, each using existing single InstancedMesh rather than new draw calls. Geographic masks, path clearance, stable seeds and quality tiers must remain intact.

S4 visually failing synthetic water ripples and rectangular surf are corrected in the same bounded release candidate: smooth-noise warped and subdued 128² static lagoon texture, and six-vertex tapered broken surf wedges. No time-based shader, external textures, collision, physical site changes, extra source animation loop, or API requests. This is **IMPLEMENTED SOURCE CANDIDATE**, not proof of appearance. Require all four CI jobs on final source head, exact seven-camera full-size Chromium images with hash/size manifest, separate comparison against S4/S5 and performance budgets. Keep main and Pages untouched if any required gate fails; if all pass, publish only the explicitly requested release via existing main and pages-preview fast-forward route, and verify hosted SHA.


## S5c visual and performance correction — 2026-11-04

**Observed before-state (S5b, exact source `e4005156`):** Four CI checks passed, but seven real Chromium images proved the added belt reads as a very regular waterfront hedge, with only 4.54% materially changed overhead pixels and 0.24% in the west view. The portrait screenshot was only 2.7 kB, effectively black, even though the former browser test passed. Increasing foliage geometry by ~56% for that result is not an accepted uplift. Keep S5b unmerged and un-deployed.

**S5c bounded repair:** The same safe vegetation masks and physical-collider counts now govern jittered *whole-island* wooded patches, not uniform coastal lanes. Exact geometric site simulation predicts 438 low, 725 medium, 1040 high independent ground-cover crowns, all >2× original S5's 213/358/513, spread across all four quadrants while preserving the site, paths, museum, lagoon, pier and spire garden. One InstancedMesh remains, with larger size variation; low tier switches belt geometry from 80 to 20 triangles per crown for materially lower GPU geometry pressure. Browser portrait capture explicitly settles and reapplies responsive resize, checks WebGL context, and rejects a near-black screenshot via its PNG byte floor. This is SOURCE CANDIDATE only until the new exact-head four-job CI and seven-camera visual comparison pass. Do not publish a black mobile view, a hedge ring or foliage obstructing the authored visitor route.
