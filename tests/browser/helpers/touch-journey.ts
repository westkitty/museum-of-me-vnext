import { expect, type CDPSession, type Page } from '@playwright/test';
import { focusedId, pose, settle, travelAhead, type Pose, type WalkOptions } from './world-journey';

/**
 * Real-time, touch-driven visitor helpers for pocket-world journeys.
 *
 * The visitor uses ONLY the museum's visitor-facing touch controls, delivered
 * as browser touch events (CDP Input.dispatchTouchEvent): the left half of the
 * screen is the movement stick, a drag on the right half looks, and a short
 * single-finger tap on the centre dot interacts. Dialog buttons are tapped.
 * The page is read (pose, focus) but never written to. This is browser-emulated
 * touch, not physical-device acceptance.
 */

interface Point { x: number; y: number; id: number }

/** Small view nudges (yaw, pitch) tried when a straight aim does not focus the control. */
export const AIM_NUDGES: readonly (readonly [number, number])[] = [[0, 0], [0, -0.03], [0, 0.03], [-0.03, 0], [0.03, 0]];

const STICK_RADIUS = 70; // Input.ts onTouchMove
/** Below this distance the touch walker closes in with short pushes. */
const TOUCH_CLOSE_IN = 1.5;
const STICK_ID = 1;
const LOOK_ID = 2;
const TAP_ID = 3;

function wrap(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class TouchVisitor {
  private readonly active = new Map<number, Point>();
  private yawPerPx = 0;
  private pitchPerPx = 0;

  private constructor(private readonly page: Page, private readonly cdp: CDPSession) {}

  static async attach(page: Page): Promise<TouchVisitor> {
    const visitor = new TouchVisitor(page, await page.context().newCDPSession(page));
    await visitor.calibrate();
    return visitor;
  }

  private get size(): { w: number; h: number } {
    const v = this.page.viewportSize();
    if (!v) throw new Error('touch journeys need a fixed viewport');
    return { w: v.width, h: v.height };
  }

  /** Send the full set of active fingers; a finger left out is released (CDP semantics). */
  private async send(type: 'touchStart' | 'touchMove' | 'touchEnd'): Promise<void> {
    const touchPoints = [...this.active.values()].map((p) => ({ x: p.x, y: p.y, id: p.id }));
    await this.cdp.send('Input.dispatchTouchEvent', { type: touchPoints.length ? type : 'touchEnd', touchPoints });
  }

  private async down(p: Point): Promise<void> { this.active.set(p.id, p); await this.send('touchStart'); }
  private async moveTo(id: number, x: number, y: number): Promise<void> {
    const p = this.active.get(id); if (!p) return;
    p.x = x; p.y = y; await this.send('touchMove');
  }
  private async up(id: number): Promise<void> {
    if (!this.active.delete(id)) return;
    await this.send(this.active.size ? 'touchMove' : 'touchEnd');
  }

  /** One look drag on the right half of the screen, in small steps. */
  async look(dx: number, dy: number): Promise<void> {
    const { w, h } = this.size;
    const x0 = w * 0.78; const y0 = h * 0.45;
    await this.down({ id: LOOK_ID, x: x0, y: y0 });
    const steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) / 12));
    for (let i = 1; i <= steps; i++) {
      await this.moveTo(LOOK_ID, x0 + (dx * i) / steps, y0 + (dy * i) / steps);
      await this.page.waitForTimeout(16);
    }
    await this.up(LOOK_ID);
    await this.page.waitForTimeout(50);
  }

  /** Measure how far one pixel of drag turns the view (it follows the visitor's sensitivity setting). */
  private async calibrate(): Promise<void> {
    const before = await pose(this.page);
    await this.look(60, 0); await this.look(-60, 0);
    await this.look(60, 0);
    const mid = await pose(this.page);
    await this.look(-60, 0);
    this.yawPerPx = wrap(mid.yaw - before.yaw) / 60;
    const p0 = await pose(this.page);
    await this.look(0, 30);
    const p1 = await pose(this.page);
    await this.look(0, -30);
    this.pitchPerPx = (p1.pitch - p0.pitch) / 30;
    expect(Math.abs(this.yawPerPx), 'touch look drag must turn the view').toBeGreaterThan(1e-4);
    expect(Math.abs(this.pitchPerPx), 'touch look drag must pitch the view').toBeGreaterThan(1e-4);
  }

  async turnTo(yaw: number, tolerance = 0.06): Promise<void> {
    for (let i = 0; i < 30; i++) {
      const diff = wrap(yaw - (await pose(this.page)).yaw);
      if (Math.abs(diff) <= tolerance) return;
      await this.look(Math.max(-220, Math.min(220, diff / this.yawPerPx)), 0);
    }
  }

  async pitchTo(pitch: number, tolerance = 0.05): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const diff = pitch - (await pose(this.page)).pitch;
      if (Math.abs(diff) <= tolerance) return;
      await this.look(0, Math.max(-160, Math.min(160, diff / this.pitchPerPx)));
    }
  }

  private async stick(forward: number): Promise<void> {
    const { w, h } = this.size;
    const x0 = w * 0.2; const y0 = h * 0.7;
    if (!this.active.has(STICK_ID)) {
      await this.down({ id: STICK_ID, x: x0, y: y0 });
      await this.page.waitForTimeout(16);
    }
    await this.moveTo(STICK_ID, x0, y0 - forward * STICK_RADIUS);
  }

  private async release(): Promise<void> { await this.up(STICK_ID); }

  /** Hold the stick fully forward (glides, charges) or let go. */
  async holdForward(on: boolean): Promise<void> {
    if (on) await this.stick(1); else await this.release();
  }

  async walkPath(path: readonly (readonly [number, number])[], opts: WalkOptions = {}): Promise<Pose> {
    let last = await pose(this.page);
    for (const [x, z] of path) last = await this.walkTo(x, z, opts);
    return last;
  }

  /** Tap a visible button by its accessible name (a finger, not a click). */
  async tapButton(name: string | RegExp): Promise<void> {
    await this.release();
    const box = await this.page.getByRole('button', { name, exact: typeof name === 'string' }).boundingBox();
    if (!box) throw new Error(`button ${String(name)} has no layout box`);
    await this.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  /**
   * Walk in real time to (x, z): the stick pushes forward, right-half drags
   * steer. Touch has no run (the stick tops out at walking speed). As with the
   * keyboard walker, the finger lifts before arrival (allowing for reaction
   * time and the slide), the last metres are short timed pushes, and arrival
   * is checked once the visitor has stopped, where they actually stand.
   *
   * On a moving support (W03's crown gear, W08's drift pad) the visitor keeps
   * drifting with no input held, so stop-and-check never converges: each
   * settle loses more than a short push gains. When the walker sees that drift
   * it pushes continuously instead and checks arrival while walking (as the V6
   * walker did; a touch walk stops within ~0.1 m of release).
   */
  async walkTo(x: number, z: number, opts: WalkOptions = {}): Promise<Pose> {
    const tolerance = opts.tolerance ?? 0.9;
    const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
    let lastPoll = Date.now();
    let carried = false;
    try {
      while (Date.now() < deadline) {
        let p = await pose(this.page);
        const now = Date.now();
        const pushing = this.active.has(STICK_ID);
        const ahead = pushing ? travelAhead(p.speed, Math.min(1, (now - lastPoll) / 1000)) : 0;
        lastPoll = now;
        let dist = Math.hypot(x - p.x, z - p.z);
        if (carried) {
          if (dist <= tolerance) { await this.release(); return pose(this.page); }
        } else if (dist - ahead <= Math.max(tolerance, TOUCH_CLOSE_IN) || dist <= tolerance) {
          await this.release();
          p = await settle(this.page);
          dist = Math.hypot(x - p.x, z - p.z);
          if (dist <= tolerance) return p;
          // Standing still with no input: does the ground carry the visitor?
          await this.page.waitForTimeout(150);
          const q = await pose(this.page);
          carried = Math.hypot(q.x - p.x, q.z - p.z) > 0.08;
          p = q; dist = Math.hypot(x - p.x, z - p.z);
          lastPoll = Date.now();
        }
        const dx = x - p.x; const dz = z - p.z;
        const diff = wrap(Math.atan2(-dx, -dz) - p.yaw);
        // On a moving support, stopping to turn hands ground back to the carrier
        // (W03's gear carried the visitor ~1 m per 1.3 s turn): steer while
        // walking instead, and stop to turn only when facing well away.
        if (Math.abs(diff) > (carried ? 1.2 : 0.35)) { await this.release(); await this.turnTo(Math.atan2(-dx, -dz), 0.08); lastPoll = Date.now(); continue; }
        if (Math.abs(diff) > 0.06) await this.look(diff / this.yawPerPx * 0.8, 0);
        if (!carried && !this.active.has(STICK_ID) && dist <= TOUCH_CLOSE_IN) {
          // A short push. Any stick deflection walks at full walking speed
          // (PlayerController normalizes the intent), so the push is timed.
          await this.stick(0.45);
          await this.page.waitForTimeout(Math.round(Math.min(0.8, Math.max(0.06, (dist - 0.1) / 3.4 + 0.05)) * 1000));
          await this.release();
          lastPoll = Date.now();
          continue;
        }
        await this.stick(opts.run && dist > 6 ? 1 : dist > 3 ? 0.75 : 0.45);
        await this.page.waitForTimeout(dist > 4 ? 140 : 60);
      }
    } finally {
      await this.release();
    }
    const p = await pose(this.page);
    throw new Error(`touch walkTo(${x}, ${z}) timed out at ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`);
  }

  async aimAt(target: readonly [number, number, number], expectedId: string): Promise<void> {
    await this.release();
    await settle(this.page);
    for (let attempt = 0; attempt < 8; attempt++) {
      const p = await pose(this.page);
      const dx = target[0] - p.x; const dz = target[2] - p.z;
      // After three straight tries, nudge the view a little around the target, as a visitor would.
      const [yawNudge, pitchNudge] = AIM_NUDGES[Math.max(0, attempt - 3)] ?? [0, 0];
      await this.turnTo(Math.atan2(-dx, -dz) + yawNudge, 0.02);
      await this.pitchTo(Math.atan2(target[1] - (p.y + 1.6), Math.hypot(dx, dz)) + pitchNudge, 0.02);
      await this.page.waitForTimeout(250);
      if (await focusedId(this.page) === expectedId) return;
    }
    const p = await pose(this.page);
    const dx = target[0] - p.x; const dz = target[2] - p.z;
    expect(await focusedId(this.page), `touch aim at ${expectedId} from (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) `
      + `yaw ${p.yaw.toFixed(3)}/${Math.atan2(-dx, -dz).toFixed(3)} pitch ${p.pitch.toFixed(3)}/${Math.atan2(target[1] - (p.y + 1.6), Math.hypot(dx, dz)).toFixed(3)}`)
      .toBe(expectedId);
  }

  /** A short single-finger tap on the centre dot. */
  async interact(): Promise<void> {
    await this.release();
    const { w, h } = this.size;
    await this.down({ id: TAP_ID, x: w / 2, y: h / 2 });
    await this.page.waitForTimeout(60);
    await this.up(TAP_ID);
    await this.page.waitForTimeout(150);
  }

  /** Tap the centre on the focused entrance, then tap the dialog's Enter button. */
  async enterFromAnchor(titlePattern: RegExp, pocketId: string): Promise<void> {
    await this.interact();
    const dialog = this.page.getByRole('dialog', { name: titlePattern });
    await expect(dialog).toBeVisible();
    const box = await dialog.getByRole('button', { name: 'Enter', exact: true }).boundingBox();
    if (!box) throw new Error('entry dialog Enter button has no layout box');
    await this.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => this.page.evaluate(() => window.__museum!.activeWorld), { timeout: 30_000 }).toBe(`pocket:${pocketId}`);
  }
}
