# Release and Verification Checklist — 2026-10-01

This is an evidence checklist for the **checked-out 2026-10-01 source line**, not a claim that all
release criteria passed. Automated proof, human acceptance and live-host evidence stay separate. The
latest source-line reconciliation and measured uplift are recorded in
[`OPERATIONAL_STATE.md`](../OPERATIONAL_STATE.md) and
[`validation/reports/QUALITY_UPLIFT_2026-10-01.md`](../validation/reports/QUALITY_UPLIFT_2026-10-01.md).

## Repository facts observed

- Session branch: `arena/01a0f545-museum-of-me-vnext`, based on `main` at
  `901ec91496f533638c978a3846bd3ea0c7914f48`.
- Remote `release/v1.0.0`: `0360bdd1c86692dd1e28f6a0dbad3f5a97040252`.
- PR #1 is merged. Exact main-head workflow run [33746867357](https://github.com/westkitty/museum-of-me-vnext/actions/runs/33746867357)
  reports `gate`, `browser`, `standalone`, and `workshop` success.
- Pushed session-branch commit `0801ea334aa4070a11a83822554b261133f48824` received exact-head workflow
  run [36917100585](https://github.com/westkitty/museum-of-me-vnext/actions/runs/36917100585); all four
  jobs (`gate`, `browser`, `standalone`, `workshop`) passed. This is automated CI, not human or hosted acceptance.
- PR #4 is **open and unmerged** at `ad5fa1d706d9d5c76f83842cc41c0510101f96c8`. It proposes
  active pre-1.0 status and 73 current identities. The checked-out code remains the historical
  64-project / 35-exhibit source line. Do not import claims or collection content from PR #4 as if
  already merged.
- No `v1.0.0` tag or GitHub release was listed during this 2026-10-01 audit. No production URL or
  live host response was tested; the configured integration could not read the deployments API.

## Fresh local source/build checks

`npm ci && npm run gate` completed successfully on 2026-10-01: typecheck/lint passed, **594 tests in
28 Vitest files passed**, 9 release-tool tests passed, all mapping/content/privacy/frame-loop/hotpath/
asset/exhibit/source-parity/QA checks passed, production build and budgets passed, and distribution
verification passed (94 files; 142.15 MB uncompressed). Asset validation specifically confirmed 17
governed registrations, 12 imported processed-file hashes and the 65-file Full Weasel tree. The
standalone rebuild produced SHA-256
`b243d8e846863c6648397cd7ff1730ce857358f3f42e9958e747c21068e25937`; the checksum manifest passed.

| Check | State | Evidence / limit |
|---|---|---|
| Mapping, content, exhibit and source parity | **PASS** | Fresh `npm run gate`; 35 exhibits, 64 mapped identities, 14 installation state machines and 17 visitors. |
| Loop ownership, hot paths, privacy and automated QA | **PASS** | Fresh `npm run gate`; QA wrote automated report/checklist, not a human acceptance record. |
| Asset provenance/hash validation | **PASS** | Fresh `validate:assets`; 12 imported hashes + 65-file tree. Three external Quaternius original-source hashes remain historical because source originals are absent. |
| Production static build, budgets, distribution | **PASS** | Fresh `build`, `check:budgets`, `verify:dist`; Workshop editor/write bridge excluded from production output. |
| Production dependency audit | **PASS** | `npm audit --omit=dev --audit-level=high`: 0 production dependency vulnerabilities. |
| Pushed exact-head GitHub workflow | **PASS** | Run [36917100585](https://github.com/westkitty/museum-of-me-vnext/actions/runs/36917100585) for commit `0801ea334aa4070a11a83822554b261133f48824`; `gate`, `browser`, `standalone`, and `workshop` passed. Automated evidence only. |
| Full development dependency audit | **FOLLOW-UP** | `npm ci` / full audit reports 7 dev-graph findings (3 moderate, 3 high, 1 critical); no dependency upgrade was attempted in this performance/asset pass. |
| Chromium visitor/browser suite | **BLOCKED — environment** | `npm run test:e2e`: all 6 tests stopped before execution because Playwright's Chromium 151 binary was absent. `npx playwright install chromium` failed with CDN TLS `ECONNRESET`; this is not a passing browser result or a diagnosed product failure. |
| Offline standalone runtime browser check | **PARTIAL / BLOCKED** | `verify-standalone-offline.mjs` static SHA/source checks passed; `standalone-offline-browser.mjs` could not launch the same missing browser. Separate runtime-source QA is blocked at browser launch too. |
| Workshop save/reload proof | **BLOCKED — same environment** | `npm run test:workshop` could not launch Chromium; its `finally` path restores `data/workshop-placements.json` to the exact bytes present at invocation. |
| Current performance snapshots | **PASS, constrained** | Three diffable JSONs; the rebuilt candidate artifact matches the profiled SHA. Checksum manifest verifies the profile JSON and screenshots. Software SwiftShader, 45 intervals/view; not device FPS/GPU time. |

The pushed exact-head CI run above installed its managed browser and passed the browser, standalone,
and Workshop jobs. A repeat **local** browser run still needs `npx playwright install chromium` to
succeed first; the remote CI result does not substitute for human visual, audio, touch, pointer-lock,
or representative-device acceptance.

## Protected contracts

- 35 physical exhibit slots / 64 mapped identities on this source line; bespoke hero objects retain
  their IDs, pivots, hitboxes, interaction raycasts and streaming ownership.
- Collision, ramp traversal, player transforms, source installation state/persistence, visitor paths,
  Sanctuary access and Workshop protected areas remain authoritative.
- Keyboard, pointer-lock recovery, semantic DOM, screen reader instructions, reduced motion, high
  contrast, scaling, mobile/touch fallback and saved data remain non-regression requirements.
- Procedural-first local asset policy remains; no remote runtime hotlinks. Processed file hashes and
  bundle tree hashes must pass `npm run validate:assets`.
- Renderer optimization may not be presented as GPU time, device FPS, human visual approval or a
  universal triangle reduction. The dome-view +16.4% submitted-triangle measurement is explicit.

## Human/device evidence — still open

No human-authored evidence record for the current candidate is present in this audit. Complete
`validation/reports/HUMAN_QA_CHECKLIST.md` on a representative real browser/device and preserve the
record using `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md` or the in-museum `?qa=1` recorder.
The decisive review includes:

- first-screen copy/accessibility at common desktop, mobile, zoom and assistive-technology settings;
- actual Arrival Plaza → entry → vestibule → Rotunda pacing, landmark read, scale and obstruction;
- Blood Ring identity after the transmission tradeoff, dome view and color/lighting comfort;
- touch movement/look/panel scrolling, keyboard-only controls, pointer-lock capture/release/loss/
  recapture and saved data;
- audio deliberately opted in, volume behavior, clipping/distortion and subtitle agreement;
- representative-device frame pacing, including the exact views and quality tier recorded.

`npm run verify:human-evidence -- <record>` checks completeness only. It cannot infer, create or
upgrade human judgments. SwiftShader screenshots/profiles are not substitutes.

## Hosted evidence — not observed in this audit

No production URL, HTTPS response, emitted headers, cache behavior or hosted device journey was
examined. After any deployment, run `npm run verify:hosted -- <real-https-url>` and then perform a
real browser/device pass. Do not infer a live response from `public/_headers`, CI, or `dist/`.

## Git/CI finalization

- [x] Fresh `npm run gate` completed and result recorded.
- [x] Fresh `npm run build:standalone` completed; artifact SHA matches the profile; checksum manifest passes.
- [ ] Chromium-dependent `test:e2e`, complete standalone runtime QA and `test:workshop` rerun after browser installation.
- [ ] `git diff --check`, full diff and `git status` reviewed; only intended task files staged.
- [ ] Commit created on `arena/01a0f545-museum-of-me-vnext` **only if/when authorized**.
- [ ] Push sent only to `origin arena/01a0f545-museum-of-me-vnext` **only if/when authorized**; verify remote head/checks.
- [ ] Human and hosted unknowns remain unpromoted until actual evidence exists.
