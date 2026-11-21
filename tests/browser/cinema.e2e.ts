import { expect, test, type Page } from '@playwright/test';

/**
 * The Museum Cinema in the real running app (docs/MUSEUM_CINEMA_2026-11-21.md):
 * real held keys through the app's own frame pipeline, the museum's own
 * interaction (F / tap), the real programme panel and controls, and a real
 * local film decoded onto the auditorium screen. Positions are placed by
 * teleport only to start a walk; every leg is walked.
 */

test.setTimeout(8 * 60_000);

type P = [number, number, number];

async function enterInterior(page: Page): Promise<void> {
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 90_000 });
  await page.evaluate(async () => {
    const a = window.__museum!;
    a.stop();
    a.renderer.renderer.setPixelRatio(0.5);
    await a.worldDirector.prepareInterior();
    for (let i = 0; i < 400 && !a.interiorWorld?.streaming.telemetry.prewarmReady; i++) {
      a.variableUpdate(1 / 60); a.render(0); await new Promise((r) => setTimeout(r, 40));
    }
    if (!(await a.switchToInterior())) throw new Error('interior not entered');
    a.dismissArrival();
  });
}

const frames = (page: Page, n: number, render = false) => page.evaluate(async ([n, render]) => {
  const a = window.__museum!;
  for (let i = 0; i < n; i++) {
    a.fixedUpdate(1 / 60); a.variableUpdate(1 / 60);
    if (render) a.render(1);
    if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}, [n, render] as const);

/** Walk with the real held W key toward (x, z); false on a stall. */
async function walkTo(page: Page, target: P): Promise<boolean> {
  let best = Infinity;
  let since = 0;
  await page.keyboard.down('w');
  try {
    for (let i = 0; i < 500; i++) {
      const d = await page.evaluate(([x, z]) => {
        const a = window.__museum!; const p = a.player.position;
        const dx = x - p.x, dz = z - p.z;
        a.player.yaw = Math.atan2(-dx, -dz);
        return Math.hypot(dx, dz);
      }, [target[0], target[2]]);
      if (d < 0.4) return true;
      if (d < best - 0.02) { best = d; since = 0; } else if (++since > 25) return false;
      await frames(page, 6);
    }
    return false;
  } finally {
    await page.keyboard.up('w');
  }
}

async function layout(page: Page) {
  return page.evaluate(async () => {
    const load = async (path: string) => import(/* @vite-ignore */ path);
    const L = await load('/src/world/layout.ts');
    const C = await load('/src/world/cinemaLayout.ts');
    const s = L.STAIRS[0];
    return {
      approach: L.stairApproach(s) as P,
      arc: Array.from({ length: 21 }, (_, i) => L.stairArcPoint(s, i / 20) as P),
      landing: L.stairLanding(s) as P,
      points: C.CINEMA_POINTS as Record<string, P>,
      seat: C.CINEMA_SEATS[4 * 28 + 6] as { label: string; position: P; aisleSide: P },
      screenCenter: C.SCREEN_CENTER as P,
    };
  });
}

/** Sample the rendered pixel where the screen centre projects (same task as the render). */
async function screenPixel(page: Page, center: P): Promise<number[]> {
  return page.evaluate(async (c) => {
    const a = window.__museum!;
    const load = async (path: string) => import(/* @vite-ignore */ path);
    const THREE = await load('/node_modules/.vite/deps/three.js');
    a.variableUpdate(1 / 60);
    a.render(1);
    const v = new THREE.Vector3(c[0], c[1], c[2]).project(a.camera);
    const canvas = a.renderer.renderer.domElement as HTMLCanvasElement;
    const scratch = document.createElement('canvas');
    scratch.width = canvas.width; scratch.height = canvas.height;
    const ctx = scratch.getContext('2d')!;
    ctx.drawImage(canvas, 0, 0);
    const x = Math.round((v.x + 1) / 2 * canvas.width);
    const y = Math.round((1 - v.y) / 2 * canvas.height);
    // Average a small patch to be robust to texel boundaries.
    const d = ctx.getImageData(x - 3, y - 3, 7, 7).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; }
    return sum.map((s) => Math.round(s / (d.length / 4)));
  }, center);
}

async function walkIntoCinema(page: Page, L: Awaited<ReturnType<typeof layout>>): Promise<string[]> {
  const failed: string[] = [];
  await page.evaluate((p) => window.__museum!.player.teleport(p, 0), L.approach);
  await frames(page, 10);
  const route: [string, P][] = [...L.arc.map((p, i): [string, P] => [`stair ${i}`, p]), ['landing', L.landing]];
  const start = Math.atan2(L.landing[2], L.landing[0]);
  for (let k = 1; k <= 8; k++) { const a = start * (1 - k / 8); route.push([`ring ${k}`, [Math.cos(a) * 13.5, 10, Math.sin(a) * 13.5]]); }
  for (const name of ['balconyApproach', 'threshold', 'lobby', 'lobbyTurn', 'lightLock', 'lobbyEast', 'insideEntry', 'frontZone']) route.push([name, L.points[name]]);
  for (const [label, p] of route) if (!(await walkTo(page, p))) failed.push(label);
  return failed;
}

test('a visitor walks into the cinema, sits, watches a real film on the screen, controls it, stands and leaves', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  const media: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const url = r.url();
    if (/\.mp4(\?|$)/.test(url)) media.push(url);
    if (!/^(http:\/\/127\.0\.0\.1|data:|blob:)/.test(url)) external.push(url);
  });
  await enterInterior(page);
  const L = await layout(page);

  // No film element exists anywhere until a visitor chooses one.
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.hasMediaElement)).toBe(false);

  // 1–3. Reached from the Rotunda floor on foot: grand stair, balcony, threshold, lobby ramp, light lock, door.
  expect(await walkIntoCinema(page, L)).toEqual([]);
  const inside = await page.evaluate(() => { const a = window.__museum!; return { zone: a.currentZone, label: a.zoneLabel, y: a.player.position.y }; });
  expect(inside).toMatchObject({ zone: 'cinema', label: 'Museum Cinema' });
  expect(inside.y).toBeCloseTo(10.6, 1);

  // Idle screen: the programme slide, house lights up.
  const idle = await screenPixel(page, L.screenCenter);

  // 4–5. Up the centre aisle to row E, look at the row, press F (the museum's interact key).
  for (let row = 0; row <= 4; row++) expect(await walkTo(page, [35 + row * 2.1 + 0.55, 0, 12.4])).toBe(true);
  expect(await walkTo(page, L.seat.aisleSide)).toBe(true);
  const standing = await page.evaluate(() => window.__museum!.player.position.toArray());
  await page.evaluate(() => { const a = window.__museum!; a.player.yaw = -Math.PI / 2; a.player.pitch = -0.2; });
  await frames(page, 8, true);
  expect(await page.evaluate(() => window.__museum!.interaction.currentFocus?.label)).toBe(`Take seat ${L.seat.label} · Row E`);
  await page.keyboard.press('f');
  await frames(page, 2);
  const seated = await page.evaluate(() => { const a = window.__museum!; return { seated: a.player.isSeated, eye: a.player.eyePosition, p: a.player.position.toArray() }; });
  expect(seated.seated).toBe(true);
  expect(seated.p).toEqual(L.seat.position);
  expect(seated.eye[1]).toBeCloseTo(L.seat.position[1] + 1.12, 3);
  // Sitting opens the programme; it is keyboard-operable (focus on the first film).
  const panel = page.getByRole('dialog', { name: 'Programme' });
  await expect(panel).toBeVisible();
  await expect(page.locator('.cinema-film').first()).toBeFocused();
  expect(await page.locator('.cinema-film').count()).toBeGreaterThan(0);
  await page.keyboard.press('Tab');
  await expect(page.locator('.cinema-film').nth(1)).toBeFocused();
  // No audio, no autoplay: nothing has been requested yet.
  expect(media).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();

  // 7. The chosen local film decodes onto the screen: a video texture, muted, time advancing, pixels changed.
  await page.waitForFunction(() => window.__museum!.interiorWorld!.cinema!.playback.state === 'playing', null, { timeout: 30_000 });
  const t0 = await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.element!.currentTime);
  await page.waitForTimeout(700);
  await frames(page, 30, true);
  const playing = await page.evaluate(() => {
    const a = window.__museum!; const c = a.interiorWorld!.cinema!; const v = c.playback.element!;
    return { t: v.currentTime, muted: v.muted, volume: v.volume, w: v.videoWidth, h: v.videoHeight,
      onScreen: (a.museum!.cinema!.pictureMaterial.map as { isVideoTexture?: boolean } | null)?.isVideoTexture === true,
      house: c.houseLightLevel };
  });
  expect(playing.onScreen).toBe(true);
  expect(playing.muted).toBe(true);
  expect(playing.w).toBe(832);
  expect(playing.h).toBe(1504);
  expect(playing.t).toBeGreaterThan(t0);
  expect(playing.house).toBeLessThan(0.7);
  expect(media).toHaveLength(1);
  expect(media[0]).toMatch(/embedded\/full-weasel\/assets\/backgrounds\/grok_video_2026-02-08-15-25-49\.mp4/);
  const showing = await screenPixel(page, L.screenCenter);
  expect(Math.abs(showing[0] - idle[0]) + Math.abs(showing[1] - idle[1]) + Math.abs(showing[2] - idle[2])).toBeGreaterThan(30);

  // 8. Controls: keys while seated, and the real buttons. The film is 6 s
  // long and may already have ended; R restarts it, Space plays and pauses.
  const playbackState = () => page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.state);
  await page.keyboard.press('KeyR');
  if ((await playbackState()) !== 'playing') await page.keyboard.press('Space');
  await expect.poll(playbackState).toBe('playing');
  await page.keyboard.press('Space');
  await expect.poll(playbackState).toBe('paused');
  await page.keyboard.press('KeyR');
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.element!.currentTime)).toBe(0);
  await page.getByRole('button', { name: 'Forward 5 seconds (.)' }).click();
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.element!.currentTime)).toBeCloseTo(5, 1);
  await page.getByRole('button', { name: 'Play (Space)' }).click();
  await expect.poll(() => page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.state), { timeout: 15_000 }).toMatch(/playing|ended/);
  await expect(page.getByRole('button', { name: 'Captions (V)' })).toBeDisabled(); // this film has no captions, and says so
  await page.getByRole('button', { name: /^(Pause|Play) \(Space\)$/ }).click();

  // 6. Standing with a movement key returns the visitor exactly to where they stood; controls are theirs again.
  // Keys typed into a focused button belong to the button (museum-wide rule), so
  // the visitor returns to the view first, as clicking it does.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.down('w');
  await frames(page, 1);
  await page.keyboard.up('w');
  const stood = await page.evaluate(() => { const a = window.__museum!; return { seated: a.player.isSeated, p: a.player.position.toArray(), frozen: a.player.isFrozen }; });
  expect(stood.seated).toBe(false);
  expect(stood.frozen).toBe(false);
  expect(Math.hypot(stood.p[0] - standing[0], stood.p[2] - standing[2])).toBeLessThan(0.2);
  expect(await walkTo(page, [35 + 4 * 2.1 + 0.55, 0, 12.4])).toBe(true);

  // 10. Leaving by the exit loop ends the session: media element and texture released.
  await page.evaluate(() => window.__museum!.player.teleport([31.5, 10.6, 12.4], 0));
  for (const name of ['southAisleFront', 'exitInside', 'exitPassageSouth', 'exitPassageNorth', 'lightLock', 'lobbyTurn', 'lobby', 'threshold', 'balconyApproach']) {
    expect(await walkTo(page, L.points[name]), name).toBe(true);
  }
  const after = await page.evaluate(() => { const a = window.__museum!; const c = a.interiorWorld!.cinema!; return { zone: a.currentZone, state: c.playback.state, element: c.playback.hasMediaElement, map: a.museum!.cinema!.pictureMaterial.map === a.museum!.cinema!.idleTexture }; });
  expect(after).toEqual({ zone: 'balcony', state: 'empty', element: false, map: true });
  await expect(page.locator('.cinema-console')).toBeHidden();

  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('a film whose file is missing fails gracefully and says so', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/grok_video_2026-02-08-15-25-06.mp4', (route) => route.fulfill({ status: 404, body: '' }));
  await enterInterior(page);
  const L = await layout(page);
  await page.evaluate((p) => window.__museum!.player.teleport(p, Math.PI / 2), L.points.frontZone);
  await frames(page, 4);
  const ok = await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('full-weasel-loop-1'));
  expect(ok).toBe(false);
  const state = await page.evaluate(() => { const a = window.__museum!; const c = a.interiorWorld!.cinema!; return { state: c.playback.state, error: c.playback.snapshot().error, element: c.playback.hasMediaElement, idle: a.museum!.cinema!.pictureMaterial.map === a.museum!.cinema!.idleTexture }; });
  expect(state.state).toBe('error');
  expect(state.error).toMatch(/could not|missing|did not/);
  expect(state.element).toBe(false);
  expect(state.idle).toBe(true);
  await expect(page.locator('.cinema-console__status')).toContainText('Choose another from the programme');
  // The programme marks it, and another film still plays.
  await page.evaluate(() => window.__museum!.ui.openCinemaProgramme());
  await expect(page.locator('.cinema-film__unavailable')).toHaveCount(1);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('full-weasel-loop-3'))).toBe(true);
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test('house lights change at once and the marquee holds still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enterInterior(page);
    const L = await layout(page);
    await page.evaluate((p) => window.__museum!.player.teleport(p, Math.PI / 2), L.points.frontZone);
    await frames(page, 2);
    const bulbsBefore = await page.evaluate(() => Array.from(window.__museum!.museum!.cinema!.marqueeBulbs.instanceColor!.array.slice(0, 12)));
    expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('full-weasel-loop-2'))).toBe(true);
    await frames(page, 1);
    expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.houseLightLevel)).toBe(0);
    await frames(page, 60);
    const bulbsAfter = await page.evaluate(() => Array.from(window.__museum!.museum!.cinema!.marqueeBulbs.instanceColor!.array.slice(0, 12)));
    expect(bulbsAfter).toEqual(bulbsBefore);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: false });
  test('a touch visitor taps to sit, uses the on-screen controls and taps Stand up', async ({ page }) => {
    await enterInterior(page);
    const L = await layout(page);
    await page.evaluate((p) => { const a = window.__museum!; a.input.touchActive = true; a.player.teleport(p, -Math.PI / 2); a.player.pitch = -0.2; }, L.seat.aisleSide);
    await frames(page, 8, true);
    expect(await page.evaluate(() => window.__museum!.interaction.currentFocus?.label)).toMatch(/^Take seat/);
    // The museum's own touch path: a short tap at the centre of the view.
    await page.touchscreen.tap(640, 360);
    await frames(page, 2);
    expect(await page.evaluate(() => window.__museum!.player.isSeated)).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Programme' })).toBeVisible();
    await page.locator('.cinema-film').nth(2).tap();
    await page.waitForFunction(() => window.__museum!.interiorWorld!.cinema!.playback.state === 'playing', null, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Pause (Space)' }).tap();
    expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.playback.state)).toBe('paused');
    await page.getByRole('button', { name: /^Stand up/ }).tap();
    expect(await page.evaluate(() => window.__museum!.player.isSeated)).toBe(false);
  });
});

test('a visitor on a step-free bay can watch from there, at a lower eye height, facing the screen', async ({ page }) => {
  await enterInterior(page);
  const L = await layout(page);
  // Up the ramped north aisle to the rear platform, then onto the first marked bay.
  await page.evaluate((p) => window.__museum!.player.teleport(p, Math.PI / 2), L.points.insideEntry);
  await frames(page, 4);
  for (const p of [[33, 10.6, 1.45], L.points.northAisleTop, [55.2, 13.84, 4.2]] as P[]) expect(await walkTo(page, p)).toBe(true);
  await page.evaluate(() => { const a = window.__museum!; a.player.yaw = Math.PI / 2; a.player.pitch = 0; });
  await frames(page, 8, true);
  expect(await page.evaluate(() => window.__museum!.interaction.currentFocus?.label)).toBe('Watch from this step-free position');
  await page.keyboard.press('f');
  await frames(page, 2);
  const view = await page.evaluate(() => { const a = window.__museum!; return { seated: a.player.isSeated, eye: a.player.eyePosition[1] - a.player.position.y, seat: a.interiorWorld!.cinema!.seated }; });
  expect(view.seated).toBe(true);
  expect(view.eye).toBeCloseTo(1.22, 3);
  expect(view.seat).toMatch(/^Accessible viewing position/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyX');
  expect(await page.evaluate(() => window.__museum!.player.isSeated)).toBe(false);
});
