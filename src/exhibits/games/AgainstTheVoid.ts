import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng, ringTransforms } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E28 — Against the Void. Tier B.
 *
 * A tactical star table. Fleet pieces are placed, then one deterministic combat
 * turn resolves. The readouts around the table are as much of the exhibit as
 * the pieces: in a management game the interface is not the presentation layer,
 * it is the mechanism, and the table is arranged so threat, resources and
 * options are all readable at once.
 */

interface Piece {
  readonly name: string;
  readonly attack: number;
  readonly shield: number;
  readonly colour: number;
  hull: number;
  readonly maxHull: number;
}

const READOUTS = ['Power', 'Hull integrity', 'Threat', 'Supply'] as const;

export class AgainstTheVoid extends ExhibitBase {
  private table!: THREE.Group;
  private pieces = this.tracked<Piece>();
  private pieceMeshes = this.tracked<THREE.Group>();
  private placed = this.tracked<boolean>();
  private readoutBars = this.tracked<THREE.Mesh>();
  private slots = this.tracked<THREE.Vector3>();
  private turnResolved = false;
  private lastReport = '';

  /** Reused every frame; allocating these per element churned the heap. */
  private readonly scratchTarget = new THREE.Vector3();

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  private resetPieces(): void {
    this.pieces.length = 0;
    this.pieces.push(
      { name: 'Picket', attack: 2, shield: 4, colour: 0x5fb0e8, hull: 10, maxHull: 10 },
      { name: 'Lance', attack: 6, shield: 1, colour: 0xd9543a, hull: 7, maxHull: 7 },
      { name: 'Tender', attack: 0, shield: 3, colour: 0x7fd67f, hull: 12, maxHull: 12 },
    );
  }

  protected override build(): void {
    const scope = this.ctx.scope;
    this.resetPieces();

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.2);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.2, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const metal = this.standard(0x3f4650, { roughness: 0.4, metalness: 0.65 });
    const glass = this.emissive(0x1a2a38, 0.3);

    // ── the star table ──
    this.table = new THREE.Group();
    this.table.position.set(0, 0, -4.0);
    this.group.add(this.table);

    const rim = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.9, 2.05, 0.16, 32)), metal);
    rim.position.y = 0.9;
    this.table.add(rim);

    const surface = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.75, 1.75, 0.03, 32)), glass);
    surface.position.y = 0.99;
    this.table.add(surface);

    const pedestal = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.5, 0.8, 0.9, 16)), metal);
    pedestal.position.y = 0.45;
    this.table.add(pedestal);

    // Starfield etched into the surface.
    const random = rng(28028);
    const starGeo = scope.track(new THREE.SphereGeometry(0.02, 6, 4));
    const starMat = this.emissive(0x9fc0d8, 0.8);
    for (let i = 0; i < this.scaled(40); i++) {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * 1.6;
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(Math.sin(a) * r, 1.01, Math.cos(a) * r);
      this.table.add(star);
    }

    // ── fleet pieces and their slots ──
    const transforms = ringTransforms(this.pieces.length, 1.1);
    this.pieces.forEach((piece, i) => {
      const slot = new THREE.Vector3().setFromMatrixPosition(transforms[i]).setY(1.02);
      this.slots.push(slot);
      this.placed.push(false);

      const g = new THREE.Group();
      g.position.set(-1.6 + i * 0.5, 1.28, 1.5);
      this.table.add(g);
      this.pieceMeshes.push(g);

      const hull = new THREE.Mesh(
        scope.track(new THREE.ConeGeometry(0.11, 0.34, 8)),
        this.standard(piece.colour, { roughness: 0.4, metalness: 0.4 }),
      );
      hull.rotation.x = Math.PI / 2;
      g.add(hull);

      const bar = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.26, 0.024, 0.024)),
        this.emissive(0x7fd67f, 0.9),
      );
      bar.position.y = 0.22;
      g.add(bar);
      this.readoutBars.push(bar);

      const label = buildLabel(scope, piece.name, 0.4);
      label.position.set(0, 0.34, 0);
      g.add(label);
      scope.track(label.geometry);

      this.control({
        object: g,
        label: this.placed[i] ? `Recall the ${piece.name}` : `Place the ${piece.name}`,
        description: `Attack ${piece.attack}, shield ${piece.shield}, hull ${piece.maxHull}. Placing changes what the readouts show, which is how a management game communicates.`,
        activate: () => {
          this.placed[i] = !this.placed[i];
          this.turnResolved = false;
          this.ctx.announce(
            `${piece.name} ${this.placed[i] ? 'placed on the table' : 'recalled'}. ${this.placedCount()} of ${this.pieces.length} in position.`,
          );
        },
      });
    });

    // ── the readouts: the actual mechanism ──
    READOUTS.forEach((name, i) => {
      const a = (i / READOUTS.length) * Math.PI * 2 + Math.PI / 4;
      const panel = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.72, 0.34, 0.05)),
        metal,
      );
      panel.position.set(Math.sin(a) * 2.5, 1.5, Math.cos(a) * 2.5);
      panel.rotation.y = -a;
      this.table.add(panel);

      const bar = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.62, 0.1, 0.03)),
        this.emissive(0x3fb9b2, 0.9),
      );
      bar.position.set(Math.sin(a) * 2.47, 1.45, Math.cos(a) * 2.47);
      bar.rotation.y = -a;
      bar.scale.x = 0.2;
      this.table.add(bar);
      this.readoutBars.push(bar);

      const label = buildLabel(scope, name, 0.6);
      label.position.set(Math.sin(a) * 2.47, 1.72, Math.cos(a) * 2.47);
      label.rotation.y = -a;
      this.table.add(label);
      scope.track(label.geometry);
    });

    // ── resolve ──
    const consoleGroup = buildConsole(scope, 0.62, 0.46, 1.0, metal);
    consoleGroup.position.set(0, 0, -1.4);
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Resolve one turn', 0.62);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Resolve one combat turn',
      description:
        'Runs a single deterministic turn against the void. The same placement always produces the same result, so the table can be argued with.',
      activate: () => this.resolve(),
    });
  }

  private placedCount(): number {
    return this.placed.filter(Boolean).length;
  }

  private resolve(): void {
    if (this.placedCount() === 0) {
      this.ctx.announce('Nothing is on the table. Place at least one piece before resolving.');
      return;
    }
    let incoming = 9;
    const report: string[] = [];
    this.pieces.forEach((piece, i) => {
      if (!this.placed[i]) return;
      const absorbed = Math.min(incoming, piece.shield);
      incoming -= absorbed;
      const damage = Math.max(0, Math.min(incoming, 4));
      incoming -= damage;
      piece.hull = Math.max(0, piece.hull - damage);
      report.push(`${piece.name} absorbed ${absorbed} and took ${damage}, hull ${piece.hull}/${piece.maxHull}`);
    });
    const dealt = this.pieces.reduce((sum, p, i) => sum + (this.placed[i] ? p.attack : 0), 0);
    report.push(`The fleet dealt ${dealt}`);
    if (incoming > 0) report.push(`${incoming} damage reached the station`);
    this.turnResolved = true;
    this.lastReport = report.join('. ') + '.';
    this.ctx.announce(this.lastReport);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 4);

    this.pieceMeshes.forEach((mesh, i) => {
      const target = this.placed[i]
        ? this.slots[i]
        : this.scratchTarget.set(-1.6 + i * 0.5, 1.28, 1.5);
      mesh.position.lerp(target, rate);

      const bar = this.readoutBars[i];
      const fraction = this.pieces[i].hull / this.pieces[i].maxHull;
      bar.scale.x = Math.max(0.02, fraction);
      const m = bar.material as THREE.MeshStandardMaterial;
      m.emissive.setHex(fraction > 0.6 ? 0x7fd67f : fraction > 0.3 ? 0xe8c65a : 0xd9543a);
    });

    // Readouts respond to what is on the table.
    const placed = this.placedCount();
    const totals = [
      placed / this.pieces.length,
      this.pieces.reduce((s, p, i) => s + (this.placed[i] ? p.hull / p.maxHull : 0), 0) / Math.max(1, placed),
      this.turnResolved ? 0.85 : 0.35,
      1 - placed * 0.22,
    ];
    for (let i = 0; i < READOUTS.length; i++) {
      const bar = this.readoutBars[this.pieces.length + i];
      if (!bar) continue;
      const target = Math.max(0.02, Math.min(1, totals[i]));
      bar.scale.x += (target - bar.scale.x) * rate;
    }

    if (!this.reducedMotion) this.table.rotation.y += dt * 0.02;
  }

  protected override onReset(): void {
    this.turnResolved = false;
    this.lastReport = '';
    this.resetPieces();
    for (let i = 0; i < this.placed.length; i++) {
      this.placed[i] = false;
      if (this.pieceMeshes[i]) this.pieceMeshes[i].position.set(-1.6 + i * 0.5, 1.28, 1.5);
    }
    if (this.table) this.table.rotation.set(0, 0, 0);
  }

  protected override describeState(): string {
    const placed = this.placedCount();
    const hull = this.pieces.map((p) => `${p.name} ${p.hull}/${p.maxHull}`).join(', ');
    if (!this.turnResolved) {
      return `${placed} of ${this.pieces.length} fleet pieces are on the table. Hulls: ${hull}. No turn has been resolved.`;
    }
    return `Turn resolved. ${this.lastReport} Hulls: ${hull}.`;
  }
}
