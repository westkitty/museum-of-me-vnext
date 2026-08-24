# Museum of Me vNext — Release Runbook

This runbook prepares Phase 14 without silently performing publication. It is intentionally separate from the build plan's implementation gates.

## Current release shape

- Source branch: `release/v1.0.0`
- Release PR: `release/v1.0.0` → `main`
- Static build output: `dist/`
- Build runtime: Node.js 22
- Browser runtime: modern WebGL 2 browser
- Current large-asset host requirement: none; the present release ships procedural museum content and no runtime binary museum assets
- Future large governed assets: use the build plan's separate asset-host policy when actual GLB/KTX2/audio binaries are introduced

## Required evidence before publication

A release candidate is eligible for an owner publication decision only when all of the following are true:

1. Canonical `museum gate` succeeds on the exact release head.
2. The browser job succeeds on the exact release head, including the production-only dependency audit and Playwright visitor-path suite.
3. `npm run verify:dist` succeeds after the production build.
4. The 35-exhibit / 64-project / 35-bespoke QA report remains green.
5. A real-device human pass completes `validation/reports/HUMAN_QA_CHECKLIST.md`, including pointer lock, silent operation and representative-device FPS, and preserves a completed Markdown evidence record based on `validation/reports/HUMAN_QA_EVIDENCE_TEMPLATE.md` or the in-museum `?qa=1` recorder output.
6. Run `npm run verify:human-evidence -- <completed-human-qa.md>` against that preserved record and require PASS. The verifier checks evidence completeness only: exactly nine human acceptance checks must be PASS, at least six telemetry snapshots must be present, and human notes must exist. It does not make the underlying perceptual/device judgments.
7. The release PR remains reviewable and mergeable.

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

Do not add a second deployment implementation until the first hosted path has been manually proven.

## Hosted transport/header verifier

After an explicitly authorized deployment, run the deterministic hosted verifier against the real HTTPS entry URL:

```bash
npm run verify:hosted -- https://museum.example/
```

It checks the hosted shell for a successful response, the three required mount points, shell revalidation, `nosniff`, frame denial, the required CSP boundary, same-origin content-hashed JavaScript/CSS, successful asset responses, and immutable one-year asset caching. Its own logic is exercised by `npm run test:release-tools`, which is part of the canonical gate.

This is transport/header evidence only. It deliberately does **not** promote visual composition, silent operation, pointer-lock feel/recovery, or representative-device FPS to verified.

## Post-deploy verification

After an explicitly authorized deployment, verify the actual hosted URL rather than inferring success from the build:

- run `npm run verify:hosted -- <production-url>` and require PASS
- direct load and hard refresh return the museum shell
- the start view is the exterior Arrival Plaza
- map, journal, settings and accessible contents open
- pointer lock captures and recovers after Escape
- the museum remains silent through entry, interaction, and zone changes
- a representative device records acceptable FPS
- a representative exhibit in every wing loads, interacts and unloads without an uncaught error

The hosted verifier should catch transport/header/cache regressions quickly; the real browser/device pass remains decisive for behavior and perception.

## Merge and tag boundary

Do not merge PR #1, create `v1.0.0`, or publish a production URL merely because the repository is buildable. Those are owner-controlled release actions and should follow the current-head automated evidence plus the remaining human/device evidence.

When those conditions are met and publication is explicitly authorized, the intended order is:

1. confirm exact release-head checks
2. preserve the completed human QA evidence record and require `npm run verify:human-evidence -- <record>` PASS
3. merge the reviewed release PR into `main`
4. deploy the resulting `main` commit
5. run hosted verification and verify the live browser/device path
6. tag the verified deployed commit as `v1.0.0`

If live verification fails, repair the release before tagging rather than tagging a known-bad deployment.
