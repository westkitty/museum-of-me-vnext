import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW07WorldFactory, type W07PreviewHandle } from './createW07World';

/** Development-only W07 preview (`?preview=w07`). The production entry stays dormant. */
export function registerW07Preview(registry: PocketWorldRegistry, onReady?: (handle: W07PreviewHandle) => void): void {
  registry.registerWorld('W07', {
    readiness: 'verified',
    title: 'Portal Slingshot Trials (Preview)',
    entryDescription: 'Back of verified least-populated wing, under-construction testing lab',
    load: createW07WorldFactory(onReady),
  });
}
