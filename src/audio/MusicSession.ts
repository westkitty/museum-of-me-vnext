import type { ResourceScope } from '../assets/ResourceScope';
import { ResourceScope as ScopedPool } from '../assets/ResourceScope';
import { analyzeAudioBufferSilence, type AudioAssetLoader } from './AudioAssetLoader';
import {
  assertValidMusicCueSheet,
  nextBarTimeSeconds,
  nextBeatTimeSeconds,
  nextMatchingCue,
  resolveDefaultLoopRegion,
  resolveLoopRegionById,
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

export type MusicQuantizeAt = 'immediate' | 'next-beat' | 'next-bar' | 'next-cue' | 'time';

export interface ScheduledMixOptions {
  readonly at: MusicQuantizeAt;
  readonly fadeSeconds?: number;
  readonly timeSeconds?: number;
  readonly cueId?: string;
  readonly cueKind?: MusicCueKind;
  readonly cueTag?: string;
  readonly minLeadSeconds?: number;
}

export interface MusicMixAppliedEvent {
  readonly sessionId: string;
  readonly handleId: string;
  readonly at: MusicQuantizeAt;
  readonly scheduledSeconds: number;
  readonly positionSeconds: number;
  readonly stemGains?: Readonly<Record<string, number>>;
  readonly groupGains?: Readonly<Record<string, number>>;
  readonly cueId?: string;
}

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
  readonly activeLoopRegionId: string | null;
  readonly sessionGain: number;
  readonly stemGains: Readonly<Record<string, number>>;
  readonly groupGains: Readonly<Record<string, number>>;
  readonly activeCueId: string | null;
  readonly activeSectionId: string | null;
  readonly currentDescription: string | null;
  readonly pendingMixTransitionCount: number;
  readonly silentStemIds: readonly string[];
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

interface StemPassSource {
  readonly stemId: string;
  readonly source: AudioBufferSourceNode;
  readonly passGain: GainNode | null;
  onEnded: (() => void) | null;
}

interface AudioLoopPass {
  readonly sources: Map<string, StemPassSource>;
  fadeOutTriggered: boolean;
  retireAtCtxTime: number | null;
}

interface PendingMixTransition {
  readonly handleId: string;
  readonly at: MusicQuantizeAt;
  readonly targetSeconds: number;
  remainingSeconds: number;
  readonly fadeSeconds: number;
  stemTargets: Record<string, number> | null;
  groupTargets: Record<string, number> | null;
  readonly cueId?: string;
}

const MAX_LOOP_CATCHUP_ITERATIONS = 16;
const LOOP_CROSSFADE_LOOKAHEAD_SECONDS = 0.25;
const LOOP_RETIRE_MARGIN_SECONDS = 0.02;
const EQUAL_POWER_CURVE_POINTS = 17;

function buildEqualPowerFadeCurve(fadeIn: boolean): Float32Array {
  const curve = new Float32Array(EQUAL_POWER_CURVE_POINTS);
  for (let i = 0; i < EQUAL_POWER_CURVE_POINTS; i++) {
    const u = i / (EQUAL_POWER_CURVE_POINTS - 1);
    curve[i] = fadeIn ? Math.sin(u * Math.PI * 0.5) : Math.cos(u * Math.PI * 0.5);
  }
  return curve;
}

const EQUAL_POWER_IN_CURVE = buildEqualPowerFadeCurve(true);
const EQUAL_POWER_OUT_CURVE = buildEqualPowerFadeCurve(false);

function schedulePassFade(
  param: AudioParam,
  fadeIn: boolean,
  startCtxTime: number,
  durationSeconds: number,
  nowCtxTime: number,
): void {
  const dur = Math.max(1e-4, durationSeconds);
  const effectiveStart = Math.max(nowCtxTime, startCtxTime);
  param.cancelScheduledValues(nowCtxTime);
  param.setValueAtTime(fadeIn ? 0 : 1, nowCtxTime);
  if (effectiveStart > nowCtxTime) {
    param.setValueAtTime(fadeIn ? 0 : 1, effectiveStart);
  }
  const curveParam = param as AudioParam & {
    setValueCurveAtTime?: (values: Float32Array, startTime: number, duration: number) => AudioParam;
  };
  if (typeof curveParam.setValueCurveAtTime === 'function') {
    try {
      curveParam.setValueCurveAtTime(fadeIn ? EQUAL_POWER_IN_CURVE : EQUAL_POWER_OUT_CURVE, effectiveStart, dur);
      return;
    } catch {
      // Fallback cleanly to linear ramp if an implementation rejects short curve windows.
    }
  }
  param.linearRampToValueAtTime(fadeIn ? 1 : 0, effectiveStart + dur);
}

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
  private readonly silentStemIdsSet = new Set<string>();
  private readonly loadErrorsList: string[] = [];
  private audioDegraded = false;
  private buffersLoaded = false;

  private loadGeneration = 0;
  private loadAbortController: AbortController | null = null;
  private pendingStopFadeRemaining: number | null = null;

  private explicitLoopRegion: MusicLoopRegion | null = null;
  private explicitLoopCleared = false;
  private mixSequence = 0;
  private readonly pendingMixTransitions: PendingMixTransition[] = [];

  private boundCtx: AudioContext | null = null;
  private sessionGainNode: GainNode | null = null;
  private readonly groupGainNodes = new Map<string, GainNode>();
  private readonly stemGainNodes = new Map<string, GainNode>();

  private activePass: AudioLoopPass | null = null;
  private scheduledNextPass: AudioLoopPass | null = null;
  private readonly retiringPasses: AudioLoopPass[] = [];
  private nextLoopBoundaryCtxTime: number | null = null;
  private runtimeCrossfadeStartCtxTime: number | null = null;

  private audioAttached = false;
  private audioAnchorCtxTime = 0;
  private consumedAudioDelta = 0;

  private readonly cueListeners = new Set<(event: MusicCueEvent) => void>();
  private readonly cueIdListeners = new Map<string, Set<(event: MusicCueEvent) => void>>();
  private readonly descriptionListeners = new Set<(event: MusicCueDescriptionEvent) => void>();
  private readonly mixAppliedListeners = new Set<(event: MusicMixAppliedEvent) => void>();
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
    this.explicitLoopRegion = resolveDefaultLoopRegion(this.sheet);

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

  getActiveLoopRegion(): MusicLoopRegion | null {
    return this.effectiveLoopRegion();
  }

  snapshot(): MusicSessionSnapshot {
    const stemGains: Record<string, number> = {};
    for (const [id, ramp] of this.stemRamps) stemGains[id] = ramp.current;
    const groupGains: Record<string, number> = {};
    for (const [id, ramp] of this.groupRamps) groupGains[id] = ramp.current;
    const activeLoop = this.effectiveLoopRegion();
    return {
      id: this.sheet.id,
      title: this.title,
      state: this.sessionState,
      timingSource: this.timingSource,
      positionSeconds: this.positionSeconds,
      durationSeconds: this.resolvedDurationSeconds(),
      loopCount: this.loopCount,
      activeLoopRegionId: activeLoop?.id ?? null,
      sessionGain: this.sessionGainRamp.current,
      stemGains,
      groupGains,
      activeCueId: this.activeCueId,
      activeSectionId: this.activeSectionId,
      currentDescription: this.currentDescription,
      pendingMixTransitionCount: this.pendingMixTransitions.length,
      silentStemIds: [...this.silentStemIdsSet],
      audioDegraded: this.audioDegraded,
      loadErrors: [...this.loadErrorsList],
      activeSourceCount: this.countActiveSources(),
      isLifecycleSuspended: this.host.isLifecycleSuspended(),
      isMuted: !this.host.isMusicAudible(),
    };
  }

  onMixApplied(fn: (event: MusicMixAppliedEvent) => void): () => void {
    if (this.isDisposed) return () => {};
    this.mixAppliedListeners.add(fn);
    return () => this.mixAppliedListeners.delete(fn);
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
    if (
      this.sessionState === 'idle'
      && this.positionSeconds === 0
      && this.countActiveSources() === 0
      && this.pendingMixTransitions.length === 0
    ) {
      return;
    }
    this.loadGeneration++;
    this.cancelInFlightLoad();
    this.pendingStopFadeRemaining = null;
    this.pendingMixTransitions.length = 0;
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
    this.recomputePendingMixDistances();

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

  /**
   * Switch or release the active loop region at runtime without restarting stems.
   * Passing `null` releases looping cleanly so the running transport plays
   * straight past the former loop boundary into the natural outro (`'ended'`).
   */
  setActiveLoopRegion(regionOrId: string | MusicLoopRegion | null): void {
    if (this.isDisposed) return;

    let resolved: MusicLoopRegion | null = null;
    if (regionOrId === null) {
      this.explicitLoopCleared = true;
      this.explicitLoopRegion = null;
    } else if (typeof regionOrId === 'string') {
      const found = resolveLoopRegionById(this.sheet, regionOrId);
      if (!found) {
        throw new Error(`Unknown loop region id "${regionOrId}" in cue sheet "${this.sheet.id}"`);
      }
      resolved = found;
      this.explicitLoopCleared = false;
      this.explicitLoopRegion = resolved;
    } else {
      const durationLimit = this.resolvedDurationSeconds();
      if (!Number.isFinite(regionOrId.startSeconds) || regionOrId.startSeconds < 0) {
        throw new Error('Loop region startSeconds must be a finite number >= 0');
      }
      if (!Number.isFinite(regionOrId.endSeconds) || regionOrId.endSeconds <= regionOrId.startSeconds) {
        throw new Error('Loop region endSeconds must be greater than startSeconds');
      }
      if (durationLimit !== null && regionOrId.endSeconds > durationLimit) {
        throw new Error(`Loop region endSeconds (${regionOrId.endSeconds}) exceeds durationSeconds (${durationLimit})`);
      }
      const cf = regionOrId.crossfadeSeconds;
      if (cf !== undefined && (!Number.isFinite(cf) || cf < 0 || cf >= (regionOrId.endSeconds - regionOrId.startSeconds) * 0.5)) {
        throw new Error('Loop region crossfadeSeconds must be >= 0 and < half of loop span');
      }
      resolved = regionOrId;
      this.explicitLoopCleared = false;
      this.explicitLoopRegion = resolved;
    }

    this.syncLiveLoopMode(resolved);
    this.recomputePendingMixDistances();
    this.emitState();
  }

  /**
   * Schedule gain automation for a single stem at an exact beat, bar, cue, or time
   * without restarting any running `AudioBufferSourceNode`.
   */
  scheduleStemGain(stemId: string, gain: number, opts: ScheduledMixOptions): string {
    if (!this.stemRamps.has(stemId)) {
      throw new Error(`Unknown stem id "${stemId}" in cue sheet "${this.sheet.id}"`);
    }
    return this.enqueueScheduledMix({ [stemId]: gain }, null, opts);
  }

  /**
   * Schedule gain automation for a stem group at an exact beat, bar, cue, or time.
   */
  scheduleGroupGain(groupId: string, gain: number, opts: ScheduledMixOptions): string {
    if (!this.groupRamps.has(groupId)) {
      throw new Error(`Unknown stem group id "${groupId}" in cue sheet "${this.sheet.id}"`);
    }
    return this.enqueueScheduledMix(null, { [groupId]: gain }, opts);
  }

  /**
   * Schedule a multi-stem gain transition on one quantized musical boundary.
   */
  scheduleMix(targetStemGains: Readonly<Record<string, number>>, opts: ScheduledMixOptions): string {
    for (const stemId of Object.keys(targetStemGains)) {
      if (!this.stemRamps.has(stemId)) {
        throw new Error(`Unknown stem id "${stemId}" in cue sheet "${this.sheet.id}"`);
      }
    }
    return this.enqueueScheduledMix(targetStemGains, null, opts);
  }

  cancelScheduledMix(handleId?: string): void {
    if (this.pendingMixTransitions.length === 0) return;
    if (handleId === undefined) {
      this.pendingMixTransitions.length = 0;
      return;
    }
    for (let i = this.pendingMixTransitions.length - 1; i >= 0; i--) {
      if (this.pendingMixTransitions[i].handleId === handleId) {
        this.pendingMixTransitions.splice(i, 1);
      }
    }
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
      this.retireExpiredPasses(ctx.currentTime);
      const totalElapsed = Math.max(0, ctx.currentTime - this.audioAnchorCtxTime);
      stepDelta = Math.max(0, totalElapsed - this.consumedAudioDelta);
      this.consumedAudioDelta = totalElapsed;
    } else {
      stepDelta = safeDt;
    }

    if (stepDelta > 0) {
      this.advanceTimeline(stepDelta);
    }

    if (this.timingSource === 'audio-clock' && ctx && this.sessionState === 'playing') {
      this.stepLoopCrossfadeScheduler(ctx);
      this.retireExpiredPasses(ctx.currentTime);
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
    this.silentStemIdsSet.clear();
    this.pendingMixTransitions.length = 0;
    this.buffersLoaded = false;
    this.cueListeners.clear();
    this.cueIdListeners.clear();
    this.descriptionListeners.clear();
    this.mixAppliedListeners.clear();
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
    this.silentStemIdsSet.clear();
    const newlySilent: string[] = [];
    for (const stem of this.sheet.stems) {
      const buf = loadedByAsset.get(stem.assetId);
      if (buf) {
        this.buffers.set(stem.id, buf);
        if (analyzeAudioBufferSilence(buf).isSilent) {
          this.silentStemIdsSet.add(stem.id);
          newlySilent.push(stem.id);
        }
      }
    }
    if (newlySilent.length > 0) {
      console.warn(
        `[MusicSession:${this.sheet.id}] stem(s) decoded as digital silence (${newlySilent.join(', ')}); skipping source allocation`,
      );
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

  private supportsPassCrossfade(): boolean {
    if (this.sheet.loopRegion?.crossfadeSeconds && this.sheet.loopRegion.crossfadeSeconds > 0) {
      return true;
    }
    if (this.explicitLoopRegion?.crossfadeSeconds && this.explicitLoopRegion.crossfadeSeconds > 0) {
      return true;
    }
    if (this.sheet.loopRegions?.some((r) => (r.crossfadeSeconds ?? 0) > 0)) {
      return true;
    }
    return false;
  }

  private isCrossfadeLoopRegion(region: MusicLoopRegion | null): region is MusicLoopRegion {
    return Boolean(region && region.crossfadeSeconds !== undefined && region.crossfadeSeconds > 0);
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
    const useCrossfadeLoop = this.isCrossfadeLoopRegion(sheetRegion);
    const needPassGain = this.supportsPassCrossfade();

    this.activePass = this.spawnAudioPass(
      ctx,
      anchorCtxTime,
      this.positionSeconds,
      sheetRegion,
      !useCrossfadeLoop,
      needPassGain,
      false,
    );

    if (useCrossfadeLoop && sheetRegion) {
      this.nextLoopBoundaryCtxTime = anchorCtxTime + this.remainingInRegionSeconds(sheetRegion, this.positionSeconds);
    } else {
      this.nextLoopBoundaryCtxTime = null;
    }
    this.runtimeCrossfadeStartCtxTime = null;
  }

  private spawnAudioPass(
    ctx: AudioContext,
    anchorCtxTime: number,
    timelineSeconds: number,
    sheetRegion: MusicLoopRegion | null,
    allowNativeLoop: boolean,
    createPassGain: boolean,
    wrapPassSchedule: boolean,
  ): AudioLoopPass {
    const pass: AudioLoopPass = {
      sources: new Map(),
      fadeOutTriggered: false,
      retireAtCtxTime: null,
    };
    const sheetLoops = Boolean(sheetRegion);

    for (const stem of this.sheet.stems) {
      if (this.silentStemIdsSet.has(stem.id)) continue;
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

      if (!stemLoops && (wrapPassSchedule || this.loopCount > 0)) continue;

      let when = anchorCtxTime;
      let bufferOffset = 0;
      if (timelineSeconds < stemOffset) {
        when = anchorCtxTime + (stemOffset - timelineSeconds);
        bufferOffset = 0;
      } else {
        bufferOffset = timelineSeconds - stemOffset;
        if (!stemLoops && bufferOffset >= Math.min(bufferDuration, explicitDuration ?? bufferDuration)) {
          continue;
        }
        if (stemLoops && stemRegion && !wrapPassSchedule) {
          const regionSpan = stemRegion.endSeconds - stemRegion.startSeconds;
          if (bufferOffset >= stemRegion.endSeconds && regionSpan > 0) {
            bufferOffset = stemRegion.startSeconds + ((bufferOffset - stemRegion.startSeconds) % regionSpan);
          }
        } else if (stemLoops && !stemRegion && bufferDuration > 0) {
          bufferOffset = bufferOffset % bufferDuration;
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (stemLoops && allowNativeLoop) {
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

      const passGain = createPassGain ? ctx.createGain() : null;
      if (passGain) {
        passGain.gain.value = 1;
        source.connect(passGain);
        passGain.connect(stemGain);
      } else {
        source.connect(stemGain);
      }

      const handle: StemPassSource = {
        stemId: stem.id,
        source,
        passGain,
        onEnded: () => {
          if (pass.sources.get(stem.id) === handle) {
            pass.sources.delete(stem.id);
          }
          try { if (typeof source.disconnect === 'function') source.disconnect(); } catch { /* ignore */ }
          try { if (passGain && typeof passGain.disconnect === 'function') passGain.disconnect(); } catch { /* ignore */ }
        },
      };
      if (typeof source.addEventListener === 'function') {
        source.addEventListener('ended', handle.onEnded!, { once: true });
      }
      pass.sources.set(stem.id, handle);

      if (!stemLoops && explicitDuration !== undefined) {
        const remaining = Math.max(0, explicitDuration - bufferOffset);
        if (remaining > 0) {
          source.start(when, bufferOffset, remaining);
        }
      } else {
        source.start(when, bufferOffset);
      }
    }

    return pass;
  }

  private resolveCrossfadeSplit(loopRegion: MusicLoopRegion): {
    readonly pre: number;
    readonly post: number;
    readonly total: number;
  } {
    const cf = loopRegion.crossfadeSeconds ?? 0;
    if (cf <= 0) return { pre: 0, post: 0, total: 0 };

    const pre = Math.min(loopRegion.startSeconds, cf * 0.5);
    let minBufDur = Infinity;
    for (const stem of this.sheet.stems) {
      if (this.silentStemIdsSet.has(stem.id) || stem.loop === false) continue;
      const buf = this.buffers.get(stem.id);
      if (buf && Number.isFinite(buf.duration) && buf.duration > 0) {
        minBufDur = Math.min(minBufDur, buf.duration);
      }
    }
    if (!Number.isFinite(minBufDur)) {
      minBufDur = this.resolvedDurationSeconds() ?? loopRegion.endSeconds;
    }
    const tailAvail = Math.max(0, minBufDur - loopRegion.endSeconds);
    const post = Math.min(tailAvail, cf - pre);
    return { pre, post, total: pre + post };
  }

  private stepLoopCrossfadeScheduler(ctx: AudioContext): void {
    const loopRegion = this.effectiveLoopRegion();
    if (!this.audioAttached || !this.activePass || !this.isCrossfadeLoopRegion(loopRegion)) {
      return;
    }
    if (this.nextLoopBoundaryCtxTime === null) return;

    const loopSpan = loopRegion.endSeconds - loopRegion.startSeconds;
    if (loopSpan <= 0) return;

    // Promote scheduled pass on boundary crossings (or cleanly recover after large jumps).
    while (this.nextLoopBoundaryCtxTime !== null && ctx.currentTime >= this.nextLoopBoundaryCtxTime - 1e-6) {
      const boundary: number = this.nextLoopBoundaryCtxTime;
      if (this.scheduledNextPass) {
        const { post } = this.resolveCrossfadeSplit(loopRegion);
        if (this.activePass.retireAtCtxTime === null) {
          this.activePass.retireAtCtxTime = boundary + post + LOOP_RETIRE_MARGIN_SECONDS;
        }
        this.retiringPasses.push(this.activePass);
        this.activePass = this.scheduledNextPass;
        this.scheduledNextPass = null;
        this.runtimeCrossfadeStartCtxTime = null;
        this.nextLoopBoundaryCtxTime = boundary + loopSpan;
      } else {
        // Large time step jumped past lookahead window: swap cleanly at live positionSeconds.
        this.disposePass(this.activePass);
        this.activePass = this.spawnAudioPass(
          ctx,
          ctx.currentTime,
          this.positionSeconds,
          loopRegion,
          false,
          this.supportsPassCrossfade(),
          false,
        );
        this.runtimeCrossfadeStartCtxTime = null;
        this.nextLoopBoundaryCtxTime = ctx.currentTime + this.remainingInRegionSeconds(loopRegion, this.positionSeconds);
        break;
      }
    }

    if (
      this.scheduledNextPass === null
      && this.nextLoopBoundaryCtxTime !== null
      && ctx.currentTime < this.nextLoopBoundaryCtxTime
    ) {
      const split = this.resolveCrossfadeSplit(loopRegion);
      const fadeStart = this.nextLoopBoundaryCtxTime - split.pre;
      if (ctx.currentTime >= fadeStart - LOOP_CROSSFADE_LOOKAHEAD_SECONDS) {
        const fadeEnd = this.nextLoopBoundaryCtxTime + split.post;
        const actualStart = Math.max(ctx.currentTime, fadeStart);
        const offsetAdvance = actualStart - fadeStart;
        const startTimelinePos = Math.max(0, loopRegion.startSeconds - split.pre + offsetAdvance);
        const fadeDuration = Math.max(1e-4, fadeEnd - actualStart);

        const nextPass = this.spawnAudioPass(
          ctx,
          actualStart,
          startTimelinePos,
          loopRegion,
          false,
          true,
          true,
        );

        for (const handle of nextPass.sources.values()) {
          if (handle.passGain) {
            handle.passGain.gain.value = 0;
            schedulePassFade(handle.passGain.gain, true, actualStart, fadeDuration, ctx.currentTime);
          }
        }
        for (const handle of this.activePass.sources.values()) {
          if (handle.passGain) {
            schedulePassFade(handle.passGain.gain, false, actualStart, fadeDuration, ctx.currentTime);
          }
        }
        this.activePass.fadeOutTriggered = true;
        this.activePass.retireAtCtxTime = fadeEnd + LOOP_RETIRE_MARGIN_SECONDS;
        this.scheduledNextPass = nextPass;
        this.runtimeCrossfadeStartCtxTime = actualStart;
      }
    }
  }

  private retireExpiredPasses(nowCtxTime: number): void {
    for (let i = this.retiringPasses.length - 1; i >= 0; i--) {
      const pass = this.retiringPasses[i];
      if (pass.retireAtCtxTime === null || nowCtxTime >= pass.retireAtCtxTime) {
        this.disposePass(pass);
        this.retiringPasses.splice(i, 1);
      }
    }
  }

  private syncLiveLoopMode(nextRegion: MusicLoopRegion | null): void {
    if (this.sessionState !== 'playing' || !this.audioAttached || !this.boundCtx || !this.activePass) {
      return;
    }
    const ctx = this.boundCtx;
    this.captureLiveAudioOffset();

    const wantCrossfade = this.isCrossfadeLoopRegion(nextRegion);
    const inActiveFade =
      this.scheduledNextPass !== null
      && this.runtimeCrossfadeStartCtxTime !== null
      && ctx.currentTime >= this.runtimeCrossfadeStartCtxTime - 1e-4;

    if (nextRegion === null) {
      if (inActiveFade) {
        const bus = this.host.getMusicBus();
        if (bus) this.attachAudioSources(ctx, bus);
        return;
      }
      if (this.scheduledNextPass) {
        this.disposePass(this.scheduledNextPass);
        this.scheduledNextPass = null;
      }
      for (const handle of this.activePass.sources.values()) {
        handle.source.loop = false;
        if (handle.passGain) {
          handle.passGain.gain.cancelScheduledValues(ctx.currentTime);
          handle.passGain.gain.setValueAtTime(1, ctx.currentTime);
        }
      }
      this.activePass.fadeOutTriggered = false;
      this.activePass.retireAtCtxTime = null;
      this.nextLoopBoundaryCtxTime = null;
      this.runtimeCrossfadeStartCtxTime = null;
      return;
    }

    if (inActiveFade || !this.supportsPassCrossfade() && wantCrossfade) {
      const bus = this.host.getMusicBus();
      if (bus) this.attachAudioSources(ctx, bus);
      return;
    }

    if (this.scheduledNextPass) {
      this.disposePass(this.scheduledNextPass);
      this.scheduledNextPass = null;
    }
    for (const handle of this.activePass.sources.values()) {
      if (handle.passGain) {
        handle.passGain.gain.cancelScheduledValues(ctx.currentTime);
        handle.passGain.gain.setValueAtTime(1, ctx.currentTime);
      }
      if (wantCrossfade) {
        handle.source.loop = false;
      } else {
        const stem = this.sheet.stems.find((s) => s.id === handle.stemId);
        const bufDur = handle.source.buffer?.duration ?? nextRegion.endSeconds;
        const region = stem?.loopRegion ?? nextRegion;
        handle.source.loop = stem?.loop ?? true;
        handle.source.loopStart = region.startSeconds;
        handle.source.loopEnd = Math.min(region.endSeconds, bufDur);
      }
    }
    this.activePass.fadeOutTriggered = false;
    this.activePass.retireAtCtxTime = null;
    this.runtimeCrossfadeStartCtxTime = null;
    if (wantCrossfade) {
      this.nextLoopBoundaryCtxTime = ctx.currentTime + this.remainingInRegionSeconds(nextRegion, this.positionSeconds);
    } else {
      this.nextLoopBoundaryCtxTime = null;
    }
  }

  private remainingInRegionSeconds(region: MusicLoopRegion, positionSeconds: number): number {
    const span = region.endSeconds - region.startSeconds;
    const effectivePos = positionSeconds >= region.endSeconds && span > 0
      ? region.startSeconds + ((positionSeconds - region.startSeconds) % span)
      : positionSeconds;
    return Math.max(0, region.endSeconds - effectivePos);
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

  private disposePass(pass: AudioLoopPass | null): void {
    if (!pass) return;
    for (const handle of pass.sources.values()) {
      if (handle.onEnded && typeof handle.source.removeEventListener === 'function') {
        handle.source.removeEventListener('ended', handle.onEnded);
      }
      handle.onEnded = null;
      try {
        handle.source.stop();
      } catch { /* already stopped or unstarted */ }
      try {
        if (typeof handle.source.disconnect === 'function') handle.source.disconnect();
      } catch { /* already disconnected */ }
      try {
        if (handle.passGain && typeof handle.passGain.disconnect === 'function') handle.passGain.disconnect();
      } catch { /* already disconnected */ }
    }
    pass.sources.clear();
  }

  private countActiveSources(): number {
    let count = this.activePass?.sources.size ?? 0;
    if (this.scheduledNextPass) count += this.scheduledNextPass.sources.size;
    for (const p of this.retiringPasses) count += p.sources.size;
    return count;
  }

  private detachAudioSources(): void {
    this.audioAttached = false;
    this.disposePass(this.activePass);
    this.activePass = null;
    this.disposePass(this.scheduledNextPass);
    this.scheduledNextPass = null;
    for (const pass of this.retiringPasses) {
      this.disposePass(pass);
    }
    this.retiringPasses.length = 0;
    this.nextLoopBoundaryCtxTime = null;
    this.runtimeCrossfadeStartCtxTime = null;
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

  private enqueueScheduledMix(
    stemGains: Readonly<Record<string, number>> | null,
    groupGains: Readonly<Record<string, number>> | null,
    opts: ScheduledMixOptions,
  ): string {
    if (this.isDisposed) return '';
    const fadeSeconds = Number.isFinite(opts.fadeSeconds) && (opts.fadeSeconds ?? 0) > 0
      ? (opts.fadeSeconds ?? 0)
      : 0;
    const handleId = `mix-${++this.mixSequence}`;

    if (stemGains) {
      this.supersedePendingMixKeys(Object.keys(stemGains), null);
    }
    if (groupGains) {
      this.supersedePendingMixKeys(null, Object.keys(groupGains));
    }

    if (opts.at === 'immediate') {
      const target: PendingMixTransition = {
        handleId,
        at: 'immediate',
        targetSeconds: this.positionSeconds,
        remainingSeconds: 0,
        fadeSeconds,
        stemTargets: stemGains ? { ...stemGains } : null,
        groupTargets: groupGains ? { ...groupGains } : null,
      };
      this.applyMixTransition(target);
      return handleId;
    }

    const resolved = this.resolveScheduledMixTarget(opts);
    this.pendingMixTransitions.push({
      handleId,
      at: opts.at,
      targetSeconds: resolved.targetSeconds,
      remainingSeconds: resolved.remainingSeconds,
      fadeSeconds,
      stemTargets: stemGains ? { ...stemGains } : null,
      groupTargets: groupGains ? { ...groupGains } : null,
      cueId: resolved.cueId,
    });
    return handleId;
  }

  private supersedePendingMixKeys(
    stemIds: readonly string[] | null,
    groupIds: readonly string[] | null,
  ): void {
    for (let i = this.pendingMixTransitions.length - 1; i >= 0; i--) {
      const entry = this.pendingMixTransitions[i];
      if (stemIds && entry.stemTargets) {
        for (const id of stemIds) delete entry.stemTargets[id];
        if (Object.keys(entry.stemTargets).length === 0) entry.stemTargets = null;
      }
      if (groupIds && entry.groupTargets) {
        for (const id of groupIds) delete entry.groupTargets[id];
        if (Object.keys(entry.groupTargets).length === 0) entry.groupTargets = null;
      }
      if (!entry.stemTargets && !entry.groupTargets) {
        this.pendingMixTransitions.splice(i, 1);
      }
    }
  }

  private resolveScheduledMixTarget(opts: ScheduledMixOptions): {
    readonly targetSeconds: number;
    readonly remainingSeconds: number;
    readonly cueId?: string;
  } {
    const pos = this.positionSeconds;
    const loop = this.effectiveLoopRegion();
    const minLead = Math.max(0, opts.minLeadSeconds ?? 0);

    if (opts.at === 'next-beat' || opts.at === 'next-bar') {
      const beatGrid = this.sheet.beatGrid;
      if (!beatGrid) {
        throw new Error(`Cannot quantize "${opts.at}" in cue sheet "${this.sheet.id}": beatGrid is required`);
      }
      const rawTarget = opts.at === 'next-beat'
        ? nextBeatTimeSeconds(beatGrid, pos, minLead)
        : nextBarTimeSeconds(beatGrid, pos, minLead);
      if (loop && rawTarget > loop.endSeconds + 1e-9) {
        const span = loop.endSeconds - loop.startSeconds;
        const wrapped = span > 0
          ? loop.startSeconds + ((rawTarget - loop.endSeconds) % span)
          : loop.startSeconds;
        return { targetSeconds: wrapped, remainingSeconds: Math.max(0, rawTarget - pos) };
      }
      const duration = this.resolvedDurationSeconds();
      const clamped = !loop && duration !== null ? Math.min(duration, rawTarget) : rawTarget;
      return { targetSeconds: clamped, remainingSeconds: Math.max(0, clamped - pos) };
    }

    if (opts.at === 'next-cue') {
      const match = nextMatchingCue(this.sheet, pos, {
        kind: opts.cueKind,
        cueId: opts.cueId,
        tag: opts.cueTag,
        activeLoopRegion: loop,
        minLeadSeconds: minLead,
      });
      if (!match) {
        throw new Error(`No matching upcoming cue found in cue sheet "${this.sheet.id}"`);
      }
      const remainingSeconds = match.wrapsLoop && loop
        ? Math.max(0, (loop.endSeconds - pos) + Math.max(0, match.targetSeconds - loop.startSeconds))
        : Math.max(0, match.targetSeconds - pos);
      return {
        targetSeconds: match.targetSeconds,
        remainingSeconds,
        cueId: match.cue.id,
      };
    }

    if (opts.timeSeconds === undefined || !Number.isFinite(opts.timeSeconds) || opts.timeSeconds < 0) {
      throw new Error('Scheduled mix with at="time" requires a finite timeSeconds >= 0');
    }
    const targetSeconds = this.clampToDuration(opts.timeSeconds);
    return {
      targetSeconds,
      remainingSeconds: Math.max(0, targetSeconds - pos),
    };
  }

  private recomputePendingMixDistances(): void {
    const loop = this.effectiveLoopRegion();
    for (let i = this.pendingMixTransitions.length - 1; i >= 0; i--) {
      const entry = this.pendingMixTransitions[i];
      if (entry.at === 'time') {
        entry.remainingSeconds = Math.max(0, entry.targetSeconds - this.positionSeconds);
        continue;
      }
      if (entry.at === 'next-cue') {
        if (entry.targetSeconds >= this.positionSeconds - 1e-9 && (!loop || entry.targetSeconds <= loop.endSeconds + 1e-9)) {
          entry.remainingSeconds = Math.max(0, entry.targetSeconds - this.positionSeconds);
        } else if (loop && entry.targetSeconds >= loop.startSeconds - 1e-9 && entry.targetSeconds <= loop.endSeconds + 1e-9) {
          entry.remainingSeconds = Math.max(
            0,
            (loop.endSeconds - this.positionSeconds) + (entry.targetSeconds - loop.startSeconds),
          );
        }
        continue;
      }
      if (this.sheet.beatGrid) {
        const refreshed = this.resolveScheduledMixTarget({ at: entry.at });
        entry.remainingSeconds = refreshed.remainingSeconds;
      }
    }
  }

  private consumePendingMixDelta(stepDelta: number, eligible: ReadonlySet<PendingMixTransition>): void {
    if (stepDelta <= 0 || this.pendingMixTransitions.length === 0) return;
    const due: PendingMixTransition[] = [];
    for (let i = this.pendingMixTransitions.length - 1; i >= 0; i--) {
      const entry = this.pendingMixTransitions[i];
      if (!eligible.has(entry)) continue;
      entry.remainingSeconds -= stepDelta;
      if (entry.remainingSeconds <= 1e-9) {
        this.pendingMixTransitions.splice(i, 1);
        due.push(entry);
      }
    }
    due.reverse();
    for (const entry of due) {
      this.applyMixTransition(entry);
    }
  }

  private applyMixTransition(entry: PendingMixTransition): void {
    if (this.isDisposed) return;
    if (entry.stemTargets) {
      for (const [stemId, gain] of Object.entries(entry.stemTargets)) {
        this.setStemGain(stemId, gain, entry.fadeSeconds);
      }
    }
    if (entry.groupTargets) {
      for (const [groupId, gain] of Object.entries(entry.groupTargets)) {
        this.setGroupGain(groupId, gain, entry.fadeSeconds);
      }
    }
    const event: MusicMixAppliedEvent = {
      sessionId: this.sheet.id,
      handleId: entry.handleId,
      at: entry.at,
      scheduledSeconds: entry.targetSeconds,
      positionSeconds: this.positionSeconds,
      ...(entry.stemTargets ? { stemGains: { ...entry.stemTargets } } : {}),
      ...(entry.groupTargets ? { groupGains: { ...entry.groupTargets } } : {}),
      ...(entry.cueId !== undefined ? { cueId: entry.cueId } : {}),
    };
    for (const fn of [...this.mixAppliedListeners]) {
      fn(event);
    }
  }

  private advanceTimeline(stepDelta: number): void {
    let remaining = stepDelta;
    const loopRegion = this.effectiveLoopRegion();
    const duration = this.resolvedDurationSeconds();
    const eligibleMixes = new Set(this.pendingMixTransitions);

    if (loopRegion) {
      const loopSpan = loopRegion.endSeconds - loopRegion.startSeconds;
      let iterations = 0;
      while (remaining > 0 && iterations < MAX_LOOP_CATCHUP_ITERATIONS) {
        iterations++;
        const nextPos = this.positionSeconds + remaining;
        if (nextPos < loopRegion.endSeconds) {
          this.positionSeconds = nextPos;
          this.activeSectionId = this.sectionAtTime(this.positionSeconds);
          this.consumePendingMixDelta(remaining, eligibleMixes);
          this.evaluateCues(this.positionSeconds);
          remaining = 0;
          break;
        }
        const toBoundary = Math.max(0, loopRegion.endSeconds - this.positionSeconds);
        this.positionSeconds = loopRegion.endSeconds;
        this.consumePendingMixDelta(toBoundary, eligibleMixes);
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
      const toEnd = Math.max(0, duration - this.positionSeconds);
      this.positionSeconds = duration;
      this.activeSectionId = this.sectionAtTime(duration);
      this.consumePendingMixDelta(toEnd, eligibleMixes);
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
    this.consumePendingMixDelta(remaining, eligibleMixes);
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
    if (this.explicitLoopCleared) return null;
    if (this.explicitLoopRegion) return this.explicitLoopRegion;
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
    if (this.explicitLoopRegion) return this.explicitLoopRegion.endSeconds;
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
