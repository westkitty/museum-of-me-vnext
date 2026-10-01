# Asset Policy

## Governing decision: procedural-first, provenance always

The build plan's asset hierarchy (§26) remains:

1. authentic existing project artifacts;
2. museum-safe derivatives of owned artifacts;
3. new original assets;
4. external third-party assets.

Procedural code is the museum's primary strategy for new original geometry and effects. Authentic
project artifacts take precedence when they materially improve interpretation and can be carried
without violating provenance, privacy, offline, accessibility or budget constraints. Derivatives and
third-party assets need a concrete reason; adding binaries for visual fashion is not a quality goal.

| Requirement | Policy |
|---|---|
| No hotlinked runtime assets | Runtime content is local/bundled or generated. Same-origin local files are allowed; remote source/CDN requests are not. |
| Ownership and licensing | Each registered asset records creator/source/license/attribution. External source claims remain distinct from locally verified processed-file hashes. |
| Transfer budgets | `npm run check:budgets` measures the initial production bundle and an allowlisted deferred-bundle extension subtotal, checks shipped binaries and declared tier labels. It omits files such as the Full Weasel `manifest.json` (the full tree is separately hash-checked) and does **not** measure per-exhibit bytes against the printed A/B/C ceilings. |
| Privacy | Public content and asset sources must not introduce visitor-private or operational data. `npm run validate:privacy` is a separate gate. |
| Disposal | GPU resources are scoped through `ResourceScope` or an explicitly documented local lifecycle owner. |
| Determinism | Procedural geometry is built deterministically where its source contract allows; do not claim byte-identical output across graphics backends without evidence. |

## Current governed exceptions

### Curated raster artwork

Nine local raster files in `src/assets/curated/` preserve authentic Reliquary shell, entrance and
project imagery. They are imported by Vite, recorded in `src/assets/curatedAssets.ts`, and consumed
by the UI/artwork systems rather than by `AssetManager.load()`. Their current files match their
manifest SHA-256 values under `npm run validate:assets`.

The authored entrance plate at `embedded-01.avif` already contains its own title, explanatory copy
and entry action. The entry HUD now keeps the separate control instructions semantically available
but visually clipped, rather than painting a second competing copy over the plate. The raster itself
was kept unchanged. The before/after automated screenshots are in `validation/reports/`; neither is
human acceptance evidence.

### Quaternius population assets

Three local CC0 Quaternius GLBs are used by the ambient population system. Runtime files and their
processed hashes are checked; the provenance ledger records the external originals and source hashes.
The ignored `.asset-sources/` cache is not present in this checkout, so those external source bytes
were not independently re-hashed during this audit. See
[QUATERNIUS_ASSET_PROVENANCE.md](QUATERNIUS_ASSET_PROVENANCE.md).

### Deferred first-party Full Weasel artifact

E27 uses the real first-party game through a local same-origin iframe created after explicit exhibit
engagement. The 65-file `public/embedded/full-weasel/` tree remains locally bundled and deferred; its
manifest-bound tree SHA-256 is checked by `npm run validate:assets`. No remote runtime URL is needed.
See [FULL_WEASEL_PROVENANCE.md](FULL_WEASEL_PROVENANCE.md).

### Procedural audio and environment

`AudioManager`, the world builders, and their owning scopes remain the authorities for audio and
procedural environment assets. Audio is muted by default. Ambient effects and geometry must preserve
reduced-motion, low-quality, collision, mapping and lifecycle contracts.

## What this policy does not claim

- Procedural-first does not mean that every visible mesh is loaded through `AssetManager`; shell and
environment builders allocate directly through their owning `ResourceScope`.
- It does not mean every asset is locally generated: the curated rasters, GLBs and Full Weasel tree
are the explicit governed exceptions above.
- It does not mean boxes or placeholders. A procedural asset must meet the exhibit contract's
physical-presence bar: deliberate volume, silhouette and material.
- It does not mean every manifest hash or external source has been reverified. Current processed
files are checked as described in `ASSET_PIPELINE.md`; absent source archives remain a provenance
limitation, not a verified current file.
- No new raster/model was generated or integrated for this audit. No art family was replaced merely
to create activity; the current highest-impact repair was the duplicate entry-screen copy.

## Manifest and verification scope

`src/assets/manifest.ts` defines stable IDs and provenance records. The current `validate:assets`
validator checks literal registration fields and duplicates, obvious HTTP(S) hotlinks, 12 imported
file hashes (nine curated rasters and three GLBs), and the 65-file Full Weasel tree hash. It does not
prove that every arbitrary procedural mesh has a dedicated registry record, verify a publisher's
license against a live source, or re-download the original Quaternius files. Transfer budgets are
checked separately by `npm run check:budgets`.

## Prohibited

- Adding a model or texture without a provenance record and a reason it improves the museum.
- Any runtime request to a host this project does not control.
- Shipping untouched originals into the public deployment tree.
- Replacing a recognized identity anchor without a human-approved regression comparison.
- Adding lights, particles, or geometry subdivisions merely to imitate a visual trend or inflate
  spectacle/performance claims.
