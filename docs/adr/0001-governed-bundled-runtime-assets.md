# ADR 0001 — Governed bundled runtime assets

**Status:** Accepted and realized — Phase 3 ships three governed Quaternius
GLBs and Phase 6 ships the deferred first-party Full Weasel artifact.

## Context

The vNext release is procedurally led and includes a small, locally bundled set
of curated raster artwork. Its governed `AssetManager` path now also carries
three approved third-party Quaternius population GLBs, while E27 embeds a
locally bundled first-party Full Weasel artifact on explicit engagement. None
of these runtime assets may make the Museum dependent on a remote host.

## Decision

Procedural generation remains the default for Museum architecture and new
original presentation assets. A locally bundled first-party artifact or an
approved third-party asset is permitted when it is necessary to present real
finished work or an approved population asset, respectively.

Every such asset must have a governed record with provenance, licensing state,
source and processed hashes where applicable, byte budget, runtime location,
and explicit `ResourceScope` ownership. Runtime remains offline-capable and
must not hotlink source repositories, CDNs, or asset stores.

## Consequences

The Phase 3 and Phase 6 integrations update the asset policy and manifest in
the same changes that introduce the assets. Their physical-file inspection,
source/processed hashes, licensing, conversion and offline-runtime evidence are
recorded in `docs/QUATERNIUS_ASSET_PROVENANCE.md` and
`docs/FULL_WEASEL_PROVENANCE.md`. Future assets follow the same contract rather
than relying on pack descriptions or remote availability.

## Rollback

The policy can be reversed for a future asset class by removing that asset's
governed runtime use. Historical procedural and curated-raster release evidence
remains intact.
