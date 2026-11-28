import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW02WorldFactory, type W02PreviewHandle } from './createW02World';

/** Development-only W02 preview (`?preview=w02`). The production entry stays dormant. */
export function registerW02Preview(registry: PocketWorldRegistry, onReady?: (handle: W02PreviewHandle) => void): void {
  registry.registerWorld('W02', {
    readiness: 'verified',
    title: 'Prehistoric Fern Island (Preview)',
    entryDescription: 'Western Fern Ravine',
    load: createW02WorldFactory(onReady),
  });
}
