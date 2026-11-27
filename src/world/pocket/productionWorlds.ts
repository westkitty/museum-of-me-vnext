import type { PocketWorldRegistry } from './PocketWorldRegistry';
import type { PocketWorldFactory, PocketWorldId } from './types';

/**
 * Production activation of the pocket worlds, prepared ahead of acceptance.
 *
 * Every world is promoted with the *same* factory its development preview
 * uses (no second copy of any world), behind a dynamic import so an unopened
 * world is neither downloaded nor executed. The canonical registry entry keeps
 * its title, slot, bonus flag, camera mode, return anchor and stamp gate;
 * activation only supplies `readiness: 'verified'` and the loader.
 *
 * Nothing is active: `PRODUCTION_ACTIVE_WORLDS` is empty and `main.ts` imports
 * this module only for a local rehearsal build (`VITE_POCKET_REHEARSAL=1`),
 * which ordinary builds leave unset, so the published distribution contains no
 * world chunk. Promoting a world is one reviewed edit to that list, in order.
 */

/** The protected promotion order. Worlds go live only as a prefix of it. */
export const POCKET_PROMOTION_ORDER: readonly PocketWorldId[] = Object.freeze([
  'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'L01', 'W10',
]);

/**
 * Worlds live in production. Empty until each world's owner acceptance,
 * device acceptance and release gates pass (docs/plans/WORLD_OWNER_REVIEW_20261126.md).
 */
export const PRODUCTION_ACTIVE_WORLDS: readonly PocketWorldId[] = Object.freeze([]);

type FactoryModule = () => Promise<PocketWorldFactory>;

/** Lazy production factories: each import is its own chunk, fetched on first entry. */
export const PRODUCTION_WORLD_FACTORIES: Readonly<Record<PocketWorldId, FactoryModule>> = Object.freeze({
  W01: () => import('./w01/createW01World').then((m) => m.createW01WorldFactory()),
  W02: () => import('./w02/createW02World').then((m) => m.createW02WorldFactory()),
  W03: () => import('./w03/createW03World').then((m) => m.createW03WorldFactory()),
  W04: () => import('./w04/createW04World').then((m) => m.createW04WorldFactory()),
  W05: () => import('./w05/createW05World').then((m) => m.createW05WorldFactory()),
  W06: () => import('./w06/createW06World').then((m) => m.createW06WorldFactory()),
  W07: () => import('./w07/createW07World').then((m) => m.createW07WorldFactory()),
  W08: () => import('./w08/createW08World').then((m) => m.createW08WorldFactory()),
  W09: () => import('./w09/createW09World').then((m) => m.createW09WorldFactory()),
  L01: () => import('./l01/createL01World').then((m) => m.createL01WorldFactory()),
  W10: () => import('./w10/createW10World').then((m) => m.createW10WorldFactory()),
});

/** Throws unless `active` is an ordered prefix of the promotion order (no skips, no repeats). */
export function assertPromotionPrefix(active: readonly PocketWorldId[]): void {
  active.forEach((id, index) => {
    if (POCKET_PROMOTION_ORDER[index] !== id) {
      throw new Error(`Pocket world promotion out of order: position ${index + 1} is ${id}, expected ${POCKET_PROMOTION_ORDER[index] ?? 'nothing'}`);
    }
  });
}

/** A loader that fetches the world's module on first entry and honours an abort during the fetch. */
export function lazyProductionLoader(
  id: PocketWorldId,
  fetchFactory: FactoryModule = PRODUCTION_WORLD_FACTORIES[id],
): PocketWorldFactory {
  let factory: Promise<PocketWorldFactory> | null = null;
  return async (ctx, signal) => {
    factory ??= fetchFactory().catch((error: unknown) => {
      factory = null; // a failed fetch can be retried on the next entry
      throw error;
    });
    const create = await factory;
    if (signal.aborted) throw new DOMException(`${id} load aborted`, 'AbortError');
    return create(ctx, signal);
  };
}

/** Promotes `active` worlds on the registry. Returns the ids activated. */
export function activateProductionWorlds(
  registry: PocketWorldRegistry,
  active: readonly PocketWorldId[] = PRODUCTION_ACTIVE_WORLDS,
): PocketWorldId[] {
  assertPromotionPrefix(active);
  for (const id of active) registry.registerWorld(id, { readiness: 'verified', load: lazyProductionLoader(id) });
  return [...active];
}
