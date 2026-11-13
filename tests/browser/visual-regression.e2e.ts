import { expect, test } from '@playwright/test';

/**
 * Visual regression: the museum rendered from fixed canonical cameras, compared
 * with committed baselines. Pixel output depends on the GPU path, so baselines
 * are recorded only for CI's Linux SwiftShader renderer and the test is skipped
 * elsewhere. To refresh after an intended visual change, download the
 * `museum-visual-snapshots-*` artifact from the failing CI run and commit its
 * `visual-regression.e2e.ts-snapshots/` PNGs.
 */
const views = [
  ['front-south', [0, 18, 140], [0, 8, 0]],
  ['east-lagoon', [140, 35, 30], [0, 10, 0]],
  ['high-topdown', [0, 220, 0.1], [0, 0, 0]],
  ['arrival-plaza', [0, 3.2, 190], [0, 4, 120]],
] as const;

test.skip(process.platform !== 'linux', 'baselines are recorded on the CI Linux software renderer only');

test('canonical exterior views match their visual baselines', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());
  await page.addStyleTag({ content: '#a11y-root, #ui-root, .cinematic-arrival { display: none !important; }' });

  for (const [id, position, target] of views) {
    // Render the view repeatedly so streamed exterior assets near the camera settle
    // before the comparison; toHaveScreenshot then requires two identical frames.
    for (let pass = 0; pass < 6; pass++) {
      await page.evaluate(({ p, t }) => {
        const app = window.__museum!;
        app.renderer.camera.position.set(p[0], p[1], p[2]);
        app.renderer.camera.lookAt(t[0], t[1], t[2]);
        const eye: [number, number, number] = [p[0], p[1], p[2]];
        app.sky.follow(app.renderer.camera);
        app.lighting.update(eye);
        app.exteriorWorld.variableUpdate(0, eye, 'plaza', false);
        app.renderer.render();
      }, { p: position, t: target });
      await page.waitForTimeout(400);
    }
    await expect(page.locator('#museum-canvas')).toHaveScreenshot(`${id}.png`, {
      maxDiffPixelRatio: 0.02,
      threshold: 0.25,
      animations: 'disabled',
      timeout: 30_000,
    });
  }
  expect(errors).toEqual([]);
});
