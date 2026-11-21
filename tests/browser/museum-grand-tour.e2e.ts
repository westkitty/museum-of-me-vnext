import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * One continuous visit, with no teleport after the arrival: the real keyboard
 * forward key, PlayerController, collision, world seam and the guide's own
 * route network. From the pier the visitor takes a ticket at the kiosk (F),
 * walks through the obsidian sphere around its column into the atrium, visits
 * every exhibit (into each bay's visitor spot and back out), climbs to the
 * upper wings, enters the Dexter Sanctuary, leaves the museum and re-enters.
 * Writes test-results/traversal/grand-tour.json.
 */

test.setTimeout(30 * 60_000);

interface TourLeg { readonly label: string; readonly ok: boolean; readonly reason: string | null; readonly world: string; readonly at: number[] }

test('a visitor walks the whole museum in one continuous visit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?qa=1', { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum), null, { timeout: 60_000 });
  await page.evaluate(() => {
    const app = window.__museum!;
    app.stop();
    app.renderer.renderer.setPixelRatio(0.25);
    app.ticket = null; // take a real ticket at the kiosk
  });
  await page.keyboard.down('w');
  let report: { legs: TourLeg[]; metres: number; ticks: number; heldTicks: number; ticket: boolean; visited: string[]; reentered: boolean };
  try {
    report = await page.evaluate(async () => {
      const app = window.__museum!;
      const load = async (path: string) => import(/* @vite-ignore */ path);
      const layout = await load('/src/world/layout.ts');
      const routes = await load('/src/world/visitorRoute.ts');
      const passages = (await load('/src/world/passages.ts')).PASSAGES as Array<{ id: string; lanes: Array<{ path: number[][] }>; interaction?: number[] }>;
      const legs: TourLeg[] = [];
      let metres = 0;
      let ticks = 0;
      let heldTicks = 0;
      const tick = async () => {
        const before = [app.player.position.x, app.player.position.z];
        app.fixedUpdate(1 / 60);
        app.variableUpdate(1 / 60);
        ticks++;
        metres += Math.hypot(app.player.position.x - before[0], app.player.position.z - before[1]);
        if (ticks % 120 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      };
      const at = () => app.player.position.toArray().map((n: number) => Math.round(n * 100) / 100);
      const walk = async (label: string, target: number[], opts: { untilWorld?: string } = {}): Promise<boolean> => {
        let best = Infinity;
        let since = 0;
        for (let i = 0; i < 60 * 120; i++) {
          if (opts.untilWorld && app.activeWorld === opts.untilWorld) { legs.push({ label, ok: true, reason: null, world: app.activeWorld, at: at() }); return true; }
          const p = app.player.position;
          const dx = target[0] - p.x, dz = target[2] - p.z;
          const d = Math.hypot(dx, dz);
          if (!opts.untilWorld && d < 0.5) { legs.push({ label, ok: true, reason: null, world: app.activeWorld, at: at() }); return true; }
          app.player.yaw = opts.untilWorld ? (target[2] < p.z ? 0 : Math.PI) : Math.atan2(-dx, -dz);
          const prevZ = p.z;
          await tick();
          // Held at the seam doorway while the entrance prepares: count it and
          // give the real preparation real time (render flushes GPU prewarm).
          if (opts.untilWorld === 'interior' && Math.abs(app.player.position.z - prevZ) < 1e-4 && app.player.position.z <= layout.ENTRANCE_PORTAL_Z + 0.06) {
            heldTicks++;
            app.render(0);
            await new Promise<void>((resolve) => setTimeout(resolve, 16));
          }
          const remaining = opts.untilWorld ? Math.abs(target[2] - p.z) : d;
          if (remaining < best - 0.02) { best = remaining; since = 0; } else if (++since > 60 * 8 && !(opts.untilWorld && heldTicks)) {
            legs.push({ label, ok: false, reason: `stalled ${remaining.toFixed(2)} m short`, world: app.activeWorld, at: at() });
            return false;
          }
        }
        legs.push({ label, ok: false, reason: 'timed out', world: app.activeWorld, at: at() });
        return false;
      };
      const walkPath = async (label: string, path: number[][]) => {
        for (const [k, point] of path.entries()) if (!(await walk(`${label} [${k}]`, point))) return false;
        return true;
      };

      // ── Arrival: pier → kiosk → ticket ─────────────────────────────────────
      const kiosk = passages.find((p) => p.id === 'exterior:kiosk')!;
      await walkPath('pier to kiosk', [[0, 0, 170], kiosk.interaction!]);
      const k = layout.TICKET_KIOSK_POSITION;
      app.player.yaw = Math.atan2(-(k[0] - app.player.position.x), -(k[2] - app.player.position.z));
      app.player.pitch = -0.3;
      for (let i = 0; i < 6; i++) { app.render(0); await tick(); }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF', key: 'f' }));
      for (let i = 0; i < 6; i++) await tick();
      const ticket = Boolean(app.ticket);
      app.player.pitch = 0;

      // ── Through the sphere (west route) and across the seam ────────────────
      const west = passages.find((p) => p.id === 'exterior:sphere-west-route')!.lanes[1].path;
      await walkPath('sphere outer aperture', [[0, 0, 151], ...west]);
      await walk('seam into the atrium', [0, 0, 120], { untilWorld: 'interior' });
      await walk('atrium', [0, 0, 140]);

      // ── Every exhibit, in collection order, by the guide's own routes ──────
      const visited: string[] = [];
      const order = layout.PLACEMENTS.map((p: { exhibitId: string }) => p.exhibitId);
      for (const id of order) {
        const from = at();
        const route = routes.planVisitorRoute('interior', from, id, app.interiorWorld!.collision) as number[][];
        if (!route.length) { legs.push({ label: `route to ${id}`, ok: false, reason: 'no route', world: app.activeWorld, at: from }); continue; }
        if (!(await walkPath(`to ${id}`, route.slice(1)))) continue;
        const bay = passages.find((p) => p.id.endsWith(`:bay:${id}`))!;
        if (await walk(`${id} visitor spot`, bay.interaction!) && await walk(`${id} back to the hall`, route[route.length - 1])) visited.push(id);
      }

      // ── Dexter Sanctuary and back to the rotunda ───────────────────────────
      const sanctuary = passages.find((p) => p.id === 'interior:sanctuary-ramp')!.lanes[0].path;
      const toRotunda = routes.planVisitorRoute('interior', at(), 'E09', app.interiorWorld!.collision) as number[][];
      await walkPath('toward the rotunda', toRotunda.slice(1, 3));
      await walkPath('into the Sanctuary', sanctuary);
      await walkPath('out of the Sanctuary', [...sanctuary].reverse());

      // ── Leave the museum, then come back in ────────────────────────────────
      const exit = routes.planVisitorRoute('interior', at(), routes.MUSEUM_ENTRANCE_TARGET, app.interiorWorld!.collision) as number[][];
      await walkPath('to the atrium door', exit.slice(1));
      await walk('out through the seam', [0, 0, layout.ATRIUM_FRONT_Z + 10], { untilWorld: 'exterior' });
      await walk('outside the sphere doorway', [0, 0, 131]);
      await walk('back in through the seam', [0, 0, 120], { untilWorld: 'interior' });
      const reentered = app.activeWorld === 'interior';
      return { legs, metres: Math.round(metres), ticks, heldTicks, ticket, visited, reentered };
    });
  } finally {
    await page.keyboard.up('w');
  }
  mkdirSync('test-results/traversal', { recursive: true });
  writeFileSync('test-results/traversal/grand-tour.json', JSON.stringify(report, null, 2));
  const failed = report.legs.filter((leg) => !leg.ok);
  expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  expect(report.ticket).toBe(true);
  expect(report.visited).toHaveLength(35);
  expect(report.reentered).toBe(true);
  expect(errors).toEqual([]);
});
