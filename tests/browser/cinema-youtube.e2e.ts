import { expect, test, type Page } from '@playwright/test';

/**
 * YouTube screenings in the real running museum (docs/MUSEUM_CINEMA_YOUTUBE_2026-11-21.md).
 *
 * YouTube's IFrame API script is replaced here by a LOCAL STUB (below) that
 * follows the official API's shape and shows a test card. These tests prove
 * the museum's side — privacy before consent, the consent step, the player
 * laid over the 3D screen, controls, fallbacks and cleanup — and prove
 * nothing about YouTube itself. Real-YouTube evidence comes from
 * tests/browser/youtube-live.capture.ts, which CI does not run.
 */

test.setTimeout(6 * 60_000);

type P = [number, number, number];
const YOUTUBE_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com|ggpht\.com)$/;

/** Stub of the official API: YT.Player replaces its element with an iframe showing a test card. */
function stubApi(errorCode: number | null): string {
  return `(() => {
    const STATES = { PLAYING: 1, PAUSED: 2, ENDED: 0 };
    class Player {
      constructor(element, options) {
        this.options = options; this.time = 0; this.muted = false; this.destroyed = false;
        const iframe = document.createElement('iframe');
        iframe.id = 'stub-youtube-player';
        iframe.setAttribute('srcdoc', '<body style="margin:0;background:repeating-linear-gradient(45deg,#ff3b3b 0 40px,#ffd23b 40px 80px)"><h1 style="font:bold 64px sans-serif;color:#000;text-align:center;margin-top:280px">STUB TEST CARD ' + options.videoId + '</h1></body>');
        iframe.style.width = '100%'; iframe.style.height = '100%';
        element.replaceWith(iframe); this.iframe = iframe;
        window.__stubPlayers = (window.__stubPlayers || 0) + 1;
        setTimeout(() => ${errorCode === null ? 'options.events.onReady({ target: this })' : `options.events.onError({ data: ${errorCode}, target: this })`}, 50);
      }
      playVideo() { this.state = STATES.PLAYING; this.options.events.onStateChange({ data: 1, target: this }); }
      pauseVideo() { this.state = STATES.PAUSED; this.options.events.onStateChange({ data: 2, target: this }); }
      seekTo(s) { this.time = s; }
      getCurrentTime() { return this.time; }
      getDuration() { return 51; }
      mute() { this.muted = true; } unMute() { this.muted = false; }
      destroy() { this.destroyed = true; this.iframe.remove(); window.__stubDestroyed = (window.__stubDestroyed || 0) + 1; }
      getIframe() { return this.iframe; }
      getVideoData() { return { title: 'the first dirt demo' }; }
    }
    window.YT = { Player, loaded: 1 };
    setTimeout(() => window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(), 0);
  })();`;
}

async function boot(page: Page, external: string[], errorCode: number | null = null): Promise<void> {
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (YOUTUBE_HOSTS.test(host)) external.push(r.url());
  });
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({ contentType: 'text/javascript', body: stubApi(errorCode) }));
  await page.route(/i\.ytimg\.com/, (route) => route.fulfill({ status: 204, body: '' }));
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

const frames = (page: Page, n: number) => page.evaluate(async (n) => {
  const a = window.__museum!;
  for (let i = 0; i < n; i++) { a.fixedUpdate(1 / 60); a.variableUpdate(1 / 60); a.render(1); if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0)); }
}, n);

async function sitInRowE(page: Page): Promise<void> {
  const seat = await page.evaluate(async () => {
    const load = async (path: string) => import(/* @vite-ignore */ path);
    return (await load('/src/world/cinemaLayout.ts')).CINEMA_SEATS[4 * 28 + 6] as { aisleSide: P };
  });
  await page.evaluate((p) => { const a = window.__museum!; a.player.teleport(p, -Math.PI / 2); a.player.pitch = -0.2; }, seat.aisleSide);
  await frames(page, 8);
  await page.keyboard.press('f');
  await frames(page, 2);
  expect(await page.evaluate(() => window.__museum!.player.isSeated)).toBe(true);
}

const playback = (page: Page) => page.evaluate(() => {
  const c = window.__museum!.interiorWorld!.cinema!;
  const s = c.playback.snapshot();
  return { state: s.state, provider: s.provider, error: s.error, watchUrl: s.watchUrl, time: s.currentTime, duration: s.duration, hasPlayer: c.playback.youtube.hasPlayer };
});

test('nothing is fetched from YouTube before the visitor accepts; the screening then plays on the cinema screen', async ({ page }) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page, external);
  await sitInRowE(page);
  const panel = page.getByRole('dialog', { name: 'Programme' });
  await expect(panel).toBeVisible();
  // The screening is listed with its source, no thumbnail fetched.
  const entry = page.locator('.cinema-film--external');
  await expect(entry).toContainText('the first dirt demo');
  await expect(entry).toContainText('YouTube · external, online only');
  await expect(page.locator('.cinema-film__poster--provider')).toHaveCount(1);
  // Keyboard to the screening, then the consent step.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  await expect(entry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Watch from YouTube?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Watch from YouTube' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Open on YouTube instead (new tab)' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=f6hUqtFVgD8');
  expect(external).toEqual([]);
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();

  // The official API (stubbed) loads only now, and the film starts muted.
  await expect.poll(() => playback(page).then((p) => p.state), { timeout: 20_000 }).toBe('playing');
  expect(external).toEqual(['https://www.youtube.com/iframe_api']);
  expect(await page.evaluate(() => (window as unknown as { __stubPlayers: number }).__stubPlayers)).toBe(1);
  await frames(page, 3);

  // The player is laid over the projected screen: its corners sit on the screen's projected corners.
  const fit = await page.evaluate(async () => {
    const load = async (path: string) => import(/* @vite-ignore */ path);
    const THREE = await load('/node_modules/.vite/deps/three.js');
    const a = window.__museum!;
    const c = a.interiorWorld!.cinema!;
    const picture = a.museum!.cinema!.picture;
    const rect = a.renderer.renderer.domElement.getBoundingClientRect();
    const expected = [[-0.5, 0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]].map(([u, v]) => {
      const p = new THREE.Vector3(u, v, 0).applyMatrix4(picture.matrixWorld).project(a.camera);
      return [rect.left + (p.x + 1) / 2 * rect.width, rect.top + (1 - p.y) / 2 * rect.height];
    });
    const frame = c.overlay!.frame.getBoundingClientRect();
    const iframe = document.getElementById('stub-youtube-player')!;
    return { shown: c.overlay!.isShown, expected, frame: [frame.left, frame.top, frame.right, frame.bottom], inFrame: c.overlay!.frame.contains(iframe), pointer: getComputedStyle(c.overlay!.frame).pointerEvents };
  });
  expect(fit.shown).toBe(true);
  expect(fit.inFrame).toBe(true);
  expect(fit.pointer).toBe('none'); // the museum keeps mouse look and keys
  const xs = fit.expected.map((p) => p[0]);
  const ys = fit.expected.map((p) => p[1]);
  expect(fit.frame[0]).toBeCloseTo(Math.min(...xs), 0);
  expect(fit.frame[1]).toBeCloseTo(Math.min(...ys), 0);
  expect(fit.frame[2]).toBeCloseTo(Math.max(...xs), 0);
  expect(fit.frame[3]).toBeCloseTo(Math.max(...ys), 0);
  await page.screenshot({ path: 'test-results/cinema-youtube-stub-seated.png' });

  // The cinema's own controls drive the provider's player.
  await page.keyboard.press('Space');
  await expect.poll(() => playback(page).then((p) => p.state)).toBe('paused');
  await page.getByRole('button', { name: 'Forward 5 seconds (.)' }).click();
  expect((await playback(page)).time).toBe(5);
  await page.getByRole('button', { name: 'Restart (R)' }).click();
  expect((await playback(page)).time).toBe(0);
  await expect(page.getByRole('button', { name: 'Sound' })).toBeVisible();
  await page.getByRole('button', { name: 'Play (Space)' }).click();
  await expect.poll(() => playback(page).then((p) => p.state)).toBe('playing');
  // YouTube's own controls only when the visitor asks for them.
  await page.getByRole('button', { name: /Use YouTube's own controls/ }).click();
  expect(await page.evaluate(() => getComputedStyle(window.__museum!.interiorWorld!.cinema!.overlay!.frame).pointerEvents)).toBe('auto');

  // Turning away from the screen hides the player; looking back shows it again.
  await page.evaluate(() => { const a = window.__museum!; a.player.yaw += Math.PI; });
  await frames(page, 2);
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.overlay!.isShown)).toBe(false);
  await page.evaluate(() => { const a = window.__museum!; a.player.yaw -= Math.PI; });
  await frames(page, 2);
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.overlay!.isShown)).toBe(true);

  // A local film replaces it: the YouTube player is destroyed.
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('full-weasel-loop-2'))).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __stubDestroyed: number }).__stubDestroyed)).toBe(1);
  expect(await page.locator('#stub-youtube-player').count()).toBe(0);
  expect((await playback(page)).provider).toBe('local');
  expect(errors).toEqual([]);
});

test('standing keeps the screening; leaving the cinema destroys the player and hides the layer', async ({ page }) => {
  const external: string[] = [];
  await boot(page, external);
  await page.evaluate(() => window.__museum!.ui.youtubeConsent.accept());
  for (let session = 0; session < 3; session++) {
    await sitInRowE(page);
    // Sitting with nothing chosen opens the programme; close it to watch.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Programme' })).toBeHidden();
    expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('youtube-the-first-dirt-demo'))).toBe(true);
    await frames(page, 2);
    await page.keyboard.press('KeyX');
    expect(await page.evaluate(() => window.__museum!.player.isSeated)).toBe(false);
    expect((await playback(page)).state).toBe('playing'); // existing semantics: standing keeps the film
    // Walk out of the cinema zone: the session ends.
    await page.evaluate(() => window.__museum!.player.teleport([13.5, 10, 0], -Math.PI / 2));
    await frames(page, 3);
    expect(await playback(page)).toMatchObject({ state: 'empty', hasPlayer: false });
    expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.overlay!.isShown)).toBe(false);
    await page.evaluate(() => window.__museum!.player.teleport([31.5, 10.6, 12.4], Math.PI / 2));
    await frames(page, 2);
  }
  expect(await page.evaluate(() => [(window as unknown as { __stubPlayers: number }).__stubPlayers, (window as unknown as { __stubDestroyed: number }).__stubDestroyed])).toEqual([3, 3]);
  expect(await page.locator('iframe').count()).toBe(0);
});

test('when YouTube refuses (error 150) the visitor gets the reason and "Watch on YouTube"; local films still play', async ({ page }) => {
  const external: string[] = [];
  await boot(page, external, 150);
  await page.evaluate(() => window.__museum!.ui.youtubeConsent.accept());
  await page.evaluate(() => window.__museum!.player.teleport([31.5, 10.6, 12.4], Math.PI / 2));
  await frames(page, 2);
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('youtube-the-first-dirt-demo'))).toBe(false);
  const failed = await playback(page);
  expect(failed.state).toBe('error');
  expect(failed.error).toMatch(/\(YouTube error 150\)/);
  expect(failed.watchUrl).toBe('https://www.youtube.com/watch?v=f6hUqtFVgD8');
  await expect(page.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=f6hUqtFVgD8');
  expect(await page.locator('iframe').count()).toBe(0);
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('full-weasel-loop-3'))).toBe(true);
});

test('offline (YouTube unreachable): the screening explains itself and the museum\'s own films are unaffected', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (YOUTUBE_HOSTS.test(new URL(r.url()).hostname)) external.push(r.url()); });
  await page.route(/youtube\.com|youtube-nocookie\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort('internetdisconnected'));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 90_000 });
  await page.evaluate(async () => {
    const a = window.__museum!;
    a.stop();
    await a.worldDirector.prepareInterior();
    for (let i = 0; i < 400 && !a.interiorWorld?.streaming.telemetry.prewarmReady; i++) { a.variableUpdate(1 / 60); a.render(0); await new Promise((r) => setTimeout(r, 40)); }
    await a.switchToInterior();
    a.ui.youtubeConsent.accept();
    a.player.teleport([31.5, 10.6, 12.4], Math.PI / 2);
  });
  await frames(page, 2);
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('youtube-the-first-dirt-demo'))).toBe(false);
  expect((await playback(page)).error).toMatch(/could not be loaded/);
  expect(await page.evaluate(() => window.__museum!.interiorWorld!.cinema!.choose('full-weasel-loop-1'))).toBe(true);
  expect((await playback(page)).provider).toBe('local');
});

test('curator: paste a link, edit, reorder, remove, keep across a reload — all labelled as this browser only', async ({ page }) => {
  const external: string[] = [];
  await boot(page, external);
  await page.evaluate(() => window.__museum!.ui.cinemaCurator.open());
  const panel = page.getByRole('dialog', { name: 'Add video' });
  await expect(panel).toBeVisible();
  await expect(page.getByLabel('Paste YouTube link')).toBeFocused();
  await expect(panel).toContainText('Drafts are kept in this browser only');
  await page.getByLabel('Paste YouTube link').fill('https://evil.example/watch?v=dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Add to Cinema' }).click();
  await expect(page.locator('#cinema-curator-message')).toContainText('Only YouTube links');
  await page.getByLabel('Paste YouTube link').fill('https://youtu.be/f6hUqtFVgD8');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cinema-curator-message')).toContainText('already in the published programme');
  await page.getByLabel('Paste YouTube link').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.keyboard.press('Enter');
  await page.getByLabel('Paste YouTube link').fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await page.keyboard.press('Enter');
  await expect(page.locator('.cinema-curator__item')).toHaveCount(2);
  await page.getByLabel('Title').first().fill('A curator title');
  await page.getByLabel('Title').first().press('Tab');
  await page.getByRole('button', { name: 'Move A curator title down' }).click();
  await expect(page.getByLabel('Title').nth(1)).toHaveValue('A curator title');
  expect(external).toEqual([]); // no preview loaded without asking
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 90_000 });
  const drafts = await page.evaluate(() => window.__museum!.ui.cinemaDrafts.list.map((d) => [d.title, (d.youtube as { titleSource: string }).titleSource]));
  expect(drafts).toEqual([['YouTube video M7lc1UVf-VE', 'provisional'], ['A curator title', 'curator']]);
  // Drafts appear in this browser's programme, marked; the published list is unchanged.
  await page.evaluate(() => window.__museum!.ui.openCinemaProgramme());
  await expect(page.locator('.cinema-film__draft')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__museum!.ui.cinemaCurator.open());
  await page.getByRole('button', { name: 'Remove A curator title' }).click();
  await expect(page.locator('.cinema-curator__item')).toHaveCount(1);
  // Production builds offer export/import; the development save route exists only on the dev server.
  await expect(page.getByRole('button', { name: 'Export programme file' })).toBeVisible();
});
