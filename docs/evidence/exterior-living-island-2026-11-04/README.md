# Living Island S6 — wildlife and twofold nature uplift

Source parent: `f797874f4d1b15f2a2f6b25d6af91aa03cb7df55`. Owner authorized this implementation, Git commit/push, and GitHub Pages publication, but only after real evidence and performance gates.

## Architectural contract
- **Double from the last deployed forest** (S5c 438/725/1040) to a calibrated 901/1469/2111 render-only crowns at low/medium/high. Same polygon footprint, route/landmark exclusions, 68/112/176 physical trunks and colliders.
- Double per-tree understory placement attempts from 2/4/6 to 4/8/12; this is render-only, no new colliders.
- Double shoreline rock target 48/96/144 to 96/192/288 and add 64/144/240 small site-masked wildflower glade markers (one instanced draw).
- In-repo silhouette wildlife: `island-butterflies`, `coastal-bird-flocks`, `lagoon-fish-school`; low/medium/high budgets 12/30/48, 6/12/18, 8/18/32. Exactly three new small draw batches. Deterministic, no sound/surveillance/assets/network/collision or independent animation loop.
- Fish orbit only inside the authoritative lagoon; birds remain outside collision physics; butterflies avoid paths/landmarks. Update from `ExteriorWorld.variableUpdate` at most 24 Hz, freeze with reduced-motion and keep exterior-only lifecycle. Explicit ResourceScope disposal. Low and medium new forest belt use 20-triangle crowns; high uses 80-triangle detail.
- Preserve six wings, 35 exhibits, Sanctuary, pier, roof, navigation, accessibility, water wave shader, offline functionality, and approved previous visuals.

## Acceptance
Run the full development gate, standalone, Workshop, browser visitor-path, seven independent real full-resolution screenshots + manifest and their matching 1280x720 and 390x844 camera poses, verify screenshot brightness to reject black mobile regression. Verify 744+ tests, no new frame loop, all three species visible in actual scene and fish remain within lagoon. Compare triangle and draw counts with S5c. Require no material navigability regression, no large bundle surprise, and hosted Pages SHA verification after publication. Do not claim device FPS or owner's aesthetic approval without separate evidence. If CI or render fails, repair or withhold deployment.
