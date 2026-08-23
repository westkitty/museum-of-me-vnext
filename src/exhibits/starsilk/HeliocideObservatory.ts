import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { fibonacciSphere, rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E08 — Heliocide Observatory. Tier A.
 *
 * A vast window onto the sky, and three telescope stations that see the same
 * event differently. Starting the reconstruction extinguishes stars in canon
 * order until the Siege Wall stands revealed.
 *
 * CANON VISUAL RULE, enforced here in geometry: from an inhabited world the
 * Siege Wall is an ABSENCE — a swath where stars are no longer there. It is
 * never masonry, never a lattice, never a grid. There is deliberately no mesh
 * in this file that could be mistaken for a wall.
 */

const STAR_COUNT = 900;
/** The swath the Wall occupies, in radians of the sky's yaw. */
const WALL_FROM = 0.55;
const WALL_TO = 1.95;

interface Station {
  readonly name: string;
  readonly note: string;
  /** How much of the swath this vantage can see. */
  readonly reveal: number;
}

const STATIONS: readonly Station[] = [
  { name: 'Ground vantage', reveal: 0.45, note: 'From an inhabited world. Only part of the swath is above the horizon; the rest is simply not there.' },
  { name: 'High vantage', reveal: 0.8, note: 'From orbit. More of the absence is visible, and its edges resolve.' },
  { name: 'Far vantage', reveal: 1.0, note: 'From outside the affected volume. The full extent of what was removed.' },
];

export class HeliocideObservatory extends ExhibitBase {
  private sky!: THREE.Group;
  private stars = this.tracked<THREE.Mesh>();
  private starYaw = this.tracked<number>();
  private extinguished = this.tracked<boolean>();
  private stationLamps = this.tracked<THREE.Mesh>();
  private station = 0;
  private running = false;
  private progress = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-4.4, 2.2, -2.0);
    plaque.rotation.y = Math.PI / 2.4;
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(-4.0, 0, -4.6);
    lectern.rotation.y = 0.7;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the observatory window ──
    const frameMat = this.standard(0x2b2544, { roughness: 0.4, metalness: 0.7 });
    const window = new THREE.Mesh(
      scope.track(new THREE.TorusGeometry(3.9, 0.2, 8, 44)),
      frameMat,
    );
    window.position.set(0, 4.4, -7.0);
    this.group.add(window);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const mullion = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.055, 0.055, 7.8, 6)), frameMat);
      mullion.position.set(0, 4.4, -7.0);
      mullion.rotation.z = a;
      this.group.add(mullion);
    }

    // ── the sky ──
    this.sky = new THREE.Group();
    this.sky.position.set(0, 4.4, -7.6);
    this.group.add(this.sky);

    const random = rng(80808);
    const starGeo = scope.track(new THREE.IcosahedronGeometry(0.05, 0));
    // There is no "extinguished" material, deliberately. The canon rule is
    // that the Siege Wall is an absence, so a star that goes out is removed
    // from the sky rather than recoloured.
    const liveMat = this.emissive(0xf0f2ff, 1.5);
    this.liveMaterial = liveMat;

    for (const p of fibonacciSphere(this.scaled(STAR_COUNT), 7.4)) {
      if (p.z > -0.8) continue; // only the cap of sky framed by the window
      const star = new THREE.Mesh(starGeo, liveMat);
      star.position.copy(p);
      star.scale.setScalar(0.5 + random() * 1.4);
      this.sky.add(star);
      this.stars.push(star);
      this.starYaw.push(Math.atan2(p.x, -p.z) + Math.PI);
      this.extinguished.push(false);
    }

    // ── three telescope stations ──
    STATIONS.forEach((station, i) => {
      const at = new THREE.Vector3(-2.6 + i * 2.6, 0, -2.2);
      const mount = new THREE.Group();
      mount.position.copy(at);
      this.group.add(mount);

      const post = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.11, 0.16, 1.25, 12)), frameMat);
      post.position.y = 0.62;
      mount.add(post);

      const barrel = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.17, 0.22, 1.5, 14)), frameMat);
      barrel.position.set(0, 1.45, 0);
      barrel.rotation.x = -1.05;
      mount.add(barrel);

      const eyepiece = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.08, 0.1, 0.28, 12)), frameMat);
      eyepiece.position.set(0, 0.86, 0.62);
      eyepiece.rotation.x = -1.05;
      mount.add(eyepiece);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.06, 10, 8)),
        this.emissive(0xe8c65a, i === 0 ? 1.4 : 0.08),
      );
      lamp.position.set(0, 1.28, 0.3);
      mount.add(lamp);
      this.stationLamps.push(lamp);

      const label = buildLabel(scope, station.name, 0.9);
      label.position.set(0, 2.35, 0);
      mount.add(label);
      scope.track(label.geometry);

      this.control({
        object: mount,
        label: `Look through: ${station.name}`,
        description: station.note,
        activate: () => {
          this.station = i;
          this.stationLamps.forEach((l, li) => {
            (l.material as THREE.MeshStandardMaterial).emissiveIntensity = li === i ? 1.4 : 0.08;
          });
          this.ctx.announce(`${station.name}. ${station.note}`);
        },
      });
    });

    // ── the reconstruction control ──
    const consoleGroup = buildConsole(scope, 0.68, 0.5, 1.0, this.standard(0x322b4d, { roughness: 0.7 }));
    consoleGroup.position.set(3.6, 0, -2.6);
    consoleGroup.rotation.y = -0.5;
    this.group.add(consoleGroup);

    const label = buildLabel(scope, 'Begin reconstruction', 0.66);
    label.position.set(0, 1.02, 0.22);
    label.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(label);
    scope.track(label.geometry);

    this.control({
      object: consoleGroup,
      label: () => (this.running ? 'Restart the reconstruction' : 'Begin the reconstruction'),
      description:
        'Replays the extinction in canon order. What is left is not a structure — it is the shape of what was removed.',
      activate: () => {
        this.running = true;
        this.progress = 0;
        for (let i = 0; i < this.extinguished.length; i++) this.extinguished[i] = false;
        this.ctx.announce('The reconstruction begins. Stars leave the sky in the order canon requires.');
      },
    });
  }

  private liveMaterial!: THREE.Material;

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.running) {
      this.progress = Math.min(1, this.progress + dt * (this.reducedMotion ? 1.2 : 0.16));
      const reveal = STATIONS[this.station].reveal;
      const front = WALL_FROM + (WALL_TO - WALL_FROM) * this.progress * reveal;

      for (let i = 0; i < this.stars.length; i++) {
        if (this.extinguished[i]) continue;
        const yaw = this.starYaw[i];
        if (yaw >= WALL_FROM && yaw <= front) {
          this.extinguished[i] = true;
          // Extinguished: the star is simply not there any more. No object
          // replaces it, because the Wall is an absence.
          this.stars[i].visible = false;
        }
      }

      if (this.progress >= 1) {
        this.running = false;
        const gone = this.extinguished.filter(Boolean).length;
        this.ctx.announce(
          `The reconstruction ends. ${gone} stars are gone from this vantage. What remains between them is the Siege Wall — an absence, not an object.`,
        );
      }
    }

    if (!this.reducedMotion) this.sky.rotation.y += dt * 0.01;
  }

  protected override onReset(): void {
    this.running = false;
    this.progress = 0;
    this.station = 0;
    for (let i = 0; i < this.stars.length; i++) {
      this.extinguished[i] = false;
      this.stars[i].visible = true;
      this.stars[i].material = this.liveMaterial;
    }
    this.stationLamps.forEach((l, li) => {
      (l.material as THREE.MeshStandardMaterial).emissiveIntensity = li === 0 ? 1.4 : 0.08;
    });
    if (this.sky) this.sky.rotation.set(0, 0, 0);
  }

  protected override describeState(): string {
    const station = STATIONS[this.station];
    const gone = this.extinguished.filter(Boolean).length;
    if (!this.running && gone === 0) {
      return `Watching from the ${station.name.toLowerCase()}. The sky is whole. ${station.note}`;
    }
    if (this.running) {
      return `The reconstruction is running from the ${station.name.toLowerCase()}. ${gone} stars have gone out so far.`;
    }
    return `From the ${station.name.toLowerCase()}, ${gone} stars are missing. The gap they leave is the Siege Wall — an absence in the sky, not a structure in it.`;
  }
}
