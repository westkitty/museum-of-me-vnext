import { registerAsset } from './manifest';

let registered = false;

/**
 * The Museum Cinema's file-backed media. The films are the Full Weasel's own
 * background loops, already shipped inside the governed `full-weasel-complete`
 * artifact (docs/FULL_WEASEL_PROVENANCE.md); the cinema reads them in place and
 * fetches one only when a visitor chooses it. The poster frames are derived
 * from those films (one frame at 3 s each). Per-file SHA-256 hashes live in
 * data/cinema/programme.json and are checked by tests/cinema.test.ts.
 */
export function registerCinemaAssets(): void {
  if (registered) return;
  registered = true;
  registerAsset({
    id: 'cinema-programme-films',
    title: 'Museum Cinema programme — The Full Weasel background loops (8 unique films)',
    kind: 'bundle', source: 'authentic:P039', project: 'P039', creator: 'westkitty',
    license: 'Unlicense / public-domain dedication stated by the canonical first-party repository.',
    url: 'embedded/full-weasel/assets/backgrounds/',
    budgetKB: 23_050, streamingGroup: 'cinema',
    attribution: 'The Full Weasel by westkitty — first-party background loops, shown as shipped.',
  });
  registerAsset({
    id: 'cinema-youtube-screenings',
    title: 'Museum Cinema YouTube screenings (external, online only, after visitor consent)',
    kind: 'bundle', source: 'external', project: null, creator: 'Each film\'s YouTube uploader, as credited in the programme',
    license: 'Streamed by YouTube under its terms through the official embed player; nothing is downloaded, cached or proxied by the museum.',
    url: 'https://www.youtube-nocookie.com/embed/',
    budgetKB: 0, streamingGroup: 'cinema',
    attribution: 'Plays from YouTube. Title and channel are shown for every screening.',
  });
  registerAsset({
    id: 'cinema-programme-posters',
    title: 'Museum Cinema poster frames (one frame at 3 s from each programme film)',
    kind: 'texture', source: 'derived:P039', project: 'P039', creator: 'westkitty',
    license: 'Unlicense / public-domain dedication stated by the canonical first-party repository.',
    url: 'cinema/posters/',
    budgetKB: 200, streamingGroup: 'cinema',
    attribution: null,
  });
}
