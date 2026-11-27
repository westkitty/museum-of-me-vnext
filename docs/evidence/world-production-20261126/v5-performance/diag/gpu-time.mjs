// Diagnostic: hardware GPU time per app frame (EXT_disjoint_timer_query_webgl2) at spawn idle and during the governing walk.
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://127.0.0.1:4180/';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist','--enable-gpu-rasterization','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(url, { waitUntil: 'commit' });
await page.waitForFunction(() => Boolean(window.__museum) && window.__museum.renderer.renderer.info.render.frame > 2, null, { timeout: 120000, polling: 'raf' });
await page.waitForTimeout(3000);
const r = await page.evaluate(async () => {
  const app = window.__museum; const host = app.renderer; const gl = host.renderer.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'); if (!ext) return { error: 'no timer query' };
  const pending = []; const out = []; const orig = host.render.bind(host); let label = 'idle';
  host.render = () => { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig(); gl.endQuery(ext.TIME_ELAPSED_EXT);
    pending.push({ q, label, phase: app.worldDirector.phase, calls: host.renderer.info.render.calls });
    while (pending.length && gl.getQueryParameter(pending[0].q, gl.QUERY_RESULT_AVAILABLE)) { const p = pending.shift();
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) out.push({ ms: gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6, label: p.label, phase: p.phase, calls: p.calls }); gl.deleteQuery(p.q); } };
  await new Promise((res) => setTimeout(res, 4000));
  label = 'walk'; app.player.teleport([0, 0, 184]);
  const pts = [[10,183],[24,170],[44,150],[44,128],[42,108],[46,86],[46,54]]; let i = 0; let halt = false;
  const steer = () => { const p = app.player.position; const [x, z] = pts[i]; if (Math.hypot(p.x - x, p.z - z) < 2 && i < pts.length - 1) i++;
    app.player.yaw = Math.atan2(-(x - p.x), -(z - p.z)); app.input.touchMoveY = -1; if (!halt) requestAnimationFrame(steer); else app.input.touchMoveY = 0; };
  requestAnimationFrame(steer); setTimeout(() => { halt = true; }, 9900); await new Promise((res) => setTimeout(res, 10000));
  host.render = orig; return { out };
});
if (r.error) { console.log(r.error); process.exit(0); }
const groups = {}; for (const x of r.out) { const k = x.label + ':' + x.phase; (groups[k] ||= []).push(x.ms); }
for (const [k, v] of Object.entries(groups)) { const s = [...v].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1);
  console.log(k.padEnd(36), 'n', v.length, 'gpu ms p50', q(0.5), 'p90', q(0.9), 'p99', q(0.99), 'max', s.at(-1).toFixed(1)); }
await browser.close();
