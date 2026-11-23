import { getAsset, type AssetRecord } from '../assets/manifest';
import type { ResourceScope } from '../assets/ResourceScope';
import { isLocalAudioUrl } from './cueSheet';

export type AudioBufferProvider = (
  ctx: AudioContext,
  signal: AbortSignal,
) => AudioBuffer | Promise<AudioBuffer>;

export interface AudioLoadTiming {
  readonly id: string;
  readonly source: 'memory' | 'fetch';
  readonly elapsedMs: number;
  readonly reportedBytes: number;
}

export class AudioAssetCancelledError extends Error {
  constructor(id: string) {
    super(`Audio asset load cancelled: ${id}`);
    this.name = 'AbortError';
  }
}

export class AudioAssetLoadError extends Error {
  readonly assetId: string;

  constructor(assetId: string, message: string, options?: ErrorOptions) {
    super(`Failed to load audio asset "${assetId}": ${message}`, options);
    this.name = 'AudioAssetLoadError';
    this.assetId = assetId;
  }
}

export interface AudioAssetLoaderOptions {
  readonly getContext: () => AudioContext | null;
  readonly fetchFn?: typeof fetch;
  readonly resolveAsset?: (assetId: string) => AssetRecord | undefined;
}

interface CachedAudioEntry {
  readonly id: string;
  readonly abortController: AbortController;
  readonly promise: Promise<{ buffer: AudioBuffer; bytes: number }>;
  buffer: AudioBuffer | null;
  bytes: number;
  users: number;
  settled: boolean;
}

/**
 * Governance-compatible local audio asset loader and lease cache.
 *
 * Respects `src/assets/manifest.ts` provenance records, enforces local/offline
 * URL rules (never issues remote requests), supports `AbortSignal` + `ResourceScope`
 * cancellation, deduplicates concurrent loads, and releases decoded `AudioBuffer`
 * references as soon as all consumer scopes dispose.
 */
export class AudioAssetLoader {
  private readonly getContext: () => AudioContext | null;
  private readonly fetchFn: typeof fetch;
  private readonly resolveAsset: (assetId: string) => AssetRecord | undefined;

  private readonly memoryProviders = new Map<string, AudioBuffer | AudioBufferProvider>();
  private readonly entries = new Map<string, CachedAudioEntry>();
  private readonly pendingCancels = new Set<() => void>();
  private readonly history: AudioLoadTiming[] = [];
  private disposed = false;

  readonly budgetViolations: { id: string; budgetKB: number; actualKB: number }[] = [];

  constructor(options: AudioAssetLoaderOptions) {
    this.getContext = options.getContext;
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.resolveAsset = options.resolveAsset ?? getAsset;
  }

  get loadTimings(): readonly AudioLoadTiming[] {
    return this.history;
  }

  get cachedBufferCount(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (entry.buffer) count++;
    }
    return count;
  }

  get activeLeaseCount(): number {
    let total = 0;
    for (const entry of this.entries.values()) {
      total += entry.users;
    }
    return total;
  }

  get inFlightCount(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.settled) count++;
    }
    return count;
  }

  hasMemoryBuffer(assetId: string): boolean {
    return this.memoryProviders.has(assetId);
  }

  /**
   * Register an in-memory buffer or generator for a manifest-registered `'audio'`
   * asset (used primarily by deterministic tests and fixtures).
   */
  registerMemoryBuffer(
    assetId: string,
    provider: AudioBuffer | AudioBufferProvider,
  ): () => void {
    const record = this.resolveAsset(assetId);
    if (!record) {
      throw new Error(`Audio buffer registered for unknown asset "${assetId}" — add a manifest record first`);
    }
    if (record.kind !== 'audio') {
      throw new Error(`Audio buffer registered for asset "${assetId}" with kind "${record.kind}", expected "audio"`);
    }
    if (this.memoryProviders.has(assetId)) {
      throw new Error(`Audio buffer provider for "${assetId}" registered twice`);
    }
    this.memoryProviders.set(assetId, provider);
    return () => {
      if (this.memoryProviders.get(assetId) === provider) {
        this.memoryProviders.delete(assetId);
      }
      const existing = this.entries.get(assetId);
      if (existing && existing.users === 0) {
        this.entries.delete(assetId);
      }
    };
  }

  getCachedBuffer(assetId: string): AudioBuffer | null {
    return this.entries.get(assetId)?.buffer ?? null;
  }

  async load(
    assetId: string,
    scope: ResourceScope,
    signal?: AbortSignal,
  ): Promise<AudioBuffer> {
    if (this.disposed || scope.isDisposed || signal?.aborted) {
      throw new AudioAssetCancelledError(assetId);
    }
    const record = this.resolveAsset(assetId);
    if (!record) {
      throw new AudioAssetLoadError(assetId, 'missing manifest record');
    }
    if (record.kind !== 'audio') {
      throw new AudioAssetLoadError(assetId, `asset kind is "${record.kind}", expected "audio"`);
    }

    const ctx = this.getContext();
    if (!ctx) {
      throw new AudioAssetLoadError(assetId, 'AudioContext unavailable');
    }

    const started = performance.now();
    const existing = this.entries.get(assetId);
    const entry = existing ?? this.startLoad(record, ctx);
    entry.users++;

    return new Promise<AudioBuffer>((resolve, reject) => {
      let released = false;
      let consumerSettled = false;

      const stopWaiting = (): void => {
        signal?.removeEventListener('abort', cancel);
        this.pendingCancels.delete(cancel);
      };

      const lease = {
        dispose: (): void => {
          if (released) return;
          released = true;
          stopWaiting();
          entry.users = Math.max(0, entry.users - 1);
          this.releaseEntry(assetId, entry);
          if (!consumerSettled) {
            consumerSettled = true;
            reject(new AudioAssetCancelledError(assetId));
          }
        },
      };

      const cancel = (): void => {
        lease.dispose();
        scope.untrack(lease);
      };

      scope.track(lease);
      this.pendingCancels.add(cancel);
      signal?.addEventListener('abort', cancel, { once: true });

      void entry.promise.then(
        ({ buffer, bytes }) => {
          if (released || consumerSettled) return;
          consumerSettled = true;
          stopWaiting();
          const source = this.memoryProviders.has(assetId) ? 'memory' : 'fetch';
          this.recordTiming(assetId, source, performance.now() - started, bytes);
          this.checkBudget(record, bytes);
          resolve(buffer);
        },
        (error: unknown) => {
          if (released || consumerSettled) return;
          consumerSettled = true;
          stopWaiting();
          // Release failed lease cleanly while keeping the real load error.
          entry.users = Math.max(0, entry.users - 1);
          this.releaseEntry(assetId, entry);
          scope.untrack(lease);
          released = true;
          reject(error);
        },
      );
    });
  }

  private startLoad(record: AssetRecord, ctx: AudioContext): CachedAudioEntry {
    const abortController = new AbortController();
    const memory = this.memoryProviders.get(record.id);

    const loadWork = async (): Promise<{ buffer: AudioBuffer; bytes: number }> => {
      if (abortController.signal.aborted) {
        throw new AudioAssetCancelledError(record.id);
      }

      if (memory !== undefined) {
        const buffer = typeof memory === 'function'
          ? await memory(ctx, abortController.signal)
          : memory;
        if (abortController.signal.aborted) {
          throw new AudioAssetCancelledError(record.id);
        }
        return { buffer, bytes: 0 };
      }

      if (!record.url) {
        throw new AudioAssetLoadError(record.id, 'declares no local audio url');
      }
      if (!isLocalAudioUrl(record.url)) {
        throw new AudioAssetLoadError(record.id, 'refused non-local audio url');
      }

      let response: Response;
      try {
        response = await this.fetchFn(record.url, { signal: abortController.signal });
      } catch (error) {
        if (abortController.signal.aborted || isAbortLike(error)) {
          throw new AudioAssetCancelledError(record.id);
        }
        throw new AudioAssetLoadError(
          record.id,
          error instanceof Error ? error.message : String(error),
          { cause: error },
        );
      }

      if (!response.ok) {
        throw new AudioAssetLoadError(record.id, `HTTP ${response.status}`);
      }

      let raw: ArrayBuffer;
      try {
        raw = await response.arrayBuffer();
      } catch (error) {
        if (abortController.signal.aborted || isAbortLike(error)) {
          throw new AudioAssetCancelledError(record.id);
        }
        throw new AudioAssetLoadError(
          record.id,
          error instanceof Error ? error.message : String(error),
          { cause: error },
        );
      }

      if (abortController.signal.aborted) {
        throw new AudioAssetCancelledError(record.id);
      }

      const bytes = raw.byteLength;
      if (bytes === 0) {
        throw new AudioAssetLoadError(record.id, 'empty audio payload');
      }

      try {
        // Slice so decodeAudioData detaching the buffer cannot affect callers.
        const decoded = await ctx.decodeAudioData(raw.slice(0));
        if (abortController.signal.aborted) {
          throw new AudioAssetCancelledError(record.id);
        }
        return { buffer: decoded, bytes };
      } catch (error) {
        if (error instanceof AudioAssetCancelledError || abortController.signal.aborted || isAbortLike(error)) {
          throw new AudioAssetCancelledError(record.id);
        }
        throw new AudioAssetLoadError(
          record.id,
          error instanceof Error ? error.message : 'audio decode failed',
          { cause: error },
        );
      }
    };

    const entry: CachedAudioEntry = {
      id: record.id,
      abortController,
      buffer: null,
      bytes: 0,
      users: 0,
      settled: false,
      promise: loadWork().then(
        (res) => {
          entry.buffer = res.buffer;
          entry.bytes = res.bytes;
          entry.settled = true;
          this.releaseEntry(record.id, entry);
          return res;
        },
        (error) => {
          entry.settled = true;
          if (this.entries.get(record.id) === entry) {
            this.entries.delete(record.id);
          }
          throw error;
        },
      ),
    };

    // Prevent unhandled rejection if every consumer cancels while in flight.
    entry.promise.catch(() => {});

    this.entries.set(record.id, entry);
    return entry;
  }

  private releaseEntry(id: string, entry: CachedAudioEntry): void {
    if (entry.users > 0) return;
    if (!entry.settled) {
      entry.abortController.abort();
      if (this.entries.get(id) === entry) {
        this.entries.delete(id);
      }
      return;
    }
    entry.buffer = null;
    if (this.entries.get(id) === entry) {
      this.entries.delete(id);
    }
  }

  private recordTiming(
    id: string,
    source: 'memory' | 'fetch',
    elapsedMs: number,
    reportedBytes: number,
  ): void {
    this.history.push({ id, source, elapsedMs, reportedBytes });
    if (this.history.length > 64) this.history.shift();
  }

  private checkBudget(record: AssetRecord, bytes: number): void {
    if (record.budgetKB <= 0 || bytes <= 0) return;
    const actualKB = Math.round(bytes / 1024);
    if (actualKB > record.budgetKB) {
      this.budgetViolations.push({ id: record.id, budgetKB: record.budgetKB, actualKB });
      console.warn(`[AudioAssets] "${record.id}" is ${actualKB} KB, over its ${record.budgetKB} KB budget`);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cancel of [...this.pendingCancels]) {
      cancel();
    }
    this.pendingCancels.clear();
    for (const entry of this.entries.values()) {
      entry.abortController.abort();
      entry.buffer = null;
    }
    this.entries.clear();
    this.memoryProviders.clear();
    this.history.length = 0;
  }
}

export interface AudioSilenceAnalysis {
  readonly isSilent: boolean;
  readonly peakAmplitude: number;
  readonly durationSeconds: number;
}

/**
 * Inspect a decoded `AudioBuffer` to detect pure digital silence across all channels.
 * Safely treats lightweight mock buffers without `getChannelData` as non-silent so
 * synthetic harnesses continue working predictably.
 */
export function analyzeAudioBufferSilence(
  buffer: AudioBuffer,
  threshold = 1e-6,
): AudioSilenceAnalysis {
  const durationSeconds = Number.isFinite(buffer.duration) ? buffer.duration : 0;
  const channels = Number.isFinite(buffer.numberOfChannels) ? buffer.numberOfChannels : 0;
  if (channels <= 0 || typeof buffer.getChannelData !== 'function') {
    return { isSilent: false, peakAmplitude: 1, durationSeconds };
  }

  let peakAmplitude = 0;
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    if (!data || data.length === 0) continue;
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peakAmplitude) {
        peakAmplitude = abs;
        if (peakAmplitude > threshold) {
          return { isSilent: false, peakAmplitude, durationSeconds };
        }
      }
    }
  }
  return { isSilent: peakAmplitude <= threshold, peakAmplitude, durationSeconds };
}

function isAbortLike(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && ((error as { name?: string }).name === 'AbortError'
      || /abort|cancel/i.test(String((error as { message?: string }).message ?? ''))),
  );
}
