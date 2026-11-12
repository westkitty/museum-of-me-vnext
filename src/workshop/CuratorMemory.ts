import type {
  CuratorDecision, CuratorDecisionKind, CuratorEmptyRegion, CuratorMemory, WorkshopPlacementManifest, WorkshopVec3,
} from './schema';

/**
 * Pure operations on Curator's Memory. Each returns a new manifest, so the
 * Workshop applies them through its normal undoable history and save path.
 */
export const EMPTY_CURATOR_MEMORY: CuratorMemory = { locks: [], decisions: [], emptyRegions: [] };

const memoryOf = (manifest: WorkshopPlacementManifest): CuratorMemory => manifest.curator ?? EMPTY_CURATOR_MEMORY;
const withMemory = (manifest: WorkshopPlacementManifest, curator: CuratorMemory): WorkshopPlacementManifest => ({ ...manifest, curator });

export function isLocked(manifest: WorkshopPlacementManifest, id: string): boolean {
  return memoryOf(manifest).locks.includes(id);
}

export function setLocked(manifest: WorkshopPlacementManifest, id: string, locked: boolean): WorkshopPlacementManifest {
  if (!manifest.objects.some((record) => record.id === id)) throw new Error(`Cannot lock unknown object ${id}`);
  const memory = memoryOf(manifest);
  const locks = memory.locks.filter((lock) => lock !== id);
  return withMemory(manifest, { ...memory, locks: locked ? [...locks, id] : locks });
}

/**
 * Record the curator's latest response for one object and suggestion kind.
 * Memory holds current intent, so a newer decision replaces the older one for
 * the same object and kind; this also bounds memory by the number of objects.
 */
export function recordDecision(manifest: WorkshopPlacementManifest, decision: {
  kind: CuratorDecisionKind; objectId: string; outcome: CuratorDecision['outcome']; position: WorkshopVec3; at?: Date;
}): WorkshopPlacementManifest {
  const memory = memoryOf(manifest);
  const entry: CuratorDecision = { kind: decision.kind, objectId: decision.objectId, outcome: decision.outcome,
    position: [decision.position[0], decision.position[1], decision.position[2]],
    at: (decision.at ?? new Date()).toISOString() };
  const decisions = memory.decisions.filter((item) => !(item.kind === decision.kind && item.objectId === decision.objectId));
  return withMemory(manifest, { ...memory, decisions: [...decisions, entry] });
}

export function latestDecision(manifest: WorkshopPlacementManifest, kind: CuratorDecisionKind, objectId: string): CuratorDecision | null {
  const decisions = memoryOf(manifest).decisions;
  for (let i = decisions.length - 1; i >= 0; i--) {
    if (decisions[i].kind === kind && decisions[i].objectId === objectId) return decisions[i];
  }
  return null;
}

const samePosition = (a: readonly number[], b: readonly number[]) => a.every((value, index) => Math.abs(value - b[index]) < 1e-4);

/**
 * A suggestion stays suppressed while the curator's rejection or manual
 * override still applies, meaning the object has not moved since. If the
 * object is moved again, the question is open again.
 */
export function suppressionReason(manifest: WorkshopPlacementManifest, kind: CuratorDecisionKind, objectId: string): string | null {
  const decision = latestDecision(manifest, kind, objectId);
  const record = manifest.objects.find((item) => item.id === objectId);
  if (!decision || !record || decision.outcome === 'approved' || !samePosition(decision.position, record.position)) return null;
  return decision.outcome === 'rejected'
    ? `Suggestion rejected by the curator on ${decision.at.slice(0, 10)}; not re-proposed while the object stays here.`
    : `Placed by the curator by hand on ${decision.at.slice(0, 10)}; automation will not move it while it stays here.`;
}

export function addEmptyRegion(manifest: WorkshopPlacementManifest, region: CuratorEmptyRegion): WorkshopPlacementManifest {
  const memory = memoryOf(manifest);
  if (memory.emptyRegions.some((item) => item.id === region.id)) throw new Error(`Empty region ${region.id} already exists`);
  return withMemory(manifest, { ...memory, emptyRegions: [...memory.emptyRegions, region] });
}

export function removeEmptyRegion(manifest: WorkshopPlacementManifest, id: string): WorkshopPlacementManifest {
  const memory = memoryOf(manifest);
  return withMemory(manifest, { ...memory, emptyRegions: memory.emptyRegions.filter((item) => item.id !== id) });
}

/** Whether an XZ box overlaps any deliberately empty region of the given world. */
export function overlapsEmptyRegion(manifest: WorkshopPlacementManifest, world: string,
  box: { min: readonly number[]; max: readonly number[] }): CuratorEmptyRegion | null {
  for (const region of memoryOf(manifest).emptyRegions) {
    if (region.worldId !== 'shared' && world !== 'shared' && region.worldId !== world) continue;
    if (box.min[0] < region.max[0] && box.max[0] > region.min[0] && box.min[2] < region.max[1] && box.max[2] > region.min[1]) return region;
  }
  return null;
}
