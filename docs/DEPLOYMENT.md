# Deployment

## What has to be hosted

Static files only. There is no application server, database, API, or request-time build step.

The build plan's Phase 14 recommends Cloudflare Pages for the shell plus Cloudflare R2 for large hashed museum assets. **The R2 half is not needed for the current release candidate.** Current museum models, textures and sounds are generated procedurally from code shipped in the bundle (see `docs/ASSET_POLICY.md`), so there are no runtime museum binary assets that need a second host.

## Release-candidate build

Before publication is even considered, the release head must pass the repository gates:

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
| Base path | relative (`./`), so the museum can work at a domain root or sub-path without rebuilding |
| Runtime model | static same-origin files; no live backend required |
| Current separate asset host | none |

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

`.github/workflows/deploy-pages.yml` is `workflow_dispatch` only. It is deliberately not triggered by pushes. The workflow's existence does not prove that the resulting hosted responses satisfy the current cache/security-header contract. Do not use this fallback for release unless an explicitly authorized deployment passes `npm run verify:hosted -- <url>` or the equivalent policy is otherwise verified on the live responses.

## Direct refresh

The museum is a single page with no client-side router. A refresh of the museum entry URL serves `index.html` and starts at the exterior arrival. No SPA rewrite rule is required for the current route structure.

## Evidence still required before publication

The repository is engineered to release, but publication is **not** the only thing remaining. Before an owner release decision:

1. complete `validation/reports/HUMAN_QA_CHECKLIST.md` on a representative real browser/device;
2. verify pointer lock and recovery/recapture behavior;
3. verify audible ambience/exhibit audio against subtitles;
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
- audible output and subtitles agree;
- representative exhibit interaction works in every wing;
- representative-device FPS remains acceptable.

`verify:hosted` checks the hosted shell, required security/cache headers, same-origin hashed JavaScript/CSS, successful asset responses and immutable asset caching. It does not substitute for visual, audio, pointer-lock-feel or device-performance evidence.

The exact merge/deploy/verify/tag ordering is governed by `docs/RELEASE_RUNBOOK.md`.

## Publication boundary

No production URL, merge, auto-merge, deployment or `v1.0.0` tag is authorized by repository readiness alone. Publishing documentation for the represented projects is an owner-controlled action.
