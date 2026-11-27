/* eslint-disable -- one-off trace-analysis diagnostic, not shipped */
let gapsAll;
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist','--enable-gpu-rasterization','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto('http://127.0.0.1:5181/', { waitUntil: 'commit', timeout: 180000 });
await page.waitForFunction(() => Boolean(window.__museum) && window.__museum.renderer.renderer.info.render.frame > 2, null, { timeout: 180000, polling: 'raf' });
await page.waitForTimeout(4000);
const r = await page.evaluate(async () => {
  const { EventLoopYieldBudget } = await import('/src/util/yieldToEventLoop.ts');
  const orig = EventLoopYieldBudget.prototype.checkpoint; let resume = 0; const gaps = []; const steps = [];
  EventLoopYieldBudget.prototype.checkpoint = async function () {
    if (!this.__wrapped) { const y = this.yieldOnce; this.__wrapped = true; this.yieldOnce = async () => {
      const now = performance.now(); const bi = window.__museum.buildingInterior; const mk = Object.keys(bi?.museum?.buildStageMs ?? {}); const ik = Object.keys(window.__museum.interiorLoadTelemetry.buildStageMs); const ek = Object.keys(bi?.persistentEnvironment?.buildStageMs ?? {}); if (resume) gaps.push({ gap: +(now - resume).toFixed(1), stage: (ik.at(-1) ?? '-') + ' / m:' + (mk.at(-1) ?? '-') + ' / e:' + (ek.at(-1) ?? '-'), at: new Error().stack.split('\n').slice(3, 6).map((l) => l.trim().replace(/\?[^:]*/, '').replace('http://127.0.0.1:5181/', '')).join(' < ') });
      await y(); resume = performance.now(); }; }
    return orig.call(this);
  };
  const app = window.__museum; await app.worldDirector.prepareInterior();
  EventLoopYieldBudget.prototype.checkpoint = orig;
  return { gaps, stages: app.interiorLoadTelemetry.buildStageMs };
});
const agg = {};
for (const g of r.gaps.filter(g=>g.gap>8)) { console.log('task', g.gap, g.stage, '|', g.at.split(' < ')[1]); continue; const k = g.at.split(' < ')[0] + ' <- ' + (g.at.split(' < ')[1]||''); agg[k] = agg[k] || { n: 0, total: 0, max: 0 }; agg[k].n++; agg[k].total += g.gap; agg[k].max = Math.max(agg[k].max, g.gap); }
gapsAll=r.gaps; console.log('tasks',r.gaps.length,'over12',r.gaps.filter(g=>g.gap>12).length,'over20',r.gaps.filter(g=>g.gap>20).length,'p50',[...r.gaps].sort((a,b)=>a.gap-b.gap)[r.gaps.length>>1]?.gap); console.log('gaps>6ms', r.gaps.length, 'sum', r.gaps.reduce((a, g) => a + g.gap, 0).toFixed(0));
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].total - a[1].total).slice(0, 25)) console.log(v.n, 'tot', v.total.toFixed(0), 'max', v.max.toFixed(0), k.slice(0, 230));
await browser.close();
