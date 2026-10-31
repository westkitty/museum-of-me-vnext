# Full Weasel embedded artifact provenance

## Source

- Canonical first-party repository: `https://github.com/westkitty/The_Full_Weasel`
- Pinned source commit: `1a0d025` on branch `perf/autonomous-full-weasel-uplift-20261030-bdd5c94`
- Declared source licence: Unlicense / public-domain dedication in the repository README.
- Source inspected: package, Vite configuration, React entry point, asset preparation script, PWA/service-worker code, built `dist`, and runtime asset manifest.

## Museum-owned build

The artifact at `public/embedded/full-weasel/` is an exact controlled copy of the source project's verified `dist-embed` output. It preserves the actual game, including its authored sprite, lossless WebP/video background and music sets.

Build command in a checkout pinned to the commit above:

```bash
npm ci
npm test
npm run build:embed
```

The governed upstream embed target applies and verifies these embed-only rules:

- Vite `base` changes from `/The_Full_Weasel/` to `./`.
- Absolute document icon/preload paths become relative.
- Google Fonts import/preconnects are removed; the source CSS fallback stack remains.
- Root-scoped PWA manifest and service-worker registration are removed.
- When the artifact is opened from the Museum's `file://` standalone, the
  asset-manifest read uses local `XMLHttpRequest` rather than Fetch API (which
  Chromium blocks for `file://`). Hosted local builds keep the source Fetch API
  path; this change only makes the identical local manifest readable offline.
- Escape posts `full-weasel:close` to the parent so the Museum can explicitly end engagement and restore first-person input.
- Generated `sw.js` and `manifest.webmanifest` are excluded from the committed embedded output; they are not gameplay requirements inside the iframe.

## Integrity and runtime scope

- Production-copy tree SHA-256: `005090d888adbe4262ad2b483962332972fbea5571e770b79e9eb5c90841007d`
  (lexically ordered relative file paths, each followed by a NUL byte and its
  raw file bytes).
- Measured artifact size: 87.43 MiB (91,672,296 bytes).
- Entry point: `./embedded/full-weasel/index.html`.
- Runtime request policy: local same-origin files only. The original Google Fonts and GitHub Pages assumptions are absent; no remote URL is embedded.
- Lifecycle: the iframe is created on E27 engagement and removed before Museum input is released, stopping the embedded React timers/media rather than leaving a hidden game running.
