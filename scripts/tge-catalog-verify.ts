import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import index from '../src/workshop/catalog-data/tge-index.json';
import { ALLOWED_REQUIRED_EXTENSIONS, findCachedTgeModel, importTgeModel, safeSourceGlb } from './tge-model';
import { tgeThumbnail } from './tge-thumbnail';

type Model = (typeof index.models)[number];
export type ModelStatus = 'verified' | 'size-mismatch' | 'blob-mismatch' | 'unsupported-extension'
  | 'invalid-glb' | 'fetch-failed';
export interface ModelResult { status: ModelStatus; detail?: string; extensions?: string[] }
export interface CatalogReport {
  schemaVersion: 1;
  source: 'Hidencod/tge-assets';
  sourceRevision: string;
  catalogGitBlob: string;
  generatedBy: string;
  method: string;
  total: number;
  complete: boolean;
  counts: Record<ModelStatus | 'unchecked', number>;
  thumbnails: { verified: number; failed: number; unchecked: number; failedIds: string[] };
  /** Every importable ID, sorted. Anything not listed here is not importable. */
  verified: string[];
  /** Non-verified IDs with the reason, sorted by ID. */
  rejected: { id: string; status: Exclude<ModelStatus, 'verified'>; detail?: string; extensions?: string[] }[];
  unchecked: string[];
}

const ALLOWED_REQUIRED = new Set(ALLOWED_REQUIRED_EXTENSIONS);
const LIMIT = 8 * 1024 * 1024;

/** Required glTF extensions this import path has not verified; [] when none. */
export function unsupportedRequiredExtensions(bytes: Buffer): string[] | null {
  try {
    if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) return null;
    const length = bytes.readUInt32LE(12);
    if (20 + length > bytes.length) return null;
    const doc = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as { extensionsRequired?: unknown };
    if (doc.extensionsRequired === undefined) return [];
    if (!Array.isArray(doc.extensionsRequired)) return null;
    return doc.extensionsRequired.map(String).filter((name) => !ALLOWED_REQUIRED.has(name)).sort();
  } catch { return null; }
}

/** Classify downloaded bytes with the same identity and GLB checks the import endpoint applies. */
export function classifySourceGlb(model: Pick<Model, 'bytes' | 'gitBlob'>, bytes: Buffer,
  validate: (bytes: Buffer) => boolean): ModelResult {
  if (bytes.length !== model.bytes) return { status: 'size-mismatch', detail: `expected ${model.bytes} bytes, received ${bytes.length}` };
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (blob !== model.gitBlob) return { status: 'blob-mismatch', detail: `received Git blob ${blob}` };
  const unsupported = unsupportedRequiredExtensions(bytes);
  if (unsupported?.length) return { status: 'unsupported-extension', extensions: unsupported,
    detail: `requires unsupported glTF extension ${unsupported.join(', ')}` };
  if (!safeSourceGlb(bytes, validate)) return { status: 'invalid-glb', detail: 'failed GLB structure or self-contained reference validation' };
  return { status: 'verified' };
}

async function fetchBytes(url: string, request: typeof fetch, retries: number): Promise<Buffer> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (response.status === 404) throw Object.assign(new Error('HTTP 404'), { permanent: true });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > LIMIT) throw Object.assign(new Error('exceeds 8 MB import limit'), { permanent: true });
      return bytes;
    } catch (error) {
      last = error;
      if ((error as { permanent?: boolean }).permanent) break;
      if (attempt < retries) await new Promise((done) => setTimeout(done, 1000 * 2 ** attempt));
    }
  }
  throw last instanceof Error ? last : new Error('fetch failed');
}

async function retry<T>(work: () => Promise<T>, retries: number): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await work(); } catch (error) {
      last = error;
      if (attempt < retries) await new Promise((done) => setTimeout(done, 1000 * 2 ** attempt));
    }
  }
  throw last;
}

export interface VerifyOptions {
  root: string;
  validate: (bytes: Buffer) => boolean;
  request?: typeof fetch;
  concurrency?: number;
  retries?: number;
  ids?: readonly string[];
  thumbnails?: boolean;
  onProgress?: (done: number, total: number, id: string, result: ModelResult) => void;
}

/**
 * Verify pinned source models. Verified bytes go into the existing Git-ignored
 * content-addressed store via importTgeModel (with provenance); bytes that fail
 * are kept under .asset-sources/tge-unimportable so a rerun reclassifies them
 * offline. Fetch failures are always retried on the next run.
 */
export async function verifyTgeCatalog(options: VerifyOptions): Promise<CatalogReport> {
  const request = options.request ?? fetch;
  const retries = options.retries ?? 3;
  const wanted = options.ids ? new Set(options.ids) : null;
  const models = index.models.filter((model) => !wanted || wanted.has(model.id));
  const rejectDir = resolve(options.root, '.asset-sources/tge-unimportable');
  const results = new Map<string, ModelResult>();
  const thumbs = new Map<string, boolean>();
  let cursor = 0;
  let finished = 0;

  async function verifyModel(model: Model): Promise<ModelResult> {
    if (await findCachedTgeModel(model.id, options.root, options.validate)) return { status: 'verified' };
    const keep = resolve(rejectDir, `${createHash('sha256').update(model.id).digest('hex')}.glb`);
    let bytes: Buffer | null = null;
    try { bytes = await readFile(keep); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!bytes) {
      const url = `https://raw.githubusercontent.com/Hidencod/tge-assets/${index.sourceRevision}/${model.file}`;
      try { bytes = await fetchBytes(url, request, retries); } catch (error) {
        return { status: 'fetch-failed', detail: error instanceof Error ? error.message : 'fetch failed' };
      }
    }
    const result = classifySourceGlb(model, bytes, options.validate);
    if (result.status === 'verified') {
      const exact = bytes;
      await importTgeModel(model.id, options.root, options.validate,
        (async () => new Response(new Uint8Array(exact))) as typeof fetch);
    } else {
      await mkdir(rejectDir, { recursive: true });
      const temp = `${keep}.${process.pid}.tmp`;
      await writeFile(temp, bytes);
      await rename(temp, keep);
    }
    return result;
  }

  async function worker(): Promise<void> {
    while (cursor < models.length) {
      const model = models[cursor++]!;
      const result = await verifyModel(model);
      results.set(model.id, result);
      if (options.thumbnails !== false) {
        thumbs.set(model.id, await retry(() => tgeThumbnail(model.id, options.root, request), retries)
          .then(() => true, () => false));
      }
      options.onProgress?.(++finished, models.length, model.id, result);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 4, 8)) }, worker));
  return buildReport(results, thumbs);
}

export function buildReport(results: ReadonlyMap<string, ModelResult>, thumbs: ReadonlyMap<string, boolean>): CatalogReport {
  const counts: CatalogReport['counts'] = { verified: 0, 'size-mismatch': 0, 'blob-mismatch': 0,
    'unsupported-extension': 0, 'invalid-glb': 0, 'fetch-failed': 0, unchecked: 0 };
  const verified: string[] = [];
  const rejected: CatalogReport['rejected'] = [];
  const unchecked: string[] = [];
  for (const model of index.models) {
    const result = results.get(model.id);
    if (!result) { counts.unchecked++; unchecked.push(model.id); continue; }
    counts[result.status]++;
    if (result.status === 'verified') verified.push(model.id);
    else rejected.push({ id: model.id, status: result.status, ...(result.detail ? { detail: result.detail } : {}),
      ...(result.extensions ? { extensions: result.extensions } : {}) });
  }
  const failedIds = index.models.filter((model) => thumbs.get(model.id) === false).map((model) => model.id).sort();
  return {
    schemaVersion: 1,
    source: 'Hidencod/tge-assets',
    sourceRevision: index.sourceRevision,
    catalogGitBlob: index.catalogGitBlob,
    generatedBy: 'scripts/verify-tge-catalog.ts',
    method: 'Each GLB and thumbnail fetched from raw.githubusercontent.com at the pinned revision; exact byte size and Git blob SHA-1 compared with tge-index.json; GLBs checked with safeSourceGlb(hasValidLocalGLB), the import endpoint validation (structure, self-contained URIs, required-extension allowlist). Not a render or artistic review.',
    total: index.models.length,
    complete: counts.unchecked === 0 && counts['fetch-failed'] === 0,
    counts,
    thumbnails: { verified: [...thumbs.values()].filter(Boolean).length, failed: failedIds.length,
      unchecked: index.models.length - thumbs.size, failedIds },
    verified: verified.sort(),
    rejected: rejected.sort((a, b) => a.id.localeCompare(b.id)),
    unchecked: unchecked.sort(),
  };
}
