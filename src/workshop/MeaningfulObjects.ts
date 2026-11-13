import { INSTALLATION_PLACEMENT_BY_ID } from '../world/installationPlacement';
import { PLACEMENTS } from '../world/layout';
import type { MeaningfulActionId, WorkshopPlacementRecord } from './schema';

/** One allowlisted binding: a real source-installation control, never code. */
export interface MeaningfulAction {
  readonly id: MeaningfulActionId;
  readonly exhibit: string;
  readonly installation: string;
  /** The exact source control code the installation already accepts from visitors. */
  readonly code: string;
  readonly label: string;
}

const strain = (n: number, name: string): MeaningfulAction => ({
  id: `e07-strain-${n}` as MeaningfulActionId, exhibit: 'E07', installation: 'drakken-sandbox', code: `Digit${n}`,
  label: `Select strain ${n}: ${name}`,
});

/**
 * The complete table. Every entry routes to `SourceInstallations.key`, the same
 * path a visitor's keypress takes, so state, persistence, the lectern line and
 * announcements are the exhibit's own.
 */
export const MEANINGFUL_ACTIONS: Readonly<Record<MeaningfulActionId, MeaningfulAction>> = {
  'e07-strain-1': strain(1, 'first terraforming strain'),
  'e07-strain-2': strain(2, 'second terraforming strain'),
  'e07-strain-3': strain(3, 'third terraforming strain'),
  'e07-strain-4': strain(4, 'fourth terraforming strain'),
  'e07-strain-5': strain(5, 'fifth terraforming strain'),
  'e07-advance-assault': { id: 'e07-advance-assault', exhibit: 'E07', installation: 'drakken-sandbox', code: 'Space', label: 'Advance the assault one step' },
  'e07-toggle-report': { id: 'e07-toggle-report', exhibit: 'E07', installation: 'drakken-sandbox', code: 'KeyO', label: 'Switch official report / actual condition' },
};

/** A bound object must stand in the exhibit's own bay, on its level, within reach of its story. */
export const MEANING_MAX_DISTANCE = 8;

/** Why a binding is not meaningful where the object stands, or null when it is. */
export function meaningProblem(record: Pick<WorkshopPlacementRecord, 'meaning' | 'position' | 'worldId' | 'label'>): string | null {
  if (!record.meaning) return null;
  const action = MEANINGFUL_ACTIONS[record.meaning];
  if (record.worldId !== 'interior') return `${record.label} must be inside the museum to act on ${action.exhibit}.`;
  const installation = INSTALLATION_PLACEMENT_BY_ID.get(action.installation);
  const bay = PLACEMENTS.find((placement) => placement.exhibitId === action.exhibit);
  if (!installation || !bay) return `${action.exhibit} is not available.`;
  const [x, y, z] = record.position;
  const { c, h } = bay.bounds;
  const inBay = x >= c[0] - h[0] && x <= c[0] + h[0] && z >= c[2] - h[2] && z <= c[2] + h[2] && Math.abs(y - installation.position[1]) < 2;
  const distance = Math.hypot(x - installation.position[0], z - installation.position[2]);
  if (!inBay || distance > MEANING_MAX_DISTANCE) {
    return `${record.label} must stand in the ${action.exhibit} bay within ${MEANING_MAX_DISTANCE} m of its installation (now ${distance.toFixed(1)} m away).`;
  }
  return null;
}
