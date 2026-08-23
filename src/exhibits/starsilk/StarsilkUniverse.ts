import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Filament, Dial, buildConsole, buildNode } from '../parts';
import { fibonacciSphere, rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E01 — Starsilk Universe. Tier A landmark.
 *
 * A suspended celestial loom. Four fundamental threads run through it; pulling
 * one changes the weave and the consequences propagate visibly through the star
 * field and the world miniatures below. That propagation is the whole point:
 * the setting's premise is that its physics are programmable, so the exhibit
 * lets a visitor reprogram them and watch the cosmology answer.
 */

/** The four threads a visitor can actually pull. */
const THREADS = [
  { key: 'starsilk', label: 'Starsilk', colour: 0x9d8bff, effect: 'the weave itself' },
  { key: 'codec', label: 'The Codec', colour: 0x5fd0e8, effect: 'what may be written into it' },
  { key: 'starbinding', label: 'The Starbinding', colour: 0xe86f5f, effect: 'what was spent to bind it' },
  { key: 'drakken', label: 'The Drakken', colour: 0x7fd67f, effect: 'what was made to work it' },
] as const;

const TENSION_NAMES = ['slack', 'held', 'drawn taut'] as const;
const STAR_COUNT = 260;
const WORLDS = ['Virgil', 'Meridian', 'Syrin', 'The Administration', 'Tiger'] as const;

export class StarsilkUniverse extends ExhibitBase {
  private tensions = [1, 1, 1, 1];
  private loom!: THREE.Group;
  private stars!: THREE.InstancedMesh;
  private starBase = this.tracked<THREE.Vector3>();
  private filaments = this.tracked<Filament>();
  private dials = this.tracked<Dial>();
  private worlds = this.tracked<THREE.Mesh>();
  private lastChanged = -1;

  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly quaternion = new THREE.Quaternion();

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const record = this.ctx.record;
    const scope = this.ctx.scope;

    // ── interpretation ──
    const plaque = buildPlaque(scope, record);
    plaque.position.set(0, 2.3, -7.3);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, record, this.ctx.projects);
    lectern.position.set(3.4, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the loom ──
    this.loom = new THREE.Group();
    this.loom.position.set(0, 0, -1.2);
    this.group.add(this.loom);

    const frameMat = this.standard(0x2b2544, { roughness: 0.4, metalness: 0.7 });
    const ring = new THREE.Mesh(scope.track(new THREE.TorusGeometry(3.6, 0.11, 8, 64)), frameMat);
    ring.position.y = 5.2;
    ring.rotation.x = Math.PI / 2;
    this.loom.add(ring);

    const lowerRing = new THREE.Mesh(scope.track(new THREE.TorusGeometry(2.3, 0.07, 6, 48)), frameMat);
    lowerRing.position.y = 2.1;
    lowerRing.rotation.x = Math.PI / 2;
    this.loom.add(lowerRing);

    // Suspension from the bay ceiling — the loom must read as hanging.
    // The north wing's bayHeight is 9 m; a 6 m cable centred at y=8.2 spanned
    // [5.2, 11.2], poking 2.2 m through the media/infra floor above (the
    // exact failure layout.ts's own bayHeight comment describes). Run from
    // the top ring (y=5.2) up to just under the ceiling instead.
    const cableMat = this.standard(0x3a3358, { roughness: 0.6 });
    const cableTop = 8.7;
    const cableBottom = 5.2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cable = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(0.03, 0.03, cableTop - cableBottom, 5)),
        cableMat,
      );
      cable.position.set(Math.sin(a) * 3.6, (cableTop + cableBottom) / 2, Math.cos(a) * 3.6);
      this.loom.add(cable);
    }

    // ── the four threads ──
    const segments = this.scaled(30);
    for (const thread of THREADS) {
      const mat = this.emissive(thread.colour, 1.1);
      const filament = new Filament(scope, segments, 0.035, mat);
      this.loom.add(filament.group);
      this.filaments.push(filament);
    }

    // ── star field ──
    this.starBase = fibonacciSphere(this.scaled(STAR_COUNT), 3.1).map((p) =>
      p.setY(p.y * 0.55 + 4.4),
    );
    const starMat = this.emissive(0xdfe3ff, 0.85);
    this.stars = new THREE.InstancedMesh(
      scope.track(new THREE.IcosahedronGeometry(0.045, 0)),
      starMat,
      this.starBase.length,
    );
    this.loom.add(this.stars);

    // ── world miniatures beneath the loom ──
    const random = rng(20260819);
    WORLDS.forEach((name, i) => {
      const a = (i / WORLDS.length) * Math.PI * 2;
      const radius = 0.16 + random() * 0.14;
      const world = buildNode(scope, radius, this.standard(0x6b5fa8, { roughness: 0.5, metalness: 0.25 }));
      world.position.set(Math.sin(a) * 1.9, 1.35, Math.cos(a) * 1.9);
      this.loom.add(world);
      this.worlds.push(world);

      const label = buildLabel(scope, name, 0.7);
      label.position.set(Math.sin(a) * 1.9, 1.02, Math.cos(a) * 1.9);
      label.rotation.y = a;
      this.loom.add(label);
      scope.track(label.geometry);
    });

    // Engraved floor diagram — the relationships, read from directly beneath.
    const diagram = new THREE.Mesh(
      scope.track(new THREE.RingGeometry(1.5, 4.2, 48, 1)),
      this.standard(0x2a2340, { roughness: 0.95 }),
    );
    diagram.rotation.x = -Math.PI / 2;
    diagram.position.set(0, 0.03, -1.2);
    this.group.add(diagram);

    // ── controls: one console per thread, arranged so the visitor walks the ring ──
    THREADS.forEach((thread, i) => {
      const a = (i / THREADS.length) * Math.PI * 2 + Math.PI / 4;
      const consoleGroup = buildConsole(scope, 0.62, 0.46, 1.02, this.standard(0x322b4d, { roughness: 0.7 }));
      consoleGroup.position.set(Math.sin(a) * 5.2, 0, Math.cos(a) * 5.2 - 1.2);
      consoleGroup.rotation.y = a + Math.PI;
      this.group.add(consoleGroup);

      const dial = new Dial(scope, TENSION_NAMES.length, 0.22, {
        handle: this.emissive(thread.colour, 0.8),
      });
      dial.value = this.tensions[i];
      dial.group.position.set(0, 1.04, 0);
      consoleGroup.add(dial.group);
      this.dials.push(dial);

      const label = buildLabel(scope, thread.label, 0.56);
      label.position.set(0, 1.06, 0.24);
      label.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(label);
      scope.track(label.geometry);

      this.control({
        object: dial.group,
        label: `Pull the ${thread.label} thread`,
        description: `Changes ${thread.effect}. The weave, the stars and the worlds all answer.`,
        activate: () => {
          this.tensions[i] = (this.tensions[i] + 1) % TENSION_NAMES.length;
          dial.value = this.tensions[i];
          this.lastChanged = i;
          this.ctx.announce(
            `${thread.label} is now ${TENSION_NAMES[this.tensions[i]]}. ${this.consequence(i)}`,
          );
        },
      });
    });

    this.applyWeave(true);
  }

  /** Rebuild the thread curves and the star field from the current tensions. */
  private applyWeave(instant: boolean): void {
    const t = this.elapsed;
    THREADS.forEach((_thread, i) => {
      const tension = this.tensions[i];
      const a = (i / THREADS.length) * Math.PI * 2;
      // Slack threads bow outward and hang low; taut threads run straight and high.
      const bow = 1.5 - tension * 0.6;
      const drop = 1.4 - tension * 0.45;
      const sway = this.reducedMotion ? 0 : Math.sin(t * 0.35 + i) * 0.12 * (2 - tension);

      const points = [
        new THREE.Vector3(Math.sin(a) * 3.55, 5.2, Math.cos(a) * 3.55),
        new THREE.Vector3(Math.sin(a + 0.5) * 3.0 * bow + sway, 4.4 - drop * 0.4, Math.cos(a + 0.5) * 3.0 * bow),
        new THREE.Vector3(Math.sin(a + 1.5) * 1.6 * bow, 3.4 - drop, Math.cos(a + 1.5) * 1.6 * bow + sway),
        new THREE.Vector3(Math.sin(a + 2.6) * 2.2 * bow, 2.5 - drop * 0.5, Math.cos(a + 2.6) * 2.2 * bow),
        new THREE.Vector3(Math.sin(a + Math.PI) * 2.3, 2.1, Math.cos(a + Math.PI) * 2.3),
      ];
      this.filaments[i].follow(new THREE.CatmullRomCurve3(points));
    });

    // Consequence: the star field contracts, spreads or shears with the weave.
    const total = this.tensions.reduce((s, v) => s + v, 0) / (THREADS.length * (TENSION_NAMES.length - 1));
    const spread = 0.78 + total * 0.42;
    const shear = (this.tensions[2] - 1) * 0.22;
    for (let i = 0; i < this.starBase.length; i++) {
      const base = this.starBase[i];
      this.position.set(
        base.x * spread + (base.y - 4.4) * shear,
        4.4 + (base.y - 4.4) * (0.6 + total * 0.7),
        base.z * spread,
      );
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.stars.setMatrixAt(i, this.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;

    // The worlds rise and fall with the Drakken thread — what works the world.
    const lift = 1.2 + this.tensions[3] * 0.28;
    this.worlds.forEach((world, i) => {
      world.position.y = lift + (instant ? 0 : Math.sin(i) * 0.02);
      const s = 0.75 + this.tensions[0] * 0.25;
      world.scale.setScalar(s);
    });
  }

  private consequence(index: number): string {
    switch (index) {
      case 0: return this.tensions[0] === 0
        ? 'The weave slackens and the worlds shrink toward it.'
        : 'The weave draws in and the worlds hold their shape.';
      case 1: return 'The field of what can be written widens.';
      case 2: return this.tensions[2] === 2
        ? 'The sky shears: the cost of the binding is visible in the stars.'
        : 'The shear in the star field eases.';
      default: return 'The worlds lift as the Drakken take up the work.';
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    for (const dial of this.dials) dial.update(dt);
    if (!this.reducedMotion) {
      this.loom.rotation.y += dt * 0.035;
      this.applyWeave(false);
    } else if (this.lastChanged >= 0) {
      this.applyWeave(true);
      this.lastChanged = -1;
    }
  }

  protected override onReset(): void {
    this.tensions = [1, 1, 1, 1];
    this.dials.forEach((d, i) => {
      d.value = this.tensions[i];
      d.update(0, true);
    });
    if (this.loom) this.loom.rotation.y = 0;
    if (this.stars) this.applyWeave(true);
    this.lastChanged = -1;
  }

  protected override describeState(): string {
    const parts = THREADS.map((t, i) => `${t.label} is ${TENSION_NAMES[this.tensions[i]]}`);
    return `The loom hangs above you. ${parts.join('; ')}.`;
  }
}
