# Operational State — Museum of Me vNext

<!-- operational-state:metadata
{
  "project_id": "museum-of-me-vnext",
  "project_name": "Museum of Me — The Reliquary of Iterative Becoming vNext",
  "project_root": "/home/user/museum-of-me-vnext",
  "schema_version": 1,
  "state_revision": 54,
  "last_updated": "2026-10-01",
  "linked_parent_state": "historical 2026-08-19 build-plan handoff; see docs/INVESTIGATION_BASELINE.md"
}
-->

> **Authority note.** This file is the dated status for the repository state audited on 2026-10-01.
> Older status prose from the August/September release-preparation period was superseded here, not
> treated as current. Dated source reports remain in the repository as historical evidence.

## 1. Repository identity and remote state

- **Session branch:** `arena/01a0f545-museum-of-me-vnext` (fixed for this Arena session).
- **Base / local `main` / remote `main` at audit start:**
  `901ec91496f533638c978a3846bd3ea0c7914f48`, subject `Release v1.0.0 — Museum of Me vNext`.
- **Remote `release/v1.0.0`:** `0360bdd1c86692dd1e28f6a0dbad3f5a97040252`.
- **PR #1:** merged 2026-09-03; exact-head workflow run [33746867357](https://github.com/westkitty/museum-of-me-vnext/actions/runs/33746867357) reports `gate`, `browser`, `standalone`, and `workshop` success.
- **PR #4:** open and unmerged at `ad5fa1d706d9d5c76f83842cc41c0510101f96c8`. It proposes ACTIVE DEVELOPMENT / PRE-1.0 and a living 73-project collection. The checked-out `main` source still contains the frozen historical 64-project → 35-exhibit map. The disagreement is recorded; this task did not switch to or import PR #4.
- **Tag/release audit:** `git ls-remote --tags origin` showed no `v1.0.0` tag; `gh release list` returned no release on 2026-10-01. The older prerelease safety tag remains.
- **Hosted state:** no production URL, response headers, cache behavior, or hosted visual path was tested. The GitHub deployments API returned HTTP 403 to the configured integration, so deployment existence is **UNKNOWN**, not asserted absent.
- **Pushed candidate:** commit `0801ea334aa4070a11a83822554b261133f48824` was pushed to the session branch on 2026-10-01. Exact-head GitHub workflow run [36917100585](https://github.com/westkitty/museum-of-me-vnext/actions/runs/36917100585) passed `gate`, `browser`, `standalone`, and `workshop`.
- **Unresolved worktree input:** `data/workshop-placements.json` remains modified locally with two display-plinth records and one arrival-shrub override. Its provenance is unconfirmed, so it is excluded from the pushed commit. `src/main.ts` imports it; the saved candidate profile/artifact includes it, and the report identifies that measurement boundary explicitly.
- Local browser commands still fail to launch in this sandbox; the remote CI pass is automated evidence, not human visual/audio/touch/pointer-lock acceptance or hosted verification.

## 2. Truth reconciliation

| Area | Current resolution | Evidence |
|---|---|---|
| Branch/release claims | `main` is the merged release-line source at `901ec914…`; PR #1 is merged. The remote release branch remains separately at `0360bdd…`. | `git branch -avv`, `git ls-remote --heads origin`, `gh pr list`, run #33746867357. |
| Product maturity / collection | Main's code/docs describe the frozen 64→35 collection. Open PR #4 proposes a different pre-1.0, 73-project development state; it is not merged and does not alter this checkout. | `data/exhibit-mapping.json`; PR [#4](https://github.com/westkitty/museum-of-me-vnext/pull/4). |
| Legacy checksum list | `Reliquary_Final_SHA256SUMS.txt` is explicitly a 2026-08-21 historical snapshot. Current generated artifact/profile checksums are separate. Parent-directory source artifacts are not in this checkout. | Current manifest: `validation/metrics/ARTIFACT_SHA256SUMS.txt`; historical failures were reproduced with `sha256sum -c`. |
| Asset routes/provenance | Geometry builders, procedural exhibit assets, GLBs, curated raster artwork, Full Weasel, and audio use distinct paths. The ignored original Quaternius cache is absent; source hashes are historical, processed files are checked. | `docs/ASSET_PIPELINE.md`; fresh `npm run validate:assets` within the gate; `docs/QUATERNIUS_ASSET_PROVENANCE.md`. |
| Old transmission claim | Previous 296/325 number had no matching checked-in snapshot; it was replaced with a same-artifact 45-frame control. | `runtime-profile.json` and `runtime-profile-transmission-control.json`; test/code comments cite those files. |
| Profiler view labels | Earlier views used a wrong yaw/eye interpretation. Current positions use player-foot coordinates and yaw 0 facing north, and assert actual zone. | `scripts/runtime-profile.mjs`; profile methodology and `views.*.zone` in the paired JSON files. |
| Completion/deployment | Green CI/build does not prove human acceptance or hosted behavior. | `validation/reports/HUMAN_QA_CHECKLIST.md`; `docs/DEPLOYMENT.md`; no hosted URL observed. |

The detailed reconciliation, asset disposition, opportunity map, ranking, intervention ledger and
scorecard are in [`validation/reports/QUALITY_UPLIFT_2026-10-01.md`](validation/reports/QUALITY_UPLIFT_2026-10-01.md).

## 3. Current implementation facts

- One `requestAnimationFrame` owner remains `src/app/Loop.ts`. `frameTimeMs` records raw wall time;
  simulation delta is independently capped. `App` ignores hidden-page samples and pauses over
  1,000 ms for the governor.
- A `QualityGovernor` adapts only when the visitor has selected Automatic and the loop is uncapped.
  Hardware hints set a ceiling; they are not a GPU benchmark. Current offline profile began at low
  and observed zero tier changes.
- Static material interning/baking runs in `Museum.build()`, `PersistentEnvironment.build()` and
  `ArrivalGarden.build()`. Protected interaction/workshop/exhibit content remains unmerged.
  Larger merged bounds can increase submitted triangles for some views; the measured dome-view
  increase is recorded in the quality report.
- The current Blood Ring material has transmission 0, red emissive facets and clearcoat. A
  diagnostic 0.03 override nearly doubled Rotunda draw calls in this SwiftShader harness; visual
  equivalence remains human-unreviewed.
- The entry raster remains byte-identical. The visually competing DOM copy is clipped while its
  keyboard instructions remain semantically accessible.
- The frozen mapping, 35 exhibit slots, source-installation and visitor contracts, collision and
  traversal geometry, persistent-data keys, accessibility paths and offline asset policy remain
  protected. No hotlinked runtime asset was introduced.
- `validate:assets` checks literal registration provenance/IDs, obvious HTTP(S) hotlinks, 12 locally
  imported processed-file hashes, and the 65-file Full Weasel tree. It cannot revalidate the three
  external Quaternius source files while `.asset-sources/` is absent.

## 4. Paired runtime profile — MEASURED with strict limits

| View | Draw calls before → candidate | Triangles before → candidate | rAF p50 before → candidate |
|---|---:|---:|---:|
| Arrival Plaza | 3,275 → 1,081 | 218,988 → 120,696 | 916.8 → 445.9 ms |
| South vestibule | 3,154 → 1,035 | 213,588 → 115,996 | 1,176.7 → 560.0 ms |
| Rotunda | 1,548 → 520 | 137,292 → 82,662 | 1,135.4 → 571.9 ms |
| Rotunda dome | 79 → 72 | 35,500 → 41,310 | 400.3 → 160.2 ms |

Paired artifacts:

- baseline `runtime-profile-before.json`: SHA-256
  `af9ce594017c1e12f9d323bf2da2d36bada9d6c2c01c28ec7dc71c75c5b396f2`, built reproducibly from a
  clean `git archive` of main HEAD;
- candidate `runtime-profile.json`: SHA-256
  `b243d8e846863c6648397cd7ff1730ce857358f3f42e9958e747c21068e25937`;
- controlled transmission override `runtime-profile-transmission-control.json`: the same candidate
  artifact SHA, runtime-only Ring transmission changed from 0 to 0.03.

Both stored profile runs use Chromium 131 / ANGLE Vulkan SwiftShader, offline `file://`, WebGL2,
DPR 1, 640×360, low quality, 45 intervals per view and 900 ms settling. These are software-renderer
measurements, **not device FPS**. `EXT_disjoint_timer_query_webgl2` is unsupported, so GPU execution
is **UNKNOWN**. The requested 1%/0.1% fields are 45-frame low-confidence order statistics. CPU phase
timings are instrumented JavaScript/renderer submission times. The start/end heap is coarse;
renderer geometry/texture counters are not GPU bytes. The Playwright version used for the earlier
Chromium 131 capture was not recorded; a clean install now selects Playwright 1.62.1 / Chromium 151,
and the CDN download was blocked. The artifact and measurement method are recorded, but reproducing
the exact browser-tool pair is currently **BLOCKED**. See the quality report for full counter limits.

## 5. Verification ledger

| Claim | Current evidence / status |
|---|---|
| Profiler syntax and measurement script | **PASS** — `node --check scripts/runtime-profile.mjs`. Post-profile change only removed an unused local binding from an awaited probe install and clarified CLI documentation; sampling logic was unchanged. |
| Fresh local gate | **PASS** — `npm ci` then `npm run gate`: typecheck/lint/validators/build/budgets/distribution pass; 594 tests in 28 Vitest files and 9 release-tool tests. |
| Processed asset hashes and Full Weasel tree | **PASS** — fresh gate: 17 registrations, 12 imported file hashes and 65-file tree; 3 external source hashes remain historical because originals are absent. |
| Production standalone build and manifest | **PASS** — rebuilt `release/The_Reliquary_of_Iterative_Becoming.html` SHA is `b243d8e…`; `sha256sum -c validation/metrics/ARTIFACT_SHA256SUMS.txt` passes all 7 entries. |
| Production-only dependency audit | **PASS** — `npm audit --omit=dev --audit-level=high`: 0 findings. |
| Full development dependency audit | **FOLLOW-UP** — 7 advisories (3 moderate, 3 high, 1 critical) in the development dependency graph; no major tooling upgrade attempted. |
| Chromium visitor browser suite | **BLOCKED by environment** — all 6 `npm run test:e2e` tests stopped before assertions because Playwright Chromium 151 was absent. `npx playwright install chromium` failed after CDN TLS `ECONNRESET` retries. This is neither a product pass nor a diagnosed product failure. |
| Offline standalone runtime/browser proof | **PARTIAL / BLOCKED** — static SHA/source check passes; browser launch in `verify:standalone` and `qa:runtime-source` is blocked by the same missing binary. |
| Workshop browser authoring proof | **BLOCKED by same environment** — `npm run test:workshop` could not launch Chromium; its cleanup restores the exact manifest bytes present at invocation. |
| Prior paired 45-frame profiles and Ring control | **PASS, software backend only** — profile JSONs are checksummed; they are a separate earlier browser run on Chromium 131. No representative-device claim. |
| Human visual/audio/pointer-lock/touch/device FPS acceptance | **UNKNOWN / pending human** — no human-authored evidence record for this pass. |
| Hosted URL/header/cache verification | **UNKNOWN / not observed** — no URL/response tested; deployment API unavailable. |
| Exact-head CI on Arena branch | **PASS** — pushed commit `0801ea334aa4070a11a83822554b261133f48824`; run [36917100585](https://github.com/westkitty/museum-of-me-vnext/actions/runs/36917100585) passed `gate`, `browser`, `standalone`, and `workshop`. Human/hosted acceptance remains separate. |

## 6. Protected invariants and prohibitions

- Frozen 64→35 mapping; all 35 bespoke hero-object identity/lifecycle contracts; 14 source installations;
  17 authored visitors; Dexter Sanctuary outside the collection.
- `src/world/layout.ts` remains spatial authority. Preserve collision, ramps, player pivots, hitboxes,
  raycast targets, interaction IDs, authored routes, streaming ownership and Workshop conservation.
- Preserve preferences, installation state, Journal/Study state, saved-data migration/quarantine and
  input semantics. Do not replace or migrate a saved-data key without a separate compatibility plan.
- Keep keyboard, pointer-lock recovery, semantic controls, screen-reader DOM, reduced motion, high
  contrast, interface scaling and touch fallback. Automated checks never stand in for physical input.
- Keep procedural-first asset policy; authentic artifacts > derivatives > new originals > third-party.
  Local processed bytes must be provenance-recorded and hash-checked; no remote runtime hotlinks.
- Do not upscale textures recklessly, subdivide, add lights/particles/dependencies, or remove a
  deliberate visual effect without measured defect and human identity review.
- Do not call a headless screenshot or SwiftShader interval human approval, GPU time, or representative
  device FPS. Do not claim hosted URL/headers/cache until actually observed.
- Git finalization: stage only intended files on the fixed session branch, no force-push/history rewrite,
  no unrelated/unknown changes. Commit/push only after explicit authorization for that finalization.

## 7. Remaining steps

1. Review `git status`, `git diff --check`, and the complete patch. Confirm failed browser workflows did
   not alter any protected source bytes; exclude test output and ignored build artifacts.
2. Stage only deliberate source, tests, docs and evidence. Keep the current browser limitation and
   dev-tool advisory visible in the final record.
3. Ask for/reuse explicit commit/push authorization before finalizing. If authorized, commit and push
   only `arena/01a0f545-museum-of-me-vnext`, then verify the remote head and exact-head checks.
4. Re-run E2E, standalone offline browser/source QA and Workshop authoring after a compatible Chromium
   binary is available. Obtain human/device and hosted evidence before changing those UNKNOWN labels.
