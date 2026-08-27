import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validateWorkshopConservation } from '../src/workshop/conservation';
import {
  EMPTY_WORKSHOP_MANIFEST,
  serializeWorkshopManifest,
  validateWorkshopManifest,
  type WorkshopPlacementManifest,
  type WorkshopPlacementRecord,
} from '../src/workshop/schema';

export interface WorkshopLedgerDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly string[];
}

export interface WorkshopConservationCheckpoint {
  readonly id: string;
  readonly createdAt: string;
  readonly label: string;
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly beforeObjects: number;
  readonly afterObjects: number;
  readonly diff: WorkshopLedgerDiff;
  readonly conservation: 'PASS';
}

export interface WorkshopConservationLedger {
  readonly version: 1;
  readonly checkpoints: readonly WorkshopConservationCheckpoint[];
}

const EMPTY_LEDGER: WorkshopConservationLedger = { version: 1, checkpoints: [] };
const MAX_CHECKPOINTS = 200;

function hashManifest(manifest: WorkshopPlacementManifest): string {
  return createHash('sha256').update(serializeWorkshopManifest(manifest)).digest('hex');
}

function stableRecord(record: WorkshopPlacementRecord): string {
  return JSON.stringify(record);
}

export function diffWorkshopManifests(
  before: WorkshopPlacementManifest,
  after: WorkshopPlacementManifest,
): WorkshopLedgerDiff {
  const previous = new Map(before.objects.map((record) => [record.id, record]));
  const current = new Map(after.objects.map((record) => [record.id, record]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const [id, record] of current) {
    const old = previous.get(id);
    if (!old) added.push(id);
    else if (stableRecord(old) !== stableRecord(record)) changed.push(id);
  }
  for (const id of previous.keys()) if (!current.has(id)) removed.push(id);
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

function automaticLabel(diff: WorkshopLedgerDiff): string {
  const parts: string[] = [];
  if (diff.added.length) parts.push(`added ${diff.added.length}`);
  if (diff.removed.length) parts.push(`removed ${diff.removed.length}`);
  if (diff.changed.length) parts.push(`changed ${diff.changed.length}`);
  return parts.length ? `Workshop save — ${parts.join(', ')}` : 'Workshop save — no placement delta';
}

export function createWorkshopCheckpoint(
  before: WorkshopPlacementManifest,
  after: WorkshopPlacementManifest,
  createdAt = new Date().toISOString(),
): WorkshopConservationCheckpoint {
  const conservation = validateWorkshopConservation(after);
  if (!conservation.ok) {
    throw new Error(`Cannot checkpoint a conservation-violating manifest: ${conservation.violations[0]?.reason ?? 'unknown violation'}`);
  }
  const diff = diffWorkshopManifests(before, after);
  const afterHash = hashManifest(after);
  return {
    id: `${createdAt.replace(/[^0-9TZ]/g, '')}-${afterHash.slice(0, 10)}`,
    createdAt,
    label: automaticLabel(diff),
    beforeHash: hashManifest(before),
    afterHash,
    beforeObjects: before.objects.length,
    afterObjects: after.objects.length,
    diff,
    conservation: 'PASS',
  };
}

export async function readWorkshopManifestOrEmpty(path: string): Promise<WorkshopPlacementManifest> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_WORKSHOP_MANIFEST;
    throw error;
  }

  const parsed = validateWorkshopManifest(JSON.parse(text) as unknown);
  if (!parsed.ok || !parsed.value) {
    throw new Error(`Existing Workshop placement source is invalid: ${parsed.errors.join('; ')}`);
  }
  return parsed.value;
}

export async function readWorkshopLedger(path: string): Promise<WorkshopConservationLedger> {
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<WorkshopConservationLedger>;
    if (raw.version === 1 && Array.isArray(raw.checkpoints)) {
      return { version: 1, checkpoints: raw.checkpoints } as WorkshopConservationLedger;
    }
    throw new Error('Workshop conservation ledger has an unsupported shape.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_LEDGER;
    throw error;
  }
}

export async function appendWorkshopCheckpoint(
  path: string,
  checkpoint: WorkshopConservationCheckpoint,
): Promise<WorkshopConservationLedger> {
  const previous = await readWorkshopLedger(path);
  const checkpoints = [...previous.checkpoints, checkpoint].slice(-MAX_CHECKPOINTS);
  const next: WorkshopConservationLedger = { version: 1, checkpoints };
  const temp = `${path}.tmp-${process.pid}`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temp, path);
  return next;
}
