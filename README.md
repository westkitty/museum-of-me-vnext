# Museum of Me — The Reliquary of Iterative Becoming (vNext)

A persistent first-person Three.js museum. One continuous two-level building, six themed wings, a
monumental central Rotunda, and a Dexter Sanctuary. The checked-out historical collection maps
**64 project identities through 35 visitor-facing exhibits**. The mapping is frozen in
`data/exhibit-mapping.json` for this source line.

The museum presents the projects. It does not glorify their creator.

## Run it

```bash
npm install
npm run dev
```

Then walk in. `WASD` or `arrows` move · mouse look · `Q/E` rotate · `Shift` sprint · `Space` jump ·
`F` or `Enter` interact · `M` map · `J` journal · `Esc` release pointer. Keyboard-only vertical look
uses `Page Up/Page Down`. The entry prompt preserves the control instructions for assistive
technology while the authored entrance plate supplies the visible copy.

## Museum Workshop — development authoring

Museum Workshop is a development-only authoring layer over the real museum scene. Start the normal
Vite dev server, then open `http://127.0.0.1:5173/?edit=1`. The normal museum remains active and
Workshop starts closed; use the visible `BUILD MODE` control or `F8` to open it. Build Mode releases
pointer lock, pauses visitor movement, and suppresses the ordinary entry prompt until it closes.

Workshop Core deliberately edits only safe, non-colliding placement objects. It supports direct
Three.js transform gizmos, exact transform fields, world/local mode, floor snapping, add/duplicate/
delete, an outliner, and command-style undo/redo. `Save to build` writes the validated, deterministic
source manifest at `data/workshop-placements.json`; normal development, production, and standalone
museum builds consume that placement source.

The save bridge is a Vite `serve`-only local endpoint with a fixed target and shared schema plus
conservation validation. Protected routes, interaction/read zones, source installations and
structural geometry are rejected before the target is opened. Production builds contain the saved
placement runtime but not the Workshop UI, styles, transform controls, or filesystem write endpoint;
`npm run verify:dist` checks that boundary.

Structural/collision-authoritative systems remain locked in Workshop Core: walls, floors, stairs,
ramps, the flight pad, Dexter Sanctuary route geometry, source installations, authored visitor routes,
and other verified spatial invariants are not editable through this first slice.

Useful shortcuts while Workshop is open: `W/E/R` move/rotate/scale · `G` snap to supporting floor ·
`Cmd/Ctrl+D` duplicate · `Delete` remove · `Cmd/Ctrl+Z` undo · `Shift+Cmd/Ctrl+Z` redo ·
`Cmd/Ctrl+S` save.

The exterior includes a world-relative crystalline Blood Ring orbit and a visual-only island water
surface with slow organic motion. Neither changes collision ownership; reduced motion freezes the
water.

## Validate and measure

```bash
npm run gate          # typecheck, lint, unit tests, validators, QA, build and distribution checks
npm run test:workshop # Chromium Workshop authoring + source-save/reload journey (separate from gate)
npm run build:standalone && npm run profile # offline runtime profile; Playwright Chromium required
```

The runtime profile writes reproducible, diffable snapshots to `validation/metrics/`. It records the
standalone SHA-256, browser/backend, fixed viewpoints and zones, frame-time percentiles, renderer
counters, CPU-side call timings, memory/streaming counters, and GPU timer-query capability. The
checked-in paired snapshots and their limits are summarized in
[`validation/reports/QUALITY_UPLIFT_2026-10-01.md`](validation/reports/QUALITY_UPLIFT_2026-10-01.md).
SwiftShader is not representative-device FPS; human visual, audio, touch, and pointer-lock acceptance
must remain human-authored.

## Structure

| Path | What |
|---|---|
| `docs/MUSEUM_VNEXT_BUILD_PLAN.md` | controlling historical build plan |
| `docs/INVESTIGATION_BASELINE.md` | time-bounded initial investigation from 2026-08-19; not current status |
| `docs/ARCHITECTURE.md` | frame loop, streaming, collision, resource ownership, static bake and quality adaptation |
| `docs/EXHIBIT_CONTRACT.md` | frozen exhibit interface |
| `docs/ASSET_POLICY.md` | procedural-first asset governance and its documented exceptions |
| `docs/ASSET_PIPELINE.md` | actual runtime asset paths, hash checks and validation commands |
| `docs/PRIVACY_POLICY.md` | what may never appear in visitor-facing space |
| `data/exhibit-mapping.json` | historical frozen 64 → 35 mapping for this source line |
| `data/projects/*.json` | museum copy for the 64 projects on this source line |
| `data/workshop-placements.json` | versioned Workshop placements and scene overrides |
| `src/workshop/` | placement runtime, schema/history, safe-prefab catalog, and dev editor |
| `docs/DEPLOYMENT.md` | static hosting and observed/unverified deployment status |
| `docs/RELEASE_CHECKLIST.md` | release evidence boundaries and dated repository reconciliation |
| `docs/RELEASE_RUNBOOK.md` | executable validation sequence and human/hosted evidence boundaries |
| `validation/reports/QA_REPORT.md` | generated automated exhibit QA report; not human acceptance |
| `validation/reports/WALKTHROUGH_2026-08-19.md` | historical browser walkthrough; not evidence for later changes |
| `validation/reports/QUALITY_UPLIFT_2026-10-01.md` | current asset/performance audit, scorecard, evidence and limits |
| `validation/metrics/ARTIFACT_SHA256SUMS.txt` | current standalone/profile/screenshot hashes; rebuild standalone before checking |
| `OPERATIONAL_STATE.md` | dated current repository truth, verification and remaining gaps |

## Repository state — checked 2026-10-01

The local `main`/`origin/main` baseline is `901ec91496f533638c978a3846bd3ea0c7914f48`, with the
subject `Release v1.0.0 — Museum of Me vNext`. GitHub reports PR #1 (the release-line merge) merged
on 2026-09-03; exact-head workflow run `33746867357` passed `gate`, `browser`, `standalone`, and
`workshop`. The remote `release/v1.0.0` branch is at `0360bdd1c86692dd1e28f6a0dbad3f5a97040252`.
No `v1.0.0` tag or GitHub release was listed in the 2026-10-01 audit.

An **open, unmerged PR #4** at head `ad5fa1d706d9d5c76f83842cc41c0510101f96c8` proposes an active
pre-1.0 development collection with 73 current project identities. It is not part of this checkout;
this source line still has the frozen 64→35 mapping. These conflicting maturity/collection statements
are recorded, not silently resolved by importing another branch. See `OPERATIONAL_STATE.md`.

The Arena session branch is based on the `main` SHA above. On this local candidate, `npm run gate`
passed on 2026-10-01 (594 Vitest tests plus 9 release-tool tests); the rebuilt standalone matches
profile SHA-256 `b243d8e846863c6648397cd7ff1730ce857358f3f42e9958e747c21068e25937`. Chromium-dependent
E2E, standalone runtime and Workshop checks are **BLOCKED**, not product failures: the expected
Playwright browser binary was absent and its CDN download failed with TLS `ECONNRESET`. See
`docs/RELEASE_CHECKLIST.md` and `OPERATIONAL_STATE.md` for results. The performance snapshots were
captured earlier on Chromium 131 / SwiftShader; they are not device FPS or GPU timings.

The local performance and documentation work is a candidate patch to that source line, not a hosted
deployment or human acceptance record. No production URL, response headers, cache behavior, or
representative-device FPS was observed in this audit.

## Lineage

This is a **new product**, not a restoration. Historical Reliquary artifacts and restoration reports
are documented separately. The dated checksum list at `Reliquary_Final_SHA256SUMS.txt` is historical;
the current runtime artifacts are hashed in `validation/metrics/ARTIFACT_SHA256SUMS.txt`.
