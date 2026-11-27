// Diagnostic: CPU profile (CDP Profiler) of interior construction on the dev server; prints self time by function.
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--ignore-gpu-blocklist','--enable-gpu-rasterization'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
await page.goto(process.argv[2] ?? 'http://127.0.0.1:5181/', { waitUntil: 'commit', timeout: 180000 });
await page.waitForFunction(() => Boolean(window.__museum) && window.__museum.renderer.renderer.info.render.frame > 2, null, { timeout: 180000, polling: 'raf' });
await page.waitForTimeout(4000);
await page.evaluate(() => import('/src/world/InteriorWorld.ts')); // exclude module fetch from the profile
const cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await page.evaluate(() => window.__museum.worldDirector.prepareInterior());
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map(); const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); const f = n.callFrame; const k = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/').replace(/\?.*/, '')}:${f.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)); }
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const KEYS = /^(tick|buildCinemaArchitecture|buildWing|buildRotunda|buildEntrance|buildSanctuary|buildExterior|buildBalcony|buildStairs|applyZone|mergeStaticCooperatively|DexterSanctuary|fromKit|SourceVisitors|SupplementaryCases|buildCooperatively|createTextTexture|largestFittingTitleSize|drawWrapped|countWrappedLines|textTexture)$/;
const owner = (id) => { const chain = []; let cur = id; while (cur !== undefined) { const f = byId.get(cur).callFrame.functionName; if (KEYS.test(f)) chain.push(f); cur = parent.get(cur); } return chain; };
const incl = new Map(); for (let i = 0; i < profile.samples.length; i++) { const ch = owner(profile.samples[i]); const k = ch.length ? ch.slice(0, 2).reverse().join(' > ') : '(other)'; incl.set(k, (incl.get(k) ?? 0) + (dt[i] ?? 0)); }
for (const [k, v] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log('INCL', (v / 1000).toFixed(1).padStart(7), k);
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log('profiled ms', (total / 1000).toFixed(0));
for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 0)) console.log((v / 1000).toFixed(1).padStart(7), k);
await browser.close();
