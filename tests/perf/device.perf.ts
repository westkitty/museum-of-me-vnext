import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const out: Record<string, unknown> = {};
const stats = (d: number[]) => {
  const s = [...d].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const total = d.reduce((a, b) => a + b, 0);
  return { frames: d.length, fps: +(1000 * d.length / total).toFixed(1), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +s[s.length - 1].toFixed(2),
    over33ms: d.filter((x) => x > 33.4).length, over50ms: d.filter((x) => x > 50).length };
};
/** Presented-frame intervals from the page's own rAF while the app runs its normal loop. */
async function frames(page: Page, ms: number, during?: string) {
  const d: number[] = await page.evaluate(async ({ ms, during }) => {
    const deltas: number[] = []; let last = 0; let stop = false;
    const tick = (t: number) => { if (last) deltas.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    if (during) await (new Function('return (async () => {' + during + '})()'))();
    await new Promise((r) => setTimeout(r, ms)); stop = true;
    return deltas;
  }, { ms, during });
  return stats(d);
}
async function mem(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const info = await page.evaluate(() => { const r = window.__museum!.renderer.renderer.info; return { geometries: r.memory.geometries, textures: r.memory.textures, programs: r.programs?.length ?? null, calls: r.render.calls, triangles: r.render.triangles }; });
  return { jsHeapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), jsHeapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(1), domNodes: m.Nodes, ...info };
}
async function gpu(page: Page) {
  return page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2')!; const e = c.getExtension('WEBGL_debug_renderer_info');
    return { renderer: e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER), vendor: e ? c.getParameter(e.UNMASKED_VENDOR_WEBGL) : null, dpr: devicePixelRatio, ua: navigator.userAgent }; });
}

test('device measurements: production build', async ({ browser }) => {
  const cold: unknown[] = [];
  for (let run = 0; run < 3; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:4180/', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum) && window.__museum!.renderer.renderer.info.render.frame > 2, null, { timeout: 120_000, polling: 'raf' });
    const appReadyMs = await page.evaluate(() => Math.round(performance.now()));
    const t = await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return { appRenderingFramesMs: 0, domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadEventMs: Math.round(nav.loadEventEnd), firstContentfulPaintMs: fcp ? Math.round(fcp.startTime) : null,
        transferKB: Math.round(performance.getEntriesByType('resource').reduce((a, r) => a + ((r as PerformanceResourceTiming).transferSize || 0), 0) / 1024) }; });
    if (run === 0) out.gpu = await gpu(page);
    cold.push({ run: run + 1, ...t, appRenderingFramesMs: appReadyMs, errors: errors.length });
    if (run === 2) {
      await page.waitForTimeout(3000);
      out.exteriorIdleAtSpawn = { frames: await frames(page, 10_000), memory: await mem(page), quality: await page.evaluate(() => (window.__museum as unknown as { quality?: string }).quality ?? null) };
      // Exterior walk: real player driven along the rerouted path ring for 10 s via the same input the touch stick uses.
      out.exteriorWalkingPath1 = { frames: await frames(page, 10_000, `
        const app = window.__museum; app.player.teleport([0, 0, 184]);
        const pts = [[10,183],[24,170],[44,150],[44,128],[42,108],[46,86],[46,54]]; let i = 0;
        const steer = () => { const p = app.player.position; const [x, z] = pts[i]; if (Math.hypot(p.x - x, p.z - z) < 2 && i < pts.length - 1) i++;
          app.player.yaw = Math.atan2(-(x - p.x), -(z - p.z)); app.input.touchMoveY = -1; if (!window.__stopSteer) requestAnimationFrame(steer); else app.input.touchMoveY = 0; };
        window.__stopSteer = false; requestAnimationFrame(steer); setTimeout(() => { window.__stopSteer = true; }, 9900);`), memory: await mem(page) };
      // World transition: prepare (load interior), commit, then return.
      const prep = await page.evaluate(async () => { const app = window.__museum!; const t0 = performance.now(); await app.worldDirector.prepareInterior(); return Math.round(performance.now() - t0); });
      const enter = await frames(page, 5000, `const app = window.__museum; app.player.teleport([0, 0, 127]); window.__commitMs = performance.now(); app.worldDirector.commitToInterior(); window.__commitMs = performance.now() - window.__commitMs;`);
      const commitMs = await page.evaluate(() => Math.round((window as unknown as { __commitMs: number }).__commitMs));
      out.interiorAfterEntry = { prepareInteriorMs: prep, commitSyncMs: commitMs, activeWorld: await page.evaluate(() => window.__museum!.activeWorld), first5s: enter, memory: await mem(page) };
      out.interiorSteady = { frames: await frames(page, 10_000), memory: await mem(page) };
      const back = await frames(page, 5000, `const app = window.__museum; app.player.teleport([0, 0, 134]); app.worldDirector.switchToExterior();`);
      out.exteriorAfterReturn = { activeWorld: await page.evaluate(() => window.__museum!.activeWorld), first5s: back, memory: await mem(page) };
      // Repeat the round trip 5 times to look for growth.
      const loops: unknown[] = [];
      for (let k = 0; k < 5; k++) {
        await page.evaluate(async () => { const app = window.__museum!; await app.worldDirector.prepareInterior(); app.player.teleport([0, 0, 127]); app.worldDirector.commitToInterior(); });
        await page.waitForTimeout(1500);
        await page.evaluate(() => { const app = window.__museum!; app.player.teleport([0, 0, 134]); app.worldDirector.switchToExterior(); });
        await page.waitForTimeout(1500);
        loops.push(await mem(page));
      }
      out.fiveRoundTrips = loops;
    }
    await ctx.close();
  }
  out.coldStartsProduction = cold;
});

test('device measurements: 2,000 placements in the local Workshop (dev server)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5180/?edit=1', { waitUntil: 'commit', timeout: 180_000 });
  await page.waitForFunction(() => Boolean(window.__museum) && Boolean(window.__museumWorkshop) && window.__museum!.renderer.renderer.info.render.frame > 2, null, { timeout: 180_000, polling: 'raf' });
  await page.waitForTimeout(3000);
  const baseline = { frames: await frames(page, 8000), memory: await mem(page) };
  const load = await page.evaluate(() => {
    const placements = (window.__museumWorkshop as unknown as { placements: { replaceManifest(raw: unknown): { objects: unknown[] }; objectCount: number; residentCount: number } }).placements;
    // Same off-island field as tests/workshop-browser/placement-scale (conservation refuses placements over the museum's protected zones).
    const objects = Array.from({ length: 2000 }, (_, i) => ({ id: `perf-${String(i).padStart(4, '0')}`, label: `Perf ${i}`, prefab: 'display-plinth', anchor: 'floor',
      position: [200 + (i % 50) * 2, 0, 200 + Math.floor(i / 50) * 2], rotation: [0, 0, 0], scale: [1, 1, 1], worldId: 'exterior', collision: 'solid' }));
    const t0 = performance.now(); const c = placements.replaceManifest({ schemaVersion: 2, objects }); const ms = performance.now() - t0;
    return { saved: c.objects.length, records: placements.objectCount, liveAfterLoad: placements.residentCount, replaceMs: Math.round(ms) };
  });
  await page.evaluate(() => { const app = window.__museum!; app.player.teleport([250, 0, 240]); });
  await page.waitForTimeout(2000);
  const after = { frames: await frames(page, 10_000), memory: await mem(page), live: await page.evaluate(() => (window.__museumWorkshop as unknown as { placements: { residentCount: number } }).placements.residentCount) };
  // Residency changes: teleport the visitor across the 2,000-placement field every 400 ms (each hop > 4 m re-evaluates residency).
  const sweep = { frames: await frames(page, 12_000, `
    const app = window.__museum; let k = 0; const hop = () => { if (k >= 28) return; const x = 196 + (k % 7) * 17, z = 196 + Math.floor(k / 7) * 22; app.player.teleport([x, 0, z]); k++; setTimeout(hop, 400); }; hop();`),
    memory: await mem(page), live: await page.evaluate(() => (window.__museumWorkshop as unknown as { placements: { residentCount: number } }).placements.residentCount) };
  const restore = await page.evaluate(() => { const p = (window.__museumWorkshop as unknown as { placements: { replaceManifest(raw: unknown): unknown; objectCount: number } }).placements; p.replaceManifest({ schemaVersion: 2, objects: [] }); return p.objectCount; });
  await page.waitForTimeout(3000);
  out.workshop2000 = { mode: 'vite dev server (unminified, local Workshop only)', baseline, load, after, residencySweep: sweep,
    afterClearing: { objects: restore, memory: await mem(page) }, pageErrors: errors };
  await ctx.close();
  mkdirSync('perf-results', { recursive: true }); writeFileSync('perf-results/device-results.json', JSON.stringify(out, null, 2));
});
