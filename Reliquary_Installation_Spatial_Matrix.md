# Reliquary Installation / Spatial Parity Matrix

> **Historical snapshot — 2026-08-20.** The branch, authority ranking and source dispositions below
> record that investigation; they are not live branch/deployment status. The current checkout state is
> reconciled in [`OPERATIONAL_STATE.md`](OPERATIONAL_STATE.md).

**Date:** 2026-08-20 · **Branch:** `release/v1.0.0`
**Scope:** the fourteen source primary installations — identity, behaviour, physical
form, artwork, interaction contract, spatial relationships, and the disposition of
every Version B installation builder.

Authority order used throughout: latest human instruction → restoration handoff →
**CURATED** (`60b5ef74…`) → **Version B** (`868ee540…`) → current vNext → reports → inference.

---

## 1. The decisive spatial finding

The two highest source authorities **disagree with each other on every one of the
fourteen world positions**, while agreeing **byte-for-byte on every semantic field**
(`title`, `wing`, `radius`, `build`, `stage`, `summary`, `truth`, `accent`, `controls`).

| Installation | CURATED position | Version B position |
|---|---|---|
| starsilk-atlas | `[0,0,20]` | `[0,0,18]` |
| drakken-sandbox | `[-7.5,0,5]` | `[0,0,3]` |
| orbital-tomb | `[6,0,-9]` | `[0,0,-14]` |
| smores-katamari | `[-23,0,23]` | `[-21,0,25]` |
| westcat-east | `[-19,0,12]` | `[-21,0,13]` |
| parable | `[-25,0,0]` | `[-21,0,1]` |
| vibe-nexus | `[-20,0,-12]` | `[-21,0,-11]` |
| westcat-familiar | `[-25,0,-23]` | `[-21,0,-22]` |
| heliocide | `[-18,0,-38]` | `[-21,0,-37]` |
| dexdictate | `[23,0,22]` | `[21,0,25]` |
| tablet-link | `[19,0,11]` | `[21,0,13]` |
| osint-box | `[25,0,-1]` | `[21,0,1]` |
| dexvault | `[23,0,-16]` | `[21,0,-11]` |
| dexgpt | `[0,0,-41]` | `[0,0,-39]` |

14 of 14 differ. This is asserted as a permanent regression test
(`tests/source-installations.test.ts` → *records that the two source authorities
disagree on every old coordinate*).

**Adjudication.** Exact old-hall coordinates are classified **(B) implementation
detail**, on evidence rather than convenience: a value the sources themselves never
shared cannot be the governing contract. The old 21-metre hall those coordinates
addressed does not exist in the vNext building.

What both authorities **do** share is treated as governing and is restored:

| Governing spatial contract | Source | Status |
|---|---|---|
| Room grouping (which installations share a space) | both, identical | preserved for 4 of 5 rooms — see §2 |
| Order along the hall outward from the entrance | both, identical | **superseded** — see §2 |
| Activation radius per installation (5.5–6.5 m) | both, identical | preserved exactly |
| Reading zone radius (1.04 / 1.10 sanctuary) | CURATED `installInterpretiveLecterns()` | preserved exactly |
| Interaction point + radius (1.15 / 0.70 sanctuary) | CURATED | preserved exactly |
| Camera safe distance (1.55 / 1.10 sanctuary) | CURATED | preserved exactly |
| Interpretive lectern between visitor and object | CURATED | preserved |
| Collision footprint around the installation | Version B `Installation` | preserved |
| Wall artwork facing the installation | CURATED raster manifest | preserved (`SourceArtwork`) |
| Sanctuary rearmost, reached through the museum | both | preserved and proven on foot |
| Control-grid density limit (≤ 8 controls) | CURATED QA `control-density` | enforced in `validate:source-parity` |

---

## 2. The two spatial contracts that could not both be kept

Under the frozen vNext mapping, **project association** and **hall ordering**
conflict. Both are governing; one had to yield.

`data/exhibit-mapping.json` carries `"frozen": true, "frozenAt": "2026-08-19"` and
is the later human-authorized assignment of each project to an exhibit and wing.
The current instruction forbids removing that corpus, and `src/world/layout.ts`
derives bay order from it.

**Decision: project association wins; hall ordering is superseded.** An installation
stands in the bay of *its own project*, never in a neighbour's bay. Ordering is a
circulation property of a building that no longer exists in that shape; identity is not.

| Source room | Source order | vNext order along the hall | Grouping | Ordering |
|---|---|---|---|---|
| Central Canon Observatory | atlas → drakken → tomb | atlas → tomb → drakken | **preserved** (all north) | superseded |
| West Gameworks | katamari → westcat-east → parable | westcat-east → parable → katamari | **preserved** (all south) | superseded |
| West Systems Workshop | vibe-nexus → westcat-familiar → heliocide | vibe-nexus → westcat-familiar → heliocide | **split** across media / south / north | preserved |
| East Local Systems Lab | dexdictate → tablet-link → osint-box → dexvault | dexdictate → tablet-link → dexvault → osint-box | **preserved** (all east) | superseded |
| Rear Sanctuary | dexgpt | dexgpt | **preserved** | preserved |

**The one split room is cited, not hidden.** `vibe-nexus`, `westcat-familiar` and
`heliocide` map to `E14` (media), `E26` (south) and `E08` (north) because the frozen
mapping assigns those *projects* to those wings by project identity. Moving them would
mean moving frozen exhibits, which is prohibited. Recorded as **SUPERSEDED BY LATER
HUMAN AUTHORITY**, with the authority named.

`westcat-east` and `westcat-familiar` both map to `E26`. Both are seated in that bay
at opposite ends (±4.6 m along the hall axis), 9.2 m apart — asserted in test.

Every installation stands ≥ 4 m clear of its bay's bespoke hero object (measured
5.1–6.2 m), with ≥ 1.05 m of margin to the bay walls, and its reading point inside
the same bay. No hero object is moved, recoloured, or lifecycle-coupled.

---

## 3. Per-installation matrix

Every row is backed by an executed runtime path, not by inspection.

| # | Source installation | Source room / order | Source contract | vNext representation | Verdict | Evidence |
|---|---|---|---|---|---|---|
| 1 | Starsilk Atlas (`starsilk-atlas`) | Central Canon Observatory / 1 | silhouette `suspended-loom`; parts loom-frame, starsilk-core, thread-ribbon, witness-node, era-spool; 6 controls; activation r=6.2; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E01** (north wing) at [-20.2, 0.0, -37.6]; 24 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 1: focus, engage, 6 controls, persist, restore, reset all pass |
| 2 | Drakken Terraforming Sandbox (`drakken-sandbox`) | Central Canon Observatory / 2 | silhouette `ringed-vivisection-globe`; parts planet-core, blood-ring, strain-pylon, extraction-spine, official-mask; 8 controls; activation r=6.2; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E07** (north wing) at [-20.2, 0.0, -91.6]; 28 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 2: focus, engage, 8 controls, persist, restore, reset all pass |
| 3 | Orbital Tomb Visual Timeline (`orbital-tomb`) | Central Canon Observatory / 3 | silhouette `orbital-autopsy-spindle`; parts gas-giant, month-orbit, meridian-module, dismantled-fragment, witness-beacon; 3 controls; activation r=6.3; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E03** (north wing) at [-20.2, 0.0, -55.6]; 24 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 3: focus, engage, 3 controls, persist, restore, reset all pass |
| 4 | S'mores Katamari (`smores-katamari`) | West Gameworks / 1 | silhouette `rolling-town-diorama`; parts katamari-ball, collection-item, duncan-landmark, smudge-figure, scale-gate; 5 controls; activation r=5.6; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E32** (south wing) at [21.2, 0.0, 109.6]; 36 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 4: focus, engage, 5 controls, persist, restore, reset all pass |
| 5 | WestCat Goes East (`westcat-east`) | West Gameworks / 2 | silhouette `island-route-ramp`; parts steep-road, forest-band, ferry-dock, weather-field, route-token; 5 controls; activation r=5.5; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E26** (south wing) at [21.2, 0.0, 55.6]; 49 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 5: focus, engage, 5 controls, persist, restore, reset all pass |
| 6 | Parable (`parable`) | West Gameworks / 3 | silhouette `ritual-island-altar`; parts living-island, ritual-spiral, village, shrine, rival-citadel; 4 controls; activation r=5.5; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E31** (south wing) at [-21.2, 0.0, 82.4]; 14 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 6: focus, engage, 4 controls, persist, restore, reset all pass |
| 7 | Vibe Coding Nexus (`vibe-nexus`) | West Systems Workshop / 1 | silhouette `compiler-loom`; parts vibe-reservoir, purpose-core, translation-gate, spec-stack, failure-chute; 4 controls; activation r=5.5; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E14** (media wing) at [-10.1, 10.0, -34.0]; 17 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 7: focus, engage, 4 controls, persist, restore, reset all pass |
| 8 | WESTCAT Familiar (`westcat-familiar`) | West Systems Workshop / 2 | silhouette `familiar-on-ledge`; parts familiar-body, state-ear, attention-eye, tool-orbit, evidence-drawer; 6 controls; activation r=5.8; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E26** (south wing) at [21.2, 0.0, 46.4]; 21 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 8: focus, engage, 6 controls, persist, restore, reset all pass |
| 9 | Heliocide Control Room (`heliocide`) | West Systems Workshop / 3 | silhouette `solar-command-dais`; parts solar-core, orbit-cage, command-spindle, record-rail, authority-key; 5 controls; activation r=5.7; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E08** (north wing) at [20.2, 0.0, -82.4]; 18 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 9: focus, engage, 5 controls, persist, restore, reset all pass |
| 10 | DexDictate (`dexdictate`) | East Local Systems Lab / 1 | silhouette `acoustic-pipeline`; parts microphone-capsule, wave-tunnel, local-model, text-ribbon, privacy-shell; 4 controls; activation r=5.7; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E17** (east wing) at [37.6, 0.0, -19.2]; 17 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 10: focus, engage, 4 controls, persist, restore, reset all pass |
| 11 | Relay Link / TabletLink (`tablet-link`) | East Local Systems Lab / 2 | silhouette `device-bridge`; parts mac-terminal, android-terminal, trust-gate, data-bridge, queue-token; 2 controls; activation r=5.6; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E18** (east wing) at [28.4, 0.0, 19.2]; 15 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 11: focus, engage, 2 controls, persist, restore, reset all pass |
| 12 | OSINT Box (`osint-box`) | East Local Systems Lab / 3 | silhouette `forensic-source-tree`; parts source-root, provenance-branch, verification-lens, evidence-tray, manual-proof; 6 controls; activation r=5.8; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E23** (east wing) at [91.6, 0.0, -19.2]; 15 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 12: focus, engage, 6 controls, persist, restore, reset all pass |
| 13 | DexVault / Vault Architect (`dexvault`) | East Local Systems Lab / 4 | silhouette `radial-archive-vault`; parts vault-ring, source-reliquary, retrieval-lantern, query-key, evidence-folio; 5 controls; activation r=5.7; reading zone 1.04; interaction r=1.15; camera safe 1.55 | Live installation in bay **E20** (east wing) at [46.4, 0.0, 19.2]; 17 meshes; 5/5 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 13: focus, engage, 5 controls, persist, restore, reset all pass |
| 14 | DexGPT / Dexter's Sanctuary (`dexgpt`) | Rear Sanctuary / 1 | silhouette `dexter-sanctuary`; parts dexter-model; 5 controls; activation r=6.5; reading zone 1.1; interaction r=0.7; camera safe 1.1 | Live installation in bay **sanctuary** (sanctuary wing) at [-36.1, -5.0, -46.0]; 49 meshes; 1/1 thesis parts; lectern + collision + persistence | Equivalent — behaviour restored | runtime-source-qa row 14: focus, engage, 5 controls, persist, restore, reset all pass |

No row is unexplained: all fourteen are **Equivalent — behaviour restored**, each with an
executed runtime path recorded in `validation/reports/RUNTIME_SOURCE_QA.md`.

---

## 4. Disposition of every Version B installation builder

The previous verdict's open item read *"Version B builders were not ported."* That
statement is now replaced by an evidence-backed disposition for each one.

Version B's builders embody two separable things:

1. **Governing behaviour** — the keyed state machine in `src/exhibits/state.ts`
   (`sanitizeState` / `applyInstallationKey` / `tickInstallationState` /
   `describeInstallationState`), persistence on change, reset, restore, the
   interpretive lectern's live line, and the collision footprint.
   **This was entirely absent from vNext. It is now ported** into
   `src/content/installationState.ts` and `src/world/SourceInstallations.ts`.

2. **Physical form** — the geometry in `src/exhibits/builders.ts`.
   Ported into `src/world/installationBuilders.ts`, **corrected against
   `INSTALLATION_THESES`**, which is byte-identical in CURATED and Version B and
   therefore outranks either builder's own part naming.

| Version B builder | Governing behaviour | Disposition | Evidence |
|---|---|---|---|
| `buildStarsilkAtlas` | era 0–4, overlay 0–3, spool/ribbon/core response | **Ported.** Version B named its ribbons `thread-ring-a/b`; the thesis requires `thread-ribbon`, so the thesis name governs | 6 controls driven; 5/5 parts |
| `buildDrakkenSandbox` | strain 0–4, step 0–5, official mask toggle | **Ported + repaired.** Version B omitted the thesis part `extraction-spine`; added | 8 controls driven; 5/5 parts |
| `buildOrbitalTomb` | month 0–6, modules removed as months pass | **Ported + repaired.** Version B named the body `virgil` (thesis: `gas-giant`) and omitted `dismantled-fragment`; both corrected | 3 controls driven; 5/5 parts |
| `buildSmoresKatamari` | rolling physics, 15 collectibles, growth | **Ported + repaired.** Version B omitted `duncan-landmark` and `scale-gate` and named the cat `smudge-model` (thesis: `smudge-figure`) | 5 controls driven; 5/5 parts; tick physics asserted |
| `buildWestCatEast` | condition 0–2, distance 0–10, rain, slope | **Ported + repaired.** Version B had loose `road-step`/`tree`/`rain` names; thesis requires `steep-road`, `forest-band`, `weather-field` | 5 controls driven; 5/5 parts |
| `buildParable` | armed → miracle → casts | **Ported.** Names already matched the thesis | 4 controls driven; 5/5 parts; arming gate asserted |
| `buildVibeNexus` | route 0/1, phase 0–4, failures | **Ported.** Names already matched | 4 controls driven; 5/5 parts |
| `buildWestCatFamiliar` | mode 0–3, state index, blocked signal | **Ported + repaired.** Version B omitted `state-ear` and `evidence-drawer` and named the cat `smudge-model` (thesis: `familiar-body`) | 6 controls driven; 5/5 parts |
| `buildHeliocide` | ordered command sequence, hold/authorize, append-only log | **Ported + repaired.** Version B omitted `record-rail`, which is what makes the log legible in the room | 5 controls driven; 5/5 parts; gate order asserted |
| `buildDexDictate` | hold/toggle mode, 4-phase capture pipeline on a timer | **Ported + repaired.** Version B left the bars loose; thesis requires a named `wave-tunnel` | 4 controls driven; 5/5 parts; timed pipeline asserted |
| `buildTabletLink` | 5-phase trust bridge including broken/recovery | **Ported + repaired.** Version B named it `bridge` (thesis: `data-bridge`) | 2 controls driven; 5/5 parts; phase wrap asserted |
| `buildOsint` | seed 0–3, step bounded by that seed's real route | **Ported + repaired.** Version B named `branch` (thesis: `provenance-branch`) and `manual-proof-tower` (thesis: `manual-proof`) | 6 controls driven; 5/5 parts |
| `buildDexVault` | query 0–2, retrieval step 0–3 | **Ported + repaired.** Version B named `source-cabinet` (thesis: `source-reliquary`) and omitted `query-key` | 5 controls driven; 5/5 parts |
| `buildDexterSanctuary` | mode 0–2, inspection ring | **Ported + corrected against higher authority.** Version B built `cloudedEye` (`0x8f9aa4`) with `blindnessCue: 'clouded eyes…'`. The CURATED `DEXTER_MODEL_LOCK` requires `eyes === 'readable brown'` and forbids a fog cue. CURATED outranks Version B, so the eyes are brown and the cue is the scent route. Version B's builder also drew 10 scent markers while the source `sanctuaryScentPath` has 13 — the 13-point path is the sanctuary's own contract and is built by `DexterSanctuary` | 5 controls driven; 1/1 part; identity lock asserted |

**Deliberately not ported**, with reasons:

| Version B detail | Reason no port is required |
|---|---|
| `Installation.updateResidency` / `lodSnapshot` LOD stride | vNext already governs residency and budgets through `StreamingManager`, `ResourceScope` and `PersistentEnvironment`, which are stricter and are gated by `check:budgets`. Porting a second residency system would create two owners of the same concern. |
| `window.THREE` global builder context | vNext imports `three` as a module. This is packaging, not behaviour. |
| `SceneRegistry.attach` | vNext exhibits mount into bay groups supplied by `Museum.build()`. Same guarantee, existing owner. |
| Version B panel/lectern texture plumbing (`createPanel`, `orientWallPanel`) | vNext has `TextTexture` + `SourceArtwork`; the lectern is rebuilt through it, carrying the same fields including the source prompt string. |
| Version B wall/caption panels at old wall coordinates | The walls those addressed do not exist. The artwork contract is preserved by `SourceArtwork` against the exact curated rasters. |

---

## 5. Reading, viewing and camera zones

| Contract | Source value | vNext | Proof |
|---|---|---|---|
| Reading zone radius | 1.04 m (1.10 sanctuary) | identical | asserted per installation |
| Interaction radius | 1.15 m (0.70 sanctuary) | identical | asserted per installation |
| Camera safe distance | 1.55 m (1.10 sanctuary) | identical | asserted per installation |
| Lectern between visitor and object | CURATED | enforced: object-to-lectern distance > reading-point-to-lectern distance | asserted per installation |
| Reading point within interaction reach | museum reach 4.2 m | 1.0 m | asserted per installation |
| Reading point inside the same bay | — | yes | asserted per installation |
