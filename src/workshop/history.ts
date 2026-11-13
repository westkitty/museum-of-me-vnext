import {
  cloneWorkshopManifest,
  workshopManifestsEqual,
  type WorkshopPlacementManifest,
} from './schema';

export interface WorkshopHistoryResult {
  readonly label: string;
  readonly manifest: WorkshopPlacementManifest;
}

interface HistoryEntry {
  readonly label: string;
  readonly before: WorkshopPlacementManifest;
  readonly after: WorkshopPlacementManifest;
}

/** Share unchanged immutable records between snapshots; arrays remain independent. */
function shareRecords<T extends { readonly id: string }>(records: readonly T[], reference: readonly T[]): readonly T[] {
  const previous = new Map(reference.map((record) => [record.id, record]));
  return records.map((record) => {
    const existing = previous.get(record.id);
    return existing && JSON.stringify(existing) === JSON.stringify(record) ? existing : record;
  });
}

function shareSnapshot(manifest: WorkshopPlacementManifest, reference: WorkshopPlacementManifest | null): WorkshopPlacementManifest {
  const copy = cloneWorkshopManifest(manifest);
  if (!reference) return copy;
  return { ...copy,
    objects: shareRecords(copy.objects, reference.objects),
    sceneOverrides: shareRecords(copy.sceneOverrides ?? [], reference.sceneOverrides ?? []),
    surfaceOverrides: shareRecords(copy.surfaceOverrides ?? [], reference.surfaceOverrides ?? []),
  };
}

export class WorkshopHistory {
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];
  private anchor: WorkshopPlacementManifest | null = null;

  constructor(private readonly limit = 100) {}

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  /** Diagnostic count of distinct retained records, not a heap-size measurement. */
  get retainedRecordCount(): number {
    const records = new Set<object>();
    for (const entry of [...this.undoStack, ...this.redoStack]) {
      for (const snapshot of [entry.before, entry.after]) {
        for (const record of [...snapshot.objects, ...(snapshot.sceneOverrides ?? []), ...(snapshot.surfaceOverrides ?? [])]) records.add(record);
      }
    }
    return records.size;
  }

  push(label: string, before: WorkshopPlacementManifest, after: WorkshopPlacementManifest): boolean {
    if (workshopManifestsEqual(before, after)) return false;
    const beforeSnapshot = shareSnapshot(before, this.anchor);
    const afterSnapshot = shareSnapshot(after, beforeSnapshot);
    this.undoStack.push({ label, before: beforeSnapshot, after: afterSnapshot });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.anchor = this.undoStack.length ? afterSnapshot : null;
    this.redoStack.length = 0;
    return true;
  }

  undo(): WorkshopHistoryResult | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    this.anchor = entry.before;
    return { label: entry.label, manifest: cloneWorkshopManifest(entry.before) };
  }

  redo(): WorkshopHistoryResult | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    this.anchor = entry.after;
    return { label: entry.label, manifest: cloneWorkshopManifest(entry.after) };
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.anchor = null;
  }
}
