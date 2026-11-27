import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW06WorldFactory, type W06PreviewHandle } from './createW06World';

/** Development-only W06 preview (`?preview=w06`). The production entry stays dormant. */
export function registerW06Preview(registry: PocketWorldRegistry, onReady?: (handle: W06PreviewHandle) => void): void {
  registry.registerWorld('W06', {
    readiness: 'verified',
    title: 'Skyborne Gardens (Preview)',
    entryDescription: 'Rooftop cafe second flight pad',
    load: createW06WorldFactory(onReady),
  });
}
