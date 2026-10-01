# Investigation Baseline — Museum of Me vNext

**Established:** 2026-08-19
**Investigation gate:** PASSED
**Baseline classification:** **(3) A new vNext project created beside a preserved legacy Reliquary.**

> **Historical-snapshot scope:** this document records the initial investigation on 2026-08-19; its
> “current”/“nothing implemented” statements and machine paths are valid only for that baseline.
> They are not the status of the 2026-10-01 checkout. Current repository identity, implementation,
> measurements, and remaining evidence are maintained in `OPERATIONAL_STATE.md` and
> `validation/reports/QUALITY_UPLIFT_2026-10-01.md`. The listed parent-directory artifacts are not
> present in this checkout and were not rehashed in this audit.

---

## A. Execution environment (verified)

| Item | Value | How verified |
|---|---|---|
| Working root | `/Users/andrew/museum of me` | `pwd`, `ls` |
| Implementation root | `/Users/andrew/museum of me/museum-of-me-vnext` | created this session |
| Platform | macOS (Darwin 25.6.0), Apple Silicon | environment |
| Node | v26.7.0 | `node -v` |
| npm | 11.19.0 | `npm -v` |
| Git | 2.55.0 | `git --version` |
| GitHub CLI | authenticated as `westkitty`, scopes `gist, read:org, repo, workflow` | `gh auth status` |
| Blender | `/opt/homebrew/bin/blender` present | `which blender` |
| Writes / commits | available | repo initialised |
| Push | available (gh has `repo` scope) | see OPERATIONAL_STATE |

## B. Museum / Reliquary source candidates (enumerated)

Searched: `~/Projects`, `~`, `gh repo list westkitty --limit 300`.

| Candidate | Location | Verdict |
|---|---|---|
| Handoff bundle | `Museum_of_Me_vNext_Workspace/Museum_of_Me_vNext_Actualization_Handoff_2026-08-19/` | **Controlling planning authority.** Read-only. |
| Original handoff ZIP | `Museum_of_Me_vNext_Project_Actualization_Handoff_2026-08-19.zip` | Immutable source evidence. Not modified, not re-extracted. |
| `Reliquary_Handoff_Packet_2026-08-02.zip` | repo parent | Legacy evidence. Preserved unmodified. |
| `The_Reliquary_ThreeJS_Cycle7_*.zip` (source + static build) | repo parent | Legacy evidence. Preserved unmodified. |
| `The_Reliquary_of_Iterative_Becoming*.html` (5 single-file artifacts) | repo parent | Legacy evidence. Preserved unmodified. |
| GitHub `westkitty/*` | 134 repositories enumerated | **No Museum / Reliquary / vNext repository exists.** |
| Local `~/Projects` | 100+ directories enumerated | **No Museum / Reliquary project directory exists.** |

**Conclusion:** there is no prior vNext implementation repository to inherit, branch, or reconcile with.
No history merge is required and none was performed. Nothing legacy was moved, edited, or deleted.

### Preserved legacy artifact hashes (SHA-256)

```
8dfb3d1bc1fa93b939b6c39621f598636df83b12c4e4817ac1e49a0b0cefa677  Museum_of_Me_vNext_Project_Actualization_Handoff_2026-08-19.zip
a33e5b73b8d327ce10000ca2a7c6f3be54ed6157f5e34830e59cb441fb095a58  Reliquary_Handoff_Packet_2026-08-02.zip
868ee5401149088387ad548c3eb1ff1ae161c7773491facffaafbb6ae8945f9b  The_Reliquary_ThreeJS_Cycle7_50Plus_Polish_Adversarial_Final_Source.zip
13d338b32e00256c8aac14e225a104d87b1ef76d73704e73044a700236a5b65a  The_Reliquary_ThreeJS_Cycle7_50Plus_Polish_Adversarial_Final_Static_Build.zip
fca4021d1635a2e482c534f7be1ac416a1b9c4bec0c7a7b985adf1ec65c3d4dc  The_Reliquary_of_Iterative_Becoming.html
f6a4f81cb94516631968a3aa0b686851b7c4a43b140c2763f7f786a0c3a7fa35  The_Reliquary_of_Iterative_Becoming_RESTORED.html
60b5ef74116b01301ddc7fd89e8b983023b17677fcf698c427107e51e19c4534  The_Reliquary_of_Iterative_Becoming_THREEJS_CURATED.html
391a57899cdec761c433ee24843e271eccb73b8a68afa9fc8470fd3dccc4d4ef  The_Reliquary_of_Iterative_Becoming_THREEJS_ENAMEL.html
e11fa982b9f95d8ad83329be009ed6930eefdf89bd0de86b1a4923c283c7eab9  The_Reliquary_of_Iterative_Becoming_THREEJS_ENAMEL_FULLSCREEN.html
```

### Controlling plan identity

```
03ca23f5ff8afd53ac7d4d9c4bc2657e81513d12d5daf352b02297c1b333226a  docs/MUSEUM_VNEXT_BUILD_PLAN.md
```

This matches the `current_baseline.identity` hash recorded in the bundle's
`OPERATIONAL_STATE_build_plan.md`. The plan was copied byte-identical; no requirement was weakened.

## C. Implementation baseline

| Dimension | State |
|---|---|
| Current implemented state | Nothing. Greenfield repository created this session. |
| Verified behaviour | None yet at the runtime level. |
| Broken behaviour | None known. |
| Implemented-but-unverified | None yet. |
| Missing evidence | No runtime, deployment, or performance measurements exist yet. |
| Protected legacy artifacts | The nine hashed files above, plus the extracted handoff bundle. |
| Reusable assets | No binary asset carried forward. See `docs/ASSET_POLICY.md` for the procedural-first decision. |
| 64 → 35 mapping | **Frozen.** `data/exhibit-mapping.json`, machine-validated: 35 exhibits, 64 project IDs, zero gaps, zero duplicates. |
| Gap to vNext plan | Total. Phases 1–14 all outstanding at the time of this baseline. |

## D. Time-sensitive technical assumptions — re-verified

| Assumption | Decision | Evidence |
|---|---|---|
| Three.js version | Pinned **0.185.0** with matching `@types/three@0.185.0` | The plan's stated planning baseline is the r185 line. Installed and resolving cleanly. No version churn without a reason and compatibility proof, per the plan. |
| Build tooling | Vite 6 + TypeScript 5.7 | Plan §18.1. Installs and builds cleanly on Node 26. |
| Runtime 3D format | Procedural geometry first, GLB where a real artifact justifies it | See `docs/ASSET_POLICY.md` — governed decision, recorded rather than assumed. |
| Browser support | Modern evergreen desktop browsers with WebGL2 | Plan targets 60 FPS desktop with a 30 FPS fallback tier. |
| Hosting | Static hosting; Cloudflare Pages recommended by plan §38 Phase 14 | Deferred to Phase 14. No credentials assumed. |

## E. Unknowns, recorded honestly

1. No production hosting target is configured. Phase 14 will prepare deployment completely; performing it depends on an account decision that is outside this run's authority.
2. Runtime performance on this machine's GPU is unmeasured until Phase 12.
3. Several archaeology records carry their own uncertainty (e.g. P046 canonical build, P051 runtime). Museum copy states status honestly and does not resolve what the evidence does not resolve.
