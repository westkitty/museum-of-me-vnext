# Museum performance autonomous run

**Status:** ACTIVE — Museum remains active development / pre-1.0.

**Source authority:** `westkitty/museum-of-me-vnext` `origin/main`

**Verified baseline:** `4158824fbc669b64d2a3e8b46c0a20089a9d25b5`

**Integration branch:** `perf/autonomous-museum-uplift-20261030-4158824`

This append-only run ledger records the P1–P20 evaluation authorized on 2026-10-30. Cloud SwiftShader measurements are useful only for matched A/B comparisons on this machine; they do not establish MacBook, tablet, battery, thermal, or human visual acceptance.

## C0 — verified baseline

- Result SHA: `7347239`.
- Repository: clean checkout, expected origin, baseline equals freshly fetched `origin/main`.
- Runtime: Node 24.19.0 and npm 11.9.0; CI declares Node 22. Locked install completed with `npm ci`.
- Canonical gate: PASS, 43 files / 701 tests plus typecheck, lint, release tools, collection 73 projects / 35 exhibits / 6 wings, validators, build, budgets and release-dist.
- Browser baseline: system Chromium 154 + SwiftShader, 1280×720 DPR 1. Full run 23/24; the Choreographer introduction timed out once and passed immediately on the bounded focused rerun (2/2). Treat the full baseline as functionally viable with one recorded startup-timing flake.
- Matched manual render probe: explicit medium tier, fixed requested views, seven post-warm synchronous render submissions per view. Plaza 1,789 calls / 275,568 triangles / p50 37.5 ms; Rotunda 1,310 / 173,632 / 20.4 ms; North E01 206 / 48,914 / 2.6 ms; East E18 135 / 32,652 / 2.1 ms; South E32 349 / 39,016 / 4.8 ms. These are CPU wall times around software-renderer submissions, not presented-frame or GPU measurements.
- Baseline app creation to `window.__museum`: 898.9 ms in the same probe. One run only; noisy.
- Browser installation: Playwright CDN was forbidden by environment network policy; repository-compatible system Chromium is available at `/usr/bin/chromium` and is selected with `MUSEUM_BROWSER_EXECUTABLE`.
- Rollback: documentation-only baseline checkpoint; revert its commit if this run is abandoned.

## Phase status

| Phase | Proposals | Status | Result SHA | Dependencies / remaining proof |
|---|---|---|---|---|
| 1 | P1 glass rendering | PASS | `b4dd885` | Cloud A/B and six-wing browser proof complete; physical-device/human signoff remains. |
| 2 | P3 + P6 Quaternius assets | BLOCKED | `63f306a` | Retained official sources are absent and the publisher-linked Drive folders return 403. |
| 3 | P7 quality selection | PASS | `096ac97` | Missing-memory, 4 GB, 8 GB, 16 GB and mobile cases covered. |
| 4 | P2 lighting stability | PASS | `8f51bed` | Even count buckets reduce shader variants without forcing eight lights. |
| 5 | P13 shader prewarming | REVERTED | `d021433` | Persistent-shell compile cost outweighed negligible later program reduction. |
| 6 | P11 + P16 text residency | PASS | `3565382` | Plaque/lectern previews now upgrade only while active; supplementary residency retained. |
| 7 | P15 muted audio | PASS | `221479d` | Muted ambience owns no synthesis graph; interaction audio and gesture policy retained. |
| 8 | P4 + P5 + P10 Full Weasel | PASS | pending C8 commit | Verified upstream source build integrated exactly into governed E27 artifact. |
| Optional | P8, P14, P18, P20 | PENDING TRIAGE | — | Run only with supported residual bottleneck evidence. |
| Rejected | P9, P12, P17, P19 | SKIPPED BY AUTHORITY | — | Explicitly excluded from implementation. |

## Rulings

- Ruling: use the existing checkout and a dedicated branch rather than creating a Git worktree — the cloud onboarding contract says existing checkouts are authoritative unless the user asks for a worktree, while the user explicitly requested a unique branch. Cost if wrong: branch isolation is weaker than a separate filesystem, mitigated by clean-state checks and per-phase commits.
- Ruling: use the system Chromium after the pinned browser download was forbidden — this preserves browser validation on the available machine and records the exact browser version. Cost if wrong: CI's pinned Chromium may expose behavior this browser does not; exact-head CI remains required before merge.

## C1 — P1 glass rendering

- Base SHA: `7347239`.
- Result SHA: `b4dd885`.
- Files: `src/world/palette.ts`, `src/world/EnvironmentDressing.ts`, `tests/environment.test.ts`, this ledger.
- Change: dome, clerestory and entrance facade retain their existing geometry, blue coloration, translucency, opacity and depth-write behavior while using non-transmissive `MeshStandardMaterial` instead of transmission-enabled `MeshPhysicalMaterial`.
- TDD: the two focused material assertions failed against the transmission implementation, then `tests/environment.test.ts` passed 20/20 after the change.
- Matched SwiftShader A/B, medium tier at 1280×720 DPR 1: Plaza calls 1,789 → 972 and triangles 275,568 → 146,366; Rotunda 1,310 → 688 and 173,632 → 92,778; South E32 349 → 190 and 39,016 → 24,516. North E01 and East E18 counts were unchanged, as expected where architectural glass is outside the submitted view. Program counts dropped by 17–27 depending on view. Seven-render CPU medians improved materially at Plaza (37.5 → 12.2 ms) and Rotunda (20.4 → 6.6 ms), but the samples are short and software-rendered, so no device FPS claim is made.
- Screenshot evidence: North E01, East E18, Rotunda and South E32 captures are byte-identical. Plaza differs only around the intended facade glass; full-frame RMSE is 0.00884 and side-by-side inspection retains the glazing, architecture and opacity intent. Human artistic acceptance remains unverified.
- Validation: canonical gate PASS, 43 files / 701 tests plus all validators/build/budgets/dist; six-wing real-browser art-direction journey PASS 1/1 in system Chromium/SwiftShader.
- Status: PASS / keep.
- Dependencies: later measurements use this accepted material baseline.
- Rollback: `git revert <C1 SHA>`.

## C2 — P3 + P6 Quaternius asset triage

- Base SHA: `b4dd885`.
- Result SHA: `63f306a`.
- Runtime evidence: the seated GLB is exactly the reported P3 target (97 primitives, four materials, no animation). The men and women walker GLBs contain 24 clips each, including the required `Walk`, so P6 has a concrete payload to remove.
- Provenance evidence: `docs/QUATERNIUS_ASSET_PROVENANCE.md` identifies exact official originals and hashes, while `scripts/convert-quaternius-assets.mjs` requires them under ignored `.asset-sources/quaternius/`. Those retained originals are absent from this cloud checkout. The official publisher-linked Google Drive folder was tested read-only and returned HTTP 403 under the environment network policy.
- Status: BLOCKED. Rewriting the governed binaries from already processed GLBs would make the checked-in converter unverifiable from its recorded official inputs, so no binary, manifest, hash or budget mutation was made.
- Independent work preserved: the current GLBs, hashes and runtime remain untouched; all later source-independent phases continue.
- Resume requirement: restore the three exact retained originals at the converter's documented paths with their recorded SHA-256 hashes, then implement material-compatible seated merging and export walker assets with only `Walk`, update processed hashes/budgets, and rerun asset/browser/standalone validation.
- Rollback: documentation-only checkpoint; revert its commit to remove this run record.

## C3 — P7 quality selection

- Base SHA: `63f306a`.
- Result SHA: `096ac97`.
- Files: `src/render/QualityTiers.ts`, `tests/accessibility.test.ts`, this ledger.
- Change: unavailable `navigator.deviceMemory` remains unknown instead of being converted to a confirmed 4 GB signal. Confirmed 4 GB and mobile devices remain low; missing memory with eight cores resolves conservatively to medium; an 8 GB device stays medium; high now requires more than 8 GB, at least eight cores and a wide display. User quality overrides and adaptive resolution are unchanged.
- TDD: the Safari-like missing-memory case failed as low before implementation, then the focused accessibility suite passed 40/40.
- Validation: canonical gate PASS, 43 files / 702 tests plus all validators/build/budgets/dist.
- Status: PASS / keep. This changes automatic quality choice, so performance comparisons remain separated from same-quality rendering comparisons.
- Rollback: `git revert <C3 SHA>`.

## C4 — P2 lighting stability

- Base SHA: `096ac97`.
- Result SHA: `8f51bed`.
- Files: `src/render/Lighting.ts`, `tests/performance.test.ts`, this ledger.
- Change: the existing nearest-eight policy remains authoritative. Odd visible point-light counts round to the next even shader bucket with the nearest unsuppressed light outside its physical cutoff, which contributes zero illumination. Counts become 2/4/6/8 instead of 1–8 and the change adds at most one submitted light; it does not force eight lights throughout the museum.
- TDD: the main-axis bucket test failed at 3 vs expected 4 before implementation, then the focused performance suite passed 14/14.
- Matched main-axis SwiftShader traversal, same browser/build/viewport/quality and 124 fixed positions: light-count variants 8 → 4; shader program growth 149 → 65; final resident programs 177 → 93; synchronous render p95 427.6 → 89.1 ms and p99 725.9 → 617.2 ms. Median changed 8.6 → 9.8 ms, so no steady-state speed claim is made; the accepted benefit is fewer compile variants and lower transition-tail evidence.
- Visual/structural evidence: all five Phase 1 fixed-view screenshots are byte-identical after bucketing; fixed-view draw calls, triangles and program counts remain unchanged. Six-wing browser art-direction PASS 1/1.
- Validation: canonical gate PASS, 43 files / 703 tests plus all validators/build/budgets/dist.
- Status: PASS / keep.
- Rollback: `git revert <C4 SHA>`.

## C5 — P13 persistent-shell shader prewarming experiment

- Base SHA: `8f51bed`.
- Result SHA: `d021433`; production experiment fully reverted before commit.
- Experiment: serialized a one-time persistent-scene `compileAsync` behind the first visible frame, after the real environment/fog/light setup, while retaining the existing exhibit prewarm path and single app loop. A browser test first failed because persistent prewarm telemetry was absent, then passed with the candidate and proved no deadlock.
- Matched evidence: app construction remained fast (827 ms in the candidate run), but persistent completion took 13.94 seconds from navigation and the shell compile itself consumed 7.44 seconds of SwiftShader wall time. Subsequent main-axis program growth changed only 65 → 62 and final programs 93 → 96. Render p95 improved 89.1 → 39.4 ms, while p99 regressed 617.2 → 1,991.5 ms because dynamic variants remained.
- Status: REVERTED / no measurable net benefit. The compile was too costly for the arrival window and did not remove the transition-tail outlier.
- Retained behavior: existing serialized per-exhibit `prewarmObject`, deferred PMREM environment, arrival dwell, and P2 light buckets remain unchanged.
- Rollback: already restored exactly to `8f51bed` production behavior; reverting this documentation commit removes only the experiment record.

## C6 — P11 + P16 text residency

- Base SHA: `d021433`.
- Result SHA: `3565382`.
- Files: `src/exhibits/Furniture.ts`, `src/exhibits/ExhibitHost.ts`, `tests/furniture-text-residency.test.ts`, this ledger.
- Change: every streamed exhibit now mounts its physical plaque and lectern with proportional half-resolution previews (`512×256` and `512×370`). Activation generates the original full-resolution textures (`1024×512` and `1024×740`) before making the exhibit visible. Deactivation restores the previews and disposes/untracks both large textures. The mapped materials remain stable, so swaps do not create new shader variants. Exact text, type proportions, geometry, DOM mirrors and headless fallback behavior are retained.
- Existing P16 behavior retained: supplementary cases already mount `384×240` previews, upgrade at most two cases within 12 metres to `1024×640`, retain them through a 15-metre hysteresis band, and release them outside that band. The destructive P12 canvas-source technique remains excluded.
- TDD: the focused test first failed because plaque/lectern construction eagerly allocated the two full canvases. It then passed and proves preview dimensions, active dimensions, material-version stability, downgrade, and a zero-resource scope after release.
- Residency evidence: inactive plaque+lectern canvas area is 320,512 pixels instead of 1,282,048 pixels, a 75% reduction for those two maps while mounted outside reading range. This is pixel-area evidence, not a claim about browser heap or physical GPU memory.
- Live Chromium lifecycle probe on prewarmed E32: the inactive host contained the two previews plus its two existing `512×164` labels; activation replaced only the plaque/lectern maps with the two original full sizes; deactivation restored the previews. Host resource count changed 69 → 71 → 69 and ended mounted, proving the temporary resources settle.
- Matched fixed-view SwiftShader probe: Plaza 972 calls / 146,366 triangles; Rotunda 688 / 92,778; North E01 206 / 48,914; East E18 135 / 32,652; South E32 190 / 24,516. Geometry and submission counts remain identical to the accepted P1/P2 baseline. Short synchronous-render timing remains noisy and is not promoted as a device result.
- Validation: focused residency/lifecycle suites PASS 13/13; canonical gate PASS, 44 files / 704 tests plus validators/build/budgets/dist; focused system-Chromium performance/lifecycle journey PASS 1/1.
- Status: PASS / keep. Physical-device texture-memory measurement and human near-field typography review remain required.
- Dependencies: exhibit activation/deactivation now owns plaque/lectern resolution; unmount continues to call deactivation before scope release.
- Rollback: `git revert <C6 SHA>`.

## C7 — P15 muted audio lifecycle

- Base SHA: `3565382`.
- Result SHA: `221479d`.
- Files: `src/audio/AudioManager.ts`, `tests/audio.test.ts`, this ledger.
- Change: a zone ambience bed now exists only when both overall and ambience volumes are above zero. Muting either effective input immediately cancels cleanup timers, stops/disconnects all bed voices, and clears their residency. Overall volume zero suspends the `AudioContext`; enabling overall volume resumes it from the user-driven settings path. With overall volume enabled and ambience muted, interaction ticks remain available through the master path without creating a room bed. The current zone is retained so unmuting recreates the correct bed, and ordinary audible zone changes keep the existing crossfade/cleanup behavior.
- TDD: the new focused test failed because default-muted startup still allocated a noise buffer and zone oscillators. It now proves zero muted ambience oscillators/buffers/sources, context suspension, one short interaction oscillator with ambience muted, one bed on unmute, zero voices after remute, resume on overall-volume enable, and cleanup on disposal. The pre-existing repeated-wing test now runs audibly and continues to prove that old beds settle to at most the crossfade pair.
- Measured work avoided at default mute in the deterministic test context: three continuous bed oscillators, one looping buffer source, and one four-second 88,200-sample mono noise buffer per current zone become zero. No FPS, power, or physical-device CPU claim is inferred from these object counts.
- Validation: focused audio suite PASS 3/3; canonical gate PASS, 44 files / 705 tests plus validators/build/budgets/dist; system-Chromium keyboard settings/muted-default journey PASS 1/1.
- Status: PASS / keep. Human audible crossfade and browser-specific gesture-policy checks remain part of device acceptance.
- Dependencies: none beyond the existing settings event and single audio manager ownership.
- Rollback: `git revert <C7 SHA>`.

## C8 — P4 + P5 + P10 authoritative Full Weasel integration

- Museum base SHA: `221479d`.
- Museum result SHA: pending this checkpoint commit.
- Upstream base: `westkitty/The_Full_Weasel` `bdd5c94a7486e2a3955c3a27af1179da035fb100`.
- Upstream branch and result: `perf/autonomous-full-weasel-uplift-20261030-bdd5c94` at `1a0d025` (`f32a971` media/startup, `6810a14` portable embed target, and `1a0d025` normalized generated entry markup).
- P4: title readiness now awaits only the title image. Gameplay images preload predictively during How To / Ready, packaged-only sheets are not requested, background probing begins after title interaction, and the Ready gate prevents play before runtime art settles. Music remains gesture-lazy through the existing two-player crossfade path.
- P5: all 44 governed shipped PNGs have smaller lossless WebP derivatives while originals remain in the authoritative upstream. Decoded comparison found zero changed pixels across all 44. Selected image bytes changed 77,690,047 → 48,870,160.
- P10: all nine 832×1504 H.264 loops use CRF 23 slow encoding, `yuv420p`, zero start time and front-loaded `moov` metadata. Bytes changed 40,465,851 → 26,474,903. Matched SSIM spans 0.981099–0.988459; loop duration differs by no more than one 24 fps frame.
- Matched upstream cold title evidence, system Chromium 154 at 1280×720 with service workers blocked: 48 → 2 asset requests; encoded asset bytes 81,855,674 → 4,712,496; one-run title-ready wall time 2,633 → 934 ms. The timing is noisy localhost/cloud evidence, not a device claim. Full `public/assets` payload changed 134,037,830 → 91,233,340 bytes.
- Upstream validation: locked install, standard build, embed build with internal portability verification, Node asset/loading tests PASS, clean browser journey Title → How To → Ready → Interstitial → live Round 1, zero broken images/page errors, playing muted loop, and no packaged-only art requests. Settled title screenshots were visually equivalent (full-frame RMSE 0.01607); image decode equivalence is exact. Optional Google Fonts were unreachable in cloud; the embed intentionally uses its local fallback stack.
- Museum integration: exact upstream `dist-embed` copied to `public/embedded/full-weasel/`; both trees hash to `005090d888adbe4262ad2b483962332972fbea5571e770b79e9eb5c90841007d`. Embedded artifact payload is 91,672,296 bytes (87.43 MiB), down from the recorded 128.24 MiB.
- Museum validation: canonical gate PASS, 44 files / 705 tests plus validators/build/budgets/dist; system-Chromium E27 open/Escape and embedded lifecycle journeys PASS 2/2; standalone production build and static offline verification PASS. The standalone `file://` browser journey was NOT RUN to app assertions because system Chromium rejected navigation first with `ERR_BLOCKED_BY_ADMINISTRATOR`; the existing `--allow-file-access-from-files` flag was already present. No claim is made for that blocked browser proof.
- Status: PASS / keep. Hosted E27 behavior is cloud-verified; local-file browser proof and human mobile audiovisual acceptance remain outstanding.
- Dependencies: Museum rollback depends on reverting this checkpoint; upstream rollback is `git revert 1a0d025 6810a14 f32a971` or revert the eventual upstream PR merge commit.
- Rollback: `git revert <C8 SHA>` restores the prior Museum artifact and provenance.

