# Music & Synchronization Foundation

Shared audio bus, synchronized multitrack music engine, declarative cue sheets,
and governed local audio asset loading across the Museum and ISLAND-05 pocket worlds.

## 1. Shared Audio Graph & Ownership

`src/audio/AudioManager.ts` owns the museum's single `AudioContext` and the single
bus tree:

```text
ambience sources ──▶ ambienceGain ──┐
SFX (ticks/chimes) ─▶ sfxGain     ───┼──▶ masterGain ──▶ AudioContext.destination
music stem graph ───▶ musicGain   ──┘
```

- **Muted-by-default startup:** `DEFAULT_PREFERENCES` initializes `masterVolume`,
  `ambienceVolume`, and `musicVolume` to `0`. `AudioContext` is never constructed
  before an explicit visitor gesture.
- **Independent mixing:** `masterGain` scales all output; `ambienceGain`,
  `sfxGain` (default `1`), and `musicGain` control their own domains independently.
  Muting preserves stored slider levels so unmuting restores the prior mix.
- **Single loop:** `App.variableUpdate(dt)` calls `audio.update(dt)` once per frame
  inside the single `Loop` owner (`src/app/Loop.ts`). Audio modules never create
  `requestAnimationFrame` or `setInterval`.
- **Cinema isolation:** Museum Cinema (`CinemaPlayback` / `YouTubePlayback` /
  `CinemaConsole`) retains its existing subtitle and sound policy unchanged.

## 2. Registering Local Audio Assets

All runtime audio files must be governed through `src/assets/manifest.ts`
(`kind: 'audio'`) and remain offline/standalone compatible (`file://` and CSP):

```ts
import themeStemUrl from './audio/my-theme-stem.ogg';
import { registerAsset } from '../assets/manifest';

registerAsset({
  id: 'pocket-example.theme-pad',
  title: 'Example Theme Pad',
  kind: 'audio',
  source: 'original-museum',
  project: null,
  creator: 'Museum of Me vNext',
  license: 'Original museum asset; owned by the project.',
  url: themeStemUrl,
  sourceHash: '...',
  processedHash: '...',
  budgetKB: 512,
  streamingGroup: 'shell',
  attribution: null,
});
```

- Use Vite static ES imports (`import stemUrl from './...'`) rather than external
  HTTP(S) URLs so both `dist/` and `dist-standalone` (`file://` data-URL inlining)
  resolve offline with zero remote requests.
- `AudioAssetLoader` (`src/audio/AudioAssetLoader.ts`) lazily fetches and decodes
  audio only when Web Audio is unlocked and music is audible (`masterVolume > 0`
  and `musicVolume > 0`).
- Concurrent consumers share one decoded `AudioBuffer` lease tied to `ResourceScope`.
  When all owning scopes dispose, decoded buffer references are evicted.
- Missing or corrupt files degrade safely to the silent logical timeline without
  throwing unhandled rejections or stalling a pocket world.
- **Digital silence detection:** `analyzeAudioBufferSilence(buffer)` checks decoded
  channel peaks (`threshold = 1e-6`). Silent stems are never treated as audible
  layers, skip source allocation cleanly, and emit one diagnostic warning without
  flagging `audioDegraded`. Source material containing confirmed digital silence
  (such as `W01`'s `vocals` stem — see
  [W01_MUSIC_SOURCE_PROVENANCE.md](W01_MUSIC_SOURCE_PROVENANCE.md)) must be excluded
  before public distribution.

## 3. Authoring & Validating Cue Sheets

`src/audio/cueSheet.ts` defines the versioned declarative format
(`MUSIC_CUE_SHEET_VERSION = 1`):

```ts
const sheet: MusicCueSheet = {
  version: 1,
  id: 'example-multitrack',
  title: 'Example Passage',
  durationSeconds: 16,
  defaultLoopRegionId: 'main-loop',
  loopRegions: [
    {
      id: 'main-loop',
      label: 'Primary groove repeat',
      startSeconds: 4,
      endSeconds: 14,
      crossfadeSeconds: 0.08,
    },
  ],
  beatGrid: { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } },
  sections: [
    { id: 'intro', startSeconds: 0, endSeconds: 4, stemIds: ['pad'] },
    { id: 'chorus', startSeconds: 4, endSeconds: 16, stemIds: ['pad', 'lead'] },
  ],
  stems: [
    { id: 'pad', assetId: 'pocket-example.pad', groupId: 'bed', sectionId: 'intro', defaultGain: 1 },
    { id: 'lead', assetId: 'pocket-example.lead', groupId: 'melody', sectionId: 'chorus', defaultGain: 0 },
  ],
  cues: [
    { id: 'intro-start', timeSeconds: 0, kind: 'cue', sectionId: 'intro', tags: ['stem-entry'], label: 'Warm pad swells in.' },
    { id: 'chorus-shift', timeSeconds: 4, kind: 'transition', sectionId: 'chorus', tags: ['stem-entry'], label: 'Lead enters.' },
    { id: 'loop-end', timeSeconds: 16, kind: 'end', sectionId: 'chorus' },
  ],
  endMarkerSeconds: 16,
};
```

`validateMusicCueSheet` / `assertValidMusicCueSheet` reject:
- unsupported `version` or empty `stems`
- duplicate stem, section, cue, or loop-region IDs
- negative or unordered cue timestamps (`cue[i].timeSeconds < cue[i - 1].timeSeconds`)
- invalid loop ranges (`endSeconds <= startSeconds` or `endSeconds > durationSeconds`), invalid `crossfadeSeconds >= (endSeconds - startSeconds) / 2`, or unknown `defaultLoopRegionId`
- unregistered or non-`audio` manifest assets, or remote URLs
- out-of-range cues, unknown `sectionId` / `stemIds`, invalid `tags`, and invalid beat grids

Beat & quantization helpers `beatOffsetToSeconds`, `barBeatToSeconds`,
`secondsToBeatPosition`, `nextBeatTimeSeconds`, `nextBarTimeSeconds`,
`resolveLoopRegionById`, `resolveDefaultLoopRegion`, and `nextMatchingCue` compute
exact musical boundaries from `beatGrid` and `cues`.

## 4. Synchronized Stems, Quantized Reveal, Loop Regions & Silent Timelines

`MusicSession` (`src/audio/MusicSession.ts`):

- **Exact transport origin (one synchronized clock):** All audible stems in a
  session start once from one captured `AudioContext.currentTime` anchor
  (`source.start(anchorCtxTime, offset)`). Progressive stem layers start together
  at `defaultGain: 0` and are revealed in sync via gain automation rather than
  restarted when discovered.
- **Quantized stem & group automation:** `scheduleStemGain`, `scheduleGroupGain`,
  and `scheduleMix` quantize gain transitions to `'immediate' | 'next-beat' |
  'next-bar' | 'next-cue' | 'time'` cleanly on both `audio-clock` and
  `silent-timeline` modes without restarting any `AudioBufferSourceNode`. Later
  schedules supersede overlapping stems/groups, `cancelScheduledMix` aborts
  pending transitions cleanly, and `onMixApplied` notifies subscribers on apply.
- **Immediate gain & crossfade helpers:** `setStemGain`, `setGroupGain`,
  `crossfadeTo`, `crossfadeStems`, and `audio.crossfadeMusic` cancel prior
  automation before scheduling ramps.
- **Named crossfade loop regions & loop release:** `loopRegion` / `loopRegions`
  with `crossfadeSeconds > 0` use dual-pass equal-power overlap (`Math.cos` /
  `Math.sin`) centered across the loop seam so non-zero reverberation tails and
  bar downbeats wrap with zero beat-phase drift and zero leaked retiring nodes.
  `setActiveLoopRegion(id | region | null)` switches regions live or releases
  looping (`null`) so the running transport flows straight past the old loop
  boundary into its natural outro (`endMarkerSeconds` → `'ended'`).
- **Audio clock vs silent timeline:** When `AudioContext` is running and
  `isMusicAudible()` is true, playback advances against `AudioContext.currentTime`
  (`timingSource === 'audio-clock'`). When muted (`masterVolume === 0` or
  `musicVolume === 0`) or Web Audio is unavailable/degraded, playback advances
  deterministically via `update(dt)` (`timingSource === 'silent-timeline'`), firing
  cues and accessible descriptions on schedule and attaching Web Audio sources at the
  live offset if unmuted mid-track.
- **Pause vs mute vs tab suspension:**
  - `pause()` / `resume()` preserves exact `positionSeconds` and cue cursor,
    recreating single-use `AudioBufferSourceNode`s without re-firing past cues.
  - `Lifecycle` tab-hide / blur (`autoPauseOnBlur`) and `webglcontextlost` freeze
    the transport via `audio.suspendForLifecycle()` / `resumeFromLifecycle()` so
    hidden wall time never causes timeline jumps or cue bursts.
- **Seek cue policy:** `seek(seconds, { cuePolicy })` documents two explicit modes:
  - `'skip'` (default): skips cues strictly before `targetSeconds` and fires cues
    from `targetSeconds` onward.
  - `'fire-crossed'`: fires unfired cues in `(oldPos, targetSeconds]` in order on
    forward seeks, and repositions cleanly on backward seeks.

## 5. Accessibility & Cue Descriptions

- `SettingsPanel` exposes a keyboard-accessible **Music** slider (`musicVolume`,
  `0%–100%`, `5%` step), persisted in `VisitorPreferences` (`PREFERENCES_VERSION = 4`).
- Migrating saved `v3` preferences preserves `masterVolume` and `ambienceVolume`
  and initializes `musicVolume: 0` without silently unmuting.
- Cues carrying `label` emit `MusicCueDescriptionEvent`s on both audible and
  muted/silent timelines:
  - `HUD.announce(...)` shows a non-flashing subtitle when `preferences.subtitles` is enabled
    (respecting `reducedMotion` / `html[data-motion='reduced']`).
  - `DomMirror` updates `#a11y-root`'s polite live region and steady `.a11y-music-status` block.

## 6. Pocket-World Scoped Ownership

Inside any pocket world (`src/world/pocket/types.ts`), prefer `ctx.createMusicSession`:

```ts
const session = ctx.createMusicSession(cueSheet);
await session.play();
```

`PocketWorldHost` binds the session to the world's `ResourceScope` and `AbortSignal`.
Exiting (`Back to Museum`, `Esc`, completion), aborting mid-load, or losing the
WebGL context automatically stops playback, cancels pending audio fetches,
disconnects owned nodes, removes callbacks, frees decoded buffer leases, and
restores museum ambience to the snapshot zone via `audio.resumeMuseumAmbience`.
