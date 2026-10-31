import { registerAsset } from './manifest';

/** Local iframe entry point for E27's complete first-party artifact. */
export const FULL_WEASEL_ENTRY = './embedded/full-weasel/index.html';
export const FULL_WEASEL_TREE_SHA256 = '005090d888adbe4262ad2b483962332972fbea5571e770b79e9eb5c90841007d';

let registered = false;

export function registerFullWeaselArtifact(): void {
  if (registered) return;
  registered = true;
  registerAsset({
    id: 'full-weasel-complete',
    title: 'The Full Weasel — complete embedded first-party build',
    kind: 'bundle', source: 'authentic:P039', project: 'P039', creator: 'westkitty',
    license: 'Unlicense / public-domain dedication stated by the canonical first-party repository.',
    url: FULL_WEASEL_ENTRY,
    // This is the deterministic tree hash of the Museum-owned production copy.
    processedHash: FULL_WEASEL_TREE_SHA256,
    budgetKB: 89524, streamingGroup: 'exhibit:E27',
    attribution: 'The Full Weasel by westkitty — locally bundled first-party artifact.',
  });
}
