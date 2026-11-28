import type { Rect } from '../kit/worldKit';

/**
 * W04 Digital Beat World — topology and the visual beat clock.
 *
 * The rhythm is shown, never only heard: every beat is a light pulse, and no
 * step of the route depends on timing. -Z is north.
 */

export interface Landing extends Rect { readonly id: string; readonly y: number }

export const SPAWN: readonly [number, number, number] = [0, 0, 24];
export const FALL_RESET_Y = -6;
export const BPM = 96;
/** Seconds per beat; pulses stay well under three per second (no flashing). */
export const BEAT = 60 / BPM;

// ACT I — Mixer Plaza and the Sequencer Bridge.
export const PLAZA: Landing = { id: 'mixer-plaza', minX: -7, maxX: 7, minZ: 16, maxZ: 30, y: 0 };
export const BRIDGE: Rect = { minX: -1.5, maxX: 1.5, minZ: 0, maxZ: 16 };
export const BRIDGE_SEGMENTS = 8;
export const SEGMENT_LENGTH = 2;
export const SEGMENT_RISE_SECONDS = 0.7;
/** Four step pads along the plaza's west rail; pad i records segments 2i and 2i+1. */
export const PAD_POSITIONS: readonly (readonly [number, number, number])[] = [
  [-6, 0, 25], [-6, 0, 23.5], [-6, 0, 22], [-6, 0, 20.5],
];
export const PAD_STAND: readonly [number, number] = [-3.6, 22.75];

/** Segment k spans z from 16 - 2(k+1) to 16 - 2k (k = 0 meets the plaza). */
export function segmentRect(k: number): Rect {
  const maxZ = BRIDGE.maxZ - k * SEGMENT_LENGTH;
  return { minX: BRIDGE.minX, maxX: BRIDGE.maxX, minZ: maxZ - SEGMENT_LENGTH, maxZ };
}

// ACT II — the Deck and the EQ Stair.
export const DECK: Landing = { id: 'beat-deck', minX: -8, maxX: 8, minZ: -14, maxZ: 0, y: 0 };
export const BSIDE_ALCOVE: Landing = { id: 'b-side-alcove', minX: -14, maxX: -8, minZ: -10, maxZ: -4, y: 0 };
export const BSIDE_POS: readonly [number, number, number] = [-12.2, 0, -7];
export const EQ_CONSOLE_POS: readonly [number, number, number] = [5.2, 0, -10.5];
export const EQ_BARS = 12;
export const EQ_BAR_DEPTH = 1.2;
export const EQ_X: readonly [number, number] = [-2, 2];
export const EQ_SETTLE_SECONDS = 1.4;
export type EqPreset = 'flat' | 'wave' | 'rise';
export const EQ_PRESETS: readonly EqPreset[] = ['flat', 'wave', 'rise'];

/** Bar i spans z from -14 - 1.2(i+1) to -14 - 1.2i. */
export function eqBarRect(i: number): Rect {
  const maxZ = DECK.minZ - i * EQ_BAR_DEPTH;
  return { minX: EQ_X[0], maxX: EQ_X[1], minZ: maxZ - EQ_BAR_DEPTH, maxZ };
}

/** Target height of bar i under a preset. Only `rise` climbs in 0.5 m steps to the mezzanine. */
export function eqTarget(preset: EqPreset, i: number): number {
  if (preset === 'flat') return 0;
  if (preset === 'rise') return (i + 1) * 0.5;
  return 1.5 + Math.sin(i * 0.9) * 1.4;
}

export const MEZZANINE: Landing = { id: 'mezzanine', minX: -8, maxX: 8, minZ: -40, maxZ: DECK.minZ - EQ_BARS * EQ_BAR_DEPTH, y: 6 };

// ACT III — the Stage and the Drop.
export const STAGE_RAMP = { minX: -3, maxX: 3, minZ: -52, maxZ: -40, axis: 'z' as const, yAtMin: 10, yAtMax: 6 };
export const STAGE: Landing = { id: 'stage', minX: -10, maxX: 10, minZ: -66, maxZ: -52, y: 10 };
export const MASTER_POS: readonly [number, number, number] = [0, 10, -60];
export const GATE_POS: readonly [number, number, number] = [7, 10, -55];
export const GATE_APPROACH: readonly [number, number] = [4.6, -55];

export const ROUTE_CHECKPOINTS: readonly Landing[] = [DECK, MEZZANINE, STAGE];

export const ROUTE = {
  toPads: [[0, 24], [PAD_STAND[0], PAD_STAND[1]]] as const,
  toBridge: [[0, 17]] as const,
  acrossBridge: [[0, 8], [0, -2]] as const,
  toConsole: [[3, -9]] as const,
  upStair: [[0, -13], [0, -28], [0, -31]] as const,
  toStage: [[0, -41], [0, -53], [0, -57.5]] as const,
  bside: [[-6, -7], [-10, -7]] as const,
} as const;

/** 0..1 smooth beat pulse (cosine, peaking on the beat). */
export function beatPulse(t: number): number {
  const phase = (t / BEAT) % 1;
  return 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
}
