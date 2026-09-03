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

  private readonly fpsHistory: number[] = [];
  private readonly frameTimeHistory: number[] = [];

  sample(renderer: THREE.WebGLRenderer, fps: number, frameTimeMs = 0): void {
    const info = renderer.info;
    this.stats.fps = fps;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.programs = info.programs?.length ?? 0;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
    this.stats.frameTimeMs = frameTimeMs;

    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 240) this.fpsHistory.shift();
    this.frameTimeHistory.push(frameTimeMs);
    if (this.frameTimeHistory.length > 240) this.frameTimeHistory.shift();
  }

  /** 1st-percentile FPS over the recent window — the number that reflects hitching. */
  get fpsLow1(): number {
    if (this.fpsHistory.length === 0) return 0;
    const sorted = [...this.fpsHistory].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.01)] ?? sorted[0];
  }

  get fpsAverage(): number {
    if (this.fpsHistory.length === 0) return 0;
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
  }

  frameTimePercentile(percentile: number): number {
    if (this.frameTimeHistory.length === 0) return 0;
    const sorted = [...this.frameTimeHistory].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentile) - 1));
    return sorted[index] ?? 0;
  }

  get frameTimeP50(): number { return this.frameTimePercentile(0.5); }
  get frameTimeP95(): number { return this.frameTimePercentile(0.95); }
  get frameTimeP99(): number { return this.frameTimePercentile(0.99); }

  reset(): void {
    this.fpsHistory.length = 0;
    this.frameTimeHistory.length = 0;
  }
}
