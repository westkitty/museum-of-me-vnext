import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E26 — WestCat Systems. Tier C.
 *
 * A layered operations map with overlays that can be raised, and each one can
 * be set click-through — the feature that makes an always-on-top overlay usable
 * instead of an obstacle. A second chamber holds the platformer's tile strip.
 *
 * The fragmented repository lineage is shown honestly on a board: this is what
 * a tool looks like when it is shaped by recurring live deadlines.
 */

interface Overlay {
  readonly name: string;
  readonly colour: number;
  readonly height: number;
  readonly note: string;
}

const OVERLAYS: readonly Overlay[] = [
  { name: 'Poll results', colour: 0x3fb9b2, height: 0.35, note: 'The reason the overlay exists. Updates on a timer while output is live.' },
  { name: 'Player controls', colour: 0xe8c65a, height: 0.55, note: 'Producer-safe: an accidental click during live output is visible to an audience.' },
  { name: 'Speech bubble', colour: 0xd97a4e, height: 0.75, note: 'The cat-and-bubble presentation the family is known for.' },
  { name: 'Route map', colour: 0x9d8bff, height: 0.95, note: 'The travel layer. Shared with the platformer, which is set in the same geography.' },
];

const TILE_COUNT = 14;

export class WestCatSystems extends ExhibitBase {
  private panels = this.tracked<THREE.Mesh>();
  private raised = this.tracked<boolean>();
  private clickThrough = this.tracked<boolean>();
  private tiles = this.tracked<THREE.Mesh>();
  private sprite!: THREE.Mesh;
  private spriteT = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.2);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.2, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x6b4a30, { roughness: 0.72 });
    const metal = this.standard(0x4a4640, { roughness: 0.4, metalness: 0.55 });

    // ── the base map ──
    const table = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.6, 0.1, 2.4)), wood);
    table.position.set(-1.6, 0.9, -4.2);
    this.group.add(table);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.9, 2.0)), metal);
      leg.position.set(-1.6 + sx * 1.6, 0.45, -4.2);
      this.group.add(leg);
    }

    const base = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(3.3, 0.02, 2.1)),
      this.standard(0x3a4a44, { roughness: 0.9 }),
    );
    base.position.set(-1.6, 0.97, -4.2);
    this.group.add(base);

    // ── overlay panels, stacked above the map ──
    OVERLAYS.forEach((overlay, i) => {
      const panel = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(3.0, 0.03, 1.8)),
        scope.track(new THREE.MeshStandardMaterial({
          color: overlay.colour, transparent: true, opacity: 0.5,
          emissive: new THREE.Color(overlay.colour), emissiveIntensity: 0.4, roughness: 0.5,
        })),
      );
      panel.position.set(-1.6, 0.99, -4.2);
      panel.visible = false;
      this.group.add(panel);
      this.panels.push(panel);
      this.raised.push(false);
      this.clickThrough.push(false);

      const consoleGroup = buildConsole(scope, 0.5, 0.4, 1.0, metal);
      consoleGroup.position.set(-3.6 + i * 0.7, 0, -2.0);
      this.group.add(consoleGroup);

      const label = buildLabel(scope, overlay.name, 0.56);
      label.position.set(0, 1.02, 0.2);
      label.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(label);
      scope.track(label.geometry);

      this.control({
        object: consoleGroup,
        label: `Toggle overlay: ${overlay.name}`,
        description: `${overlay.note} Toggling again sets it click-through, which is what stops an always-on-top window from becoming an obstacle.`,
        activate: () => {
          if (!this.raised[i]) {
            this.raised[i] = true;
            this.ctx.announce(`${overlay.name} raised. ${overlay.note}`);
          } else if (!this.clickThrough[i]) {
            this.clickThrough[i] = true;
            this.ctx.announce(`${overlay.name} set click-through. It is readable and no longer in the way.`);
          } else {
            this.raised[i] = false;
            this.clickThrough[i] = false;
            this.ctx.announce(`${overlay.name} lowered.`);
          }
        },
      });
    });

    // ── second chamber: the platformer's tile strip ──
    const strip = new THREE.Group();
    strip.position.set(3.0, 0, -4.6);
    this.group.add(strip);

    const random = rng(26026);
    const tileGeo = scope.track(new THREE.BoxGeometry(0.34, 0.34, 0.34));
    for (let i = 0; i < this.scaled(TILE_COUNT); i++) {
      const height = Math.floor(random() * 3);
      const tile = new THREE.Mesh(
        tileGeo,
        this.standard([0x5f8a52, 0x8a6a42, 0x6a7a8a][height], { roughness: 0.85 }),
      );
      tile.position.set((i - TILE_COUNT / 2) * 0.34, 1.0 + height * 0.34, 0);
      strip.add(tile);
      this.tiles.push(tile);
    }

    this.sprite = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(0.26, 0.3, 0.22)),
      this.emissive(0xe8c65a, 0.7),
    );
    this.sprite.position.set(-TILE_COUNT / 2 * 0.34, 1.5, 0);
    strip.add(this.sprite);

    const stripLabel = buildLabel(scope, 'WestCat Goes East — real geography, 16-bit idiom', 2.4);
    stripLabel.position.set(0, 2.5, 0);
    strip.add(stripLabel);
    scope.track(stripLabel.geometry);

    // ── the lineage board: fragmentation shown honestly ──
    const board = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(2.2, 1.4, 0.08)),
      this.standard(0x3a352e, { roughness: 0.9 }),
    );
    board.position.set(-1.6, 2.2, -6.6);
    this.group.add(board);

    const boardLabel = buildLabel(scope, 'Five repositories, one tool. The variants are the artifact.', 2.0);
    boardLabel.position.set(-1.6, 2.2, -6.5);
    this.group.add(boardLabel);
    scope.track(boardLabel.geometry);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 5);
    for (let i = 0; i < this.panels.length; i++) {
      const panel = this.panels[i];
      panel.visible = this.raised[i];
      if (!this.raised[i]) continue;
      const targetY = 0.99 + OVERLAYS[i].height;
      panel.position.y += (targetY - panel.position.y) * rate;
      const mat = panel.material as THREE.MeshStandardMaterial;
      // Click-through reads as more transparent and less emissive.
      const wantOpacity = this.clickThrough[i] ? 0.22 : 0.55;
      mat.opacity += (wantOpacity - mat.opacity) * rate;
      mat.emissiveIntensity += ((this.clickThrough[i] ? 0.18 : 0.6) - mat.emissiveIntensity) * rate;
    }

    if (!this.reducedMotion) {
      this.spriteT = (this.spriteT + dt * 0.22) % 1;
      const i = Math.min(this.tiles.length - 1, Math.floor(this.spriteT * this.tiles.length));
      this.sprite.position.x = (i - TILE_COUNT / 2) * 0.34;
      this.sprite.position.y = this.tiles[i].position.y + 0.32;
    }
  }

  protected override onReset(): void {
    this.spriteT = 0;
    for (let i = 0; i < this.raised.length; i++) {
      this.raised[i] = false;
      this.clickThrough[i] = false;
      this.panels[i].visible = false;
      this.panels[i].position.y = 0.99;
    }
    if (this.sprite) this.sprite.position.set((-TILE_COUNT / 2) * 0.34, 1.5, 0);
  }

  protected override describeState(): string {
    const up = OVERLAYS.filter((_o, i) => this.raised[i]);
    if (up.length === 0) return 'No overlays are raised. The base operations map is bare.';
    const parts = OVERLAYS.map((o, i) =>
      this.raised[i] ? `${o.name}${this.clickThrough[i] ? ' (click-through)' : ''}` : null,
    ).filter(Boolean);
    return `Raised: ${parts.join(', ')}. The platformer strip runs alongside in the same geography.`;
  }
}
