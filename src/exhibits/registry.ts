import type { ExhibitModule, ExhibitDefinition } from './contract';
import { DEFAULT_ACTIVATION_RADIUS, TIER_BUDGET_MB } from './contract';
import { EXHIBITS_BY_ID } from '../content/collection.generated';
import { PLACEMENT_BY_EXHIBIT } from '../world/layout';

export type ExhibitFactory = (def: ExhibitDefinition) => ExhibitModule;

const FACTORIES = new Map<string, ExhibitFactory>();

/**
 * Build an exhibit's definition from the frozen mapping and the layout.
 * Definitions are derived, never hand-written, so an exhibit's declared bounds
 * can never disagree with the bay the architecture actually built for it.
 */
export function definitionFor(exhibitId: string): ExhibitDefinition {
  const record = EXHIBITS_BY_ID.get(exhibitId);
  const placement = PLACEMENT_BY_EXHIBIT.get(exhibitId);
  if (!record) throw new Error(`Unknown exhibit "${exhibitId}"`);
  if (!placement) throw new Error(`Exhibit "${exhibitId}" has no placement in the layout`);
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    wing: record.wing,
    tier: record.tier,
    projectIds: record.projectIds,
    bounds: placement.bounds,
    anchor: placement.anchor,
    interaction: 'inspect',
    activationRadius: DEFAULT_ACTIVATION_RADIUS[record.tier],
    audioZone: record.wing,
    streamingGroup: `exhibit:${record.id}`,
    budgetMB: TIER_BUDGET_MB[record.tier],
  };
}

/** Register an exhibit implementation. Throws on a duplicate registration. */
export function registerExhibit(id: string, factory: ExhibitFactory): void {
  if (FACTORIES.has(id)) throw new Error(`Exhibit "${id}" registered twice`);
  FACTORIES.set(id, factory);
}

export function hasExhibit(id: string): boolean {
  return FACTORIES.has(id);
}

export function registeredExhibitIds(): readonly string[] {
  return [...FACTORIES.keys()].sort();
}

export function createExhibit(id: string): ExhibitModule | null {
  const factory = FACTORIES.get(id);
  if (!factory) return null;
  return factory(definitionFor(id));
}

/** Test/HMR support. Never called in production paths. */
export function _resetExhibitRegistry(): void {
  FACTORIES.clear();
}
