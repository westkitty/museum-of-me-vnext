export type TableMode = 'diorama' | 'cartridge';

export type OverlayLayerMode = 'off' | 'telemetry' | 'contours';

export interface PlatformNode {
  readonly index: number;
  readonly label: string;
  readonly x: number;
  readonly dioramaY: number;
  readonly cartridgeY: number;
  readonly requiresLeapFromPrev: boolean;
}

export interface CartridgeState {
  readonly mode: TableMode;
  readonly overlay: OverlayLayerMode;
  readonly runnerIndex: number;
  readonly leapsUsed: number;
  readonly clears: number;
  readonly slips: number;
  readonly goalReached: boolean;
  readonly lastAction: string;
}

export const COURSE_NODES: readonly PlatformNode[] = [
  { index: 0, label: 'West Pier', x: -2.0, dioramaY: 0.72, cartridgeY: 1.05, requiresLeapFromPrev: false },
  { index: 1, label: 'Coast Rail', x: -1.0, dioramaY: 0.78, cartridgeY: 1.4, requiresLeapFromPrev: false },
  { index: 2, label: 'Tidal Gap Ridge', x: 0.05, dioramaY: 0.9, cartridgeY: 2.05, requiresLeapFromPrev: true },
  { index: 3, label: 'High Bluff', x: 1.05, dioramaY: 0.84, cartridgeY: 1.7, requiresLeapFromPrev: false },
  { index: 4, label: 'East Lighthouse', x: 2.05, dioramaY: 0.96, cartridgeY: 2.35, requiresLeapFromPrev: true },
] as const;

export function createInitialCartridgeState(): CartridgeState {
  return {
    mode: 'diorama',
    overlay: 'off',
    runnerIndex: 0,
    leapsUsed: 0,
    clears: 0,
    slips: 0,
    goalReached: false,
    lastAction: 'Topographic diorama active (synthetic stage; P037 overlay idle).',
  };
}

export function toggleCartridgeMode(state: CartridgeState): CartridgeState {
  const next: TableMode = state.mode === 'diorama' ? 'cartridge' : 'diorama';
  return {
    ...state,
    mode: next,
    lastAction:
      next === 'cartridge'
        ? 'Relief extruded into playable 5-stage platformer cartridge.'
        : 'Cartridge collapsed cleanly back to coastal topographic diorama.',
  };
}

export function cycleOverlayMode(state: CartridgeState): CartridgeState {
  const order: readonly OverlayLayerMode[] = ['off', 'telemetry', 'contours'];
  const idx = order.indexOf(state.overlay);
  const next = order[(idx + 1) % order.length];
  return {
    ...state,
    overlay: next,
    lastAction:
      next === 'off'
        ? 'WESTCAT HUD overlay hidden.'
        : `WESTCAT ${next.toUpperCase()} overlay active (non-blocking click-through).`,
  };
}

export function moveRunnerStep(state: CartridgeState, jump: boolean): CartridgeState {
  if (state.mode === 'diorama') {
    const nextIdx = (state.runnerIndex + 1) % COURSE_NODES.length;
    return {
      ...state,
      runnerIndex: nextIdx,
      lastAction: `Surveyed landmark ${COURSE_NODES[nextIdx].label} on diorama.`,
    };
  }

  if (state.goalReached) {
    return {
      ...state,
      runnerIndex: 0,
      goalReached: false,
      lastAction: 'Looped back to West Pier for another cartridge run.',
    };
  }

  const nextIdx = state.runnerIndex + 1;
  if (nextIdx >= COURSE_NODES.length) {
    return state;
  }

  const targetNode = COURSE_NODES[nextIdx];
  if (targetNode.requiresLeapFromPrev && !jump) {
    return {
      ...state,
      runnerIndex: 0,
      slips: state.slips + 1,
      lastAction: `Channel gap before ${targetNode.label} requires Leap! Respawned at West Pier.`,
    };
  }

  const reachedGoal = nextIdx === COURSE_NODES.length - 1;
  return {
    ...state,
    runnerIndex: nextIdx,
    leapsUsed: state.leapsUsed + (jump ? 1 : 0),
    clears: state.clears + (reachedGoal ? 1 : 0),
    goalReached: reachedGoal,
    lastAction: reachedGoal
      ? `Reached ${targetNode.label}! Cartridge course cleared.`
      : `${jump ? 'Leapt' : 'Stepped'} onto ${targetNode.label} (${nextIdx + 1}/${COURSE_NODES.length}).`,
  };
}
