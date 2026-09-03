#!/usr/bin/env node
/**
 * Runs the real Workshop authoring journey, builds from the authored source,
 * proves the saved objects in the offline standalone runtime, and restores the
 * developer's original manifest bytes before returning.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(import.meta.dirname, '..');
const source = join(root, 'data', 'workshop-placements.json');
const release = join(root, 'release', 'The_Reliquary_of_Iterative_Becoming.html');
const original = await readFile(source);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
}

async function verifyAuthoredStandalone() {
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
    // The standalone module is a large inline data URL. Under software WebGL,
    // waiting for DOMContentLoaded can outlive the useful runtime boot signal;
    // commit is sufficient because the next assertion waits for the real App.
    await page.goto(pathToFileURL(release).href, { waitUntil: 'commit', timeout: 60_000 });
    await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
    await page.evaluate(() => window.__museum?.stop());
    const proof = await page.evaluate(() => ({
      first: Boolean(window.__museum?.scene.getObjectByName('workshop:display-plinth-01')),
      second: Boolean(window.__museum?.scene.getObjectByName('workshop:display-plinth-02')),
      editorAbsent: typeof window.__museumWorkshop === 'undefined',
      zone: window.__museum?.currentZone,
    }));
    const remote = requests.filter((url) => /^https?:/i.test(url));
    if (!proof.first || !proof.second || !proof.editorAbsent || proof.zone !== 'plaza' || remote.length || errors.length) {
      throw new Error(`authored standalone proof failed: ${JSON.stringify({ proof, remote, errors })}`);
    }
    console.log(`workshop standalone: PASS authored placements=2 zone=${proof.zone} requests=${requests.length}`);
  } finally {
    await browser.close();
  }
}

try {
  run('npx', ['playwright', 'test', '--config', 'playwright.workshop.config.ts']);
  run('npm', ['run', 'build:standalone']);
  await verifyAuthoredStandalone();
} finally {
  await writeFile(source, original);
}
