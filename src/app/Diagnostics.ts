import type * as THREE from 'three';

export interface FrameStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
  frameTimeMs: number;
  activeExhibits: number;
  streamingResident: number;
  playerPosition: [number, number, number];
  wing: string;
}

/**
 * Read-only runtime telemetry. Rendered by the diagnostics overlay (backtick key)
 * and sampled by the performance tests. It never mutates engine state.
 */
export class Diagnostics {
  readonly stats: FrameStats = {
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
    frameTimeMs: 0,
    activeExhibits: 0,
    streamingResident: 0,
    playerPosition: [0, 0, 0],
    wing: '—',
  };

  private static readonly HISTORY_SIZE = 240;
  private readonly fpsHistory = new Float64Array(Diagnostics.HISTORY_SIZE);
  private readonly frameTimeHistory = new Float64Array(Diagnostics.HISTORY_SIZE);
  private historyCount = 0;
  private historyCursor = 0;
  private sortedFps: number[] | null = null;
  private sortedFrameTimes: number[] | null = null;

  sample(renderer: THREE.WebGLRenderer, fps: number, frameTimeMs = 0): void {
    const info = renderer.info;
    this.stats.fps = fps;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.programs = info.programs?.length ?? 0;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
    this.stats.frameTimeMs = frameTimeMs;

    this.fpsHistory[this.historyCursor] = fps;
    this.frameTimeHistory[this.historyCursor] = frameTimeMs;
    this.historyCursor = (this.historyCursor + 1) % Diagnostics.HISTORY_SIZE;
    this.historyCount = Math.min(Diagnostics.HISTORY_SIZE, this.historyCount + 1);
    this.sortedFps = null;
    this.sortedFrameTimes = null;
  }

  /** 1st-percentile FPS over the recent window — the number that reflects hitching. */
  get fpsLow1(): number {
    if (this.historyCount === 0) return 0;
    const sorted = this.sortedFps ??= this.sortedHistory(this.fpsHistory);
    return sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0];
  }

  get fpsAverage(): number {
    if (this.historyCount === 0) return 0;
    let total = 0;
    for (let i = 0; i < this.historyCount; i++) total += this.fpsHistory[i];
    return total / this.historyCount;
  }

  frameTimePercentile(percentile: number): number {
    if (this.historyCount === 0) return 0;
    const sorted = this.sortedFrameTimes ??= this.sortedHistory(this.frameTimeHistory);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
    return sorted[index] ?? 0;
  }

  private sortedHistory(history: Float64Array): number[] {
    return Array.from(history.subarray(0, this.historyCount)).sort((a, b) => a - b);
  }

  get frameTimeP50(): number { return this.frameTimePercentile(0.5); }
  get frameTimeP95(): number { return this.frameTimePercentile(0.95); }
  get frameTimeP99(): number { return this.frameTimePercentile(0.99); }

  reset(): void {
    this.historyCount = 0;
    this.historyCursor = 0;
    this.sortedFps = null;
    this.sortedFrameTimes = null;
  }
}
