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

export class WorkshopHistory {
  private readonly undoStack: HistoryEntry[] = [];
  private readonly redoStack: HistoryEntry[] = [];

  constructor(private readonly limit = 100) {}

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  push(label: string, before: WorkshopPlacementManifest, after: WorkshopPlacementManifest): boolean {
    if (workshopManifestsEqual(before, after)) return false;
    this.undoStack.push({
      label,
      before: cloneWorkshopManifest(before),
      after: cloneWorkshopManifest(after),
    });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    return true;
  }

  undo(): WorkshopHistoryResult | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return { label: entry.label, manifest: cloneWorkshopManifest(entry.before) };
  }

  redo(): WorkshopHistoryResult | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return { label: entry.label, manifest: cloneWorkshopManifest(entry.after) };
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
