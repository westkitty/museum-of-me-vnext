import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E27 — The Full Weasel. Tier C.
 *
 * A mechanical puzzle cabinet with three linked mechanisms, each escalating the
 * result of the last. Small footprint, strong personality — which is exactly
 * what the game is.
 *
 * It is also the only finished, shipped artifact in this collection, so the
 * cabinet says so.
 */

const MECHANISMS = [
  { name: 'Wind the crank', result: 'The first treat drops.', escalation: 1 },
  { name: 'Release the catch', result: 'Three more follow, and a shark appears.', escalation: 3 },
  { name: 'Pull the lever', result: 'The party meter fills and the finale starts.', escalation: 9 },
] as const;

export class FullWeasel extends ExhibitBase {
  private cabinet!: THREE.Group;
  private crank!: THREE.Mesh;
  private catchArm!: THREE.Mesh;
  private lever!: THREE.Mesh;
  private treats = this.tracked<THREE.Mesh>();
  private meter!: THREE.Mesh;
  private projection!: THREE.Mesh;
  private stage = 0;
  private spin = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -6.6);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(2.7, 0, -4.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x7a4a2c, { roughness: 0.7 });
    const brass = this.standard(0xb9822c, { roughness: 0.3, metalness: 0.78 });

    // ── the cabinet: deliberately small ──
    this.cabinet = new THREE.Group();
    this.cabinet.position.set(0, 0, -3.6);
    this.group.add(this.cabinet);

    const body = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.5, 2.1, 0.9)), wood);
    body.position.y = 1.05;
    this.cabinet.add(body);

    const glass = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(1.15, 1.0, 0.04)),
      scope.track(new THREE.MeshStandardMaterial({
        color: 0xcfe2f0, transparent: true, opacity: 0.2, roughness: 0.05,
      })),
    );
    glass.position.set(0, 1.42, 0.47);
    this.cabinet.add(glass);

    // ── three mechanisms ──
    this.crank = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.32, 0.05, 0.05)), brass);
    this.crank.position.set(-0.45, 0.72, 0.5);
    this.cabinet.add(this.crank);

    this.catchArm = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.05, 0.28, 0.05)), brass);
    this.catchArm.position.set(0, 0.72, 0.5);
    this.cabinet.add(this.catchArm);

    this.lever = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.028, 0.034, 0.34, 8)), brass);
    this.lever.position.set(0.45, 0.85, 0.5);
    this.cabinet.add(this.lever);

    // ── the treats that fall ──
    const treatGeo = scope.track(new THREE.SphereGeometry(0.05, 8, 6));
    const treatMat = this.emissive(0xe8c65a, 0.7);
    for (let i = 0; i < this.scaled(13); i++) {
      const treat = new THREE.Mesh(treatGeo, treatMat);
      treat.position.set(-0.5 + (i % 5) * 0.25, 1.85, 0.1 + Math.floor(i / 5) * 0.1);
      treat.visible = false;
      this.cabinet.add(treat);
      this.treats.push(treat);
    }

    // ── the party meter ──
    const meterFrame = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.1, 0.14, 0.05)), brass);
    meterFrame.position.set(0, 0.98, 0.48);
    this.cabinet.add(meterFrame);

    this.meter = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(1.0, 0.08, 0.03)),
      this.emissive(0xd9543a, 1.0),
    );
    this.meter.position.set(-0.5, 0.98, 0.5);
    this.meter.scale.x = 0.001;
    this.cabinet.add(this.meter);

    // ── the plaque that says it is finished ──
    const finished = buildLabel(scope, 'Finished. Shipped. Playable.', 1.4);
    finished.position.set(0, 2.5, 0.46);
    this.cabinet.add(finished);
    scope.track(finished.geometry);

    // The cabinet remains the interpretive object layer. The adjacent screen
    // is the explicit doorway into the real, locally bundled finished game.
    this.projection = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(2.8, 1.56)),
      this.emissive(0xffb347, 0.85),
    );
    this.projection.position.set(0, 2.9, -4.75);
    this.group.add(this.projection);
    const projectionLabel = buildLabel(scope, 'FULL WEASEL // PLAY LOCAL BUILD', 1.5);
    projectionLabel.position.set(0, 3.9, -4.7);
    this.group.add(projectionLabel);
    scope.track(projectionLabel.geometry);
    this.control({
      object: this.projection,
      label: 'Play the finished Full Weasel',
      description: 'Open the complete locally bundled Full Weasel rhythm game. Escape or Close returns to the museum.',
      activate: () => {
        this.ctx.openEmbeddedExperience?.('full-weasel');
        this.ctx.announce('Opening the complete local Full Weasel build. Escape or Close returns to the museum.');
      },
    });

    MECHANISMS.forEach((mech, i) => {
      const handle = [this.crank, this.catchArm, this.lever][i];
      this.control({
        object: handle,
        label: mech.name,
        description: `${mech.result} Each mechanism escalates the last — three linked movements and it is over, which is the whole game.`,
        activate: () => this.pull(i),
      });
    });
  }

  private pull(index: number): void {
    if (index !== this.stage) {
      this.ctx.announce(
        index < this.stage
          ? `${MECHANISMS[index].name} has already been used. Reset the cabinet to run it again.`
          : `That mechanism is not free yet. ${MECHANISMS[this.stage].name} first.`,
      );
      return;
    }
    this.stage++;
    this.spin = 1.2;
    const mech = MECHANISMS[index];
    this.ctx.announce(
      this.stage === MECHANISMS.length
        ? `${mech.result} The cabinet has run its whole sequence — a small thing, complete.`
        : `${mech.result}`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.spin > 0) {
      this.spin -= dt;
      if (!this.reducedMotion) {
        this.crank.rotation.z += dt * 8;
        this.catchArm.rotation.x = Math.sin(this.elapsed * 14) * 0.3;
        this.lever.rotation.x = -0.4 + Math.sin(this.elapsed * 10) * 0.2;
      }
    }

    let shown = 0;
    for (let i = 0; i < this.stage; i++) shown += MECHANISMS[i].escalation;
    for (let i = 0; i < this.treats.length; i++) {
      const visible = i < shown;
      this.treats[i].visible = visible;
      if (visible && !this.reducedMotion) {
        this.treats[i].position.y = 0.55 + Math.abs(Math.sin(this.elapsed * 2 + i)) * 0.35;
      }
    }

    const fraction = this.stage / MECHANISMS.length;
    this.meter.scale.x += (Math.max(0.001, fraction) - this.meter.scale.x) * Math.min(1, dt * 4);
    this.meter.position.x = -0.5 + (1.0 * this.meter.scale.x) / 2;
    const mm = this.meter.material as THREE.MeshStandardMaterial;
    mm.emissive.setHex(fraction >= 1 ? 0x7fd67f : fraction > 0.5 ? 0xe8c65a : 0xd9543a);
  }

  protected override onReset(): void {
    this.stage = 0;
    this.spin = 0;
    for (const treat of this.treats) treat.visible = false;
    if (this.crank) this.crank.rotation.set(0, 0, 0);
    if (this.catchArm) this.catchArm.rotation.set(0, 0, 0);
    if (this.lever) this.lever.rotation.set(0, 0, 0);
    if (this.meter) {
      this.meter.scale.x = 0.001;
      this.meter.position.x = -0.5;
    }
  }

  protected override describeState(): string {
    if (this.stage === 0) return 'The cabinet is wound down. Three mechanisms wait, and they must be used in order.';
    if (this.stage >= MECHANISMS.length) {
      return 'All three mechanisms have run and the party meter is full. The cabinet has completed its sequence.';
    }
    return `${this.stage} of ${MECHANISMS.length} mechanisms used. Next: ${MECHANISMS[this.stage].name}.`;
  }
}
