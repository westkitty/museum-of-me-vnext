import type { Tier } from '../content/types';

export type AssetKind = 'procedural' | 'glb' | 'texture' | 'audio';
export type StreamingGroup = 'shell' | `wing:${string}` | `exhibit:${string}` | 'sanctuary';

/**
 * Governed asset record. Plan §27: no undocumented asset, ever.
 * Procedural assets are generated in code; file-backed assets carry hashes.
 */
export interface AssetRecord {
  readonly id: string;
  readonly title: string;
  readonly kind: AssetKind;
  /** Provenance. `original-museum` means authored here for the museum. */
  readonly source: 'original-museum' | `derived:${string}` | `authentic:${string}` | 'external';
  /** Originating project ID, or null for museum architecture. */
  readonly project: string | null;
  readonly creator: string;
  readonly license: string;
  /** File-backed assets only. */
  readonly url?: string;
  readonly sourceHash?: string;
  readonly processedHash?: string;
  readonly budgetKB: number;
  readonly streamingGroup: StreamingGroup;
  /** Required visitor-facing credit, or null when none is required. */
  readonly attribution: string | null;
}

export const TIER_BUDGET_MB: Record<Tier, number> = { A: 15, B: 8, C: 4 };

const RECORDS = new Map<string, AssetRecord>();

/** Register an asset. Throws on duplicate ID so collisions surface at boot. */
export function registerAsset(record: AssetRecord): AssetRecord {
  if (RECORDS.has(record.id)) {
    throw new Error(`Asset id "${record.id}" registered twice`);
  }
  RECORDS.set(record.id, record);
  return record;
}

export function getAsset(id: string): AssetRecord | undefined {
  return RECORDS.get(id);
}

export function allAssets(): readonly AssetRecord[] {
  return [...RECORDS.values()];
}

export function assetsInGroup(group: StreamingGroup): readonly AssetRecord[] {
  return [...RECORDS.values()].filter((a) => a.streamingGroup === group);
}

/**
 * Convenience for the procedural-first policy: registers a museum-original
 * generated asset with the standard licence and no attribution requirement.
 */
export function registerProcedural(
  id: string,
  title: string,
  streamingGroup: StreamingGroup,
  project: string | null = null,
  budgetKB = 0,
): AssetRecord {
  return registerAsset({
    id,
    title,
    kind: 'procedural',
    source: 'original-museum',
    project,
    creator: 'Museum of Me vNext',
    license: 'Original museum asset; owned by the project.',
    budgetKB,
    streamingGroup,
    attribution: null,
  });
}

/** Test/HMR support: clears the registry. Never called in production paths. */
export function _resetAssetRegistry(): void {
  RECORDS.clear();
}
