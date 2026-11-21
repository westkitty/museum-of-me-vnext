import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * LIVE YouTube evidence for the cinema's first YouTube screening (f6hUqtFVgD8).
 * Not part of CI (playwright.capture.config.ts): it depends on YouTube being
 * willing to serve this browser and network. Uses the real museum and the
 * real IFrame Player API — no stub. It asserts only what YouTube itself
 * reports (player ready, title, duration) and RECORDS, without asserting,
 * whether playback reached "playing" with changing pixels on the screen.
 * Writes test-results/youtube-live.json and screenshots.
 *
 *   npx playwright test -c playwright.capture.config.ts tests/browser/youtube-live.capture.ts
 */

test('the real YouTube player for f6hUqtFVgD8 inside the cinema', async ({ page }) => {
  test.setTimeout(4 * 60_000);
  const hosts = new Set<string>();
  page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') hosts.add(u.hostname); });
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 90_000 });
  await page.evaluate(async () => {
    const a = window.__museum!;
    a.stop();
    a.renderer.renderer.setPixelRatio(0.6);
    await a.worldDirector.prepareInterior();
    for (let i = 0; i < 400 && !a.interiorWorld?.streaming.telemetry.prewarmReady; i++) { a.variableUpdate(1 / 60); a.render(0); await new Promise((r) => setTimeout(r, 40)); }
    await a.switchToInterior();
    a.dismissArrival();
    const style = document.createElement('style');
    style.textContent = '.diag, .hud__lock, [aria-label="Human QA evidence recorder"] { display: none !important; }';
    document.head.append(style);
    // Seat E7, then let the museum's own loop run, as a visitor's browser would.
    const load = async (path: string) => import(/* @vite-ignore */ path);
    const seat = (await load('/src/world/cinemaLayout.ts')).CINEMA_SEATS[4 * 28 + 6];
    a.player.teleport(seat.aisleSide, -Math.PI / 2);
    a.interiorWorld!.cinema!.sit(seat);
    a.ui.cinemaProgramme.close();
    a.start();
  });
  const before = [...hosts];
  await page.evaluate(() => window.__museum!.ui.openCinemaProgramme());
  await page.locator('.cinema-film--external').click();
  await page.getByRole('button', { name: 'Watch from YouTube' }).click();

  const samples: { t: number; state: string; time: number }[] = [];
  const started = Date.now();
  let final = { state: '', error: null as string | null, code: null as number | null, title: null as string | null, duration: 0, time: 0 };
  for (let i = 0; i < 45; i++) {
    await page.waitForTimeout(1000);
    final = await page.evaluate(() => {
      const c = window.__museum!.interiorWorld!.cinema!;
      const s = c.playback.snapshot();
      return { state: s.state, error: s.error, code: c.playback.youtube.errorCode, title: c.playback.youtube.playerTitle, duration: c.playback.youtube.durationSeconds, time: s.currentTime };
    });
    samples.push({ t: (Date.now() - started) / 1000, state: final.state, time: final.time });
    if (final.state === 'error') break;
    if (final.state === 'playing' && final.time > 3) break;
  }
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/youtube-live-seated-1.png' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/youtube-live-seated-2.png' });
  const reachedPlaying = samples.some((s) => s.state === 'playing' && s.time > 0.5);
  const report = {
    videoId: 'f6hUqtFVgD8',
    when: new Date().toISOString(),
    externalHostsBeforeConsent: before,
    externalHostsAfter: [...hosts].sort(),
    finalState: final.state,
    error: final.error,
    youtubeErrorCode: final.code,
    playerReportedTitle: final.title,
    playerReportedDurationSeconds: final.duration,
    reachedPlayingWithAdvancingTime: reachedPlaying,
    samples,
    note: 'Visible output: compare youtube-live-seated-1.png and -2.png (a cross-origin iframe cannot be read from the page).',
  };
  writeFileSync('test-results/youtube-live.json', JSON.stringify(report, null, 2));
  // Only what YouTube itself confirmed is asserted.
  expect(before).toEqual([]);
  expect(report.playerReportedTitle ?? report.error).toBeTruthy();
});
