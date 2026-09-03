import { registerAsset } from './manifest';

import menCasualUrl from './npc/quaternius-men-casual.glb';
import womenCasualUrl from './npc/quaternius-women-casual.glb';
import posedSittingUrl from './npc/quaternius-posed-sitting.glb';

export const QUATERNIUS_ASSET_IDS = {
  menCasual: 'quaternius-men-casual',
  womenCasual: 'quaternius-women-casual',
  posedSitting: 'quaternius-posed-sitting',
} as const;

let registered = false;

/**
 * The selected runtime subset of the approved Quaternius packs.
 *
 * Original acquisition files remain outside public output in the ignored
 * `.asset-sources/` store; every runtime file below is a closed GLB produced
 * from one identified source file. The provenance ledger records the exact
 * official page/download chain and deterministic conversion command.
 */
export function registerQuaterniusAssets(): void {
  if (registered) return;
  registered = true;

  registerAsset({
    id: 'quaternius-men-casual',
    title: 'Quaternius Ultimate Modular Men — Casual',
    kind: 'glb', source: 'external', project: null, creator: 'Quaternius',
    license: 'CC0 1.0 Universal; official Quaternius distribution.',
    url: menCasualUrl,
    sourceHash: '55c654d09a2a5ff6e3bd6158d4a1b462f181cd6f1e12a0f5e9d959f9c3abc438',
    processedHash: 'cb5a335837288e2a2be7a9d3e1e7f0755723384f6e8763acdd24a55f49fe2779',
    budgetKB: 2528, streamingGroup: 'shell',
    attribution: 'Quaternius — Ultimate Modular Men Pack (CC0).',
  });
  registerAsset({
    id: 'quaternius-women-casual',
    title: 'Quaternius Ultimate Modular Women — Casual',
    kind: 'glb', source: 'external', project: null, creator: 'Quaternius',
    license: 'CC0 1.0 Universal; official Quaternius distribution.',
    url: womenCasualUrl,
    sourceHash: 'b0fe6e92219cd71808844a20a1a8b960fd1cf640a6546dc6362b5add6604e87c',
    processedHash: '6e20483dad0a557b294844f299438278a8c9fa8d894fdebe39fac44dde8ba8a5',
    budgetKB: 2568, streamingGroup: 'shell',
    attribution: 'Quaternius — Ultimate Modular Women Pack (CC0).',
  });
  registerAsset({
    id: 'quaternius-posed-sitting',
    title: 'Quaternius Background Posed Humans — Sitting',
    kind: 'glb', source: 'external', project: null, creator: 'Quaternius',
    license: 'CC0 1.0 Universal; official Quaternius distribution.',
    url: posedSittingUrl,
    sourceHash: '3239140d393bab68bee18fa7fffe9336f872ce6c91025f626583d9159b4c8907',
    processedHash: '06e2962f7b965121f9d83aff843db4ca858d8a1edfaca99b9a79eaf09c8acf2f',
    budgetKB: 164, streamingGroup: 'shell',
    attribution: 'Quaternius — Background Posed Humans Pack (CC0).',
  });
}
