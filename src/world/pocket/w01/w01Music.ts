import w01BassUrl from '../../../assets/audio/w01-bass.m4a';
import w01DrumsUrl from '../../../assets/audio/w01-drums.m4a';
import w01OtherUrl from '../../../assets/audio/w01-other.m4a';
import { getAsset, registerAsset } from '../../../assets/manifest';
import {
  barBeatToSeconds,
  MUSIC_CUE_SHEET_VERSION,
  type MusicBeatGrid,
  type MusicCueSheet,
} from '../../../audio/cueSheet';
import type { W01MusicSourceMode } from './types';

export const W01_STEM_ASSET_IDS = {
  bass: 'w01-bass',
  drums: 'w01-drums',
  other: 'w01-other',
} as const;

const W01_STEM_HASHES = {
  bass: {
    sourceHash: 'ac4cc3dc21dd9023f8a705854c7cc8b2c8760da533296a8c952fa6844b5add3d',
    processedHash: 'aa871189bd018422e74ae1d4745103ec9397469495554cf031153561d1105196',
    budgetKB: 1200,
  },
  drums: {
    sourceHash: '092cd41e5ecc4b7d29fa0fcf551c144e130f1210473609bd3edc2443d1dd50b7',
    processedHash: 'ef77d1962adc355818501f0bd1a6a3b213595d2399302aed21bda58e99de286d',
    budgetKB: 1200,
  },
  other: {
    sourceHash: '53e3254ac511dce3f9533e0c08596d726cbccdde6261f04b3c88f47e2b747a69',
    processedHash: '3a125859139f33d5c6dcdd013376f3e8547d457618714fe8388343ed2df9992b',
    budgetKB: 1200,
  },
} as const;

export function ensureW01AudioAssetsRegistered(): void {
  if (!getAsset(W01_STEM_ASSET_IDS.bass)) {
    registerAsset({
      id: 'w01-bass',
      title: 'W01 Great Ocean Procession — Bass Stem',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Andrew (Museum of Me owner)',
      license: 'Original owner-authored music; owned by the project.',
      url: w01BassUrl,
      sourceHash: W01_STEM_HASHES.bass.sourceHash,
      processedHash: W01_STEM_HASHES.bass.processedHash,
      budgetKB: W01_STEM_HASHES.bass.budgetKB,
      streamingGroup: 'shell',
      attribution: null,
    });
  }
  if (!getAsset(W01_STEM_ASSET_IDS.drums)) {
    registerAsset({
      id: 'w01-drums',
      title: 'W01 Great Ocean Procession — Drums Stem',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Andrew (Museum of Me owner)',
      license: 'Original owner-authored music; owned by the project.',
      url: w01DrumsUrl,
      sourceHash: W01_STEM_HASHES.drums.sourceHash,
      processedHash: W01_STEM_HASHES.drums.processedHash,
      budgetKB: W01_STEM_HASHES.drums.budgetKB,
      streamingGroup: 'shell',
      attribution: null,
    });
  }
  if (!getAsset(W01_STEM_ASSET_IDS.other)) {
    registerAsset({
      id: 'w01-other',
      title: 'W01 Great Ocean Procession — Other Instruments Stem',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Andrew (Museum of Me owner)',
      license: 'Original owner-authored music; owned by the project.',
      url: w01OtherUrl,
      sourceHash: W01_STEM_HASHES.other.sourceHash,
      processedHash: W01_STEM_HASHES.other.processedHash,
      budgetKB: W01_STEM_HASHES.other.budgetKB,
      streamingGroup: 'shell',
      attribution: null,
    });
  }
}

export async function resolveW01MusicSourceMode(signal: AbortSignal): Promise<W01MusicSourceMode> {
  if (signal.aborted) {
    throw new DOMException('W01 load aborted', 'AbortError');
  }
  return 'bundled-original';
}

export function buildW01ProcessionCueSheet(_mode: W01MusicSourceMode = 'bundled-original'): MusicCueSheet {
  const beatGrid: MusicBeatGrid = {
    bpm: 92,
    timeSignature: { numerator: 4, denominator: 4 },
    offsetSeconds: 0.033,
  };

  return {
    version: MUSIC_CUE_SHEET_VERSION,
    id: 'w01-great-ocean-procession',
    title: 'W01: The Great Ocean Procession',
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
    ],
    sections: [
      {
        id: 'stage-1-foundation',
        label: 'Stage 1: Bass foundation',
        startSeconds: 0,
        endSeconds: 20.902,
        stemIds: ['bass'],
      },
      {
        id: 'stage-2-rhythm',
        label: 'Stage 2–3: Exploration loop',
        startSeconds: 20.902,
        endSeconds: 104.377,
        stemIds: ['bass', 'drums', 'other'],
      },
      {
        id: 'stage-4-cathedral',
        label: 'Stage 4: Coral Cathedral finale',
        startSeconds: 104.377,
        endSeconds: 166.698,
        stemIds: ['bass', 'drums', 'other'],
      },
    ],
    stems: [
      { id: 'bass', assetId: W01_STEM_ASSET_IDS.bass, groupId: 'rhythm-bed', defaultGain: 1 },
      { id: 'drums', assetId: W01_STEM_ASSET_IDS.drums, groupId: 'rhythm-bed', defaultGain: 0 },
      { id: 'other', assetId: W01_STEM_ASSET_IDS.other, groupId: 'melody-ensemble', defaultGain: 0 },
    ],
    cues: [
      {
        id: 'stage-1-bass-pulse',
        timeSeconds: barBeatToSeconds(beatGrid, 0, 0),
        kind: 'cue',
        sectionId: 'stage-1-foundation',
        tags: ['stem-entry'],
        label: 'Deep bass currents pulse beneath the lagoon.',
      },
      {
        id: 'exploration-loop-entry',
        timeSeconds: barBeatToSeconds(beatGrid, 8, 0),
        kind: 'transition',
        sectionId: 'stage-2-rhythm',
        tags: ['loop-entry'],
        label: 'The ocean procession settles into a steady tidal groove.',
      },
      {
        id: 'cathedral-swell',
        timeSeconds: barBeatToSeconds(beatGrid, 40, 0),
        kind: 'transition',
        sectionId: 'stage-4-cathedral',
        tags: ['choreography', 'ensemble'],
        label: 'The full ensemble swells toward the Coral Cathedral.',
      },
      {
        id: 'finale-cadence',
        timeSeconds: barBeatToSeconds(beatGrid, 56, 0),
        kind: 'cue',
        sectionId: 'stage-4-cathedral',
        tags: ['choreography'],
        label: 'Harmonic currents settle into calm resonance.',
      },
      {
        id: 'composition-end',
        timeSeconds: 166.698,
        kind: 'end',
        sectionId: 'stage-4-cathedral',
        label: 'The ocean procession rests.',
      },
    ],
    endMarkerSeconds: 166.698,
  };
}
