import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng } from '../../assets/generators';
import { buildCollectibleSilhouette } from './CollectibleSilhouettes';
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
    const houseCount = this.scaled(26);
    // An authored street layout with four instance batches instead of a
    // separate mesh, geometry and roof material for every miniature house.
    const unitBox = scope.track(new THREE.BoxGeometry(1, 1, 1));
    const houses = new THREE.InstancedMesh(unitBox, this.standard(0xffffff, { roughness: 0.84 }), houseCount);
    const roofs = new THREE.InstancedMesh(
      scope.track(new THREE.ConeGeometry(1, 1, 4)),
      this.standard(0xffffff, { roughness: 0.88 }),
      houseCount,
    );
    const windows = new THREE.InstancedMesh(
      unitBox,
      this.standard(0xf7dfb2, { emissive: 0xe6a56a, emissiveIntensity: 0.26, roughness: 0.48 }),
      houseCount * 2,
    );
    const doors = new THREE.InstancedMesh(
      unitBox,
      this.standard(0x303b43, { roughness: 0.82 }),
      houseCount,
    );
    houses.name = 'smores-town-houses';
    roofs.name = 'smores-town-roofs';
    windows.name = 'smores-town-windows';
    doors.name = 'smores-town-doors';

    const pose = new THREE.Object3D();
    const tint = new THREE.Color();
    const placePart = (
      batch: THREE.InstancedMesh, index: number, x: number, y: number, z: number,
      sx: number, sy: number, sz: number, rotationY = 0,
    ): void => {
      pose.position.set(x, y, z);
      pose.rotation.set(0, rotationY, 0);
      pose.scale.set(sx, sy, sz);
      pose.updateMatrix();
      batch.setMatrixAt(index, pose.matrix);
    };
    const wallColours = [0xb7a48d, 0x9eaa9c, 0xb8a8b0, 0xd1b992, 0x9fbbc0];
    const roofColours = [0x8a5548, 0x6b5858, 0x9b7350, 0x656b76];
    for (let i = 0; i < houseCount; i++) {
      // Exactly the same four RNG draws per house as the original. The
      // collectibles that follow keep their established seeded positions.
      const w = 0.18 + random() * 0.22;
      const h = 0.16 + random() * 0.34;
      const x = (random() - 0.5) * 4.0;
      const z = (random() - 0.5) * 2.8;
      placePart(houses, i, x, h / 2 + 0.03, z, w, h, w * 0.9);
      houses.setColorAt(i, tint.setHex(wallColours[i % wallColours.length]));
      placePart(roofs, i, x, h + 0.08, z, w * 0.8, 0.1, w * 0.8, Math.PI / 4);
      roofs.setColorAt(i, tint.setHex(roofColours[i % roofColours.length]));
      const ww = Math.max(0.044, w * 0.19);
      const wh = Math.max(0.043, h * 0.22);
      for (const side of [-1, 1]) {
        const wi = i * 2 + (side > 0 ? 1 : 0);
        placePart(windows, wi, x + side * w * 0.22, h * 0.65 + 0.03,
          z + w * 0.45 + 0.009, ww, wh, 0.015);
      }
      placePart(doors, i, x, h * 0.20 + 0.03, z + w * 0.45 + 0.012,
        w * 0.21, h * 0.4, 0.018);
    }
    for (const batch of [houses, roofs, windows, doors]) {
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
      batch.computeBoundingSphere();
      this.diorama.add(batch);
      scope.trackObject(batch);
    }

    // Single-batch road paints improve street orientation without adding
    // gameplay surfaces, remote texture fetches or another rendering pass.
    const roadMarks = new THREE.InstancedMesh(
      unitBox,
      this.standard(0xe3d2a9, { roughness: 0.96 }),
      36,
    );
    roadMarks.name = 'smores-town-road-markings';
    let mark = 0;
    for (const z of [-0.9, 0.2, 1.1]) {
      for (let i = 0; i < 6; i++) {
        placePart(roadMarks, mark++, -1.86 + i * 0.68, 0.039, z, 0.24, 0.006, 0.025);
      }
    }
    for (const x of [-1.4, 0.1, 1.5]) {
      for (let i = 0; i < 6; i++) {
        placePart(roadMarks, mark++, x, 0.04, -1.43 + i * 0.55, 0.025, 0.006, 0.20);
      }
    }
    roadMarks.instanceMatrix.needsUpdate = true;
    roadMarks.computeBoundingSphere();
    this.diorama.add(roadMarks);
    scope.trackObject(roadMarks);

    // ── collectibles ──
    const itemGeos = COLLECTIBLES.map((c, tier) => buildCollectibleSilhouette(scope, tier, c.size));
    const itemMaterial = this.standard(0xffffff, { roughness: 0.67, vertexColors: true });
    for (let i = 0; i < this.scaled(ITEM_COUNT); i++) {
      const tier = Math.floor(random() * COLLECTIBLES.length);
      const item = new THREE.Mesh(itemGeos[tier], itemMaterial);
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
    // Distinctive layered S'mores rather than a featureless rolling orb.
    // Child details inherit the exact original ball transform/reset/motion.
    const creamBand = this.standard(0xf2e4c8, { roughness: 0.88 });
    const biscuitBand = this.standard(0xc38b53, { roughness: 0.82 });
    const chocolateBand = this.standard(0x3e251f, { roughness: 0.47 });
    const biscuit = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.80, 0.14, 6, 28)), biscuitBand);
    biscuit.rotation.x = Math.PI / 2;
    const marshmallow = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.79, 0.12, 6, 28)), creamBand);
    marshmallow.rotation.y = Math.PI / 2.4;
    const chocolate = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.92, 0.085, 5, 32)), chocolateBand);
    chocolate.rotation.set(Math.PI / 3, Math.PI / 2.7, 0);
    this.ball.add(biscuit, marshmallow, chocolate);
    this.ball.name = 'smores-layered-katamari-ball';
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
