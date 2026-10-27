# Museum of Me — top-down spatial workbench

The source-pinned architectural planning companion is available at `/workbench/` on the museum's hosted base path, and as the standalone file `public/workbench/index.html` for offline review. It is **not** the first-person Three.js museum, nor a replacement for its development-only Museum Workshop.

## Truth boundaries

- Grounded to `src/world/layout.ts`, `src/world/Museum.ts`, `src/world/installationPlacement.ts` and `data/exhibit-mapping.current.json` at inspected repository commit `6278d2c8fea5b27466bc4840170b3d25e611e3c1` (October 27, 2026).
- Preserves 35 fixed physical exhibit slots, 73 represented project identities, six wings, two levels, octagonal Rotunda, SW/SE stairs, entrance, and the descending Dexter Sanctuary outside the ordinary exhibit count.
- Overlays show 14 historical primary-installation host positions and 17 **nominal authored routes**, not live visitors. Fifteen supplementary records are listed in room inspectors with host assignment only; no unverified case coordinates are asserted.
- Does not claim photorealistic accuracy, geometry/collision export parity, live runtime synchronization, visitor movement telemetry, or automatic museum source edits.
- The 2026-10-27 provenance is a snapshot. A newer museum commit must be source-compared before accepting the workbench as current.

## Using the workbench

Select rooms on the plan or in the collection index. Search by room, project or project ID; filter by wing; switch levels; pan and zoom; turn on legacy installation or authored visitor-route overlays. Use the ruler for straight-line distances, not walking-route lengths. Local annotations, per-room notes and proposed relocation handles are separate from source geometry. Export JSON to hand proposals to an implementer; SVG exports the visible floor. Import rejects plans explicitly pinned to a different source revision and asks before replacement. Reset and import are local-only, and reset requires confirmation.

## Publishing and recovery

The static file is copied by Vite to `/workbench/index.html`. GitHub Pages must serve it below `/museum-of-me-vnext/workbench/`. The map itself requires no network, scripts, fonts, or third-party assets. GitHub Pages publishing continues through the existing owner-directed `pages-preview` workflow, not automatic `main` promotion. The primary museum route must still load and pass its own gates.

### Verification contract

Run `npm run gate` and `npm run test:e2e`; the new `tests/browser/workbench.e2e.ts` tests real Chromium navigation to the published-style route, source counts, level switching, search, local persistence, overlays, map pan, ruler, pin and export interactions, undo, and import source pinning. The browser test does not prove representative physical-device performance or 3D rendering parity. Hosted verification should separately request the actual `/workbench/` path after Pages deployment.
