import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import index from '../src/workshop/catalog-data/tge-index.json';

const models = new Map(index.models.map((model) => [model.id, model]));
const limit = 8 * 1024 * 1024;

/** Reject external references and required extensions that this import path has not verified. */
export function safeSourceGlb(bytes: Buffer, validate: (bytes: Buffer) => boolean): boolean {
  if (!validate(bytes)) return false;
  try {
    const length = bytes.readUInt32LE(12);
    const doc: unknown = JSON.parse(bytes.toString('utf8', 20, 20 + length));
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return false;
    const required = (doc as { extensionsRequired?: unknown }).extensionsRequired;
    if (required !== undefined && (!Array.isArray(required)
      || required.some((entry: unknown) => entry !== 'KHR_texture_transform'))) return false;
    const stack: unknown[] = [doc];
    while (stack.length) {
      const value = stack.pop();
      if (!value || typeof value !== 'object') continue;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'uri' && (typeof child !== 'string' || !child.startsWith('data:') || child.length > limit)) return false;
        if (child && typeof child === 'object') stack.push(child);
      }
    }
    let offset = 20 + length;
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) return false;
      const chunkLength = bytes.readUInt32LE(offset);
      if (chunkLength % 4 || bytes.readUInt32LE(offset + 4) !== 0x004e4942 || offset + 8 + chunkLength > bytes.length) return false;
      offset += 8 + chunkLength;
    }
    return offset === bytes.length;
  } catch { return false; }
}

/** Import a pinned source model into the existing content-addressed local model store. */
export async function importTgeModel(id: string, root: string, validate: (bytes: Buffer) => boolean,
  request: typeof fetch = fetch): Promise<{ assetId: string; sha256: string }> {
  const model = models.get(id);
  if (!model || model.bytes <= 0 || model.bytes > limit) throw new Error('Unknown or oversized source model');
  const url = `https://raw.githubusercontent.com/Hidencod/tge-assets/${index.sourceRevision}/${model.file}`;
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.body) throw new Error('Source model unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > model.bytes || size > limit) throw new Error('Source model exceeds expected size');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (size !== model.bytes || blob !== model.gitBlob || !safeSourceGlb(bytes, validate)) throw new Error('Source model failed integrity or GLB validation');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const directory = resolve(root, 'public/workshop-models');
  const provenanceDir = resolve(root, '.asset-sources/tge-provenance');
  await mkdir(directory, { recursive: true });
  await mkdir(provenanceDir, { recursive: true });
  const provenanceKey = createHash('sha256').update(id).digest('hex');
  const provenance = resolve(provenanceDir, `${sha256}-${provenanceKey}.json`);
  const record = JSON.stringify({ source: 'Hidencod/tge-assets', sourceRevision: index.sourceRevision,
    sourceId: model.id, sourcePath: model.file, gitBlob: model.gitBlob, sha256, bytes: size,
    author: model.author, license: model.license, sourcePage: model.sourcePage }, null, 2) + '\n';
  await writeFile(provenance, record, { flag: 'wx' }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST' || !(await lstat(provenance)).isFile() || await readFile(provenance, 'utf8') !== record) throw error;
  });
  const target = resolve(directory, `${sha256}.glb`);
  try {
    const stat = await lstat(target);
    if (!stat.isFile() || !(await readFile(target)).equals(bytes)) throw new Error('Existing local model differs from verified source');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, bytes, { flag: 'wx' });
      await link(temp, target).catch(async (e: NodeJS.ErrnoException) => {
        if (e.code !== 'EEXIST' || !(await lstat(target)).isFile() || !(await readFile(target)).equals(bytes)) throw e;
      });
    }
    finally { await unlink(temp).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; }); }
  }
  return { assetId: `workshop-models/${sha256}.glb`, sha256 };
}
