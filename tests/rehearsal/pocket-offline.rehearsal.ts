import { expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { keyboardVisitor } from '../browser/helpers/visitor';
import { APPROACHES, expectAtPierStart, walkBackToPier, walkToEntrance } from '../browser/helpers/natural-approach';

/**
 * Activated offline packaging rehearsal: the single-file standalone package
 * built with VITE_POCKET_REHEARSAL=1 into test-results/ (never release/ or
 * dist-standalone/), opened from file:// with the network switched off. Every
 * world must be verified and enterable from the package alone, W01's stems
 * included. Never a release artifact.
 */
const DIST = 'test-results/rehearsal-standalone-dist';
const OUT = 'test-results/rehearsal-standalone';
const HTML = resolve(OUT, 'The_Reliquary_of_Iterative_Becoming.html');

test.use({
  launchOptions: {
    ...(process.env.MUSEUM_BROWSER_EXECUTABLE ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE } : {}),
    args: [...(process.env.MUSEUM_WORLDS_GL === 'metal'
      ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl']), '--allow-file-access-from-files'],
  },
});

test.beforeAll(() => {
  test.setTimeout(900_000);
  const build = spawnSync('npx', ['vite', 'build', '--config', 'vite.standalone.config.ts', '--outDir', DIST, '--emptyOutDir'],
    { env: { ...process.env, VITE_POCKET_REHEARSAL: '1' }, encoding: 'utf8' });
  expect(build.status, build.stderr.slice(-2000)).toBe(0);
  const pack = spawnSync('node', ['scripts/build-standalone.mjs'],
    { env: { ...process.env, STANDALONE_DIST: DIST, STANDALONE_OUT: OUT }, encoding: 'utf8' });
  expect(pack.status, pack.stderr.slice(-2000)).toBe(0);
  expect(existsSync(HTML)).toBe(true);
});

test('activated offline package: eleven worlds verified, W08 and W01 entered on foot with the network off, stems from the file', async ({ page }) => {
  test.setTimeout(600_000);
  console.log(JSON.stringify({ packageMB: +(statSync(HTML).size / 1048576).toFixed(2) }));
  const errors: string[] = [];
  const network: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) network.push(r.url()); });
  await page.context().setOffline(true);
  const url = pathToFileURL(HTML);
  url.searchParams.set('qa', '1');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => Boolean(window.__museum) && window.__museum!.pocketRegistry.get('W10')?.readiness === 'verified',
    undefined, { timeout: 180_000 });
  await page.evaluate(() => { const app = window.__museum!; app.dismissArrival(); app.ui.hud.completeArrival(); });
  expect(await page.evaluate(() => window.__museum!.pocketRegistry.list().filter((d) => d.readiness === 'verified').length)).toBe(11);
  const v = keyboardVisitor(page);
  await expectAtPierStart(page);

  await walkToEntrance(v, 'W08');
  await v.enterFromAnchor(APPROACHES.W08.title, 'W08');
  await v.pressButton('Back to Museum');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');

  await walkBackToPier(v, 'W08');
  await walkToEntrance(v, 'W01');
  await v.enterFromAnchor(APPROACHES.W01.title, 'W01');
  await expect.poll(() => page.evaluate(() => window.__museum!.audio.activeMusicSessionCount), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(4000);
  const music = await page.evaluate(() => ({ status: window.__museum!.audio.activeMusicStatusText(), audible: window.__museum!.audio.isMusicAudible() }));
  console.log(JSON.stringify({ music }));
  await v.pressButton('Back to Museum');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe('exterior');
  await expect.poll(() => page.evaluate(() => window.__museum!.audio.activeMusicSessionCount), { timeout: 10_000 }).toBe(0);

  expect(network, 'the offline package makes no network request').toEqual([]);
  expect(errors).toEqual([]);
});
