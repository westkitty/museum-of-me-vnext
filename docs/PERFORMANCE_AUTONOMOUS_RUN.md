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
| 3 | P7 quality selection | PASS | pending C3 commit | Missing-memory, 4 GB, 8 GB, 16 GB and mobile cases covered. |
| 4 | P2 lighting stability | PENDING | — | Compare dynamic vs bounded counts; retain current design if no benefit. |
| 5 | P13 shader prewarming | PENDING | — | Existing exhibit prewarm must not be duplicated. |
| 6 | P11 + P16 text residency | PENDING | — | Existing supplementary/curated residency is the starting point. |
| 7 | P15 muted audio | PENDING | — | Preserve gesture policy, interaction audio and cleanup. |
| 8 | P4 + P5 + P10 Full Weasel | PENDING | — | Requires separately authorized upstream source access. |
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
- Result SHA: pending this checkpoint commit.
- Files: `src/render/QualityTiers.ts`, `tests/accessibility.test.ts`, this ledger.
- Change: unavailable `navigator.deviceMemory` remains unknown instead of being converted to a confirmed 4 GB signal. Confirmed 4 GB and mobile devices remain low; missing memory with eight cores resolves conservatively to medium; an 8 GB device stays medium; high now requires more than 8 GB, at least eight cores and a wide display. User quality overrides and adaptive resolution are unchanged.
- TDD: the Safari-like missing-memory case failed as low before implementation, then the focused accessibility suite passed 40/40.
- Validation: canonical gate PASS, 43 files / 702 tests plus all validators/build/budgets/dist.
- Status: PASS / keep. This changes automatic quality choice, so performance comparisons remain separated from same-quality rendering comparisons.
- Rollback: `git revert <C3 SHA>`.

