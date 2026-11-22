import { expect, test, type Page } from '@playwright/test';

/**
 * Island safety (2026-11-22). Reproduced on main a358b66 with this walk: the
 * east lagoon has no floor, so a visitor holding W at the water fell through
 * the basin, and the fall safety net lifted them to y = 0 at the same x/z over
 * the same unsupported water, restarting the fall every ~2.5 s (13 rescues in
 * 30 s). Now the bank stops the walk, and a visitor who still ends up over the
 * water (jump, flight exit) is returned once to the last spot they stood on.
 * Real keyboard, real PlayerController, assembled exterior CollisionWorld.
 */

async function drive(page: Page, ticks: number, target: readonly [number, number] | null) {
  return page.evaluate(({ ticks, target }) => {
    const app = window.__museum!;
    const out: { t: number; x: number; y: number; z: number; grounded: boolean }[] = [];
    let rescues = 0, minY = Infinity, lastY = app.player.position.y;
    for (let t = 0; t < ticks; t++) {
      const p = app.player.position;
      if (target) app.player.yaw = Math.atan2(-(target[0] - p.x), -(target[1] - p.z));
      app.fixedUpdate(1 / 60);
      app.variableUpdate(1 / 60);
      if (p.y > lastY + 5) rescues++;
      minY = Math.min(minY, p.y);
      lastY = p.y;
      if (t % 30 === 0) out.push({ t: t / 60, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), grounded: app.player.grounded });
    }
    const p = app.player.position;
    return { rescues, minY, end: [p.x, p.y, p.z] as const, grounded: app.player.grounded, samples: out };
  }, { ticks, target });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum));
  await page.evaluate(() => window.__museum!.stop());
});

test('walking at the east lagoon stops on the bank; no fall, no rescue loop', async ({ page }) => {
  test.setTimeout(120_000);
  // Several banks: west (hide side), south-west, north and east shores.
  const runs = [
    { from: [50, 8], to: [93, 0] },
    { from: [52, -40], to: [93, 0] },
    { from: [92, 58], to: [93, 0] },
    { from: [136, -6], to: [93, 0] },
  ] as const;
  for (const run of runs) {
    await page.evaluate(([x, z]) => window.__museum!.player.teleport([x, -0.5, z]), run.from);
    await page.keyboard.down('w');
    const r = await drive(page, 600, run.to);
    await page.keyboard.up('w');
    console.info('[lagoon bank]', JSON.stringify({ from: run.from, end: r.end, minY: r.minY }));
    expect(r.rescues, `${run.from}`).toBe(0);
    expect(r.minY, `${run.from}`).toBeGreaterThan(-0.6);
    expect(r.grounded).toBe(true);
    const onLand = await page.evaluate(([x, z]) =>
      window.__museum!.exteriorWorld.collision.supportHeight(x, z, 0) === -0.5, [r.end[0], r.end[2]] as const);
    expect(onLand, `${run.from} ended on supported land`).toBe(true);
  }
});

test('a visitor who still lands over the water is returned once to dry land and can walk away', async ({ page }) => {
  test.setTimeout(120_000);
  // Stand on the west bank, then (as after a flight exit or jump) be placed over open water.
  await page.evaluate(() => {
    const app = window.__museum!;
    app.player.teleport([50, -0.5, 8]);
    for (let i = 0; i < 10; i++) app.fixedUpdate(1 / 60);
    const player = app.player as unknown as { position: { set(x: number, y: number, z: number): void } };
    player.position.set(92, 0, 1);
  });
  const fall = await drive(page, 60 * 20, null);
  console.info('[lagoon rescue]', JSON.stringify({ rescues: fall.rescues, end: fall.end }));
  expect(fall.rescues).toBe(1);
  expect(fall.end[0]).toBeCloseTo(50, 0);
  expect(fall.end[2]).toBeCloseTo(8, 0);
  expect(fall.end[1]).toBeCloseTo(-0.5, 2);
  expect(fall.grounded).toBe(true);
  // The way back: walk west to the island loop path on foot.
  await page.keyboard.down('w');
  const back = await drive(page, 240, [30, 8]);
  await page.keyboard.up('w');
  expect(back.rescues).toBe(0);
  expect(back.end[0]).toBeLessThan(40);
  expect(back.grounded).toBe(true);
});
