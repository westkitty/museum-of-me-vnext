export type EmphasisTarget = 'balanced' | 'frameA' | 'frameB';

export type PinnedObservationId = 'all' | 'obs_flow' | 'obs_seal' | 'obs_bypass';

export type RhetoricalMove = 'evidence' | 'interpretation' | 'framing' | 'inference' | 'unsupported';

export interface ImmutableObservation {
  readonly id: Exclude<PinnedObservationId, 'all'>;
  readonly timestamp: string;
  readonly metric: string;
  readonly moveA: RhetoricalMove;
  readonly framingA: string;
  readonly moveB: RhetoricalMove;
  readonly framingB: string;
}

export interface FramingState {
  readonly observations: readonly ImmutableObservation[];
  readonly emphasis: EmphasisTarget;
  readonly pinned: PinnedObservationId;
  readonly inferencesStripped: boolean;
  readonly dissolvedToSource: boolean;
  readonly lastAction: string;
}

/**
 * Fictional harbor sensor log shared identically by both framing architectures
 * (honoring P062 span classification without real-world articles or truth scores).
 */
export const SHARED_OBSERVATIONS: readonly ImmutableObservation[] = [
  {
    id: 'obs_flow',
    timestamp: '08:00',
    metric: 'Valve Flow 420 L/s',
    moveA: 'evidence',
    framingA: 'Nominal intake baseline',
    moveB: 'interpretation',
    framingB: 'Early surge warning ignored',
  },
  {
    id: 'obs_seal',
    timestamp: '08:04',
    metric: 'Gasket -11%',
    moveA: 'framing',
    framingA: 'Minor pressure variance',
    moveB: 'interpretation',
    framingB: 'Confirmed seal fatigue',
  },
  {
    id: 'obs_bypass',
    timestamp: '08:09',
    metric: 'Manual Bypass',
    moveA: 'framing',
    framingA: 'Prompt save before surge',
    moveB: 'inference',
    framingB: 'Unlogged safety override',
  },
] as const;

export const FRAME_HEADLINES: Readonly<Record<EmphasisTarget, { readonly a: string; readonly b: string }>> = {
  balanced: {
    a: 'CITY A · PROMPT CREW SAVED CONDUIT',
    b: 'CITY B · WARNING OVERRIDDEN 08:09',
  },
  frameA: {
    a: 'CITY A · HEROIC BYPASS AVERTS FLOOD',
    b: 'CITY B · DELAYED LOGS RAISE DOUBT',
  },
  frameB: {
    a: 'CITY A · ROUTINE VALVE REROUTE',
    b: 'CITY B · BYPASS MASKS SEAL DROP',
  },
};

export function createInitialFramingState(): FramingState {
  return {
    observations: SHARED_OBSERVATIONS,
    emphasis: 'balanced',
    pinned: 'all',
    inferencesStripped: false,
    dissolvedToSource: false,
    lastAction: 'Twin rhetorical skylines standing atop identical 08:00-08:09 source strata.',
  };
}

export function cycleEmphasis(state: FramingState): FramingState {
  const order: readonly EmphasisTarget[] = ['balanced', 'frameA', 'frameB'];
  const next = order[(order.indexOf(state.emphasis) + 1) % order.length];
  return {
    ...state,
    emphasis: next,
    dissolvedToSource: false,
    lastAction: `Lens shifted to ${next.toUpperCase()} — framing colonnades re-elevated; evidence bedrock untouched.`,
  };
}

export function cyclePinnedObservation(state: FramingState): FramingState {
  const order: readonly PinnedObservationId[] = ['all', 'obs_flow', 'obs_seal', 'obs_bypass'];
  const next = order[(order.indexOf(state.pinned) + 1) % order.length];
  if (next === 'all') {
    return {
      ...state,
      pinned: next,
      lastAction: 'Swept InDEX lens across all 3 shared source rows (evidence vs framing spans).',
    };
  }
  const obs = SHARED_OBSERVATIONS.find((o) => o.id === next)!;
  return {
    ...state,
    pinned: next,
    lastAction: `${obs.timestamp} ${obs.metric} -> A[${obs.moveA}: ${obs.framingA}] vs B[${obs.moveB}: ${obs.framingB}].`,
  };
}

export function toggleStripInferences(state: FramingState): FramingState {
  const next = !state.inferencesStripped;
  return {
    ...state,
    inferencesStripped: next,
    lastAction: next
      ? 'Unsupported inference crowns stripped — neither city can anchor those spires to source logs.'
      : 'Unsupported inference spires restored above framing cornices.',
  };
}

export function toggleDissolveToSource(state: FramingState): FramingState {
  const next = !state.dissolvedToSource;
  return {
    ...state,
    dissolvedToSource: next,
    lastAction: next
      ? 'Both rhetorical frames dissolved cleanly down onto the shared 3-log bedrock.'
      : 'Rebuilt divergent City A & City B framing colonnades over shared bedrock.',
  };
}
