# Reliquary Final Validation Report

> **Historical snapshot — 2026-08-21.** The branch, artifact hash and PASS statements below apply to
> that dated restoration report, not the 2026-10-01 Arena candidate. Current repository, validation
> and hosted-evidence status is in [`OPERATIONAL_STATE.md`](OPERATIONAL_STATE.md) and
> [`validation/reports/QUALITY_UPLIFT_2026-10-01.md`](validation/reports/QUALITY_UPLIFT_2026-10-01.md).

**Date:** 2026-08-21 (re-landed onto the current release line)
**Branch:** `release/v1.0.0`, integrated onto remote base `25cc3121e599ccf7ce535d8853501d81b659f0c4` (the human-QA release line) by cherry-pick of the restoration commit `877d0396964b7e6e92c95b53da0f99a584beea39`
**Canonical artifact:** `release/The_Reliquary_of_Iterative_Becoming.html`
**SHA-256:** `f4b8705363328be8da2a71ccae807abe8b1c184b6e615b22e36f5af3435549ce`

---

## Verdict

**RESTORATION VERDICT: COMPLETE AGAINST SURVIVING AUTHORITATIVE SOURCE EVIDENCE**

**HISTORICAL 200-LEDGER STATUS: UNRECOVERED — NOT FABRICATED**

These are two separate questions and this report keeps them separate:

- **Is the current museum restored and proven against every source requirement
  establishable from surviving authoritative evidence?** Yes. Every governing
  requirement is directly proven by an executed runtime path, not by inspection.
- **Has the exact historical 200-row ledger been recovered?** No. It does not
  exist on this machine. Its absence is documented, not papered over.

No document produced by this work states "200/200 PASS". No number was manufactured.

---

## 1. What the previous verdict left open, and what happened to it

| Previous open item | Outcome |
|---|---|
| **A.** `Reliquary_200_Observation_Closure_Ledger.md` unavailable | Exhaustive search documented in `Reliquary_200_Ledger_Recovery_Report.md`. Still **UNRECOVERED**. A separately named reconstruction was built from primary evidence: `Reliquary_Reconstructed_Source_Regression_Ledger.md` (115 rows, no FAIL, no governing UNVERIFIED row). |
| **B.** 14 installation runtime paths never individually exercised | **Closed.** All 14 now exercised in the real production runtime. `validation/reports/RUNTIME_SOURCE_QA.md`. This required implementing the missing behaviour — see §3. |
| **C.** 17 visitor conversations never individually exercised | **Closed.** All 17 exercised individually: focus acquired by the real raycast, conversation started through the real interaction manager, every authored line spoken, re-entry verified, journal verified. |
| **D.** Version B builders / spatial relationships unreconciled | **Closed.** `Reliquary_Installation_Spatial_Matrix.md` gives every installation a contract-by-contract comparison and every Version B builder an evidence-backed disposition. The sentence "Version B builders were not ported" no longer applies. |

---

## 2. The decisive source finding on spatial parity

The two highest source authorities **disagree with each other on all 14 world
positions** while agreeing **byte-for-byte on every semantic field**. A contract the
sources never shared cannot be the governing contract, so exact old-hall coordinates
are classified as implementation detail **on evidence, not convenience**.

Everything both authorities *do* share is restored exactly: room grouping (4 of 5
rooms; the fifth is split by the frozen mapping and is cited), activation radius,
reading zone, interaction point and radius, camera safe distance, the interpretive
lectern's position between visitor and object, collision footprint, wall artwork,
and the sanctuary standing rearmost.

---

## 3. What had to be built, because it was genuinely missing

The 14 source installations existed in vNext only as **data plus wall art**. Their
governing behaviour — the thing that made them installations rather than labels —
was absent. It is now restored inside the vNext architecture:

| Added | Purpose |
|---|---|
| `src/content/installationState.ts` | The 14 keyed state machines ported from Version B `state.ts`: sanitize, apply-key, tick, describe |
| `src/world/installationBuilders.ts` | The 14 physical forms, corrected against the `INSTALLATION_THESES` contract both authorities share |
| `src/world/installationPlacement.ts` | Source-relationship-preserving placement inside the mapped bays |
| `src/world/SourceInstallations.ts` | Live objects: interaction focus, engage, keyed control routing, interpretive lectern, collision, reset, Journal/Study integration |
| `src/state/InstallationStore.ts` | Persistence with integrity envelope and quarantine |
| `InputManager.setCodeCapture` | Source control codes reach an engaged installation; Escape steps back. Inert when nothing is engaged |

Nothing in the 64/35 collection was removed, moved, recoloured, or lifecycle-coupled.

---

## 4. Defects the runtime exercise exposed, and their repairs

Exercising the real runtime — rather than inspecting source — found three real
defects that every prior gate had passed over.

### 4.1 The visitor walked mirrored from where the camera looked

`PlayerController` rotated movement intent by **+yaw** while the camera's basis is
**−yaw**. The two agreed only at yaw 0 and yaw π. At every other heading the visitor
walked mirrored about the Z axis. Every automated route to date had travelled the
main axis, so nothing caught it, and the pointer-look human check was still pending.

**Repair:** two sign corrections in `PlayerController.fixedUpdate`.
**Regression test:** 8 explicit direction cases plus a 16-step full-circle yaw sweep
asserting movement equals the camera's forward vector.

### 4.2 The Dexter Sanctuary was physically unreachable on foot

`Museum.buildExterior` laid a single 600×600 ground collider at `GROUND_Y − 0.5`
across the whole site, including over the sanctuary ramp trench. `supportHeight`
returns the **highest** surface at or below the visitor's step-up, so the ground
always won over the descending ramp: the visitor walked across the top of the
trench and could never descend. The Sanctuary was reachable only by teleport —
precisely what the restoration brief forbids as evidence.

**Repair:** the exterior ground and the rotunda slab are now added through
`addFloorClearOfSanctuaryRamp`, which omits the ramp trench so the ramp is the only
thing to stand on there. The ground *mesh* is unchanged: a one-sided plane is
invisible from inside the chamber below it.
**Regression tests:** no flat surface roofs the ramp; support descends continuously
to the sanctuary floor with no drop over 1.2 m; the real route walks rotunda →
ramp → sanctuary centre against collision; solid ground remains everywhere else.
**Runtime proof:** the harness now walks from the rotunda into the Sanctuary,
descends to `y = −5`, and acquires interaction focus on the `dexgpt` installation.

### 4.3 The rotunda slab overhung the ramp mouth

Found while repairing 4.2: the deliberately generous ±18 m rotunda square extended
about 9 m past the sanctuary arch, over the trench, leaving a 1.15 m drop at the
ramp mouth. Repaired by the same trench-clear helper.

A fourth class of defect was found by cross-authority comparison: **13 of the 14
Version B builders had drifted from the `INSTALLATION_THESES` part contract** that
both authorities share (missing `extraction-spine`, `dismantled-fragment`,
`duncan-landmark`, `scale-gate`, `state-ear`, `evidence-drawer`, `record-rail`,
`query-key`, `source-reliquary`, `wave-tunnel`, `data-bridge`, `provenance-branch`,
`manual-proof`, and several misnamings). The ported builders satisfy the thesis:
14/14 complete.

---

## 5. Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** (after adding `dist-standalone/` and `release/` to the ESLint ignore list; ESLint 9 flat config does not read `.gitignore`, so it had been linting the 6 MB generated bundle) |
| `npm test` | **PASS — 516 tests, 22 files** (was 481; nothing weakened, 35 added) |
| `npm run validate:source-parity` | **PASS** — 14 / 15 / 17 / 9, 14 state machines, 51 authored visitor lines, Three.js 0.185.1, raster hashes |
| `npm run gate` | **PASS** (exit 0) |
| `npm run build:standalone` | **PASS** — 6,491,650 bytes |
| `npm run verify:standalone` | **PASS** — static checks, offline Chromium boot, and the runtime source QA |
| `node scripts/runtime-source-qa.mjs` | **PASS** — installations 14/14, visitors 17/17, remote requests 0 |

---

## 6. Required evidence, item by item

| Required | Result | Evidence |
|---|---|---|
| 14/14 source installation runtime paths | **PASS** | `RUNTIME_SOURCE_QA.md` — per installation: reached, object present, thesis parts complete, lectern present, focus acquired by real raycast, interaction invoked, engaged, every source control driven through real keyboard events, state transitioned, persisted, examined, restored after reload, journal, guide target, study subject, touch control table, reset |
| 17/17 authored visitor conversations | **PASS** | per visitor: identity, appearance and anatomy, staff badge, route, in scene, focus acquired, conversation started by real interaction, all authored lines spoken, lines non-empty, re-entry returns to line 1, journal heard, journal history |
| Spatial matrix with no unexplained row | **PASS** | `Reliquary_Installation_Spatial_Matrix.md` — 14 rows, all *Equivalent — behaviour restored* |
| Version B builder disposition | **PASS** | same document §4 — every builder ported, ported-and-repaired, or explicitly not required with a reason |
| Exact curated raster validation | **PASS** | 9 rasters, SHA-256 and byte length verified |
| 15 supplementary wall cases | **PASS** | `validate:source-parity`, `tests/source-parity.test.ts` |
| Dexter Sanctuary source path | **PASS** | walked on foot from the rotunda; descended to `y = −5`; focus acquired on arrival |
| Dexter identity lock | **PASS** | readable brown eyes (Version B's clouded eyes overruled by CURATED), hanging feathered ears, tricolor, quadrupedal, no fog cue, 13-point scent path |
| Curator Desk | **PASS** | `CuratorPanel`, canonical gate |
| Study Lab | **PASS** | `Study` + `StudyPanel`; installations survive `sanitizeStudy` as real subjects |
| Persistence and recovery | **PASS** | integrity envelope, quarantine for malformed / future-version / tampered payloads |
| Lifecycle | **PASS** | single frame-loop owner, `Lifecycle`, budgets, four-traversal settle |
| Accessibility | **PASS** | keyboard grammar, DOM mirror, reduced motion, high contrast, UI scale — plus the new movement/camera agreement suite |
| Standalone offline boot | **PASS** | `file://` with the browser context offline; **0 remote requests** |

---

## 7. Still not proven

1. **The historical 200-observation ledger.** Unrecovered. Documented, not fabricated.
2. **Human visual / audio / pointer-lock feel / representative-device FPS.** These
   remain human evidence by policy and are unchanged by this work — with one
   caveat now worth flagging: defect 4.1 means *every* prior human impression of
   walking off the main axis was of mirrored movement. The human QA pass in
   `validation/reports/HUMAN_QA_CHECKLIST.md` should be run fresh.
3. **Hosted production verification.** No deployment authorized or performed.

---

## 8. Owner-authorized actions NOT performed

No commit, push, merge, tag, deploy, or publish. All work is left in the working tree.
