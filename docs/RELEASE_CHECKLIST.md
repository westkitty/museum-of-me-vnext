# Release Gate

The plan's §39 gate, checked item by item. Every ✅ names the evidence.

## Architecture

| Item | State | Evidence |
|---|---|---|
| No inaccessible intended public space | ✅ | `tests/traversal.test.ts` walks entrance → every wing → upper floor → Sanctuary → entrance against real collision, plus into and out of all 35 bays. Zero failures. |
| No collision holes | ✅ | Same harness fails on "walked over a hole in the floor". Zero. |
| No unintended traps | ✅ | Same harness fails on "blocked by geometry" measured as real progress toward the target. Zero. |
| No visible voids | ✅ | Gradient sky dome follows the camera; scene fog matches its horizon colour. |

## Exhibits

| Item | State | Evidence |
|---|---|---|
| 35 / 35 pass | ✅ | `tests/exhibit-quality.test.ts` runs the per-exhibit gate over every one: physical presence, bay fit, described controls that change state, layered interpretation, reduced-motion usability, three clean streaming cycles, idempotent reset, no object outside its own group. |
| 64 / 64 project mappings pass | ✅ | `npm run validate:mapping` — 35 exhibits, 64 project identities, each represented exactly once, no gaps and no duplicates. |
| No exhibit still scaffolded | ✅ | `npm run validate:exhibits` — 35 / 35 bespoke. |

## Assets

| Item | State | Evidence |
|---|---|---|
| No missing assets | ✅ | Every asset is generated in the browser; `AssetManager.load` refuses any id without a manifest record. |
| No unlicensed external assets | ✅ | There are no external assets. `npm run validate:assets` fails on any that appear. |
| No runtime hotlinks | ✅ | Verified at runtime in the production build: **4 requests, all same-origin, zero external.** |

## Privacy

| Item | State | Evidence |
|---|---|---|
| No secrets | ✅ | `npm run validate:privacy` scans data, content and all exhibit source for credential signatures, tokens and key blobs. |
| No private case data | ✅ | E21's situation and E35's investigation are invented for the museum and say so in the room. |
| No credentials | ✅ | Privacy gate. |
| No operational BigMac data | ✅ | E34 uses synthetic example hostnames throughout. The gate caught and rejected even a loopback IPv4 literal during development. |

## Accessibility

| Item | State | Evidence |
|---|---|---|
| Keyboard path works | ✅ | `tests/accessibility.test.ts` — WASD moves, arrow keys look, turn rate independent of mouse sensitivity, whole collection reachable through the DOM mirror without walking. |
| Readable accessible exhibit copies exist | ✅ | Browser: 35 exhibit buttons, 9,157 characters of interpretation in the mirror, plus a live description of the exhibit the visitor is standing in. |
| Reduced-motion path works | ✅ | Per-exhibit gate exercises every control with motion off and requires the exhibit to stay describable. |
| Touch path works | ✅ | `tests/accessibility.test.ts` — the stick drives the player, and pointer lock is never requested on touch. |

## Runtime

| Item | State | Evidence |
|---|---|---|
| No uncaught core-path exceptions | ✅ | Full 35-exhibit browser walkthrough: zero uncaught errors, zero unhandled rejections, zero console errors. |
| Load/unload lifecycle stable | ✅ | `tests/lifecycle-memory.test.ts` — four full traversals, peak allocation does not creep, resting level stable, mounts balance unmounts. |
| Quality tiers work | ✅ | Auto-detected at boot, overridable in settings, DPR capped on all three, low tier drops shadows and crowds. |

## Deployment

| Item | State | Evidence |
|---|---|---|
| Production build succeeds | ✅ | `npm run build` — 2.9 MB shipped, against a 20 MB budget. |
| Production build runs | ✅ | Served from `dist/` and walked: 35 exhibit hosts, streaming, interaction, lighting cap and zones all behave identically to dev. |
| Asset host resolves | ✅ | No separate asset host is needed — see `docs/DEPLOYMENT.md`. All four requests resolve from the origin. |
| Cache headers written | ✅ | `public/_headers`: immutable on hashed assets, must-revalidate on the shell, plus a CSP that forbids every outbound connection. |
| Direct refresh works | ✅ | Verified against the production server. Preferences, journal visits, bookmarks, high contrast, interface scale and reduced motion all survive a refresh. |
| **Production URL works** | ⬜ | **Blocked on one decision, not on engineering.** No hosting destination has been chosen and nothing has been published. See below. |

## The one remaining action

> **Choose a hosting destination and authorise publication.**

Everything else is done. `dist/` is a complete, validated, self-contained
artifact; the headers, CSP and a manual-only Pages workflow are in place; and
`docs/DEPLOYMENT.md` has the exact steps for Cloudflare Pages or GitHub Pages.

This project has deliberately not published anything. Publishing makes the
documentation of sixty-four projects public, and that is the owner's call.

## Git state

| Branch | Role |
|---|---|
| `feat/foundation` | where all fourteen phases were built, commit by commit. Currently the repository's default branch. |
| `release/v1.0.0` | this release. Identical content, branched for tagging. |

**There is no `main`.** The repository was initialised with `main` as the
starting branch name but the first commit was made on `feat/foundation`, so
`main` was never born. Creating it, repointing the default branch, and tagging
are repository-configuration decisions, and this project has not made them on
the owner's behalf.

## The remaining actions, exactly

1. **Choose a hosting destination and authorise publication.** This is the only
   one that is not mechanical. See `docs/DEPLOYMENT.md`.
2. Establish `main` from `release/v1.0.0` and set it as the default branch.
3. Tag `v1.0.0`.

Everything those three steps would certify is green today.
