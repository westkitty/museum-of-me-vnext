# ADR 0001 — Governed bundled runtime assets

**Status:** Accepted — policy activation; no new external or first-party binary
asset is shipped by this ADR.

## Context

The vNext release was procedurally led. Its current runtime also includes a
small, locally bundled set of curated raster artwork, while `AssetManager`
already provides a governed GLTF loading path. The accepted creative expansion
requires two further asset classes: approved third-party Quaternius population
assets and a locally bundled first-party Full Weasel artifact. Neither may make
the Museum dependent on a remote host.

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

Future Quaternius and Full Weasel phases must update the asset policy and
manifest in the same change that introduces an asset. They must inspect physical
files and retain evidence rather than relying on pack descriptions. This ADR
does not assert that any Quaternius or Full Weasel file is currently integrated.

## Rollback

The policy can be reversed for a future asset class by removing that asset's
governed runtime use. Historical procedural and curated-raster release evidence
remains intact.
