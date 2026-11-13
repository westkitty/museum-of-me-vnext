import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import index from '../src/workshop/catalog-data/tge-index.json';

const models = new Map(index.models.map((model) => [model.id, model]));
const revision = index.sourceRevision;
const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;

function valid(bytes: Buffer, size: number, sha: string): boolean {
  return bytes.length === size && bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8
    && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))
    && createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') === sha;
}

/** Fetch only pinned, indexed thumbnails; validate on both cache read and download. */
export async function tgeThumbnail(id: string, root: string, request: typeof fetch = fetch): Promise<Buffer> {
  const model = models.get(id);
  if (!model || model.thumbnailBytes <= 0 || model.thumbnailBytes > MAX_THUMBNAIL_BYTES) throw new Error('Unknown thumbnail');
  const dir = resolve(root, '.asset-sources/tge-thumbnails');
  const path = resolve(dir, `${model.thumbnailGitBlob}.webp`);
  try {
    const bytes = await readFile(path);
    if (valid(bytes, model.thumbnailBytes, model.thumbnailGitBlob)) return bytes;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const url = `https://raw.githubusercontent.com/Hidencod/tge-assets/${revision}/${model.thumbnail}`;
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.body) throw new Error('Thumbnail source unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > model.thumbnailBytes || size > MAX_THUMBNAIL_BYTES) throw new Error('Thumbnail exceeds expected size');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  if (!valid(bytes, model.thumbnailBytes, model.thumbnailGitBlob)) throw new Error('Thumbnail integrity check failed');
  await mkdir(dir, { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, { flag: 'wx' });
    await rename(temp, path);
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
  }
  return bytes;
}
