import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW03WorldFactory, type W03PreviewHandle } from './createW03World';

/** Development-only W03 preview (`?preview=w03`). The production entry stays dormant. */
export function registerW03Preview(registry: PocketWorldRegistry, onReady?: (handle: W03PreviewHandle) => void): void {
  registry.registerWorld('W03', {
    readiness: 'verified',
    title: 'Clockwork Sundial (Preview)',
    entryDescription: 'Astronomical seasonal terrace',
    load: createW03WorldFactory(onReady),
  });
}
