/**
 * Verify every pinned TGE catalog model and thumbnail and write the committed report.
 *   ./node_modules/.bin/vite-node scripts/verify-tge-catalog.ts [--concurrency 4] [--no-thumbnails]
 * Bytes stay in Git-ignored local caches (public/workshop-models, .asset-sources/).
 * Resumable: cached verified models and kept rejected bytes are reclassified without network.
 * --offline refuses all network access (proves the local cache alone reproduces the report).
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyTgeCatalog } from './tge-catalog-verify';
import { hasValidLocalGLB } from './workshop-save-plugin';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const root = process.cwd();
const started = Date.now();
const report = await verifyTgeCatalog({
  root,
  validate: hasValidLocalGLB,
  ...(args.includes('--offline') ? { request: (async () => { throw new Error('offline'); }) as typeof fetch, retries: 0 } : {}),
  concurrency: Number(flag('--concurrency') ?? 4),
  thumbnails: !args.includes('--no-thumbnails'),
  onProgress: (done, total, id, result) => {
    if (result.status !== 'verified' || done % 100 === 0 || done === total) {
      console.log(`${done}/${total} ${id} ${result.status}${result.detail ? ` (${result.detail})` : ''}`);
    }
  },
});
const target = resolve(root, 'src/workshop/catalog-data/tge-verification.json');
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ counts: report.counts, thumbnails: { ...report.thumbnails, failedIds: undefined },
  complete: report.complete, seconds: Math.round((Date.now() - started) / 1000) }));
