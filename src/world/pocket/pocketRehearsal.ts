import type { PocketWorldRegistry } from './PocketWorldRegistry';
import type { PocketPreviewHandle } from './kit/worldKit';
import type { PocketWorldFactory, PocketWorldId } from './types';

/**
 * Local production rehearsal: promotes worlds through the production
 * activation path. Ordinary builds never reach this file: vite.config.ts
 * resolves it to `pocketRehearsal.off.ts` unless VITE_POCKET_REHEARSAL=1, so
 * no world module (or W01 stem asset) enters the published module graph.
 *
 * Rehearsal-only query options:
 * - `?rehearsalPrefix=N` rehearses a staged release: the first N worlds of the
 *   protected promotion order, activated exactly as a partial promotion would
 *   be. Without it every world is promoted.
 * - `?rehearsalObserve=1` lets the rehearsal's browser checks read the same
 *   read-only progress snapshot the development previews expose
 *   (`window.__worldPreview[id].getSnapshot()`). The worlds still load through
 *   the production lazy loader, from the same chunks, with the same factories.
 */
export function rehearsalPrefixFromSearch(search: string, total: number): number {
  const raw = new URLSearchParams(search).get('rehearsalPrefix');
  if (raw === null) return total;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= total ? n : total;
}

type Observed = (expose: (handle: PocketPreviewHandle) => void) => Promise<PocketWorldFactory>;

/** The production world modules, with a read-only snapshot callback (W01's factory takes options instead). */
const OBSERVED: Partial<Record<PocketWorldId, Observed>> = {
  W02: (e) => import('./w02/createW02World').then((m) => m.createW02WorldFactory(e)),
  W03: (e) => import('./w03/createW03World').then((m) => m.createW03WorldFactory(e)),
  W04: (e) => import('./w04/createW04World').then((m) => m.createW04WorldFactory(e)),
  W05: (e) => import('./w05/createW05World').then((m) => m.createW05WorldFactory(e)),
  W06: (e) => import('./w06/createW06World').then((m) => m.createW06WorldFactory(e)),
  W07: (e) => import('./w07/createW07World').then((m) => m.createW07WorldFactory(e)),
  W08: (e) => import('./w08/createW08World').then((m) => m.createW08WorldFactory(e)),
  W09: (e) => import('./w09/createW09World').then((m) => m.createW09WorldFactory(e)),
  L01: (e) => import('./l01/createL01World').then((m) => m.createL01WorldFactory(e)),
  W10: (e) => import('./w10/createW10World').then((m) => m.createW10WorldFactory(e)),
};

export async function startPocketRehearsal(registry: PocketWorldRegistry, search = ''): Promise<void> {
  const { activateProductionWorlds, lazyProductionLoader, POCKET_PROMOTION_ORDER } = await import('./productionWorlds');
  const active = POCKET_PROMOTION_ORDER.slice(0, rehearsalPrefixFromSearch(search, POCKET_PROMOTION_ORDER.length));
  activateProductionWorlds(registry, active);
  if (new URLSearchParams(search).get('rehearsalObserve') !== '1' || typeof window === 'undefined') return;
  const handles = ((window as unknown as { __worldPreview?: Record<string, PocketPreviewHandle> }).__worldPreview ??= {});
  for (const id of active) {
    const observed = OBSERVED[id];
    if (!observed) continue;
    registry.registerWorld(id, { readiness: 'verified', load: lazyProductionLoader(id, () => observed((h) => { handles[id] = h; })) });
  }
}
