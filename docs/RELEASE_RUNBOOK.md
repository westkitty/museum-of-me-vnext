# Museum of Me vNext — Pre-1.0 Acceptance and Publication Runbook

This is an **owner-controlled acceptance runbook**, not an instruction to release automatically. Engineering verification, actual hosted deployment, and human/device acceptance are independent evidence classes.

## Current implementation and historical lineage (2026-10-12)

- **Current development implementation:** `main` at `4a464ebd5c6d09265e559b7b1299f025c399aa56`. Exact-head GitHub Actions run `38310708395` passed `gate`, `browser`, `standalone`, and `workshop` (644 unit tests, 16 browser scenarios, 14 source installations and 17 authored visitors).
- **Current collection:** 73 represented projects, 35 bespoke exhibits in six wings; do not revert to the earlier 64-project snapshot.
- **Current public preview:** GitHub Pages `pages-preview` is serving `e6b0a5f63ae37a9ef0d915f7bec6d9567206aa89`, not current `main`. Main pushes do not update public Pages.
- **Historical names only:** `release/v1.0.0`, PR #1, PR #3, and earlier release receipts are historical development lineage, not an accepted v1.0.0. PR #1 merged September 3, 2026 and is not pending.
- **Build shape:** Node.js 22 in GitHub Actions; modern WebGL 2 browser; static build `dist/`. Provenance-governed Quaternius GLBs and the local Full Weasel artifact ship without unnecessary remote hotlinks.
- **Release status:** ACTIVE DEVELOPMENT / PRE-1.0. Representative-device FPS, visual quality, pointer-lock feel, and audible opt-in behavior remain human-judged and pending.

## Required evidence before publication

Before any future owner-authorized publication or 1.0 decision, verify each applicable condition. The October 12 exact-head automated jobs are green; the human/device and hosted checks remain open:

1. Canonical `museum gate` succeeds on the exact release head.
2. The browser job succeeds on the exact release head, including the production-only dependency audit and Playwright visitor-path suite.
3. The standalone job succeeds on the exact release head, including the offline canonical artifact verification.
4. The Workshop job succeeds on the exact release head, preserving the development-only authoring/save/reload contract without changing production ownership.
5. `npm run verify:dist` succeeds after the production build.
6. The 35-exhibit / 73-project / 35-bespoke current QA report remains green.
7. A real-device human pass completes `validation/reports/HUMAN_QA_CHECKLIST.md`, including pointer lock, muted-by-default audio and representative-device FPS, and preserves a completed Markdown evidence record based on `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md` or the in-museum `?qa=1` recorder output.
8. Run `npm run verify:human-evidence -- <completed-human-qa.md>` against that preserved record and require PASS. The verifier checks evidence completeness only: exactly nine human acceptance checks must be PASS, at least six telemetry snapshots must be present, and human notes must exist. It does not make the underlying perceptual/device judgments.
9. The exact reviewed target SHA and hosting destination are explicitly approved; no obsolete historical PR merge is required.

Automated browser evidence reduces uncertainty; it does not substitute for the explicitly human checks above. The `?qa=1` recorder structures human evidence and captures telemetry snapshots, but the human tester still makes every perceptual/device judgment.

The automated `npm run qa` command is not allowed to rewrite the hand-maintained human checklist. `scripts/qa-report-runner.mjs` preserves that file byte-for-byte while still allowing the Phase-13 automated QA report to regenerate.

## Cloudflare Pages configuration

When the owner explicitly authorizes publication:

- Framework preset: none / Vite-compatible static build
- Production branch: `main`
- Build command: `npm ci && npm run build && npm run verify:dist`
- Build output directory: `dist`
- Node version: 22
- Root directory: repository root

`public/_headers` is copied into `dist/_headers` by Vite. It provides revalidation for the HTML shell, immutable caching for hashed assets, framing protection, a permissions policy, and the current same-origin Content Security Policy.

Do not introduce another deployment mechanism. The existing GitHub Pages preview path is separate from any future Cloudflare production release and has its own owner-controlled publication trigger.

## Hosted transport/header verifier

After an explicitly authorized deployment, run the deterministic hosted verifier against the real HTTPS entry URL:

```bash
npm run verify:hosted -- https://museum.example/
```

It checks the hosted shell for a successful response, the three required mount points, shell revalidation, `nosniff`, frame denial, the required CSP boundary, same-origin content-hashed JavaScript/CSS, successful asset responses and immutable one-year asset caching. Its own logic is exercised by `npm run test:release-tools`, which is part of the canonical gate.

This is transport/header evidence only. It deliberately does **not** promote visual composition, audio behavior, pointer-lock feel/recovery, or representative-device FPS to verified.

## Post-deploy verification

After an explicitly authorized deployment, verify the actual hosted URL rather than inferring success from the build:

- run `npm run verify:hosted -- <production-url>` and require PASS
- direct load and hard refresh return the museum shell
- the start view is the exterior Arrival Plaza
- map, journal, settings and accessible contents open
- pointer lock captures and recovers after Escape
- Sound controls begin muted and opted-in playback behaves as expected
- a representative device records acceptable FPS
- a representative exhibit in every wing loads, interacts and unloads without an uncaught error

The hosted verifier should catch transport/header/cache regressions quickly; the real browser/device pass remains decisive for behavior and perception.

## Publication and 1.0 boundary — current contract

The older PR #1 was already merged on September 3, 2026. Neither that PR title nor the historical `release/v1.0.0` branch establishes the Museum's product maturity. Current status is **ACTIVE DEVELOPMENT / PRE-1.0**.

The current public GitHub Pages preview is `pages-preview` at `e6b0a5f`; development `main` is `4a464eb`. Only an explicit preview-branch push or an authorized `workflow_dispatch` launches `.github/workflows/deploy-pages.yml`. A development push to `main` does not publish.

When the owner makes a distinct decision to publish a reviewed development preview, follow this order:

1. Confirm the exact selected SHA and its four GitHub CI jobs, and inspect the whole diff being exposed. Current `pages-preview...main` spans 57 commits, not merely the most recent repair.
2. Complete the real-device human QA record (nine judgments, six or more snapshots), validate it, and resolve any blocking Needs-work observations relevant to the intended publication.
3. Receive explicit approval for the target (Pages preview or a separately established production host) and exact SHA. Do not infer it from `git push main` or from development continuation requests.
4. Trigger only the approved deployment mechanism; inspect the live receipt, assets, HTTPS response, and actual hosted browser/device journey, including audio and pointer lock.
5. If hosted verification fails, repair and rerun the gates rather than claiming publication success.
6. A future **v1.0.0** tag is a separate later milestone that requires express owner acceptance of product completeness. No tag is authorized by this runbook alone.
