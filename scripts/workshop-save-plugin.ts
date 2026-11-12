import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { tgeThumbnail } from './tge-thumbnail';
import { findCachedTgeModel, importTgeModel } from './tge-model';
import {
  conservationErrors,
  validateWorkshopConservation,
  type WorkshopConservationViolation,
} from '../src/workshop/conservation';
import {
  serializeWorkshopManifest,
  validateWorkshopManifest,
  type WorkshopPlacementManifest,
} from '../src/workshop/schema';

const ENDPOINT = '/__museum-workshop/save';
const MEDIA_ENDPOINT = '/__museum-workshop/media';
const MODEL_ENDPOINT = '/__museum-workshop/model';
const THUMBNAIL_ENDPOINT = '/__museum-workshop/tge-thumbnail';
const SOURCE_IMPORT_ENDPOINT = '/__museum-workshop/tge-import';
const SOURCE_STATUS_ENDPOINT = '/__museum-workshop/tge-status';
const MAX_MODEL_BYTES = 8 * 1024 * 1024;
const MAX_MEDIA_BYTES = 3 * 1024 * 1024;

/** Shallow container check, not an image decoder. Refuse obvious malformed uploads. */
export function hasValidWebPContainer(bytes: Buffer): boolean {
  if (bytes.length < 20 || bytes.length > MAX_MEDIA_BYTES) return false;
  if (bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
    || bytes.readUInt32LE(4) !== bytes.length - 8) return false;
  const encoding = bytes.toString('ascii', 12, 16);
  return encoding === 'VP8 ' || encoding === 'VP8L' || encoding === 'VP8X';
}

/**
 * A manifest must not successfully save a missing, replaced or corrupted image.
 * Root is fixed to the project-relative public/ tree; user data only supplies
 * a validated hash basename, never arbitrary filesystem paths.
 */
export function hasValidLocalGLB(bytes: Buffer): boolean {
  if (bytes.length < 32 || bytes.length > MAX_MODEL_BYTES) return false;
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length) return false;
  const jsonLength = bytes.readUInt32LE(12);
  if (jsonLength < 12 || jsonLength > bytes.length - 20
    || bytes.toString('ascii', 16, 20) !== 'JSON') return false;
  try {
    const doc = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) as {
      asset?: { version?: string };
      buffers?: { uri?: unknown }[];
      images?: { uri?: unknown }[];
    };
    if (doc.asset?.version !== '2.0') return false;
    // GLBs must be self-contained. No HTTP, file, path or external image fetch.
    const refs = [...(doc.buffers ?? []), ...(doc.images ?? [])];
    return refs.every((entry) => entry.uri === undefined
      || (typeof entry.uri === 'string' && entry.uri.startsWith('data:')
        && entry.uri.length <= MAX_MODEL_BYTES));
  } catch {
    return false;
  }
}

export async function validateLocalWorkshopModels(
  manifest: WorkshopPlacementManifest,
  manifestFile: string,
): Promise<readonly string[]> {
  const errors: string[] = [];
  const directory = resolve(dirname(manifestFile), '../public/workshop-models');
  const paths = new Set(manifest.objects
    .map((object) => object.assetId)
    .filter((id): id is string => Boolean(id?.startsWith('workshop-models/'))));
  for (const path of paths) {
    const hash = path.slice('workshop-models/'.length, -'.glb'.length);
    try {
      const file = resolve(directory, hash + '.glb');
      const stat = await lstat(file);
      if (!stat.isFile() || stat.size > MAX_MODEL_BYTES) throw new Error('invalid model file');
      const bytes = await readFile(file);
      if (!hasValidLocalGLB(bytes) || createHash('sha256').update(bytes).digest('hex') !== hash) {
        throw new Error('invalid GLB hash');
      }
    } catch {
      errors.push('Imported model ' + path + ' is missing, invalid or has been changed');
    }
  }
  return errors;
}

export async function validateLocalWorkshopMedia(
  manifest: WorkshopPlacementManifest,
  manifestFile: string,
): Promise<readonly string[]> {
  const errors: string[] = [];
  const mediaRoot = resolve(dirname(manifestFile), '../public/workshop-media');
  const referenced = new Set([
    ...manifest.objects.map((record) => record.image),
    ...manifest.objects.map((record) => record.texture?.startsWith('workshop-media/') ? record.texture : undefined),
    ...(manifest.surfaceOverrides ?? []).map((record) =>
      record.texture?.startsWith('workshop-media/') ? record.texture : undefined),
  ].filter((value): value is string => Boolean(value)));
  for (const image of referenced) {
    const hash = image.slice('workshop-media/'.length, -'.webp'.length);
    const file = resolve(mediaRoot, `${hash}.webp`);
    try {
      const stat = await lstat(file);
      if (!stat.isFile() || stat.size > MAX_MEDIA_BYTES) throw new Error('not a bounded regular file');
      const bytes = await readFile(file);
      if (!hasValidWebPContainer(bytes) || createHash('sha256').update(bytes).digest('hex') !== hash) {
        throw new Error('content hash or image container mismatch');
      }
    } catch {
      errors.push(`Authored image ${image} is missing, invalid or has been replaced`);
    }
  }
  return errors;
}
const MAX_BODY_BYTES = 256 * 1024;

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1';
}

/**
 * Refuse browser-originated cross-site writes even though the socket itself is
 * local. This prevents an unrelated web page from treating a running Vite dev
 * server as a write primitive. Non-browser tools without Origin remain subject
 * to the loopback, method, content-type, schema, size, and fixed-path gates.
 */
/**
 * Even when the peer address is loopback, reject arbitrary Host headers.
 * DNS rebinding can otherwise make an attacker's origin equal the Host header
 * while its DNS record points to a local development server.
 */
export function isLocalWorkshopHost(host: string | undefined): boolean {
  return typeof host === 'string'
    && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/i.test(host);
}

function isSameOriginRequest(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (!isLocalWorkshopHost(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && parsed.host.toLowerCase() === host!.toLowerCase();
  } catch {
    return false;
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  return await new Promise((resolveBody, reject) => {
    let bytes = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('request body exceeds Workshop save limit'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolveBody(body));
    req.on('error', reject);
  });
}

async function readModel(req: IncomingMessage): Promise<Buffer> {
  return await new Promise<Buffer>((done, fail) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_MODEL_BYTES) {
        fail(new Error('Model import limit is 8 MB'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => done(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

async function readMedia(req: IncomingMessage): Promise<Buffer> {
  return await new Promise<Buffer>((resolveBody, reject) => {
    let bytes = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_MEDIA_BYTES) {
        reject(new Error('Artwork is larger than the 3 MB editor limit'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export interface WorkshopSaveResult {
  readonly ok: boolean;
  readonly status: number;
  readonly manifest?: WorkshopPlacementManifest;
  readonly errors?: readonly string[];
  readonly violations?: readonly WorkshopConservationViolation[];
  readonly revision?: string;
}

/** Preserve the exact previous bytes outside the public tree before replacement. */
async function backupWorkshopManifest(target: string): Promise<void> {
  let previous: Buffer;
  try {
    previous = await readFile(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  const directory = resolve(dirname(target), '.workshop-backups');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (!(await lstat(directory)).isDirectory()) throw new Error('Workshop backup path is not a directory');
  const digest = createHash('sha256').update(previous).digest('hex');
  const backup = resolve(directory, `${digest}.json`);
  try {
    await writeFile(backup, previous, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const stat = await lstat(backup);
    if (!stat.isFile() || !(await readFile(backup)).equals(previous)) {
      throw new Error('Existing Workshop backup does not match the original manifest');
    }
  }
}

const pendingSaves = new Map<string, Promise<void>>();

/** Serialize same-target saves so each successful replacement has a backup. */
export async function writeWorkshopManifest(raw: unknown, target: string, expectedRevision?: string): Promise<WorkshopSaveResult> {
  const key = resolve(target);
  const previous = pendingSaves.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolveSave) => { release = resolveSave; });
  pendingSaves.set(key, current);
  await previous;
  try {
    return await writeWorkshopManifestLocked(raw, key, expectedRevision);
  } finally {
    if (pendingSaves.get(key) === current) pendingSaves.delete(key);
    release();
  }
}

/** Validate, preserve the old bytes, then atomically replace the target. */
async function writeWorkshopManifestLocked(raw: unknown, target: string, expectedRevision?: string): Promise<WorkshopSaveResult> {
  const parsed = validateWorkshopManifest(raw);
  if (!parsed.ok || !parsed.value) {
    return { ok: false, status: 400, errors: parsed.errors };
  }
  const conservation = validateWorkshopConservation(parsed.value);
  if (!conservation.ok) {
    return {
      ok: false,
      status: 400,
      errors: conservationErrors(conservation.violations),
      violations: conservation.violations,
    };
  }
  const mediaErrors = await validateLocalWorkshopMedia(parsed.value, target);
  if (mediaErrors.length) return { ok: false, status: 400, errors: mediaErrors };
  const modelErrors = await validateLocalWorkshopModels(parsed.value, target);
  if (modelErrors.length) return { ok: false, status: 400, errors: modelErrors };
  // A newer or damaged on-disk file cannot be reconstructed from the editor's
  // older view. Never overwrite it merely because the incoming payload is valid.
  let current: Buffer | undefined;
  try {
    current = await readFile(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (current !== undefined) {
    let existing: unknown;
    try {
      existing = JSON.parse(current.toString('utf8')) as unknown;
    } catch {
      return { ok: false, status: 409, errors: ['Existing Workshop manifest is corrupt; save refused to preserve its bytes'] };
    }
    const checked = validateWorkshopManifest(existing);
    if (!checked.ok) {
      return { ok: false, status: 409, errors: ['Existing Workshop manifest is unsupported or invalid; save refused', ...checked.errors] };
    }
    if (expectedRevision !== undefined && checked.value) {
      const revision = createHash('sha256').update(current).digest('hex');
      if (revision !== expectedRevision) {
        return { ok: false, status: 409, errors: ['The Workshop manifest changed since this editor loaded or last saved. Preserve your work and reload before saving.'] };
      }
    }
  } else if (expectedRevision !== undefined) {
    return { ok: false, status: 409, errors: ['The Workshop manifest was removed since this editor loaded; save refused'] };
  }
  const temp = `${target}.tmp-${randomUUID()}`;
  await mkdir(dirname(target), { recursive: true });
  await backupWorkshopManifest(target);
  const serialized = serializeWorkshopManifest(parsed.value);
  try {
    await writeFile(temp, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temp, target);
  } finally {
    await unlink(temp).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  return { ok: true, status: 200, manifest: parsed.value,
    revision: createHash('sha256').update(serialized).digest('hex') };
}

export function museumWorkshopSavePlugin(): Plugin {
  return {
    name: 'museum-workshop-save',
    apply: 'serve',
    async transformIndexHtml() {
      const source = await readFile(resolve(process.cwd(), 'data/workshop-placements.json'));
      return [{ tag: 'script', attrs: { id: 'museum-workshop-source', type: 'application/json',
        'data-sha256': createHash('sha256').update(source).digest('hex') },
      children: source.toString('base64'), injectTo: 'head' }];
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (url === SOURCE_STATUS_ENDPOINT) {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET required' });
          if (!isLoopback(req.socket.remoteAddress) || !isSameOriginRequest(req)) {
            return json(res, 403, { ok: false, error: 'Local, same-origin authoring only' });
          }
          const id = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
          try {
            const cached = await findCachedTgeModel(id, process.cwd(), hasValidLocalGLB);
            json(res, 200, { ok: true, installed: Boolean(cached) });
          } catch {
            json(res, 400, { ok: false, error: 'Unable to inspect source candidate.' });
          }
          return;
        }
        if (url === SOURCE_IMPORT_ENDPOINT) {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST required' });
          if (!isLoopback(req.socket.remoteAddress) || !isSameOriginRequest(req)) {
            return json(res, 403, { ok: false, error: 'Local, same-origin authoring only' });
          }
          if (req.headers['content-type'] !== 'application/json') return json(res, 415, { ok: false, error: 'JSON required' });
          try {
            const value: unknown = JSON.parse(await readBody(req));
            if (!value || typeof value !== 'object' || Array.isArray(value)
              || Object.keys(value).length !== 1 || typeof (value as { id?: unknown }).id !== 'string') {
              return json(res, 400, { ok: false, error: 'A single source ID is required' });
            }
            const imported = await importTgeModel((value as { id: string }).id, process.cwd(), hasValidLocalGLB);
            json(res, 200, { ok: true, ...imported });
          } catch (error) {
            if (!req.destroyed) json(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Source import failed' });
          }
          return;
        }
        if (url === THUMBNAIL_ENDPOINT) {
          if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET required' });
          if (!isLoopback(req.socket.remoteAddress) || !isSameOriginRequest(req)) {
            return json(res, 403, { ok: false, error: 'Local, same-origin authoring only' });
          }
          const id = new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '';
          try {
            const bytes = await tgeThumbnail(id, process.cwd());
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'private, max-age=86400');
            res.end(bytes);
          } catch {
            json(res, 404, { ok: false, error: 'Thumbnail unavailable or failed integrity verification.' });
          }
          return;
        }
        if (url === MODEL_ENDPOINT) {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST required' });
          if (!isLoopback(req.socket.remoteAddress) || !isSameOriginRequest(req)) {
            return json(res, 403, { ok: false, error: 'Local, same-origin authoring only' });
          }
          if (req.headers['content-type'] !== 'model/gltf-binary'
            && req.headers['content-type'] !== 'application/octet-stream') {
            return json(res, 415, { ok: false, error: 'GLB model required' });
          }
          try {
            const bytes = await readModel(req);
            if (!hasValidLocalGLB(bytes)) return json(res, 400, { ok: false, error: 'Invalid or externally-linked GLB' });
            const hash = createHash('sha256').update(bytes).digest('hex');
            const directory = resolve(process.cwd(), 'public/workshop-models');
            await mkdir(directory, { recursive: true });
            const target = resolve(directory, hash + '.glb');
            const temp = target + '.tmp-' + process.pid;
            await writeFile(temp, bytes);
            await rename(temp, target);
            return json(res, 200, { ok: true, assetId: 'workshop-models/' + hash + '.glb',
              note: 'Imported only to local public/; verify rights before publishing' });
          } catch (error) {
            if (!req.destroyed) json(res, 400, { ok: false,
              error: error instanceof Error ? error.message : 'Import failed' });
            return;
          }
        }
        if (url === MEDIA_ENDPOINT) {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST required' });
          if (!isLoopback(req.socket.remoteAddress) || !isSameOriginRequest(req)) {
            return json(res, 403, { ok: false, error: 'Local, same-origin authoring only' });
          }
          if (req.headers['content-type'] !== 'image/webp') {
            return json(res, 415, { ok: false, error: 'WebP image required' });
          }
          try {
            const bytes = await readMedia(req);
            if (!hasValidWebPContainer(bytes)) {
              return json(res, 400, { ok: false, error: 'Invalid WebP image header' });
            }
            const hash = createHash('sha256').update(bytes).digest('hex');
            const directory = resolve(process.cwd(), 'public/workshop-media');
            const filename = `${hash}.webp`;
            await mkdir(directory, { recursive: true });
            const target = resolve(directory, filename);
            const temp = `${target}.tmp-${process.pid}`;
            await writeFile(temp, bytes);
            await rename(temp, target);
            return json(res, 200, {
              ok: true, image: `workshop-media/${filename}`,
              note: 'Local public asset. Review before committing or publishing.',
            });
          } catch (error) {
            if (!req.destroyed) json(res, 400, {
              ok: false, error: error instanceof Error ? error.message : 'Artwork import failed',
            });
            return;
          }
        }
        if (url !== ENDPOINT) {
          next();
          return;
        }
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'POST required' });
          return;
        }
        if (!isLoopback(req.socket.remoteAddress)) {
          json(res, 403, { ok: false, error: 'Workshop writes are allowed only from localhost.' });
          return;
        }
        if (!isSameOriginRequest(req)) {
          json(res, 403, { ok: false, error: 'Workshop browser writes must be same-origin.' });
          return;
        }
        if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          json(res, 415, { ok: false, error: 'application/json required' });
          return;
        }
        const expectedRevision = req.headers['x-workshop-revision'];
        if (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision)) {
          json(res, 428, { ok: false, error: 'Workshop save requires the revision loaded by the editor.' });
          return;
        }

        try {
          const raw = JSON.parse(await readBody(req)) as unknown;
          const target = resolve(process.cwd(), 'data/workshop-placements.json');
          const result = await writeWorkshopManifest(raw, target, expectedRevision);
          if (!result.ok || !result.manifest) {
            json(res, result.status, {
              ok: false,
              error: 'Invalid placement manifest.',
              details: result.errors ?? [],
              violations: result.violations ?? [],
            });
            return;
          }

          json(res, 200, {
            ok: true,
            path: 'data/workshop-placements.json',
            objects: result.manifest.objects.length,
            revision: result.revision,
          });
        } catch (error) {
          json(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : 'Workshop save failed.',
          });
        }
      });
    },
  };
}
