export type RegionId = 'loc_westmarch' | 'loc_saltfen' | 'loc_thornwood' | 'loc_last_keep';

export interface RegionRecord {
  readonly id: RegionId;
  readonly name: string;
  readonly x: number;
  readonly z: number;
}

export interface RouteEdge {
  readonly id: string;
  readonly from: RegionId;
  readonly to: string;
  readonly canonicalTo: RegionId;
}

export interface ValidationFault {
  readonly edgeId: string;
  readonly missingId: string;
  readonly expectedId: RegionId;
}

export interface CampaignState {
  readonly unitRegion: RegionId;
  readonly fortified: Readonly<Record<RegionId, boolean>>;
  readonly routes: readonly RouteEdge[];
  readonly marchCount: number;
  readonly fault: ValidationFault | null;
  readonly lastLog: string;
}

export const REGIONS: readonly RegionRecord[] = [
  { id: 'loc_westmarch', name: 'Westmarch', x: -2.05, z: -4.55 },
  { id: 'loc_saltfen', name: 'Saltfen', x: -0.7, z: -5.45 },
  { id: 'loc_thornwood', name: 'Thornwood', x: 0.72, z: -4.55 },
  { id: 'loc_last_keep', name: 'Last Keep', x: 2.05, z: -5.4 },
] as const;

const CANONICAL_ROUTES: readonly RouteEdge[] = [
  { id: 'route_west_salt', from: 'loc_westmarch', to: 'loc_saltfen', canonicalTo: 'loc_saltfen' },
  { id: 'route_salt_thorn', from: 'loc_saltfen', to: 'loc_thornwood', canonicalTo: 'loc_thornwood' },
  { id: 'route_thorn_keep', from: 'loc_thornwood', to: 'loc_last_keep', canonicalTo: 'loc_last_keep' },
] as const;

export function regionSpecFor(id: RegionId): RegionRecord {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

export function validateCampaignRoutes(routes: readonly RouteEdge[]): ValidationFault | null {
  const validIds = new Set<string>(REGIONS.map((r) => r.id));
  for (const edge of routes) {
    if (!validIds.has(edge.to)) {
      return {
        edgeId: edge.id,
        missingId: edge.to,
        expectedId: edge.canonicalTo,
      };
    }
  }
  return null;
}

export function createInitialCampaignState(): CampaignState {
  return {
    unitRegion: 'loc_westmarch',
    fortified: {
      loc_westmarch: false,
      loc_saltfen: false,
      loc_thornwood: false,
      loc_last_keep: false,
    },
    routes: CANONICAL_ROUTES.map((r) => ({ ...r })),
    marchCount: 0,
    fault: null,
    lastLog: 'Campaign schema verified: all 4 citadels linked cleanly from Westmarch.',
  };
}

export function marchUnitNext(state: CampaignState): CampaignState {
  const idx = REGIONS.findIndex((r) => r.id === state.unitRegion);
  if (idx === REGIONS.length - 1) {
    return {
      ...state,
      unitRegion: 'loc_westmarch',
      marchCount: state.marchCount + 1,
      lastLog: 'Campaign circuit restarted at Westmarch.',
    };
  }

  const outbound = state.routes.find((r) => r.from === state.unitRegion);
  if (!outbound) return state;

  const targetExists = REGIONS.some((r) => r.id === outbound.to);
  if (!targetExists) {
    return {
      ...state,
      lastLog: `MARCH BLOCKED: ${outbound.id} references missing ID "${outbound.to}"! Repair schema first.`,
    };
  }

  const nextRegion = outbound.to as RegionId;
  return {
    ...state,
    unitRegion: nextRegion,
    marchCount: state.marchCount + 1,
    lastLog: `Banner marched along ${outbound.id} into ${regionSpecFor(nextRegion).name}.`,
  };
}

export function fortifyCurrentRegion(state: CampaignState): CampaignState {
  if (state.fault && state.unitRegion === 'loc_saltfen') {
    return {
      ...state,
      lastLog: `FORTIFY DEGRADED: Supply bridge ${state.fault.edgeId} severed (${state.fault.missingId}).`,
    };
  }
  const nextVal = !state.fortified[state.unitRegion];
  return {
    ...state,
    fortified: {
      ...state.fortified,
      [state.unitRegion]: nextVal,
    },
    lastLog: `${regionSpecFor(state.unitRegion).name} muster banner ${nextVal ? 'RAISED' : 'LOWERED'}.`,
  };
}

export function injectBrokenReferenceId(state: CampaignState): CampaignState {
  if (state.fault) return state;
  const routes = state.routes.map((edge) =>
    edge.id === 'route_salt_thorn'
      ? { ...edge, to: 'loc_thornwood_MISSING' }
      : edge,
  );
  const fault = validateCampaignRoutes(routes);
  return {
    ...state,
    unitRegion: state.unitRegion === 'loc_thornwood' ? 'loc_saltfen' : state.unitRegion,
    routes,
    fault,
    lastLog: fault
      ? `INJECTED FAULT: ${fault.edgeId} points to unknown ID "${fault.missingId}". Saltfen-Thornwood bridge collapsed!`
      : state.lastLog,
  };
}

export function repairBrokenReferenceId(state: CampaignState): CampaignState {
  if (!state.fault) {
    return {
      ...state,
      lastLog: 'Schema health check passed: zero broken IDs detected.',
    };
  }
  const routes = state.routes.map((edge) => ({
    ...edge,
    to: edge.canonicalTo,
  }));
  return {
    ...state,
    routes,
    fault: null,
    lastLog: `REPAIRED: Relinked ${state.fault.edgeId} target -> "${state.fault.expectedId}". Bridge restored.`,
  };
}

export function countFortifiedRegions(state: CampaignState): number {
  return REGIONS.reduce((sum, r) => sum + (state.fortified[r.id] ? 1 : 0), 0);
}
