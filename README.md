# Museum of Me — The Reliquary of Iterative Becoming (vNext)

A persistent first-person Three.js museum. One continuous two-level building, six themed wings, a
monumental central Rotunda, and a sacred Dexter Sanctuary. It presents **64 project identities
through 35 visitor-facing exhibits**.

The museum presents the projects. It does not glorify their creator.

## Run it

```bash
npm install
npm run dev
```

Then walk in. `WASD` move · mouse look · `Shift` faster · `E` interact · `M` map · `J` journal ·
`Esc` release pointer.

## Validate it

```bash
npm run gate     # canonical automated release gate: checks, QA report, build, budgets
```

## Structure

| Path | What |
|---|---|
| `docs/MUSEUM_VNEXT_BUILD_PLAN.md` | the controlling build plan, byte-identical to the handoff |
| `docs/INVESTIGATION_BASELINE.md` | environment, source authority, and what was verified |
| `docs/ARCHITECTURE.md` | frame loop, streaming, collision, resource ownership |
| `docs/EXHIBIT_CONTRACT.md` | the frozen exhibit interface |
| `docs/ASSET_POLICY.md` | procedural-first asset governance |
| `docs/PRIVACY_POLICY.md` | what may never appear in visitor-facing space |
| `data/exhibit-mapping.json` | the frozen 64 → 35 mapping |
| `data/projects/*.json` | museum copy for all 64 projects |
| `docs/DEPLOYMENT.md` | how to host it, and the one decision that remains |
| `docs/RELEASE_CHECKLIST.md` | the release gate, item by item, with the evidence for each |
| `validation/reports/QA_REPORT.md` | per-exhibit QA checklist and coverage |
| `validation/reports/WALKTHROUGH_2026-08-19.md` | runtime evidence from the full 35-exhibit browser walkthrough |
| `OPERATIONAL_STATE.md` | current truth: what is built, what is verified, what is not |

## State

All fourteen phases of the governing build plan are complete. Thirty-five
bespoke exhibits represent 64 project identities exactly once; traversal and
lifecycle gates are automated through the canonical release gate.

One thing remains, and it is a decision rather than engineering: **choose a
hosting destination and authorise publication.** Nothing has been published —
doing so makes sixty-four projects' documentation public, which is the owner's
call. PR #1 is open from `release/v1.0.0` to `main`; `docs/RELEASE_CHECKLIST.md`
also distinguishes automated proof from the remaining human browser/device checks.

## Lineage

This is a **new product**, not a restoration. The historical Reliquary artifacts — five single-file
HTML builds and three handoff archives — are preserved unmodified in the parent directory and hashed
in `docs/INVESTIGATION_BASELINE.md`. Nothing here overwrites them.
