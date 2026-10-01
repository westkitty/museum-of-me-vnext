# Deployment

## Hosting model

The Museum is a static web application. There is no runtime application server, database or API.
`npm run build` writes the deployable site to `dist/`; `dist/index.html` is the entry point. The
Vite configuration uses a relative base (`./`) so output can be served from a domain root or a
sub-path. `npm run verify:dist` checks the local distribution contract, including the emitted
`_headers` file and its asset references.

The production workflow currently uses Node.js 22 (`.github/workflows/ci.yml`). Its browser job
runs the production-only dependency audit and Chromium visitor-path suite; the standalone job
builds and verifies the offline `file://` artifact. These are CI contracts, not observations of a
hosted production response.

## Build and check

```bash
npm ci
npm run gate
npm run build
npm run verify:dist
```

`npm run gate` already includes `npm run build` and `npm run verify:dist`; the repeated commands
above are shown separately only when a host's build configuration needs an explicit output check.
The deployment directory is `dist/`.

## Static host configuration

Any static host that serves the built files and honors `public/_headers` can host the application.
The repository contains a GitHub Pages `workflow_dispatch` workflow and a `public/_headers` file
annotated for Cloudflare Pages / Netlify. No Cloudflare deployment workflow was observed. Neither
workflow presence nor a source header file proves that a live host emitted the required headers or
cache policy.

The current source header contract includes revalidation for the HTML shell, immutable caching for
hashed assets, `nosniff`, framing protection, permissions/referrer policies and a same-origin CSP.
The exact live behavior is a property of a deployed host and must be measured there.

## Current evidence boundary — 2026-10-01

This audit did **not** test a production URL, hosted response headers, hard refresh or cache behavior.
The GitHub deployments API was not accessible to the configured integration, so this report does not
claim that no deployment exists. Do not infer hosted behavior from `public/_headers` or `dist/`.

After a deployment, run the HTTPS verifier against the real URL:

```bash
npm run verify:hosted -- https://museum.example/
```

The verifier checks a successful shell response, required mount points, shell revalidation,
`nosniff`, frame denial, the CSP boundary, same-origin content-hashed JavaScript/CSS, successful
asset responses and immutable one-year asset caching. Its deterministic logic is covered by
`npm run test:release-tools`.

Then perform the relevant real-browser/device checks: direct load and hard refresh, exterior start,
map/journal/settings/accessibility, pointer-lock capture and recovery, deliberate audio opt-in and
subtitle behavior, representative exhibit interaction, touch behavior where supported, and
representative-device performance. The hosted verifier is transport/header evidence only; it cannot
promote visual, audio, pointer-lock-feel or representative-device judgments.

The user-facing repository/branch and CI facts observed for this audit are in `OPERATIONAL_STATE.md`
and `README.md`. Any future deployment or release decision must use the current branch and fresh
evidence, not the superseded August/September runbook state.
