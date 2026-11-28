import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createL01WorldFactory, type L01PreviewHandle } from './createL01World';

/** Development-only, unstamped L01 preview. */
export function registerL01Preview(registry: PocketWorldRegistry, onReady?: (handle: L01PreviewHandle) => void): void {
  registry.registerWorld('L01', {
    readiness: 'verified',
    title: "Lighthouse at World's End (Preview)",
    entryDescription: 'Lens at the top of the peninsula lighthouse',
    load: createL01WorldFactory(onReady),
  });
}
