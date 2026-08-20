# Deployment

## What has to be hosted

Static files only. There is no server, no database, no API and no build step at
request time.

The plan's Phase 14 recommends Cloudflare Pages for the shell plus Cloudflare R2
for large hashed museum assets. **The R2 half is not needed.** Every model,
texture and sound in this museum is generated in the browser from code that
ships in the bundle (see `docs/ASSET_POLICY.md`), so there are no runtime binary
assets to host separately. That removes an entire piece of infrastructure, an
asset host to configure, and a class of cache-invalidation bug.

## Build

```bash
npm ci
npm run gate     # everything below must be green before a release
npm run build    # writes dist/
```

`dist/` is the complete deployable artifact.

| Property | Value |
|---|---|
| Output | `dist/` |
| Entry | `dist/index.html` |
| Base path | relative (`./`), so the museum works at a domain root **or** any sub-path without rebuilding |
| Transfer, first visit | ~0.7 MB of JS + CSS + HTML, against the plan's 20 MB budget |
| Runtime network requests | none, after the initial load of its own files |

## Hosting

Any static host works. Two prepared paths:

### Cloudflare Pages (the plan's recommendation)

```
Build command:      npm run build
Build output:       dist
Node version:       22
```

`public/_headers` ships with the build and sets immutable caching on the hashed
assets, no-cache on the HTML shell, and a Content-Security-Policy that forbids
every outbound connection — which the museum can afford because it makes none.

### GitHub Pages

`.github/workflows/deploy-pages.yml` is included but **disabled by default**
(`workflow_dispatch` only). Enabling it needs a repository owner's decision:
Pages on a private repository requires a paid plan, and turning it on makes the
museum public. Neither is a decision this project should make on its own.

## Direct refresh

The museum is a single page with no client-side router, so a refresh at any URL
serves `index.html` and starts at the entrance. No SPA rewrite rule is required.
If a host is configured to 404 on unknown paths, nothing breaks — there are no
unknown paths.

## What remains before the museum is live

Exactly one thing, and it is an account decision rather than an engineering one:

> **Choose a hosting destination and authorise publication.**

Everything else is done: the build is reproducible, the artifact is validated,
the headers and CSP are written, and the workflow exists. Point a host at this
repository with the build command above, or upload `dist/` to any static host.

This project has deliberately not published anything. Publishing makes sixty-four
projects' documentation public, which is the owner's call to make.
