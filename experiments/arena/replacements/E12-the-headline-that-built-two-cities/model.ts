export type EmphasisTarget = 'balanced' | 'frameA' | 'frameB';

export type PinnedObservationId = 'all' | 'obs_flow' | 'obs_seal' | 'obs_bypass';

export interface ImmutableObservation {
  readonly id: Exclude<PinnedObservationId, 'all'>;
  readonly timestamp: string;
  readonly metric: string;
}

export interface FramingState {
  readonly observations: readonly ImmutableObservation[];
  readonly emphasis: EmphasisTarget;
  readonly pinned: PinnedObservationId;
  readonly inferencesStripped: boolean;
  readonly dissolvedToSource: boolean;
  readonly lastAction: string;
}

export const SHARED_OBSERVATIONS: readonly ImmutableObservation[] = [
  { id: 'obs_flow', timestamp: '08:00', metric: 'Basin Valve Flow 420 L/s' },
  { id: 'obs_seal', timestamp: '08:04', metric: 'Gasket Pressure -11%' },
  { id: 'obs_bypass', timestamp: '08:09', metric: 'Manual Bypass Engaged' },
] as const;

export const FRAME_HEADLINES: Readonly<Record<EmphasisTarget, { readonly a: string; readonly b: string }>> = {
  balanced: {
    a: 'CITY A: PROMPT CREW BYPASS SAVED CONDUIT',
    b: 'CITY B: VALVE WARNING OVERRIDDEN AT 08:09',
  },
  frameA: {
    a: 'CITY A: HEROIC INTERVENTION AVERTS FLOOD',
    b: 'CITY B: DELAYED LOGS RAISE QUESTIONS',
  },
  frameB: {
    a: 'CITY A: ROUTINE VALVE REROUTE COMPLETED',
    b: 'CITY B: UNEXPLAINED BYPASS HIDES SEAL DROP',
  },
};

export function createInitialFramingState(): FramingState {
  return {
    observations: SHARED_OBSERVATIONS,
    emphasis: 'balanced',
    pinned: 'all',
    inferencesStripped: false,
    dissolvedToSource: false,
    lastAction: 'Dual civic narratives constructed atop identical 08:00-08:09 harbor telemetry.',
  };
}

export function cycleEmphasis(state: FramingState): FramingState {
  const order: readonly EmphasisTarget[] = ['balanced', 'frameA', 'frameB'];
  const next = order[(order.indexOf(state.emphasis) + 1) % order.length];
  return {
    ...state,
    emphasis: next,
    dissolvedToSource: false,
    lastAction: `Emphasis shifted to ${next.toUpperCase()} — headlines & tower elevation updated; source logs unchanged.`,
  };
}

export function cyclePinnedObservation(state: FramingState): FramingState {
  const order: readonly PinnedObservationId[] = ['all', 'obs_flow', 'obs_seal', 'obs_bypass'];
  const next = order[(order.indexOf(state.pinned) + 1) % order.length];
  return {
    ...state,
    pinned: next,
    lastAction: `Pinned shared source entry: ${next.toUpperCase()}.`,
  };
}

export function toggleStripInferences(state: FramingState): FramingState {
  const next = !state.inferencesStripped;
  return {
    ...state,
    inferencesStripped: next,
    lastAction: next
      ? 'Unsupported motive & blame spires stripped; only tethered observations remain.'
      : 'Unsupported inference spires restored on both opposing frames.',
  };
}

export function toggleDissolveToSource(state: FramingState): FramingState {
  const next = !state.dissolvedToSource;
  return {
    ...state,
    dissolvedToSource: next,
    lastAction: next
      ? 'Both divergent towers collapsed back to the single immutable 3-line observation ledger.'
      : 'Restored twin divergent narrative cities over the shared observation plinth.',
  };
}
