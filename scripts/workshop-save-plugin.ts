import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
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
export async function validateLocalWorkshopMedia(
  manifest: WorkshopPlacementManifest,
  manifestFile: string,
): Promise<readonly string[]> {
  const errors: string[] = [];
  const mediaRoot = resolve(dirname(manifestFile), '../public/workshop-media');
  const referenced = new Set(manifest.objects.map((record) => record.image).filter((value): value is string => Boolean(value)));
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
function isSameOriginRequest(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
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
}

/** Validate before opening the target and atomically replace it only on success. */
export async function writeWorkshopManifest(raw: unknown, target: string): Promise<WorkshopSaveResult> {
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
  const temp = `${target}.tmp-${process.pid}`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temp, serializeWorkshopManifest(parsed.value), 'utf8');
  await rename(temp, target);
  return { ok: true, status: 200, manifest: parsed.value };
}

export function museumWorkshopSavePlugin(): Plugin {
  return {
    name: 'museum-workshop-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
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

        try {
          const raw = JSON.parse(await readBody(req)) as unknown;
          const target = resolve(process.cwd(), 'data/workshop-placements.json');
          const result = await writeWorkshopManifest(raw, target);
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
