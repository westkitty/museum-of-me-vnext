import { Panel } from '../ui/Panel';
import type { App } from '../app/App';
import { SOURCE_VISITORS, visitorRouteForVNext } from '../content/sourceParity';
import { WINGS, SANCTUARY_CENTER, ROTUNDA_APOTHEM, type Vec3, place, faceDirection } from '../world/layout';
import { mapLevelForY } from '../ui/MapPanel';
import { previewPosition, routePreview, timelineTime, TIMELINE_SECONDS } from './simulation';
import './choreo.css';

const SVG = 'http://www.w3.org/2000/svg';
const EXTENT = 150;
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function toSvg(p: Vec3): [number, number] { return [p[0] + EXTENT, p[2] + EXTENT]; }

/** Dev-only nominal preview. Never writes authored routes or runtime visitor state. */
export class VisitorChoreographer extends Panel {
  private level: 0 | 1 = 0;
  private time = 0;
  private playing = false;
  private releaseFreeze: (() => void) | null = null;
  private releaseCapture: (() => void) | null = null;
  private readonly unregister: () => void;
  private readonly launcher = document.createElement('button');
  private readonly timeInput: HTMLInputElement;
  private readonly playButton: HTMLButtonElement;
  private readonly readout: HTMLElement;
  private readonly showAll: HTMLInputElement;
  private readonly showRoutes: HTMLInputElement;
  private readonly architecture: SVGGElement[] = [];
  private readonly visitors = SOURCE_VISITORS.map(visitor => ({
    visitor, preview: routePreview(visitorRouteForVNext(visitor.id), visitor.speed, visitor.pause),
    marker: svg('circle', { r: visitor.staff ? 2.5 : 2, 'data-visitor-id': visitor.id,
      class: `choreo-map__visitor${visitor.staff ? ' choreo-map__visitor--staff' : ''}` }),
    path: svg('polygon', { class: 'choreo-map__route', 'data-route-id': visitor.id }),
  }));

  constructor(private readonly app: App) {
    super('choreo', 'Visitor Choreographer', 'Development: simulated positions, not runtime telemetry');
    this.content.innerHTML = `<p>Nominal closed-route simulation from the 17 authored identities and vNext source routes. Mean authored pauses; no collisions, conversation timing, seated behavior, or congestion calculation. Floor projection is schematic, not architectural or walkability authority.</p>
      <div class="choreo-map-container"></div>
      <div class="choreo-controls">
        <label for="choreo-time">Simulation time: <span data-time>0.0s</span></label>
        <input id="choreo-time" type="range" min="0" max="${TIMELINE_SECONDS}" step="0.1" value="0">
        <div class="choreo-playback"><button type="button" data-play>Play</button><button type="button" data-restart>Restart</button></div>
        <div class="choreo-options"><label>Floor <select aria-label="Floor"><option value="0">Level 0</option><option value="1">Level 1</option></select></label>
        <label><input type="checkbox" data-all> Show all levels</label><label><input type="checkbox" data-routes checked> Show routes</label></div>
        <section class="choreo-report"><h3>Nominal source-route evidence</h3><ul></ul></section>
      </div>`;
    this.timeInput = this.content.querySelector('input[type=range]')!;
    this.playButton = this.content.querySelector('[data-play]')!;
    this.readout = this.content.querySelector('[data-time]')!;
    this.showAll = this.content.querySelector('[data-all]')!;
    this.showRoutes = this.content.querySelector('[data-routes]')!;
    this.buildMap();
    this.timeInput.addEventListener('input', () => {
      this.time = timelineTime(this.timeInput.valueAsNumber);
      this.playing = false;
      this.render();
    });
    this.playButton.addEventListener('click', () => { this.playing = !this.playing; this.render(); });
    this.content.querySelector('[data-restart]')!.addEventListener('click', () => { this.time = 0; this.playing = false; this.render(); });
    this.content.querySelector('select')!.addEventListener('change', event => {
      this.level = (event.target as HTMLSelectElement).value === '1' ? 1 : 0;
      this.render();
    });
    this.showAll.addEventListener('change', () => this.render());
    this.showRoutes.addEventListener('change', () => this.render());
    this.launcher.type = 'button';
    this.launcher.className = 'choreo-launcher';
    this.launcher.textContent = 'Visitor Choreographer';
    this.launcher.setAttribute('aria-controls', this.root.id);
    this.launcher.setAttribute('aria-haspopup', 'dialog');
    this.launcher.addEventListener('click', () => this.toggle());
    document.getElementById('ui-root')!.append(this.launcher, this.root);
    this.unregister = app.ui.registerModal(this);
    this.render();
  }

  private buildMap(): void {
    const map = svg('svg', { viewBox: `0 0 ${EXTENT * 2} ${EXTENT * 2}`, class: 'choreo-map-svg', role: 'img', 'aria-label': 'Schematic floor projection of simulated authored visitors' });
    for (const level of [0, 1] as const) {
      const layer = svg('g');
      layer.append(svg('circle', { cx: EXTENT, cy: EXTENT, r: ROTUNDA_APOTHEM, class: 'choreo-map__structural' }));
      for (const wing of WINGS.filter(w => w.level === level)) {
        const dir = faceDirection(wing.face);
        const [x1, y1] = toSvg(place(dir, wing.hallFrom, 0, 0));
        const [x2, y2] = toSvg(place(dir, wing.hallTo, 0, 0));
        layer.append(svg('line', { x1, y1, x2, y2, class: 'choreo-map__structural' }));
      }
      if (level === 0) {
        const [cx, cy] = toSvg(SANCTUARY_CENTER);
        layer.append(svg('circle', { cx, cy, r: 8, class: 'choreo-map__sanctuary' }));
      }
      this.architecture.push(layer);
      map.append(layer);
    }
    const list = this.content.querySelector('ul')!;
    for (const { visitor, preview, marker, path } of this.visitors) {
      path.setAttribute('points', preview.route.map(p => toSvg(p).join(',')).join(' '));
      const title = svg('title'); title.textContent = `${visitor.title} (${visitor.id}) — simulated`;
      marker.append(title);
      map.append(path, marker);
      const item = document.createElement('li');
      item.dataset.evidenceId = visitor.id;
      item.textContent = `${visitor.title} (${visitor.id}): nominal loop ${preview.duration.toFixed(1)}s; horizontal distance ${preview.distance.toFixed(1)}m`;
      list.append(item);
    }
    this.content.querySelector('.choreo-map-container')!.append(map);
  }

  override open(): void {
    if (this.isOpen) return;
    // Do not stack over an arrival, Workshop, or another active modal.
    if (this.app.input.uiCaptured || this.app.player.isFrozen || this.app.ui.anyPanelOpen) {
      this.app.ui.hud.announce('Close the active surface before opening Visitor Choreographer.');
      return;
    }
    this.app.input.releasePointerLock();
    this.releaseFreeze = this.app.player.acquireFreeze();
    this.releaseCapture = this.app.input.acquireUiCapture();
    super.open();
  }

  override close(): void {
    if (!this.isOpen) return;
    this.playing = false;
    super.close();
    this.releaseFreeze?.(); this.releaseFreeze = null;
    this.releaseCapture?.(); this.releaseCapture = null;
    this.render();
  }

  /** Called once by the application variable phase; no independent scheduler. */
  update(dt: number): void {
    if (!this.isOpen || !this.playing || !Number.isFinite(dt) || dt <= 0) return;
    this.time = (this.time + dt) % TIMELINE_SECONDS;
    this.render();
  }

  protected override render(): void {
    this.time = timelineTime(this.time);
    this.timeInput.value = String(this.time);
    this.readout.textContent = `${this.time.toFixed(1)}s`;
    this.playButton.textContent = this.playing ? 'Pause' : 'Play';
    this.architecture.forEach((layer, index) => layer.setAttribute('display', this.showAll.checked || index === this.level ? 'inline' : 'none'));
    for (const { preview, marker, path } of this.visitors) {
      const pos = previewPosition(preview, this.time);
      const visible = pos !== null && (this.showAll.checked || mapLevelForY(pos[1]) === this.level);
      marker.setAttribute('display', visible ? 'inline' : 'none');
      // A route belongs on its authored floor; a marker's projected floor can change en route.
      const routeVisible = this.showRoutes.checked && (this.showAll.checked || preview.route.some(p => mapLevelForY(p[1]) === this.level));
      path.setAttribute('display', routeVisible ? 'inline' : 'none');
      if (pos) { const [x, y] = toSvg(pos); marker.setAttribute('cx', String(x)); marker.setAttribute('cy', String(y)); }
    }
  }

  override dispose(): void {
    super.dispose();
    this.unregister();
    this.launcher.remove();
  }
}
