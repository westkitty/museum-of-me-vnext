export type AuditGateId = 'backup' | 'hardlinks' | 'caches' | 'rollback';

export interface StorageBin {
  readonly id: AuditGateId;
  readonly label: string;
  readonly claimedMB: number;
  readonly nonReclaimableMB: number;
  readonly verdictNote: string;
}

export interface CleanupAuditState {
  readonly inspected: Readonly<Record<AuditGateId, boolean>>;
  readonly safePlanAssembled: boolean;
  readonly totalClaimedMB: number;
  readonly netReclaimableMB: number;
  readonly protectedMB: number;
  readonly lastAuditLog: string;
}

export const SYNTHETIC_BINS: readonly StorageBin[] = [
  {
    id: 'backup',
    label: 'Cold Media Vault',
    claimedMB: 24_000,
    nonReclaimableMB: 21_500,
    verdictNote: '21.5 GB lack verified off-disk backup copies -> locked read-only.',
  },
  {
    id: 'hardlinks',
    label: 'Duplicate Cluster B',
    claimedMB: 18_000,
    nonReclaimableMB: 12_000,
    verdictNote: '12.0 GB share live hardlink inodes -> only 6.0 GB isolated dupes.',
  },
  {
    id: 'caches',
    label: 'Build & Shader Caches',
    claimedMB: 14_000,
    nonReclaimableMB: 11_000,
    verdictNote: '11.0 GB auto-regenerate immediately on next local workspace launch.',
  },
  {
    id: 'rollback',
    label: 'Snapshot Ledger',
    claimedMB: 8_000,
    nonReclaimableMB: 5_000,
    verdictNote: '5.0 GB pinned to active rollback recovery window -> 3.0 GB archivable.',
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
    totalClaimedMB: TOTAL_SYNTHETIC_CLAIMED_MB,
    netReclaimableMB: TOTAL_SYNTHETIC_CLAIMED_MB,
    protectedMB: 0,
    lastAuditLog: 'Synthetic ledger ready (64.0 GB claimed). Inspect constraints before trusting headline savings.',
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
    netReclaimableMB: totals.netReclaimableMB,
    protectedMB: totals.protectedMB,
    lastAuditLog: nextVal
      ? `Audited ${bin.label}: ${bin.verdictNote} Claimed savings shrank to ${(totals.netReclaimableMB / 1000).toFixed(1)} GB.`
      : `Cleared ${bin.label} audit; speculative savings rose to ${(totals.netReclaimableMB / 1000).toFixed(1)} GB.`,
  };
}

export function assembleSafePlan(state: CleanupAuditState): CleanupAuditState {
  const nextInspected: Record<AuditGateId, boolean> = {
    backup: true,
    hardlinks: true,
    caches: true,
    rollback: true,
  };
  const totals = computeTotals(nextInspected);
  return {
    ...state,
    inspected: nextInspected,
    safePlanAssembled: true,
    netReclaimableMB: totals.netReclaimableMB,
    protectedMB: totals.protectedMB,
    lastAuditLog: `Assembled reversible Safe Quarantine Plan: ${(totals.netReclaimableMB / 1000).toFixed(1)} GB staged (${(totals.protectedMB / 1000).toFixed(1)} GB protected, ZERO deletion).`,
  };
}

export function countAuditedGates(state: CleanupAuditState): number {
  return SYNTHETIC_BINS.reduce((n, b) => n + (state.inspected[b.id] ? 1 : 0), 0);
}
