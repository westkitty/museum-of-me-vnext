export type TimingMode = 'step' | 'timed';

export type PowerPresetId = 'balanced' | 'defense' | 'evac' | 'triage';

export type CrisisEnding =
  | 'NONE'
  | 'STATION_HELD_OUTER_VENTED'
  | 'CREW_EVACUATED_CORE_LOST'
  | 'CONTAINMENT_FAILURE';

export interface SubsystemPower {
  readonly shielding: number;
  readonly reactor: number;
  readonly lifeSupport: number;
  readonly evacBay: number;
}

export interface PowerPresetSpec {
  readonly id: PowerPresetId;
  readonly label: string;
  readonly allocation: SubsystemPower;
}

export interface StationCrisisState {
  readonly phase: 0 | 1 | 2 | 3;
  readonly secondsRemaining: 90 | 60 | 30 | 0;
  readonly timingMode: TimingMode;
  readonly preset: PowerPresetId;
  readonly outerBulkheadSealed: boolean;
  readonly hullIntegrity: number;
  readonly oxygenPct: number;
  readonly coreStability: number;
  readonly evacReadiness: number;
  readonly survivors: number;
  readonly ending: CrisisEnding;
  readonly lastEvent: string;
}

export const POWER_PRESETS: readonly PowerPresetSpec[] = [
  {
    id: 'balanced',
    label: 'Balanced [1/1/1/1]',
    allocation: { shielding: 1, reactor: 1, lifeSupport: 1, evacBay: 1 },
  },
  {
    id: 'defense',
    label: 'Shield & Core [2/2/0/0]',
    allocation: { shielding: 2, reactor: 2, lifeSupport: 0, evacBay: 0 },
  },
  {
    id: 'evac',
    label: 'Evac & O2 [0/0/2/2]',
    allocation: { shielding: 0, reactor: 0, lifeSupport: 2, evacBay: 2 },
  },
  {
    id: 'triage',
    label: 'Seal & Air [1/0/2/1]',
    allocation: { shielding: 1, reactor: 0, lifeSupport: 2, evacBay: 1 },
  },
] as const;

export function createInitialCrisisState(): StationCrisisState {
  return {
    phase: 0,
    secondsRemaining: 90,
    timingMode: 'step',
    preset: 'balanced',
    outerBulkheadSealed: false,
    hullIntegrity: 82,
    oxygenPct: 86,
    coreStability: 78,
    evacReadiness: 15,
    survivors: 12,
    ending: 'NONE',
    lastEvent: 'Micro-fracture detected in Outer Hab Ring. Allocate 4 power cells before T-60s.',
  };
}

export function presetFor(id: PowerPresetId): PowerPresetSpec {
  return POWER_PRESETS.find((p) => p.id === id) ?? POWER_PRESETS[0];
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function advanceCrisisPhase(state: StationCrisisState): StationCrisisState {
  if (state.ending !== 'NONE') return state;

  const alloc = presetFor(state.preset).allocation;
  const sealBonus = state.outerBulkheadSealed ? 16 : 0;
  const o2PenaltyFromSeal = state.outerBulkheadSealed ? 12 : 0;

  let hull = state.hullIntegrity - 28 + alloc.shielding * 14 + sealBonus * 0.5;
  let o2 = state.oxygenPct - 24 + alloc.lifeSupport * 14 - o2PenaltyFromSeal;
  let core = state.coreStability - 26 + alloc.reactor * 14;
  let evac = state.evacReadiness + alloc.evacBay * 18 + (alloc.evacBay >= 2 ? 8 : 0);

  hull = clampPct(hull);
  o2 = clampPct(o2);
  core = clampPct(core);
  evac = clampPct(evac);

  const nextPhase = (state.phase + 1) as 1 | 2 | 3;
  const nextSeconds = (nextPhase === 1 ? 60 : nextPhase === 2 ? 30 : 0) as 60 | 30 | 0;

  if (nextPhase < 3) {
    const phaseName = nextPhase === 1 ? 'Solar Flare Inbound (T-60s)' : 'Core Thermal Spike (T-30s)';
    return {
      ...state,
      phase: nextPhase,
      secondsRemaining: nextSeconds,
      hullIntegrity: hull,
      oxygenPct: o2,
      coreStability: core,
      evacReadiness: evac,
      lastEvent: `${phaseName}: Hull ${hull}%, O2 ${o2}%, Core ${core}%, Evac ${evac}%.`,
    };
  }

  // Phase 3 Resolution -> 3 distinct deterministic endings
  if (evac >= 85 && o2 >= 50 && (core < 45 || hull < 45 || !state.outerBulkheadSealed)) {
    return {
      ...state,
      phase: 3,
      secondsRemaining: 0,
      hullIntegrity: hull,
      oxygenPct: o2,
      coreStability: core,
      evacReadiness: evac,
      survivors: 12,
      ending: 'CREW_EVACUATED_CORE_LOST',
      lastEvent: 'All 12 crew launched clear in Evac Pod; unshielded station core scuttled.',
    };
  }

  if (hull >= 50 && core >= 48 && state.outerBulkheadSealed) {
    return {
      ...state,
      phase: 3,
      secondsRemaining: 0,
      hullIntegrity: hull,
      oxygenPct: o2,
      coreStability: core,
      evacReadiness: evac,
      survivors: o2 >= 35 ? 10 : 8,
      ending: 'STATION_HELD_OUTER_VENTED',
      lastEvent: 'Outer ring vented cleanly behind blast seal; reactor and central hub stabilized.',
    };
  }

  const partial = evac >= 60 ? 5 : o2 >= 30 ? 3 : 1;
  return {
    ...state,
    phase: 3,
    secondsRemaining: 0,
    hullIntegrity: hull,
    oxygenPct: o2,
    coreStability: core,
    evacReadiness: evac,
    survivors: partial,
    ending: 'CONTAINMENT_FAILURE',
    lastEvent: 'Underpowered containment buckled before seal/evac completion; emergency beacon only.',
  };
}

export function cyclePowerPreset(state: StationCrisisState): StationCrisisState {
  const idx = POWER_PRESETS.findIndex((p) => p.id === state.preset);
  const next = POWER_PRESETS[(idx + 1) % POWER_PRESETS.length];
  return {
    ...state,
    preset: next.id,
    lastEvent: `Power routed to ${next.label}.`,
  };
}
