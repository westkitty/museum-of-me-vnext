export type TableMode = 'diorama' | 'cartridge';

/**
 * Real P037 lineage rule:
 * An always-on-top broadcast overlay starts as an input obstacle (`blocking`)
 * until explicitly switched to `click_through`, passing clicks cleanly through
 * while staying readable on top.
 */
export type OverlayLayerMode = 'off' | 'blocking' | 'click_through';

export interface PlatformNode {
  readonly index: number;
  readonly label: string;
  readonly geoNote: string;
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
  readonly misclicksBlocked: number;
  readonly pollClicks: number;
  readonly lastInputBlocked: boolean;
  readonly goalReached: boolean;
  readonly lastAction: string;
}

/**
 * Representative coastal stage inspired by P038 ("WestCat Goes East",
 * Vancouver Island geography + Cat character). Specific platform elevations
 * are synthetic stage bounds constrained by the coastal inlets shown.
 */
export const COURSE_NODES: readonly PlatformNode[] = [
  {
    index: 0,
    label: 'Island Timber Pier',
    geoNote: 'Sheltered timber jetty',
    x: -2.0,
    dioramaY: 0.58,
    cartridgeY: 0.98,
    requiresLeapFromPrev: false,
  },
  {
    index: 1,
    label: 'Harbour Rail Spur',
    geoNote: 'Coastal rail causeway',
    x: -1.0,
    dioramaY: 0.68,
    cartridgeY: 1.34,
    requiresLeapFromPrev: false,
  },
  {
    index: 2,
    label: 'Tidal Narrows Stack',
    geoNote: 'Cut by tidal inlet (requires leap)',
    x: 0.05,
    dioramaY: 0.94,
    cartridgeY: 2.02,
    requiresLeapFromPrev: true,
  },
  {
    index: 3,
    label: 'Cedar Ridge Bluff',
    geoNote: 'Conifer granite headland',
    x: 1.05,
    dioramaY: 0.82,
    cartridgeY: 1.66,
    requiresLeapFromPrev: false,
  },
  {
    index: 4,
    label: 'Point Beacon',
    geoNote: 'Eastern lighthouse sea bluff (requires leap)',
    x: 2.05,
    dioramaY: 1.04,
    cartridgeY: 2.38,
    requiresLeapFromPrev: true,
  },
] as const;

export const FRAGMENTED_REPOS = [
  'WESTCAT-OVERLAY-RELOADED',
  'westcat-polling-overlay',
  'westcat_overlay',
] as const;

export function createInitialCartridgeState(): CartridgeState {
  return {
    mode: 'diorama',
    overlay: 'off',
    runnerIndex: 0,
    leapsUsed: 0,
    clears: 0,
    slips: 0,
    misclicksBlocked: 0,
    pollClicks: 0,
    lastInputBlocked: false,
    goalReached: false,
    lastAction: 'Vancouver Island coastal diorama active (synthetic stage; P037 overlay off).',
  };
}

export function toggleCartridgeMode(state: CartridgeState): CartridgeState {
  const next: TableMode = state.mode === 'diorama' ? 'cartridge' : 'diorama';
  return {
    ...state,
    mode: next,
    lastInputBlocked: false,
    lastAction:
      next === 'cartridge'
        ? 'Coastal contours quantized into playable 16-bit cartridge; real tidal gaps stay locked.'
        : 'Cartridge unfolded back into coastal topographic diorama.',
  };
}

export function cycleOverlayMode(state: CartridgeState): CartridgeState {
  const order: readonly OverlayLayerMode[] = ['off', 'blocking', 'click_through'];
  const idx = order.indexOf(state.overlay);
  const next = order[(idx + 1) % order.length];
  let lastAction = 'WESTCAT broadcast overlay hidden.';
  if (next === 'blocking') {
    lastAction = 'WESTCAT OPAQUE overlay on top: readable, but intercepts inputs onto live poll!';
  } else if (next === 'click_through') {
    lastAction = 'WESTCAT CLICK-THROUGH active: stays on top and passes inputs cleanly through.';
  }
  return {
    ...state,
    overlay: next,
    lastInputBlocked: false,
    lastAction,
  };
}

export function moveRunnerStep(state: CartridgeState, jump: boolean): CartridgeState {
  if (state.overlay === 'blocking') {
    return {
      ...state,
      misclicksBlocked: state.misclicksBlocked + 1,
      pollClicks: state.pollClicks + 1,
      lastInputBlocked: true,
      lastAction:
        'MISCLICK CAPTURED BY OVERLAY! Live audience saw an accidental poll click — switch overlay to CLICK-THROUGH.',
    };
  }

  if (state.mode === 'diorama') {
    const nextIdx = (state.runnerIndex + 1) % COURSE_NODES.length;
    const target = COURSE_NODES[nextIdx];
    return {
      ...state,
      runnerIndex: nextIdx,
      lastInputBlocked: false,
      lastAction: `Surveyed ${target.label} (${target.geoNote}).`,
    };
  }

  if (state.goalReached) {
    return {
      ...state,
      runnerIndex: 0,
      goalReached: false,
      lastInputBlocked: false,
      lastAction: 'Looped back to Island Timber Pier for another cartridge run.',
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
      lastInputBlocked: false,
      lastAction: `Real tidal channel before ${targetNode.label} requires Leap! Respawned at Island Timber Pier.`,
    };
  }

  const reachedGoal = nextIdx === COURSE_NODES.length - 1;
  return {
    ...state,
    runnerIndex: nextIdx,
    leapsUsed: state.leapsUsed + (jump ? 1 : 0),
    clears: state.clears + (reachedGoal ? 1 : 0),
    goalReached: reachedGoal,
    lastInputBlocked: false,
    lastAction: reachedGoal
      ? `Reached ${targetNode.label}! Real coastal geometry cleared.`
      : `${jump ? 'Leapt' : 'Stepped'} onto ${targetNode.label} (${nextIdx + 1}/${COURSE_NODES.length}).`,
  };
}
