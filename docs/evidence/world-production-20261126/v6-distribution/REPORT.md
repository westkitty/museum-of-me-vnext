# V6 production distribution: size analysis, safe reduction, rehearsals (2026-11-26)

The budget and its checker (`scripts/check-budgets.mjs`, 20 MB "initial visit") are **unchanged**. `scripts/analyze-distribution.mjs` is diagnostic only. It classifies every emitted file and reports uncompressed, gzip -9 and brotli q11 sizes. Raw data: [distribution-analysis.json](distribution-analysis.json).

## What the 20 MB checker counts

The checker sums the uncompressed size of every emitted file in `dist/` except the deferred Full Weasel iframe (87.43 MB). It therefore counts lazy JS, world chunks and unreferenced public files as "initial", whether or not a visitor ever downloads them.

### Before the V6 reduction

Ordinary candidate (`perf-results/v6/dist-cand`, V6 source) compared with the rehearsal build (`test-results/rehearsal-dist`, all eleven worlds promoted):

| Class | Files | Raw MB | gzip MB | brotli MB | When a visitor fetches it |
|---|---:|---:|---:|---:|---|
| Entry JS (index.html plus static imports) | 4 | 2.46 | 0.47 | 0.36 | Boot (see note 1) |
| Lazy JS | 8 | 1.66 | 0.42 | 0.34 | On demand (loaders, Workshop runtime, decoders) |
| Media (GLB, PNG, WebP) | 160 | 12.31 | 12.31 | 12.31 | Mixed; 4.96 MB of it never (note 2) |
| Other (WASM, headers, licence) | 6 | 0.96 | 0.38 | 0.31 | On demand (Draco/Basis decoders) |
| Shell (HTML, CSS) | 5 | 0.15 | 0.04 | 0.04 | Boot |
| **Counted by the checker** | | **17.54** | | | |
| World (rehearsal only): 11 factories plus 3 W01 stems | 14 | 3.16 | 3.04 | 3.03 | First entry to that world only |
| **Counted, rehearsal (all worlds active)** | | **20.70** | | | |

1. **The `interior` chunk is not lazy.** The entry module statically imports `interior-*.js` (1.76 MB raw, 0.21 MB brotli). Rollup placed shared exports in that manual chunk, so every visit downloads and parses it at boot. The later `import()` resolves instantly. Making it truly lazy would move about 1.8 MB of parse into the doorway approach, which is the governing walk window that V6 Workstream A just brought under budget. It was therefore **not changed**. It is recorded as a measured trade-off for a later, matched experiment.
2. **The 133 builder-catalog files are unreferenced.** `builder-assets/openlife/*` (4.96 MB of PNG and GLB) is copied from `public/` into every build. The production runtime (`MuseumPlacements`) only resolves catalog files that the authored placement manifest references, and it references none. The offline package already embeds only referenced files.

## Safe reduction applied (V6)

The `museum-builder-catalog-prune` build step (`scripts/builder-asset-prune.mjs`, tests `scripts/builder-asset-prune.test.mjs` 3/3) keeps exactly the catalog files the placement manifest references, plus the licence. A placement added later is included automatically. No visible content, texture, model, audio or quality tier changed. The W01 masters are untouched.

Measured on the V6 source with the plugin wired in (`perf-results/v6/dist-pruned`; raw data in [distribution-analysis-pruned.json](distribution-analysis-pruned.json)):

| Class | Before raw MB | After raw MB |
|---|---:|---:|
| Media | 12.31 | 7.35 |
| Entry JS, lazy JS, other, shell | 5.23 | 5.23 (unchanged) |
| **Counted by the checker** | **17.54** | **12.58** |

`builder-assets/openlife/` now ships only `LICENSE.txt`, because the authored manifest references no catalog file. `verify-release-dist` passes on this build. The development-only Workshop, which browses the whole catalog, still reads it from `public/` under Vite dev. The final gate figure on the exact candidate is in the ledger.

## Option A / Option B (owner decision; nothing changed)

- **Option A: keep the current definition.** With the reduction, full activation fits under the unchanged 20 MB rule: about 15.7 MB (12.58 MB plus 3.16 MB of world chunks and stems). That leaves about 4.3 MB of headroom for future worlds.
- **Option B: count world chunks and stems as deferred,** as the Full Weasel iframe already is, since each is fetched only on first entry to its world. The initial figure would then stay at the ordinary build's size, whatever the number of active worlds.

The reduction makes the choice non-urgent for the current eleven worlds. Option B describes what a visitor actually downloads, while Option A is stricter. Either way the checker is the owner's to change.

## Rehearsals (rehearsal build only; isolated storage)

All of these run on `VITE_POCKET_REHEARSAL=1` builds served from `127.0.0.1:4193` or opened from `file://` in fresh Playwright contexts. The owner's real browser profile and passport are never read or written.

- **Staged-release prefixes** `?rehearsalPrefix=N`: rehearsal builds only, unit-tested, and absent from ordinary builds (the verifier checks this).
- **Earned progression in the production build.** W10 is locked. The visitor walks to W09 and completes it, W09 is stamped in the context's own storage, the visitor walks back to the pier, and W10 opens and is completed. Both stamps persist across a reload.
- **Failed and interrupted lazy loads.**
  - A network-failed W08 chunk leaves the visitor safely in the museum. Keyboard focus stays on the dialog's Enter, and Esc closes the dialog with no input capture left behind. Once the network returns, the visitor reopens the dialog and enters.
  - A W03 chunk held in flight is cancelled with Escape, and its late arrival opens nothing.
  - **Defect found and fixed here:** before V6, a failed load left focus on the page, so the dialog's "Back (Esc)" did nothing until the visitor clicked. `PocketTransition` now returns focus to Enter.
- **Activated offline package.** The rehearsal standalone is built into `test-results/` (never `release/` or `dist-standalone/`) and opened offline. All eleven worlds are verified, W08 and W01 are entered on foot, and W01's stems decode from the file.

Results and source identity are in the ledger's V6 qualification table.

## Ordinary-build exclusion regression

`scripts/verify-release-dist.mjs` (run by `npm run gate` as `verify:dist`) now fails an ordinary build that contains any of the following:

- a pocket-world chunk;
- the production activation module;
- a W01 stem, even an orphan that nothing imports;
- rehearsal activation code.

Its regression test is `scripts/release-dist-worlds.test.mjs` (4/4, part of `test:release-tools`). Against the real builds, the ordinary candidate PASSES and the rehearsal build FAILS, listing all 15 world files.
