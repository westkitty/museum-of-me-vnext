# Exterior-First P7 Compliance Ledger

**Scope:** final engineering candidate evidence for phases P0–P7 on `feature/exterior-first-impossible-threshold-20261102`. This ledger separates automated proof from visual, device and owner acceptance. It does not authorize merge, deployment or runtime installation.

## Phase checkpoints

| Phase | Scope | Evidence / status |
|---|---|---|
| P0 | Lock six reference hashes, site orientation and QA cameras | `docs/references/exterior-island/REFERENCE_MANIFEST.md`; PASS, recorded in operational state and Bible. |
| P1 | Exterior-only cold boot and deferred interior | `tests/browser/exterior-first.e2e.ts`; PASS at exact-head CI recorded in operational state/Bible. |
| P2 | Reversible impossible threshold | `tests/browser/impossible-threshold.e2e.ts`; PASS at exact-head CI recorded in operational state/Bible. |
| P3 | Compact exterior museum shell | `tests/browser/exterior-architecture.e2e.ts`; PASS locally and at P3 CI checkpoint, recorded in operational state/Bible. |
| P4 | Island landscape/site synthesis | `tests/browser/island-landscape.e2e.ts`; PASS locally and at P4 CI checkpoint, recorded in operational state/Bible. |
| P5 | Cooperative interior preparation and deferred GPU warm | `tests/browser/predictive-interior.e2e.ts`; PASS at exact-head CI, recorded in operational state/Bible. |
| P6 | Shared-source spatial Workbench | Workbench 2D/3D browser suites and Pages-base artifact verification; PASS at exact-head CI, recorded in operational state/Bible. |
| P7 | Final lifecycle, offline, evidence and documentation closure | Feature commit `66aee5ffcf9ae333eb83564f0733b61bf9411bc3` passed exact-head PR #23 run `41497583600` (4/4); this operational-ledger follow-up requires its own exact-head CI checkpoint. |

## Protected invariants

The baseline definitions are in `docs/EXTERIOR_FIRST_BASELINE_AND_PROOF_HARNESS.md`. Status below means no P7 source change is known to violate the invariant; it is not a fresh exhaustive re-audit of every historical behavior.

| Invariant | P7 disposition | Current evidence |
|---|---|---|
| INV-01 correct repository | PASS | `westkitty/museum-of-me-vnext`, dedicated feature branch. |
| INV-02 museum identity | PASS | Existing package/title metadata; P7 does not change identity. |
| INV-03 complete interior, six wings and 35 slots | PASS | Canonical gate and source validators; P7 adds no interior geometry changes. |
| INV-04 Dexter Sanctuary ramp/trench | PASS | Existing sanctuary tests and P2 sanctuary traversal; no P7 runtime edits. |
| INV-05 14 installations and 17 authored visitors | PASS | Standalone runtime source QA; P7 offline proof reports 14/14 and 17/17. |
| INV-06 visitor controls and explicit pointer lock | PASS | Canonical browser suite; P7 adds real WASD traversal. |
| INV-07 persistence integrity | PASS | Existing visit-thread/state suites; no P7 persistence edits. |
| INV-08 single application frame loop | PASS | `validate:frameloop` in canonical gate. |
| INV-09 single visitor renderer | PASS | Existing RendererHost architecture and browser scene proof; no P7 renderer edits. |
| INV-10 explicit resource lifecycle | PASS | ResourceScope unit coverage and existing shell/island disposal tests. |
| INV-11 active-world collision authority | PASS | P2 switching coverage and P7 supported stair/terrace/threshold walk. |
| INV-12 night/canon continuity | PASS | Existing source-grounding and environment tests; no P7 runtime edits. |
| INV-13 privacy/offline behavior | PASS | Privacy validator and standalone zero-network proof. |
| INV-14 accessibility/reduced motion | PASS | Existing accessibility tests and reduced-motion browser coverage; physical assistive-device acceptance not included. |
| INV-15 Workshop/Workbench preservation | PASS | `npm run test:workshop`, Workbench browser suite and exact-head CI. |
| INV-16 adaptive quality/performance law | PARTIAL | Unit/budget checks pass; P7 SwiftShader telemetry is not device-performance acceptance. |
| INV-17 no unsanctioned fauna | PASS | Existing scene/source validation; P7 adds no scene entities. |
| INV-18 cross-view reference fidelity | PARTIAL | Five canonical captures compared in `docs/evidence/p7/REVIEW.md`; source geometry ordering is coherent, visual quality gaps remain, owner approval pending. |
| INV-19 honest evidence tiers | PASS | P7 review marks visual comparison partial and device/P0-comparable metrics unverified. |
| INV-20 dedicated branch/no protected-ref writes | PASS | Work stays on the authorized feature branch; no main/pages-preview push, merge or deployment. |

## ADV-01–ADV-30 closure

The ADV identifiers below refer to the handoff acceptance checks. A `PARTIAL` or `UNVERIFIED` result is not upgraded by an adjacent passing test.

| ID | Result | Evidence / limit |
|---|---|---|
| ADV-01 | PASS | Cold exterior first boot; exterior-first browser test. |
| ADV-02 | PARTIAL | Cold journal/settings path is not independently asserted in P7. |
| ADV-03 | PASS | Predictive load backtrack and P2 threshold tests. |
| ADV-04 | PASS | Fifteen reversible world-switch cycles in P2 browser test. |
| ADV-05 | PASS | Stale chunk/load failure recovery in P2 browser test. |
| ADV-06 | PASS | Atomic threshold commit and active-world handoff tests. |
| ADV-07 | UNVERIFIED | Actual memory eviction followed by reverse re-entry is not exercised; retained world behavior is covered. |
| ADV-08 | PASS | Preparation/context-loss recovery browser coverage. |
| ADV-09 | PARTIAL | Lifecycle handlers are covered; complete mobile background/pageshow route is not. |
| ADV-10 | PASS | Low-tier/reduced-motion keyboard scenario in predictive-interior coverage. |
| ADV-11 | PASS | Failure UI exposes retry/reload behavior in threshold tests. |
| ADV-12 | PASS | Island support tests exclude lagoon/offshore ground support. |
| ADV-13 | PASS | Sanctuary traversal and collision preservation in P2 coverage. |
| ADV-14 | PASS | Fifteen-cycle switch/re-entry coverage. |
| ADV-15 | PASS | Workbench legacy pin migration coverage. |
| ADV-16 | PASS | Island-only Workbench uses shared exterior builder without building museum. |
| ADV-17 | PASS, local artifact only | Pages-base artifact is built and verified locally; no deployment. Must be regenerated at final P7 source SHA. |
| ADV-18 | PASS | Standalone offline exterior → interior → exterior → interior; zero network requests. |
| ADV-19 | PARTIAL | Reference comparison is documented; human visual approval remains pending. |
| ADV-20 | PASS | Workshop authoring and standalone journey. |
| ADV-21 | PASS for source head; follow-up head pending | Source commit `66aee5ffcf9ae333eb83564f0733b61bf9411bc3` passed all four exact-head jobs in PR run `41497583600`; this documentation follow-up must also pass exact-head CI. |
| ADV-22 | PASS | Dedicated feature branch; protected refs untouched. |
| ADV-23 | PASS | Clean starting tree and explicit task-owned edits; incidental generated QA output excluded. |
| ADV-24 | PASS | Reference hash/provenance is recorded in the canonical Bible; clipboard previews are not used as hash evidence. |
| ADV-25 | PARTIAL | Deferred warm and entry telemetry covered; measured first render is software-renderer-only. |
| ADV-26 | UNVERIFIED | Physical low-memory mobile/tablet device not tested. |
| ADV-27 | PASS | Reduced-motion/water behavior and single-loop validators/tests; no physical device claim. |
| ADV-28 | PASS | No implicit pointer lock; explicit input/browser journey remains covered. |
| ADV-29 | UNVERIFIED | Save mutation specifically during `COMMITTING` is not separately exercised. |
| ADV-30 | PASS | Architecture and visitor-facing docs updated for current exterior-first/Workbench behavior. |

## P7 acceptance boundary

- Local canonical gate, full Playwright suite, Workshop and standalone offline proof must pass on the candidate tree.
- Final Pages-base build and distribution verification must identify the final implementation commit SHA; this is artifact verification only.
- The P7 source commit passed exact-head PR #23 CI (`gate`, `browser`, `workshop`, `standalone`). The final docs follow-up SHA requires its own four-job run before the final branch checkpoint is recorded.
- Human visual approval, physical mobile/tablet performance, matched P0/P7 transfer comparison, merge and Pages deployment remain separate states. No such acceptance is implied here.
