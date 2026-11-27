import type { PocketWorldContext } from '../types';
import { AIR_SPEED, GLIDE_SINK, HOVER, inUpdraft, LIFT_SPEED, type Updraft, UPDRAFTS } from './w06Layout';

/**
 * The wind. Runs after the player's own fixed step each tick and only ever
 * adjusts the player's velocity (or, under reduced motion, places a rider at
 * an updraft's hover height at once):
 *
 * - Inside an updraft column the visitor rises at LIFT_SPEED and settles to a
 *   hover level with the upper island, from which walking steers them off.
 * - With a seed parasol, any fall becomes a glide: descent is capped at
 *   GLIDE_SINK and horizontal drift at AIR_SPEED, so landings are slow and
 *   steerable. Without one, the visitor never leaves solid ground (the only
 *   launch lip is gated until a parasol is taken).
 */
export function buildWind(ctx: PocketWorldContext) {
  const { player } = ctx;
  let hasParasol = false;
  let current: Updraft | null = null;
  let rides = 0;

  const clampAir = () => {
    const v = player.velocity;
    const h = Math.hypot(v.x, v.z);
    if (h > AIR_SPEED) {
      v.x *= AIR_SPEED / h;
      v.z *= AIR_SPEED / h;
    }
  };

  return {
    get hasParasol() { return hasParasol; },
    get updraft() { return current?.id ?? null; },
    get rides() { return rides; },
    get gliding() { return hasParasol && !player.grounded && current === null; },
    takeParasol(): boolean {
      if (hasParasol) return false;
      hasParasol = true;
      return true;
    },
    fixedUpdate(reducedMotion: boolean): void {
      const p = player.position;
      const v = player.velocity;
      const u = UPDRAFTS.find((d) => inUpdraft(d, p.x, p.z, p.y)) ?? null;
      if (u && u !== current) rides++;
      current = u;
      if (u) {
        const target = u.top + HOVER;
        if (reducedMotion && p.y < target - 0.05) {
          player.shift(0, target - p.y, 0);
          v.y = 0;
        } else {
          // Rise at the lift speed, easing into a hover just above the top.
          v.y = Math.max(-1.5, Math.min(LIFT_SPEED, (target - p.y) * 3 + 0.25));
        }
        clampAir();
        return;
      }
      if (hasParasol && !player.grounded) {
        if (v.y < -GLIDE_SINK) v.y = -GLIDE_SINK;
        clampAir();
      }
    },
  };
}
