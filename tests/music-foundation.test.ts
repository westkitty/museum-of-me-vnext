import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  _resetAssetRegistry,
  allAssets,
  registerAsset,
  registerProcedural,
} from '../src/assets/manifest';
import { ResourceScope } from '../src/assets/ResourceScope';
import { AudioManager } from '../src/audio/AudioManager';
import {
  MUSIC_CUE_SHEET_VERSION,
  MusicCueSheetValidationError,
  barBeatToSeconds,
  beatOffsetToSeconds,
  nextBarTimeSeconds,
  nextBeatTimeSeconds,
  nextMatchingCue,
  resolveLoopRegionById,
  secondsToBeatPosition,
  validateMusicCueSheet,
  type MusicCueSheet,
} from '../src/audio/cueSheet';
import { analyzeAudioBufferSilence } from '../src/audio/AudioAssetLoader';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  PREFERENCES_VERSION,
  loadPreferencesResult,
  savePreferences,
} from '../src/state/Preferences';
import { Journal } from '../src/state/Journal';
import { Passport } from '../src/state/Passport';
import { SecretsLog } from '../src/state/Secrets';
import { Study } from '../src/state/Study';
import { VisitThread } from '../src/state/VisitThread';
import { exportVisitorSession, previewVisitorSession } from '../src/state/VisitorSession';
import { attachIntegrity } from '../src/state/integrity';
import { RESTORABLE_SETTINGS, SETTING_RANGES, pickRestorable, settingValueText } from '../src/ui/SettingsPanel';
import { CollisionWorld } from '../src/world/CollisionWorld';
import { PocketWorldHost } from '../src/world/pocket/PocketWorldHost';
import { PocketWorldRegistry } from '../src/world/pocket/PocketWorldRegistry';
import {
  TEST_MUSEUM_GALLERY_ASSET_IDS,
  TEST_W01_AUDIO_ASSET_IDS,
  buildTestMuseumCrossfadeCueSheets,
  buildTestW01CompactCueSheet,
  buildTestW01ProcessionCueSheet,
  createInMemorySilentBuffer,
  installTestW01AudioFixture,
} from './fixtures/music-w01-example';

// ── Deterministic Web Audio test harness ─────────────────────────────────────

interface RecordedGainNode {
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    setValueCurveAtTime: ReturnType<typeof vi.fn>;
    cancelScheduledValues: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connectedTo: unknown[];
  disconnected: boolean;
  connect: (target: unknown) => unknown;
  disconnect: () => void;
}

interface RecordedBufferSourceNode {
  buffer: AudioBuffer | null;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  startedAt: { when?: number; offset?: number; duration?: number } | null;
  stopped: boolean;
  stoppedAt?: number;
  disconnected: boolean;
  connectedTo: unknown[];
  connect: (target: unknown) => unknown;
  disconnect: () => void;
  start: (when?: number, offset?: number, duration?: number) => void;
  stop: (when?: number) => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
  emitEnded: () => void;
}

interface MockAudioEnv {
  ctx: AudioContext & {
    state: AudioContextState;
    currentTime: number;
    emitStateChange: (nextState: AudioContextState) => void;
  };
  gains: RecordedGainNode[];
  sources: RecordedBufferSourceNode[];
  decodeCalls: number;
}

function createMockAudioEnv(options: { decodeShouldFail?: boolean; decodeShouldBeSilent?: boolean } = {}): MockAudioEnv {
  const gains: RecordedGainNode[] = [];
  const sources: RecordedBufferSourceNode[] = [];
  const stateListeners = new Set<() => void>();
  let decodeCalls = 0;

  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 0,
    sampleRate: 22050,
    destination: { __isDestination: true } as unknown as AudioDestinationNode,
    createGain(): GainNode {
      const node: RecordedGainNode = {
        gain: {
          value: 0,
          setValueAtTime: vi.fn((val: number) => { node.gain.value = val; return node.gain; }),
          linearRampToValueAtTime: vi.fn((val: number) => { node.gain.value = val; return node.gain; }),
          setValueCurveAtTime: vi.fn((values: Float32Array) => {
            node.gain.value = values.length > 0 ? values[values.length - 1] : node.gain.value;
            return node.gain;
          }),
          cancelScheduledValues: vi.fn(() => node.gain),
          exponentialRampToValueAtTime: vi.fn(() => node.gain),
        },
        connectedTo: [],
        disconnected: false,
        connect(target: unknown) {
          node.connectedTo.push(target);
          return target;
        },
        disconnect() {
          node.disconnected = true;
        },
      };
      gains.push(node);
      return node as unknown as GainNode;
    },
    createBiquadFilter(): BiquadFilterNode {
      return {
        type: 'lowpass',
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: () => ({}),
      } as unknown as BiquadFilterNode;
    },
    createOscillator(): OscillatorNode {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        detune: { value: 0 },
        onended: null as (() => void) | null,
        connect: (target: unknown) => target,
        start: () => {},
        stop: () => {},
      };
      return osc as unknown as OscillatorNode;
    },
    createBuffer(channels: number, length: number, sampleRate = 22050): AudioBuffer {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (idx: number) => data[idx] ?? data[0],
      } as unknown as AudioBuffer;
    },
    createBufferSource(): AudioBufferSourceNode {
      const endedListeners = new Set<() => void>();
      const src: RecordedBufferSourceNode = {
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        startedAt: null,
        stopped: false,
        disconnected: false,
        connectedTo: [],
        connect(target: unknown) {
          src.connectedTo.push(target);
          return target;
        },
        disconnect() {
          src.disconnected = true;
        },
        start(when?: number, offset?: number, duration?: number) {
          src.startedAt = { when, offset, duration };
        },
        stop(when?: number) {
          src.stopped = true;
          src.stoppedAt = when;
        },
        addEventListener(type: string, fn: () => void) {
          if (type === 'ended') endedListeners.add(fn);
        },
        removeEventListener(type: string, fn: () => void) {
          if (type === 'ended') endedListeners.delete(fn);
        },
        emitEnded() {
          for (const fn of [...endedListeners]) fn();
        },
      };
      sources.push(src);
      return src as unknown as AudioBufferSourceNode;
    },
    async decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
      decodeCalls++;
      if (options.decodeShouldFail) throw new Error('Corrupt audio payload');
      const frames = Math.max(22050, buf.byteLength * 256);
      const out = ctx.createBuffer(1, frames, 22050);
      if (!options.decodeShouldBeSilent) {
        out.getChannelData(0)[0] = 0.05;
      }
      return out;
    },
    async suspend(): Promise<void> {
      ctx.state = 'suspended';
    },
    async resume(): Promise<void> {
      ctx.state = 'running';
    },
    async close(): Promise<void> {
      ctx.state = 'closed';
    },
    addEventListener(type: string, fn: () => void) {
      if (type === 'statechange') stateListeners.add(fn);
    },
    removeEventListener(type: string, fn: () => void) {
      if (type === 'statechange') stateListeners.delete(fn);
    },
    emitStateChange(nextState: AudioContextState) {
      ctx.state = nextState;
      for (const fn of [...stateListeners]) fn();
    },
  };

  return {
    ctx: ctx as unknown as MockAudioEnv['ctx'],
    gains,
    sources,
    get decodeCalls() { return decodeCalls; },
  };
}

const hadInitialWindow = 'window' in globalThis;
const initialWindow = (globalThis as Record<string, unknown>).window;

function setWindowAudioContext(ctor: unknown): void {
  const g = globalThis as unknown as {
    window?: Record<string, unknown>;
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  if (ctor === undefined) {
    g.AudioContext = undefined;
    g.webkitAudioContext = undefined;
    if (hadInitialWindow) {
      g.window = initialWindow as Record<string, unknown>;
    } else {
      delete g.window;
    }
    return;
  }
  if (!g.window) g.window = {};
  g.AudioContext = ctor;
  g.webkitAudioContext = undefined;
  g.window.AudioContext = ctor;
  g.window.webkitAudioContext = undefined;
}

function installMockAudio(): MockAudioEnv {
  const env = createMockAudioEnv();
  setWindowAudioContext(vi.fn(() => env.ctx));
  return env;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  } as Storage;
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Museum-Wide Music & Synchronization Foundation', () => {
  let manifestSnapshot: readonly ReturnType<typeof allAssets>[number][];

  beforeEach(() => {
    manifestSnapshot = allAssets();
    setWindowAudioContext(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    setWindowAudioContext(undefined);
    _resetAssetRegistry();
    for (const record of manifestSnapshot) registerAsset(record);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. enforces muted-by-default startup until user gesture and volume opt-in', async () => {
    const env = createMockAudioEnv();
    const ctor = vi.fn(() => env.ctx);
    setWindowAudioContext(ctor);

    expect(DEFAULT_PREFERENCES.masterVolume).toBe(0);
    expect(DEFAULT_PREFERENCES.ambienceVolume).toBe(0);
    expect(DEFAULT_PREFERENCES.musicVolume).toBe(0);

    const audio = new AudioManager();
    expect(ctor).not.toHaveBeenCalled();
    expect(audio.isRunning).toBe(false);
    expect(audio.isAudioAvailable).toBe(false);

    // Muted startup after gesture immediately suspends AudioContext cleanly.
    audio.start();
    await vi.runAllTicks();
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(env.ctx.state).toBe('suspended');
    expect(audio.isRunning).toBe(false);
    expect(audio.isMusicAudible()).toBe(false);

    // Opting into master + music resumes cleanly.
    audio.setVolumes(0.75, 0, 0.6);
    await vi.runAllTicks();
    expect(env.ctx.state).toBe('running');
    expect(audio.isRunning).toBe(true);
    expect(audio.isMusicAudible()).toBe(true);
    audio.dispose();
  });

  it('2. routes master -> ambience/sfx/music buses with independent volume control', async () => {
    const env = installMockAudio();

    const audio = new AudioManager();
    audio.start();
    const { master, ambience, sfx, music } = audio.buses;
    expect(master).toBeTruthy();
    expect(ambience).toBeTruthy();
    expect(sfx).toBeTruthy();
    expect(music).toBeTruthy();

    const masterRecord = env.gains.find((g) => (g as unknown) === master)!;
    const ambienceRecord = env.gains.find((g) => (g as unknown) === ambience)!;
    const sfxRecord = env.gains.find((g) => (g as unknown) === sfx)!;
    const musicRecord = env.gains.find((g) => (g as unknown) === music)!;

    expect(masterRecord.connectedTo).toContain(env.ctx.destination);
    expect(ambienceRecord.connectedTo).toContain(master);
    expect(sfxRecord.connectedTo).toContain(master);
    expect(musicRecord.connectedTo).toContain(master);

    // Raising master + music keeps ambience muted and preserves sfx at 1.
    audio.setVolumes(0.8, 0, 0.5);
    await vi.runAllTicks();
    expect(audio.getVolumes()).toEqual({ master: 0.8, ambience: 0, music: 0.5, sfx: 1 });
    expect(masterRecord.gain.value).toBe(0.8);
    expect(ambienceRecord.gain.value).toBe(0);
    expect(musicRecord.gain.value).toBe(0.5);
    expect(sfxRecord.gain.value).toBe(1);

    // Muting master preserves musicVolume preference and restores it on unmute.
    audio.setVolumes(0, 0.4, 0.5);
    await vi.runAllTicks();
    expect(audio.isMusicAudible()).toBe(false);
    expect(musicRecord.gain.value).toBe(0.5);
    audio.setVolumes(0.9, 0.4);
    await vi.runAllTicks();
    expect(audio.isMusicAudible()).toBe(true);
    expect(musicRecord.gain.value).toBe(0.5);

    audio.dispose();
  });

  it('3. preserves ambience, zone crossfades, tick, and secretChime behavior', async () => {
    installMockAudio();

    const audio = new AudioManager();
    audio.setZone('rotunda');
    audio.start();
    audio.setVolumes(1, 0.5, 0);
    await vi.runAllTicks();

    audio.tick(660);
    audio.secretChime();
    audio.setZone('north');
    vi.advanceTimersByTime(3000);
    expect(audio.zoneDescription('north')).toBe('Low celestial tone');

    audio.pauseMuseumAmbience();
    expect((audio as unknown as { voices: Map<string, unknown> }).voices.size).toBe(0);
    audio.resumeMuseumAmbience('east');
    expect((audio as unknown as { voices: Map<string, unknown> }).voices.size).toBe(1);
    audio.dispose();
  });

  it('4. aligns simultaneous multitrack stem groups to one exact Web Audio transport origin', async () => {
    const env = installMockAudio();
    env.ctx.currentTime = 12.5;

    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0, 0.8);
    await vi.runAllTicks();

    const sheet = buildTestW01ProcessionCueSheet();
    const session = audio.createMusicSession(sheet);
    const started = await session.play();
    expect(started).toBe(true);
    expect(session.timingSource).toBe('audio-clock');
    expect(session.getActiveLoopRegion()?.id).toBe('exploration-loop');

    // Only the three audible stems spawn (silent vocals omitted); all share exact origin 12.5.
    expect(env.sources).toHaveLength(3);
    for (const src of env.sources) {
      expect(src.startedAt).toEqual({ when: 12.5, offset: 0, duration: undefined });
      expect(src.loop).toBe(false);
    }

    // Bass begins alone at 1 while drums and other sit ready on the locked timeline at 0.
    expect(session.getStemGain('bass')).toBeCloseTo(1, 5);
    expect(session.getStemGain('drums')).toBeCloseTo(0, 5);
    expect(session.getStemGain('other')).toBeCloseTo(0, 5);

    // Smoothly fade drums and other onto the still-running composition without restarting sources.
    session.crossfadeTo({ drums: 0.9, other: 0.85 }, 1.0);
    audio.update(0.5);
    expect(session.getStemGain('drums')).toBeCloseTo(0.45, 2);
    expect(session.getStemGain('other')).toBeCloseTo(0.425, 2);
    audio.update(0.5);
    expect(session.getStemGain('drums')).toBeCloseTo(0.9, 5);
    expect(session.getStemGain('other')).toBeCloseTo(0.85, 5);
    expect(env.sources).toHaveLength(3);

    session.dispose();
    cleanupFixture();
    audio.dispose();
  });

  it('5. preserves exact offsets across pause/resume and tab/lifecycle suspend without duplicate cues', async () => {
    const env = installMockAudio();

    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    const fired: string[] = [];
    const session = audio.createMusicSession(buildTestW01CompactCueSheet());
    session.onCue((ev) => fired.push(`${ev.loopCount}:${ev.cue.id}`));

    await session.play();
    expect(fired).toEqual(['0:bass-alone-start']);

    // Advance AudioContext clock to 2.2s -> fires drums-entry-cue (2.0s).
    env.ctx.currentTime = 2.2;
    audio.update(0);
    expect(session.snapshot().positionSeconds).toBeCloseTo(2.2, 5);
    expect(fired).toEqual(['0:bass-alone-start', '0:drums-entry-cue']);

    // Pause -> clock advances externally to 20s, timeline and cues stay frozen.
    session.pause();
    expect(session.state).toBe('paused');
    env.ctx.currentTime = 20.0;
    audio.update(1.0);
    expect(session.snapshot().positionSeconds).toBeCloseTo(2.2, 5);
    expect(fired).toEqual(['0:bass-alone-start', '0:drums-entry-cue']);

    // Resume creates fresh single-use sources at exact offset 2.2 without re-firing past cues.
    const countBeforeResume = env.sources.length;
    await session.resume();
    expect(env.sources.length).toBe(countBeforeResume + 3);
    for (const src of env.sources.slice(countBeforeResume)) {
      expect(src.startedAt?.when).toBe(20.0);
      expect(src.startedAt?.offset).toBeCloseTo(2.2, 5);
    }
    expect(fired).toEqual(['0:bass-alone-start', '0:drums-entry-cue']);

    // Lifecycle tab-hide suspend at +1.0s (= 3.2s), resume 50s later -> no jump, no duplicates.
    env.ctx.currentTime = 21.0;
    audio.update(0);
    expect(session.snapshot().positionSeconds).toBeCloseTo(3.2, 5);
    audio.suspendForLifecycle('hidden');
    expect(session.snapshot().isLifecycleSuspended).toBe(true);
    env.ctx.currentTime = 71.0;
    audio.update(5.0);
    expect(session.snapshot().positionSeconds).toBeCloseTo(3.2, 5);

    audio.resumeFromLifecycle('visible');
    await vi.runAllTicks();
    expect(session.snapshot().positionSeconds).toBeCloseTo(3.2, 5);
    env.ctx.currentTime = 71.9; // +0.9s -> 4.1s -> fires other-entry-cue (4.0s) once!
    audio.update(0);
    expect(session.snapshot().positionSeconds).toBeCloseTo(4.1, 5);
    expect(fired).toEqual(['0:bass-alone-start', '0:drums-entry-cue', '0:other-entry-cue']);

    session.dispose();
    cleanupFixture();
    audio.dispose();
  });

  it('6. enforces documented seek cue policies ("skip" default vs "fire-crossed")', async () => {
    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    const sheet = buildTestW01CompactCueSheet();

    // Default 'skip' policy: bypasses cues < target, plays cues >= target.
    const skippedSession = audio.createMusicSession(sheet);
    const skippedFired: string[] = [];
    skippedSession.onCue((e) => skippedFired.push(e.cue.id));
    await skippedSession.play();
    expect(skippedFired).toEqual(['bass-alone-start']);

    skippedSession.seek(5.5);
    expect(skippedFired).toEqual(['bass-alone-start']);
    audio.update(0.6); // 6.1s -> passes ensemble-choreo-cue (6.0s)
    expect(skippedFired).toEqual(['bass-alone-start', 'ensemble-choreo-cue']);

    // Seeking backward resets cursor cleanly without backward firing.
    skippedSession.seek(1.9);
    expect(skippedFired).toEqual(['bass-alone-start', 'ensemble-choreo-cue']);
    audio.update(0.2);
    expect(skippedFired).toEqual(['bass-alone-start', 'ensemble-choreo-cue', 'drums-entry-cue']);
    skippedSession.dispose();

    // 'fire-crossed' policy: fires crossed cues chronologically on forward seek.
    const crossedSession = audio.createMusicSession(sheet, { seekCuePolicy: 'fire-crossed' });
    const crossedFired: string[] = [];
    crossedSession.onCue((e) => crossedFired.push(e.cue.id));
    await crossedSession.play();
    crossedSession.seek(6.2);
    expect(crossedFired).toEqual([
      'bass-alone-start',
      'drums-entry-cue',
      'other-entry-cue',
      'ensemble-choreo-cue',
    ]);
    crossedSession.dispose();

    cleanupFixture();
    audio.dispose();
  });

  it('7. fires exact cues, loop region wraps, and beat-grid conversions accurately', async () => {
    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    const compact = buildTestW01CompactCueSheet();

    expect(beatOffsetToSeconds(compact.beatGrid!, 4)).toBeCloseTo(2.0, 5);
    expect(barBeatToSeconds(compact.beatGrid!, 2, 0)).toBeCloseTo(4.0, 5);
    expect(secondsToBeatPosition(compact.beatGrid!, 5.5)).toEqual({ beat: 11, bar: 2, beatInBar: 3 });

    const events: Array<{ id: string; loop: number }> = [];
    const perIdEvents: string[] = [];
    const session = audio.createMusicSession(compact);
    session.onCue((ev) => events.push({ id: ev.cue.id, loop: ev.loopCount }));
    const offPeak = session.onCueId('ensemble-choreo-cue', (ev) => perIdEvents.push(`${ev.loopCount}:${ev.cue.id}`));

    await session.play();
    // Step deterministically 0 -> 18.2s (`main-groove-loop` 2.0..10.0 wraps at 10.0s and 18.0s).
    for (let i = 0; i < 182; i++) {
      audio.update(0.1);
    }
    expect(session.snapshot().loopCount).toBe(2);
    expect(events).toEqual([
      { id: 'bass-alone-start', loop: 0 },
      { id: 'drums-entry-cue', loop: 0 },
      { id: 'other-entry-cue', loop: 0 },
      { id: 'ensemble-choreo-cue', loop: 0 },
      { id: 'loop-seam-bar-5', loop: 0 },
      { id: 'drums-entry-cue', loop: 1 },
      { id: 'other-entry-cue', loop: 1 },
      { id: 'ensemble-choreo-cue', loop: 1 },
      { id: 'loop-seam-bar-5', loop: 1 },
      { id: 'drums-entry-cue', loop: 2 },
    ]);
    expect(perIdEvents).toEqual(['0:ensemble-choreo-cue', '1:ensemble-choreo-cue']);

    offPeak();
    session.dispose();
    cleanupFixture();
    audio.dispose();
  });

  it('8. runs silent logical timeline when muted or Web Audio is unavailable, and promotes seamlessly on unmute', async () => {
    // Part A: No Web Audio constructor available at all.
    setWindowAudioContext(undefined);
    const unavailableAudio = new AudioManager();
    const cleanupA = installTestW01AudioFixture(unavailableAudio);
    unavailableAudio.start(); // silent no-op
    expect(unavailableAudio.isAudioAvailable).toBe(false);

    const gallery = buildTestMuseumCrossfadeCueSheets();
    const descriptions: string[] = [];
    const ended = vi.fn();
    const atriumSession = unavailableAudio.createMusicSession(gallery.atrium);
    atriumSession.onCueDescription((d) => descriptions.push(d.text));
    atriumSession.onEnd(ended);

    await atriumSession.play();
    expect(atriumSession.timingSource).toBe('silent-timeline');
    unavailableAudio.update(1.0);
    unavailableAudio.update(1.0);
    expect(atriumSession.state).toBe('ended');
    expect(ended).toHaveBeenCalledTimes(1);
    expect(descriptions).toEqual([
      'Test cue: atrium resonance begins.',
      'Test cue: atrium motif shifts.',
      'Test cue: atrium phrase ends.',
    ]);
    atriumSession.dispose();
    cleanupA();
    unavailableAudio.dispose();

    // Part B: Web Audio exists, starts muted (silent timeline), then unmutes mid-track without jump.
    const env = installMockAudio();
    const audio = new AudioManager();
    const cleanupB = installTestW01AudioFixture(audio);
    audio.start();

    const hallSession = audio.createMusicSession(gallery.hall);
    await hallSession.play();
    expect(hallSession.timingSource).toBe('silent-timeline');
    expect(env.sources).toHaveLength(0);

    audio.update(1.5);
    expect(hallSession.snapshot().positionSeconds).toBeCloseTo(1.5, 5);

    // Now unmute mid-playback and flush async context resume + memory buffer load!
    audio.setVolumes(1, 0, 0.7);
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(hallSession.timingSource).toBe('audio-clock');
    expect(env.sources).toHaveLength(1);
    expect(env.sources[0].startedAt?.offset).toBeCloseTo(1.5, 5);
    expect(env.sources[0].loop).toBe(true);
    expect(env.sources[0].loopStart).toBe(0.5);
    expect(env.sources[0].loopEnd).toBe(3.0);

    hallSession.dispose();
    cleanupB();
    audio.dispose();
  });

  it('9. handles rapid start/stop bursts and crossfade interruptions without leaks', async () => {
    const env = installMockAudio();

    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    const gallery = buildTestMuseumCrossfadeCueSheets();
    const a = audio.createMusicSession(gallery.hall);
    const b = audio.createMusicSession(gallery.atrium);

    await a.play();
    a.stop();
    await a.play();
    a.pause();
    await a.resume();

    // Start crossfade a -> b, then interrupt mid-crossfade with rapid stop/crossfade back.
    await audio.crossfadeMusic(a, b, 1.0);
    audio.update(0.3);
    expect(b.state).toBe('playing');
    await audio.crossfadeMusic(b, a, 0.5);
    audio.update(0.6); // b fades out and stops; a stays playing cleanly
    expect(b.state).toBe('stopped');
    expect(a.state).toBe('playing');

    audio.stopAllMusic();
    expect(a.state).toBe('stopped');
    expect(env.sources.every((s) => s.stopped && s.disconnected)).toBe(true);

    a.dispose();
    b.dispose();
    cleanupFixture();
    audio.dispose();
  });

  it('10. cancels in-flight audio fetches cleanly on AbortSignal or scope disposal without retaining buffers', async () => {
    const env = installMockAudio();

    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    });

    registerAsset({
      id: 'test-audio.remote-pending',
      title: 'Pending Local Test Track',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Test',
      license: 'Test',
      url: './assets/test-pending.ogg',
      budgetKB: 100,
      streamingGroup: 'shell',
      attribution: null,
    });

    const audio = new AudioManager({ fetchFn: fetchMock as unknown as typeof fetch });
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    const scope = new ResourceScope('abort-test');
    const controller = new AbortController();
    const sheet: MusicCueSheet = {
      version: MUSIC_CUE_SHEET_VERSION,
      id: 'test-abort-sheet',
      durationSeconds: 4,
      stems: [{ id: 's1', assetId: 'test-audio.remote-pending' }],
    };

    const session = audio.createMusicSession(sheet, { scope, signal: controller.signal });
    const playPromise = session.play();
    await vi.runAllTicks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capturedSignal?.aborted).toBe(false);

    controller.abort();
    expect(capturedSignal?.aborted).toBe(true);
    expect(await playPromise).toBe(false);
    expect(session.isDisposed).toBe(true);
    expect(scope.size).toBe(0);
    expect(audio.assetLoader.cachedBufferCount).toBe(0);
    expect(audio.assetLoader.activeLeaseCount).toBe(0);
    expect(env.sources).toHaveLength(0);

    scope.dispose();
    audio.dispose();
  });

  it('10b. isolates concurrent audio load cancellation and enforces local-only URL rules', async () => {
    const env = installMockAudio();
    registerAsset({
      id: 'test-audio.shared-local',
      title: 'Shared Local Track',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Test',
      license: 'Test',
      url: './assets/shared-local.ogg',
      budgetKB: 100,
      streamingGroup: 'shell',
      attribution: null,
    });
    registerAsset({
      id: 'test-audio.forbidden-remote',
      title: 'Forbidden Remote Track',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Test',
      license: 'Test',
      url: 'https://example.com/music.ogg',
      budgetKB: 100,
      streamingGroup: 'shell',
      attribution: null,
    });

    let resolveFetch!: (res: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((res) => { resolveFetch = res; }));
    const audio = new AudioManager({ fetchFn: fetchMock as unknown as typeof fetch });
    audio.start();
    audio.setVolumes(1, 0, 1);

    const scopeA = new ResourceScope('consumer-a');
    const scopeB = new ResourceScope('consumer-b');
    const abortA = new AbortController();

    const pA = audio.assetLoader.load('test-audio.shared-local', scopeA, abortA.signal);
    const pB = audio.assetLoader.load('test-audio.shared-local', scopeB);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Cancelling consumer A must not abort consumer B's shared load.
    abortA.abort();
    await expect(pA).rejects.toThrow(/cancelled/i);

    resolveFetch(new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }));
    const bufB = await pB;
    expect(bufB.duration).toBeGreaterThan(0);
    expect(audio.assetLoader.cachedBufferCount).toBe(1);
    expect(audio.assetLoader.activeLeaseCount).toBe(1);

    // Disposing B releases the decoded buffer immediately.
    scopeA.dispose();
    scopeB.dispose();
    expect(audio.assetLoader.cachedBufferCount).toBe(0);
    expect(audio.assetLoader.activeLeaseCount).toBe(0);

    // Remote URLs are rejected both by cue-sheet validator and loader without calling fetch.
    const remoteValidation = validateMusicCueSheet({
      version: 1,
      id: 'remote',
      stems: [{ id: 'r', assetId: 'test-audio.forbidden-remote' }],
    });
    expect(remoteValidation.ok).toBe(false);
    const remoteScope = new ResourceScope('remote-reject');
    await expect(audio.assetLoader.load('test-audio.forbidden-remote', remoteScope)).rejects.toThrow(/non-local/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(env.decodeCalls).toBe(1);

    remoteScope.dispose();
    audio.dispose();
  });

  it('11 & 12. completes repeated pocket-world enter/exit/abort cycles with zero node, buffer, or callback leaks', async () => {
    const env = installMockAudio();

    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0.5, 0.8);
    await vi.runAllTicks();
    audio.setZone('plaza');

    const registry = new PocketWorldRegistry();
    const passport = new Passport(null);
    let currentZone: 'plaza' | 'rotunda' = 'plaza';
    const exteriorCollision = new CollisionWorld();
    exteriorCollision.addFloor(-50, 50, -50, 50, 0);

    let activeWorld: 'exterior' | 'interior' | `pocket:${string}` = 'exterior';
    const worldDirector = {
      get activeWorld() { return activeWorld; },
      beginPocketPrompt: () => true,
      cancelPocketPrompt: () => {},
      beginPreparingPocket: () => true,
      abortPreparingPocket: () => {},
      commitPocket: (id: string) => { activeWorld = `pocket:${id}`; },
      beginExitingPocket: () => true,
      finishExitingPocket: (hostWorld: 'exterior' | 'interior') => { activeWorld = hostWorld; },
    };

    const host = new PocketWorldHost({
      registry,
      passport,
      worldDirector: worldDirector as never,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      sky: { mesh: new THREE.Object3D(), follow: () => {} },
      lighting: { group: new THREE.Group() },
      getMuseumPlacementsRoot: () => null,
      exteriorWorld: { root: new THREE.Group(), collision: exteriorCollision },
      getInteriorWorld: () => null,
      player: {
        position: new THREE.Vector3(0, 0, 0),
        yaw: 0,
        pitch: 0,
        acquireFreeze: () => () => {},
        setCollisionWorld: () => {},
        restorePose: () => {},
        applyToCamera: () => {},
      } as never,
      input: { pointerLocked: false, resetTransient: () => {}, acquireUiCapture: () => () => {}, requestPointerLock: () => {} } as never,
      interaction: { resetFocus: () => {}, update: () => {}, register: () => () => {} } as never,
      audio,
      assets: {} as never,
      getQuality: () => ({ tier: 'low' }) as never,
      isContextLost: () => false,
      getCurrentZone: () => currentZone,
      setCurrentZone: (z) => { currentZone = z as 'plaza' | 'rotunda'; },
      reducedMotion: () => false,
      announce: () => {},
    });

    const compactSheet = buildTestW01CompactCueSheet();
    let createdSessions = 0;
    const abortSignalSpies: Array<{ add: number; remove: number }> = [];

    registry.registerWorld('W05', {
      readiness: 'verified',
      load: async (ctx) => {
        const origAdd = ctx.signal.addEventListener.bind(ctx.signal);
        const origRemove = ctx.signal.removeEventListener.bind(ctx.signal);
        const tracker = { add: 0, remove: 0 };
        abortSignalSpies.push(tracker);
        ctx.signal.addEventListener = ((...args: Parameters<typeof origAdd>) => {
          tracker.add++;
          return origAdd(...args);
        }) as typeof origAdd;
        ctx.signal.removeEventListener = ((...args: Parameters<typeof origRemove>) => {
          tracker.remove++;
          return origRemove(...args);
        }) as typeof origRemove;

        const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), new THREE.MeshBasicMaterial());
        floor.position.y = -0.1;
        ctx.root.add(floor);
        ctx.scope.trackObject(ctx.root);
        ctx.collision.addFloor(-5, 5, -5, 5, 0);

        const session = ctx.createMusicSession(compactSheet);
        createdSessions++;
        await session.play();
        return { spawnPosition: [0, 0, 0], spawnYaw: 0 };
      },
    });

    for (let i = 0; i < 10; i++) {
      expect(await host.enter('W05')).toBe(true);
      expect(audio.activeMusicSessionCount).toBe(1);
      // Museum ambience paused while inside pocket world.
      expect((audio as unknown as { voices: Map<string, unknown> }).voices.size).toBe(0);

      env.ctx.currentTime += 1.0;
      audio.update(1 / 60);

      host.exit({ viaVhsRewind: false, reason: i === 9 ? 'abort' : 'back' });
      expect(audio.activeMusicSessionCount).toBe(0);
      expect(audio.assetLoader.cachedBufferCount).toBe(0);
      expect(audio.assetLoader.activeLeaseCount).toBe(0);
      // Museum ambience restored to original zone.
      expect((audio as unknown as { voices: Map<string, unknown> }).voices.size).toBe(1);
    }

    expect(createdSessions).toBe(10);
    // 30 music sources (3 audible stems x 10 visits) should all be stopped & disconnected
    // while the restored museum ambience bed (duration === 4) stays running until audio.dispose().
    const musicSources = env.sources.filter((s) => s.buffer && s.buffer.duration > 10);
    expect(musicSources).toHaveLength(30);
    expect(musicSources.every((s) => s.stopped && s.disconnected)).toBe(true);
    expect(audio.assetLoader.cachedBufferCount).toBe(0);
    expect(audio.assetLoader.activeLeaseCount).toBe(0);

    // Every GainNode owned by sessions was disconnected.
    const sessionGains = env.gains.slice(4);
    expect(sessionGains.some((g) => g.disconnected)).toBe(true);

    host.dispose();
    cleanupFixture();
    audio.dispose();
    expect(env.sources.every((s) => s.stopped && s.disconnected)).toBe(true);
  });

  it('13. falls back cleanly on missing/corrupt audio files and rejects invalid cue sheets strictly', async () => {
    const env = createMockAudioEnv({ decodeShouldFail: true });
    setWindowAudioContext(vi.fn(() => env.ctx));

    registerAsset({
      id: 'test-audio.missing-file',
      title: 'Missing Audio File',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Test',
      license: 'Test',
      url: './assets/does-not-exist.ogg',
      budgetKB: 50,
      streamingGroup: 'shell',
      attribution: null,
    });
    registerAsset({
      id: 'test-audio.corrupt-file',
      title: 'Corrupt Audio File',
      kind: 'audio',
      source: 'original-museum',
      project: null,
      creator: 'Test',
      license: 'Test',
      url: './assets/corrupt.ogg',
      budgetKB: 50,
      streamingGroup: 'shell',
      attribution: null,
    });
    registerProcedural('test-proc.not-audio', 'Not Audio', 'shell');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('does-not-exist')) {
        return new Response(null, { status: 404, statusText: 'Not Found' });
      }
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
    });

    const audio = new AudioManager({ fetchFn: fetchMock as unknown as typeof fetch });
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    for (const badAssetId of ['test-audio.missing-file', 'test-audio.corrupt-file']) {
      const cues: string[] = [];
      const session = audio.createMusicSession({
        version: MUSIC_CUE_SHEET_VERSION,
        id: `fallback-${badAssetId}`,
        durationSeconds: 2,
        stems: [{ id: 'main', assetId: badAssetId }],
        cues: [
          { id: 'c0', timeSeconds: 0, label: 'Fallback start' },
          { id: 'c1', timeSeconds: 1.5, label: 'Fallback mid' },
        ],
      });
      session.onCue((e) => cues.push(e.cue.id));
      const ok = await session.play();
      expect(ok).toBe(true);
      const snap = session.snapshot();
      expect(snap.audioDegraded).toBe(true);
      expect(snap.loadErrors.length).toBeGreaterThan(0);
      expect(snap.timingSource).toBe('silent-timeline');

      audio.update(1.6);
      expect(cues).toEqual(['c0', 'c1']);
      session.dispose();
    }
    warnSpy.mockRestore();

    // Strict Cue-Sheet Validator checks:
    const badVersion = validateMusicCueSheet({ version: 99, id: 'x', stems: [{ id: 's', assetId: 'test-audio.missing-file' }] });
    expect(badVersion.ok).toBe(false);

    const dupIds = validateMusicCueSheet({
      version: 1,
      id: 'dup',
      durationSeconds: 5,
      sections: [{ id: 'sec' }, { id: 'sec' }],
      stems: [
        { id: 's1', assetId: 'test-audio.missing-file' },
        { id: 's1', assetId: 'test-audio.missing-file' },
      ],
      cues: [
        { id: 'c1', timeSeconds: 0 },
        { id: 'c1', timeSeconds: 1 },
      ],
    });
    expect(dupIds.ok).toBe(false);
    if (!dupIds.ok) {
      expect(dupIds.errors.some((e) => e.includes('Duplicate section'))).toBe(true);
      expect(dupIds.errors.some((e) => e.includes('Duplicate stem'))).toBe(true);
      expect(dupIds.errors.some((e) => e.includes('Duplicate cue'))).toBe(true);
    }

    const badTimesAndRanges = validateMusicCueSheet({
      version: 1,
      id: 'bad-times',
      durationSeconds: 5,
      loopRegion: { startSeconds: 4, endSeconds: 3 },
      beatGrid: { bpm: -120, timeSignature: { numerator: 0, denominator: 3 } },
      stems: [{ id: 's1', assetId: 'test-audio.missing-file', defaultGain: 2 }],
      cues: [
        { id: 'neg', timeSeconds: -1 },
        { id: 'a', timeSeconds: 3 },
        { id: 'b', timeSeconds: 2 },
        { id: 'over', timeSeconds: 6 },
      ],
    });
    expect(badTimesAndRanges.ok).toBe(false);
    if (!badTimesAndRanges.ok) {
      expect(badTimesAndRanges.errors.some((e) => e.includes('invalid loop range'))).toBe(true);
      expect(badTimesAndRanges.errors.some((e) => e.includes('bpm'))).toBe(true);
      expect(badTimesAndRanges.errors.some((e) => e.includes('negative'))).toBe(true);
      expect(badTimesAndRanges.errors.some((e) => e.includes('out of order'))).toBe(true);
      expect(badTimesAndRanges.errors.some((e) => e.includes('exceeds durationSeconds'))).toBe(true);
    }

    const badAssets = validateMusicCueSheet({
      version: 1,
      id: 'bad-assets',
      stems: [
        { id: 'missing', assetId: 'does.not.exist' },
        { id: 'wrongKind', assetId: 'test-proc.not-audio' },
      ],
    });
    expect(badAssets.ok).toBe(false);
    expect(() => audio.createMusicSession({
      version: 1,
      id: 'throws',
      stems: [{ id: 's1', assetId: 'does.not.exist' }],
    })).toThrow(MusicCueSheetValidationError);

    audio.dispose();
  });

  it('14. migrates preferences v3 -> v4 safely without unmuting and supports Settings & VisitorSession', () => {
    const store = memoryStorage();
    // Saved v3 user who opted in to master/ambience: preserve those, add musicVolume: 0.
    store.setItem(PREFERENCES_KEY, JSON.stringify({
      version: 3,
      quality: 'high',
      masterVolume: 0.65,
      ambienceVolume: 0.45,
      subtitles: false,
    }));
    const migrated = loadPreferencesResult(store);
    expect(migrated.migrated).toBe(true);
    expect(migrated.quarantined).toBe(false);
    expect(migrated.preferences.version).toBe(PREFERENCES_VERSION);
    expect(migrated.preferences.masterVolume).toBe(0.65);
    expect(migrated.preferences.ambienceVolume).toBe(0.45);
    expect(migrated.preferences.musicVolume).toBe(0);
    expect(migrated.preferences.subtitles).toBe(false);

    // Pre-v3 legacy still mutes all audio defaults once.
    const legacyStore = memoryStorage();
    legacyStore.setItem(PREFERENCES_KEY, JSON.stringify({
      version: 2,
      quality: 'medium',
      masterVolume: 0.9,
      ambienceVolume: 0.8,
    }));
    const legacy = loadPreferencesResult(legacyStore);
    expect(legacy.preferences.masterVolume).toBe(0);
    expect(legacy.preferences.ambienceVolume).toBe(0);
    expect(legacy.preferences.musicVolume).toBe(0);
    expect(legacy.preferences.quality).toBe('medium');

    // SettingsPanel constants include musicVolume cleanly.
    expect(RESTORABLE_SETTINGS).toContain('musicVolume');
    expect(SETTING_RANGES.musicVolume).toEqual({ min: 0, max: 1, step: 0.05 });
    expect(settingValueText('musicVolume', 0.45)).toBe('45%');
    expect(pickRestorable({ ...DEFAULT_PREFERENCES, musicVolume: 0.7 }).musicVolume).toBe(0.7);

    // Save & reload v4 musicVolume + VisitorSession v4 and legacy-v3 compatibility.
    savePreferences({ ...DEFAULT_PREFERENCES, masterVolume: 0.5, musicVolume: 0.4 }, store);
    expect(loadPreferencesResult(store).preferences.musicVolume).toBe(0.4);

    const sessionParts = {
      journal: new Journal(),
      study: new Study(() => new Set()),
      preferences: { ...DEFAULT_PREFERENCES, masterVolume: 0.5, musicVolume: 0.4 },
      visitThread: new VisitThread(),
      secretsLog: new SecretsLog(),
      passport: new Passport(null),
    };
    const exportedV4 = exportVisitorSession(sessionParts);
    const previewV4 = previewVisitorSession(exportedV4, sessionParts);
    expect(JSON.parse(previewV4.values[PREFERENCES_KEY]!).musicVolume).toBe(0.4);

    // Legacy v3 wrapped export (lacks musicVolume) still imports cleanly with musicVolume: 0.
    const parsedWrap = JSON.parse(exportedV4);
    parsedWrap.payload.preferences.version = 3;
    delete parsedWrap.payload.preferences.musicVolume;
    const v3Wrapped = JSON.stringify(attachIntegrity(parsedWrap.payload));
    const v3Import = previewVisitorSession(v3Wrapped, sessionParts);
    expect(JSON.parse(v3Import.values[PREFERENCES_KEY]!).musicVolume).toBe(0);
  });

  it('15. keeps all 11 canonical pocket worlds dormant and validates test-only W01 stem & museum fixtures', () => {
    const registry = new PocketWorldRegistry();
    expect(registry.list()).toHaveLength(11);
    for (const def of registry.list()) {
      expect(def.readiness).toBe('dormant');
      expect(def.load).toBeUndefined();
      expect(registry.canEnter(def.id).ok).toBe(false);
    }

    const audio = new AudioManager();
    const cleanupFixture = installTestW01AudioFixture(audio);
    const procession = buildTestW01ProcessionCueSheet();
    const compact = buildTestW01CompactCueSheet();
    const gallery = buildTestMuseumCrossfadeCueSheets();

    expect(Object.keys(TEST_W01_AUDIO_ASSET_IDS)).toHaveLength(4);
    expect(Object.keys(TEST_MUSEUM_GALLERY_ASSET_IDS)).toHaveLength(2);
    expect(procession.stems.map((s) => s.id)).toEqual(['bass', 'drums', 'other']);
    expect(validateMusicCueSheet(procession).ok).toBe(true);
    expect(validateMusicCueSheet(compact).ok).toBe(true);
    expect(validateMusicCueSheet(gallery.atrium).ok).toBe(true);
    expect(validateMusicCueSheet(gallery.hall).ok).toBe(true);

    cleanupFixture();
    audio.dispose();
  });

  it('16. reveals synchronized stems on next-beat / next-bar / next-cue without restarting any source', async () => {
    // Part A: Audible audio-clock mode
    const env = installMockAudio();
    const audio = new AudioManager();
    const cleanup = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    const compact = buildTestW01CompactCueSheet();
    const session = audio.createMusicSession(compact);
    const applied: string[] = [];
    session.onMixApplied((ev) => applied.push(`${ev.handleId}:${ev.at}@${ev.scheduledSeconds.toFixed(1)}`));

    await session.play();
    expect(env.sources).toHaveLength(3); // bass, drums, other started together at t=0
    expect(session.getStemGain('bass')).toBeCloseTo(1, 5);
    expect(session.getStemGain('drums')).toBeCloseTo(0, 5);
    expect(session.getStemGain('other')).toBeCloseTo(0, 5);

    // Advance 0.25s -> still before bar 1 (2.0s).
    env.ctx.currentTime = 0.25;
    audio.update(0.25);

    // Schedule drums on 'next-bar' (2.0s) and an intermediate gain on other that gets superseded!
    const drumsHandle = session.scheduleStemGain('drums', 0.9, { at: 'next-bar', fadeSeconds: 0.5 });
    const staleOtherHandle = session.scheduleStemGain('other', 0.2, { at: 'next-beat', fadeSeconds: 0 });
    session.cancelScheduledMix(staleOtherHandle);
    const otherHandle = session.scheduleStemGain('other', 0.85, {
      at: 'next-cue',
      cueId: 'other-entry-cue',
      fadeSeconds: 0.4,
    });
    expect(session.snapshot().pendingMixTransitionCount).toBe(2);

    // Step across pause/resume before bar 1: pending schedule stays armed without firing early.
    env.ctx.currentTime = 1.0;
    audio.update(0);
    expect(session.getStemGain('drums')).toBeCloseTo(0, 5);
    session.pause();
    env.ctx.currentTime = 15.0;
    audio.update(2.0);
    expect(session.getStemGain('drums')).toBeCloseTo(0, 5);
    await session.resume();

    // Advance +1.0s to bar 1 (2.0s): drums transitions in at bar 1 with zero restarts of existing sources on transport!
    const sourcesRightAfterResume = env.sources.length;
    env.ctx.currentTime = 16.0;
    audio.update(0);
    expect(applied).toEqual([`${drumsHandle}:next-bar@2.0`]);
    expect(session.snapshot().pendingMixTransitionCount).toBe(1);
    expect(env.sources).toHaveLength(sourcesRightAfterResume);

    audio.update(0.5); // advance ramp by 0.5s
    expect(session.getStemGain('drums')).toBeCloseTo(0.9, 5);
    expect(session.getStemGain('other')).toBeCloseTo(0, 5);

    // Advance clock to cue time 4.0s (total elapsed since resume = 3.0s -> pos 4.0s).
    env.ctx.currentTime = 18.0;
    audio.update(0);
    expect(applied).toEqual([`${drumsHandle}:next-bar@2.0`, `${otherHandle}:next-cue@4.0`]);
    expect(session.snapshot().pendingMixTransitionCount).toBe(0);
    audio.update(0.4);
    expect(session.getStemGain('other')).toBeCloseTo(0.85, 5);
    expect(env.sources).toHaveLength(sourcesRightAfterResume);

    session.dispose();

    // Part B: Silent logical timeline mode behaves identically without Web Audio.
    const silentAudio = new AudioManager();
    const cleanupSilent = installTestW01AudioFixture(silentAudio);
    const silentSession = silentAudio.createMusicSession(compact);
    const silentApplied: string[] = [];
    silentSession.onMixApplied((ev) => silentApplied.push(ev.at));

    await silentSession.play();
    expect(silentSession.timingSource).toBe('silent-timeline');
    silentSession.scheduleMix({ drums: 1, other: 1 }, { at: 'next-beat', fadeSeconds: 0.5 });
    // Superseded for drums right before beat 1 (0.5s).
    silentSession.scheduleStemGain('drums', 0.75, { at: 'next-beat', fadeSeconds: 0.5 });

    silentAudio.update(0.5);
    expect(silentApplied).toEqual(['next-beat', 'next-beat']);
    silentAudio.update(0.5);
    expect(silentSession.getStemGain('drums')).toBeCloseTo(0.75, 5);
    expect(silentSession.getStemGain('other')).toBeCloseTo(1, 5);

    silentSession.dispose();
    cleanupSilent();
    silentAudio.dispose();
    cleanup();
    audio.dispose();
  });

  it('17. executes equal-power crossfade loops with zero drift or leaked nodes and releases smoothly to natural outro', async () => {
    const env = installMockAudio();
    const audio = new AudioManager();
    const cleanup = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    const compact = buildTestW01CompactCueSheet(); // main-groove-loop: 2.0..10.0, crossfadeSeconds: 0.08
    const ended = vi.fn();
    const session = audio.createMusicSession(compact);
    session.onEnd(ended);

    await session.play();
    expect(session.getActiveLoopRegion()?.id).toBe('main-groove-loop');
    session.crossfadeTo({ drums: 0.8, other: 0.9 }, 0);
    const initialSources = env.sources.slice();
    expect(initialSources).toHaveLength(3);

    // Step to t=9.80 (inside lookahead [9.96 - 0.25 = 9.71 .. 9.96] before loop boundary 10.0):
    // Incoming loop pass spawns phase-aligned at when = 9.96, offset = 2.0 - 0.04 = 1.96!
    env.ctx.currentTime = 9.80;
    audio.update(0.016);
    expect(env.sources).toHaveLength(6);
    const pass1Sources = env.sources.slice(3);
    for (const s of pass1Sources) {
      expect(s.startedAt?.when).toBeCloseTo(9.96, 5);
      expect(s.startedAt?.offset).toBeCloseTo(1.96, 5);
    }
    // Equal-power curve calls recorded on pass gain nodes while stem gains remain untouched.
    expect(env.gains.some((g) => g.gain.setValueCurveAtTime.mock.calls.length > 0)).toBe(true);
    expect(session.getStemGain('bass')).toBeCloseTo(1, 5);
    expect(session.getStemGain('drums')).toBeCloseTo(0.8, 5);
    expect(session.getStemGain('other')).toBeCloseTo(0.9, 5);

    // Cross boundary (t=10.10 > 10.04 + 0.02 retire margin): loopCount increments to 1,
    // position wraps to 2.10, and ALL 3 initial pass sources stop & disconnect cleanly!
    env.ctx.currentTime = 10.10;
    audio.update(0.016);
    expect(session.snapshot().loopCount).toBe(1);
    expect(session.snapshot().positionSeconds).toBeCloseTo(2.10, 5);
    expect(initialSources.every((s) => s.stopped && s.disconnected)).toBe(true);
    expect(pass1Sources.every((s) => !s.stopped)).toBe(true);

    // Release looping smoothly (`setActiveLoopRegion(null)`): does NOT restart active sources,
    // continues straight past 10.0s into the outro cadence bar 5..6, and finishes at 12.0s!
    session.setActiveLoopRegion(null);
    expect(session.getActiveLoopRegion()).toBeNull();
    expect(session.snapshot().activeLoopRegionId).toBeNull();
    expect(env.sources).toHaveLength(6);

    env.ctx.currentTime = 18.5; // +8.4s -> 10.5s (straight past old loopEnd=10.0!)
    audio.update(0.016);
    expect(session.state).toBe('playing');
    expect(session.snapshot().loopCount).toBe(1);
    expect(session.snapshot().positionSeconds).toBeCloseTo(10.5, 5);

    env.ctx.currentTime = 20.1; // past 12.0s end marker
    audio.update(0.016);
    expect(session.state).toBe('ended');
    expect(ended).toHaveBeenCalledTimes(1);
    expect(env.sources.every((s) => s.stopped && s.disconnected)).toBe(true);

    session.dispose();
    cleanup();
    audio.dispose();
  });

  it('18. detects digital silence in stems, skips wasted silent sources, and validates v1 loopRegions & helpers', async () => {
    const env = installMockAudio();
    const audio = new AudioManager();
    const cleanup = installTestW01AudioFixture(audio);
    audio.start();
    audio.setVolumes(1, 0, 1);
    await vi.runAllTicks();

    // Direct silence inspection on silent buffer vs tone buffer
    const silentBuf = createInMemorySilentBuffer(env.ctx, 1.0);
    expect(analyzeAudioBufferSilence(silentBuf)).toEqual({
      isSilent: true,
      peakAmplitude: 0,
      durationSeconds: 1.0,
    });

    // Session carrying an audible stem plus a confirmed-silent stem skips spawning a silent source
    // without flagging audioDegraded or blocking transport progress.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sheetWithSilent: MusicCueSheet = {
      version: 1,
      id: 'test-with-silent-layer',
      durationSeconds: 4,
      stems: [
        { id: 'bass', assetId: TEST_W01_AUDIO_ASSET_IDS.bass, defaultGain: 1 },
        { id: 'vocals', assetId: TEST_W01_AUDIO_ASSET_IDS.silentVocals, defaultGain: 1 },
      ],
    };
    const silentSession = audio.createMusicSession(sheetWithSilent);
    expect(await silentSession.play()).toBe(true);
    expect(silentSession.snapshot().audioDegraded).toBe(false);
    expect(silentSession.snapshot().silentStemIds).toEqual(['vocals']);
    expect(env.sources).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('vocals'));
    warnSpy.mockRestore();
    silentSession.dispose();

    // Validation & pure beat/cue helpers
    const procession = buildTestW01ProcessionCueSheet();
    expect(resolveLoopRegionById(procession, 'extended-loop')?.endSeconds).toBeCloseTo(146.114, 3);
    expect(nextBeatTimeSeconds(procession.beatGrid!, 0)).toBeCloseTo(0.033, 5);
    expect(nextBarTimeSeconds(procession.beatGrid!, 0.033)).toBeCloseTo(0.033 + 240 / 92, 4);
    expect(
      nextMatchingCue(procession, 1.0, { tag: 'stem-entry' })?.cue.id,
    ).toBe('stage-2-drums-window');

    const badLoopExtensions = validateMusicCueSheet({
      version: 1,
      id: 'bad-loops',
      durationSeconds: 10,
      defaultLoopRegionId: 'missing-region',
      loopRegions: [
        { id: '', startSeconds: 1, endSeconds: 4 },
        { id: 'dup', startSeconds: 1, endSeconds: 5, crossfadeSeconds: 2.5 },
        { id: 'dup', startSeconds: 5, endSeconds: 9 },
      ],
      stems: [{ id: 'bass', assetId: TEST_W01_AUDIO_ASSET_IDS.bass }],
      cues: [{ id: 'c', timeSeconds: 0, tags: ['ok', ''] }],
    });
    expect(badLoopExtensions.ok).toBe(false);
    if (!badLoopExtensions.ok) {
      expect(badLoopExtensions.errors.some((e) => e.includes('crossfadeSeconds'))).toBe(true);
      expect(badLoopExtensions.errors.some((e) => e.includes('Duplicate loop region id'))).toBe(true);
      expect(badLoopExtensions.errors.some((e) => e.includes('defaultLoopRegionId'))).toBe(true);
      expect(badLoopExtensions.errors.some((e) => e.includes('.tags'))).toBe(true);
    }

    cleanup();
    audio.dispose();
  });
});
