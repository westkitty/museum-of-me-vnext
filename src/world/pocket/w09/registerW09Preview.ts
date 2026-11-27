import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW09WorldFactory, type W09PreviewHandle } from './createW09World';

/** Development-only W09 preview; the production registry remains dormant. */
export function registerW09Preview(registry: PocketWorldRegistry, onReady?: (handle: W09PreviewHandle) => void): void {
  registry.registerWorld('W09', {
    readiness: 'verified',
    title: 'The Museum Between Seconds (Preview)',
    entryDescription: 'Broken orrery in the southern wooded observatory',
    load: createW09WorldFactory(onReady),
  });
}
