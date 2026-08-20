import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E03 — Orbital Tomb. Tier A.
 *
 * A section of Meridian Station intersects the gallery, and a dial moves it
 * through the six months of its dismantling. The visitor can walk inside the
 * fragment while the timeline runs, which is the point: this is not an
 * explosion seen from outside, it is a slow disassembly experienced from within.
 */

interface Month {
  readonly label: string;
  readonly note: string;
  /** Fraction of the structure still attached. */
  readonly intact: number;
  readonly drift: number;
}

const MONTHS: readonly Month[] = [
  { label: 'Month Zero', intact: 1.0, drift: 0, note: 'Meridian Station, whole, in high orbit over Virgil.' },
  { label: 'Month One', intact: 0.92, drift: 0.4, note: 'The outer plating is taken first. Nothing is torn; it is removed.' },
  { label: 'Month Two', intact: 0.76, drift: 1.1, note: 'The ribs are exposed. The station is still pressurised in places.' },
  { label: 'Month Three', intact: 0.55, drift: 2.2, note: 'Halfway. From inside, the sky is visible through the frame.' },
  { label: 'Month Four', intact: 0.38, drift: 3.6, note: 'The spine is cut into sections and each is carried away separately.' },
  { label: 'Month Five', intact: 0.2, drift: 5.2, note: 'What remains reads as anatomy rather than architecture.' },
  { label: 'Month Six', intact: 0.06, drift: 7.4, note: 'A held shape in the dark, and the debris field that records it.' },
];

const PLATE_COUNT = 46;

export class OrbitalTomb extends ExhibitBase {
  private station!: THREE.Group;
  private plates = this.tracked<THREE.Mesh>();
  private homes = this.tracked<THREE.Vector3>();
  private drifts = this.tracked<THREE.Vector3>();
  private dial!: Dial;
  private monthLabel!: THREE.Mesh;
  private month = 0;
  private blend = 0;

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
    lectern.position.set(3.4, 0, -4.4);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the station fragment: a cylindrical hull the visitor can walk into ──
    this.station = new THREE.Group();
    this.station.position.set(0, 2.6, -3.6);
    this.station.rotation.z = 0.22;
    this.group.add(this.station);

    const spineMat = this.standard(0x585264, { roughness: 0.55, metalness: 0.6 });
    const plateMat = this.standard(0x6e6878, { roughness: 0.42, metalness: 0.72 });
    const innerMat = this.emissive(0x4a6f8a, 0.25);

    // Spine.
    const spine = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.42, 0.42, 8.4, 12)), spineMat);
    spine.rotation.z = Math.PI / 2;
    this.station.add(spine);

    // Ribs — the frame that stays visible longest.
    for (let i = 0; i < this.scaled(9); i++) {
      const rib = new THREE.Mesh(scope.track(new THREE.TorusGeometry(1.7, 0.07, 6, 20)), spineMat);
      rib.position.x = -3.8 + i * 0.95;
      rib.rotation.y = Math.PI / 2;
      this.station.add(rib);
    }

    // Interior deck, so the inside is a place rather than a void.
    const deck = new THREE.Mesh(scope.track(new THREE.BoxGeometry(7.6, 0.08, 2.2)), innerMat);
    deck.position.y = -0.8;
    this.station.add(deck);

    // Hull plating — this is what the dismantling removes.
    const random = rng(30620);
    const plateGeo = scope.track(new THREE.BoxGeometry(0.85, 0.12, 1.0));
    for (let i = 0; i < this.scaled(PLATE_COUNT); i++) {
      const a = random() * Math.PI * 2;
      const x = -3.9 + random() * 7.8;
      const home = new THREE.Vector3(x, Math.sin(a) * 1.72, Math.cos(a) * 1.72);
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.copy(home);
      plate.rotation.set(a, 0, 0);
      plate.lookAt(new THREE.Vector3(x, 0, 0));
      this.station.add(plate);
      this.plates.push(plate);
      this.homes.push(home);
      // Each plate drifts on its own vector — carried away, not blown off.
      this.drifts.push(
        new THREE.Vector3(
          (random() - 0.5) * 1.4,
          Math.sin(a) * (1.4 + random()),
          Math.cos(a) * (1.4 + random()),
        ),
      );
    }

    // Virgil, below and enormous.
    const virgil = new THREE.Mesh(
      scope.track(new THREE.SphereGeometry(9, 32, 24)),
      this.standard(0x2c3f52, { roughness: 0.95 }),
    );
    virgil.position.set(0, -9.6, -6.5);
    this.group.add(virgil);

    const virgilLabel = buildLabel(scope, 'Virgil', 0.9);
    virgilLabel.position.set(3.6, 0.6, -6.2);
    this.group.add(virgilLabel);
    scope.track(virgilLabel.geometry);

    // ── the dismantling clock ──
    const consoleGroup = buildConsole(scope, 0.72, 0.5, 1.0, this.standard(0x322b4d, { roughness: 0.7 }));
    consoleGroup.position.set(-3.6, 0, -1.6);
    consoleGroup.rotation.y = 0.6;
    this.group.add(consoleGroup);

    this.dial = new Dial(scope, MONTHS.length, 0.26, { handle: this.emissive(0xe8c65a, 0.8) });
    this.dial.group.position.set(0, 1.04, 0);
    consoleGroup.add(this.dial.group);

    this.monthLabel = buildLabel(scope, MONTHS[0].label, 0.72);
    this.monthLabel.position.set(0, 1.02, 0.24);
    this.monthLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(this.monthLabel);
    scope.track(this.monthLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Turn the dismantling clock',
      description:
        'Moves the station from Month Zero to Month Six. Every production of this project — the song, the story, the visuals, the tour — shares this one timeline.',
      activate: () => {
        this.month = this.dial.advance();
        this.ctx.announce(`${MONTHS[this.month].label}. ${MONTHS[this.month].note}`);
      },
    });
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt);

    const month = MONTHS[this.month];
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 2.4);
    this.blend += (1 - this.blend) * rate;

    const intact = month.intact;
    const drift = month.drift;
    for (let i = 0; i < this.plates.length; i++) {
      const plate = this.plates[i];
      const home = this.homes[i];
      const attached = i / this.plates.length < intact;
      const target = attached
        ? home
        : home.clone().addScaledVector(this.drifts[i], drift);
      plate.position.lerp(target, this.reducedMotion ? 1 : Math.min(1, dt * 1.8));
      plate.visible = attached || drift < 8;
      if (!attached && !this.reducedMotion) {
        plate.rotation.x += dt * 0.12;
        plate.rotation.z += dt * 0.07;
      }
    }

    if (!this.reducedMotion) this.station.rotation.y += dt * 0.02;
  }

  protected override onReset(): void {
    this.month = 0;
    this.blend = 0;
    if (this.dial) {
      this.dial.value = 0;
      this.dial.update(0, true);
    }
    if (this.station) this.station.rotation.set(0, 0, 0.22);
    for (let i = 0; i < this.plates.length; i++) {
      this.plates[i].position.copy(this.homes[i]);
      this.plates[i].visible = true;
      this.plates[i].rotation.set(0, 0, 0);
      this.plates[i].lookAt(new THREE.Vector3(this.homes[i].x, 0, 0));
    }
  }

  protected override describeState(): string {
    const month = MONTHS[this.month];
    return `The dismantling clock reads ${month.label}. ${month.note}`;
  }
}
