# Reliquary Final Regression Ledger

> **Historical snapshot — 2026-08-21.** The branch name, findings and hosted-status wording below are
> point-in-time evidence, not the state of the 2026-10-01 Arena candidate. See
> [`OPERATIONAL_STATE.md`](OPERATIONAL_STATE.md) for the reconciled current status.

**Date:** 2026-08-21 · **Branch:** `release/v1.0.0`

Independent comparison of the CURATED HTML, the Version B source and static build,
the RESTORED HTML, the surviving handoff/cycle reports, and the current vNext runtime.

This is the summary sheet. The detailed evidence lives in:

- `Reliquary_Reconstructed_Source_Regression_Ledger.md` — 115 evidence rows
- `Reliquary_Installation_Spatial_Matrix.md` — per-installation and per-builder disposition
- `Reliquary_200_Ledger_Recovery_Report.md` — the search for the missing ledger
- `validation/reports/RUNTIME_SOURCE_QA.md` — the executed 14/14 and 17/17 runtime paths

---

## 1. Closure of the historical 200-observation ledger

**UNRECOVERED.** `Reliquary_200_Observation_Closure_Ledger.md` was not found by
name, by content, in any archive, or anywhere in 111 commits of git history. Every
occurrence of its name on this machine is a statement of its absence.

No PASS/CORRECTED/N/A closure of its rows is claimed. No row was invented.
Full search record: `Reliquary_200_Ledger_Recovery_Report.md`.

---

## 2. Regressions found and closed by this work

| Item | Evidence | Status |
|---|---|---|
| **14 source installations had no runtime behaviour at all** — they existed only as data plus wall art | Version B `state.ts` state machines had no counterpart anywhere in `src/` | **CORRECTED** — ported into `installationState.ts` + `SourceInstallations.ts`; 14/14 runtime paths executed |
| **Version B builders unported** (the previous verdict's open item D) | `exhibits/builders.ts` had no counterpart | **CORRECTED** — every builder given an evidence-backed disposition; 14 ported, 13 also repaired against the thesis contract |
| **13 of 14 Version B builders violate the shared `INSTALLATION_THESES` part contract** | thesis is byte-identical in CURATED and Version B; Version B's own geometry drifted from it | **CORRECTED BY SOURCE EVIDENCE** — 14/14 now present all required parts |
| **Visitor walked mirrored from the camera at every off-axis yaw** | `PlayerController` rotated intent by +yaw against a −yaw camera basis | **CORRECTED** — two sign fixes; 8 cases + 16-step yaw sweep added |
| **Dexter Sanctuary physically unreachable on foot** | 600×600 ground collider at −0.5 roofed the descending ramp; `supportHeight` always chose it | **CORRECTED** — trench-clear floor helper; walked on foot to `y = −5` in the runtime harness |
| **Rotunda slab overhung the ramp mouth** (1.15 m drop) | ±18 m square extended ~9 m past the sanctuary arch | **CORRECTED** — same helper applied |
| **ESLint was linting the 6 MB generated bundle** | ESLint 9 flat config does not read `.gitignore`; `dist-standalone/` was absent from its ignores | **CORRECTED** — `dist-standalone/` and `release/` ignored |
| Installation state had no persistence, reset or restore | Version B saved on every changed key | **CORRECTED** — `InstallationStore` with integrity envelope and quarantine |
| Source control codes could not reach an installation | Version B engaged in place | **CORRECTED** — `InputManager.setCodeCapture`; Escape steps back; inert when nothing is engaged |
| Visitor conversations never individually exercised | previous verdict item C | **CORRECTED** — 17/17 executed, including re-entry |
| Visitor records were Version B derived, never checked against the higher CURATED authority | authority order puts CURATED above Version B | **VERIFIED** — cross-authority diff shows all governing fields identical; only old-hall routes/positions differ, and those are already remapped |
| 17 authored visitors replaced by generic capsules *(closed in r28)* | `AmbientVisitors` vs curated records | CORRECTED — `SourceVisitors`; ambient count 0 |
| Exact curated rasters omitted *(closed in r28)* | ASSET_POLICY procedural-first | CORRECTED — 9 files with hash gate |
| Curator Desk absent *(closed in r28)* | UILayer had Journal only | CORRECTED — `CuratorPanel` |
| Study Lab absent *(closed in r28)* | no queue/compare/collections | CORRECTED — `Study` + `StudyPanel` |
| Persistence discarded corrupt JSON silently *(closed in r28)* | catch-empty | CORRECTED — quarantine keys and notices |
| Three.js 0.185.0 vs curated 0.185.1 *(closed in r28)* | curated CDN pin | CORRECTED |
| Dexter procedural panels / dark eyes / assumed scent path *(closed in r28)* | curated model lock | CORRECTED — source imagery, readable brown eyes, 13-point path |
| Single-file offline HTML absent *(closed in r28)* | Vite multi-chunk dist | CORRECTED — offline Chromium PASS, 0 remote requests |

---

## 3. Items adjudicated as superseded, with the authority cited

| Item | Adjudication | Authority |
|---|---|---|
| Historical 14+15 = 29 collection count | **SUPERSEDED (count only)** | vNext actualization handoff 2026-08-19; `data/exhibit-mapping.json` `frozen:true` |
| Exact old-hall world coordinates | **IMPLEMENTATION DETAIL** — CURATED and Version B disagree on 14/14 while agreeing on every semantic field | the two source authorities themselves |
| Order along the hall within a source room | **SUPERSEDED** — conflicts with project association under the frozen bay numbering; identity wins | `data/exhibit-mapping.json` `frozen:true, frozenAt:2026-08-19` |
| West Systems Workshop as a single room | **SUPERSEDED** — its three projects are assigned to three vNext wings by the frozen mapping | same |
| Version B `Installation` LOD/residency system | **NOT REQUIRED** — vNext's `StreamingManager` / `ResourceScope` / `PersistentEnvironment` own that concern more strictly and are budget-gated | vNext invariants |
| Version B `window.THREE` global and `SceneRegistry` | **NOT REQUIRED** — packaging, not behaviour | — |
| Version B clouded Dexter eyes | **OVERRULED** — CURATED `DEXTER_MODEL_LOCK` requires readable brown | authority order: CURATED > Version B |
| Version B 10 procedural scent markers | **OVERRULED** — source `sanctuaryScentPath` has 13 points | same |

---

## 4. Remaining open items

| Item | Kind |
|---|---|
| `Reliquary_200_Observation_Closure_Ledger.md` | **MISSING HISTORICAL EVIDENCE** — not a museum failure |
| `Reliquary_Restoration_Validation_Report.md`, `Reliquary_Restoration_SHA256SUMS.txt` | same |
| Human visual / audio / pointer-lock feel / device FPS | **pending human evidence** — and should be re-run, because every prior human impression of off-axis walking predates the movement repair |
| Hosted production verification | **pending owner action** — nothing deployed |

**No governing museum requirement remains failing or unverified.**
