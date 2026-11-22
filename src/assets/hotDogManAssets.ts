import { registerAsset } from './manifest';

import hotDogManUrl from './npc/hotdog-man.glb';

export const HOT_DOG_MAN_ASSET_ID = 'hotdog-man';

/** SHA-256 of the shipped GLB (byte-identical to the verified DEX//SCULPT source). */
export const HOT_DOG_MAN_SHA256 = '43a97ad1a349e139e7ffbc224774514c2cfe0d3c35fe1d60ff97c79f48f9eee9';
export const HOT_DOG_MAN_BYTES = 1_580_256;

let registered = false;

/**
 * ISLAND-04: Hot Dog Man, owner-approved operator of the rooftop hot dog stand.
 * One CC0 Polygonal Mind avatar shipped unmodified; provenance in
 * docs/HOT_DOG_MAN_ASSET_PROVENANCE.md. Loaded lazily by the rooftop through
 * AssetManager; never fetched from a remote host.
 */
export function registerHotDogManAssets(): void {
  if (registered) return;
  registered = true;
  registerAsset({
    id: 'hotdog-man',
    title: 'Hot Dog Man (Polygonal Mind 100 Avatars R1, #87 Hotdog)',
    kind: 'glb', source: 'external', project: null, creator: 'Polygonal Mind',
    license: 'CC0 1.0 Universal; official Polygonal Mind 100 Avatars Round 1 release.',
    url: hotDogManUrl,
    sourceHash: HOT_DOG_MAN_SHA256,
    processedHash: HOT_DOG_MAN_SHA256,
    budgetKB: 1544, streamingGroup: 'exterior-npc',
    attribution: 'Polygonal Mind — 100 Avatars Round 1, #87 Hotdog (CC0).',
  });
}
