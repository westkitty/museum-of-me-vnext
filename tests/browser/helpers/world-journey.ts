import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Real-time, keyboard-driven visitor helpers for pocket-world journeys.
 *
 * The visitor is steered ONLY with the museum's own bindings while the real
 * application loop runs: Q/E turn, PageUp/PageDown pitch, W walks, Shift runs,
 * F interacts. The page is read (pose, focus, world snapshots) but never
 * written to during a journey; diagnostic placement is confined to
 * `placeInMuseum`, which is labelled as such.
 */

export interface Pose {
  x: number; y: number; z: number; yaw: number; pitch: number; grounded: boolean; world: string;
  /** Horizontal speed (m/s): read-only, used to decide when the visitor has stopped. */
  speed: number;
}

export const EVIDENCE_ROOT = 'test-results/world-production-20261126';

export function evidenceDir(world: string): string {
  const dir = `${EVIDENCE_ROOT}/${world}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

export async function bootPreview(page: Page, previews: string, extraQuery = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/?qa=1&preview=${previews}${extraQuery}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean(window.__museum && window.__worldPreviewRegistered), undefined, { timeout: 90_000 });
  await page.evaluate(() => {
    const app = window.__museum!;
    app.dismissArrival();
    app.ui.hud.completeArrival();
  });
  return errors;
}

export async function pose(page: Page): Promise<Pose> {
  return page.evaluate(() => {
    const app = window.__museum!;
    const p = app.player.position;
    const v = app.player.velocity;
    return {
      x: p.x, y: p.y, z: p.z, yaw: app.player.yaw, pitch: app.player.pitch, grounded: app.player.grounded,
      world: String(app.activeWorld), speed: Math.hypot(v.x, v.z),
    };
  });
}

/**
 * Deceleration once every movement key is released: the controller steers
 * velocity toward zero at ACCEL (34) and applies FRICTION (14) on top, so a
 * full 15.5 m/s run stops in about 2.5 m (PlayerController).
 */
const RELEASED_DECEL = 34 + 14;

/**
 * How far the visitor will still travel before the walker can react: the
 * distance covered until the next poll at the current speed, plus the stopping
 * slide. V7: the V6 walker ignored both, so on a loaded host a run reached the
 * target between polls and the visitor slid ~6 m past it (the "unexplained
 * 5.8 m displacement" in the V6 W01 aim miss).
 */
export function travelAhead(speed: number, pollSeconds: number): number {
  return speed * pollSeconds + (speed * speed) / (2 * RELEASED_DECEL);
}

/** Wait (with no input held) until the visitor has stopped, and return where they stand. */
export async function settle(page: Page, timeoutMs = 4_000): Promise<Pose> {
  const deadline = Date.now() + timeoutMs;
  let p = await pose(page);
  while (p.speed > 0.05 && Date.now() < deadline) {
    await page.waitForTimeout(50);
    p = await pose(page);
  }
  return p;
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const TURN_RATE = (110 * Math.PI) / 180; // KEYBOARD_LOOK_SPEED, rad/s

/**
 * Hold a key for `ms`. One timed press (down, wait, up inside the Playwright
 * driver), so the hold lasts as long as asked even when the test runner is
 * slow to send its next command (V7).
 */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.press(key, { delay: Math.max(16, Math.round(ms)) });
}

/** Turn (Q/E) until facing the given yaw. */
export async function turnTo(page: Page, yaw: number, tolerance = 0.06): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const p = await pose(page);
    const diff = wrap(yaw - p.yaw);
    if (Math.abs(diff) <= tolerance) return;
    // Q (lookLeft) increases yaw; E decreases it.
    await hold(page, diff > 0 ? 'q' : 'e', (Math.abs(diff) / TURN_RATE) * 1000 * 0.8);
  }
}

/** Pitch (PageUp/PageDown) until at the given pitch. */
export async function pitchTo(page: Page, pitch: number, tolerance = 0.05): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const p = await pose(page);
    const diff = pitch - p.pitch;
    if (Math.abs(diff) <= tolerance) return;
    await hold(page, diff > 0 ? 'PageUp' : 'PageDown', (Math.abs(diff) / TURN_RATE) * 1000 * 0.8);
  }
}

export interface WalkOptions { tolerance?: number; run?: boolean; timeoutMs?: number }

/**
 * Below this distance the walker stops holding W and closes in with timed
 * presses. A held W lasts at least one runner round trip, which on a starved
 * runner is metres of walking, so the last stretch is timed by the driver.
 */
const CLOSE_IN = 5;
const WALK_SPEED = 3.4; // PlayerController WALK_SPEED, m/s

/**
 * Walk in real time to (x, z), steering with Q/E and moving with W (+Shift).
 *
 * Like a visitor, the walker lets go before it gets there, allowing for its
 * own reaction time (the time since its last look) and the stopping slide. It
 * closes the last metres with short timed presses of W, waits until the
 * visitor has stopped, and only then reports arrival, from where the visitor
 * actually stands. V6 kept Shift+W held until a poll landed inside the
 * tolerance, so a slow poll could report arrival at full run and the visitor
 * slid on several metres (the V6 W01 aim miss).
 */
export async function walkTo(page: Page, x: number, z: number, opts: WalkOptions = {}): Promise<Pose> {
  const tolerance = opts.tolerance ?? 0.9;
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  let moving = false;
  let running = false;
  let lastPoll = Date.now();
  const release = async (): Promise<void> => {
    if (moving) { await page.keyboard.up('w'); moving = false; }
    if (running) { await page.keyboard.up('Shift'); running = false; }
  };
  try {
    while (Date.now() < deadline) {
      let p = await pose(page);
      const now = Date.now();
      const pollSeconds = Math.min(1, (now - lastPoll) / 1000);
      lastPoll = now;
      let dist = Math.hypot(x - p.x, z - p.z);
      const ahead = moving ? travelAhead(p.speed, pollSeconds) : 0;
      if (dist - ahead <= Math.max(tolerance, CLOSE_IN) || dist <= tolerance) {
        // Let go, stop, and look again from where the visitor really is.
        await release();
        p = await settle(page);
        lastPoll = Date.now();
        dist = Math.hypot(x - p.x, z - p.z);
        if (dist <= tolerance) return p;
      }
      const desired = Math.atan2(-(x - p.x), -(z - p.z));
      const diff = wrap(desired - p.yaw);
      if (Math.abs(diff) > 0.35) {
        if (moving) { await page.keyboard.up('w'); moving = false; }
        await turnTo(page, desired, 0.08);
        lastPoll = Date.now();
        continue;
      }
      if (Math.abs(diff) > 0.06) await hold(page, diff > 0 ? 'q' : 'e', (Math.abs(diff) / TURN_RATE) * 1000 * 0.7);
      if (!moving && dist <= CLOSE_IN) {
        // Close in: one press sized to the remaining distance (walking reaches
        // full speed in 0.1 s; the slide after release is ~0.1 m).
        const seconds = Math.min(1.6, Math.max(0.05, (dist - 0.1) / WALK_SPEED + 0.05));
        await page.keyboard.press('w', { delay: Math.round(seconds * 1000) });
        lastPoll = Date.now();
        continue;
      }
      const wantRun = Boolean(opts.run) && dist - ahead > 6;
      if (wantRun !== running) {
        if (wantRun) await page.keyboard.down('Shift'); else await page.keyboard.up('Shift');
        running = wantRun;
      }
      if (!moving) { await page.keyboard.down('w'); moving = true; }
      await page.waitForTimeout(dist > 4 ? 140 : 60);
    }
  } finally {
    await release();
  }
  const p = await pose(page);
  throw new Error(`walkTo(${x}, ${z}) timed out at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`);
}

export async function walkPath(page: Page, path: readonly (readonly [number, number])[], opts: WalkOptions = {}): Promise<Pose> {
  let last = await pose(page);
  for (const [x, z] of path) last = await walkTo(page, x, z, opts);
  return last;
}

export async function focusedId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.__museum!.interaction.currentFocus?.exhibitId ?? null);
}

/**
 * Aim the view at a world point using only Q/E and PageUp/PageDown, then wait
 * for the interaction ray to focus the expected control.
 */
const AIM_NUDGES: readonly (readonly [number, number])[] = [[0, 0], [0, -0.03], [0, 0.03], [-0.03, 0], [0.03, 0]];

export async function aimAt(page: Page, target: readonly [number, number, number], expectedId: string): Promise<void> {
  await settle(page);
  for (let attempt = 0; attempt < 8; attempt++) {
    const p = await pose(page);
    const eye = p.y + 1.6;
    const dx = target[0] - p.x;
    const dz = target[2] - p.z;
    // After three straight tries, nudge the view a little around the target, as a visitor would.
    const [yawNudge, pitchNudge] = AIM_NUDGES[Math.max(0, attempt - 3)] ?? [0, 0];
    await turnTo(page, Math.atan2(-dx, -dz) + yawNudge, 0.04);
    await pitchTo(page, Math.atan2(target[1] - eye, Math.hypot(dx, dz)) + pitchNudge, 0.04);
    await page.waitForTimeout(250);
    if (await focusedId(page) === expectedId) return;
  }
  const p = await pose(page);
  // Read-only context for an unexplained miss: where the camera really is and what the ray can see.
  const why = await page.evaluate(() => {
    const app = window.__museum! as unknown as {
      camera: { getWorldPosition(v: unknown): { x: number; y: number; z: number } };
      interaction: { currentFocus?: { exhibitId?: string } | null };
      player: { isFrozen: boolean };
      input: { uiCaptured: boolean };
    };
    const c = (app.camera as unknown as { position: { clone(): unknown } }).position.clone();
    const cam = app.camera.getWorldPosition(c);
    return `camera (${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}); world ${String(window.__museum!.activeWorld)}; `
      + `frozen ${app.player.isFrozen}; uiCaptured ${app.input.uiCaptured}; focus ${app.interaction.currentFocus?.exhibitId ?? 'none'}`;
  });
  expect(await focusedId(page), `aim at ${expectedId} from (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) `
    + `yaw ${p.yaw.toFixed(3)} pitch ${p.pitch.toFixed(3)}; ${why}`).toBe(expectedId);
}

export async function interact(page: Page): Promise<void> {
  await page.keyboard.press('f');
  await page.waitForTimeout(120);
}

/** Wait in real time until `snapshot[key] === expected` (the real loop advances the world). */
export async function waitForSnapshot<T = Record<string, unknown>>(page: Page, id: string, key: string, expected: unknown, timeoutMs = 30_000): Promise<T> {
  await page.waitForFunction(
    ([worldId, k, want]) => {
      const snap = window.__worldPreview?.[worldId]?.getSnapshot() as Record<string, unknown> | undefined;
      return Boolean(snap && snap[k as string] === want);
    },
    [id, key, expected] as const,
    { timeout: timeoutMs, polling: 100 },
  );
  return snapshot<T>(page, id);
}

export async function snapshot<T = Record<string, unknown>>(page: Page, id: string): Promise<T> {
  return page.evaluate((worldId) => window.__worldPreview![worldId].getSnapshot(), id) as Promise<T>;
}

/**
 * DIAGNOSTIC PLACEMENT (museum side only): put the visitor on a supported
 * approach pose near an entrance anchor. Used because walking across the
 * whole island to every anchor would dominate the suite; the in-world
 * journey after entry is fully input-driven.
 */
export async function placeInMuseum(page: Page, position: readonly [number, number, number], yaw: number, pitch = 0): Promise<void> {
  await page.evaluate(([p, y, pi]) => {
    const app = window.__museum!;
    app.player.restorePose(p as [number, number, number], y as number, pi as number);
  }, [position, yaw, pitch] as const);
  await page.waitForTimeout(300);
}

/** Activate the focused entrance anchor with F and confirm the entry dialog with Enter. */
export async function enterFromAnchor(page: Page, titlePattern: RegExp, pocketId: string): Promise<void> {
  await interact(page);
  const dialog = page.getByRole('dialog', { name: titlePattern });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Enter', exact: true }).press('Enter');
  await expect.poll(() => page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe(`pocket:${pocketId}`);
}

export async function persistentPassportRaw(page: Page): Promise<string | null> {
  // The live record only: Passport also keeps a backup (the previous state) and
  // a quarantine key, and localStorage key order is not defined.
  return page.evaluate(() => localStorage.getItem('museum-of-me:passport:v1'));
}

export interface SnapshotCondition { readonly key: string; readonly eq?: unknown; readonly gte?: number }

/** Wait in real time until every condition holds on the world snapshot (plain key comparisons only). */
export async function waitForSnapshotWhere<T = Record<string, unknown>>(page: Page, id: string, conditions: readonly SnapshotCondition[], timeoutMs = 60_000): Promise<T> {
  await page.waitForFunction(
    ([worldId, conds]) => {
      const snap = window.__worldPreview?.[worldId]?.getSnapshot() as Record<string, unknown> | undefined;
      if (!snap) return false;
      return conds.every((c) => ('eq' in c ? snap[c.key] === c.eq : true) && (c.gte === undefined || Number(snap[c.key]) >= c.gte));
    },
    [id, conditions] as const,
    { timeout: timeoutMs, polling: 50 },
  );
  return snapshot<T>(page, id);
}
