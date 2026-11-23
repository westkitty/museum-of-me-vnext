import {
  _resetAssetRegistry,
  allAssets,
  getAsset,
  registerAsset,
  type AssetRecord,
} from '../../src/assets/manifest';
import type { AudioManager } from '../../src/audio/AudioManager';
import {
  MUSIC_CUE_SHEET_VERSION,
  barBeatToSeconds,
  type MusicBeatGrid,
  type MusicCueSheet,
} from '../../src/audio/cueSheet';

/**
 * Test-only music configuration fixtures (NO W01 gameplay, creatures, or
 * shipped `.m4a`/`.ogg` production audio). Demonstrates:
 * - One synchronized W01 musical composition split into three audible stems
 *   (`bass`, `drums`, `other`) plus explicit omission of the verified-silent
 *   `vocals` layer, revealed progressively on one locked transport via gain
 *   automation (`bass` -> `+drums` -> `+other` -> coral-cathedral ensemble)
 *   and provisionally loop-mapped on 92 BPM 4/4 beat boundaries
 * - A compact deterministic single-composition 3-stem sheet for fast unit
 *   and Playwright stepping
 * - Generic museum gallery cross-session cue sheets for testing
 *   `audio.crossfadeMusic(sessionA, sessionB)` independently of W01.
 */
export const TEST_W01_AUDIO_ASSET_IDS = {
  bass: 'test-audio.w01.procession-bass',
  drums: 'test-audio.w01.procession-drums',
  other: 'test-audio.w01.procession-other',
  /** Registered strictly for unit testing digital-silence rejection; never played in W01 stems. */
  silentVocals: 'test-audio.w01.procession-silent-vocals',
} as const;

export const TEST_MUSEUM_GALLERY_ASSET_IDS = {
  atrium: 'test-audio.museum.gallery-atrium',
  hall: 'test-audio.museum.gallery-hall',
} as const;

interface TestAudioSpec {
  readonly id: string;
  readonly title: string;
  readonly frequencyHz: number | null;
  readonly durationSeconds: number;
}

const TEST_AUDIO_SPECS: readonly TestAudioSpec[] = [
  { id: TEST_W01_AUDIO_ASSET_IDS.bass, title: 'Test W01 Calypso Bass Stem', frequencyHz: 110.0, durationSeconds: 16.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.drums, title: 'Test W01 Calypso Drums Stem', frequencyHz: 196.0, durationSeconds: 16.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.other, title: 'Test W01 Calypso Other Instruments Stem', frequencyHz: 329.63, durationSeconds: 16.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.silentVocals, title: 'Test W01 Silent Vocals Stem (Excluded)', frequencyHz: null, durationSeconds: 16.0 },
  { id: TEST_MUSEUM_GALLERY_ASSET_IDS.atrium, title: 'Test Museum Gallery Atrium Passage', frequencyHz: 220.0, durationSeconds: 2.0 },
  { id: TEST_MUSEUM_GALLERY_ASSET_IDS.hall, title: 'Test Museum Gallery Hall Passage', frequencyHz: 293.66, durationSeconds: 3.0 },
];

export function createInMemoryTestToneBuffer(
  ctx: AudioContext,
  frequencyHz: number,
  durationSeconds: number,
  amplitude = 0.05,
): AudioBuffer {
  const sampleRate = Math.max(8000, ctx.sampleRate || 22050);
  const frameCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);
  const fadeSamples = Math.min(Math.floor(frameCount / 8), Math.round(sampleRate * 0.02));
  for (let i = 0; i < frameCount; i++) {
    const t = i / sampleRate;
    const env =
      i < fadeSamples
        ? i / Math.max(1, fadeSamples)
        : i > frameCount - fadeSamples
          ? (frameCount - i) / Math.max(1, fadeSamples)
          : 1;
    channel[i] = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude * env;
  }
  return buffer;
}

export function createInMemorySilentBuffer(
  ctx: AudioContext,
  durationSeconds: number,
): AudioBuffer {
  const sampleRate = Math.max(8000, ctx.sampleRate || 22050);
  const frameCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  return ctx.createBuffer(2, frameCount, sampleRate);
}

/**
 * Full-scale provisional cue sheet reflecting the verified acoustic measurements
 * of `Bouncier Tropical Calypso Groove` (`92 BPM`, 4/4, `166.698 s`, bar 0 at
 * `0.033 s`, 3 aligned audible stems — `vocals` confirmed digital silence and
 * omitted). Exact creature mappings and trigger timings remain provisional.
 */
export function buildTestW01ProcessionCueSheet(): MusicCueSheet {
  const beatGrid: MusicBeatGrid = {
    bpm: 92,
    timeSignature: { numerator: 4, denominator: 4 },
    offsetSeconds: 0.033,
  };
  return {
    version: MUSIC_CUE_SHEET_VERSION,
    id: 'test-w01-procession-arrangement',
    title: 'Provisional Single-Composition Stem Arrangement (W01 Test Fixture)',
    durationSeconds: 166.698,
    beatGrid,
    defaultLoopRegionId: 'exploration-loop',
    loopRegions: [
      {
        id: 'exploration-loop',
        label: 'Bars 8..40 (32 bars, centered equal-power 60 ms crossfade)',
        startSeconds: 20.902,
        endSeconds: 104.377,
        crossfadeSeconds: 0.06,
      },
      {
        id: 'full-cycle-loop',
        label: 'Bars 0..32 (32 bars, 120 ms crossfade)',
        startSeconds: 0.033,
        endSeconds: 83.508,
        crossfadeSeconds: 0.12,
      },
      {
        id: 'extended-loop',
        label: 'Bars 0..56 (56 bars, releasing to bars 56..63 outro)',
        startSeconds: 0.033,
        endSeconds: 146.114,
        crossfadeSeconds: 0.06,
      },
      {
        id: 'mid-groove-loop',
        label: 'Bars 20..52 (32 bars mid-piece vamp)',
        startSeconds: 52.205,
        endSeconds: 135.68,
        crossfadeSeconds: 0.06,
      },
    ],
    sections: [
      {
        id: 'stage-1-foundation',
        label: 'Provisional stage 1: bass foundation alone',
        startSeconds: 0,
        endSeconds: 20.902,
        stemIds: ['bass'],
      },
      {
        id: 'stage-2-rhythm',
        label: 'Provisional stage 2: drums join the locked groove',
        startSeconds: 20.902,
        endSeconds: 104.377,
        stemIds: ['bass', 'drums'],
      },
      {
        id: 'stage-3-ensemble',
        label: 'Provisional stage 3–4: other instruments & cathedral ensemble',
        startSeconds: 104.377,
        endSeconds: 166.698,
        stemIds: ['bass', 'drums', 'other'],
      },
    ],
    stems: [
      { id: 'bass', assetId: TEST_W01_AUDIO_ASSET_IDS.bass, groupId: 'rhythm-bed', defaultGain: 1 },
      { id: 'drums', assetId: TEST_W01_AUDIO_ASSET_IDS.drums, groupId: 'rhythm-bed', defaultGain: 0 },
      { id: 'other', assetId: TEST_W01_AUDIO_ASSET_IDS.other, groupId: 'melody-ensemble', defaultGain: 0 },
    ],
    cues: [
      {
        id: 'stage-1-bass-entry',
        timeSeconds: barBeatToSeconds(beatGrid, 0, 0),
        kind: 'cue',
        sectionId: 'stage-1-foundation',
        tags: ['stem-entry'],
        label: 'Test cue (provisional): bass opens along one synchronized timeline.',
      },
      {
        id: 'stage-2-drums-window',
        timeSeconds: barBeatToSeconds(beatGrid, 8, 0),
        kind: 'transition',
        sectionId: 'stage-2-rhythm',
        tags: ['stem-entry', 'loop-entry'],
        label: 'Test cue (provisional): percussion swells onto the locked bass pulse.',
      },
      {
        id: 'stage-3-other-window',
        timeSeconds: barBeatToSeconds(beatGrid, 24, 0),
        kind: 'transition',
        sectionId: 'stage-2-rhythm',
        tags: ['stem-entry'],
        label: 'Test cue (provisional): melodic instruments fill out the groove.',
      },
      {
        id: 'cathedral-ensemble-convergence',
        timeSeconds: barBeatToSeconds(beatGrid, 40, 0),
        kind: 'transition',
        sectionId: 'stage-3-ensemble',
        tags: ['choreography', 'ensemble'],
        label: 'Test cue (provisional): full ensemble converges beneath the coral cathedral.',
      },
      {
        id: 'outro-cadence-release',
        timeSeconds: barBeatToSeconds(beatGrid, 56, 0),
        kind: 'cue',
        sectionId: 'stage-3-ensemble',
        tags: ['choreography'],
        label: 'Test cue (provisional): final cadence begins settling toward rest.',
      },
      {
        id: 'composition-end',
        timeSeconds: 166.698,
        kind: 'end',
        sectionId: 'stage-3-ensemble',
        label: 'Test cue (provisional): instrumental resonance fades.',
      },
    ],
    endMarkerSeconds: 166.698,
  };
}

/**
 * Compact 12-second (6 bars @ 120 BPM, 4/4 = 2.0 s/bar) single-composition
 * three-stem fixture mirroring the same synchronized progressive-layering and
 * equal-power crossfade-loop design for fast unit and Playwright stepping.
 */
export function buildTestW01CompactCueSheet(): MusicCueSheet {
  const beatGrid: MusicBeatGrid = {
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
  };
  return {
    version: MUSIC_CUE_SHEET_VERSION,
    id: 'test-w01-compact-stems',
    title: 'Compact Single-Composition Stems Fixture',
    durationSeconds: 12.0,
    beatGrid,
    defaultLoopRegionId: 'main-groove-loop',
    loopRegions: [
      {
        id: 'main-groove-loop',
        label: 'Bars 1..5 equal-power crossfade loop (leaves outro bar 5..6)',
        startSeconds: 2.0,
        endSeconds: 10.0,
        crossfadeSeconds: 0.08,
      },
    ],
    sections: [
      { id: 'bass-opening', label: 'Bass only', startSeconds: 0, endSeconds: 2.0, stemIds: ['bass'] },
      { id: 'groove-body', label: 'Layered stems', startSeconds: 2.0, endSeconds: 10.0, stemIds: ['bass', 'drums', 'other'] },
      { id: 'cathedral-outro', label: 'Natural outro cadence', startSeconds: 10.0, endSeconds: 12.0, stemIds: ['bass', 'drums', 'other'] },
    ],
    stems: [
      { id: 'bass', assetId: TEST_W01_AUDIO_ASSET_IDS.bass, groupId: 'rhythm', sectionId: 'bass-opening', defaultGain: 1 },
      { id: 'drums', assetId: TEST_W01_AUDIO_ASSET_IDS.drums, groupId: 'rhythm', sectionId: 'groove-body', defaultGain: 0 },
      { id: 'other', assetId: TEST_W01_AUDIO_ASSET_IDS.other, groupId: 'harmony', sectionId: 'groove-body', defaultGain: 0 },
    ],
    cues: [
      {
        id: 'bass-alone-start',
        timeSeconds: barBeatToSeconds(beatGrid, 0, 0),
        kind: 'cue',
        sectionId: 'bass-opening',
        tags: ['stem-entry'],
        label: 'Test cue: bass introduces the groove alone.',
      },
      {
        id: 'drums-entry-cue',
        timeSeconds: barBeatToSeconds(beatGrid, 1, 0),
        kind: 'transition',
        sectionId: 'groove-body',
        tags: ['stem-entry'],
        label: 'Test cue: drums enter on the locked transport.',
      },
      {
        id: 'other-entry-cue',
        timeSeconds: barBeatToSeconds(beatGrid, 2, 0),
        kind: 'transition',
        sectionId: 'groove-body',
        tags: ['stem-entry'],
        label: 'Test cue: other instruments complete the composition.',
      },
      {
        id: 'ensemble-choreo-cue',
        timeSeconds: barBeatToSeconds(beatGrid, 3, 0),
        kind: 'cue',
        sectionId: 'groove-body',
        tags: ['choreography'],
        label: 'Test cue: synchronized ensemble pulse peaks.',
      },
      {
        id: 'loop-seam-bar-5',
        timeSeconds: barBeatToSeconds(beatGrid, 5, 0),
        kind: 'cue',
        sectionId: 'cathedral-outro',
        tags: ['loop-boundary'],
        label: 'Test cue: phrase resolves into outro.',
      },
      {
        id: 'compact-end',
        timeSeconds: 12.0,
        kind: 'end',
        sectionId: 'cathedral-outro',
        label: 'Test cue: final decay finishes.',
      },
    ],
    endMarkerSeconds: 12.0,
  };
}

/**
 * Generic museum-wide two-session fixture for verifying `audio.crossfadeMusic`
 * across galleries/exhibits independently of W01.
 */
export function buildTestMuseumCrossfadeCueSheets(): {
  readonly atrium: MusicCueSheet;
  readonly hall: MusicCueSheet;
} {
  return {
    atrium: {
      version: MUSIC_CUE_SHEET_VERSION,
      id: 'test-museum-gallery-atrium',
      title: 'Test Museum Gallery Atrium',
      durationSeconds: 2.0,
      loop: false,
      beatGrid: { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } },
      stems: [
        { id: 'atrium-bed', assetId: TEST_MUSEUM_GALLERY_ASSET_IDS.atrium, defaultGain: 1 },
      ],
      cues: [
        { id: 'atrium-start', timeSeconds: 0, kind: 'cue', label: 'Test cue: atrium resonance begins.' },
        { id: 'atrium-mid', timeSeconds: 1.0, kind: 'transition', label: 'Test cue: atrium motif shifts.' },
        { id: 'atrium-end', timeSeconds: 2.0, kind: 'end', label: 'Test cue: atrium phrase ends.' },
      ],
      endMarkerSeconds: 2.0,
    },
    hall: {
      version: MUSIC_CUE_SHEET_VERSION,
      id: 'test-museum-gallery-hall',
      title: 'Test Museum Gallery Hall',
      durationSeconds: 3.0,
      loop: true,
      loopRegion: { id: 'hall-loop', startSeconds: 0.5, endSeconds: 3.0 },
      beatGrid: { bpm: 90, timeSignature: { numerator: 3, denominator: 4 } },
      stems: [
        { id: 'hall-theme', assetId: TEST_MUSEUM_GALLERY_ASSET_IDS.hall, defaultGain: 0.85 },
      ],
      cues: [
        { id: 'hall-entry', timeSeconds: 0, kind: 'cue', label: 'Test cue: hall theme enters.' },
        { id: 'hall-cadence', timeSeconds: 1.5, kind: 'cue', label: 'Test cue: hall cadence turns.' },
      ],
    },
  };
}

/**
 * Install the test-only audio manifest entries + in-memory buffers onto an
 * `AudioManager`. Returns a cleanup function restoring prior registry state.
 */
export function installTestW01AudioFixture(audio: AudioManager): () => void {
  const snapshot: readonly AssetRecord[] = allAssets();
  const unbinds: Array<() => void> = [];

  for (const spec of TEST_AUDIO_SPECS) {
    if (!getAsset(spec.id)) {
      registerAsset({
        id: spec.id,
        title: spec.title,
        kind: 'audio',
        source: 'original-museum',
        project: null,
        creator: 'Museum Test Fixture',
        license: 'Test-only in-memory audio buffer; never shipped.',
        budgetKB: 0,
        streamingGroup: 'shell',
        attribution: null,
      });
    }
    if (!audio.assetLoader.hasMemoryBuffer(spec.id)) {
      unbinds.push(
        audio.assetLoader.registerMemoryBuffer(spec.id, (ctx) => (
          spec.frequencyHz === null
            ? createInMemorySilentBuffer(ctx, spec.durationSeconds)
            : createInMemoryTestToneBuffer(ctx, spec.frequencyHz, spec.durationSeconds)
        )),
      );
    }
  }

  return () => {
    for (const off of unbinds) off();
    _resetAssetRegistry();
    for (const record of snapshot) {
      registerAsset(record);
    }
  };
}
