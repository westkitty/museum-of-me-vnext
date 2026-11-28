#!/usr/bin/env node
// Diagnostic only: reproduces the governing tests/perf/device.perf.ts exterior
// walk sequence (three cold contexts in one browser; on the third: 3 s settle,
// 10 s idle rAF sample, CDP metrics, then the 10 s walk) and records a Chromium
// trace with GPU-process categories during the walk. It does not replace the
// governing harness or its budget checker (scripts/check-perf-budgets.mjs).
//
// Usage: node scripts/perf-trace-walk.mjs <url> <outDir> [--no-trace]
// Expects a production `vite preview` already serving <url>.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4180/';
const outDir = process.argv[3] ?? 'perf-results/trace-walk';
const trace = !process.argv.includes('--no-trace');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const stats = (d) => {
  const s = [...d].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { frames: d.length, p50: q(0.5), p99: q(0.99), max: s.at(-1), over20: d.filter((x) => x > 20).length };
};
try {
  for (let run = 0; run < 3; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum) && window.__museum.renderer.renderer.info.render.frame > 2,
      null, { timeout: 120_000, polling: 'raf' });
    if (run < 2) { await ctx.close(); continue; }
    await page.waitForTimeout(3000);
    const idle = await page.evaluate(async () => {
      const d = []; let last = 0; let stop = false;
      const tick = (t) => { if (last) d.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); await new Promise((r) => setTimeout(r, 10_000)); stop = true; return d;
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable'); await cdp.send('Performance.getMetrics');
    if (trace) {
      await browser.startTracing(page, { path: `${outDir}/walk-trace.json`, categories: [
        'devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
        'toplevel', 'blink.user_timing', 'v8', 'disabled-by-default-v8.gc', 'gpu', 'gpu.service', 'gpu.angle', 'gpu.decoder',
        'disabled-by-default-gpu.service', 'disabled-by-default-gpu.decoder', 'viz', 'cc', 'benchmark', 'scheduler'] });
    }
    const walk = await page.evaluate(async () => {
      const app = window.__museum; const r = app.renderer;
      const rec = []; let last = 0; let stop = false;
      const tick = (t) => {
        if (last) {
          rec.push({ t, dt: t - last, phase: app.worldDirector.phase, pend: r.warmTelemetry.worldUploadsPending,
            up: r.warmTelemetry.worldUploaded, prog: r.renderer.info.programs?.length ?? 0, tex: r.renderer.info.memory.textures,
            geo: r.renderer.info.memory.geometries, cif: r.frameTelemetry.compilesInFrame, z: +app.player.position.z.toFixed(1),
            warmed: app.interiorWorldWarmed });
          performance.mark(`f${rec.length}:${(t - last).toFixed(1)}:${app.worldDirector.phase}`);
        }
        last = t; if (!stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      app.player.teleport([0, 0, 184]);
      const pts = [[10, 183], [24, 170], [44, 150], [44, 128], [42, 108], [46, 86], [46, 54]]; let i = 0; let halt = false;
      const steer = () => { const p = app.player.position; const [x, z] = pts[i]; if (Math.hypot(p.x - x, p.z - z) < 2 && i < pts.length - 1) i++;
        app.player.yaw = Math.atan2(-(x - p.x), -(z - p.z)); app.input.touchMoveY = -1; if (!halt) requestAnimationFrame(steer); else app.input.touchMoveY = 0; };
      requestAnimationFrame(steer); setTimeout(() => { halt = true; }, 9900);
      await new Promise((res) => setTimeout(res, 10_000)); stop = true;
      return { rec, warm: { ...r.warmTelemetry }, telemetry: app.interiorLoadTelemetry };
    });
    if (trace) await browser.stopTracing();
    const result = { url, idle: stats(idle), walk: stats(walk.rec.map((x) => x.dt)), slow: walk.rec.filter((x) => x.dt > 20),
      warm: walk.warm, telemetry: walk.telemetry, rec: walk.rec };
    writeFileSync(`${outDir}/walk.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ idle: result.idle, walk: result.walk, slow: result.slow, warm: result.warm }, null, 1));
    await ctx.close();
  }
} finally { await browser.close(); }
