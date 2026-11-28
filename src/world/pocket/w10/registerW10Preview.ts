import type { PocketWorldRegistry } from '../PocketWorldRegistry';
import { createW10WorldFactory, type W10PreviewHandle } from './createW10World';

/** Development-only W10 preview. Canonical first-earned-stamp gate remains. */
export function registerW10Preview(registry: PocketWorldRegistry, onReady?: (handle: W10PreviewHandle) => void): void {
  registry.registerWorld('W10', {
    readiness: 'verified',
    title: 'Breath of the Weasel (Test Rig Preview)',
    entryDescription: 'Southern pier or rooftop Flight Pad II, after an earned stamp',
    load: createW10WorldFactory(onReady),
  });
}
