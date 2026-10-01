import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial, Filament } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E35 — Local Specialist Systems Lab. Tier C.
 *
 * Two laboratory bays with a trust-boundary wall between them. The wall is a
 * physical object because it is the architectural decision both projects are
 * built on: face data and research queries are categories that decide the
 * architecture before any engineering discussion starts.
 *
 * PRIVACY: the face bay uses procedurally generated synthetic faces — no real
 * person's likeness appears. The research bay uses a fabricated investigation
 * about a fictional entity. No real case, target or record is present.
 */

const FACE_OPERATIONS = [
  { name: 'Detect', note: 'Finds a face in a frame. The cheapest operation and the one that runs constantly.' },
  { name: 'Landmark', note: 'Locates features. Everything downstream depends on these points.' },
  { name: 'Analyse', note: 'Derives attributes. This is where the data becomes biometric and the boundary starts to matter.' },
] as const;

/** A fabricated investigation, written for the museum. */
const RESEARCH_STEPS = [
  { name: 'Open the case', note: 'A fictional shell company, invented for this exhibit.', finding: 'Case opened: Northaven Holdings (fictional).' },
  { name: 'Cross-reference', note: 'Local sources only. A hosted tool would log this query, and the query set is itself revealing.', finding: 'Three filings share a registered address.' },
  { name: 'Summarise', note: 'A local model summarises without the source material leaving the machine.', finding: 'Summary produced. Nothing left the host.' },
] as const;

const FACE_POINTS = 24;

export class SpecialistSystems extends ExhibitBase {
  private faceGroup!: THREE.Group;
  private landmarks = this.tracked<THREE.Mesh>();
  private wall!: THREE.Mesh;
  private caseCards = this.tracked<THREE.Mesh>();
  private faceDial!: Dial;
  private faceOp = 0;
  private researchStep = -1;
  private faceSeed = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.6);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.8, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const metal = this.standard(0x4b5748, { roughness: 0.42, metalness: 0.6 });

    // ── the trust-boundary wall, dead centre ──
    this.wall = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(0.22, 3.4, 5.2)),
      scope.track(new THREE.MeshStandardMaterial({
        color: 0x9fd48c, transparent: true, opacity: 0.16,
        roughness: 0.3, side: THREE.DoubleSide,
      })),
    );
    this.wall.position.set(0, 1.7, -4.2);
    this.group.add(this.wall);

    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.16, 3.5, 0.16)), metal);
      post.position.set(0, 1.75, -4.2 + s * 2.55);
      this.group.add(post);
    }

    const wallLabel = buildLabel(scope, 'Trust boundary — nothing crosses', 2.0);
    wallLabel.position.set(0, 3.7, -4.2);
    this.group.add(wallLabel);
    scope.track(wallLabel.geometry);

    // ── left bay: face processing on synthetic faces ──
    const faceBench = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.4, 0.1, 1.4)), metal);
    faceBench.position.set(-2.2, 0.94, -4.2);
    this.group.add(faceBench);

    this.faceGroup = new THREE.Group();
    this.faceGroup.position.set(-2.2, 1.85, -4.2);
    this.group.add(this.faceGroup);

    const head = new THREE.Mesh(
      scope.track(new THREE.SphereGeometry(0.45, 20, 16)),
      this.standard(0xbfa896, { roughness: 0.85 }),
    );
    head.scale.set(0.85, 1, 0.9);
    this.faceGroup.add(head);

    // Landmarks: generated from a seed, so no real likeness is ever involved.
    const random = rng(35035);
    const dotGeo = scope.track(new THREE.SphereGeometry(0.022, 8, 6));
    const dotMat = this.emissive(0x9fd48c, 1.3);
    for (let i = 0; i < this.scaled(FACE_POINTS); i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      const a = random() * Math.PI - Math.PI / 2;
      const b = (random() - 0.5) * 1.4;
      dot.position.set(Math.sin(a) * 0.32, b * 0.6, 0.4 + Math.cos(a) * 0.05);
      dot.visible = false;
      this.faceGroup.add(dot);
      this.landmarks.push(dot);
    }

    const syntheticLabel = buildLabel(scope, 'Synthetic face — generated, not a person', 1.9);
    syntheticLabel.position.set(-2.2, 2.7, -4.2);
    this.group.add(syntheticLabel);
    scope.track(syntheticLabel.geometry);

    const faceConsole = buildConsole(scope, 0.6, 0.46, 1.0, metal);
    faceConsole.position.set(-2.2, 0, -2.2);
    this.group.add(faceConsole);

    this.faceDial = new Dial(scope, FACE_OPERATIONS.length, 0.22, { handle: this.emissive(0x9fd48c, 0.8) });
    this.faceDial.group.position.set(0, 1.04, 0);
    faceConsole.add(this.faceDial.group);

    this.control({
      object: faceConsole,
      label: 'Run the next face operation',
      description:
        'Detect, landmark, analyse. Every face here is procedurally generated — no real likeness is present, and the stack has no outbound network path.',
      activate: () => {
        this.faceOp = this.faceDial.advance();
        this.faceSeed++;
        const op = FACE_OPERATIONS[this.faceOp];
        this.ctx.announce(`${op.name}. ${op.note}`);
      },
    });

    // ── right bay: the fabricated investigation ──
    const caseBench = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.4, 0.1, 1.4)), metal);
    caseBench.position.set(2.2, 0.94, -4.2);
    this.group.add(caseBench);

    RESEARCH_STEPS.forEach((_step, i) => {
      const card = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.6, 0.02, 0.42)),
        this.emissive(0x1e2a1c, 0.15),
      );
      card.position.set(1.5 + i * 0.7, 1.02, -4.2);
      this.group.add(card);
      this.caseCards.push(card);
    });

    const fictionLabel = buildLabel(scope, 'Fictional investigation — no real case data', 1.9);
    fictionLabel.position.set(2.2, 2.2, -4.2);
    this.group.add(fictionLabel);
    scope.track(fictionLabel.geometry);

    const caseConsole = buildConsole(scope, 0.6, 0.46, 1.0, metal);
    caseConsole.position.set(2.2, 0, -2.2);
    this.group.add(caseConsole);

    const caseLabel = buildLabel(scope, 'Advance the case', 0.6);
    caseLabel.position.set(0, 1.02, 0.2);
    caseLabel.rotation.x = -Math.PI / 2.1;
    caseConsole.add(caseLabel);
    scope.track(caseLabel.geometry);

    this.control({
      object: caseConsole,
      label: 'Advance the investigation',
      description:
        'Runs a fabricated case locally. Hosted research tools log queries, and for a sensitive investigation the query set is itself revealing — which is the whole argument for running it here.',
      activate: () => {
        this.researchStep = (this.researchStep + 1) % (RESEARCH_STEPS.length + 1);
        if (this.researchStep >= RESEARCH_STEPS.length) {
          this.researchStep = -1;
          this.ctx.announce('Case closed and cleared. Everything stayed on this machine.');
          return;
        }
        const step = RESEARCH_STEPS[this.researchStep];
        this.ctx.announce(`${step.finding} ${step.note}`);
      },
    });

    // ── the boundary probe: proves nothing crosses ──
    const probe = new Filament(scope, 8, 0.02, this.emissive(0xd9543a, 0.9));
    probe.follow(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.2, 1.9, -4.2),
      new THREE.Vector3(-0.4, 2.0, -4.2),
      new THREE.Vector3(-0.16, 1.9, -4.2),
    ]));
    this.group.add(probe.group);
    this.probe = probe;

    this.control({
      object: this.wall,
      label: 'Test the boundary',
      description:
        'Sends a request at the wall. It stops. Face data and research queries are categories that decide the architecture before any engineering discussion starts.',
      activate: () => {
        this.probeFlash = 1.2;
        this.ctx.announce(
          'The request stops at the wall. Neither bay has an outbound network path, so there is nothing to configure and nothing to misconfigure.',
        );
      },
    });
  }

  private probe!: Filament;
  private probeFlash = 0;

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.faceDial.update(dt, this.reducedMotion);

    // Landmarks appear progressively with the operation.
    // Detect finds the face but marks nothing; landmarking and analysis both
    // show the full point set, and analysis animates it.
    const shown = this.faceOp === 0 ? 0 : this.landmarks.length;
    for (let i = 0; i < this.landmarks.length; i++) {
      this.landmarks[i].visible = i < shown;
      if (this.faceOp === 2 && !this.reducedMotion) {
        this.landmarks[i].scale.setScalar(1 + Math.sin(this.elapsed * 3 + i) * 0.25);
      } else {
        this.landmarks[i].scale.setScalar(1);
      }
    }

    if (!this.reducedMotion) {
      this.faceGroup.rotation.y = Math.sin(this.elapsed * 0.4) * 0.35;
    }

    // Case cards light as the investigation advances.
    for (let i = 0; i < this.caseCards.length; i++) {
      const mat = this.caseCards[i].material as THREE.MeshStandardMaterial;
      const target = i <= this.researchStep ? 1.1 : 0.15;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
      mat.emissive.setHex(i <= this.researchStep ? 0x9fd48c : 0x1e2a1c);
    }

    // The probe recoils off the wall and fades.
    if (this.probeFlash > 0) {
      this.probeFlash = Math.max(0, this.probeFlash - dt * 1.4);
      this.probe.group.visible = true;
      this.probe.group.position.x = -0.1 * Math.sin(this.probeFlash * 12);
    } else {
      this.probe.group.visible = false;
    }
  }

  protected override onReset(): void {
    this.faceOp = 0;
    this.researchStep = -1;
    this.probeFlash = 0;
    if (this.faceDial) {
      this.faceDial.value = 0;
      this.faceDial.update(0, true);
    }
    if (this.faceGroup) this.faceGroup.rotation.set(0, 0, 0);
    for (const dot of this.landmarks) {
      dot.visible = false;
      dot.scale.setScalar(1);
    }
    if (this.probe) {
      this.probe.group.visible = false;
      this.probe.group.position.x = 0;
    }
  }

  protected override describeState(): string {
    const op = FACE_OPERATIONS[this.faceOp];
    const research = this.researchStep < 0
      ? 'The investigation has not been opened.'
      : `The investigation is at step ${this.researchStep + 1}: ${RESEARCH_STEPS[this.researchStep].finding}`;
    return `Face bay: ${op.name.toLowerCase()} on a synthetic generated face. Research bay: ${research} Neither bay has an outbound network path.`;
  }
}
