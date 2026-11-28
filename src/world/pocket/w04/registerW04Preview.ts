import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW04WorldFactory, type W04PreviewHandle } from './createW04World';

/** Development-only W04 preview (`?preview=w04`). The production entry stays dormant. */
export function registerW04Preview(registry: PocketWorldRegistry, onReady?: (handle: W04PreviewHandle) => void): void {
  registry.registerWorld('W04', {
    readiness: 'verified',
    title: 'Digital Beat World (Preview)',
    entryDescription: 'E19 DexTilt desktop',
    load: createW04WorldFactory(onReady),
  });
}
