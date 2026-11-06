# Architecture audit corrections — 2026-11-05

Validation was performed on `fix/architecture-audit-20261105`, based on audited source `4442b4914de22f7759a713ed7299687554be1559`, before committing or pushing the patch. The owner subsequently authorized staging, committing, pushing and merging into `main`. These Git operations do not establish a new Pages deployment or resolve the offline validation blocker.

## Corrections and evidence

1. **Live landscape quality.** `App.setQuality()` calls `ExteriorWorld.setQuality()`; `IslandLandscape` replaces only deterministic render-detail batches in a reusable child `ResourceScope`. Paths, pier, landmarks, shell and construction-time colliders are retained. The boot tier's physical woodland remains fixed during visual tier changes. Old instancing buffers/geometry/materials are disposed. Existing wildlife behavior is preserved. Unit comparison against independently constructed tiers checks counts, full instance matrices/colors, geometry detail and collision identity across repeated Low/Medium/High cycles. Chromium verifies the real App path: forest counts 901/1469/2111, stable 363 exterior objects, stable 279 geometries and 4 textures across three cycles; the replaced High geometry emits one disposal event. These are renderer counters, not physical GPU-memory or hardware-FPS measurements.
2. **Predictive preparation rejection.** The automatic call site consumes the promise rejection after `prepareInterior()` logs it, records failure and presents the existing error/retry UI. Explicit callers still receive rejection. The regression intercepts the real interior-module request, observes `PREPARATION_FAILED` and visible feedback, proves exterior keyboard movement, restores loading, uses explicit Reload and retry, and enters with an atomic scene/collision handoff. Against the original automatic call site, the same browser test failed with an observed unhandled module-import rejection. No global suppression was added.
3. **Concurrent GLB ownership.** A manager-owned prototype scope leases shared geometry/materials/textures until the final consumer leaves. Each consumer gets an independent scene graph and skeletal rig. Cancellation and scope/manager teardown release only the relevant lease; late unused results are drained and failures can be retried. ResourceScope tracks skeletons; AmbientVisitors releases population-clone skeletons without disposing shared prototype geometry. Unit tests exercise both unload/cancellation orders, clips and bone animation, pre-abort, pending/active manager teardown, late results and retry. Real local Quaternius GLBs use one fetch per concurrent lifecycle round. Chromium observes 281 geometries/25 textures with two consumers, 281/15 with one survivor, and the original 271/5 after both unload, in either order.
4. **Contract/documentation drift.** Instancing is declared active; runtime LOD stays false. Architecture describes 73 current projects and grounded jumping. Asset documentation describes actual loading/direct-builder paths and scoped file leases. Deployment documentation records the previously verified published `4442b491` baseline and supplied development/Pages runs 41830167975/41831365883, explicitly distinguishing unpublished local work. Historical mapping, dependencies, lockfile and collection source are unchanged.

## Authority and limitations

The canonical Bible was read through the existing Git authentication path at Bible repository HEAD `bdb9e72187321859dbe210f254ce01602f6b0ac2`. It identifies toolkit v1.1 as `MODERN_3D_BROWSER_GAME_ARCHITECTURE_TOOLKIT_OPTIMIZED_V1_1.docx`, but that document is absent from the accessible workspace and Bible checkout. Repository contracts and the Bible's recorded v1.1 conclusions were used; toolkit v1.0 was not substituted.

A ready-to-append Bible continuity entry is supplied separately. No remote persistence is claimed: this task prohibits commit/push without separate authorization. The unresolved November 4 traversal recording was left outside this work.

Local runtime evidence uses Node 24.22.1, npm 11.9.0, Playwright 1.62.1 and system Chromium 155.0.8059.79 with SwiftShader. CI uses Node 22. Representative-device performance, driver memory, thermals and human visual acceptance remain unverified.

## Validation results

| Check | Result |
|---|---|
| Focused unit regressions | PASS, including 24 asset tests and deterministic tier/collision tests. Original code reproduced the defects before repair. |
| `npm run gate` (final) | PASS: 757 Vitest tests across 58 files, release-tool tests, all validators, QA, production build, budgets and distribution verification. |
| `npm run test:e2e` | Initial full run: 51 PASS / 1 FAIL (Vite HMR destroyed the first art-direction test's execution context while a concurrent standalone build regenerated collection source). No skipped tests. |
| Isolated art-direction recovery run | PASS: 1/1 with no concurrent builds. All 52 distinct browser cases have passing execution evidence across these runs; the initial full command itself exited nonzero. |
| `npm run test:workshop` | Live authoring test PASS (1/1), temporary authored standalone build PASS; command FAIL at offline `file://` navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Wrapper restored original placement manifest and export. Offline authored-placement assertions NOT EXECUTED. |
| `npm run build:standalone` (final normal build) | PASS, 16,509,117-byte HTML, SHA-256 `3e377137e93ba81275b149a62d9e0b9830cdd40e1ff75f300576c3168c41c997`. Rebuilt after Workshop so generated output reflects the normal source. |
| `npm run verify:standalone` | Static integrity PASS with the same SHA. Browser phase FAIL at `file://` navigation with the same administrator restriction; subsequent runtime-source QA NOT RUN. |
| `git diff --check` | PASS. |

The system browser's managed policy at `/etc/chromium/policies/managed/urls.json` has `URLBlocklist: ["*"]` and allows HTTP/HTTPS but not `file://`. This is an environment limitation, not evidence of an application regression. It was confirmed without changing the policy, installing a bypass browser or weakening the tests. Required offline and authored-standalone runtime validation remains incomplete. Rerun `npm run test:workshop` and `npm run verify:standalone` in an administrator-approved test environment that supports those local-file proofs. No fresh source-runtime QA report was produced, and prior reports are not promoted to current evidence.


## Environment configuration

Frozen-lockfile installation, local Vite startup/HTTP checks and Chromium runtime execution were performed. The environment draft contains tested `install_script`, `start_skill`, and the nonsecret `MUSEUM_BROWSER_EXECUTABLE=/usr/bin/chromium` requirement. Configuration persistence is confirmed, including the local-file validation blocker; it has not been published or validated in a fresh task. The web development workflow is working, but required offline verification is blocked, so the environment is not fully configured for the entire requested validation matrix. Review/save the draft and publish the environment through environment settings when desired. This does not publish the museum.

## Changed files

- `OPERATIONAL_STATE.md`
- `README.md`
- `architecture.project.json`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_AUDIT_CORRECTIONS_2026-11-05.md`
- `docs/ASSET_PIPELINE.md`
- `docs/DEPLOYMENT.md`
- `docs/MUSEUM_BIBLE_APPEND_2026-11-05.md`
- `src/app/App.ts`
- `src/app/WorldDirector.ts`
- `src/assets/AssetManager.ts`
- `src/assets/ResourceScope.ts`
- `src/world/AmbientVisitors.ts`
- `src/world/exterior/ExteriorWorld.ts`
- `src/world/exterior/IslandLandscape.ts`
- `tests/assets.test.ts`
- `tests/browser/asset-ownership.e2e.ts`
- `tests/browser/predictive-interior.e2e.ts`
- `tests/browser/quality-transitions.e2e.ts`
- `tests/experience.test.ts`
- `tests/island-landscape.test.ts`
