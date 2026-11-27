import type { PocketWorldRegistry } from './PocketWorldRegistry';
import type { PocketPreviewHandle } from './kit/worldKit';

/**
 * Development-only pocket-world preview registration.
 *
 * `main.ts` imports this module only behind `import.meta.env.DEV`, so ordinary
 * production builds contain neither the loaders nor any world chunk. Each
 * world module is itself lazy: `?preview=w02` fetches W02 alone.
 *
 * Preview sessions also run with an in-memory passport (see `main.ts`), so a
 * completed preview can exercise the real host completion path without ever
 * writing a persistent stamp.
 */

type Register = (registry: PocketWorldRegistry, onReady: (handle: PocketPreviewHandle) => void) => void;

export const DEV_PREVIEW_LOADERS: Readonly<Record<string, () => Promise<Register>>> = {
  w01: () => import('./w01/registerW01Preview').then((m) => (registry, onReady) => m.registerW01Preview(registry, { onReady: (handle) => onReady(handle) })),
  w02: () => import('./w02/registerW02Preview').then((m) => m.registerW02Preview as Register),
  w03: () => import('./w03/registerW03Preview').then((m) => m.registerW03Preview as Register),
  w04: () => import('./w04/registerW04Preview').then((m) => m.registerW04Preview as Register),
  w05: () => import('./w05/registerW05Preview').then((m) => m.registerW05Preview as Register),
  w06: () => import('./w06/registerW06Preview').then((m) => m.registerW06Preview as Register),
  w07: () => import('./w07/registerW07Preview').then((m) => m.registerW07Preview as Register),
  w08: () => import('./w08/registerW08Preview').then((m) => m.registerW08Preview as Register),
  w09: () => import('./w09/registerW09Preview').then((m) => m.registerW09Preview as Register),
  l01: () => import('./l01/registerL01Preview').then((m) => m.registerL01Preview as Register),
  w10: () => import('./w10/registerW10Preview').then((m) => m.registerW10Preview as Register),
};

export function previewIdsFromSearch(search: string): string[] {
  const raw = new URLSearchParams(search).get('preview');
  if (!raw) return [];
  const ids = raw.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.includes('all')) return Object.keys(DEV_PREVIEW_LOADERS);
  return ids.filter((id) => id in DEV_PREVIEW_LOADERS);
}

declare global {
  interface Window {
    __worldPreview?: Record<string, PocketPreviewHandle>;
    __worldPreviewRegistered?: string[];
  }
}

export async function registerDevPreviews(registry: PocketWorldRegistry, ids: readonly string[]): Promise<string[]> {
  const registered: string[] = [];
  window.__worldPreview ??= {};
  for (const id of ids) {
    const load = DEV_PREVIEW_LOADERS[id];
    if (!load) continue;
    try {
      const register = await load();
      register(registry, (handle) => { window.__worldPreview![id.toUpperCase()] = handle; });
      registered.push(id);
    } catch (error) {
      console.error(`[World Preview] ${id} failed to register`, error);
    }
  }
  window.__worldPreviewRegistered = registered;
  return registered;
}
