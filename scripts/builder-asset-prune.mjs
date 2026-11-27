// Ordinary public builds ship only the builder-catalog files that the authored
// placement manifest actually references (the offline package already embeds
// only those). The catalog's licence and notices always stay. Used by the
// `museum-builder-catalog-prune` plugin in vite.config.ts.
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** Catalog paths (e.g. builder-assets/openlife/x.png) referenced by the placement manifest. */
export function referencedBuilderPaths(manifest, catalog) {
  const used = new Set([
    ...(manifest.objects ?? []).flatMap((o) => [o.assetId, o.texture, o.image]),
    ...(manifest.surfaceOverrides ?? []).map((s) => s.texture),
  ].filter(Boolean));
  const paths = new Set();
  for (const item of [...(catalog.models ?? []), ...(catalog.textures ?? [])]) {
    if (used.has(item.id)) paths.add(item.path);
  }
  return paths;
}

/** Remove unreferenced catalog binaries (.png/.glb) from `outDir`; returns the removed relative paths. */
export async function pruneUnreferencedBuilderAssets(outDir, manifest, catalog) {
  const keep = referencedBuilderPaths(manifest, catalog);
  const removed = [];
  for (const dir of ['builder-assets/openlife']) {
    let names;
    try { names = await readdir(join(outDir, dir)); } catch { continue; }
    for (const name of names) {
      const rel = `${dir}/${name}`;
      if (!/\.(png|glb)$/i.test(name) || keep.has(rel)) continue;
      await rm(join(outDir, rel), { force: true });
      removed.push(rel);
    }
  }
  return removed.sort();
}
