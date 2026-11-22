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
  type MusicCueSheet,
} from '../../src/audio/cueSheet';

/**
 * Test-only W01 configuration example (NO W01 gameplay, creatures, or shipped
 * production audio). Demonstrates:
 * - Three independent encounter cue sheets (`ray`, `sea-turtle`, `whale`)
 * - One coordinated multitrack finale cue sheet (`reef` & `cathedral` stem
 *   groups, beat grid, loop region, transition points, and end marker)
 * - In-memory generated test audio buffers registered strictly for tests.
 */
export const TEST_W01_AUDIO_ASSET_IDS = {
  ray: 'test-audio.w01.ray',
  seaTurtle: 'test-audio.w01.sea-turtle',
  whale: 'test-audio.w01.whale',
  finaleReefPad: 'test-audio.w01.finale-reef-pad',
  finaleReefPulse: 'test-audio.w01.finale-reef-pulse',
  finaleCathedralBrass: 'test-audio.w01.finale-cathedral-brass',
  finaleCathedralChoir: 'test-audio.w01.finale-cathedral-choir',
} as const;

const TEST_W01_SPECS: readonly {
  readonly id: string;
  readonly title: string;
  readonly frequencyHz: number;
  readonly durationSeconds: number;
}[] = [
  { id: TEST_W01_AUDIO_ASSET_IDS.ray, title: 'Test W01 Ray Cue Buffer', frequencyHz: 293.66, durationSeconds: 2.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.seaTurtle, title: 'Test W01 Sea-Turtle Cue Buffer', frequencyHz: 220.0, durationSeconds: 3.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.whale, title: 'Test W01 Whale Cue Buffer', frequencyHz: 110.0, durationSeconds: 4.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.finaleReefPad, title: 'Test W01 Finale Reef Pad', frequencyHz: 196.0, durationSeconds: 8.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.finaleReefPulse, title: 'Test W01 Finale Reef Pulse', frequencyHz: 392.0, durationSeconds: 8.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.finaleCathedralBrass, title: 'Test W01 Finale Cathedral Brass', frequencyHz: 261.63, durationSeconds: 8.0 },
  { id: TEST_W01_AUDIO_ASSET_IDS.finaleCathedralChoir, title: 'Test W01 Finale Cathedral Choir', frequencyHz: 523.25, durationSeconds: 8.0 },
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

export function buildTestW01EncounterCueSheets(): {
  readonly ray: MusicCueSheet;
  readonly seaTurtle: MusicCueSheet;
  readonly whale: MusicCueSheet;
} {
  return {
    ray: {
      version: MUSIC_CUE_SHEET_VERSION,
      id: 'test-w01-encounter-ray',
      title: 'Encounter Example: Ray',
      durationSeconds: 2.0,
      loop: false,
      beatGrid: { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } },
      stems: [
        { id: 'ray-lead', assetId: TEST_W01_AUDIO_ASSET_IDS.ray, defaultGain: 0.9 },
      ],
      cues: [
        { id: 'ray-glide-in', timeSeconds: 0, kind: 'cue', label: 'Test cue: ray silhouette glides past.' },
        { id: 'ray-crest', timeSeconds: 1.0, kind: 'transition', label: 'Test cue: ray banks upward.' },
        { id: 'ray-end', timeSeconds: 2.0, kind: 'end', label: 'Test cue: ray encounter fades.' },
      ],
      endMarkerSeconds: 2.0,
    },
    seaTurtle: {
      version: MUSIC_CUE_SHEET_VERSION,
      id: 'test-w01-encounter-sea-turtle',
      title: 'Encounter Example: Sea Turtle',
      durationSeconds: 3.0,
      loop: true,
      loopRegion: { id: 'turtle-drift-loop', startSeconds: 0.5, endSeconds: 3.0 },
      beatGrid: { bpm: 90, timeSignature: { numerator: 3, denominator: 4 } },
      stems: [
        { id: 'sea-turtle-theme', assetId: TEST_W01_AUDIO_ASSET_IDS.seaTurtle, defaultGain: 0.85 },
      ],
      cues: [
        { id: 'turtle-entry', timeSeconds: 0, kind: 'cue', label: 'Test cue: sea-turtle motif begins.' },
        { id: 'turtle-drift', timeSeconds: 1.5, kind: 'cue', label: 'Test cue: steady current pulse.' },
      ],
    },
    whale: {
      version: MUSIC_CUE_SHEET_VERSION,
      id: 'test-w01-encounter-whale',
      title: 'Encounter Example: Whale',
      durationSeconds: 4.0,
      loop: false,
      beatGrid: { bpm: 60, timeSignature: { numerator: 4, denominator: 4 } },
      stems: [
        { id: 'whale-call', assetId: TEST_W01_AUDIO_ASSET_IDS.whale, defaultGain: 1.0 },
      ],
      cues: [
        { id: 'whale-call-start', timeSeconds: 0, kind: 'cue', label: 'Test cue: deep whale call resonates.' },
        { id: 'whale-echo', timeSeconds: 2.0, kind: 'transition', label: 'Test cue: distant harmonic answer.' },
        { id: 'whale-end', timeSeconds: 4.0, kind: 'end', label: 'Test cue: whale call settles into silence.' },
      ],
      endMarkerSeconds: 4.0,
    },
  };
}

export function buildTestW01FinaleCueSheet(): MusicCueSheet {
  const beatGrid = { bpm: 120, timeSignature: { numerator: 4, denominator: 4 } } as const;
  return {
    version: MUSIC_CUE_SHEET_VERSION,
    id: 'test-w01-coordinated-finale',
    title: 'Coordinated Multitrack Finale Example',
    durationSeconds: 8.0,
    loop: true,
    loopRegion: { id: 'finale-cathedral-loop', startSeconds: 4.0, endSeconds: 8.0 },
    beatGrid,
    sections: [
      {
        id: 'reef',
        label: 'Reef opening passage',
        startSeconds: 0,
        endSeconds: 4.0,
        stemIds: ['reef-pad', 'reef-pulse'],
      },
      {
        id: 'cathedral',
        label: 'Cathedral harmonic convergence',
        startSeconds: 4.0,
        endSeconds: 8.0,
        stemIds: ['reef-pad', 'cathedral-brass', 'cathedral-choir'],
      },
    ],
    stems: [
      { id: 'reef-pad', assetId: TEST_W01_AUDIO_ASSET_IDS.finaleReefPad, groupId: 'reef', sectionId: 'reef', defaultGain: 1 },
      { id: 'reef-pulse', assetId: TEST_W01_AUDIO_ASSET_IDS.finaleReefPulse, groupId: 'reef', sectionId: 'reef', defaultGain: 0.7 },
      { id: 'cathedral-brass', assetId: TEST_W01_AUDIO_ASSET_IDS.finaleCathedralBrass, groupId: 'cathedral', sectionId: 'cathedral', defaultGain: 0 },
      { id: 'cathedral-choir', assetId: TEST_W01_AUDIO_ASSET_IDS.finaleCathedralChoir, groupId: 'cathedral', sectionId: 'cathedral', defaultGain: 0 },
    ],
    cues: [
      {
        id: 'reef-awakens',
        timeSeconds: barBeatToSeconds(beatGrid, 0, 0),
        kind: 'cue',
        sectionId: 'reef',
        label: 'Test cue: reef stems enter together.',
      },
      {
        id: 'reef-swell',
        timeSeconds: barBeatToSeconds(beatGrid, 1, 0),
        kind: 'cue',
        sectionId: 'reef',
        label: 'Test cue: reef pulse builds toward transition.',
      },
      {
        id: 'cathedral-entrance',
        timeSeconds: barBeatToSeconds(beatGrid, 2, 0),
        kind: 'transition',
        sectionId: 'cathedral',
        label: 'Test cue: cathedral stems crossfade into convergence.',
      },
      {
        id: 'cathedral-peak',
        timeSeconds: barBeatToSeconds(beatGrid, 3, 0),
        kind: 'cue',
        sectionId: 'cathedral',
        label: 'Test cue: full cathedral harmony.',
      },
      {
        id: 'finale-cycle-end',
        timeSeconds: barBeatToSeconds(beatGrid, 4, 0),
        kind: 'end',
        sectionId: 'cathedral',
        label: 'Test cue: finale phrase resolves.',
      },
    ],
    endMarkerSeconds: 8.0,
  };
}

/**
 * Install the test-only W01 audio manifest entries + in-memory generated tone
 * buffers onto an `AudioManager`. Returns a cleanup function that unregisters
 * the memory providers and restores the manifest registry to its previous state.
 */
export function installTestW01AudioFixture(audio: AudioManager): () => void {
  const snapshot: readonly AssetRecord[] = allAssets();
  const unbinds: Array<() => void> = [];

  for (const spec of TEST_W01_SPECS) {
    if (!getAsset(spec.id)) {
      registerAsset({
        id: spec.id,
        title: spec.title,
        kind: 'audio',
        source: 'original-museum',
        project: null,
        creator: 'Museum Test Fixture',
        license: 'Test-only in-memory generated tone buffer; never shipped.',
        budgetKB: 0,
        streamingGroup: 'shell',
        attribution: null,
      });
    }
    if (!audio.assetLoader.hasMemoryBuffer(spec.id)) {
      unbinds.push(
        audio.assetLoader.registerMemoryBuffer(spec.id, (ctx) =>
          createInMemoryTestToneBuffer(ctx, spec.frequencyHz, spec.durationSeconds)),
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
