import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E15 — Agent Control & Capability Laboratory. */

interface Candidate {
  readonly name: string;
  readonly evidence: string;
  readonly postcondition: string;
  readonly colour: number;
}

const CANDIDATES: readonly Candidate[] = [
  { name: 'inspect project state', evidence: 'repository metadata + known manifests', postcondition: 'state receipt contains branch and evidence scope', colour: 0x5fd0e8 },
  { name: 'run bounded validation', evidence: 'package script + explicit capability proposal', postcondition: 'registered validator exits successfully', colour: 0x7fd67f },
  { name: 'publish repository', evidence: 'a README mentions deployment', postcondition: 'remote publication changes state', colour: 0xd9543a },
] as const;

const FLOW = ['Scan', 'Candidate', 'Authority', 'Invoke', 'Verify', 'Proof'] as const;

export class AgentHarness extends ExhibitBase {
  private candidates = this.tracked<THREE.Group>();
  private lamps = this.tracked<THREE.Mesh>();
  private selected = 0;
  private authorized = -1;
  private flowStage = -1;
  private rejected = false;
  private pulse!: Pulse;
  private flowCurve!: THREE.CatmullRomCurve3;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.1, -6.4); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(2.9, 0, -4.0); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const metal = this.standard(0x43444d, { roughness: 0.45, metalness: 0.55 });
    const authorityMat = this.standard(0x725f36, { roughness: 0.6, metalness: 0.45 });

    const scanner = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.2, 1.6, 1.0)), metal);
    scanner.position.set(-3.1, 0.8, -4.1); this.group.add(scanner);
    const scannerLabel = buildLabel(scope, 'READ-ONLY SCAN', 1.2); scannerLabel.position.set(-3.1, 1.9, -4.1); this.group.add(scannerLabel); scope.track(scannerLabel.geometry);

    CANDIDATES.forEach((candidate, i) => {
      const g = new THREE.Group(); g.position.set(-1.25 + i * 1.35, 1.35, -4.1); this.group.add(g); this.candidates.push(g);
      const card = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.08, 0.72, 0.12)), this.standard(candidate.colour, { roughness: 0.65 })); g.add(card);
      const label = buildLabel(scope, candidate.name, 0.98); label.position.set(0, 0, 0.08); g.add(label); scope.track(label.geometry);
      const evidence = buildLabel(scope, 'EVIDENCE', 0.6); evidence.position.set(0, -0.53, 0); g.add(evidence); scope.track(evidence.geometry);
      this.control({
        object: g,
        label: `Review capability: ${candidate.name}`,
        description: `Evidence: ${candidate.evidence}. Reviewing a candidate does not authorize it.`,
        activate: () => { this.selected = i; this.rejected = false; this.ctx.announce(`${candidate.name}. Evidence: ${candidate.evidence}. Candidate only — no authority exists yet.`); },
      });
    });

    const authority = buildConsole(scope, 0.78, 0.5, 1.0, authorityMat);
    authority.position.set(2.5, 0, -3.9); this.group.add(authority);
    const authorityLabel = buildLabel(scope, 'AUTHORIZE EXACTLY ONE', 0.86); authorityLabel.position.set(0, 1.02, 0.22); authorityLabel.rotation.x = -Math.PI / 2.1; authority.add(authorityLabel); scope.track(authorityLabel.geometry);
    this.control({
      object: authority,
      label: 'Authorize the selected capability',
      description: 'Creates authority for the exact selected candidate. The scanned repository cannot authorize itself.',
      activate: () => {
        this.authorized = this.selected; this.flowStage = 2; this.rejected = false;
        this.ctx.announce(`Authority created for “${CANDIDATES[this.authorized].name}” only. Other candidates remain unapproved.`);
      },
    });

    const flowPositions = FLOW.map((_, i) => new THREE.Vector3(-3.2 + i * 1.25, 3.15, -5.3));
    FLOW.forEach((name, i) => {
      const lamp = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.075, 10, 8)), this.emissive(0xe8c65a, 0.08));
      lamp.position.copy(flowPositions[i]); this.group.add(lamp); this.lamps.push(lamp);
      const label = buildLabel(scope, name, 0.75); label.position.copy(flowPositions[i]).add(new THREE.Vector3(0, 0.35, 0)); this.group.add(label); scope.track(label.geometry);
    });
    const rail = new Filament(scope, this.scaled(24), 0.018, this.standard(0x75643b, { roughness: 0.65 }));
    this.flowCurve = new THREE.CatmullRomCurve3(flowPositions); rail.follow(this.flowCurve); this.group.add(rail.group);
    this.pulse = new Pulse(scope, 0.09, this.emissive(0xffffff, 1.8)); this.group.add(this.pulse.mesh);

    const invoke = buildConsole(scope, 0.72, 0.48, 1.0, metal);
    invoke.position.set(0, 0, -1.8); this.group.add(invoke);
    const invokeLabel = buildLabel(scope, 'INVOKE SELECTED', 0.72); invokeLabel.position.set(0, 1.02, 0.2); invokeLabel.rotation.x = -Math.PI / 2.1; invoke.add(invokeLabel); scope.track(invokeLabel.geometry);
    this.control({
      object: invoke,
      label: 'Invoke selected capability',
      description: 'Attempts the selected candidate. If its exact capability was not authorized, the rack refuses before invocation.',
      activate: () => this.invokeSelected(),
    });

    const oldHarness = buildLabel(scope, 'PREDECESSORS: Code Harness · OpenCode Harness    persistence remains outside the rack', 4.0);
    oldHarness.position.set(0, 4.35, -6.0); this.group.add(oldHarness); scope.track(oldHarness.geometry);
  }

  private invokeSelected(): void {
    const candidate = CANDIDATES[this.selected];
    if (this.authorized !== this.selected) {
      this.rejected = true; this.flowStage = 2;
      this.ctx.announce(`REFUSED before invocation. “${candidate.name}” is a discovered capability candidate, not an authorized capability.`);
      return;
    }
    this.rejected = false; this.flowStage = 3; this.pulse.start();
    this.ctx.announce(`Invoking “${candidate.name}” under its exact authority. Success will not be claimed until: ${candidate.postcondition}.`);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.pulse.isRunning && this.flowStage >= 3) {
      if (this.pulse.update(dt, this.flowCurve, this.reducedMotion ? 4 : 0.65)) {
        this.flowStage = 5;
        const c = CANDIDATES[this.selected];
        this.ctx.announce(`PROOF. “${c.name}” completed its bounded museum simulation and the declared postcondition verified: ${c.postcondition}.`);
      }
    }
    for (let i = 0; i < this.lamps.length; i++) {
      const mat = this.lamps[i].material as THREE.MeshStandardMaterial;
      const target = i <= this.flowStage ? (this.rejected && i === 2 ? 1.8 : 1.2) : 0.08;
      mat.emissive.setHex(this.rejected && i === 2 ? 0xd9543a : 0xe8c65a);
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 6);
    }
    for (let i = 0; i < this.candidates.length; i++) {
      const target = i === this.selected ? 1.08 : 1;
      const amount = this.reducedMotion ? 1 : Math.min(1, dt * 5);
      const current = this.candidates[i].scale.x;
      this.candidates[i].scale.setScalar(current + (target - current) * amount);
    }
  }

  protected override onReset(): void { this.selected = 0; this.authorized = -1; this.flowStage = -1; this.rejected = false; this.pulse.stop(); }

  protected override describeState(): string {
    const selected = CANDIDATES[this.selected].name;
    const authority = this.authorized >= 0 ? CANDIDATES[this.authorized].name : 'none';
    return `Selected candidate: ${selected}. Authorized capability: ${authority}. ${this.rejected ? 'The last invocation was refused for lack of matching authority.' : this.flowStage === 5 ? 'A proof receipt has verified the declared postcondition.' : 'Repository evidence remains separate from authority.'}`;
  }
}
