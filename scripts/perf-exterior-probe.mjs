#!/usr/bin/env node
// Focused, screen-free diagnostic for the existing exterior-walk budget route.
// This does not replace tests/perf/device.perf.ts or its budget checker.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4180/';
const output = process.argv[3] ?? 'perf-results/exterior-probe.json';
const browser = await chromium.launch({
  executablePath: process.env.MUSEUM_BROWSER_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum) && window.__museum.renderer.renderer.info.render.frame > 2,
    null, { timeout: 120_000, polling: 'raf' });
  await page.waitForTimeout(3000);
  // Match device.perf.ts: ten seconds of exterior idle, then its CDP memory read.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 10_000)));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Performance.getMetrics');
  const result = await page.evaluate(async () => {
    const app = window.__museum;
    const records = [];
    const original = app.afterFrame.bind(app);
    let recording = false;
    const longTasks = [];
    const longAnimations = [];
    const taskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, duration: entry.duration, name: entry.name });
    });
    taskObserver.observe({ type: 'longtask', buffered: false });
    const animationObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longAnimations.push({ start: entry.startTime, duration: entry.duration });
    });
    try { animationObserver.observe({ type: 'long-animation-frame', buffered: false }); } catch { /* unsupported */ }
    app.afterFrame = (...values) => {
      original(...values);
      if (!recording) return;
      const p = app.player.position;
      records.push({ at: performance.now(), wall: values[0], fixed: values[1], variable: values[2], render: values[3],
        steps: values[4], x: p.x, z: p.z, world: app.activeWorld, phase: app.worldDirector.phase,
        geometries: app.renderer.renderer.info.memory.geometries, textures: app.renderer.renderer.info.memory.textures,
        calls: app.renderer.renderer.info.render.calls,
        uploadsPending: app.renderer.warmTelemetry.worldUploadsPending,
        uploaded: app.renderer.warmTelemetry.worldUploaded,
        longestUpload: app.renderer.warmTelemetry.longestUploadMs,
        frameCompiles: app.renderer.frameTelemetry.compilesInFrame });
    };
    app.longFrames.clear();
    app.player.teleport([0, 0, 184]);
    const pts = [[10, 183], [24, 170], [44, 150], [44, 128], [42, 108], [46, 86], [46, 54]];
    let i = 0, stopped = false;
    const steer = () => {
      const p = app.player.position;
      const [x, z] = pts[i];
      if (Math.hypot(p.x - x, p.z - z) < 2 && i < pts.length - 1) i++;
      app.player.yaw = Math.atan2(-(x - p.x), -(z - p.z));
      app.input.touchMoveY = -1;
      if (!stopped) requestAnimationFrame(steer);
      else app.input.touchMoveY = 0;
    };
    recording = true;
    requestAnimationFrame(steer);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    stopped = true;
    recording = false;
    app.afterFrame = original;
    taskObserver.disconnect(); animationObserver.disconnect();
    return { records, longTasks, longAnimations, longFrames: app.longFrames.recent,
      telemetry: app.interiorLoadTelemetry, warmTelemetry: { ...app.renderer.warmTelemetry },
      finish: { x: app.player.position.x, z: app.player.position.z, phase: app.worldDirector.phase,
        geometries: app.renderer.renderer.info.memory.geometries, textures: app.renderer.renderer.info.memory.textures } };
  });
  mkdirSync(output.slice(0, output.lastIndexOf('/')), { recursive: true });
  writeFileSync(output, JSON.stringify(result, null, 2));
  const slow = result.records.filter((r) => r.wall > 20).sort((a, b) => b.wall - a.wall);
  console.log(JSON.stringify({ url, output, frames: result.records.length, over20: slow.length,
    worst: slow.slice(0, 12), longTasks: result.longTasks, longAnimations: result.longAnimations,
    longFrames: result.longFrames, finish: result.finish }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
