# Exterior S2 — night water, lagoon and shoreline readability

**Status:** source candidate on child branch `feat/exterior-night-water-lagoon-review-20261103`. Not aesthetically accepted or deployed.

The owner-supplied island images are an **aspirational art-direction target**, not existing runtime renders. S1 branch PR #31 remains the independent entrance/woodland slice. This S2 diff is strictly confined to material separation plus one static broken coastline surf mesh.

## Actual interventions
- Existing four-wave ocean shader retained; only deep-water and moon-reflection palette adjusted.
- Island ground, rock bank and water visibly distinguishable in night. No sky or global lighting changes.
- One indexed `night-island-broken-surf` mesh of polygon-following, irregularly broken quad strips. No per-segment Mesh, extra lights, textures, shader passes, network assets, colliders or frame callbacks.
- Lagoon water, bed and basin wall contrasted; lagoon retains the exact hole, coordinates and vertical geometry. A lagoon-only material avoids changing entrance-fountain water.
- All GPU objects are tracked by existing `ResourceScope`.

## Non-negotiable comparisons
The same full-resolution seven views, from the same camera arrays, are required. Compare with PR #30 and S1 PR #31, prioritizing `03-east-lagoon.png`, `05-high-topdown.png`, `04-west-woodland.png` and `01-pier-arrival.png`. Verify all scene source IDs, ocean ring, ground and dry/wet masks, 35 exhibit slots/six wings/Sanctuary, original arrival modal and offline standalone. Report render calls/triangles and all WebGL/browser exceptions.

**Rejected outcome:** coast is a bright continuous outline, foam sits on dry land, lagoon looks like a flat cyan decal, night scene becomes blown out, or frame cost causes a quality-tier regression. Do not merge if any of these are observed. Physical-device performance and owner's subjective visual approval are separate, presently unknown.
