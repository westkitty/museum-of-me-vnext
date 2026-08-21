#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'release', 'The_Reliquary_of_Iterative_Becoming.html');
if (!existsSync(htmlPath)) {
  console.error('standalone-offline-browser: missing release HTML');
  process.exit(1);
}

const fileUrl = pathToFileURL(resolve(htmlPath)).href;
const browser = await chromium.launch({
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
  // Software-WebGL boot of a 6 MB single file takes 10-15 s on a quiet machine
  // and longer under load. `playwright.config.ts` already allows 30 s for the same
  // boot; match it here rather than weakening any assertion below.
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 30_000 });
  const canvas = await page.locator('#museum-canvas').isVisible();
  const zone = await page.evaluate(() => window.__museum?.currentZone);
  const visitors = await page.evaluate(() => window.__museum?.sourceVisitors?.count ?? 0);
  await page.evaluate(() => window.__museum?.stop());
  const remote = requests.filter((url) => /^https?:/i.test(url) && !url.startsWith('file:'));
  if (!canvas) errors.push('canvas not visible');
  if (zone !== 'plaza') errors.push(`expected plaza, got ${zone}`);
  if (visitors !== 17) errors.push(`expected 17 source visitors, got ${visitors}`);
  if (remote.length) errors.push(`network requests while offline: ${remote.slice(0, 8).join(', ')}`);
  if (errors.length) {
    console.error('standalone-offline-browser: FAIL');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`standalone-offline-browser: PASS zone=${zone} visitors=${visitors} requests=${requests.length}`);
  }
} catch (error) {
  console.error('standalone-offline-browser: FAIL');
  console.error(`  - ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
