# Build Mode, Blood Ring and water repair — reflection

## Key judgment

The prior human QA failure was an ownership conflict, not evidence that Workshop authoring itself was broken. The repair keeps pointer lock in `InputManager`, makes Workshop inactive at query load, and lets Workshop request the existing capture/freeze state only while open.

## Avoided misfix

No second pointer-lock manager, structural authoring path, collision edit, remote asset, duplicate render loop, or screenshot-based visual claim was added. The painted Blood Band was retired rather than layered under the new ring.

## Complexity closure

- Budget status: within-budget.
- Governed now: HUD/UILayer/Workshop lifecycle remains bounded; Sky owns the dome plus one tracked ring; ArrivalGarden owns the existing water shader/update path; tests remain in existing suites; proof timing uses the existing runtime stop boundary.
- Deferred follow-up: human visual/device QA for ring and water; exact-head CI inspection after push.
- Completion impact: needs-verification for human visual acceptance; automated implementation and exact-head CI evidence are complete.

## Baseline alignment

Aligned with the owner brief and the existing single-loop, ResourceScope, collision, mapping, and production-authoring boundaries. The old Blood Band expectation in `tests/experience.test.ts` was corrected as a retired source contract, not preserved as a competing visual authority.
