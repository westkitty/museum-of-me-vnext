export type ScoreDirectiveId = 'verse' | 'chorus' | 'bridge';

export type SteeringMode = 'loose' | 'strict_cues';

export interface LayerReading {
  readonly name: 'Foundation' | 'Motion' | 'Voice' | 'Air';
  readonly freqHz: number;
  readonly intended: number;
  readonly observed: number;
}

export interface OrchestraState {
  readonly directive: ScoreDirectiveId;
  readonly steering: SteeringMode;
  readonly takeNumber: number;
  readonly audioEnabled: boolean;
  readonly layers: readonly LayerReading[];
  readonly totalDrift: number;
  readonly lastNote: string;
}

interface DirectiveSpec {
  readonly id: ScoreDirectiveId;
  readonly label: string;
  readonly targets: readonly [number, number, number, number];
}

export const DIRECTIVES: readonly DirectiveSpec[] = [
  { id: 'verse', label: 'Sparse Verse [1/1/3/1]', targets: [1, 1, 3, 1] },
  { id: 'chorus', label: 'Driving Chorus [4/4/4/2]', targets: [4, 4, 4, 2] },
  { id: 'bridge', label: 'Vocal Bridge [0/1/4/3]', targets: [0, 1, 4, 3] },
] as const;

const LAYER_META = [
  { name: 'Foundation', freqHz: 110 },
  { name: 'Motion', freqHz: 164.81 },
  { name: 'Voice', freqHz: 261.63 },
  { name: 'Air', freqHz: 392.0 },
] as const;

// Deterministic model drift matrices across take seeds and raw vs bracket-cue prompting
const LOOSE_OFFSETS: readonly (readonly [number, number, number, number])[] = [
  [2, 2, -1, 2],
  [3, -1, -2, 3],
  [-1, 3, -1, 2],
  [2, 2, -2, 1],
];

const STRICT_OFFSETS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 0, 0],
  [0, 0, 0, 1],
  [1, 0, 0, 0],
  [0, 0, -1, 0],
];

function clampLevel(n: number): number {
  return Math.max(0, Math.min(4, n));
}

function buildLayers(directive: ScoreDirectiveId, steering: SteeringMode, takeNumber: number): {
  readonly layers: readonly LayerReading[];
  readonly totalDrift: number;
} {
  const spec = DIRECTIVES.find((d) => d.id === directive) ?? DIRECTIVES[0];
  const offsetSet = steering === 'loose' ? LOOSE_OFFSETS : STRICT_OFFSETS;
  const delta = offsetSet[(takeNumber - 1) % offsetSet.length];

  const layers: LayerReading[] = [];
  let totalDrift = 0;
  for (let i = 0; i < 4; i++) {
    const intended = spec.targets[i];
    const observed = clampLevel(intended + delta[i]);
    totalDrift += Math.abs(observed - intended);
    layers.push({
      name: LAYER_META[i].name,
      freqHz: LAYER_META[i].freqHz,
      intended,
      observed,
    });
  }
  return { layers, totalDrift };
}

export function createInitialOrchestraState(): OrchestraState {
  const computed = buildLayers('verse', 'loose', 1);
  return {
    directive: 'verse',
    steering: 'loose',
    takeNumber: 1,
    audioEnabled: false,
    layers: computed.layers,
    totalDrift: computed.totalDrift,
    lastNote: 'Take #1 (RAW PROMPT): Synthetic layers drifted from sparse verse directive (local WebAudio probe muted).',
  };
}

export function cycleDirective(state: OrchestraState): OrchestraState {
  const idx = DIRECTIVES.findIndex((d) => d.id === state.directive);
  const next = DIRECTIVES[(idx + 1) % DIRECTIVES.length];
  const computed = buildLayers(next.id, state.steering, state.takeNumber);
  return {
    ...state,
    directive: next.id,
    layers: computed.layers,
    totalDrift: computed.totalDrift,
    lastNote: `Target score changed to ${next.label}; total drift = ${computed.totalDrift}.`,
  };
}

export function toggleSteeringMode(state: OrchestraState): OrchestraState {
  const next: SteeringMode = state.steering === 'loose' ? 'strict_cues' : 'loose';
  const computed = buildLayers(state.directive, next, state.takeNumber);
  return {
    ...state,
    steering: next,
    layers: computed.layers,
    totalDrift: computed.totalDrift,
    lastNote:
      next === 'strict_cues'
        ? `Strict [Meta-Tag Cues] constrained drift down to ${computed.totalDrift}.`
        : `Reverted to unbracketed raw prompt (drift rose to ${computed.totalDrift}).`,
  };
}

export function generateNextTake(state: OrchestraState): OrchestraState {
  const nextTake = (state.takeNumber % 4) + 1;
  const computed = buildLayers(state.directive, state.steering, nextTake);
  return {
    ...state,
    takeNumber: nextTake,
    layers: computed.layers,
    totalDrift: computed.totalDrift,
    lastNote: `Auditioned Take #${nextTake} (${state.steering}): drift=${computed.totalDrift}.`,
  };
}
