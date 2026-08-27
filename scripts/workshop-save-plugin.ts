import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { serializeWorkshopManifest, validateWorkshopManifest } from '../src/workshop/schema';

const ENDPOINT = '/__museum-workshop/save';
const MAX_BODY_BYTES = 256 * 1024;

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1'
    || address === '::1'
    || address === '::ffff:127.0.0.1';
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

function json(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function museumWorkshopSavePlugin(): Plugin {
  return {
    name: 'museum-workshop-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
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
        if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
          json(res, 415, { ok: false, error: 'application/json required' });
          return;
        }

        try {
          const raw = JSON.parse(await readBody(req)) as unknown;
          const parsed = validateWorkshopManifest(raw);
          if (!parsed.ok || !parsed.value) {
            json(res, 400, { ok: false, error: 'Invalid placement manifest.', details: parsed.errors });
            return;
          }

          const target = resolve(process.cwd(), 'data/workshop-placements.json');
          const temp = `${target}.tmp-${process.pid}`;
          await mkdir(dirname(target), { recursive: true });
          await writeFile(temp, serializeWorkshopManifest(parsed.value), 'utf8');
          await rename(temp, target);
          json(res, 200, {
            ok: true,
            path: 'data/workshop-placements.json',
            objects: parsed.value.objects.length,
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
