import type * as THREE from 'three';

export interface FrameStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
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
    activeExhibits: 0,
    streamingResident: 0,
    playerPosition: [0, 0, 0],
    wing: '—',
  };

  private readonly fpsHistory: number[] = [];

  sample(renderer: THREE.WebGLRenderer, fps: number): void {
    const info = renderer.info;
    this.stats.fps = fps;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.programs = info.programs?.length ?? 0;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;

    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 240) this.fpsHistory.shift();
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

  reset(): void {
    this.fpsHistory.length = 0;
  }
}
