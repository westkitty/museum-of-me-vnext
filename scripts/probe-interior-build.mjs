#!/usr/bin/env node
// Diagnostic only (not a budget): measures the uninterrupted main-thread work
// between cooperative yields while the interior is prepared, against a Vite
// dev server. Each "step" is the time from one yield's resume to the next
// yield, attributed to the build stage and call site active at that yield.
//
//   node scripts/probe-interior-build.mjs [url] [runs] [out.json]
//
// It reloads the page per run (cold interior), waits for the exterior to
// settle, then calls the real WorldDirector.prepareInterior().
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://127.0.0.1:4191/';
const runs = Number(process.argv[3] ?? 3);
const out = process.argv[4];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const results = [];
for (let run = 0; run < runs; run++) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(url, { waitUntil: 'commit', timeout: 180_000 });
  await page.waitForFunction(() => Boolean(window.__museum) && window.__museum.renderer.renderer.info.render.frame > 2,
    null, { timeout: 180_000, polling: 'raf' });
  await page.waitForTimeout(4000);
  results.push(await page.evaluate(async () => {
    const { EventLoopYieldBudget } = await import('/src/util/yieldToEventLoop.ts');
    const original = EventLoopYieldBudget.prototype.checkpoint;
    const steps = [];
    let resumedAt = 0;
    const app = window.__museum;
    const stageNow = () => {
      const bi = app.buildingInterior;
      const last = (o) => Object.keys(o ?? {}).at(-1) ?? '-';
      return `${last(app.interiorLoadTelemetry.buildStageMs)} | m:${last(bi?.museum?.buildStageMs)} | e:${last(bi?.persistentEnvironment?.buildStageMs)}`;
    };
    EventLoopYieldBudget.prototype.checkpoint = async function checkpoint() {
      if (!this.__probe) {
        this.__probe = true;
        const yieldOnce = this.yieldOnce;
        this.yieldOnce = async () => {
          const now = performance.now();
          if (resumedAt) {
            const site = (new Error().stack ?? '').split('\n').slice(3, 5)
              .map((line) => line.trim().replace(/\?[^:)]*/g, '').replace(/https?:\/\/[^/]+\//, '')).join(' < ');
            steps.push({ ms: +(now - resumedAt).toFixed(1), stage: stageNow(), site });
          }
          await yieldOnce();
          resumedAt = performance.now();
        };
      }
      return original.call(this);
    };
    const started = performance.now();
    try {
      await app.worldDirector.prepareInterior();
    } finally {
      EventLoopYieldBudget.prototype.checkpoint = original;
    }
    return { totalMs: +(performance.now() - started).toFixed(0), steps, stages: app.interiorLoadTelemetry.buildStageMs };
  }));
  await page.context().close();
}
await browser.close();

for (const [i, r] of results.entries()) {
  const sorted = [...r.steps].sort((a, b) => b.ms - a.ms);
  const cpu = r.steps.reduce((sum, s) => sum + s.ms, 0);
  console.log(`run ${i + 1}: total ${r.totalMs} ms, steps ${r.steps.length}, step CPU ${cpu.toFixed(0)} ms, `
    + `>8 ms ${r.steps.filter((s) => s.ms > 8).length}, >12 ms ${r.steps.filter((s) => s.ms > 12).length}, `
    + `>16 ms ${r.steps.filter((s) => s.ms > 16).length}`);
  for (const s of sorted.slice(0, 12)) console.log(`   ${String(s.ms).padStart(6)}  ${s.stage}  ::  ${s.site.slice(0, 160)}`);
}
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
