# Reliquary 200-Observation Closure Ledger — Recovery Report

> **Historical search record — 2026-08-20.** The repository branch/base and search results below belong
> to that investigation. This remains an absence report, not a recovered or current release ledger;
> the current checkout state is recorded in [`OPERATIONAL_STATE.md`](OPERATIONAL_STATE.md).

**Date:** 2026-08-20
**Repository:** `museum-of-me-vnext`, branch `release/v1.0.0`, base commit `20466855999f7c33d520a3a947c73ab07157a940`
**Subject:** the search for `Reliquary_200_Observation_Closure_Ledger.md` and its two companion artifacts.

> **This document is a search record, not a ledger.**
> It exists so that no later agent can mistake a reconstruction for the missing
> historical artifact. The reconstructed work lives in a separate, differently
> named file: `Reliquary_Reconstructed_Source_Regression_Ledger.md`. That file
> is **not** the 200-observation ledger and does not claim to be.

---

## 1. What was sought

| File | Status |
|---|---|
| `Reliquary_200_Observation_Closure_Ledger.md` | **NOT FOUND** |
| `Reliquary_Restoration_Validation_Report.md` | **NOT FOUND** |
| `Reliquary_Restoration_SHA256SUMS.txt` | **NOT FOUND** |

---

## 2. Locations searched

### 2.1 Filesystem, by name

| Location | Method | Result |
|---|---|---|
| `museum-of-me-vnext/` (repository) | `find`, `git ls-files` | not present |
| `/Users/andrew/museum of me/` (repository parent) | `ls`, `find` | not present |
| `Museum_of_Me_vNext_Workspace/` (42 files, fully enumerated) | `find` | not present |
| `$HOME` to depth 6, excluding `node_modules`, `.git`, `Library`, caches | `find -iname` on seven name patterns | no match |
| `~/Downloads` | `find -iname "*Reliquary*|*Observation*|*Closure*"` | one unrelated hit (`CURRENT_REPOSITORY_OBSERVATIONS.md`, a DexDictate bundle) |
| `~/Documents/research/` (198 entries, fully enumerated) | `ls`, `grep` | six earlier Reliquary HTML iterations dated 2026-08-01; no ledger |
| `~/Desktop`, `~/Projects` | `find` / Spotlight | no match |

Name patterns used: `*200*Observation*`, `*Closure*Ledger*`, `*Reliquary_Restoration*`,
`*Reliquary*Validation*`, `*Reliquary*Recovery*`, `*Reliquary*Turn*`, `*Reliquary*SHA256*`.

### 2.2 Filesystem, by content (Spotlight full-text)

`mdfind` was used because it indexes file *contents*, so a renamed copy would still surface.

| Query | Result |
|---|---|
| `mdfind -name "Reliquary"` | 22 hits, all accounted for: the six preserved HTML artifacts, four archives, six earlier 2026-08-01 iterations in `~/Documents/research`, this repository's own generated reports, and one unrelated D&D PDF |
| `"Observation Closure Ledger"` | only files this repository generated, plus unrelated `playwright-core` bundles |
| `"Reliquary_200_Observation_Closure_Ledger"` | **only four files, all of which name it as missing**: `OPERATIONAL_STATE.md`, `Reliquary_Final_Validation_Report.md`, `Reliquary_Final_Regression_Ledger.md`, `Reliquary_Final_SHA256SUMS.txt` |
| `"Reliquary_Restoration"` | only `Reliquary_Final_Validation_Report.md` and `Reliquary_Final_SHA256SUMS.txt` — again, both naming it as absent |
| `"CORRECTED BY SOURCE EVIDENCE"` | this repository plus unrelated Drakken project documents |
| `"200 observation"` | this repository plus unrelated Smores_Katamari / Rhetorical_InDEX documents |
| `"Turn2_Validation"`, `"Four_Turn_Recovery"` | **no hits anywhere** |

This is the decisive negative result: **every occurrence of the ledger's name on
this machine is a reference to its absence.** No copy, no fragment, no rename.

### 2.3 Archives (all extracted and enumerated, not merely listed)

| Archive | SHA-256 | Doc entries | Ledger present |
|---|---|---|---|
| `Reliquary_Handoff_Packet_2026-08-02.zip` | `a33e5b73b8d327ce10000ca2a7c6f3be54ed6157f5e34830e59cb441fb095a58` | 14 markdown/txt/json | no |
| `The_Reliquary_ThreeJS_Cycle7_50Plus_Polish_Adversarial_Final_Source.zip` | `868ee5401149088387ad548c3eb1ff1ae161c7773491facffaafbb6ae8945f9b` | 63 markdown reports | no |
| `The_Reliquary_ThreeJS_Cycle7_50Plus_Polish_Adversarial_Final_Static_Build.zip` | `13d338b32e00256c8aac14e225a104d87b1ef76d73704e73044a700236a5b65a` | build docs only | no |
| `Museum_of_Me_vNext_Project_Actualization_Handoff_2026-08-19.zip` | `8dfb3d1bc1fa93b939b6c39621f598636df83b12c4e4817ac1e49a0b0cefa677` | 42 files, enumerated | no |

A recursive content grep across all extracted trees for
`200[- ]?Observation`, `Closure Ledger`, and `Observation Closure` returned **zero matches**.

### 2.4 Version control

```
git log --all --pretty=format: --name-only --diff-filter=A | sort -u
```

Across all 111 commits and all refs, the only ledger-like paths ever added are
`validation/reports/HUMAN_QA_CHECKLIST.md`, `validation/reports/QA_REPORT.md`,
and `validation/reports/WALKTHROUGH_2026-08-19.md`. The 200-observation ledger
was **never tracked in this repository**, so it cannot be recovered from history,
a dangling blob, or a deleted-file revision.

### 2.5 Not searched, and why

Dependency, vendor and build caches (`node_modules`, `dist`, browser profile
caches) were excluded by policy. The Spotlight content queries did incidentally
index some of them and returned only false positives from `playwright-core`
bundles, which confirms the exclusion cost nothing.

---

## 3. Related artifacts that DID survive

These were recovered and are used as primary evidence for the reconstructed
ledger. None of them is the missing file.

| Artifact | Provenance | What it contains |
|---|---|---|
| `The_Reliquary_of_Iterative_Becoming_THREEJS_CURATED.html` | parent directory, unmodified | **Highest surviving runtime authority.** `exhibitData` (14 installations with controls/theses), `visitorSpecs` (17 visitors), `INSTALLATION_THESES`, `DEXTER_MODEL_LOCK`, `sanctuaryScentPath` (13 points), `installInterpretiveLecterns()` reading-zone/interaction-radius/camera-safe-distance contract, the embedded raster manifest |
| `The_Reliquary_of_Iterative_Becoming_RESTORED.html` | parent directory, unmodified | later restoration artifact |
| `The_Reliquary_of_Iterative_Becoming.html` | parent directory, unmodified | earlier artifact, `fca4021d…` |
| Version B source zip | see §2.3 | `src/exhibits/state.ts` (the 14 keyed state machines), `src/exhibits/builders.ts`, `src/data/source-data.json`, `src/visitors/VisitorSystem.ts` |
| Version B cycle ledgers | inside the source zip | 63 markdown reports — `ADVERSARIAL_REPAIR_LEDGER*.md` (7 files, 54 rows each), `CYCLE_*_POLISH_LEDGER.md`, `FINAL_REQUIREMENT_TRACEABILITY*.md`, `REQUIREMENTS_LEDGER.md`, `DEVICE_AND_ACCESSIBILITY_VALIDATION.md` |
| `Reliquary_Handoff_Packet_2026-08-02` | see §2.3 | `Reliquary_Detailed_Bug_Sweep.md`, `Reliquary_QA_Report.md`, adversarial audit, code-mapped repair plan, `qa/reliquary_*_bug_sweep.json` |

---

## 4. Does any survivor contain a subset of the 200 observations?

**No — and this must not be fudged.**

The surviving Version B ledgers are **cycle** ledgers: they record adversarial
repairs made *to Version B during its own development* (7 cycles × ~54 rows).
They are not observations about restoring the museum against source, they are
not numbered 1–200, they carry no `PASS / CORRECTED BY SOURCE EVIDENCE /
N/A WITH EVIDENCE` vocabulary, and their row counts (54, 32, 27, 13, 12) do not
sum or map to 200 in any defensible way.

They are genuinely useful primary evidence about **what the source required**,
and they are used as such. They are **not** a partial copy of the missing ledger,
and no row of the reconstructed ledger is presented as a recovered historical row.

---

## 5. What can and cannot be honestly reconstructed

**Can be reconstructed, from direct primary evidence:**

- Every installation, supplementary and visitor identity (CURATED + Version B agree byte-for-byte).
- The 14 installation state machines, controls, defaults and constants (Version B `state.ts`; all constant lists verified byte-identical to CURATED).
- The `INSTALLATION_THESES` silhouette and required-part contract (byte-identical in both authorities).
- The interpretive-lectern spatial contract — reading zone, interaction point, interaction radius, camera safe distance (CURATED `installInterpretiveLecterns()`).
- The Dexter identity lock, including `eyes === 'readable brown'` and the prohibition on a fog cue (CURATED `DEXTER_MODEL_LOCK`).
- The 13-point sanctuary scent path (CURATED `sanctuaryScentPath`).
- The nine curated rasters, by exact SHA-256 and byte length.
- The Three.js identity `0.185.1` (CURATED CDN pin).

**Cannot be reconstructed, and is not attempted:**

- The **wording, numbering, ordering, scope, or count of the 200 historical observations.**
- Which observations were originally marked `CORRECTED BY SOURCE EVIDENCE` versus `N/A WITH EVIDENCE`.
- Any observation that referred to intermediate states, conversations, or decisions that left no artifact.

Because the original 200 rows are unavailable, **no document produced by this
work states "200/200 PASS" and none invents a row to reach 200.** The
reconstructed ledger is sized by the evidence that actually survives.

---

## 6. Conclusion

`Reliquary_200_Observation_Closure_Ledger.md` is **UNRECOVERED**. The search was
exhaustive by name, by content, across every archive, and across the full git
history. The only references to it on this machine are statements of its absence.

It is recorded as **MISSING HISTORICAL EVIDENCE**, not as failed, not as passed,
and not as superseded.
