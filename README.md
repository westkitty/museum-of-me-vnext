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
npm run gate     # typecheck, lint, tests, mapping, content, privacy, frame-loop, build
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
| `OPERATIONAL_STATE.md` | current truth: what is built, what is verified, what is not |

## Lineage

This is a **new product**, not a restoration. The historical Reliquary artifacts — five single-file
HTML builds and three handoff archives — are preserved unmodified in the parent directory and hashed
in `docs/INVESTIGATION_BASELINE.md`. Nothing here overwrites them.
