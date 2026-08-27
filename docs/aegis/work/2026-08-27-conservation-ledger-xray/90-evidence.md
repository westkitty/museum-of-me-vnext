# Conservation Ledger + Spatial X-Ray — Temporary Continuity Evidence

> **Continuity status:** TEMPORARY REPO-LOCAL NOTE. This file does **not** replace the canonical `OPERATIONAL_STATE.md` or `Museum_of_Me_Bible.md`. The active connector cannot safely append to those large append-only ledgers without whole-file replacement, so this bounded note preserves the new evidence until a safe canonical append path is available.

## Evidence state

- **Feature state:** IMPLEMENTED / SOURCE-VERIFIED / AUTOMATED RUNTIME VERIFIED on the implementation head below.
- **Human visual/readability judgment of the Spatial X-Ray and conservation panel:** UNKNOWN / UNVERIFIED.
- **Representative-device performance and feel:** UNKNOWN / UNVERIFIED; unchanged from the prior Museum state.
- **Release/main integration:** NOT PERFORMED.

## Implementation identity

- Repository: `westkitty/museum-of-me-vnext`
- Branch: `feature/museum-conservation-ledger-xray-2026-08-27`
- Parent baseline: `bf2fe0611c5c06e69316ec1bbc3cbf81bfac41e2`
- Exact implementation head with full green CI: `46f304f78830af1c70a3f6f47cc4945cde6566db`
- GitHub Actions: run `33096262588` / museum gate #314

## What landed

### Conservation Ledger

- Successful validated Workshop saves append a durable conservation checkpoint to `data/workshop-conservation-ledger.json`.
- Each checkpoint records creation time, automatic change label, before/after SHA-256 fingerprints, object counts, added/removed/changed placement IDs, and `conservation: PASS`.
- `PASS` cannot be stamped by the checkpoint constructor unless the saved manifest independently passes the existing `validateWorkshopConservation` authority.
- A malformed existing placement source is treated as an error, never silently reinterpreted as an empty baseline.
- Ledger writes are atomic. If checkpoint persistence fails after a placement write, the save path restores the previous validated placement manifest rather than leaving placement reality and history divergent.
- Ledger read access is development-server-only through the same localhost/same-origin boundary as Workshop saves.
- Workshop QA preserves and restores the original ledger bytes so automated authoring proofs do not leave fake historical checkpoints behind.

### Spatial X-Ray

- Build Mode exposes a development-only conservation panel with `Spatial X-Ray` and `Refresh Ledger` controls.
- The X-Ray does **not** define a second protected-area map. It samples the existing `validateWorkshopConservation` authority using tiny synthetic probes at the museum's relevant elevation bands.
- Cyan points represent sampled open placement space; red points represent sampled protected space.
- The X-Ray is built on demand, creates no `requestAnimationFrame` or alternate frame-loop owner, and disposes its geometry/material resources with Workshop teardown.
- The panel follows all existing Workshop open/close paths, including Build Mode control, F8, Escape and the Workshop Exit control.
- Existing `window.__museumWorkshop.transform.enabled` diagnostic compatibility remains preserved.

## Scope discipline

The implementation did **not** modify museum layout authority, collision authority, installation state machines, the frozen 64-project → 35-exhibit mapping, authored visitor routes, Dexter Sanctuary geometry, renderer ownership, asset policy, dependencies, or release/main branches.

The only implementation-slice paths changed relative to the baseline are Workshop/conservation code, its ledger data file, its tests, the Workshop authoring proof, and the dev-only `src/main.ts` dynamic import.

## Verification

Exact-head run `33096262588` on `46f304f78830af1c70a3f6f47cc4945cde6566db`:

- `gate`: PASS.
  - TypeScript: PASS.
  - ESLint: PASS.
  - Vitest: 27 files / 571 tests PASS, including six new conservation-ledger/X-Ray tests.
  - Frozen mapping/content/privacy/frame-loop/hotpath/asset/exhibit/source-parity validators: PASS.
  - Production build, budget, and `verify:dist`: PASS; development Workshop/editor write path remains excluded from production output.
- `standalone`: PASS, including fresh offline standalone verification.
- `browser`: PASS, including production dependency audit and real Chromium visitor-path gate.
- `workshop`: PASS.
  - Real Chromium Workshop authoring journey: PASS.
  - Spatial X-Ray UI/scene proof: PASS.
  - Conservation checkpoint created and reread: PASS.
  - Workshop conservation ledger proof: `PASS checkpoints +1`.
  - Standalone rebuilt from the authored placement source and inspected with Workshop absent from production: PASS.

During the previous candidate run, browser automation caught the conservation panel physically underneath the existing Workshop palette. That candidate was not accepted. The panel was moved into an explicit non-overlapping Workshop UI lane and the exact corrected head above passed the complete matrix.

## Preserved invariants

- Existing Workshop remains the authoring owner; the conservation shell is additive.
- Existing conservation validator remains the sole protection authority for Workshop placement safety.
- No second frame loop.
- No second collision/layout authority.
- Workshop remains development-only under `?edit=1`.
- Production/offline museum behavior remains independent of the editor and ledger service.
- Human perceptual claims remain human-owned and are not inferred from automation.

## Next meaningful proof

Run a fresh human `?edit=1` walkthrough on the representative device. Judge whether the X-Ray is visually useful rather than merely correct: protected/open regions should be legible without obscuring the museum, the conservation panel should not interfere with authoring, and Build Mode open/close behavior should still feel clean. If that passes, the next separate decision is whether to integrate this branch into the release line.
