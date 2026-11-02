#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'release', 'The_Reliquary_of_Iterative_Becoming.html');
// Software WebGL loads an embedded multi-megabyte script and may exceed 60 s.
// This is a bounded test allowance, not an actual visitor startup target.
const BOOT_TIMEOUT_MS = 90_000;
if (!existsSync(htmlPath)) {
  console.error('standalone-offline-browser: missing release HTML');
  process.exit(1);
}

// Exercise embedded museum controls without the visitor title modal.
const fileUrl = pathToFileURL(resolve(htmlPath));
fileUrl.searchParams.set('qa', '1');
const browser = await chromium.launch({
  ...(process.env.MUSEUM_BROWSER_EXECUTABLE
    ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl', '--allow-file-access-from-files'],
});
const context = await browser.newContext();
await context.setOffline(true);
const page = await context.newPage();
const requests = [];
const errors = [];
page.on('request', (request) => requests.push(request.url()));
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  // The production standalone is a self-contained 16 MB HTML file. Software-WebGL
  // initialization can exceed the ordinary browser-test timeout under local load;
  // retain the real boot assertion with a bounded standalone-specific allowance.
  await page.goto(fileUrl.href, { waitUntil: 'domcontentloaded', timeout: BOOT_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: BOOT_TIMEOUT_MS });
  const canvas = await page.locator('#museum-canvas').isVisible();
  const cold = await page.evaluate(() => ({
    zone: window.__museum?.currentZone,
    world: window.__museum?.activeWorld,
    constructed: window.__museum?.interiorConstructed,
    buildCount: window.__museum?.museumBuildCount,
  }));
  await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    app.player.teleport([0, 0, 133], 0);
    app.variableUpdate(1 / 60);
    app.start();
  });
  await page.waitForFunction(() => window.__museum?.interiorWorld?.streaming.telemetry.prewarmReady === true,
    null, { timeout: BOOT_TIMEOUT_MS });
  const journey = await page.evaluate(() => {
    const app = window.__museum;
    if (!app) throw new Error('museum missing');
    app.stop();
    const preparedOutside = app.activeWorld === 'exterior' && app.interiorConstructed;
    app.player.teleport([0, 0, 126], 0);
    app.fixedUpdate(1 / 60);
    app.variableUpdate(1 / 60);
    const entered = app.activeWorld === 'interior';
    app.player.teleport([0, 0, 132], 0);
    app.fixedUpdate(1 / 60);
    app.variableUpdate(1 / 60);
    const returned = app.activeWorld === 'exterior';
    app.player.teleport([0, 0, 126], 0);
    app.fixedUpdate(1 / 60);
    app.variableUpdate(1 / 60);
    return {
      preparedOutside, entered, returned,
      reentered: app.activeWorld === 'interior',
      buildCount: app.museumBuildCount,
      visitors: app.sourceVisitors?.count ?? 0,
    };
  });
  const visitors = journey.visitors;
  await page.evaluate(() => window.__museum?.stop());
  await page.evaluate(() => window.__museum?.ui.openFullWeasel());
  const panel = page.locator('#panel-full-weasel');
  const frame = page.frameLocator('.full-weasel__frame');
  await panel.waitFor({ state: 'visible', timeout: BOOT_TIMEOUT_MS });
  await frame.locator('#root').waitFor({ state: 'visible', timeout: BOOT_TIMEOUT_MS });
  await frame.locator('body').press('Escape');
  await panel.waitFor({ state: 'hidden', timeout: 5_000 });
  const remote = requests.filter((url) => /^https?:/i.test(url) && !url.startsWith('file:'));
  if (!canvas) errors.push('canvas not visible');
  if (cold.zone !== 'plaza') errors.push(`expected plaza, got ${cold.zone}`);
  if (cold.world !== 'exterior' || cold.constructed || cold.buildCount !== 0) {
    errors.push(`cold boot was not exterior-only: ${JSON.stringify(cold)}`);
  }
  if (!journey.preparedOutside || !journey.entered || !journey.returned || !journey.reentered || journey.buildCount !== 1) {
    errors.push(`offline world round trip failed: ${JSON.stringify(journey)}`);
  }
  if (visitors !== 17) errors.push(`expected 17 source visitors, got ${visitors}`);
  if (!requests.some((url) => url.endsWith('/embedded/full-weasel/index.html'))) {
    errors.push('local Full Weasel iframe did not load');
  }
  if (remote.length) errors.push(`network requests while offline: ${remote.slice(0, 8).join(', ')}`);
  if (errors.length) {
    console.error('standalone-offline-browser: FAIL');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`standalone-offline-browser: PASS cold=exterior roundTrips=2 visitors=${visitors} requests=${requests.length}`);
  }
} catch (error) {
  console.error('standalone-offline-browser: FAIL');
  console.error(`  - ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
