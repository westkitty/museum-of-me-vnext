import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW08WorldFactory, type W08PreviewHandle } from './createW08World';

/** Development-only W08 preview (`?preview=w08`). The production entry stays dormant. */
export function registerW08Preview(registry: PocketWorldRegistry, onReady?: (handle: W08PreviewHandle) => void): void {
  registry.registerWorld('W08', {
    readiness: 'verified',
    title: 'World Inside a Raindrop (Preview)',
    entryDescription: 'Suspended droplet near reflecting rill',
    load: createW08WorldFactory(onReady),
  });
}
