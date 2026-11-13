import { mkdir, writeFile } from 'node:fs/promises';
import { test } from '@playwright/test';
import { BUILDER_MODELS } from '../../src/workshop/builderAssetCatalog';

/**
 * Contact sheets of Builder library models for visual review.
 * MODEL_SHEET_IDS: comma-separated ids (default: all). MODEL_SHEET_OUT: output folder.
 * MODEL_SHEET_SOURCE=1 draws the pinned, unrepaired source bytes instead;
 * MODEL_SHEET_REPAIR=1 draws those source bytes through the current repair plan.
 * Run: npx playwright test -c playwright.capture.config.ts tests/browser/builder-models.capture.ts
 */
test('render Builder model contact sheets', async ({ page }) => {
  test.setTimeout(600_000);
  const wanted = process.env.MODEL_SHEET_IDS?.split(',').filter(Boolean);
  const out = process.env.MODEL_SHEET_OUT ?? 'test-results/builder-model-sheets';
  const source = process.env.MODEL_SHEET_SOURCE === '1';
  const repair = process.env.MODEL_SHEET_REPAIR === '1';
  const models = BUILDER_MODELS.filter((model) => !wanted || wanted.includes(model.id));
  await mkdir(out, { recursive: true });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());
  const perSheet = 12;
  for (let start = 0; start < models.length; start += perSheet) {
    const items = models.slice(start, start + perSheet).map((model) => ({
      label: model.id.replace('openlife:', ''),
      url: source || repair ? `/assets-source/openlife/${model.path.split('/').pop()}` : `/${model.path}`,
    }));
    const dataUrl = await page.evaluate(async ({ list, apply }) => {
      const load = (url: string) => import(/* @vite-ignore */ url);
      const sheet = await load('/scripts/model-sheet.ts') as typeof import('../../scripts/model-sheet');
      if (!apply) return sheet.renderModelSheet(list, 4);
      const fix = await load('/scripts/openlife-repair.ts') as typeof import('../../scripts/openlife-repair');
      const plans = await (await fetch('/scripts/openlife-repair-plan.json')).json() as Record<string, object>;
      const repaired = [];
      for (const item of list) {
        const bytes = new Uint8Array(await (await fetch(item.url)).arrayBuffer());
        const out = plans[item.label] ? fix.repairOpenLifeGlb(bytes, plans[item.label]).bytes : bytes;
        repaired.push({ label: item.label, bytes: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer });
      }
      return sheet.renderModelSheet(repaired, 4);
    }, { list: items, apply: repair });
    const name = `${out}/sheet-${String(start / perSheet + 1).padStart(2, '0')}.png`;
    await writeFile(name, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
});
