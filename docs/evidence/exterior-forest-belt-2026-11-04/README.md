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
