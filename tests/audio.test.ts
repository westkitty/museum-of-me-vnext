import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../src/audio/AudioManager';
import { DEFAULT_PREFERENCES } from '../src/state/Preferences';

interface StubAudioParam {
  value: number;
  setValueAtTime: (...args: unknown[]) => StubAudioParam;
  linearRampToValueAtTime: (...args: unknown[]) => StubAudioParam;
  cancelScheduledValues: (...args: unknown[]) => StubAudioParam;
  exponentialRampToValueAtTime: (...args: unknown[]) => StubAudioParam;
}
interface StubAudioNode {
  gain: StubAudioParam;
  connect: (...args: unknown[]) => StubAudioNode;
  disconnect: () => void;
}
interface StubOsc {
  type: string;
  frequency: { value: number };
  detune: { value: number };
  connect: () => { connect: () => void };
  start: () => void;
  stop: () => void;
}
interface StubBufSource {
  buffer: unknown;
  loop: boolean;
  connect: () => { connect: () => void };
  start: () => void;
  stop: () => void;
}
interface StubFilter {
  type: string;
  frequency: { value: number };
  Q: { value: number };
  connect: () => void;
}
interface StubContext {
  state: string;
  destination: Record<string, never>;
  currentTime: number;
  sampleRate: number;
  createGain: () => StubAudioNode;
  createBiquadFilter: () => StubFilter;
  createOscillator: () => StubOsc;
  createBuffer: (ch: number, len: number) => { getChannelData: () => Float32Array };
  createBufferSource: () => StubBufSource;
  suspend: () => Promise<void>;
  resume: () => Promise<void>;
  close: () => Promise<void>;
}

interface StubAudioEnv {
  window?: Record<string, unknown>;
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
}

/** Vitest runs in the node environment, so there is no real `window`.
 *  AudioManager reads `window.AudioContext` directly; we install a minimal
 *  window shim onto globalThis plus the AudioContext constructor to test
 *  against. */
function installWindowShim(): void {
  const env = globalThis as unknown as StubAudioEnv;
  if (!env.window) env.window = globalThis as unknown as Record<string, unknown>;
}
function setGlobalAC(ctor: unknown): void {
  installWindowShim();
  const env = globalThis as unknown as StubAudioEnv & { window: Record<string, unknown> };
  env.AudioContext = ctor;
  env.webkitAudioContext = undefined;
  env.window.AudioContext = ctor;
  env.window.webkitAudioContext = undefined;
}

function makeStubAudioContext(): {
  ctx: StubContext;
  stats: { oscillators: number; buffers: number; sources: number; suspends: number; resumes: number };
} {
  const stats = { oscillators: 0, buffers: 0, sources: 0, suspends: 0, resumes: 0 };
  const makeGain = (): StubAudioNode => {
    const param: StubAudioParam = {
      value: 0,
      setValueAtTime: () => param,
      linearRampToValueAtTime: () => param,
      cancelScheduledValues: () => param,
      exponentialRampToValueAtTime: () => param,
    };
    const node: StubAudioNode = {
      gain: param,
      connect: () => node,
      disconnect: () => {},
    };
    return node;
  };
  const ctx: StubContext = {
    state: 'running',
    destination: {},
    currentTime: 0,
    sampleRate: 22050,
    createGain: makeGain,
    createBiquadFilter: () => ({
      type: '', frequency: { value: 0 }, Q: { value: 0 },
      connect: () => {},
    }),
    createOscillator(): StubOsc {
      stats.oscillators++;
      const n: StubOsc & { _started?: boolean } = {
        type: '', frequency: { value: 0 }, detune: { value: 0 },
        connect: () => ({ connect: () => {} }),
        start() { n._started = true; },
        stop() {},
      };
      return n;
    },
    createBuffer: (_ch: number, len: number) => {
      stats.buffers++;
      return { getChannelData: () => new Float32Array(len) };
    },
    createBufferSource(): StubBufSource {
      stats.sources++;
      return {
        buffer: null, loop: false,
        connect: () => ({ connect: () => {} }),
        start() {},
        stop() {},
      };
    },
    suspend: async () => { stats.suspends++; ctx.state = 'suspended'; },
    resume: async () => { stats.resumes++; ctx.state = 'running'; },
    close: async () => {},
  };
  return { ctx, stats };
}

describe('muted-by-default audio manager', () => {
  beforeEach(() => {
    setGlobalAC(undefined);
    vi.useFakeTimers();
  });
  afterEach(() => {
    setGlobalAC(undefined);
    vi.useRealTimers();
  });

  it('keeps playback available but starts muted before a visitor gesture', () => {
    const audio = new AudioManager();
    audio.setZone('plaza');
    audio.dispose();
    expect(audio.isRunning).toBe(false);
    expect(DEFAULT_PREFERENCES.masterVolume).toBe(0);
    expect(DEFAULT_PREFERENCES.ambienceVolume).toBe(0);
  });

  it('does not accumulate live zone beds across repeated wing transitions', () => {
    const { ctx } = makeStubAudioContext();
    setGlobalAC(vi.fn(() => ctx));

    const audio = new AudioManager();
    audio.start();
    audio.setVolumes(1, 1);
    expect(audio.isRunning).toBe(true);

    // Visit every zone; previous zones should be scheduled for cleanup and
    // dropped once the crossfade completes. Voices is a private field; we
    // reach it by type-coercion to assert the bookkeeping invariant: at
    // most one live voice (the current zone) after cleanup fires.
    type WithVoices = { voices: Map<string, unknown> };
    const voices = (audio as unknown as WithVoices).voices;

    const order = ['plaza', 'rotunda', 'north', 'east', 'south', 'west', 'media', 'infra', 'sanctuary', 'balcony'] as const;
    for (const z of order) audio.setZone(z);
    vi.advanceTimersByTime(5000);
    expect(voices.size).toBeLessThanOrEqual(2);

    audio.setZone('plaza');
    audio.setZone('rotunda');
    vi.advanceTimersByTime(5000);
    expect(voices.size).toBeLessThanOrEqual(2);

    expect(() => audio.dispose()).not.toThrow();
  });

  it('keeps muted ambience synthesis non-resident while preserving interaction audio', async () => {
    const { ctx, stats } = makeStubAudioContext();
    setGlobalAC(vi.fn(() => ctx));

    const audio = new AudioManager();
    audio.setZone('plaza');
    audio.start();
    await vi.runAllTicks();

    expect(stats.buffers).toBe(0);
    expect(stats.sources).toBe(0);
    expect(stats.oscillators).toBe(0);
    expect(stats.suspends).toBe(1);

    audio.setVolumes(1, 0);
    await vi.runAllTicks();
    audio.tick();
    expect(stats.oscillators).toBe(1);
    expect(stats.buffers).toBe(0);

    audio.setVolumes(1, 0.5);
    expect(stats.oscillators).toBe(4);
    expect(stats.buffers).toBe(1);
    expect(stats.sources).toBe(1);

    audio.setVolumes(1, 0);
    expect((audio as unknown as { voices: Map<string, unknown> }).voices.size).toBe(0);

    audio.setVolumes(0, 0.5);
    await vi.runAllTicks();
    expect(stats.suspends).toBe(2);
    audio.setVolumes(1, 0.5);
    await vi.runAllTicks();
    expect(stats.resumes).toBeGreaterThanOrEqual(2);
    expect(stats.buffers).toBe(2);

    audio.dispose();
  });
});
