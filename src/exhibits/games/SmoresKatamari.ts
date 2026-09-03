import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E32 — S'mores Katamari. Tier A.
 *
 * A miniature neighbourhood diorama with one short playable level: roll,
 * collect, grow. The town is a compressed version of a real place, which is the
 * design problem the project actually solved — real distances are boring at
 * play speed, but a town that loses its shape stops being recognisable.
 *
 * The compression ratio is stated on the diorama, because it is the interesting
 * part.
 */

interface Collectible {
  readonly size: number;
  readonly name: string;
}

const COLLECTIBLES: readonly Collectible[] = [
  { size: 0.05, name: 'bottle caps' },
  { size: 0.09, name: 'garden gnomes' },
  { size: 0.16, name: 'mailboxes' },
  { size: 0.28, name: 'parked cars' },
  { size: 0.48, name: 'sheds' },
];

const ITEM_COUNT = 54;
const PATH_STEPS = 160;

export class SmoresKatamari extends ExhibitBase {
  private diorama!: THREE.Group;
  private ball!: THREE.Mesh;
  private items = this.tracked<THREE.Mesh>();
  private itemTier = this.tracked<number>();
  private collected = this.tracked<boolean>();
  private homes = this.tracked<THREE.Vector3>();
  private radius = 0.06;
  private rolling = false;
  private t = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.3, -7.3);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.5, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x6b4a30, { roughness: 0.72 });

    // ── the diorama table ──
    const table = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5.0, 0.12, 4.0)), wood);
    table.position.set(0, 0.88, -4.2);
    this.group.add(table);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.16, 0.88, 0.16)), wood);
        leg.position.set(sx * 2.2, 0.44, -4.2 + sz * 1.7);
        this.group.add(leg);
      }
    }

    this.diorama = new THREE.Group();
    this.diorama.position.set(0, 0.94, -4.2);
    this.group.add(this.diorama);

    // ── the town: streets, blocks, water ──
    const ground = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(4.6, 0.03, 3.6)),
      this.standard(0x4a6a48, { roughness: 0.95 }),
    );
    this.diorama.add(ground);

    const roadMat = this.standard(0x3a3a3c, { roughness: 0.9 });
    for (const z of [-0.9, 0.2, 1.1]) {
      const road = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.5, 0.02, 0.26)), roadMat);
      road.position.set(0, 0.025, z);
      this.diorama.add(road);
    }
    for (const x of [-1.4, 0.1, 1.5]) {
      const road = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.26, 0.02, 3.5)), roadMat);
      road.position.set(x, 0.025, 0);
      this.diorama.add(road);
    }

    const water = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(4.5, 0.02, 0.6)),
      this.emissive(0x2a5a7a, 0.2),
    );
    water.position.set(0, 0.026, -1.5);
    this.diorama.add(water);

    const random = rng(32032);
    const buildingMat = this.standard(0x9a8a7a, { roughness: 0.85 });
    for (let i = 0; i < this.scaled(26); i++) {
      const w = 0.18 + random() * 0.22;
      const h = 0.16 + random() * 0.34;
      const building = new THREE.Mesh(scope.track(new THREE.BoxGeometry(w, h, w * 0.9)), buildingMat);
      building.position.set((random() - 0.5) * 4.0, h / 2 + 0.03, (random() - 0.5) * 2.8);
      this.diorama.add(building);

      const roof = new THREE.Mesh(scope.track(new THREE.ConeGeometry(w * 0.8, 0.1, 4)), this.standard(0x7a4a3a, { roughness: 0.9 }));
      roof.position.set(building.position.x, h + 0.08, building.position.z);
      roof.rotation.y = Math.PI / 4;
      this.diorama.add(roof);
    }

    // ── collectibles ──
    const itemGeos = COLLECTIBLES.map((c) => scope.track(new THREE.IcosahedronGeometry(c.size, 0)));
    const itemMats = COLLECTIBLES.map((_c, i) =>
      this.standard([0xe8c65a, 0xd97a4e, 0x5fb0e8, 0x9d8bff, 0x7fd67f][i], { roughness: 0.6 }),
    );
    for (let i = 0; i < this.scaled(ITEM_COUNT); i++) {
      const tier = Math.floor(random() * COLLECTIBLES.length);
      const item = new THREE.Mesh(itemGeos[tier], itemMats[tier]);
      const home = new THREE.Vector3(
        (random() - 0.5) * 4.2,
        COLLECTIBLES[tier].size + 0.03,
        (random() - 0.5) * 3.0,
      );
      item.position.copy(home);
      this.diorama.add(item);
      this.items.push(item);
      this.itemTier.push(tier);
      this.collected.push(false);
      this.homes.push(home);
    }

    // ── the ball ──
    this.ball = new THREE.Mesh(
      scope.track(new THREE.IcosahedronGeometry(1, 2)),
      this.standard(0x8a5a3a, { roughness: 0.75 }),
    );
    this.ball.scale.setScalar(this.radius);
    this.ball.position.set(-2.0, this.radius + 0.03, 1.3);
    this.diorama.add(this.ball);

    // ── the compression note ──
    const note = buildLabel(scope, 'The town is real. The distances are not — compressed about eight to one.', 3.4);
    note.position.set(0, 1.5, -2.0);
    this.diorama.add(note);
    scope.track(note.geometry);

    // ── control ──
    const consoleGroup = buildConsole(scope, 0.66, 0.48, 1.0, wood);
    consoleGroup.position.set(0, 0, -1.6);
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Roll', 0.5);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Roll the ball',
      description:
        'One short self-contained level: roll through the town, pick up anything smaller than you are, and watch what becomes collectible as you grow.',
      activate: () => {
        this.rolling = !this.rolling;
        this.ctx.announce(
          this.rolling
            ? 'Rolling. Anything smaller than the ball sticks to it.'
            : `Stopped at ${(this.radius * 100).toFixed(0)} centimetres across, having collected ${this.collectedCount()} things.`,
        );
      },
    });
  }

  private collectedCount(): number {
    return this.collected.filter(Boolean).length;
  }

  /** A fixed figure-eight through the town, so the level is the same every time. */
  private pathAt(t: number): THREE.Vector3 {
    const a = t * Math.PI * 2;
    return new THREE.Vector3(Math.sin(a) * 1.8, 0, Math.sin(a * 2) * 1.25);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.rolling && !this.reducedMotion) {
      this.t = (this.t + dt / (PATH_STEPS / 60)) % 1;
    } else if (this.rolling && this.reducedMotion) {
      this.t = (this.t + dt * 0.12) % 1;
    }

    const target = this.pathAt(this.t);
    this.ball.position.set(target.x, this.radius + 0.03, target.z);
    if (!this.reducedMotion && this.rolling) {
      this.ball.rotation.x += dt * 2.4;
      this.ball.rotation.z += dt * 1.7;
    }

    if (this.rolling) {
      for (let i = 0; i < this.items.length; i++) {
        if (this.collected[i]) continue;
        const item = this.items[i];
        const size = COLLECTIBLES[this.itemTier[i]].size;
        // Only things smaller than the ball can be picked up.
        if (size > this.radius * 0.85) continue;
        const distance = item.position.distanceTo(this.ball.position);
        if (distance < this.radius + size + 0.03) {
          this.collected[i] = true;
          this.radius = Math.min(0.62, this.radius + size * 0.32);
          const tier = COLLECTIBLES[this.itemTier[i]];
          if (this.collectedCount() % 8 === 0) {
            this.ctx.announce(
              `${(this.radius * 100).toFixed(0)} centimetres across. ${tier.name} are within reach now.`,
            );
          }
        }
      }
    }

    // Collected items ride on the ball.
    for (let i = 0; i < this.items.length; i++) {
      if (!this.collected[i]) continue;
      const item = this.items[i];
      const a = i * 2.4 + this.elapsed * (this.reducedMotion ? 0 : 0.8);
      item.position.set(
        this.ball.position.x + Math.sin(a) * this.radius * 0.9,
        this.ball.position.y + Math.cos(a * 1.3) * this.radius * 0.9,
        this.ball.position.z + Math.cos(a) * this.radius * 0.9,
      );
    }

    this.ball.scale.setScalar(this.radius);
  }

  protected override onReset(): void {
    this.rolling = false;
    this.t = 0;
    this.radius = 0.06;
    for (let i = 0; i < this.items.length; i++) {
      this.collected[i] = false;
      this.items[i].position.copy(this.homes[i]);
    }
    if (this.ball) {
      this.ball.scale.setScalar(this.radius);
      this.ball.position.set(-2.0, this.radius + 0.03, 1.3);
      this.ball.rotation.set(0, 0, 0);
    }
  }

  protected override describeState(): string {
    const reachable = COLLECTIBLES.filter((c) => c.size <= this.radius * 0.85).map((c) => c.name);
    const size = `${(this.radius * 100).toFixed(0)} centimetres across`;
    if (!this.rolling && this.collectedCount() === 0) {
      return `The ball sits at the edge of the town, ${size}. Only ${reachable.join(' and ') || 'nothing yet'} can be picked up at this size.`;
    }
    return `${this.rolling ? 'Rolling' : 'Stopped'} at ${size}, having collected ${this.collectedCount()} of ${this.items.length} things. Within reach: ${reachable.join(', ') || 'nothing'}.`;
  }
}
