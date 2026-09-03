import { registerAsset } from './manifest';

/** Local iframe entry point for E27's complete first-party artifact. */
export const FULL_WEASEL_ENTRY = './embedded/full-weasel/index.html';
export const FULL_WEASEL_TREE_SHA256 = '1264138dd16bce815f761c7b8cd22708ef6d0fba703b6f6b1dd1e32fd99937ce';

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
    budgetKB: 131488, streamingGroup: 'exhibit:E27',
    attribution: 'The Full Weasel by westkitty — locally bundled first-party artifact.',
  });
}
