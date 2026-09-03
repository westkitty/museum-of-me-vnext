import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E30 — AetherVFX.
 * The current platform is represented as a semantic ability sequence with
 * persistent world mutation and undo, not merely as a particle fader box.
 */

const STAGES = [
  { name: 'Telegraph', colour: 0x5fd0e8, note: 'A surface-conforming warning declares where the ability will act.' },
  { name: 'Travel', colour: 0x9d8bff, note: 'The effect moves through deterministic simulation time.' },
  { name: 'Impact', colour: 0xf0b06c, note: 'The committed hit becomes an authoritative event.' },
  { name: 'Field', colour: 0xd97a4e, note: 'A bounded active field continues after impact.' },
  { name: 'Residue', colour: 0x6f5145, note: 'Persistent aftermath becomes world state rather than disposable decoration.' },
] as const;

const RESIDUES = [
  { name: 'scorch', colour: 0x3b231c },
  { name: 'frost', colour: 0x83c8ee },
  { name: 'crystal', colour: 0x9d8bff },
] as const;

export class AetherVFX extends ExhibitBase {
  private stage = -1;
  private travelling = false;
  private residueKind = 0;
  private residues = this.tracked<THREE.Mesh>();
  private stageNodes = this.tracked<THREE.Mesh>();
  private pulse!: Pulse;
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private floor!: THREE.Mesh;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.2, -7.2); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(3.3, 0, -4.7); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const frame = this.standard(0x3a3f44, { roughness: 0.4, metalness: 0.6 });
    this.floor = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 40)), this.standard(0x252b30, { roughness: 0.9 }));
    this.floor.position.set(0, 0.08, -4.1); this.group.add(this.floor);

    const points: THREE.Vector3[] = [];
    STAGES.forEach((stage, i) => {
      const a = -1.05 + i * 0.52;
      const p = new THREE.Vector3(Math.sin(a) * 2.2, 1.35 + Math.cos(i) * 0.14, -4.1 + Math.cos(a) * 1.55);
      points.push(p);
      const node = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.18, 1)), this.emissive(stage.colour, 0.18));
      node.position.copy(p); this.group.add(node); this.stageNodes.push(node);
      const label = buildLabel(scope, stage.name, 0.8); label.position.copy(p).add(new THREE.Vector3(0, 0.45, 0)); this.group.add(label); scope.track(label.geometry);
      if (i > 0) {
        const prev = points[i - 1];
        this.curves.push(new THREE.CatmullRomCurve3([prev, prev.clone().lerp(p, 0.5).add(new THREE.Vector3(0, 0.35, 0)), p]));
      }
    });
    const rail = new Filament(scope, this.scaled(30), 0.025, frame); rail.follow(new THREE.CatmullRomCurve3(points)); this.group.add(rail.group);
    this.pulse = new Pulse(scope, 0.12, this.emissive(0xffffff, 2)); this.group.add(this.pulse.mesh);

    // Pre-allocate a bounded residue budget. Mutations reuse these meshes.
    for (let i = 0; i < 6; i++) {
      const residue = new THREE.Mesh(
        scope.track(new THREE.CircleGeometry(0.34 + i * 0.025, 20)),
        this.standard(RESIDUES[0].colour, { roughness: 0.95 }),
      );
      const a = (i / 6) * Math.PI * 2;
      residue.position.set(Math.sin(a) * 1.15, 0.151, -4.1 + Math.cos(a) * 1.0);
      residue.rotation.x = -Math.PI / 2; residue.visible = false;
      this.group.add(residue); this.residues.push(residue);
    }

    const cast = buildConsole(scope, 0.7, 0.48, 1.0, frame); cast.position.set(-2.0, 0, -1.6); this.group.add(cast);
    const castLabel = buildLabel(scope, 'CAST / ADVANCE', 0.68); castLabel.position.set(0, 1.02, 0.2); castLabel.rotation.x = -Math.PI / 2.1; cast.add(castLabel); scope.track(castLabel.geometry);
    this.control({
      object: cast,
      label: 'Cast or advance the semantic ability',
      description: 'Runs telegraph, travel, impact, field and residue as distinct deterministic stages. The final stage commits persistent aftermath.',
      activate: () => this.advance(),
    });

    const residue = buildConsole(scope, 0.64, 0.44, 1.0, frame); residue.position.set(0, 0, -1.35); this.group.add(residue);
    const residueLabel = buildLabel(scope, 'RESIDUE TYPE', 0.62); residueLabel.position.set(0, 1.02, 0.2); residueLabel.rotation.x = -Math.PI / 2.1; residue.add(residueLabel); scope.track(residueLabel.geometry);
    this.control({
      object: residue,
      label: 'Change persistent aftermath type',
      description: 'Cycles museum-safe examples of the platform’s persistent world-mutation vocabulary.',
      activate: () => {
        this.residueKind = (this.residueKind + 1) % RESIDUES.length;
        this.ctx.announce(`Residue target: ${RESIDUES[this.residueKind].name}. The semantic sequence remains unchanged; only its declared aftermath changes.`);
      },
    });

    const undo = buildConsole(scope, 0.7, 0.48, 1.0, frame); undo.position.set(2.0, 0, -1.6); this.group.add(undo);
    const undoLabel = buildLabel(scope, 'UNDO MUTATION', 0.68); undoLabel.position.set(0, 1.02, 0.2); undoLabel.rotation.x = -Math.PI / 2.1; undo.add(undoLabel); scope.track(undoLabel.geometry);
    this.control({
      object: undo,
      label: 'Undo the persistent aftermath',
      description: 'Reverts the museum simulation’s mutation transaction without pretending the visual residue was merely a particle that expired.',
      activate: () => {
        const visible = this.residues.filter((r) => r.visible);
        if (visible.length === 0) { this.ctx.announce('Nothing to undo. No persistent mutation is currently committed.'); return; }
        visible[visible.length - 1].visible = false;
        this.ctx.announce(`Undo committed. One ${RESIDUES[this.residueKind].name} aftermath transaction was removed and the prior world state restored.`);
      },
    });

    const semantic = buildLabel(scope, 'telegraph → travel → impact → field → residue    mutation is state, not decoration', 4.1);
    semantic.position.set(0, 4.25, -6.2); this.group.add(semantic); scope.track(semantic.geometry);
  }

  private advance(): void {
    if (this.travelling) return;
    if (this.stage >= STAGES.length - 1) {
      this.stage = -1;
      this.ctx.announce('Sequence reset. Telegraph is ready for another deterministic cast.');
      return;
    }
    if (this.stage < 0) {
      this.stage = 0; this.ctx.announce(`${STAGES[0].name}. ${STAGES[0].note}`); return;
    }
    this.travelling = true; this.pulse.start();
  }

  private commitResidue(): void {
    const slot = this.residues.find((r) => !r.visible) ?? this.residues[0];
    const kind = RESIDUES[this.residueKind];
    (slot.material as THREE.MeshStandardMaterial).color.setHex(kind.colour);
    slot.visible = true;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.travelling && this.pulse.isRunning) {
      const curve = this.curves[Math.min(this.curves.length - 1, this.stage)];
      if (this.pulse.update(dt, curve, this.reducedMotion ? 5 : 1.3)) {
        this.stage = Math.min(STAGES.length - 1, this.stage + 1); this.travelling = false;
        if (this.stage === STAGES.length - 1) this.commitResidue();
        this.ctx.announce(`${STAGES[this.stage].name}. ${STAGES[this.stage].note}${this.stage === STAGES.length - 1 ? ` Committed ${RESIDUES[this.residueKind].name} aftermath.` : ''}`);
      }
    }
    for (let i = 0; i < this.stageNodes.length; i++) {
      const mat = this.stageNodes[i].material as THREE.MeshStandardMaterial;
      const target = i <= this.stage ? 1.4 : 0.18;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 6);
      if (!this.reducedMotion && i === this.stage) this.stageNodes[i].rotation.y += dt * 0.8;
    }
  }

  protected override onReset(): void {
    this.stage = -1; this.travelling = false; this.residueKind = 0; this.pulse.stop();
    for (const r of this.residues) r.visible = false;
    for (const n of this.stageNodes) (n.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.18;
  }

  protected override describeState(): string {
    const committed = this.residues.filter((r) => r.visible).length;
    return `${this.stage < 0 ? 'No ability is active' : `Ability at ${STAGES[this.stage].name}`}. Residue target: ${RESIDUES[this.residueKind].name}. ${committed} persistent mutation${committed === 1 ? '' : 's'} committed; undo is available.`;
  }
}
