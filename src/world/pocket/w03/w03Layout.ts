import { easeInOut, type Rect } from '../kit/worldKit';

/**
 * W03 Clockwork Sundial — route topology and the machine's schedule.
 *
 * Every moving support is a pure function of machine time `t` (seconds of
 * fixed-step simulation since entry), so visuals, colliders, forecasts and
 * tests all read the same deterministic clock. -Z is north.
 */

export interface Landing extends Rect { readonly id: string; readonly y: number }

export const SPAWN: readonly [number, number, number] = [0, 0, 30];
export const FALL_RESET_Y = -6;

// ACT I — Gnomon Plaza and the turnstile bridge.
export const PLAZA: Landing = { id: 'gnomon-plaza', minX: -8, maxX: 8, minZ: 22, maxZ: 34, y: 0 };
export const ARM_HUB: readonly [number, number] = [0, 13];
export const ARM_HALF_LENGTH = 9;
export const ARM_HALF_WIDTH = 1.8;
export const ARM_PERIOD = 17;
export const ARM_HOLD = 6;
export const ARM_TURN = 2.5;
export const FORECAST_GALLERY: Landing = { id: 'forecast-gallery', minX: -6, maxX: 6, minZ: -8, maxZ: 4, y: 0 };

// ACT II — piston lift, escapement shuttle, crown gear.
export const LIFT: Rect = { minX: 6, maxX: 10, minZ: -6, maxZ: -2 };
export const LIFT_TOP = 5;
export const LIFT_PERIOD = 16;
export const ESCAPEMENT_GALLERY: Landing = { id: 'escapement-gallery', minX: 10, maxX: 22, minZ: -10, maxZ: 2, y: 5 };
export const SHUTTLE_X: readonly [number, number] = [15, 19];
export const SHUTTLE_LENGTH = 4;
export const SHUTTLE_DOCK_A = -12; // centre z at the Escapement Gallery
export const SHUTTLE_DOCK_B = -26; // centre z at the Orrery Landing (spans -28..-24)
export const SHUTTLE_PERIOD = 20;
export const ORRERY_LANDING: Landing = { id: 'orrery-landing', minX: 10, maxX: 24, minZ: -44, maxZ: -28, y: 5 };
export const STAR_ALCOVE: Landing = { id: 'star-alcove', minX: 24, maxX: 30, minZ: -40, maxZ: -32, y: 5 };
export const GEAR_CENTER: readonly [number, number] = [17, -51];
export const GEAR_RADIUS = 8;
export const GEAR_SPEED = 0.18; // rad/s, continuous
export const CROWN_RAMP = { minX: -12, maxX: 9.5, minZ: -54, maxZ: -48, axis: 'x' as const, yAtMin: 12, yAtMax: 5 };

// ACT III — the Sundial Crown and the captive sunrise.
export const CROWN: Landing = { id: 'sundial-crown', minX: -26, maxX: -12, minZ: -60, maxZ: -42, y: 12 };
export const SUN_CAGE: readonly [number, number, number] = [-19, 12, -51];
export const LATCH_RADIUS = 4.6;
export const LATCH_ANGLES: readonly number[] = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6];
export const SUN_HAND_PERIOD = 18;
/** Half-width (radians) of the window in which the sun hand frees a latch. */
export const LATCH_WINDOW = 0.62;
export const SUN_GATE_POS: readonly [number, number, number] = [-24.2, 12, -45];

export const ROUTE_CHECKPOINTS: readonly Landing[] = [FORECAST_GALLERY, ESCAPEMENT_GALLERY, ORRERY_LANDING, CROWN];

function wrap(t: number, period: number): number {
  return ((t % period) + period) % period;
}

/** Turnstile arm angle (radians, monotonic). Aligned north–south whenever angle ≡ 0 (mod π). */
export function armAngle(t: number): number {
  const cycle = Math.floor(t / ARM_PERIOD);
  const p = wrap(t, ARM_PERIOD);
  const base = cycle * Math.PI;
  const half = ARM_HOLD + ARM_TURN; // 8.5
  if (p < ARM_HOLD) return base;
  if (p < half) return base + easeInOut((p - ARM_HOLD) / ARM_TURN) * (Math.PI / 2);
  if (p < half + ARM_HOLD) return base + Math.PI / 2;
  return base + Math.PI / 2 + easeInOut((p - half - ARM_HOLD) / ARM_TURN) * (Math.PI / 2);
}

export function armAligned(t: number): boolean {
  return wrap(t, ARM_PERIOD) < ARM_HOLD;
}

/** Seconds until the arm next aligns (0 while aligned). */
export function armSecondsToAlign(t: number): number {
  const p = wrap(t, ARM_PERIOD);
  return p < ARM_HOLD ? 0 : ARM_PERIOD - p;
}

export function liftY(t: number): number {
  const p = wrap(t, LIFT_PERIOD);
  if (p < 5) return 0;
  if (p < 8) return easeInOut((p - 5) / 3) * LIFT_TOP;
  if (p < 13) return LIFT_TOP;
  return (1 - easeInOut((p - 13) / 3)) * LIFT_TOP;
}

export function liftPhase(t: number): 'bottom' | 'rising' | 'top' | 'falling' {
  const p = wrap(t, LIFT_PERIOD);
  return p < 5 ? 'bottom' : p < 8 ? 'rising' : p < 13 ? 'top' : 'falling';
}

export function shuttleZ(t: number): number {
  const p = wrap(t, SHUTTLE_PERIOD);
  if (p < 6) return SHUTTLE_DOCK_A;
  if (p < 10) return SHUTTLE_DOCK_A + (SHUTTLE_DOCK_B - SHUTTLE_DOCK_A) * easeInOut((p - 6) / 4);
  if (p < 16) return SHUTTLE_DOCK_B;
  return SHUTTLE_DOCK_B + (SHUTTLE_DOCK_A - SHUTTLE_DOCK_B) * easeInOut((p - 16) / 4);
}

export function shuttleDock(t: number): 'A' | 'B' | null {
  const p = wrap(t, SHUTTLE_PERIOD);
  return p < 6 ? 'A' : p >= 10 && p < 16 ? 'B' : null;
}

export function gearAngle(t: number): number {
  return t * GEAR_SPEED;
}

/** Sun hand bearing (radians) sweeping the crown once per SUN_HAND_PERIOD. */
export function sunHandAngle(t: number): number {
  return (wrap(t, SUN_HAND_PERIOD) / SUN_HAND_PERIOD) * Math.PI * 2;
}

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function latchOpen(t: number, index: number): boolean {
  return angleDiff(sunHandAngle(t), LATCH_ANGLES[index]) <= LATCH_WINDOW;
}

/** True during the two seconds before a latch's window opens (amber forecast). */
export function latchSoon(t: number, index: number): boolean {
  return !latchOpen(t, index) && latchOpen(t + 2, index);
}

export function latchPosition(index: number): [number, number, number] {
  const a = LATCH_ANGLES[index];
  return [SUN_CAGE[0] + Math.cos(a) * LATCH_RADIUS, CROWN.y, SUN_CAGE[2] + Math.sin(a) * LATCH_RADIUS];
}

/** Walkable waypoints of the main route; each crossing waits at a safe zone first. */
export const ROUTE = {
  toArm: [[0, 30], [0, 23]] as const,
  acrossArm: [[0, 13], [0, 3]] as const,
  toLift: [[0, -4], [5, -4]] as const,
  ontoLift: [[8, -4]] as const,
  offLift: [[12, -4], [17, -8]] as const,
  ontoShuttle: [[17, -12]] as const,
  offShuttle: [[17, -30], [17, -40]] as const,
  ontoGearAndRamp: [[17, -44.5], [11, -50.5], [8, -51], [-11, -51]] as const,
  toCage: [[-15, -51]] as const,
} as const;

/** Seconds left in the current safe window of each crossing (0 when closed). */
export function armWindowLeft(t: number): number {
  const p = wrap(t, ARM_PERIOD);
  return p < ARM_HOLD ? ARM_HOLD - p : 0;
}

export function liftWindowLeft(t: number): number {
  const p = wrap(t, LIFT_PERIOD);
  return p < 5 ? 5 - p : p >= 8 && p < 13 ? 13 - p : 0;
}

export function shuttleWindowLeft(t: number): number {
  const p = wrap(t, SHUTTLE_PERIOD);
  return p < 6 ? 6 - p : p >= 10 && p < 16 ? 16 - p : 0;
}

/** Where a visitor stands to work each latch: two metres outward from it. */
export function latchApproach(index: number): [number, number] {
  const a = LATCH_ANGLES[index];
  return [SUN_CAGE[0] + Math.cos(a) * (LATCH_RADIUS + 2), SUN_CAGE[2] + Math.sin(a) * (LATCH_RADIUS + 2)];
}

/** Latch visiting order and the walk between them, clear of the cage and pedestals. */
export const LATCH_ROUTE: readonly { readonly via: readonly (readonly [number, number])[]; readonly latch: number }[] = [
  { via: [[-13.29, -54.3]], latch: 2 },
  { via: [[-14, -46], [-19, -44.4]], latch: 0 },
  { via: [[-24, -46], [-24.71, -54.3]], latch: 1 },
];
export const GATE_APPROACH: readonly [number, number] = [-22.5, -47.0];
export const STAR_CHART_POS: readonly [number, number, number] = [28.2, 5, -36];
export const ORRERY_POS: readonly [number, number, number] = [12.8, 5, -37];
