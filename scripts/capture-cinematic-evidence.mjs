/**
 * CI-only, review-only capture of real Three.js frames.
 * Explicitly not human visual approval or representative device FPS.
 * Runs after the canonical browser visitor-path tests, with their same
 * Chromium/SwiftShader software renderer and current production-style build.
 */
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputDir = 'test-results/cinematic-review';
const port = 4187;
const base = 'http://127.0.0.1:' + port;
const sha = process.env.GITHUB_SHA
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const report = {
  revision: sha,
  generatedAt: new Date().toISOString(),
  evidenceState: 'AUTOMATED RENDER CAPTURE; HUMAN VISUAL ACCEPTANCE UNVERIFIED',
  renderer: 'Playwright Chromium/SwiftShader; not representative device FPS',
  captures: [],
  errors: [],
};
await mkdir(outputDir, { recursive: true });
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
    '--port', String(port), '--strictPort'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let browser;
let captureFailed = false;
try {
  // Starting the real production preview is local and bounded; no external
  // image/content requests, synthetic WebGL substitutes or second app loop.
  let reachable = false;
  for (let i = 0; i < 70; i++) {
    try {
      const res = await fetch(base);
      if (res.ok) { reachable = true; break; }
    } catch { /* Server has not bound its local port yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!reachable) throw new Error('Cinematic preview did not start');

  browser = await chromium.launch({
    headless: true,
    ...(process.env.MUSEUM_BROWSER_EXECUTABLE
      ? { executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-webgl'],
  });
  const viewports = [
    { label: 'desktop-1280x720', viewport: { width: 1280, height: 720 }, isMobile: false },
    { label: 'touch-390x844', viewport: { width: 390, height: 844 }, isMobile: true },
  ];

  for (const spec of viewports) {
    const context = await browser.newContext({
      viewport: spec.viewport,
      deviceScaleFactor: 1,
      isMobile: spec.isMobile,
      hasTouch: spec.isMobile,
    });
    const page = await context.newPage();
    const issues = [];
    page.on('pageerror', (error) => issues.push('pageerror: ' + error.message));
    page.on('crash', () => issues.push('Chromium page crashed'));
    page.on('console', (message) => {
      if (message.type() === 'error') issues.push('console: ' + message.text());
    });

    try {
      await page.goto(base + '/', { waitUntil: 'commit', timeout: 30_000 });
      await page.waitForFunction(
        () => Boolean(window.__museum?.ui?.hud && window.__museum?.scene),
        null, { timeout: 50_000 },
      );
      // Headless SwiftShader can starve the protocol when the full WebGL loop
      // runs during screenshots. Stop it only after real application boot:
      // the already-composited real museum frame remains our capture source.
      await page.evaluate(() => window.__museum?.stop());

      // Exercise the production readiness getter/UI code, not a spoofed button.
      await page.waitForFunction(() => {
        const app = window.__museum;
        if (!app) return false;
        app.ui.update(1 / 60);
        return app.arrivalReady;
      }, null, { timeout: 18_000 });

      const metrics = await page.evaluate(() => {
        const app = window.__museum;
        const title = document.querySelector('.hud__lock');
        const action = document.querySelector('.hud__arrival-action');
        const rect = (element) => {
          const r = element?.getBoundingClientRect();
          return r && { x: r.x, y: r.y, width: r.width, height: r.height,
            right: r.right, bottom: r.bottom };
        };
        const sky = app.scene.getObjectByName('night-sky-layered-stars');
        const batchNames = [
          'arrival-ceremonial-bronze-inlay',
          'arrival-reflective-stone-inset',
          'arrival-ceremonial-obelisk',
          'arrival-ceremonial-obelisk-crown',
        ];
        return {
          zone: app.currentZone,
          entryReady: app.arrivalReady,
          titleVisible: !title.hidden,
          titleText: title.textContent?.slice(0, 250) ?? null,
          titleBounds: rect(title),
          actionBounds: rect(action),
          viewport: { width: innerWidth, height: innerHeight },
          documentScrollWidth: document.documentElement.scrollWidth,
          bloodRingCanon: sky?.userData?.canonicalFeature ?? null,
          skyConstruction: sky?.userData?.bloodRingConstruction ?? null,
          plazaBatches: batchNames.map((name) => {
            const mesh = app.scene.getObjectByName(name);
            return { name, instanced: Boolean(mesh?.isInstancedMesh), count: mesh?.count ?? 0 };
          }),
          drawCalls: app.renderer.renderer.info.render.calls,
          triangles: app.renderer.renderer.info.render.triangles,
          prewarm: app.titlePrewarmStatus,
        };
      });

      // The title remains real DOM over the genuine WebGL canvas, not a
      // pasted image of an imagined environment. Save both views.
      const withTitle = spec.label + '-title.png';
      await page.screenshot({
        path: join(outputDir, withTitle),
        timeout: 30_000,
      });
      await page.evaluate(() => window.__museum?.ui?.hud.setVisible(false));
      const unobstructed = spec.label + '-scene.png';
      await page.screenshot({
        path: join(outputDir, unobstructed),
        timeout: 30_000,
      });

      const allBatched = metrics.plazaBatches.every((batch) => batch.instanced);
      const viewportSafe = metrics.documentScrollWidth <= metrics.viewport.width;
      const valid = metrics.zone === 'plaza'
        && metrics.bloodRingCanon === 'starsilk-drakken-blood-ring'
        && allBatched && viewportSafe && metrics.entryReady && metrics.titleVisible
        && issues.length === 0;
      report.captures.push({
        label: spec.label,
        screenshots: [withTitle, unobstructed],
        metrics,
        issues,
        captureValid: valid,
      });
      if (!valid) captureFailed = true;
      console.log(spec.label + ' captured: ' + JSON.stringify({
        valid, drawCalls: metrics.drawCalls, triangles: metrics.triangles,
        issues, viewportSafe, allBatched,
      }));
    } catch (error) {
      captureFailed = true;
      report.errors.push(spec.label + ': ' + String(error));
      console.error(spec.label + ': ' + String(error));
    } finally {
      await context.close().catch(() => {});
    }
  }
} catch (error) {
  captureFailed = true;
  report.errors.push('capture: ' + String(error));
  console.error(error);
} finally {
  await browser?.close().catch(() => {});
  server.kill('SIGTERM');
  await writeFile(join(outputDir, 'evidence.json'), JSON.stringify(report, null, 2));
}

if (captureFailed) process.exitCode = 1;
