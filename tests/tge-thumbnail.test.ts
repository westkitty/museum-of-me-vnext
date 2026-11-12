import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { tgeThumbnail } from '../scripts/tge-thumbnail';

describe('pinned thumbnail retrieval', () => {
  it('verifies and caches source bytes for later offline use', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tge-thumbnails-'));
    try {
      const fixture = await readFile('tests/fixtures/tge/blaster-a.webp');
      let requested = '';
      const source = (async (input: string | URL | Request) => {
        requested = String(input);
        return new Response(new Uint8Array(fixture), { status: 200 });
      }) as typeof fetch;
      expect(await tgeThumbnail('blaster-kit/blaster-a', root, source)).toEqual(fixture);
      expect(requested).toContain('/3ddcc695adbba9fb918cf31b7c139b3f95b76910/packs/blaster-kit/thumbs/blaster-a.webp');
      const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
      expect(await tgeThumbnail('blaster-kit/blaster-a', root, offline)).toEqual(fixture);
      await expect(tgeThumbnail('../../secret', root, source)).rejects.toThrow('Unknown thumbnail');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('does not cache a tampered source response', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tge-thumbnails-invalid-'));
    try {
      const fixture = await readFile('tests/fixtures/tge/blaster-a.webp');
      fixture[fixture.length - 1] ^= 1;
      const source = (async () => new Response(new Uint8Array(fixture), { status: 200 })) as typeof fetch;
      await expect(tgeThumbnail('blaster-kit/blaster-a', root, source)).rejects.toThrow('integrity');
      const offline = (async () => { throw new Error('offline'); }) as typeof fetch;
      await expect(tgeThumbnail('blaster-kit/blaster-a', root, offline)).rejects.toThrow('offline');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
