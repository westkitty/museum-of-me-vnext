import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel, updateLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { fibonacciSphere, rng } from '../../assets/generators';
import {
  HELIOCIDE_EVIDENCE, evidenceLoss, reconstructedLoss, reconstructionRecordIndex,
  type HeliocideEvidence,
} from './heliocideEvidence';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E08 — Heliocide Observatory / Witness Chain.
 *
 * Six independently accessible historical records reveal a causal chain:
 * terraformings -> propaganda -> siege -> Starsilk breach -> heliocide -> absence.
 * The visitor may inspect them in any order or run a quiet reconstruction.
 *
 * Canon lock: to an inhabited observer the Siege Wall is absent starlight,
 * NEVER masonry, a mesh wall, or a luminous black-hole grid. Nothing appears
 * in the gap when the record advances. The reference sky is the evidence.
 *
 * All geometry is exhibit-scoped, with one instanced star array, no extra
 * lights, no frame loop, no collision change, no added asset/network load.
 */

interface Station {
  readonly name: string;
  readonly note: string;
  readonly reveal: number;
}

const STATIONS: readonly Station[] = [
  {
    name: 'Ground',
    note: 'From an inhabited world the horizon limits how much of the missing sky can be observed.',
    reveal: 0.45,
  },
  {
    name: 'Orbit',
    note: 'Above the atmosphere the direction of the absence becomes harder to dismiss.',
    reveal: 0.8,
  },
  {
    name: 'Beyond',
    note: 'Outside the affected viewing volume the full reconstructed swath can be compared with its previous sky.',
    reveal: 1,
  },
];

const STAR_COUNT = 900;
// A central *observational gap*. This is not a physical model of the Wall.
const GAP_FROM = -0.73;
const GAP_TO = 0.73;
const RECONSTRUCTION_SECONDS = 18;

export class HeliocideObservatory extends ExhibitBase {
  private sky!: THREE.Group;
  private stars!: THREE.InstancedMesh;
  private readonly starPositions = this.tracked<THREE.Vector3>();
  private readonly starBearings = this.tracked<number>();
  private readonly starSizes = this.tracked<number>();
  private readonly stationLamps = this.tracked<THREE.Mesh>();
  private readonly recordLamps = this.tracked<THREE.Mesh>();
  private readout!: THREE.Mesh;

  private station = 0;
  private record = 0;
  private running = false;
  private progress = 0;
  private lastAppliedLoss = -1;
  private lastAppliedStation = -1;

  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;
    this.station = 0;
    this.record = 0;
    this.running = false;
    this.progress = 0;
    this.lastAppliedLoss = -1;
    this.lastAppliedStation = -1;

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

    // A framed observation aperture, not a physical boundary or a painting.
    const frameMat = this.standard(0x242631, { roughness: 0.43, metalness: 0.68 });
    const windowFrame = new THREE.Mesh(
      scope.track(new THREE.TorusGeometry(3.9, 0.18, 8, 52)),
      frameMat,
    );
    windowFrame.name = 'witness-aperture';
    windowFrame.position.set(0, 4.4, -7);
    this.group.add(windowFrame);

    // Nothing fills the frame. Stars only. When a star is gone, no replacement
    // object, glow or ominous boundary is drawn into its former position.
    this.sky = new THREE.Group();
    this.sky.name = 'witness-sky';
    this.sky.position.set(0, 4.4, -7.65);
    this.group.add(this.sky);

    const random = rng(80808);
    const points = fibonacciSphere(this.scaled(STAR_COUNT), 7.4)
      .filter((point) => point.z < -0.8);
    for (const point of points) {
      this.starPositions.push(point);
      this.starBearings.push(Math.atan2(point.x, -point.z));
      this.starSizes.push(0.46 + random() * 1.45);
    }

    this.stars = new THREE.InstancedMesh(
      scope.track(new THREE.IcosahedronGeometry(0.05, 0)),
      this.emissive(0xe0e9ff, 1.24),
      points.length,
    );
    this.stars.name = 'observatory-starfield-instanced';
    this.stars.frustumCulled = false;
    this.sky.add(this.stars);

    // An unobtrusive instrument readout. It names the observation, not the
    // history; the evidence is found by touching the physical record objects.
    this.readout = buildLabel(scope, 'STARS PRESENT', 3.5);
    this.readout.name = 'observatory-reading';
    this.readout.position.set(0, 8.0, -6.8);
    this.group.add(this.readout);
    scope.track(this.readout.geometry);

    this.buildStations(frameMat);
    this.buildRecords();

    const consoleGroup = buildConsole(
      scope, 0.92, 0.62, 1.08,
      this.standard(0x262932, { roughness: 0.77, metalness: 0.2 }),
    );
    consoleGroup.position.set(4.35, 0, -2.65);
    consoleGroup.rotation.y = -0.42;
    consoleGroup.name = 'witness-reconstruction-console';
    this.group.add(consoleGroup);
    const consoleLabel = buildLabel(scope, 'RECONSTRUCT', 1.25);
    consoleLabel.position.set(0, 1.16, 0.15);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: () => (this.running ? 'Restart the six-record reconstruction' : 'Reconstruct the cause of the missing sky'),
      description: 'Replay the six confirmed historical records. The sky remains intact until the containment decision. No extra object is drawn when it disappears.',
      activate: () => this.startReconstruction(),
    });

    this.highlightRecords();
    this.applySky(0, true);
  }

  private buildStations(material: THREE.Material): void {
    const scope = this.ctx.scope;
    const postGeometry = scope.track(new THREE.CylinderGeometry(0.12, 0.16, 1.25, 12));
    const tubeGeometry = scope.track(new THREE.CylinderGeometry(0.17, 0.22, 1.5, 14));

    STATIONS.forEach((station, index) => {
      const mount = new THREE.Group();
      mount.name = 'witness-vantage:' + station.name.toLowerCase();
      mount.position.set(-2.6 + index * 2.6, 0, -2.2);
      this.group.add(mount);

      const post = new THREE.Mesh(postGeometry, material);
      post.position.y = 0.62;
      mount.add(post);

      const barrel = new THREE.Mesh(tubeGeometry, material);
      barrel.position.set(0, 1.45, 0);
      barrel.rotation.x = -1.05;
      mount.add(barrel);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.065, 8, 6)),
        this.emissive(0xcbd9ed, index === 0 ? 1.3 : 0.12),
      );
      lamp.position.set(0, 1.25, 0.32);
      mount.add(lamp);
      this.stationLamps.push(lamp);

      const label = buildLabel(scope, station.name, 0.95);
      label.position.set(0, 2.35, 0);
      mount.add(label);
      scope.track(label.geometry);

      this.control({
        object: mount,
        label: 'Observe from ' + station.name,
        description: station.note,
        activate: () => {
          this.station = index;
          this.highlightStations();
          this.applySky(this.running ? reconstructedLoss(this.progress) : evidenceLoss(this.record), true);
          this.ctx.announce(station.name + ' vantage. ' + station.note);
        },
      });
    });
  }

  private buildRecords(): void {
    const scope = this.ctx.scope;
    const stone = this.standard(0x242832, { roughness: 0.82, metalness: 0.14 });
    const baseGeometry = scope.track(new THREE.BoxGeometry(0.89, 0.72, 0.65));
    const faceGeometry = scope.track(new THREE.BoxGeometry(0.7, 0.085, 0.48));

    HELIOCIDE_EVIDENCE.forEach((record, index) => {
      const witness = new THREE.Group();
      witness.name = 'witness-record:' + record.id;
      witness.position.set(-5.15 + index * 2.06, 0, 0.85);
      this.group.add(witness);

      const body = new THREE.Mesh(baseGeometry, stone);
      body.position.y = 0.36;
      witness.add(body);

      const activeMaterial = this.emissive(
        index === 1 ? 0xa74e46 : index >= 3 ? 0x6a9cc5 : 0x8e99a6,
        index === 0 ? 1.35 : 0.16,
      );
      const face = new THREE.Mesh(faceGeometry, activeMaterial);
      face.name = 'witness-record-signal:' + record.id;
      face.position.y = 0.75;
      witness.add(face);
      this.recordLamps.push(face);

      this.buildEvidenceShape(witness, record);
      const label = buildLabel(scope, record.label, 1.55);
      label.position.set(0, 1.93, 0);
      witness.add(label);
      scope.track(label.geometry);

      const eraLabel = buildLabel(scope, record.era, 1.45);
      eraLabel.position.set(0, 2.34, 0);
      witness.add(eraLabel);
      scope.track(eraLabel.geometry);

      this.control({
        object: witness,
        label: 'Examine ' + record.era + ': ' + record.label,
        description: record.finding + ' ' + record.question,
        activate: () => this.selectRecord(index),
      });
    });
  }

  /** Six distinct physical evidence shapes. The final frame remains empty. */
  private buildEvidenceShape(parent: THREE.Group, evidence: HeliocideEvidence): void {
    const scope = this.ctx.scope;
    const metal = this.standard(0x72869a, { roughness: 0.4, metalness: 0.63 });
    const azure = this.emissive(0x73afdc, 0.48);
    const red = this.standard(0x933b39, { roughness: 0.25, metalness: 0.17 });

    const object = new THREE.Group();
    object.name = 'witness-evidence:' + evidence.id;
    object.position.y = 1.24;
    parent.add(object);

    switch (evidence.shape) {
      case 'signal':
        for (let n = 0; n < 3; n++) {
          const bar = new THREE.Mesh(
            scope.track(new THREE.BoxGeometry(0.09, 0.25 + n * 0.16, 0.09)),
            metal,
          );
          bar.position.x = (n - 1) * 0.22;
          object.add(bar);
        }
        break;
      case 'ring': {
        // A Blood Ring is red glass propaganda. It is NOT the Siege Wall.
        const orbit = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.3, 0.06, 8, 28)), red);
        orbit.rotation.x = 0.75;
        object.add(orbit);
        break;
      }
      case 'siege': {
        const left = new THREE.Mesh(scope.track(new THREE.TetrahedronGeometry(0.24)), metal);
        left.position.x = -0.18;
        const right = new THREE.Mesh(scope.track(new THREE.TetrahedronGeometry(0.2)), metal);
        right.position.x = 0.22;
        right.rotation.y = 0.7;
        object.add(left, right);
        break;
      }
      case 'breach':
        for (const offset of [-0.13, 0.13]) {
          const strand = new THREE.Mesh(
            scope.track(new THREE.BoxGeometry(0.07, 0.6, 0.055)),
            azure,
          );
          strand.position.x = offset;
          object.add(strand);
        }
        break;
      case 'stars':
        for (const [n, point] of [[0, -0.32], [1, 0], [2, 0.29]] as const) {
          const star = new THREE.Mesh(
            scope.track(new THREE.IcosahedronGeometry(n === 1 ? 0.19 : 0.12, 0)), azure,
          );
          star.position.set(point, n === 1 ? 0.18 : -0.04, 0);
          object.add(star);
        }
        break;
      case 'absence':
        // Deliberately blank: giving this record a visible "wall" would
        // reverse the canonical fact of absence.
        break;
    }
  }

  private selectRecord(index: number): void {
    this.running = false;
    this.record = index;
    this.progress = index / HELIOCIDE_EVIDENCE.length;
    this.highlightRecords();
    this.applySky(evidenceLoss(index), true);

    const evidence = HELIOCIDE_EVIDENCE[index];
    this.ctx.announce(evidence.era + '. ' + evidence.finding + ' ' + evidence.question);
  }

  private startReconstruction(): void {
    if (this.reducedMotion) {
      // Knowledge never requires motion. Instant deterministic final state.
      this.selectRecord(HELIOCIDE_EVIDENCE.length - 1);
      return;
    }
    this.running = true;
    this.progress = 0;
    this.record = 0;
    this.sky.rotation.y = 0;
    this.highlightRecords();
    this.applySky(0, true);
    this.ctx.announce('The witness chain begins at the first fringe strikes. Examine a record at any time to take control of the reconstruction.');
  }

  private highlightStations(): void {
    this.stationLamps.forEach((lamp, index) => {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity =
        index === this.station ? 1.3 : 0.12;
    });
  }

  private highlightRecords(): void {
    this.recordLamps.forEach((lamp, index) => {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity =
        index === this.record ? 1.35 : 0.16;
    });
    if (this.readout) {
      const status = this.record <= 3 ? 'STARS PRESENT'
        : this.record === 4 ? 'STARS REMOVED' : 'ABSENCE';
      updateLabel(this.ctx.scope, this.readout, status);
    }
  }

  /**
   * Sky animation only changes an instance matrix when the qualitative
   * aperture sample changes. No per-star materials, timer or extra draw calls.
   */
  private applySky(loss: number, force = false): void {
    if (!this.stars) return;
    const bounded = Math.max(0, Math.min(1, loss));
    const sample = Math.round(bounded * 96) / 96;
    if (!force && sample === this.lastAppliedLoss && this.lastAppliedStation === this.station) return;
    this.lastAppliedLoss = sample;
    this.lastAppliedStation = this.station;

    const visibleExtent = sample * STATIONS[this.station].reveal;
    const front = GAP_FROM + (GAP_TO - GAP_FROM) * visibleExtent;

    for (let index = 0; index < this.starPositions.length; index++) {
      const gone = visibleExtent > 0
        && this.starBearings[index] >= GAP_FROM
        && this.starBearings[index] <= front;
      this.scale.setScalar(gone ? 0 : this.starSizes[index]);
      this.position.copy(this.starPositions[index]);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.stars.setMatrixAt(index, this.matrix);
    }
    this.stars.instanceMatrix.needsUpdate = true;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (!this.running) {
      // The pre-event sky barely moves; the post-event sky does not move.
      // Stillness is the observation, not an animation budget to fill.
      if (!this.reducedMotion && this.record < 4) this.sky.rotation.y += dt * 0.004;
      return;
    }

    this.progress = Math.min(1, this.progress + dt / RECONSTRUCTION_SECONDS);
    const index = reconstructionRecordIndex(this.progress);
    if (index !== this.record) {
      this.record = index;
      this.highlightRecords();
      const item = HELIOCIDE_EVIDENCE[index];
      this.ctx.announce(item.era + '. ' + item.finding);
    }
    this.applySky(reconstructedLoss(this.progress));
    if (this.progress >= 1) {
      this.running = false;
      this.record = HELIOCIDE_EVIDENCE.length - 1;
      this.highlightRecords();
      this.applySky(1, true);
      this.ctx.announce('Reconstruction complete. Nothing has replaced the stars. What you see is the absence left by the Siege Wall.');
    }
  }

  protected override onReset(): void {
    this.running = false;
    this.progress = 0;
    this.record = 0;
    this.station = 0;
    if (this.sky) this.sky.rotation.set(0, 0, 0);
    this.highlightStations();
    this.highlightRecords();
    this.applySky(0, true);
  }

  protected override describeState(): string {
    const evidence = HELIOCIDE_EVIDENCE[this.record];
    const vantage = STATIONS[this.station];
    const mode = this.running ? 'Reconstruction running. ' : 'Reconstruction paused. ';
    return mode + evidence.era + ': ' + evidence.finding
      + ' Viewing from ' + vantage.name.toLowerCase() + '. ' + vantage.note;
  }
}
