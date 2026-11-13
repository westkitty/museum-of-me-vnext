import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { museumWorkshopSavePlugin } from '../scripts/workshop-save-plugin';

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> | void;

function middleware(): Middleware {
  let handler: Middleware | null = null;
  const plugin = museumWorkshopSavePlugin();
  const server = { middlewares: { use: (fn: Middleware) => { handler = fn; } } };
  (plugin.configureServer as (s: unknown) => void)(server);
  if (!handler) throw new Error('plugin registered no middleware');
  return handler;
}

function request(url: string, method = 'GET') {
  const headers: Record<string, string> = {};
  const result: { status: number; body: Buffer; headers: Record<string, string>; nextCalled: boolean } = { status: 0, body: Buffer.alloc(0), headers, nextCalled: false };
  const req = { url, method, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
  const res = {
    set statusCode(value: number) { result.status = value; },
    setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
    end: (body?: Buffer) => { result.body = body ?? Buffer.alloc(0); },
  } as unknown as ServerResponse;
  return { req, res, result, next: () => { result.nextCalled = true; } };
}

describe('Workshop model serving in the dev server', () => {
  const written: string[] = [];
  afterEach(async () => { await Promise.all(written.splice(0).map((file) => rm(file, { force: true }))); });

  it('serves a model written a moment ago, without waiting for Vite\'s public-file watcher', async () => {
    const bytes = Buffer.from(`glb-${randomUUID()}`);
    const hash = createHash('sha256').update(bytes).digest('hex');
    const directory = resolve(process.cwd(), 'public/workshop-models');
    await mkdir(directory, { recursive: true });
    const file = resolve(directory, `${hash}.glb`);
    await writeFile(file, bytes);
    written.push(file);

    const { req, res, result, next } = request(`/workshop-models/${hash}.glb?v=1`);
    await middleware()(req, res, next);
    expect(result.nextCalled).toBe(false);
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toBe('model/gltf-binary');
    expect(result.body.equals(bytes)).toBe(true);
  });

  it('passes through missing models, non-hash names and non-GET requests', async () => {
    const handler = middleware();
    for (const [url, method] of [[`/workshop-models/${'0'.repeat(64)}.glb`, 'GET'],
      ['/workshop-models/../package.json', 'GET'], ['/workshop-models/model.glb', 'GET'],
      [`/workshop-models/${'a'.repeat(64)}.glb`, 'POST']] as const) {
      const { req, res, result, next } = request(url, method);
      await handler(req, res, next);
      expect(result.nextCalled, `${method} ${url}`).toBe(true);
    }
  });
});
