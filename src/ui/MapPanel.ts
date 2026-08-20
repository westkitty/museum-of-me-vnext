import { Panel } from './Panel';
import { el, isActivationKey } from './dom';
import {
  WINGS, PLACEMENTS, ROTUNDA_APOTHEM, VESTIBULE_TO, SANCTUARY_CENTER, SANCTUARY_RADIUS,
  SANCTUARY_RAMP_FROM, SANCTUARY_RAMP_TO, SANCTUARY_DIR,
  faceDirection, place, type Vec3,
} from '../world/layout';
import { EXHIBITS_BY_ID, WINGS_BY_ID, exhibitsForWing, COLLECTION } from '../content/collection.generated';
import type { Journal } from '../state/Journal';

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
  ) {
    super('map', 'Museum map', 'Where you are');
  }

  onTargetChange(fn: (exhibitId: string | null) => void): () => void {
    this.targetListeners.add(fn);
    return () => this.targetListeners.delete(fn);
  }

  get currentTarget(): string | null {
    return this.target;
  }

  private setTarget(id: string | null): void {
    this.target = id;
    for (const fn of this.targetListeners) fn(id);
    this.render();
  }

  protected render(): void {
    const plan = svg('svg', {
      class: 'map__plan',
      viewBox: `0 0 ${EXTENT * 2} ${EXTENT * 2}`,
      role: 'img',
      'aria-label': `Museum plan, ${this.level === 0 ? 'ground floor' : 'upper floor'}`,
    });

    // Rotunda.
    const rot = svg('circle', {
      class: 'room',
      cx: EXTENT, cy: EXTENT, r: ROTUNDA_APOTHEM,
      fill: this.level === 0 ? 'rgba(201,162,39,0.16)' : 'rgba(201,162,39,0.09)',
    });
    plan.append(rot);
    plan.append(textAt(EXTENT, EXTENT - ROTUNDA_APOTHEM - 3, this.level === 0 ? 'Rotunda' : 'Balcony'));

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
        const label = svg('title');
        label.textContent = `${record.id} · ${record.title} — ${record.copy.plaque}`;
        const activate = (): void => this.setTarget(selected ? null : record.id);
        g.append(box, label);
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

    const pos = this.getPosition();
    const [px, py] = toSvg(pos);
    plan.append(svg('circle', { class: 'you', cx: px, cy: py, r: 2.6 }));
    const halo = svg('circle', { cx: px, cy: py, r: 5.2, fill: 'none', stroke: '#e8c65a', 'stroke-width': 0.8, 'stroke-opacity': '0.6' });
    plan.append(halo);

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
              onclick: () => this.setTarget(this.target === record.id ? null : record.id),
            },
            el('strong', { text: `${record.id} · ${record.title}` }),
            el('span', { text: record.copy.subtitle }),
          ),
        );
      }
      list.append(grid);
    }

    const levelSwitch = el(
      'div',
      { class: 'map__level', role: 'group', 'aria-label': 'Floor' },
      el('button', {
        type: 'button', text: 'Ground floor',
        'aria-pressed': String(this.level === 0),
        onclick: () => { this.level = 0; this.render(); },
      }),
      el('button', {
        type: 'button', text: 'Upper floor',
        'aria-pressed': String(this.level === 1),
        onclick: () => { this.level = 1; this.render(); },
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
          el('p', { text: `You are in the ${this.getZone()}. Selecting an exhibit marks it on the map and shows a direction cue — it never moves you there.` }),
          this.target
            ? el('p', { class: 'panel__note', text: `Wayfinding to ${EXHIBITS_BY_ID.get(this.target)?.title}. Select it again to clear.` })
            : el('p', { class: 'panel__note', text: `${this.journal.visitedCount} of 35 exhibits visited. There is no score.` }),
          list,
        ),
      ),
    );
  }
}

function textAt(x: number, y: number, label: string): SVGTextElement {
  const t = svg('text', { class: 'label', x, y, 'text-anchor': 'middle' });
  t.textContent = label;
  return t;
}
