import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { parseProgramme, parseYouTubeEntry } from '../src/cinema/programme';
import { isLocalWorkshopHost } from './workshop-save-plugin';

/**
 * Development-only promotion of curator drafts into the version-controlled
 * cinema programme (data/cinema/programme.json). Same boundary as the Museum
 * Workshop save route: served only by `vite` (never built), loopback and
 * same-origin only, JSON only, bounded body, one fixed target file. Each draft
 * is re-validated and checked against YouTube's public oEmbed endpoint (no API
 * key) for its real title, channel and whether it can be embedded.
 * Publishing still means committing the file.
 */
export const CINEMA_PROGRAMME_ENDPOINT = '/__museum-cinema/programme';
const TARGET = 'data/cinema/programme.json';
const MAX_BODY_BYTES = 256 * 1024;

export interface OembedResult {
  readonly status: 'ok' | 'not-embeddable' | 'not-found' | 'unreachable';
  readonly title?: string;
  readonly authorName?: string;
  readonly authorUrl?: string;
}

export async function fetchOembed(canonicalUrl: string, fetcher: typeof fetch = fetch): Promise<OembedResult> {
  try {
    const response = await fetcher(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 401 || response.status === 403) return { status: 'not-embeddable' };
    if (response.status === 404 || response.status === 400) return { status: 'not-found' };
    if (!response.ok) return { status: 'unreachable' };
    const body = await response.json() as { title?: unknown; author_name?: unknown; author_url?: unknown };
    return {
      status: 'ok',
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : undefined,
      authorName: typeof body.author_name === 'string' ? body.author_name.slice(0, 120) : undefined,
      authorUrl: typeof body.author_url === 'string' ? body.author_url : undefined,
    };
  } catch {
    return { status: 'unreachable' };
  }
}

/** Merge validated drafts into the programme file's data. Pure apart from the oEmbed lookup. */
export async function promoteDrafts(
  current: { films?: unknown[] } & Record<string, unknown>,
  drafts: unknown,
  lookup: (canonicalUrl: string) => Promise<OembedResult>,
  today = new Date().toISOString().slice(0, 10),
): Promise<{ ok: true; programme: Record<string, unknown>; added: string[] } | { ok: false; errors: string[] }> {
  if (!Array.isArray(drafts) || drafts.length === 0) return { ok: false, errors: ['No drafts to promote.'] };
  const before = parseProgramme(current);
  if (before.rejected.length) return { ok: false, errors: before.rejected.map((r) => `published ${r.id}: ${r.reason}`) };
  const known = new Set(before.films.flatMap((f) => (f.kind === 'youtube' ? [f.youtube.videoId] : [])));
  const ids = new Set(before.films.map((f) => f.id));
  const errors: string[] = [];
  const added: Record<string, unknown>[] = [];
  for (const raw of drafts as Record<string, unknown>[]) {
    const check = raw?.source === 'youtube' ? parseYouTubeEntry(raw, true) : { reason: 'only YouTube drafts can be promoted' };
    if ('reason' in check) { errors.push(`${String(raw?.id ?? '(unnamed)')}: ${check.reason}`); continue; }
    const film = check.film;
    if (known.has(film.youtube.videoId) || ids.has(film.id)) { errors.push(`${film.id}: already in the programme`); continue; }
    known.add(film.youtube.videoId);
    ids.add(film.id);
    const meta = await lookup(film.youtube.canonicalUrl);
    const curatorTitle = film.youtube.titleSource === 'curator';
    const author = meta.status === 'ok' && meta.authorName && meta.authorUrl && /^https:\/\/www\.youtube\.com\/@[A-Za-z0-9._-]{1,100}$/.test(meta.authorUrl)
      ? { name: meta.authorName, url: meta.authorUrl } : null;
    const availability = meta.status === 'ok' ? 'unverified' : meta.status === 'unreachable' ? 'unverified' : 'unavailable';
    const note = meta.status === 'ok' ? `Title and channel read from YouTube oEmbed on ${today}; embedded playback not yet verified.`
      : meta.status === 'not-embeddable' ? `YouTube oEmbed on ${today}: the uploader does not allow embedding. "Watch on YouTube" is offered instead.`
        : meta.status === 'not-found' ? `YouTube oEmbed on ${today}: not found (removed, private, or a wrong link).`
          : `YouTube could not be reached on ${today}; not verified.`;
    added.push({
      id: film.id,
      source: 'youtube',
      title: !curatorTitle && meta.title ? meta.title : film.title,
      projectId: film.projectId,
      exhibitId: film.exhibitId,
      description: film.description,
      context: film.context,
      youtube: {
        videoId: film.youtube.videoId,
        submittedUrl: film.youtube.submittedUrl,
        titleSource: !curatorTitle && meta.title ? 'youtube-oembed' : film.youtube.titleSource,
        author,
        durationSeconds: null,
        durationSource: null,
        availability,
        availabilityNote: note,
        verifiedAt: meta.status === 'unreachable' ? null : today,
      },
    });
  }
  if (errors.length) return { ok: false, errors };
  const programme = { ...current, films: [...(current.films ?? []), ...added] };
  const after = parseProgramme(programme);
  if (after.rejected.length) return { ok: false, errors: after.rejected.map((r) => `${r.id}: ${r.reason}`) };
  return { ok: true, programme, added: added.map((a) => String(a.id)) };
}

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isSameOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host;
  if (!isLocalWorkshopHost(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host.toLowerCase() === host!.toLowerCase();
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
      if (bytes > MAX_BODY_BYTES) { reject(new Error('request too large')); req.destroy(); return; }
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

export function museumCinemaProgrammePlugin(): Plugin {
  return {
    name: 'museum-cinema-programme',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== CINEMA_PROGRAMME_ENDPOINT) return next();
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST required' });
        if (!isLoopback(req.socket.remoteAddress) || !isSameOrigin(req)) return json(res, 403, { ok: false, error: 'Local, same-origin curation only' });
        if (req.headers['content-type'] !== 'application/json') return json(res, 415, { ok: false, error: 'JSON required' });
        try {
          const body = JSON.parse(await readBody(req)) as { drafts?: unknown };
          const target = resolve(server.config.root, TARGET);
          const current = JSON.parse(await readFile(target, 'utf8')) as { films?: unknown[] } & Record<string, unknown>;
          const result = await promoteDrafts(current, body?.drafts, (url) => fetchOembed(url));
          if (!result.ok) return json(res, 422, { ok: false, errors: result.errors });
          const temp = `${target}.${process.pid}.tmp`;
          await writeFile(temp, `${JSON.stringify(result.programme, null, 2)}\n`, 'utf8');
          await rename(temp, target);
          return json(res, 200, { ok: true, added: result.added, file: TARGET });
        } catch (error) {
          return json(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' });
        }
      });
    },
  };
}
