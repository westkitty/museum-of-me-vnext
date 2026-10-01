# Release Runbook — Current Repository Facts and Evidence Sequence

This document distinguishes source/build evidence from human acceptance and live-host evidence. It is
not a claim that the current Arena candidate is a finished product or deployed.

## Observed repository state — 2026-10-01

- Arena session branch: `arena/01a0f545-museum-of-me-vnext`, based on `main` at
  `901ec91496f533638c978a3846bd3ea0c7914f48`.
- Remote `main` is at the same SHA; remote `release/v1.0.0` is at
  `0360bdd1c86692dd1e28f6a0dbad3f5a97040252`.
- PR #1 is merged. Main's exact-head run [33746867357](https://github.com/westkitty/museum-of-me-vnext/actions/runs/33746867357)
  passed `gate`, `browser`, `standalone`, and `workshop`.
- PR #4 is open and unmerged at `ad5fa1d706d9d5c76f83842cc41c0510101f96c8`; it proposes active
  pre-1.0 development and a 73-project living collection. This checkout's code remains the historic
  64→35 map. Do not treat PR #4 as merged source or its claims as this branch's current test result.
- No `v1.0.0` tag or GitHub release was listed in the audit. No production URL or hosted response
  was checked. The configured GitHub integration could not query the deployments endpoint.

## Fresh source validation sequence

Run on the exact worktree/head being evaluated:

```bash
npm ci
npm run gate
npm audit --omit=dev --audit-level=high
npx playwright install chromium
npm run test:e2e
npm run build:standalone
npm run verify:standalone
npm run test:workshop
```

`npm run gate` includes typecheck, lint, Vitest, release-tool tests, mapping/content/privacy/frame-loop/
hotpath/asset/exhibit/source-parity validators, QA, production build, transfer budgets and
`verify:dist`. The real Chromium browser job, standalone/offline job, Workshop authoring job and
production dependency audit are separate workflow jobs. Record the exact head and actual result;
prior CI does not automatically transfer to a newer commit.

**2026-10-01 local result:** the fresh gate passed (594 Vitest tests and 9 release-tool tests). The
production-only dependency audit reported zero vulnerabilities. Browser-dependent E2E, standalone
runtime and Workshop proof are **BLOCKED**, not product-test failures: the Playwright Chromium 151
binary was missing and its CDN download failed with TLS `ECONNRESET`. See
[`docs/RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) for the complete verification ledger.

For offline runtime measurements, build the standalone and install Playwright Chromium if necessary:

```bash
npm run build:standalone
npx playwright install chromium
npm run profile
```

The profile writes JSON snapshots under `validation/metrics/`. It records its artifact SHA-256,
browser/backend, fixed viewpoint coordinates and actual zones, frame percentiles, renderer counters,
CPU-side upload/shader call durations, memory/streaming counters and capability limits. Current
snapshots use software SwiftShader and 45 samples per view; they are not representative FPS or GPU
time. The experiment and exact limitations are in
`validation/reports/QUALITY_UPLIFT_2026-10-01.md`.

## Human acceptance record

Complete `validation/reports/HUMAN_QA_CHECKLIST.md` on a representative device/browser. Preserve the
human-authored record with `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md` or the in-museum
`?qa=1` recorder. Record the browser/device, exact route, screenshots/video as useful, notes and
telemetry checkpoints. The decisive judgments include composition/legibility, route discovery,
visual identity, pointer-lock capture/recovery, physical touch feel, opted-in audio/subtitles and
representative-device frame pacing.

Then run:

```bash
npm run verify:human-evidence -- <completed-human-qa.md>
```

That command verifies completeness of an existing human-authored record only. It does not create or
promote judgments and does not replace the human reviewer.

## Static hosting and post-deploy evidence

The runtime is a static site. `npm run build` writes `dist/`; `dist/index.html` is the entry point;
`base: './'` supports root and subpath hosting. `.github/workflows/ci.yml` uses Node.js 22. The
repository has a manual Pages workflow and a source `_headers` contract; neither proves hosted
behavior.

After any deployment, run the verifier against the real HTTPS URL:

```bash
npm run verify:hosted -- https://museum.example/
```

It checks shell response/mount points, revalidation, `nosniff`, frame policy, CSP, same-origin hashed
JS/CSS, successful asset responses and immutable asset caching. Then validate a direct load/hard
refresh and real visitor path on the hosted browser/device. This is necessary to state hosted header,
cache and behavior claims; none are established by local source, build output or CI alone.

## Final repository hygiene

Before any commit/push, inspect `git status`, `git diff --check`, and the full diff. Stage only intended
source, tests, documentation and evidence. Work only on the fixed Arena session branch. Never
force-push, rewrite history, or include unrelated/generated build outputs. Verify the resulting
remote branch SHA and its exact-head checks after push. Do not infer human/hosted acceptance from
those checks.
