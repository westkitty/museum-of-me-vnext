import { registerExhibit, registeredExhibitIds } from './registry';
import { ProvisionalExhibit } from './ProvisionalExhibit';
import { COLLECTION } from '../content/collection.generated';
import type { ExhibitDefinition } from './contract';
import type { ExhibitModule } from './contract';

/**
 * The exhibit registry.
 *
 * Bespoke modules are registered here as each wing is built. Everything not yet
 * bespoke falls back to ProvisionalExhibit so the whole museum stays walkable
 * and testable while it is under construction. The Phase 9 content gate fails
 * the build if any fallback survives.
 */

/** Exhibits with a finished, bespoke implementation. Grows wave by wave. */
const BESPOKE = new Map<string, (def: ExhibitDefinition) => ExhibitModule>();

export function registerBespoke(id: string, factory: (def: ExhibitDefinition) => ExhibitModule): void {
  BESPOKE.set(id, factory);
}

let installed = false;

/** Install every exhibit into the registry. Idempotent. */
export function installExhibits(): void {
  if (installed) return;
  installed = true;
  for (const record of COLLECTION.exhibits) {
    const bespoke = BESPOKE.get(record.id);
    registerExhibit(record.id, bespoke ?? ((def) => new ProvisionalExhibit(def)));
  }
}

export function bespokeCount(): number {
  return BESPOKE.size;
}

export function scaffoldedExhibitIds(): readonly string[] {
  return COLLECTION.exhibits.filter((e) => !BESPOKE.has(e.id)).map((e) => e.id);
}

export { registeredExhibitIds };
