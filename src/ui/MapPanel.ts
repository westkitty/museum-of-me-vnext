import { Panel } from './Panel';
import { el, isActivationKey } from './dom';
import {
  WINGS, PLACEMENTS, ROTUNDA_APOTHEM, VESTIBULE_TO, SANCTUARY_CENTER, SANCTUARY_RADIUS, LEVEL_1_Y,
  SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_DIR,
  faceDirection, place, type Vec3,
} from '../world/layout';
import { EXHIBITS_BY_ID, WINGS_BY_ID, exhibitsForWing, COLLECTION } from '../content/collection.generated';
import type { Journal } from '../state/Journal';
import type { ActiveVisitThread } from '../state/VisitThread';
import type { VisitorPreferences } from '../state/Preferences';

const SVG = 'http://www.w3.org/2000/svg';
/** Plan extent in metres, mapped onto the SVG viewBox. */
const EXTENT = 150;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** World XZ → SVG coordinates. North is up. */
function toSvg(p: Vec3): [number, number] {
  return [p[0] + EXTENT, p[2] + EXTENT];
}

export interface MapVisitorMarker {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly kind: 'authored' | 'ambient';
  readonly staff?: boolean;
}

export function mapLevelForY(y: number): 0 | 1 {
  return y >= LEVEL_1_Y - 2 ? 1 : 0;
}

export function compassHeading(yaw: number): string {
  const dx = -Math.sin(yaw);
  const dz = -Math.cos(yaw);
  const degrees = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  return names[Math.round(degrees / 45) % 8];
}

export function nearestUnvisitedId(position: Vec3, visited: ReadonlySet<string>): string | null {
  let best: { id: string; distance: number } | null = null;
  for (const placement of PLACEMENTS) {
    if (visited.has(placement.exhibitId)) continue;
    const distance = Math.hypot(
      placement.doorway[0] - position[0],
      placement.doorway[2] - position[2],
    );
    if (!best || distance < best.distance) best = { id: placement.exhibitId, distance };
  }
  return best?.id ?? null;
}

const WING_COLOUR: Record<string, string> = {
  north: '#6f5bd6', east: '#2f8f8a', south: '#b5543a',
  west: '#8a6bb5', media: '#b58b3a', infra: '#5f8a52',
};

/**
 * The museum map (plan §30). An architectural plan drawn from `layout.ts`, so it
 * can never show a room the building does not have. Selecting an exhibit sets a
 * wayfinding target; it does not teleport the visitor anywhere.
 */
export class MapPanel extends Panel {
  private level: 0 | 1 = 0;
  private target: string | null = null;
  private readonly targetListeners = new Set<(exhibitId: string | null) => void>();

  constructor(
    private readonly journal: Journal,
    private readonly getPosition: () => Vec3,
    private readonly getZone: () => string,
    private readonly getThread: () => ActiveVisitThread | null,
    private readonly getYaw: () => number,
    private readonly getPreferences: () => Pick<VisitorPreferences, 'showMapVisitors' | 'showTooltips'>,
    private readonly getVisitors: () => readonly MapVisitorMarker[],
  ) {
    super('map', 'Museum map', 'Where you are');
  }

  override open(): void {
    this.level = mapLevelForY(this.getPosition()[1]);
    super.open();
  }

  onTargetChange(fn: (exhibitId: string | null) => void): () => void {
    this.targetListeners.add(fn);
    return () => this.targetListeners.delete(fn);
  }

  get currentTarget(): string | null {
    return this.target;
  }

  setTargetPublic(id: string | null): void {
    this.setTarget(id);
  }

  private setTarget(id: string | null): void {
    this.target = id;
    for (const fn of this.targetListeners) fn(id);
    this.rerenderWithDialogFocus();
  }

  /**
   * Map actions rebuild the plan and destination list. If the activated SVG bay
   * or button is removed while focused, browsers otherwise drop focus to the
   * document body, taking Escape and the focus trap with it. Return focus to the
   * dialog itself after a rebuild so keyboard operation remains continuous.
   */
  private rerenderWithDialogFocus(): void {
    this.render();
    if (this.isOpen) this.body.focus();
  }

  protected render(): void {
    const position = this.getPosition();
    const prefs = this.getPreferences();
    const yaw = this.getYaw();
    const heading = compassHeading(yaw);
    const floorName = this.level === 0 ? 'ground floor' : 'upper floor';
    const plan = svg('svg', {
      class: 'map__plan',
      viewBox: `0 0 ${EXTENT * 2} ${EXTENT * 2}`,
      role: 'img',
      'aria-label': `Museum plan, ${floorName}. You are facing ${heading}.`,
    });

    const rot = svg('circle', {
      class: 'room',
      cx: EXTENT, cy: EXTENT, r: ROTUNDA_APOTHEM,
      fill: this.level === 0 ? 'rgba(201,162,39,0.16)' : 'rgba(201,162,39,0.09)',
    });
    plan.append(rot);
    plan.append(textAt(EXTENT, EXTENT - ROTUNDA_APOTHEM - 3, this.level === 0 ? 'Rotunda' : 'Balcony'));

    this.renderVisitThread(plan);

    for (const wing of WINGS) {
      if (wing.level !== this.level) continue;
      const dir = faceDirection(wing.face);
      const colour = WING_COLOUR[wing.id];

      const [x1, y1] = toSvg(place(dir, wing.corridorFrom));
      const [x2, y2] = toSvg(place(dir, wing.hallTo));
      plan.append(
        svg('line', {
          x1, y1, x2, y2,
          stroke: colour, 'stroke-width': wing.hallHalfWidth * 2,
          'stroke-opacity': '0.28', 'stroke-linecap': 'square',
        }),
      );

      if (wing.id === 'south') {
        const [vx, vy] = toSvg(place(dir, VESTIBULE_TO));
        plan.append(svg('line', { x1: x2, y1: y2, x2: vx, y2: vy, stroke: colour, 'stroke-width': wing.hallHalfWidth * 2, 'stroke-opacity': '0.18' }));
        plan.append(svg('circle', { cx: vx, cy: vy, r: 2.4, fill: '#e8c65a' }));
        plan.append(textAt(vx, vy + 7, 'Entrance'));
      }

      const wingRecord = WINGS_BY_ID.get(wing.id);
      const [lx, ly] = toSvg(place(dir, wing.hallTo + 8, 0));
      plan.append(textAt(lx, ly, wingRecord?.name ?? wing.id));

      // One selectable bay per exhibit. The visual map is keyboard-operable in
      // its own right; the destination cards remain a redundant text route.
      for (const placement of PLACEMENTS.filter((p) => p.wing === wing.id)) {
        const record = EXHIBITS_BY_ID.get(placement.exhibitId)!;
        const selected = this.target === record.id;
        const [bx, by] = toSvg(placement.anchor);
        const g = svg('g', {
          class: 'bay' + (selected ? ' bay--target' : ''),
          role: 'button',
          tabindex: 0,
          'aria-pressed': String(selected),
          'aria-label': `${record.id}, ${record.title}. ${record.copy.plaque}`,
        });
        const box = svg('rect', {
          x: bx - wing.bayHalfAlong * 0.7, y: by - wing.bayHalfAlong * 0.7,
          width: wing.bayHalfAlong * 1.4, height: wing.bayHalfAlong * 1.4,
          rx: 1.2,
          fill: this.journal.hasVisited(record.id) ? colour : 'rgba(255,255,255,0.10)',
          'fill-opacity': this.journal.hasVisited(record.id) ? '0.85' : '1',
          stroke: colour, 'stroke-width': 0.6,
        });
        const activate = (): void => this.setTarget(selected ? null : record.id);
        g.append(box);
        if (prefs.showTooltips) {
          const label = svg('title');
          label.textContent = `${record.id} · ${record.title} — ${record.copy.plaque}`;
          g.append(label);
        }
        g.addEventListener('click', activate);
        g.addEventListener('keydown', (event) => {
          if (!isActivationKey(event)) return;
          event.preventDefault();
          activate();
        });
        plan.append(g);
      }
    }

    if (this.level === 0) {
      const [sx, sy] = toSvg(SANCTUARY_CENTER);
      const [rx1, ry1] = toSvg(place(SANCTUARY_DIR, SANCTUARY_RAMP_FROM));
      const [rx2, ry2] = toSvg(place(SANCTUARY_DIR, SANCTUARY_RAMP_TO));
      plan.append(svg('line', { x1: rx1, y1: ry1, x2: rx2, y2: ry2, stroke: '#d9c69a', 'stroke-width': 5, 'stroke-opacity': '0.3', 'stroke-dasharray': '3 2' }));
      plan.append(svg('circle', { class: 'room', cx: sx, cy: sy, r: SANCTUARY_RADIUS, fill: 'rgba(217,198,154,0.16)', stroke: '#d9c69a', 'stroke-width': 0.6 }));
      plan.append(textAt(sx, sy - SANCTUARY_RADIUS - 3, 'Dexter Sanctuary'));
    }

    const visitorMarkers = prefs.showMapVisitors
      ? this.getVisitors().filter((visitor) => mapLevelForY(visitor.y) === this.level)
      : [];
    for (const visitor of visitorMarkers) {
      const [vx, vy] = toSvg([visitor.x, visitor.y, visitor.z]);
      const marker = svg('g', {
        class: `map-visitor map-visitor--${visitor.kind}${visitor.staff ? ' map-visitor--staff' : ''}`,
        'aria-hidden': 'true',
      });
      marker.append(svg('circle', { cx: vx, cy: vy, r: visitor.staff ? 1.9 : 1.5 }));
      if (prefs.showTooltips) {
        const title = svg('title');
        title.textContent = visitor.kind === 'authored'
          ? `${visitor.staff ? 'Museum staff' : 'Authored visitor'} · ${visitor.id}`
          : 'Ambient museum visitor';
        marker.append(title);
      }
      plan.append(marker);
    }

    const [px, py] = toSvg(position);
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    plan.append(svg('line', {
      class: 'you-heading',
      x1: px, y1: py, x2: px + forwardX * 8, y2: py + forwardZ * 8,
    }));
    plan.append(svg('circle', { class: 'you', cx: px, cy: py, r: 2.6 }));
    const halo = svg('circle', { cx: px, cy: py, r: 5.2, fill: 'none', stroke: '#e8c65a', 'stroke-width': 0.8, 'stroke-opacity': '0.6' });
    plan.append(halo);

    const thread = this.getThread();
    const list = el('div', {});
    for (const wing of COLLECTION.wings) {
      if (wing.level !== this.level) continue;
      list.append(el('h3', { text: wing.name }));
      const grid = el('div', { class: 'panel__grid' });
      for (const record of exhibitsForWing(wing.id)) {
        grid.append(
          el(
            'button',
            {
              class: 'panel__card',
              type: 'button',
              style: `--wing-colour:${WING_COLOUR[wing.id]}`,
              'data-visited': String(this.journal.hasVisited(record.id)),
              'aria-pressed': String(this.target === record.id),
              ...(prefs.showTooltips ? { title: record.copy.plaque } : {}),
              onclick: () => this.setTarget(this.target === record.id ? null : record.id),
            },
            el('strong', { text: `${record.id} · ${record.title}` }),
            el('span', { text: record.copy.subtitle }),
          ),
        );
      }
      list.append(grid);
    }

    const myLevel = mapLevelForY(position[1]);
    const levelSwitch = el(
      'div',
      { class: 'map__level', role: 'group', 'aria-label': 'Floor' },
      el('button', {
        type: 'button', text: 'Ground floor',
        'aria-pressed': String(this.level === 0),
        onclick: () => { this.level = 0; this.rerenderWithDialogFocus(); },
      }),
      el('button', {
        type: 'button', text: 'Upper floor',
        'aria-pressed': String(this.level === 1),
        onclick: () => { this.level = 1; this.rerenderWithDialogFocus(); },
      }),
      el('button', {
        type: 'button',
        text: `My floor · ${myLevel === 0 ? 'ground' : 'upper'}`,
        disabled: this.level === myLevel,
        onclick: () => { this.level = myLevel; this.rerenderWithDialogFocus(); },
      }),
    );

    this.setContent(
      el(
        'div',
        { class: 'map__layout' },
        el('div', {}, levelSwitch, plan as unknown as Node),
        el(
          'div',
          {},
          el('p', { text: `You are in the ${this.getZone()}, facing ${heading}. Selecting an exhibit marks it on the map and shows a direction cue — it never moves you there.` }),
          this.target
            ? el('p', { class: 'panel__note', text: `Wayfinding to ${EXHIBITS_BY_ID.get(this.target)?.title} · ${Math.round(this.distanceTo(this.target))} m away. Select it again to clear.` })
            : el('p', { class: 'panel__note', text: `${this.journal.visitedCount} of 35 exhibits visited. There is no score.` }),
          prefs.showMapVisitors
            ? el('p', { class: 'map__visitor-note', text: `${visitorMarkers.length} visitor${visitorMarkers.length === 1 ? '' : 's'} visible on this floor: authored people use solid markers, staff use ringed markers, ambient visitors use quiet markers.` })
            : el('p', { class: 'map__visitor-note', text: 'Visitor markers are hidden by your settings.' }),
          thread
            ? el('p', { class: 'map__thread-note', text: `Visit Thread: ${thread.title} · ${thread.status === 'complete' ? 'complete' : `stop ${thread.cursor + 1} of ${thread.stopIds.length}`}. Numbered markers on the plan are itinerary stops, not completion marks.` })
            : document.createTextNode(''),
          el('div', { class: 'panel__grid' },
            el('button', { type: 'button', text: 'Next unvisited', onclick: () => {
              const next = this.journal.nextUnvisited(COLLECTION.exhibits.map((e) => e.id));
              if (next) this.setTarget(next);
            } }),
            el('button', { type: 'button', text: 'Nearest unvisited', onclick: () => {
              const visited = new Set(COLLECTION.exhibits.filter((entry) => this.journal.hasVisited(entry.id)).map((entry) => entry.id));
              const next = nearestUnvisitedId(position, visited);
              if (next) this.setTarget(next);
            } }),
            thread && thread.status === 'active' && thread.stopIds[thread.cursor]
              ? el('button', { type: 'button', text: 'Guide current thread stop', onclick: () => this.setTarget(thread.stopIds[thread.cursor]) })
              : document.createTextNode(''),
            el('button', { type: 'button', text: 'Clear guide', onclick: () => this.setTarget(null) }),
          ),
          list,
        ),
      ),
    );
  }

  private distanceTo(exhibitId: string): number {
    const placement = PLACEMENTS.find((entry) => entry.exhibitId === exhibitId);
    if (!placement) return 0;
    const position = this.getPosition();
    return Math.hypot(
      placement.doorway[0] - position[0],
      placement.doorway[2] - position[2],
    );
  }

  private renderVisitThread(plan: SVGSVGElement): void {
    const thread = this.getThread();
    if (!thread) return;
    const stops = thread.stopIds.map((id, index) => {
      const placement = PLACEMENTS.find((entry) => entry.exhibitId === id);
      const exhibit = EXHIBITS_BY_ID.get(id);
      const wing = exhibit ? WINGS_BY_ID.get(exhibit.wing) : undefined;
      return placement && wing ? { id, index, placement, wing } : null;
    }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1];
      const b = stops[i];
      if (a.wing.level !== this.level || b.wing.level !== this.level) continue;
      const [x1, y1] = toSvg(a.placement.doorway);
      const [x2, y2] = toSvg(b.placement.doorway);
      plan.append(svg('line', {
        class: 'thread-link', x1, y1, x2, y2,
        stroke: '#e8c65a', 'stroke-width': 1.15, 'stroke-opacity': 0.62, 'stroke-dasharray': '2 1.5',
      }));
    }

    for (const stop of stops) {
      if (stop.wing.level !== this.level) continue;
      const [x, y] = toSvg(stop.placement.doorway);
      const completed = thread.completedIds.includes(stop.id);
      const skipped = thread.skippedIds.includes(stop.id);
      const current = thread.status !== 'complete' && stop.index === thread.cursor;
      const marker = svg('g', { class: `thread-marker thread-marker--${completed ? 'visited' : skipped ? 'skipped' : current ? 'current' : 'upcoming'}` });
      marker.append(svg('circle', { cx: x, cy: y, r: current ? 3.3 : 2.7 }));
      const number = textAt(x, y + 1.3, String(stop.index + 1));
      number.setAttribute('class', 'thread-marker__label');
      marker.append(number);
      const title = svg('title');
      title.textContent = `Visit Thread stop ${stop.index + 1}: ${EXHIBITS_BY_ID.get(stop.id)?.title ?? stop.id}`;
      marker.append(title);
      plan.append(marker);
    }
  }

}

function textAt(x: number, y: number, label: string): SVGTextElement {
  const t = svg('text', { class: 'label', x, y, 'text-anchor': 'middle' });
  t.textContent = label;
  return t;
}
