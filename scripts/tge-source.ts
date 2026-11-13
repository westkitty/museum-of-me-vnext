import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const SOURCE_PREFIX = 'https://raw.githubusercontent.com/Hidencod/tge-assets/';

/**
 * Fetch for the pinned TGE source. When `MUSEUM_TGE_SOURCE_MIRROR` names a
 * directory, source URLs are answered only from `<mirror>/<revision>/<path>`
 * and never from the network: a file missing from the mirror is a 404. This
 * keeps automated tests hermetic. Callers still apply every size, git-blob
 * and GLB/WebP integrity check to the bytes, so a mirror cannot substitute
 * content: it must hold the exact pinned files.
 */
export function tgeSourceFetch(env: NodeJS.ProcessEnv = process.env): typeof fetch {
  const mirror = env.MUSEUM_TGE_SOURCE_MIRROR;
  if (!mirror) return fetch;
  const root = resolve(mirror);
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(SOURCE_PREFIX)) return new Response(null, { status: 404 });
    const relative = decodeURIComponent(url.slice(SOURCE_PREFIX.length));
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep)) return new Response(null, { status: 404 });
    try {
      return new Response(await readFile(path), { status: 200 });
    } catch {
      return new Response(null, { status: 404 });
    }
  }) as typeof fetch;
}
