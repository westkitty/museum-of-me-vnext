import { Panel } from './Panel';
import type { CollisionWorld } from '../world/CollisionWorld';
import { el, isActivationKey } from './dom';
import {
  WINGS, PLACEMENTS, ROTUNDA_APOTHEM, VESTIBULE_TO, SANCTUARY_CENTER, SANCTUARY_RADIUS, LEVEL_1_Y,
  SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_DIR, STAIRS, ENTRANCE_DOOR, PLACEMENT_BY_EXHIBIT, WING_BY_ID,
  faceDirection, place, stairArcPoint, stairLanding, type Vec3,
} from '../world/layout';
import { SANCTUARY_DESCRIPTION, SANCTUARY_TITLE } from '../content/sanctuaryCopy';
import { EXHIBITS_BY_ID, WINGS_BY_ID, exhibitsForWing, COLLECTION } from '../content/collection.generated';
import type { Journal } from '../state/Journal';
import type { ActiveVisitThread } from '../state/VisitThread';
import type { VisitorPreferences } from '../state/Preferences';
import { ISLAND_OUTLINE, LAGOON_SURFACE_OUTLINE, PATH_CENTERLINES, PIER_CENTERLINE } from '../world/exterior/IslandSiteLayout';
import { ISLAND_LANDMARKS, MUSEUM_ENTRANCE_TARGET, planVisitorRoute, visitorRouteDistance } from '../world/visitorRoute';
import './uplift2-C.css';

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

/** Height at which a route point is drawn on the upper plan (matches `mapLevelForY`). */
const LEVEL_SPLIT_Y = LEVEL_1_Y - 2;

export interface MapRouteChange {
  readonly at: Vec3;
  readonly from: 0 | 1;
  readonly to: 0 | 1;
}

export interface MapRouteView {
  /** Polylines of the planned route that lie on this floor. */
  readonly lines: readonly (readonly Vec3[])[];
  /** Where the route changes floor (on a grand stair), on either plan. */
  readonly changes: readonly MapRouteChange[];
}

/**
 * Splits a planned visitor route (the same `planVisitorRoute` result the floor
 * line follows) into the parts drawn on one floor plan. A stair leg is cut where
 * it crosses the plan's floor threshold, so the ground plan shows the climb up
 * to that point and the upper plan picks it up from there.
 */
export function routeForLevel(route: readonly Vec3[], level: 0 | 1): MapRouteView {
  const lines: Vec3[][] = [];
  const changes: MapRouteChange[] = [];
  let current: Vec3[] | null = null;
  for (let i = 0; i < route.length; i++) {
    const point = route[i];
    const here = mapLevelForY(point[1]);
    if (i > 0) {
      const previous = route[i - 1];
      const before = mapLevelForY(previous[1]);
      if (before !== here) {
        const t = (LEVEL_SPLIT_Y - previous[1]) / (point[1] - previous[1]);
        const cross: Vec3 = [
          previous[0] + (point[0] - previous[0]) * t,
          LEVEL_SPLIT_Y,
          previous[2] + (point[2] - previous[2]) * t,
        ];
        if (current && before === level) current.push(cross);
        current = null;
        changes.push({ at: cross, from: before, to: here });
        if (here === level) {
          current = [cross];
          lines.push(current);
        }
      }
    }
    if (here === level) {
      if (!current) {
        current = [];
        lines.push(current);
      }
      current.push(point);
    }
  }
  return { lines: lines.filter((line) => line.length >= 2), changes };
}

/** Floor of a guide destination: an exhibit's wing level, or the ground-floor entrance. */
export function guideTargetLevel(id: string): 0 | 1 | null {
  if (id === MUSEUM_ENTRANCE_TARGET) return 0;
  const placement = PLACEMENT_BY_EXHIBIT.get(id);
  return placement ? WING_BY_ID.get(placement.wing)?.level ?? null : null;
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
  private showIsland = false;
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
    /** Outside, the plan of the interior must not show the visitor's position. */
    private readonly isOutside: () => boolean = () => false,
    private readonly getCollision: () => CollisionWorld | undefined = () => undefined,
  ) {
    super('map', 'Museum map', 'Where you are');
  }

  override open(): void {
    this.level = mapLevelForY(this.getPosition()[1]);
    this.showIsland = this.isOutside();
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

  clearTargetOnArrival(): void {
    this.target = null;
    this.rerenderWithDialogFocus();
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
    if (!this.isOpen) return;
    this.render();
    this.body.focus();
  }

  private viewSwitch(): HTMLElement {
    const position = this.getPosition();
    const myLevel = mapLevelForY(position[1]);
    return el('div', { class: 'map__level', role: 'group', 'aria-label': 'Map view' },
      el('button', {
        type: 'button', text: 'Island', 'aria-pressed': String(this.showIsland),
        onclick: () => { this.showIsland = true; this.rerenderWithDialogFocus(); },
      }),
      ...([0, 1] as const).map((level) => el('button', {
        type: 'button', text: level === 0 ? 'Ground floor' : 'Upper floor',
        'aria-pressed': String(!this.showIsland && this.level === level),
        onclick: () => { this.level = level; this.showIsland = false; this.rerenderWithDialogFocus(); },
      })),
      this.isOutside() ? document.createTextNode('') : el('button', {
        type: 'button', text: `My floor · ${myLevel === 0 ? 'ground' : 'upper'}`,
        disabled: !this.showIsland && this.level === myLevel,
        onclick: () => { this.level = myLevel; this.showIsland = false; this.rerenderWithDialogFocus(); },
      }),
    );
  }

  private renderIsland(position: Vec3, yaw: number, heading: string): void {
    const outside = this.isOutside();
    const plan = svg('svg', {
      class: 'map__plan map__island', role: 'img',
      viewBox: '-210 -209 420 442',
      'aria-label': outside ? `Island map. You are facing ${heading}.` : 'Island map. You are inside the museum.',
    });
    const points = (path: readonly (readonly [number, number])[]) => path.map(([x, z]) => `${x},${z}`).join(' ');
    plan.append(
      svg('polygon', { points: points(ISLAND_OUTLINE), fill: '#29382e', stroke: '#7c9884', 'stroke-width': 1.7 }),
      svg('polygon', { points: points(LAGOON_SURFACE_OUTLINE), fill: '#245268', stroke: '#80aab2', 'stroke-width': 1.3 }),
    );
    for (const path of [...PATH_CENTERLINES, PIER_CENTERLINE]) {
      plan.append(svg('polyline', {
        points: points(path), fill: 'none', stroke: '#c2ac83', 'stroke-width': 2.5, 'stroke-linejoin': 'round',
      }));
    }
    plan.append(
      svg('rect', { x: -38, y: -105, width: 76, height: 233, rx: 6, fill: '#252532', stroke: '#a39dbc', 'stroke-width': 1.5 }),
      islandLabel(0, -16, 'Museum'),
      islandLabel(171, -167, 'N ↑'),
    );
    const route = outside ? planVisitorRoute('exterior', position, MUSEUM_ENTRANCE_TARGET, this.getCollision()) : [];
    if (route.length > 1) {
      plan.append(svg('polyline', {
        class: 'island-route', points: points(route.map(([x, , z]) => [x, z] as const)), fill: 'none',
        stroke: '#ffda70', 'stroke-width': 3, 'stroke-dasharray': '6 3', 'stroke-linejoin': 'round',
      }));
    }
    for (const landmark of ISLAND_LANDMARKS) {
      const [x, , z] = landmark.at;
      plan.append(svg('circle', { cx: x, cy: z, r: 3.5, fill: '#f1dab1' }));
      plan.append(islandLabel(x + (x === 0 ? -49 : 0), z - 4, landmark.name));
    }
    if (outside) {
      const [x, , z] = position;
      plan.append(svg('line', {
        class: 'island-heading', x1: x, y1: z, x2: x - 12 * Math.sin(yaw), y2: z - 12 * Math.cos(yaw),
        stroke: '#fff4d8', 'stroke-width': 2.3,
      }));
      plan.append(svg('circle', {
        class: 'island-you', cx: x, cy: z, r: 5, fill: '#ffda70', stroke: '#fff4d8', 'stroke-width': 1.8,
      }));
    }
    const location = outside
      ? `You are outside the museum (${this.getZone()}), facing ${heading}.`
      : `You are inside the museum (${this.getZone()}).`;
    const door = Math.round(visitorRouteDistance(route));
    this.setContent(el('div', { class: 'map__layout' },
      el('div', {}, this.viewSwitch(), plan as unknown as Node),
      el('div', {},
        el('p', { text: location }),
        outside && route.length > 1
          ? el('p', { class: 'panel__note', text: `Follow the dashed path to the front door · about ${door} m on foot.` })
          : document.createTextNode(''),
        this.target
          ? el('p', { class: 'panel__note map__wayfinding', role: 'status', text: `Wayfinding to ${this.targetName(this.target)}.` })
          : document.createTextNode(''),
        outside
          ? el('button', { type: 'button', text: 'Guide to the entrance', onclick: () => this.setTarget(MUSEUM_ENTRANCE_TARGET) })
          : document.createTextNode(''),
        this.target
          ? el('button', { type: 'button', text: 'Clear guide', onclick: () => this.setTarget(null) })
          : document.createTextNode(''),
        el('h3', { text: 'Island landmarks' }),
        el('ul', {}, ...ISLAND_LANDMARKS.map(({ name }) => el('li', { text: name }))),
      ),
    ));
  }

  /** Both grand stairs, drawn from the same arc the treads and collision use.
   * On the upper floor the plan shows the railed well and its head. */
  private renderStairs(plan: SVGSVGElement): void {
    for (const stair of STAIRS) {
      const points = Array.from({ length: 13 }, (_, i) => toSvg(stairArcPoint(stair, i / 12)));
      const g = svg('g', { class: 'map__stair', 'data-stair': stair.id });
      const title = svg('title');
      title.textContent = this.level === 0
        ? 'Grand stair up to the balcony and the upper wings'
        : 'Grand stair down to the Rotunda (enter at the open end)';
      g.append(title);
      g.append(svg('polyline', {
        points: points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
        fill: 'none', stroke: '#e8dcc0', 'stroke-width': stair.halfWidth * 2,
        'stroke-opacity': this.level === 0 ? '0.3' : '0.16', 'stroke-dasharray': '0.7 0.5',
      }));
      const entry = this.level === 0 ? stairArcPoint(stair, 0) : stairLanding(stair, 0.6);
      const [hx, hy] = toSvg(entry);
      g.append(svg('circle', { cx: hx, cy: hy, r: 1.3, fill: '#e8dcc0' }));
      plan.append(g);
      // Label outside the rotunda wall, beside its own stair, so the two
      // labels never meet in the middle of the plan.
      const radius = Math.hypot(entry[0], entry[2]) || 1;
      const out = (ROTUNDA_APOTHEM + 6) / radius;
      const [lx, ly] = toSvg([entry[0] * out, entry[1], entry[2] * out]);
      const label = textAt(lx, ly, this.level === 0 ? 'Stairs up' : 'Stairs down');
      label.setAttribute('text-anchor', entry[0] < 0 ? 'end' : 'start');
      plan.append(label);
    }
  }

  protected render(): void {
    const position = this.getPosition();
    const prefs = this.getPreferences();
    const yaw = this.getYaw();
    const heading = compassHeading(yaw);
    if (this.showIsland) {
      this.renderIsland(position, yaw, heading);
      return;
    }
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
    this.renderStairs(plan);

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
        // The exhibit number, readable on the plan itself rather than only in
        // a tooltip or the accessible name; it matches the hall blade signs.
        const number = textAt(bx, by + 1.5, record.id);
        number.setAttribute('class', 'map__bay-number' + (this.journal.hasVisited(record.id) ? ' map__bay-number--visited' : ''));
        number.setAttribute('aria-hidden', 'true');
        g.append(number);
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
      plan.append(textAt(sx, sy - SANCTUARY_RADIUS - 3, SANCTUARY_TITLE));
    }

    const route = this.plannedInteriorRoute();
    this.renderRoute(plan, route);

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

    // The exterior shares X/Z with this interior plan; a marker drawn from
    // outside would claim the visitor is in a wing they are walking behind.
    const outside = this.isOutside();
    if (!outside && mapLevelForY(position[1]) !== this.level) {
      // On the other floor's plan the visitor is not here: a hollow marker
      // says where they are, above or below, without claiming this floor.
      const [px, py] = toSvg(position);
      const elsewhere = svg('g', { class: 'map__you-elsewhere' });
      const title = svg('title');
      title.textContent = `You are on the ${mapLevelForY(position[1]) === 0 ? 'ground floor, below' : 'upper floor, above'}`;
      elsewhere.append(title, svg('circle', { cx: px, cy: py, r: 2.6 }));
      plan.append(elsewhere);
    } else if (!outside) {
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
    }

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

    this.setContent(
      el(
        'div',
        { class: 'map__layout' },
        el('div', {}, this.viewSwitch(), plan as unknown as Node, this.legend(route.length > 1, Boolean(thread))),
        el(
          'div',
          {},
          el('p', { text: `${outside
            ? `You are outside the museum (${this.getZone()}), facing ${heading}. Select Island to see your position and the path to the entrance.`
            : `You are in the ${this.getZone()}, facing ${heading}.`} Selecting an exhibit marks it on the map and shows a direction cue — it never moves you there.` }),
          this.target
            ? el('p', { class: 'panel__note map__wayfinding', role: 'status', text: `Wayfinding to ${this.targetName(this.target)} · ${Math.round(this.distanceTo(this.target))} m ${outside ? 'to the entrance' : 'away'}.` })
            : el('p', { class: 'panel__note map__wayfinding', role: 'status', text: `${this.journal.visitedCount} of 35 exhibits visited. There is no score.` }),
          this.floorNote(route),
          this.level === 0
            ? el('p', { class: 'panel__note', text: `${SANCTUARY_TITLE}. ${SANCTUARY_DESCRIPTION}` })
            : document.createTextNode(''),
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
          el('p', { class: 'panel__note' },
            el('a', { href: new URL('workbench/', document.baseURI).href, target: '_blank', rel: 'noopener noreferrer', text: 'Open the top-down planning workbench (new tab)' }),
          ),
          list,
        ),
      ),
    );
  }

  private targetName(id: string): string {
    return id === MUSEUM_ENTRANCE_TARGET ? 'the museum entrance' : EXHIBITS_BY_ID.get(id)?.title ?? id;
  }

  /**
   * The guide route drawn on the plan. Inside, it is the route the floor line
   * follows from where the visitor stands; outside, the interior part starts at
   * the front door (the island view shows the path up to it).
   */
  private plannedInteriorRoute(): Vec3[] {
    const target = this.target;
    if (!target || target === MUSEUM_ENTRANCE_TARGET) return [];
    return this.isOutside()
      ? planVisitorRoute('interior', ENTRANCE_DOOR, target)
      : planVisitorRoute('interior', this.getPosition(), target, this.getCollision());
  }

  private renderRoute(plan: SVGSVGElement, route: readonly Vec3[]): void {
    if (route.length < 2) return;
    const view = routeForLevel(route, this.level);
    for (const line of view.lines) {
      plan.append(svg('polyline', {
        class: 'map__route',
        points: line.map((p) => toSvg(p).map((v) => v.toFixed(2)).join(',')).join(' '),
        fill: 'none',
      }));
    }
    for (const change of view.changes) {
      const [x, y] = toSvg(change.at);
      const marker = svg('g', { class: 'map__route-change' });
      const title = svg('title');
      const up = change.to > change.from;
      title.textContent = up ? 'The route climbs a grand stair to the upper floor here' : 'The route goes down a grand stair to the ground floor here';
      marker.append(title, svg('circle', { cx: x, cy: y, r: 2.6 }));
      const arrow = textAt(x, y + 1.6, up ? '↑' : '↓');
      arrow.setAttribute('class', 'map__route-change-arrow');
      marker.append(arrow);
      plan.append(marker);
    }
  }

  /** Says when the guide target is on the other floor, with a way to show it. */
  private floorNote(route: readonly Vec3[]): Node {
    const target = this.target;
    const targetLevel = target ? guideTargetLevel(target) : null;
    if (!target || targetLevel === null || targetLevel === this.level) return document.createTextNode('');
    const floor = targetLevel === 1 ? 'upper floor' : 'ground floor';
    const changes = routeForLevel(route, this.level).changes.length > 0;
    return el('div', { class: 'map__floor-note', role: 'note' },
      el('p', { text: `${target === MUSEUM_ENTRANCE_TARGET ? 'The entrance' : `${target} · ${this.targetName(target)}`} is on the ${floor}.${changes
        ? ` The dashed route reaches a grand stair (marked ${targetLevel === 1 ? '↑' : '↓'}) and continues there.`
        : ''}` }),
      el('button', {
        type: 'button', text: `Show the ${floor}`,
        onclick: () => { this.level = targetLevel; this.showIsland = false; this.rerenderWithDialogFocus(); },
      }),
    );
  }

  /** A key for every symbol the plan uses; colour is never the only cue. */
  private legend(hasRoute: boolean, hasThread: boolean): HTMLElement {
    const item = (swatch: string, text: string) => el('li', {},
      el('span', { class: `map__key map__key--${swatch}`, 'aria-hidden': 'true' }),
      el('span', { text }),
    );
    return el('ul', { class: 'map__legend', 'aria-label': 'Map key' },
      item('you', this.isOutside() ? 'You (shown on the Island view while outside)' : 'You, and the way you face'),
      ...(!this.isOutside() && mapLevelForY(this.getPosition()[1]) !== this.level ? [item('elsewhere', 'You, on the other floor')] : []),
      item('unvisited', 'Exhibit, not yet visited (E-number)'),
      item('visited', 'Exhibit you have visited (filled)'),
      item('target', 'Guide destination (bright outline)'),
      item('route', hasRoute ? 'Planned route, as the floor line walks it' : 'Planned route (choose an exhibit)'),
      item('change', 'Route changes floor on a grand stair'),
      item('stair', 'Grand stair'),
      ...(hasThread ? [item('thread', 'Visit Thread stop (numbered)')] : []),
    );
  }

  private distanceTo(id: string): number {
    const route = planVisitorRoute(this.isOutside() ? 'exterior' : 'interior', this.getPosition(), id, this.getCollision());
    return visitorRouteDistance(route);
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

function islandLabel(x: number, y: number, label: string): SVGTextElement {
  const node = textAt(x, y, label);
  node.style.fontSize = '10px';
  return node;
}
