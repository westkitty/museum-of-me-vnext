import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E16 — Performance Capture & Media Transformation. */

const STAGES = [
  { name: 'Source motion', colour: 0xcbb39b, note: 'A safe prerecorded performer fixture supplies movement. The museum does not request a camera.' },
  { name: 'PerformanceFrame', colour: 0x63c7e6, note: 'Movement becomes portable performer state rather than durable camera pixels.' },
  { name: 'Character rig', colour: 0x9d8bff, note: 'The same recorded state drives a different authorized character representation.' },
  { name: 'Soft alpha matte', colour: 0x7fd67f, note: 'Continuous alpha preserves soft edges and temporal stability instead of a binary cut.' },
  { name: 'Composite', colour: 0xe8c65a, note: 'Character output and background are combined.' },
  { name: 'Verified artifact', colour: 0xf1e3a2, note: 'Duration, frames, audio and transparency are checked before the export counts.' },
] as const;

const BACKGROUNDS = ['studio', 'night museum', 'transparent'] as const;
const CHARACTERS = ['reference A', 'reference B', 'wireframe'] as const;

export class MediaLineage extends ExhibitBase {
  private stages = this.tracked<THREE.Mesh>();
  private stage = 0;
  private character = 0;
  private background = 0;
  private pulse!: Pulse;
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private travelling = false;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.1, -6.5); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(3.0, 0, -4.2); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const metal = this.standard(0x3f464b, { roughness: 0.45, metalness: 0.5 });
    const railPoints: THREE.Vector3[] = [];
    STAGES.forEach((stage, i) => {
      const x = -3.1 + i * 1.22;
      const mesh = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.92, 1.25, 0.12)), this.standard(stage.colour, { roughness: 0.55 }));
      mesh.position.set(x, 1.55, -4.5); this.group.add(mesh); this.stages.push(mesh);
      const label = buildLabel(scope, stage.name, 0.86); label.position.set(x, 2.45, -4.4); this.group.add(label); scope.track(label.geometry);
      railPoints.push(new THREE.Vector3(x, 3.0, -4.35));
      if (i > 0) {
        const a = railPoints[i - 1]; const b = railPoints[i];
        this.curves.push(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.18, 0)), b]));
      }
    });
    const rail = new Filament(scope, this.scaled(26), 0.018, metal); rail.follow(new THREE.CatmullRomCurve3(railPoints)); this.group.add(rail.group);
    this.pulse = new Pulse(scope, 0.09, this.emissive(0xffffff, 1.8)); this.group.add(this.pulse.mesh);

    const advance = buildConsole(scope, 0.72, 0.48, 1.0, metal); advance.position.set(0, 0, -2.2); this.group.add(advance);
    const advanceLabel = buildLabel(scope, 'ADVANCE PIPELINE', 0.72); advanceLabel.position.set(0, 1.02, 0.2); advanceLabel.rotation.x = -Math.PI / 2.1; advance.add(advanceLabel); scope.track(advanceLabel.geometry);
    this.control({
      object: advance,
      label: 'Advance the performance/media pipeline',
      description: 'Moves the same performance through state capture, character rendering, alpha matting, compositing, and artifact verification.',
      activate: () => {
        if (this.travelling) return;
        if (this.stage >= STAGES.length - 1) { this.stage = 0; this.ctx.announce(`${STAGES[0].name}. ${STAGES[0].note}`); return; }
        this.travelling = true; this.pulse.start();
      },
    });

    const character = buildConsole(scope, 0.62, 0.44, 1.0, metal); character.position.set(-2.25, 0, -1.25); this.group.add(character);
    const characterLabel = buildLabel(scope, 'CHARACTER', 0.62); characterLabel.position.set(0, 1.02, 0.2); characterLabel.rotation.x = -Math.PI / 2.1; character.add(characterLabel); scope.track(characterLabel.geometry);
    this.control({
      object: character,
      label: 'Change character representation',
      description: 'Changes the rendering target while preserving the same captured performance state.',
      activate: () => { this.character = (this.character + 1) % CHARACTERS.length; this.ctx.announce(`Character ${CHARACTERS[this.character]}. The PerformanceFrame did not change.`); },
    });

    const background = buildConsole(scope, 0.62, 0.44, 1.0, metal); background.position.set(2.25, 0, -1.25); this.group.add(background);
    const backgroundLabel = buildLabel(scope, 'BACKGROUND', 0.62); backgroundLabel.position.set(0, 1.02, 0.2); backgroundLabel.rotation.x = -Math.PI / 2.1; background.add(backgroundLabel); scope.track(backgroundLabel.geometry);
    this.control({
      object: background,
      label: 'Change composite background',
      description: 'Changes the background after soft-alpha separation. Transparent output remains an explicit export target.',
      activate: () => { this.background = (this.background + 1) % BACKGROUNDS.length; this.ctx.announce(`Background: ${BACKGROUNDS[this.background]}. Captured motion and character state remain unchanged.`); },
    });

    // Historical app lineage remains visible but secondary.
    const lineage = buildLabel(scope, 'LINEAGE WALL: Guy_Cast → Gay_Cast · He-Maker · Media Getter', 3.7);
    lineage.position.set(0, 4.05, -6.05); this.group.add(lineage); scope.track(lineage.geometry);
    const privacy = buildLabel(scope, 'Museum fixture only · no camera requested · performance state ≠ camera pixels', 3.8);
    privacy.position.set(0, 3.7, -6.05); this.group.add(privacy); scope.track(privacy.geometry);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.travelling && this.pulse.isRunning) {
      const curve = this.curves[Math.min(this.curves.length - 1, this.stage)];
      if (this.pulse.update(dt, curve, this.reducedMotion ? 5 : 1.4)) {
        this.stage = Math.min(STAGES.length - 1, this.stage + 1); this.travelling = false;
        this.ctx.announce(`${STAGES[this.stage].name}. ${STAGES[this.stage].note}`);
      }
    }
    for (let i = 0; i < this.stages.length; i++) {
      const mat = this.stages[i].material as THREE.MeshStandardMaterial;
      const target = i === this.stage ? 1 : 0.55;
      mat.emissive.setHex(STAGES[i].colour); mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
      const lift = i === this.stage ? 0.12 : 0;
      this.stages[i].position.y += ((1.55 + lift) - this.stages[i].position.y) * (this.reducedMotion ? 1 : Math.min(1, dt * 5));
    }
  }

  protected override onReset(): void { this.stage = 0; this.character = 0; this.background = 0; this.travelling = false; this.pulse.stop(); }

  protected override describeState(): string {
    return `Pipeline at ${STAGES[this.stage].name}. Character: ${CHARACTERS[this.character]}. Background: ${BACKGROUNDS[this.background]}. The same performance state survives both presentation changes.`;
  }
}
