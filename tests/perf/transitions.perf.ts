import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
async function gcNodes(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('Performance.enable');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  return { domNodes: m.Nodes, jsHeapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), listeners: m.JSEventListeners, docs: m.Documents };
}
test('first interior entry stall and transition growth, production build', async ({ browser }) => {
  const res: Record<string, unknown>[] = [];
  for (let run = 0; run < 3; run++) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4180/', { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__museum) && window.__museum!.renderer.renderer.info.render.frame > 2, null, { timeout: 60_000, polling: 'raf' });
    await page.waitForTimeout(2000);
    const entry = await page.evaluate(async () => {
      const app = window.__museum!;
      const t0 = performance.now(); await app.worldDirector.prepareInterior(); const prepareMs = performance.now() - t0;
      const deltas: number[] = []; let last = 0; let n = 0;
      // A visitor keeps walking into the doorway; while the entrance is not ready the
      // doorway holds them outside (WorldDirector), so press forward each frame until inside.
      const done = new Promise<void>((resolve) => { const tick = (t: number) => { if (last) deltas.push(t - last); last = t;
        if (app.activeWorld !== 'interior') { app.player.teleport([0, 0, 127]); app.worldDirector.update(app.player.position); }
        if (++n < 240) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
      app.player.teleport([0, 0, 127]);
      const c0 = performance.now(); const committed = app.worldDirector.commitToInterior(); app.worldDirector.update(app.player.position); const commitMs = performance.now() - c0;
      const sinceCommit = performance.now();
      await done;
      return { prepareMs: Math.round(prepareMs), committed, commitMs: Math.round(commitMs), world: app.activeWorld, framesSeen: deltas.length, wallMs: Math.round(performance.now() - sinceCommit),
        worst5: [...deltas].sort((a, b) => b - a).slice(0, 5).map((d) => Math.round(d)), over50: deltas.filter((d) => d > 50).length };
    });
    const exitBack = await page.evaluate(async () => {
      const app = window.__museum!; const deltas: number[] = []; let last = 0; let n = 0;
      const done = new Promise<void>((resolve) => { const tick = (t: number) => { if (last) deltas.push(t - last); last = t; if (++n < 120) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
      app.player.teleport([0, 0, 134]); app.worldDirector.switchToExterior(); app.worldDirector.update(app.player.position); await done;
      return { world: app.activeWorld, worst3: [...deltas].sort((a, b) => b - a).slice(0, 3).map((d) => Math.round(d)) };
    });
    const second = await page.evaluate(async () => {
      const app = window.__museum!; await app.worldDirector.prepareInterior(); const deltas: number[] = []; let last = 0; let n = 0;
      const done = new Promise<void>((resolve) => { const tick = (t: number) => { if (last) deltas.push(t - last); last = t; if (++n < 120) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
      app.player.teleport([0, 0, 127]); app.worldDirector.commitToInterior(); app.worldDirector.update(app.player.position); await done;
      const w = app.activeWorld; app.player.teleport([0, 0, 134]); app.worldDirector.switchToExterior(); app.worldDirector.update(app.player.position);
      return { world: w, worst3: [...deltas].sort((a, b) => b - a).slice(0, 3).map((d) => Math.round(d)) };
    });
    const growth = [await gcNodes(page)];
    for (let k = 0; k < 10; k++) {
      await page.evaluate(async () => { const app = window.__museum!; await app.worldDirector.prepareInterior(); app.player.teleport([0, 0, 127]); app.worldDirector.commitToInterior(); app.worldDirector.update(app.player.position); });
      await page.waitForTimeout(700);
      await page.evaluate(() => { const app = window.__museum!; app.player.teleport([0, 0, 134]); app.worldDirector.switchToExterior(); app.worldDirector.update(app.player.position); });
      await page.waitForTimeout(700);
      if (k === 4 || k === 9) growth.push(await gcNodes(page));
    }
    const domByRole = await page.evaluate(() => { const counts: Record<string, number> = {}; for (const el of document.querySelectorAll('body *')) { const key = el.parentElement?.id || el.parentElement?.className?.toString().split(' ')[0] || el.tagName; counts[key] = (counts[key] ?? 0) + 1; }
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6); });
    res.push({ run: run + 1, entry, exitBack, secondEntry: second, gcAfter0_5_10RoundTrips: growth, topDomParents: domByRole });
    mkdirSync('perf-results', { recursive: true }); writeFileSync('perf-results/transition-results.json', JSON.stringify(res, null, 2));
    await ctx.close();
  }
});
