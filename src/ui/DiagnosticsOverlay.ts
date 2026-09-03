import { el } from './dom';
import type { Diagnostics } from '../app/Diagnostics';

/** Backtick-toggled runtime telemetry. Never shown by default. */
export class DiagnosticsOverlay {
  readonly root: HTMLElement;
  private accumulator = 0;

  constructor(private readonly diagnostics: Diagnostics) {
    this.root = el('pre', { class: 'diag', hidden: true, 'aria-hidden': 'true' });
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  toggle(): void {
    this.setVisible(this.root.hidden);
  }

  update(dt: number, extra: Record<string, string | number>): void {
    if (this.root.hidden) return;
    this.accumulator += dt;
    if (this.accumulator < 0.25) return;
    this.accumulator = 0;
    const s = this.diagnostics.stats;
    const lines = [
      `fps      ${s.fps.toFixed(0).padStart(4)}   low1 ${this.diagnostics.fpsLow1.toFixed(0)}`,
      `frame ms p50/p95/p99 ${this.diagnostics.frameTimeP50.toFixed(1)} / ${this.diagnostics.frameTimeP95.toFixed(1)} / ${this.diagnostics.frameTimeP99.toFixed(1)}`,
      `draws    ${String(s.drawCalls).padStart(4)}   tris ${s.triangles.toLocaleString()}`,
      `geo/tex  ${String(s.geometries).padStart(4)} / ${s.textures}`,
      `exhibits ${s.activeExhibits} active, ${s.streamingResident} resident`,
      `pos      ${s.playerPosition.map((n) => n.toFixed(1)).join(', ')}`,
      `zone     ${s.wing}`,
      ...Object.entries(extra).map(([k, v]) => `${k.padEnd(8)} ${v}`),
    ];
    this.root.textContent = lines.join('\n');
  }

  dispose(): void {
    this.root.remove();
  }
}
