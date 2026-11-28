import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW05WorldFactory, type W05PreviewHandle } from './createW05World';

/** Development-only W05 preview (`?preview=w05`). The production entry stays dormant. */
export function registerW05Preview(registry: PocketWorldRegistry, onReady?: (handle: W05PreviewHandle) => void): void {
  registry.registerWorld('W05', {
    readiness: 'verified',
    title: 'Impossible Greenhouse (Preview)',
    entryDescription: 'Rooftop glasshouse giant flower',
    load: createW05WorldFactory(onReady),
  });
}
