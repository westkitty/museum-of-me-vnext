import type { ResourceScope } from '../assets/ResourceScope';
import { ResourceScope as ScopedPool } from '../assets/ResourceScope';
import type { AudioAssetLoader } from './AudioAssetLoader';
import {
  assertValidMusicCueSheet,
  type CueSheetValidationOptions,
  type MusicCueKind,
  type MusicCueSheet,
  type MusicLoopRegion,
  type MusicNamedCue,
  type MusicStemDefinition,
} from './cueSheet';

export type MusicSessionState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'disposed';

export type MusicTimingSource = 'audio-clock' | 'silent-timeline';

/**
 * Policy governing how `seek(targetSeconds)` treats cues between the old and new
 * timeline positions:
 * - `'skip'` (default): Do not burst skipped cues in `[oldPos, targetSeconds)`.
 *   Cues strictly `< targetSeconds` are bypassed; cues `>= targetSeconds` fire
 *   normally as playback continues forward from `targetSeconds`.
 * - `'fire-crossed'`: When seeking forward (`targetSeconds > oldPos`), fire all
 *   unfired cues with `timeSeconds <= targetSeconds` in chronological order;
 *   when seeking backward, reposition cleanly to `>= targetSeconds` without
 *   backward firing.
 */
export type SeekCuePolicy = 'skip' | 'fire-crossed';

export interface MusicCueEvent {
  readonly sessionId: string;
  readonly cue: MusicNamedCue;
  readonly positionSeconds: number;
  readonly loopCount: number;
  readonly timingSource: MusicTimingSource;
  readonly audible: boolean;
}

export interface MusicCueDescriptionEvent {
  readonly sessionId: string;
  readonly title: string;
  readonly cueId: string | null;
  readonly kind: MusicCueKind | 'playback';
  readonly text: string;
  readonly statusText: string;
  readonly positionSeconds: number;
  readonly audible: boolean;
}

export interface MusicSessionSnapshot {
  readonly id: string;
  readonly title: string;
  readonly state: MusicSessionState;
  readonly timingSource: MusicTimingSource;
  readonly positionSeconds: number;
  readonly durationSeconds: number | null;
  readonly loopCount: number;
  readonly sessionGain: number;
  readonly stemGains: Readonly<Record<string, number>>;
  readonly groupGains: Readonly<Record<string, number>>;
  readonly activeCueId: string | null;
  readonly activeSectionId: string | null;
  readonly currentDescription: string | null;
  readonly audioDegraded: boolean;
  readonly loadErrors: readonly string[];
  readonly activeSourceCount: number;
  readonly isLifecycleSuspended: boolean;
  readonly isMuted: boolean;
}

export interface CreateMusicSessionOptions {
  readonly scope?: ResourceScope;
  readonly signal?: AbortSignal;
  readonly seekCuePolicy?: SeekCuePolicy;
  readonly initialGain?: number;
  readonly initialStemGains?: Readonly<Record<string, number>>;
  readonly initialGroupGains?: Readonly<Record<string, number>>;
  readonly scheduleLeadSeconds?: number;
  readonly validateOptions?: CueSheetValidationOptions;
}

export interface MusicSessionHost {
  getContext(): AudioContext | null;
  getMusicBus(): GainNode | null;
  isMusicAudible(): boolean;
  isLifecycleSuspended(): boolean;
  getAssetLoader(): AudioAssetLoader;
  onSessionDisposed(session: MusicSession): void;
  emitDescription(event: MusicCueDescriptionEvent): void;
  emitStateChange(): void;
}

interface GainRampState {
  current: number;
  startValue: number;
  target: number;
  duration: number;
  elapsed: number;
}

interface ActiveSourceHandle {
  readonly stemId: string;
  readonly source: AudioBufferSourceNode;
  readonly onEnded: (() => void) | null;
}

const MAX_LOOP_CATCHUP_ITERATIONS = 16;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function makeRampState(initial: number): GainRampState {
  const clamped = clamp01(initial);
  return { current: clamped, startValue: clamped, target: clamped, duration: 0, elapsed: 0 };
}

function advanceRamp(ramp: GainRampState, dt: number): void {
  if (ramp.duration <= 0 || ramp.elapsed >= ramp.duration) {
    ramp.current = ramp.target;
    ramp.duration = 0;
    ramp.elapsed = 0;
    return;
  }
  ramp.elapsed = Math.min(ramp.duration, ramp.elapsed + Math.max(0, dt));
  const t = ramp.duration > 0 ? ramp.elapsed / ramp.duration : 1;
  ramp.current = ramp.startValue + (ramp.target - ramp.startValue) * t;
  if (ramp.elapsed >= ramp.duration) {
    ramp.current = ramp.target;
    ramp.duration = 0;
    ramp.elapsed = 0;
  }
}

function setRampTarget(
  ramp: GainRampState,
  target: number,
  fadeSeconds: number,
  node: GainNode | null,
  ctx: AudioContext | null,
): void {
  const clamped = clamp01(target);
  const safeFade = Number.isFinite(fadeSeconds) && fadeSeconds > 0 ? fadeSeconds : 0;
  ramp.startValue = ramp.current;
  ramp.target = clamped;
  ramp.duration = safeFade;
  ramp.elapsed = 0;
  if (safeFade === 0) {
    ramp.current = clamped;
  }

  if (!node || !ctx) return;
  const now = ctx.currentTime;
  const param = node.gain;
  param.cancelScheduledValues(now);
  param.setValueAtTime(ramp.current, now);
  if (safeFade === 0) {
    param.value = clamped;
  } else {
    param.linearRampToValueAtTime(clamped, now + safeFade);
  }
}

/**
 * Reusable synchronized multitrack music session.
 *
 * Supports:
 * - One exact Web Audio transport anchor shared across all stems & stem groups
 * - Per-stem, per-group, and session gain ramps / smooth crossfades
 * - Dual timing reference: authoritative `AudioContext.currentTime` when running
 *   and audible, with deterministic silent logical timeline fallback when muted
 *   or when Web Audio is unavailable/degraded
 * - Exact pause/resume offset preservation and tab-hide lifecycle suspension
 * - Explicit, documented `SeekCuePolicy`
 * - Deterministic `ResourceScope` and `AbortSignal` cleanup
 */
export class MusicSession {
  readonly sheet: MusicCueSheet;
  private readonly host: MusicSessionHost;
  private readonly parentScope: ResourceScope | null;
  private readonly sessionScope: ScopedPool;
  private readonly externalSignal: AbortSignal | null;
  private readonly onExternalAbort: (() => void) | null;
  private readonly defaultSeekPolicy: SeekCuePolicy;
  private readonly scheduleLeadSeconds: number;

  private sessionState: MusicSessionState = 'idle';
  private positionSeconds = 0;
  private loopCount = 0;
  private nextCueIndex = 0;
  private activeCueId: string | null = null;
  private activeSectionId: string | null = null;
  private currentDescription: string | null = null;

  private readonly sessionGainRamp: GainRampState;
  private readonly stemRamps = new Map<string, GainRampState>();
  private readonly groupRamps = new Map<string, GainRampState>();

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loadErrorsList: string[] = [];
  private audioDegraded = false;
  private buffersLoaded = false;

  private loadGeneration = 0;
  private loadAbortController: AbortController | null = null;
  private pendingStopFadeRemaining: number | null = null;

  private boundCtx: AudioContext | null = null;
  private sessionGainNode: GainNode | null = null;
  private readonly groupGainNodes = new Map<string, GainNode>();
  private readonly stemGainNodes = new Map<string, GainNode>();
  private readonly activeSources = new Map<string, ActiveSourceHandle>();

  private audioAttached = false;
  private audioAnchorCtxTime = 0;
  private consumedAudioDelta = 0;

  private readonly cueListeners = new Set<(event: MusicCueEvent) => void>();
  private readonly cueIdListeners = new Map<string, Set<(event: MusicCueEvent) => void>>();
  private readonly descriptionListeners = new Set<(event: MusicCueDescriptionEvent) => void>();
  private readonly stateListeners = new Set<(snapshot: MusicSessionSnapshot) => void>();
  private readonly endListeners = new Set<(snapshot: MusicSessionSnapshot) => void>();

  constructor(
    host: MusicSessionHost,
    cueSheet: MusicCueSheet,
    options: CreateMusicSessionOptions = {},
  ) {
    this.sheet = assertValidMusicCueSheet(cueSheet, options.validateOptions);
    this.host = host;
    this.parentScope = options.scope ?? null;
    this.sessionScope = new ScopedPool(`music:${this.sheet.id}`);
    this.externalSignal = options.signal ?? null;
    this.defaultSeekPolicy = options.seekCuePolicy ?? 'skip';
    this.scheduleLeadSeconds = Number.isFinite(options.scheduleLeadSeconds) && (options.scheduleLeadSeconds ?? 0) >= 0
      ? (options.scheduleLeadSeconds ?? 0)
      : 0;

    this.sessionGainRamp = makeRampState(options.initialGain ?? 1);

    for (const stem of this.sheet.stems) {
      const initialStem = options.initialStemGains?.[stem.id] ?? stem.defaultGain ?? 1;
      this.stemRamps.set(stem.id, makeRampState(initialStem));
      if (stem.groupId && !this.groupRamps.has(stem.groupId)) {
        const initialGroup = options.initialGroupGains?.[stem.groupId] ?? 1;
        this.groupRamps.set(stem.groupId, makeRampState(initialGroup));
      }
    }
    if (options.initialGroupGains) {
      for (const [groupId, value] of Object.entries(options.initialGroupGains)) {
        if (!this.groupRamps.has(groupId)) {
          this.groupRamps.set(groupId, makeRampState(value));
        }
      }
    }

    if (this.parentScope) {
      if (this.parentScope.isDisposed) {
        this.markDisposedWithoutParent();
        this.onExternalAbort = null;
        return;
      }
      this.parentScope.track(this);
    }

    if (this.externalSignal) {
      if (this.externalSignal.aborted) {
        this.onExternalAbort = null;
        this.dispose();
        return;
      }
      this.onExternalAbort = () => this.dispose();
      this.externalSignal.addEventListener('abort', this.onExternalAbort, { once: true });
    } else {
      this.onExternalAbort = null;
    }
  }

  get id(): string {
    return this.sheet.id;
  }

  get title(): string {
    return this.sheet.title ?? this.sheet.id;
  }

  get state(): MusicSessionState {
    return this.sessionState;
  }

  get isDisposed(): boolean {
    return this.sessionState === 'disposed';
  }

  get timingSource(): MusicTimingSource {
    const ctx = this.host.getContext();
    if (
      this.audioAttached
      && !this.audioDegraded
      && !this.host.isLifecycleSuspended()
      && this.host.isMusicAudible()
      && ctx !== null
      && ctx.state === 'running'
    ) {
      return 'audio-clock';
    }
    return 'silent-timeline';
  }

  getStemGain(stemId: string): number {
    return this.stemRamps.get(stemId)?.current ?? 0;
  }

  getGroupGain(groupId: string): number {
    return this.groupRamps.get(groupId)?.current ?? 1;
  }

  getSessionGain(): number {
    return this.sessionGainRamp.current;
  }

  snapshot(): MusicSessionSnapshot {
    const stemGains: Record<string, number> = {};
    for (const [id, ramp] of this.stemRamps) stemGains[id] = ramp.current;
    const groupGains: Record<string, number> = {};
    for (const [id, ramp] of this.groupRamps) groupGains[id] = ramp.current;
    return {
      id: this.sheet.id,
      title: this.title,
      state: this.sessionState,
      timingSource: this.timingSource,
      positionSeconds: this.positionSeconds,
      durationSeconds: this.resolvedDurationSeconds(),
      loopCount: this.loopCount,
      sessionGain: this.sessionGainRamp.current,
      stemGains,
      groupGains,
      activeCueId: this.activeCueId,
      activeSectionId: this.activeSectionId,
      currentDescription: this.currentDescription,
      audioDegraded: this.audioDegraded,
      loadErrors: [...this.loadErrorsList],
      activeSourceCount: this.activeSources.size,
      isLifecycleSuspended: this.host.isLifecycleSuspended(),
      isMuted: !this.host.isMusicAudible(),
    };
  }

  onCue(fn: (event: MusicCueEvent) => void): () => void {
    if (this.isDisposed) return () => {};
    this.cueListeners.add(fn);
    return () => this.cueListeners.delete(fn);
  }

  onCueId(cueId: string, fn: (event: MusicCueEvent) => void): () => void {
    if (this.isDisposed) return () => {};
    let set = this.cueIdListeners.get(cueId);
    if (!set) {
      set = new Set();
      this.cueIdListeners.set(cueId, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
      if (set.size === 0) this.cueIdListeners.delete(cueId);
    };
  }

  onCueDescription(fn: (event: MusicCueDescriptionEvent) => void): () => void {
    if (this.isDisposed) return () => {};
    this.descriptionListeners.add(fn);
    return () => this.descriptionListeners.delete(fn);
  }

  onStateChange(fn: (snapshot: MusicSessionSnapshot) => void): () => void {
    if (this.isDisposed) return () => {};
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  onEnd(fn: (snapshot: MusicSessionSnapshot) => void): () => void {
    if (this.isDisposed) return () => {};
    this.endListeners.add(fn);
    return () => this.endListeners.delete(fn);
  }

  /**
   * Load and decode local stem audio buffers when Web Audio is available.
   * When audio is unavailable or muted, succeeds cleanly for silent-timeline mode.
   * On missing/corrupt local files, falls back gracefully to degraded silent mode.
   */
  async load(opts: { forceAudioLoad?: boolean } = {}): Promise<boolean> {
    if (this.isDisposed || this.externalSignal?.aborted) return false;
    if (this.buffersLoaded && !this.audioDegraded) return true;

    const ctx = this.host.getContext();
    const shouldLoadAudio = ctx !== null && (opts.forceAudioLoad === true || this.host.isMusicAudible());
    if (!shouldLoadAudio) {
      return true;
    }

    const gen = ++this.loadGeneration;
    this.cancelInFlightLoad();
    const controller = new AbortController();
    this.loadAbortController = controller;

    const prevState = this.sessionState;
    if (prevState === 'idle' || prevState === 'stopped' || prevState === 'ended') {
      this.sessionState = 'loading';
      this.emitState();
    }

    const ok = await this.performAudioLoad(gen, controller.signal);
    if (this.loadAbortController === controller) {
      this.loadAbortController = null;
    }
    if (gen !== this.loadGeneration || this.isDisposed || this.externalSignal?.aborted) {
      return false;
    }
    if (this.sessionState === 'loading') {
      this.sessionState = prevState === 'loading' ? 'idle' : prevState;
      this.emitState();
    }
    return ok;
  }

  async play(opts: { fromSeconds?: number } = {}): Promise<boolean> {
    if (this.isDisposed || this.externalSignal?.aborted) return false;

    this.pendingStopFadeRemaining = null;
    this.detachAudioSources();

    const targetStart = this.clampToDuration(opts.fromSeconds ?? 0);
    this.positionSeconds = targetStart;
    this.loopCount = 0;
    this.activeCueId = null;
    this.activeSectionId = this.sectionAtTime(targetStart);
    this.currentDescription = null;
    this.nextCueIndex = this.findCueIndexFrom(targetStart);

    const gen = ++this.loadGeneration;
    this.cancelInFlightLoad();

    const ctx = this.host.getContext();
    const needsAudioLoad =
      !this.buffersLoaded
      && !this.audioDegraded
      && ctx !== null
      && this.host.isMusicAudible()
      && !this.host.isLifecycleSuspended();

    if (needsAudioLoad) {
      this.sessionState = 'loading';
      this.emitState();
      const controller = new AbortController();
      this.loadAbortController = controller;
      await this.performAudioLoad(gen, controller.signal);
      if (this.loadAbortController === controller) {
        this.loadAbortController = null;
      }
      if (gen !== this.loadGeneration || this.isDisposed || this.externalSignal?.aborted) {
        return false;
      }
      if (this.sessionState !== 'loading') {
        return false;
      }
    }

    this.sessionState = 'playing';
    this.syncAudioAttachment();
    this.evaluateCues(this.positionSeconds);
    this.emitState();
    return true;
  }

  pause(): void {
    if (this.isDisposed) return;
    this.pendingStopFadeRemaining = null;
    if (this.sessionState === 'loading') {
      this.loadGeneration++;
      this.cancelInFlightLoad();
      this.sessionState = 'paused';
      this.emitState();
      return;
    }
    if (this.sessionState !== 'playing') return;

    this.captureLiveAudioOffset();
    this.detachAudioSources();
    this.sessionState = 'paused';
    this.emitState();
  }

  async resume(): Promise<boolean> {
    if (this.isDisposed || this.externalSignal?.aborted) return false;
    if (this.sessionState === 'playing') return true;
    if (this.sessionState !== 'paused') return false;

    this.pendingStopFadeRemaining = null;
    const gen = ++this.loadGeneration;
    this.cancelInFlightLoad();

    const ctx = this.host.getContext();
    const needsAudioLoad =
      !this.buffersLoaded
      && !this.audioDegraded
      && ctx !== null
      && this.host.isMusicAudible()
      && !this.host.isLifecycleSuspended();

    if (needsAudioLoad) {
      this.sessionState = 'loading';
      this.emitState();
      const controller = new AbortController();
      this.loadAbortController = controller;
      await this.performAudioLoad(gen, controller.signal);
      if (this.loadAbortController === controller) {
        this.loadAbortController = null;
      }
      if (gen !== this.loadGeneration || this.isDisposed || this.externalSignal?.aborted) {
        return false;
      }
      if (this.sessionState !== 'loading') {
        return false;
      }
    }

    this.sessionState = 'playing';
    this.syncAudioAttachment();
    this.evaluateCues(this.positionSeconds);
    this.emitState();
    return true;
  }

  stop(): void {
    if (this.isDisposed) return;
    if (this.sessionState === 'idle' && this.positionSeconds === 0 && this.activeSources.size === 0) {
      return;
    }
    this.loadGeneration++;
    this.cancelInFlightLoad();
    this.pendingStopFadeRemaining = null;
    this.detachAudioSources();
    this.teardownAudioGraph();

    this.positionSeconds = 0;
    this.loopCount = 0;
    this.nextCueIndex = 0;
    this.activeCueId = null;
    this.activeSectionId = null;
    this.currentDescription = null;
    this.sessionState = 'stopped';
    this.emitState();
  }

  seek(seconds: number, opts?: { readonly cuePolicy?: SeekCuePolicy }): void {
    if (this.isDisposed) return;
    const policy = opts?.cuePolicy ?? this.defaultSeekPolicy;
    const previous = this.positionSeconds;
    const target = this.clampToDuration(Number.isFinite(seconds) ? seconds : 0);

    if (policy === 'fire-crossed' && target > previous) {
      this.positionSeconds = target;
      this.evaluateCues(target);
    } else {
      this.positionSeconds = target;
      this.nextCueIndex = this.findCueIndexFrom(target);
    }

    this.activeSectionId = this.sectionAtTime(this.positionSeconds);

    if (this.sessionState === 'ended') {
      const duration = this.resolvedDurationSeconds();
      if (duration === null || this.positionSeconds < duration) {
        this.sessionState = 'paused';
      }
    }

    if (this.sessionState === 'playing') {
      this.detachAudioSources();
      this.syncAudioAttachment();
    }
    this.emitState();
  }

  setSessionGain(gain: number, fadeSeconds = 0): void {
    if (this.isDisposed) return;
    this.pendingStopFadeRemaining = null;
    setRampTarget(this.sessionGainRamp, gain, fadeSeconds, this.sessionGainNode, this.boundCtx);
  }

  setStemGain(stemId: string, gain: number, fadeSeconds = 0): void {
    if (this.isDisposed) return;
    const ramp = this.stemRamps.get(stemId);
    if (!ramp) {
      throw new Error(`Unknown stem id "${stemId}" in cue sheet "${this.sheet.id}"`);
    }
    const node = this.stemGainNodes.get(stemId) ?? null;
    setRampTarget(ramp, gain, fadeSeconds, node, this.boundCtx);
  }

  setGroupGain(groupId: string, gain: number, fadeSeconds = 0): void {
    if (this.isDisposed) return;
    const ramp = this.groupRamps.get(groupId);
    if (!ramp) {
      throw new Error(`Unknown stem group id "${groupId}" in cue sheet "${this.sheet.id}"`);
    }
    const node = this.groupGainNodes.get(groupId) ?? null;
    setRampTarget(ramp, gain, fadeSeconds, node, this.boundCtx);
  }

  crossfadeTo(targetStemGains: Readonly<Record<string, number>>, fadeSeconds = 0.6): void {
    if (this.isDisposed) return;
    for (const [stemId, gain] of Object.entries(targetStemGains)) {
      this.setStemGain(stemId, gain, fadeSeconds);
    }
  }

  crossfadeStems(
    fromStemIds: string | readonly string[],
    toStemIds: string | readonly string[],
    fadeSeconds = 0.6,
    toGain = 1,
  ): void {
    if (this.isDisposed) return;
    const fromList = Array.isArray(fromStemIds) ? fromStemIds : [fromStemIds];
    const toList = Array.isArray(toStemIds) ? toStemIds : [toStemIds];
    for (const id of fromList) this.setStemGain(id, 0, fadeSeconds);
    for (const id of toList) this.setStemGain(id, toGain, fadeSeconds);
  }

  fadeOutAndStop(fadeSeconds: number): void {
    if (this.isDisposed) return;
    if (this.sessionState !== 'playing' && this.sessionState !== 'loading' && this.sessionState !== 'paused') {
      this.stop();
      return;
    }
    const safeFade = Number.isFinite(fadeSeconds) && fadeSeconds > 0 ? fadeSeconds : 0;
    if (safeFade === 0) {
      this.stop();
      return;
    }
    setRampTarget(this.sessionGainRamp, 0, safeFade, this.sessionGainNode, this.boundCtx);
    this.pendingStopFadeRemaining = safeFade;
  }

  /**
   * Called once per frame via `AudioManager.update(dt)` (or directly in unit tests).
   * Advances logical gain ramps, active timeline position, cues, loop regions,
   * and fade-out completion.
   */
  update(dt: number): void {
    if (this.isDisposed) return;
    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;

    advanceRamp(this.sessionGainRamp, safeDt);
    for (const ramp of this.groupRamps.values()) advanceRamp(ramp, safeDt);
    for (const ramp of this.stemRamps.values()) advanceRamp(ramp, safeDt);

    if (this.pendingStopFadeRemaining !== null) {
      this.pendingStopFadeRemaining -= safeDt;
      if (this.pendingStopFadeRemaining <= 0) {
        this.pendingStopFadeRemaining = null;
        this.stop();
        return;
      }
    }

    if (this.sessionState !== 'playing' || this.host.isLifecycleSuspended()) {
      return;
    }

    this.syncAudioAttachment();

    let stepDelta: number;
    const ctx = this.host.getContext();
    if (this.timingSource === 'audio-clock' && ctx) {
      const totalElapsed = Math.max(0, ctx.currentTime - this.audioAnchorCtxTime);
      stepDelta = Math.max(0, totalElapsed - this.consumedAudioDelta);
      this.consumedAudioDelta = totalElapsed;
    } else {
      stepDelta = safeDt;
    }

    if (stepDelta > 0) {
      this.advanceTimeline(stepDelta);
    }
  }

  /**
   * Synchronize audio attachment when volume, mute, context state, or lifecycle
   * suspension changes. Never creates duplicates or loses timeline position.
   */
  syncEnvironmentState(wasSuspended: boolean): void {
    if (this.isDisposed) return;
    if (this.sessionState !== 'playing') return;

    const suspendedNow = this.host.isLifecycleSuspended();
    if (!wasSuspended && suspendedNow) {
      this.captureLiveAudioOffset();
      this.detachAudioSources();
      this.emitState();
      return;
    }

    this.syncAudioAttachment();
  }

  dispose(): void {
    if (this.sessionState === 'disposed') return;
    this.loadGeneration++;
    this.cancelInFlightLoad();
    this.pendingStopFadeRemaining = null;
    this.detachAudioSources();
    this.teardownAudioGraph();

    if (this.externalSignal && this.onExternalAbort) {
      this.externalSignal.removeEventListener('abort', this.onExternalAbort);
    }

    this.sessionState = 'disposed';
    this.buffers.clear();
    this.buffersLoaded = false;
    this.cueListeners.clear();
    this.cueIdListeners.clear();
    this.descriptionListeners.clear();
    this.stateListeners.clear();
    this.endListeners.clear();

    this.sessionScope.dispose();
    this.parentScope?.untrack(this);
    this.host.onSessionDisposed(this);
    this.host.emitStateChange();
  }

  private markDisposedWithoutParent(): void {
    this.sessionState = 'disposed';
    this.sessionScope.dispose();
  }

  private async performAudioLoad(generation: number, signal: AbortSignal): Promise<boolean> {
    const loader = this.host.getAssetLoader();
    const assetIds = new Set<string>(this.sheet.stems.map((s) => s.assetId));
    const loadedByAsset = new Map<string, AudioBuffer>();
    const errors: string[] = [];

    await Promise.all(
      [...assetIds].map(async (assetId) => {
        try {
          const buffer = await loader.load(assetId, this.sessionScope, signal);
          loadedByAsset.set(assetId, buffer);
        } catch (error) {
          if (signal.aborted || isAbortError(error)) return;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(msg);
        }
      }),
    );

    if (generation !== this.loadGeneration || signal.aborted || this.isDisposed) {
      return false;
    }

    if (errors.length > 0) {
      this.loadErrorsList.push(...errors);
      this.audioDegraded = true;
      this.buffersLoaded = false;
      this.buffers.clear();
      console.warn(`[MusicSession:${this.sheet.id}] audio unavailable; using silent timeline fallback:`, errors);
      return false;
    }

    this.buffers.clear();
    for (const stem of this.sheet.stems) {
      const buf = loadedByAsset.get(stem.assetId);
      if (buf) this.buffers.set(stem.id, buf);
    }
    this.buffersLoaded = this.buffers.size === this.sheet.stems.length;
    this.audioDegraded = false;
    return this.buffersLoaded;
  }

  private syncAudioAttachment(): void {
    if (this.sessionState !== 'playing' || this.host.isLifecycleSuspended()) {
      this.detachAudioSources();
      return;
    }
    const ctx = this.host.getContext();
    const bus = this.host.getMusicBus();
    const audible = this.host.isMusicAudible();
    if (!ctx || ctx.state !== 'running' || !bus || !audible || this.audioDegraded) {
      if (this.audioAttached) {
        this.captureLiveAudioOffset();
        this.detachAudioSources();
      }
      return;
    }

    if (!this.buffersLoaded) {
      if (!this.loadAbortController) {
        const gen = this.loadGeneration;
        const controller = new AbortController();
        this.loadAbortController = controller;
        void this.performAudioLoad(gen, controller.signal).then((ok) => {
          if (this.loadAbortController === controller) {
            this.loadAbortController = null;
          }
          if (ok && gen === this.loadGeneration && this.sessionState === 'playing' && !this.isDisposed) {
            this.syncAudioAttachment();
          }
        });
      }
      return;
    }

    if (!this.audioAttached || this.boundCtx !== ctx) {
      this.attachAudioSources(ctx, bus);
    }
  }

  private ensureAudioGraph(ctx: AudioContext, musicBus: GainNode): void {
    if (this.boundCtx !== ctx) {
      this.teardownAudioGraph();
      this.boundCtx = ctx;
    }

    if (!this.sessionGainNode) {
      const node = ctx.createGain();
      node.gain.value = this.sessionGainRamp.current;
      node.connect(musicBus);
      this.sessionGainNode = node;
      this.applyPendingRampToNode(this.sessionGainRamp, node, ctx);
    }

    for (const [groupId, ramp] of this.groupRamps) {
      if (!this.groupGainNodes.has(groupId)) {
        const node = ctx.createGain();
        node.gain.value = ramp.current;
        node.connect(this.sessionGainNode);
        this.groupGainNodes.set(groupId, node);
        this.applyPendingRampToNode(ramp, node, ctx);
      }
    }

    for (const stem of this.sheet.stems) {
      if (!this.stemGainNodes.has(stem.id)) {
        const ramp = this.stemRamps.get(stem.id)!;
        const node = ctx.createGain();
        node.gain.value = ramp.current;
        const parent = (stem.groupId ? this.groupGainNodes.get(stem.groupId) : undefined) ?? this.sessionGainNode;
        node.connect(parent);
        this.stemGainNodes.set(stem.id, node);
        this.applyPendingRampToNode(ramp, node, ctx);
      }
    }
  }

  private applyPendingRampToNode(ramp: GainRampState, node: GainNode, ctx: AudioContext): void {
    const remaining = ramp.duration - ramp.elapsed;
    if (ramp.duration > 0 && remaining > 0) {
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(ramp.current, now);
      node.gain.linearRampToValueAtTime(ramp.target, now + remaining);
    }
  }

  private attachAudioSources(ctx: AudioContext, musicBus: GainNode): void {
    this.detachAudioSources();
    this.ensureAudioGraph(ctx, musicBus);

    // One shared transport origin across all stems in this session.
    const anchorCtxTime = ctx.currentTime + this.scheduleLeadSeconds;
    this.audioAnchorCtxTime = anchorCtxTime;
    this.consumedAudioDelta = 0;
    this.audioAttached = true;

    const sheetRegion = this.effectiveLoopRegion();
    const sheetLoops = Boolean(this.sheet.loop || sheetRegion);

    for (const stem of this.sheet.stems) {
      const buffer = this.buffers.get(stem.id);
      const stemGain = this.stemGainNodes.get(stem.id);
      if (!buffer || !stemGain) continue;

      const stemOffset = stem.startOffsetSeconds ?? 0;
      const stemRegion = stem.loopRegion ?? sheetRegion;
      const stemLoops = stem.loop ?? sheetLoops;
      const bufferDuration = Number.isFinite(buffer.duration) && buffer.duration > 0
        ? buffer.duration
        : (stem.durationSeconds ?? this.resolvedDurationSeconds() ?? 1);
      const explicitDuration = stem.durationSeconds;

      if (!stemLoops && this.loopCount > 0) continue;

      let when = anchorCtxTime;
      let bufferOffset = 0;
      if (this.positionSeconds < stemOffset) {
        when = anchorCtxTime + (stemOffset - this.positionSeconds);
        bufferOffset = 0;
      } else {
        bufferOffset = this.positionSeconds - stemOffset;
        if (!stemLoops && bufferOffset >= Math.min(bufferDuration, explicitDuration ?? bufferDuration)) {
          continue;
        }
        if (stemLoops && stemRegion) {
          const regionSpan = stemRegion.endSeconds - stemRegion.startSeconds;
          if (bufferOffset >= stemRegion.endSeconds && regionSpan > 0) {
            bufferOffset = stemRegion.startSeconds + ((bufferOffset - stemRegion.startSeconds) % regionSpan);
          }
        } else if (stemLoops && bufferDuration > 0) {
          bufferOffset = bufferOffset % bufferDuration;
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (stemLoops) {
        source.loop = true;
        if (stemRegion) {
          source.loopStart = stemRegion.startSeconds;
          source.loopEnd = Math.min(stemRegion.endSeconds, bufferDuration);
        } else if (this.sheet.durationSeconds !== undefined) {
          source.loopStart = 0;
          source.loopEnd = Math.min(this.sheet.durationSeconds, bufferDuration);
        }
      } else {
        source.loop = false;
      }

      source.connect(stemGain);
      const handle: ActiveSourceHandle = {
        stemId: stem.id,
        source,
        onEnded: () => {
          if (this.activeSources.get(stem.id) === handle) {
            this.activeSources.delete(stem.id);
          }
          try {
            if (typeof source.disconnect === 'function') source.disconnect();
          } catch { /* already disconnected */ }
        },
      };
      if (typeof source.addEventListener === 'function') {
        source.addEventListener('ended', handle.onEnded!, { once: true });
      }
      this.activeSources.set(stem.id, handle);

      if (!stemLoops && explicitDuration !== undefined) {
        const remaining = Math.max(0, explicitDuration - bufferOffset);
        if (remaining > 0) {
          source.start(when, bufferOffset, remaining);
        }
      } else {
        source.start(when, bufferOffset);
      }
    }
  }

  private captureLiveAudioOffset(): void {
    if (!this.audioAttached) return;
    const ctx = this.boundCtx ?? this.host.getContext();
    if (!ctx) return;
    const totalElapsed = Math.max(0, ctx.currentTime - this.audioAnchorCtxTime);
    const remainingDelta = Math.max(0, totalElapsed - this.consumedAudioDelta);
    this.consumedAudioDelta = totalElapsed;
    if (remainingDelta > 0 && this.sessionState === 'playing') {
      this.advanceTimeline(remainingDelta);
    }
  }

  private detachAudioSources(): void {
    this.audioAttached = false;
    for (const handle of this.activeSources.values()) {
      if (handle.onEnded && typeof handle.source.removeEventListener === 'function') {
        handle.source.removeEventListener('ended', handle.onEnded);
      }
      try {
        handle.source.stop();
      } catch { /* already stopped or unstarted */ }
      try {
        if (typeof handle.source.disconnect === 'function') handle.source.disconnect();
      } catch { /* already disconnected */ }
    }
    this.activeSources.clear();
  }

  private teardownAudioGraph(): void {
    const now = this.boundCtx?.currentTime ?? 0;
    for (const node of this.stemGainNodes.values()) {
      try { node.gain.cancelScheduledValues(now); } catch { /* ignore */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.stemGainNodes.clear();

    for (const node of this.groupGainNodes.values()) {
      try { node.gain.cancelScheduledValues(now); } catch { /* ignore */ }
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    this.groupGainNodes.clear();

    if (this.sessionGainNode) {
      try { this.sessionGainNode.gain.cancelScheduledValues(now); } catch { /* ignore */ }
      try { this.sessionGainNode.disconnect(); } catch { /* already disconnected */ }
      this.sessionGainNode = null;
    }
    this.boundCtx = null;
  }

  private advanceTimeline(stepDelta: number): void {
    let remaining = stepDelta;
    const loopRegion = this.effectiveLoopRegion();
    const duration = this.resolvedDurationSeconds();

    if (loopRegion) {
      const loopSpan = loopRegion.endSeconds - loopRegion.startSeconds;
      let iterations = 0;
      while (remaining > 0 && iterations < MAX_LOOP_CATCHUP_ITERATIONS) {
        iterations++;
        const nextPos = this.positionSeconds + remaining;
        if (nextPos < loopRegion.endSeconds) {
          this.positionSeconds = nextPos;
          this.activeSectionId = this.sectionAtTime(this.positionSeconds);
          this.evaluateCues(this.positionSeconds);
          remaining = 0;
          break;
        }
        const toBoundary = Math.max(0, loopRegion.endSeconds - this.positionSeconds);
        this.positionSeconds = loopRegion.endSeconds;
        this.evaluateCues(loopRegion.endSeconds);
        remaining -= toBoundary;

        this.loopCount++;
        this.positionSeconds = loopRegion.startSeconds;
        this.nextCueIndex = this.findCueIndexFrom(loopRegion.startSeconds);
        this.activeSectionId = this.sectionAtTime(this.positionSeconds);
        this.evaluateCues(loopRegion.startSeconds);

        if (loopSpan > 0 && remaining >= loopSpan * MAX_LOOP_CATCHUP_ITERATIONS) {
          const skipLoops = Math.floor(remaining / loopSpan);
          this.loopCount += skipLoops;
          remaining = remaining % loopSpan;
        }
      }
      return;
    }

    const nextPos = this.positionSeconds + remaining;
    if (duration !== null && nextPos >= duration) {
      this.positionSeconds = duration;
      this.activeSectionId = this.sectionAtTime(duration);
      this.evaluateCues(duration);
      this.detachAudioSources();
      this.sessionState = 'ended';
      const snap = this.snapshot();
      this.emitState(snap);
      for (const fn of [...this.endListeners]) fn(snap);
      return;
    }

    this.positionSeconds = nextPos;
    this.activeSectionId = this.sectionAtTime(nextPos);
    this.evaluateCues(nextPos);
  }

  private evaluateCues(upToSeconds: number): void {
    const cues = this.sheet.cues;
    if (!cues || cues.length === 0) return;
    while (this.nextCueIndex < cues.length) {
      const cue = cues[this.nextCueIndex];
      if (cue.timeSeconds > upToSeconds + 1e-9) break;
      this.nextCueIndex++;
      this.emitCue(cue);
    }
  }

  private emitCue(cue: MusicNamedCue): void {
    this.activeCueId = cue.id;
    if (cue.sectionId) this.activeSectionId = cue.sectionId;

    const audible = this.host.isMusicAudible() && !this.audioDegraded && this.host.getContext()?.state === 'running';
    const event: MusicCueEvent = {
      sessionId: this.sheet.id,
      cue,
      positionSeconds: this.positionSeconds,
      loopCount: this.loopCount,
      timingSource: this.timingSource,
      audible,
    };

    for (const fn of [...this.cueListeners]) fn(event);
    const idSet = this.cueIdListeners.get(cue.id);
    if (idSet) {
      for (const fn of [...idSet]) fn(event);
    }

    if (cue.label && cue.label.trim().length > 0) {
      this.currentDescription = cue.label.trim();
      const descriptionEvent: MusicCueDescriptionEvent = {
        sessionId: this.sheet.id,
        title: this.title,
        cueId: cue.id,
        kind: cue.kind ?? 'cue',
        text: this.currentDescription,
        statusText: `${this.title} — ${this.currentDescription}`,
        positionSeconds: this.positionSeconds,
        audible,
      };
      for (const fn of [...this.descriptionListeners]) fn(descriptionEvent);
      this.host.emitDescription(descriptionEvent);
    }
  }

  private findCueIndexFrom(seconds: number): number {
    const cues = this.sheet.cues;
    if (!cues || cues.length === 0) return 0;
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].timeSeconds >= seconds - 1e-9) return i;
    }
    return cues.length;
  }

  private sectionAtTime(seconds: number): string | null {
    const sections = this.sheet.sections;
    if (!sections) return this.activeSectionId;
    for (const section of sections) {
      const start = section.startSeconds ?? 0;
      const end = section.endSeconds;
      if (seconds >= start && (end === undefined || seconds < end)) {
        return section.id;
      }
    }
    return null;
  }

  private effectiveLoopRegion(): MusicLoopRegion | null {
    if (this.sheet.loopRegion) return this.sheet.loopRegion;
    if (this.sheet.loop) {
      const duration = this.resolvedDurationSeconds();
      if (duration !== null && duration > 0) {
        return { startSeconds: 0, endSeconds: duration };
      }
    }
    return null;
  }

  private resolvedDurationSeconds(): number | null {
    if (this.sheet.durationSeconds !== undefined) return this.sheet.durationSeconds;
    let maxEnd = 0;
    for (const stem of this.sheet.stems) {
      const offset = stem.startOffsetSeconds ?? 0;
      const buf = this.buffers.get(stem.id);
      const len = stem.durationSeconds ?? (buf && Number.isFinite(buf.duration) ? buf.duration : 0);
      if (len > 0) maxEnd = Math.max(maxEnd, offset + len);
    }
    if (maxEnd > 0) return maxEnd;
    if (this.sheet.endMarkerSeconds !== undefined && this.sheet.endMarkerSeconds > 0) {
      return this.sheet.endMarkerSeconds;
    }
    if (this.sheet.loopRegion) return this.sheet.loopRegion.endSeconds;
    return null;
  }

  private clampToDuration(seconds: number): number {
    const clampedMin = Math.max(0, seconds);
    const duration = this.resolvedDurationSeconds();
    if (duration !== null) {
      return Math.min(duration, clampedMin);
    }
    return clampedMin;
  }

  private cancelInFlightLoad(): void {
    if (this.loadAbortController) {
      this.loadAbortController.abort();
      this.loadAbortController = null;
    }
  }

  private emitState(precomputed?: MusicSessionSnapshot): void {
    const snap = precomputed ?? this.snapshot();
    for (const fn of [...this.stateListeners]) fn(snap);
    this.host.emitStateChange();
  }
}

export function isSameStemGain(stem: MusicStemDefinition, actual: number): boolean {
  return Math.abs((stem.defaultGain ?? 1) - actual) < 1e-6;
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && ((error as { name?: string }).name === 'AbortError'
      || /abort|cancel/i.test(String((error as { message?: string }).message ?? ''))),
  );
}
