import { Panel } from '../ui/Panel';
import { App } from '../app/App';
import { SOURCE_VISITORS, visitorRouteForVNext } from '../content/sourceParity';
import { WINGS, SANCTUARY_CENTER, ROTUNDA_APOTHEM, LEVEL_1_Y, type Vec3, place, faceDirection } from '../world/layout';
import './choreo.css';

const SVG = 'http://www.w3.org/2000/svg';
const EXTENT = 150;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function toSvg(p: Vec3 | readonly number[]): [number, number] {
  return [p[0] + EXTENT, p[2] + EXTENT];
}

function mapLevelForY(y: number): 0 | 1 {
  return y > LEVEL_1_Y - 2 ? 1 : 0;
}

const CHOREO_HTML = `
  <div class="choreo-panel__content">
    <div class="choreo-map-container" data-el="map-container"></div>
    <div class="choreo-controls">
      <div class="choreo-scrubber">
        <label>Time: <span data-el="time-readout">0.0s</span></label>
        <input type="range" data-el="time" min="0" max="600" step="0.1" value="0">
      </div>
      <div class="choreo-playback">
        <button data-el="play-pause">Play</button>
        <button data-el="restart">Restart</button>
      </div>
      <div class="choreo-options">
        <label><input type="checkbox" data-el="level" checked> Level 0</label>
        <label><input type="checkbox" data-el="show-all"> Show all levels</label>
        <label><input type="checkbox" data-el="show-routes" checked> Show routes</label>
      </div>
      <div class="choreo-report" data-el="report"></div>
    </div>
  </div>
`;

export class VisitorChoreographer extends Panel {
  private level: 0 | 1 = 0;
  private time = 0;
  private isPlaying = false;

  private mapContainer: HTMLElement;
  private timeInput: HTMLInputElement;
  private timeReadout: HTMLElement;
  private playPauseBtn: HTMLButtonElement;
  private restartBtn: HTMLButtonElement;
  private levelToggle: HTMLInputElement;
  private showAllToggle: HTMLInputElement;
  private showRoutesToggle: HTMLInputElement;
  private reportEl: HTMLElement;

  private openState = false;

  constructor(private readonly app: App) {
    super('choreo', 'Visitor Choreographer', 'Development staging view');
    this.body.innerHTML = CHOREO_HTML;

    this.mapContainer = this.el('map-container');
    this.timeInput = this.el<HTMLInputElement>('time');
    this.timeReadout = this.el('time-readout');
    this.playPauseBtn = this.el<HTMLButtonElement>('play-pause');
    this.restartBtn = this.el<HTMLButtonElement>('restart');
    this.levelToggle = this.el<HTMLInputElement>('level');
    this.showAllToggle = this.el<HTMLInputElement>('show-all');
    this.showRoutesToggle = this.el<HTMLInputElement>('show-routes');
    this.reportEl = this.el('report');

    this.bindEvents();
    this.render();
  }

  private el<T extends HTMLElement>(name: string): T {
    const el = this.body.querySelector(`[data-el="${name}"]`);
    if (!el) throw new Error(`Missing ${name}`);
    return el as T;
  }

  private bindEvents() {
    this.timeInput.addEventListener('input', () => {
      this.time = parseFloat(this.timeInput.value);
      this.isPlaying = false;
      this.updatePlaybackState();
      this.render();
    });

    this.playPauseBtn.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      this.updatePlaybackState();
    });

    this.restartBtn.addEventListener('click', () => {
      this.time = 0;
      this.timeInput.value = '0';
      this.render();
    });

    this.levelToggle.addEventListener('change', () => {
      this.level = this.levelToggle.checked ? 0 : 1;
      this.render();
    });

    this.showAllToggle.addEventListener('change', () => this.render());
    this.showRoutesToggle.addEventListener('change', () => this.render());
  }

  private updatePlaybackState() {
    this.playPauseBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
  }

  override open() {
    if (this.openState) return;
    this.openState = true;
    super.open();
    this.app.input.releasePointerLock();
    this.app.player.setFrozen(true);
    this.app.ui.hud.setWorkshopCue('Choreographer active');
    this.render();
  }

  override close() {
    if (!this.openState) return;
    this.openState = false;
    super.close();
    this.app.player.setFrozen(false);
    this.app.ui.hud.setWorkshopCue(null);
  }

  override toggle() {
    if (this.openState) this.close();
    else this.open();
  }

  /** Called by App's existing variable phase via Workshop update loop hook if we intercept it */
  update(dt: number) {
    if (!this.openState) return;
    if (this.isPlaying) {
      this.time += dt;
      if (this.time > parseFloat(this.timeInput.max)) {
        this.time = 0;
      }
      this.timeInput.value = this.time.toFixed(1);
      this.render();
    }
  }

  protected override render() {
    this.timeReadout.textContent = this.time.toFixed(1) + 's';

    this.mapContainer.innerHTML = '';
    const mapSvg = svg('svg', {
      viewBox: `0 0 ${EXTENT * 2} ${EXTENT * 2}`,
      xmlns: SVG,
      class: 'choreo-map-svg'
    });

    const levelClass = this.level === 0 ? 'choreo-map__architecture--level-0' : 'choreo-map__architecture--level-1';

    const architecture = svg('g', { class: `choreo-map__architecture ${levelClass}` });
    mapSvg.append(architecture);

    // Draw rotunda
    const rotunda = svg('circle', {
      cx: EXTENT, cy: EXTENT, r: ROTUNDA_APOTHEM,
      class: 'choreo-map__structural'
    });
    architecture.append(rotunda);

    // Draw wings
    for (const wing of WINGS) {
      if (this.level === 1 && wing.level !== 1) continue;
      if (this.level === 0 && wing.level !== 0) continue;
      const dir = faceDirection(wing.face);
      const start = place(dir, wing.hallFrom, 0, 0);
      const end = place(dir, wing.hallTo, 0, 0);
      const [sx, sy] = toSvg(start);
      const [ex, ey] = toSvg(end);

      const line = svg('line', {
        x1: sx, y1: sy, x2: ex, y2: ey,
        class: 'choreo-map__structural choreo-map__wing'
      });
      architecture.append(line);
    }

    // Draw Sanctuary
    if (this.level === 0) {
      const [sx, sy] = toSvg(SANCTUARY_CENTER);
      const sanctuary = svg('circle', {
        cx: sx, cy: sy, r: 8,
        class: 'choreo-map__sanctuary'
      });
      architecture.append(sanctuary);
    }

    this.renderVisitors(mapSvg);

    this.mapContainer.append(mapSvg);
  }

  private renderVisitors(mapSvg: SVGElement) {
    const showAll = this.showAllToggle.checked;
    const showRoutes = this.showRoutesToggle.checked;

    for (const v of SOURCE_VISITORS) {
      const route = visitorRouteForVNext(v.id);
      if (!route || route.length === 0) continue;

      let totalDist = 0;
      const segments: number[] = [];
      for (let i = 0; i < route.length; i++) {
        const p1 = route[i];
        const p2 = route[(i + 1) % route.length];
        const dx = p2[0] - p1[0];
        const dz = p2[2] - p1[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        segments.push(dist);
        totalDist += dist;
      }

      // Simulation time
      const speed = v.speed;
      const pause = (v.pause[0] + v.pause[1]) / 2;
      const loopTime = (totalDist / speed) + (route.length * pause);

      const localTime = this.time % loopTime;

      let currTime = 0;
      let pos = [...route[0]] as [number, number, number];

      for (let i = 0; i < route.length; i++) {
        const segDist = segments[i];
        const segWalkTime = segDist / speed;

        if (localTime >= currTime && localTime < currTime + segWalkTime) {
          const t = (localTime - currTime) / segWalkTime;
          const p1 = route[i];
          const p2 = route[(i + 1) % route.length];
          pos[0] = p1[0] + (p2[0] - p1[0]) * t;
          pos[1] = p1[1];
          pos[2] = p1[2] + (p2[2] - p1[2]) * t;
          break;
        }
        currTime += segWalkTime;

        if (localTime >= currTime && localTime < currTime + pause) {
          pos = [...route[(i + 1) % route.length]] as [number, number, number];
          break;
        }
        currTime += pause;
      }

      const vLevel = mapLevelForY(pos[1]);
      if (!showAll && vLevel !== this.level) continue;

      if (showRoutes) {
        const points = route.map(p => toSvg(p).join(',')).join(' ');
        mapSvg.append(svg('polygon', {
          points,
          class: 'choreo-map__route'
        }));
      }

      const [cx, cy] = toSvg(pos);
      mapSvg.append(svg('circle', {
        cx, cy, r: v.staff ? 2.5 : 2,
        class: `choreo-map__visitor ${v.staff ? 'choreo-map__visitor--staff' : ''}`
      }));
    }

    this.renderReport();
  }

  private renderReport() {
    let html = '<h3>Visitor Evidence Report</h3><ul>';

    for (const v of SOURCE_VISITORS) {
      const route = visitorRouteForVNext(v.id);
      if (!route || route.length === 0) continue;

      let totalDist = 0;
      for (let i = 0; i < route.length; i++) {
        const p1 = route[i];
        const p2 = route[(i + 1) % route.length];
        const dx = p2[0] - p1[0];
        const dz = p2[2] - p1[2];
        totalDist += Math.sqrt(dx * dx + dz * dz);
      }

      const loopTime = (totalDist / v.speed) + (route.length * ((v.pause[0] + v.pause[1]) / 2));

      html += `<li>
        <strong>${v.title}</strong> (${v.id}):
        Loop Time: ${loopTime.toFixed(1)}s, Dist: ${totalDist.toFixed(1)}m
      </li>`;
    }

    html += '</ul>';
    this.reportEl.innerHTML = html;
  }
}
