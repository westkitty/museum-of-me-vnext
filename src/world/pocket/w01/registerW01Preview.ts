import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW01WorldFactory, type CreateW01WorldOptions } from './createW01World';

/**
 * Registers W01 ("Lagoon Depths — The Great Ocean Procession") on a
 * PocketWorldRegistry for DEV preview (`?preview=w01`) or automated tests.
 * Production canonical entries remain dormant until owner visual/rights sign-off.
 */
export function registerW01Preview(
  registry: PocketWorldRegistry,
  options: CreateW01WorldOptions = {},
): void {
  registry.registerWorld('W01', {
    readiness: 'verified',
    title: 'Lagoon Depths: The Great Ocean Procession',
    entryDescription: 'East lagoon bank dive marker',
    load: createW01WorldFactory(options),
  });
}
