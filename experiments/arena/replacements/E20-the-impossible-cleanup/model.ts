export type AuditGateId = 'backup' | 'hardlinks' | 'caches' | 'rollback';

export interface StorageBin {
  readonly id: AuditGateId;
  readonly label: string;
  readonly shortTag: string;
  readonly sourceProject: string;
  readonly claimedMB: number;
  readonly nonReclaimableMB: number;
  readonly verdictNote: string;
}

export interface CleanupAuditState {
  readonly inspected: Readonly<Record<AuditGateId, boolean>>;
  readonly safePlanAssembled: boolean;
  readonly refusals: number;
  readonly lastRefusalReason: string | null;
  readonly totalClaimedMB: number;
  readonly netReclaimableMB: number;
  readonly protectedMB: number;
  readonly lastAuditLog: string;
}

/**
 * Synthetic storage bench grounded in P024 (DexCleaner), P032 (DexSort), and P061 (SpaceWise):
 * no real disk inspection exists; values conserve 64,000 MB exact totals.
 */
export const SYNTHETIC_BINS: readonly StorageBin[] = [
  {
    id: 'backup',
    label: 'Cold Media Vault',
    shortTag: 'VAULT',
    sourceProject: 'P032 DexSort',
    claimedMB: 24_000,
    nonReclaimableMB: 21_500,
    verdictNote: '21.5 GB on-device archive without verified copy (no cloud upload) -> locked.',
  },
  {
    id: 'hardlinks',
    label: 'Duplicate Cluster B',
    shortTag: 'INODES',
    sourceProject: 'P024 DexCleaner',
    claimedMB: 18_000,
    nonReclaimableMB: 12_000,
    verdictNote: '12.0 GB share live hardlink inodes -> only 6.0 GB isolated dupes.',
  },
  {
    id: 'caches',
    label: 'Build & Shader Caches',
    shortTag: 'CACHE',
    sourceProject: 'P061 SpaceWise',
    claimedMB: 14_000,
    nonReclaimableMB: 11_000,
    verdictNote: '11.0 GB regenerate on next launch -> only 3.0 GB orphaned.',
  },
  {
    id: 'rollback',
    label: 'Snapshot Ledger',
    shortTag: 'ROLLBK',
    sourceProject: 'P024 DexCleaner',
    claimedMB: 8_000,
    nonReclaimableMB: 5_000,
    verdictNote: '5.0 GB pinned to reversible recovery anchor -> 3.0 GB archivable.',
  },
] as const;

export const TOTAL_SYNTHETIC_CLAIMED_MB = SYNTHETIC_BINS.reduce((sum, b) => sum + b.claimedMB, 0);

function computeTotals(inspected: Readonly<Record<AuditGateId, boolean>>): {
  readonly netReclaimableMB: number;
  readonly protectedMB: number;
} {
  let withheld = 0;
  for (const bin of SYNTHETIC_BINS) {
    if (inspected[bin.id]) withheld += bin.nonReclaimableMB;
  }
  return {
    netReclaimableMB: TOTAL_SYNTHETIC_CLAIMED_MB - withheld,
    protectedMB: withheld,
  };
}

export function createInitialCleanupState(): CleanupAuditState {
  const inspected: Record<AuditGateId, boolean> = {
    backup: false,
    hardlinks: false,
    caches: false,
    rollback: false,
  };
  return {
    inspected,
    safePlanAssembled: false,
    refusals: 0,
    lastRefusalReason: null,
    totalClaimedMB: TOTAL_SYNTHETIC_CLAIMED_MB,
    netReclaimableMB: TOTAL_SYNTHETIC_CLAIMED_MB,
    protectedMB: 0,
    lastAuditLog: 'Synthetic bench ready (64.0 GB marketing claim). Peel back each shell before staging.',
  };
}

export function toggleAuditGate(state: CleanupAuditState, gate: AuditGateId): CleanupAuditState {
  const nextVal = !state.inspected[gate];
  const nextInspected = { ...state.inspected, [gate]: nextVal };
  const totals = computeTotals(nextInspected);
  const bin = SYNTHETIC_BINS.find((b) => b.id === gate)!;
  return {
    ...state,
    inspected: nextInspected,
    safePlanAssembled: state.safePlanAssembled && Object.values(nextInspected).every(Boolean),
    lastRefusalReason: null,
    netReclaimableMB: totals.netReclaimableMB,
    protectedMB: totals.protectedMB,
    lastAuditLog: nextVal
      ? `Audited ${bin.label} (${bin.sourceProject}): ${bin.verdictNote} Reclaimable shrank to ${(totals.netReclaimableMB / 1000).toFixed(1)} GB.`
      : `Masked ${bin.label} shell again; speculative headline jumped to ${(totals.netReclaimableMB / 1000).toFixed(1)} GB.`,
  };
}

/**
 * Refuses to certify speculative savings until all 4 evidence gates have been explained.
 */
export function assembleSafePlan(state: CleanupAuditState): CleanupAuditState {
  const unaudited = SYNTHETIC_BINS.filter((b) => !state.inspected[b.id]);
  if (unaudited.length > 0) {
    const names = unaudited.map((b) => b.shortTag).join(', ');
    const reason = `DECLINED: ${unaudited.length}/4 unverified shells (${names}) — refuses to overclaim ${(state.netReclaimableMB / 1000).toFixed(1)} GB.`;
    return {
      ...state,
      safePlanAssembled: false,
      refusals: state.refusals + 1,
      lastRefusalReason: reason,
      lastAuditLog: reason,
    };
  }

  const totals = computeTotals(state.inspected);
  return {
    ...state,
    safePlanAssembled: true,
    lastRefusalReason: null,
    netReclaimableMB: totals.netReclaimableMB,
    protectedMB: totals.protectedMB,
    lastAuditLog: `Safe Quarantine Staged: ${(totals.netReclaimableMB / 1000).toFixed(1)} GB reversible (${(totals.protectedMB / 1000).toFixed(1)} GB shielded, NO DELETE LEVER).`,
  };
}

export function countAuditedGates(state: CleanupAuditState): number {
  return SYNTHETIC_BINS.reduce((n, b) => n + (state.inspected[b.id] ? 1 : 0), 0);
}
