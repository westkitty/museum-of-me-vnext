import { el } from './dom';
import type { Diagnostics } from '../app/Diagnostics';

/** Backtick-toggled runtime telemetry. Never shown by default. */
export class DiagnosticsOverlay {
  readonly root: HTMLElement;
  private accumulator = 0;

  constructor(private readonly diagnostics: Diagnostics) {
    this.root = el('pre', { class: 'diag', hidden: true, 'aria-hidden': 'true' });
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
  }

  update(dt: number, extra: Record<string, string | number>): void {
    if (this.root.hidden) return;
    this.accumulator += dt;
    if (this.accumulator < 0.25) return;
    this.accumulator = 0;
    const s = this.diagnostics.stats;
    const lines = [
      `fps      ${s.fps.toFixed(0).padStart(4)}   low1 ${this.diagnostics.fpsLow1.toFixed(0)}`,
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
