# Build Mode, Blood Ring and water repair — checkpoint 1

## TodoCheckpointDraft

- Completed: task-start snapshot; required UI/world source readback; root-cause identification for automatic Workshop activation and camera-following painted Blood Band/single-frequency water.
- Active slice: final verification and closeout.
- Completed: explicit inactive Build Mode toggle and shared input ownership; physical orbital ring; smooth reduced-motion-aware water; focused regression coverage; browser, gate, standalone and audit validation.
- Pending: final scoped staging, commit/push and exact-head CI; post-CI truth-record hash update if needed.
- Next step: stage only task-owned paths, commit, push the exact branch, and inspect the resulting CI head.

## Evidence

- Starting HEAD: `c91a2e2de2bc55724be6a21ce2386c6e40b863fd`.
- Worktree was clean and synchronized before edits.
- `Workshop` constructor currently calls `open()`; `open()` releases pointer lock, captures UI input and freezes the player.
- `HUD.setPointerLocked(false)` currently exposes the full-screen entry prompt without awareness of Workshop ownership.
- `Sky.follow(camera)` currently recentres the dome on the camera and its fragment shader contains the Blood Band.
- `ArrivalGarden` currently animates water through one high-frequency diagonal ripple expression in the existing variable-step update.
- Current implementation removes the painted Blood Band, adds a tracked world-relative `TorusGeometry` Blood Ring with `MeshPhysicalMaterial`, and replaces the water stripe with low-frequency noise/fBm motion in the existing update path.
- Current browser proof covers inactive `?edit=1`, visible/clickable Build Mode, hidden ordinary prompt while active, frozen/captured state, active TransformControls, F8 close/reopen, ordinary prompt return, save/reload persistence, and standalone authored placements.
- Current automated validation: focused 30/30; Workshop proof PASS; full browser 5/5; gate 565/565 plus all validators/build/budget/dist checks; standalone PASS with 14/14 installations, 17/17 visitors, zero remote requests; audit PASS with 0 vulnerabilities.

## DriftCheckDraft

- Scope: aligned with the pasted owner brief; no Workshop conservation or structural Museum change is planned.
- Compatibility: preserve the existing single input/loop/resource authorities.
- New owner/fallback/branch: no independent pointer-lock authority, no new frame loop, no remote dependency.
- Decision: continue.

## Risk / Unknown

Human visual acceptance of ring scale/material and water realism cannot be established by structural tests. The prior human QA pass remains BLOCKED/INCOMPLETE because the auto-open Workshop conflicted with the ordinary capture overlay; current browser automation proves the repaired ownership/state transitions without claiming perceptual approval.
