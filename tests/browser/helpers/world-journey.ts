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

export interface Pose { x: number; y: number; z: number; yaw: number; pitch: number; grounded: boolean; world: string }

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
    return { x: p.x, y: p.y, z: p.z, yaw: app.player.yaw, pitch: app.player.pitch, grounded: app.player.grounded, world: String(app.activeWorld) };
  });
}

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

const TURN_RATE = (110 * Math.PI) / 180; // KEYBOARD_LOOK_SPEED, rad/s

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(Math.max(16, Math.round(ms)));
  await page.keyboard.up(key);
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

/** Walk in real time to (x, z), steering with Q/E and moving with W (+Shift). */
export async function walkTo(page: Page, x: number, z: number, opts: WalkOptions = {}): Promise<Pose> {
  const tolerance = opts.tolerance ?? 0.9;
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  let moving = false;
  let running = false;
  try {
    while (Date.now() < deadline) {
      const p = await pose(page);
      const dx = x - p.x;
      const dz = z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= tolerance) return p;
      const desired = Math.atan2(-dx, -dz);
      const diff = wrap(desired - p.yaw);
      if (Math.abs(diff) > 0.35) {
        if (moving) { await page.keyboard.up('w'); moving = false; }
        await turnTo(page, desired, 0.08);
        continue;
      }
      if (Math.abs(diff) > 0.06) await hold(page, diff > 0 ? 'q' : 'e', (Math.abs(diff) / TURN_RATE) * 1000 * 0.7);
      const wantRun = Boolean(opts.run) && dist > 6;
      if (wantRun !== running) {
        if (wantRun) await page.keyboard.down('Shift'); else await page.keyboard.up('Shift');
        running = wantRun;
      }
      if (!moving) { await page.keyboard.down('w'); moving = true; }
      await page.waitForTimeout(dist > 4 ? 140 : 60);
    }
  } finally {
    if (moving) await page.keyboard.up('w');
    if (running) await page.keyboard.up('Shift');
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
  expect(await focusedId(page), `aim at ${expectedId} from (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) `
    + `yaw ${p.yaw.toFixed(3)} pitch ${p.pitch.toFixed(3)}`).toBe(expectedId);
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
