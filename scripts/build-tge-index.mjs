// Offline generator: pass the pinned GitHub tree, catalog and original ledger files.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const revision = '3ddcc695adbba9fb918cf31b7c139b3f95b76910';
const [treePath, catalogPath, ledgerPath, outputPath] = process.argv.slice(2);
if (!treePath || !catalogPath || !ledgerPath || !outputPath) {
  throw new Error('Usage: node scripts/build-tge-index.mjs <tree.json> <catalog.json> <ledger.json> <output.json>');
}
const [treeBytes, catalogBytes, ledgerBytes] = await Promise.all([treePath, catalogPath, ledgerPath].map((p) => readFile(p)));
const tree = JSON.parse(treeBytes);
const catalog = JSON.parse(catalogBytes);
const ledger = JSON.parse(ledgerBytes);
const blob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
if (tree.sha !== revision || tree.truncated || !Array.isArray(tree.tree)) throw new Error('Wrong or truncated source tree');
const paths = new Map(tree.tree.filter((entry) => entry.type === 'blob').map((entry) => [entry.path, entry]));
if (blob(catalogBytes) !== paths.get('catalog.json')?.sha) throw new Error('Catalog bytes do not match pinned tree');
if (blob(ledgerBytes) !== 'd3a464f11c9acf58fcca5b0219af0881730753db') throw new Error('Candidate ledger differs from original');
if (catalog.packs.length !== 19 || ledger.candidates.length !== 200) throw new Error('Unexpected source counts');
const featured = new Map(ledger.candidates.map((item) => [item.id, item]));
if (featured.size !== 200) throw new Error('Duplicate featured candidate');
const ids = new Set();
const models = [];
for (const pack of catalog.packs) {
  if (pack.license !== 'CC0-1.0') throw new Error(`Unverified license: ${pack.id}`);
  for (const model of pack.models) {
    if (ids.has(model.id)) throw new Error(`Duplicate model: ${model.id}`);
    ids.add(model.id);
    const file = paths.get(model.file), thumbnail = paths.get(model.thumb), candidate = featured.get(model.id);
    if (!file || !thumbnail || file.size !== model.size) throw new Error(`Missing or mismatched source: ${model.id}`);
    if (candidate && (candidate.file_path !== model.file || candidate.file_size_bytes_catalog_tree_matched !== file.size)) {
      throw new Error(`Featured mismatch: ${model.id}`);
    }
    models.push({ id: model.id, name: model.name, pack: pack.id, packName: pack.name,
      author: pack.author, sourcePage: pack.url, license: pack.license,
      file: model.file, bytes: file.size, gitBlob: file.sha,
      thumbnail: model.thumb, thumbnailBytes: thumbnail.size, thumbnailGitBlob: thumbnail.sha,
      ...(candidate ? { featured: { index: candidate.index, target: candidate.target,
        targetTitle: candidate.target_title, wing: candidate.wing, role: candidate.proposed_role } } : {}),
    });
  }
}
if (models.length !== 1883 || [...featured.keys()].some((id) => !ids.has(id))) throw new Error('Incomplete model set');
models.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
await writeFile(outputPath, JSON.stringify({ schemaVersion: 1, sourceRevision: revision,
  catalogGitBlob: blob(catalogBytes), candidateLedgerGitBlob: blob(ledgerBytes), models }, null, 2) + '\n');
console.log(`Verified ${models.length} catalog entries, ${featured.size} featured candidates and matching thumbnail tree entries.`);
