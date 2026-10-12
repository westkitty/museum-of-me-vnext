# Museum of Me vNext — Deployment

**Current truth (October 12, 2026):** Development `main` is `4a464ebd5c6d09265e559b7b1299f025c399aa56` with all four exact-head GitHub Actions jobs green. The existing *public preview* at `https://westkitty.github.io/museum-of-me-vnext/` still serves older `pages-preview` `e6b0a5f63ae37a9ef0d915f7bec6d9567206aa89`. This is not a newly deployed current-main build or an approved 1.0 release. Publication remains separately owner-controlled.

## What has to be hosted

Static files only. There is no application server, database, API, or request-time build step.

The build plan's Phase 14 recommends Cloudflare Pages for the shell plus Cloudflare R2 for large hashed museum assets. **The R2 half is not needed for the current candidate.** The candidate includes provenance-governed local Quaternius GLBs and a deferred locally bundled Full Weasel application; offline verification must continue to show zero unnecessary remote requests. Audio is not permanently disabled: the audio system exists, with Overall volume and Ambience defaulting to zero until the visitor opts in.

## Pre-1.0 build and verification

Before any new public deployment is considered, verify the exact selected development commit. Current `main` passed GitHub Actions run `38310708395`, but future changes require fresh proof:

```bash
npm ci
npm run gate
```

The independent GitHub Actions browser job additionally performs the production-only dependency audit and committed Chromium visitor-path suite. A green source/build gate is not a substitute for the remaining human/device checklist.

`dist/` is the complete static deployable artifact. `npm run gate` already builds it and runs `npm run verify:dist`.

| Property | Value |
|---|---|
| Output | `dist/` |
| Entry | `dist/index.html` |
| Base path | Relative (`./`) by default for general static hosting. GitHub Pages requires the explicit `VITE_PUBLIC_BASE=/museum-of-me-vnext/` build setting used by its existing workflow. |
| Runtime model | static same-origin files; no live backend required |
| Current separate asset host | none; governed runtime assets are bundled locally |

## Hosting

Any static host that preserves the required response policy can work. The currently prepared release path is Cloudflare Pages; a manual GitHub Pages workflow also exists as a fallback but is not considered release-equivalent until it passes the same hosted verification contract.

### Cloudflare Pages — recommended release path

When publication is explicitly authorized:

```text
Production branch:    main
Build command:        npm ci && npm run build && npm run verify:dist
Build output:         dist
Node version:         22
Root directory:       repository root
```

`public/_headers` ships with the build and declares immutable caching for hashed assets, revalidation for the HTML shell, `nosniff`, framing protection, permissions/referrer policies, and the current same-origin Content-Security-Policy.

### GitHub Pages — manual fallback only

`.github/workflows/deploy-pages.yml` runs on either an explicit `workflow_dispatch` or a push to the dedicated `pages-preview` branch; **ordinary `main` pushes do not deploy**. The current hosted preview is `e6b0a5f`; a future approved build of the current `main` must use `VITE_PUBLIC_BASE=/museum-of-me-vnext/` and pass its Pages artifact and live SHA checks. This hosting path is a development preview, not an automatic production 1.0 release. Do not change `pages-preview` without a distinct owner publication decision.

## Direct refresh

The museum is a single page with no client-side router. A refresh of the museum entry URL serves `index.html` and starts at the exterior arrival. No SPA rewrite rule is required for the current route structure.

## Evidence still required before publication

The current development baseline is automated-test green but **PRE-1.0**. Before an owner publication/release decision:

1. complete `validation/reports/HUMAN_QA_CHECKLIST.md` on a representative real browser/device;
2. verify pointer lock and recovery/recapture behavior;
3. verify audio starts muted at zero volume, then only plays after a visitor deliberately raises the Sound controls;
4. record representative-device FPS and complete the visual walkthrough;
5. keep the exact release head green after any repairs.

## Post-deploy verification

After an explicitly authorized deployment, verify the real hosted URL rather than inferring success from the build artifact. Start with the transport/header check:

```bash
npm run verify:hosted -- https://museum.example/
```

Require that command to pass, then perform the real browser/device checks:

- direct load and hard refresh return the museum shell;
- the exterior start, map, journal, settings and accessible contents work;
- pointer lock captures, releases and recaptures on a real browser/device;
- Sound controls begin at zero and opted-in audio/subtitles behave as expected;
- representative exhibit interaction works in every wing;
- representative-device FPS remains acceptable.

`verify:hosted` checks the hosted shell, required security/cache headers, same-origin hashed JavaScript/CSS, successful asset responses and immutable asset caching. It does not substitute for visual, audio, pointer-lock-feel or device-performance evidence.

The exact merge/deploy/verify/tag ordering is governed by `docs/RELEASE_RUNBOOK.md`.

## Publication boundary

An older public Pages preview URL already exists, but no automatic promotion of current `main` to that URL, Cloudflare production deployment, history rewrite, or `v1.0.0` tag is authorized by green repository checks. Publishing the updated represented-project collection remains an owner-controlled action.
