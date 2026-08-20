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
5. A real-device human pass completes `validation/reports/HUMAN_QA_CHECKLIST.md`, including pointer lock, audible audio and representative-device FPS.
6. The release PR remains reviewable and mergeable.

Automated browser evidence reduces uncertainty; it does not substitute for the explicitly human checks above.

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

## Post-deploy verification

After an explicitly authorized deployment, verify the actual hosted URL rather than inferring success from the build:

- direct load and hard refresh return the museum shell
- the start view is the exterior Arrival Plaza
- hashed JavaScript/CSS assets return 200
- `_headers` policies are present on the hosted response
- map, journal, settings and accessible contents open
- pointer lock captures and recovers after Escape
- ambience is audible after a user gesture and subtitles agree with audible output
- a representative device records acceptable FPS
- a representative exhibit in every wing loads, interacts and unloads without an uncaught error

## Merge and tag boundary

Do not merge PR #1, create `v1.0.0`, or publish a production URL merely because the repository is buildable. Those are owner-controlled release actions and should follow the current-head automated evidence plus the remaining human/device evidence.

When those conditions are met and publication is explicitly authorized, the intended order is:

1. confirm exact release-head checks
2. merge the reviewed release PR into `main`
3. deploy the resulting `main` commit
4. verify the live URL
5. tag the verified deployed commit as `v1.0.0`

If live verification fails, repair the release before tagging rather than tagging a known-bad deployment.
