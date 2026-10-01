# Full Weasel embedded artifact provenance

## Source

- Canonical first-party repository: `https://github.com/westkitty/The_Full_Weasel`
- Pinned source commit: `bdd5c94a7486e2a3955c3a27af1179da035fb100`
- Declared source licence: Unlicense / public-domain dedication in the repository README.
- Source inspected: package, Vite configuration, React entry point, asset preparation script, PWA/service-worker code, built `dist`, and runtime asset manifest.

## Museum-owned build

The artifact at `public/embedded/full-weasel/` is a controlled copy of the source project's production `dist` output. It preserves the actual game, including its authored sprite, PNG/video background and music sets.

Build command in a checkout pinned to the commit above:

```bash
npm ci
npm run build
```

Required embed-only changes before that build:

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

- Production-copy tree SHA-256: `1264138dd16bce815f761c7b8cd22708ef6d0fba703b6f6b1dd1e32fd99937ce`
  (ASCII-lexically sorted relative file paths, each followed by a NUL byte and
  its raw file bytes). `npm run validate:assets` re-computes this tree hash.
- **Re-measured 2026-10-01 in this checkout:** 65 files, 134,484,501 bytes
  (128.25 MiB, binary units). The earlier 128.24 figure was the separate `check:budgets` extension
  subtotal (it omits the 14,503-byte `manifest.json`), not a full-tree measurement.
- Entry point: `./embedded/full-weasel/index.html`.
- Runtime request policy: local same-origin files only. The original Google Fonts and GitHub Pages assumptions are absent; no remote URL is embedded.
- Lifecycle: the iframe is created on E27 engagement and removed before Museum input is released, stopping the embedded React timers/media rather than leaving a hidden game running.
