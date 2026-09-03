import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E14 — Promptcraft & Vibe Coding. Tier B.
 *
 * A prompt assembly machine. Blocks slot in and the scene beyond the glass
 * changes to match — deterministically, with no external service involved.
 *
 * Description blocks and constraint blocks are physically different shapes, and
 * the machine will not run without at least one constraint, because the
 * reusable part of a prompt is the constraint list rather than the description.
 */

type BlockKind = 'subject' | 'style' | 'constraint';

interface PromptBlock {
  readonly label: string;
  readonly kind: BlockKind;
  readonly note: string;
  readonly colour: number;
}

const BLOCKS: readonly PromptBlock[] = [
  { label: 'A tower', kind: 'subject', colour: 0x5fb0e8, note: 'The subject. Easy to write, easy to replace.' },
  { label: 'At dusk', kind: 'style', colour: 0xe8c65a, note: 'Style. Moves the output, but not as reliably as people expect.' },
  { label: 'Wide framing', kind: 'style', colour: 0xcb9f47, note: 'Composition. Structure moves generative output more than adjectives do.' },
  { label: 'No people', kind: 'constraint', colour: 0xd9543a, note: 'A negative constraint. This is the part that is hardest to reconstruct from memory, and the part worth storing.' },
  { label: 'No text', kind: 'constraint', colour: 0xd97a4e, note: 'Another constraint. Stored with the template, never remembered separately.' },
];

export class Promptcraft extends ExhibitBase {
  private slots = this.tracked<THREE.Vector3>();
  private blocks = this.tracked<THREE.Group>();
  private homes = this.tracked<THREE.Vector3>();
  private inserted = this.tracked<boolean>();
  private scene!: THREE.Group;
  private sceneParts = this.tracked<THREE.Mesh>();
  private ran = false;

  /** Reused every frame; allocating these per element churned the heap. */
  private readonly scratchScale = new THREE.Vector3();
  private static readonly DAY = new THREE.Color(0x4a4030);
  private static readonly DUSK = new THREE.Color(0x3a2c3a);

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.1, -6.4);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(2.8, 0, -4.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const brass = this.standard(0xb9822c, { roughness: 0.35, metalness: 0.72 });
    const wood = this.standard(0x755c3d, { roughness: 0.75 });

    // ── the machine ──
    const body = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.6, 1.5, 1.0)), wood);
    body.position.set(-1.2, 0.75, -4.2);
    this.group.add(body);

    // Five slots, shaped by kind: rounded for description, square for constraint.
    BLOCKS.forEach((block, i) => {
      const x = -2.2 + i * 0.5;
      const slot = new THREE.Vector3(x, 1.56, -4.0);
      this.slots.push(slot);
      this.inserted.push(false);

      const socket = new THREE.Mesh(
        scope.track(
          block.kind === 'constraint'
            ? new THREE.BoxGeometry(0.34, 0.06, 0.3)
            : new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16),
        ),
        brass,
      );
      socket.position.set(x, 1.5, -4.0);
      this.group.add(socket);

      const g = new THREE.Group();
      const home = new THREE.Vector3(-2.2 + i * 0.5, 1.05, -2.6);
      g.position.copy(home);
      this.group.add(g);
      this.blocks.push(g);
      this.homes.push(home);

      const shape = new THREE.Mesh(
        scope.track(
          block.kind === 'constraint'
            ? new THREE.BoxGeometry(0.3, 0.14, 0.26)
            : new THREE.CylinderGeometry(0.15, 0.15, 0.14, 16),
        ),
        this.standard(block.colour, { roughness: 0.5, metalness: 0.25 }),
      );
      g.add(shape);

      const label = buildLabel(scope, block.label, 0.46);
      label.position.set(0, 0.2, 0);
      g.add(label);
      scope.track(label.geometry);

      this.control({
        object: g,
        label: () => (this.inserted[i] ? `Remove: ${block.label}` : `Insert: ${block.label}`),
        description: `${block.note} ${block.kind === 'constraint' ? 'Constraint blocks are square and the machine will not run without one.' : 'Description blocks are round.'}`,
        activate: () => {
          this.inserted[i] = !this.inserted[i];
          this.ran = false;
          this.ctx.announce(`${block.label} ${this.inserted[i] ? 'inserted' : 'removed'}. ${block.note}`);
        },
      });
    });

    // ── the rendered scene beyond the glass ──
    const glassFrame = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.8, 2.0, 0.08)), brass);
    glassFrame.position.set(2.0, 1.8, -5.4);
    this.group.add(glassFrame);

    this.scene = new THREE.Group();
    this.scene.position.set(2.0, 1.3, -5.8);
    this.group.add(this.scene);

    const random = rng(14014);
    const ground = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(2.2, 0.05, 1.2)),
      this.standard(0x4a4030, { roughness: 0.95 }),
    );
    this.scene.add(ground);
    this.sceneParts.push(ground);

    const tower = new THREE.Mesh(
      scope.track(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 10)),
      this.standard(0x8a8276, { roughness: 0.85 }),
    );
    tower.position.y = 0.58;
    tower.visible = false;
    this.scene.add(tower);
    this.sceneParts.push(tower);

    for (let i = 0; i < this.scaled(4); i++) {
      const figure = new THREE.Mesh(
        scope.track(new THREE.CapsuleGeometry(0.04, 0.12, 4, 8)),
        this.standard(0xd6c9ab, { roughness: 0.8 }),
      );
      figure.position.set((random() - 0.5) * 1.6, 0.13, (random() - 0.5) * 0.8);
      this.scene.add(figure);
      this.sceneParts.push(figure);
    }

    // ── the run control ──
    const consoleGroup = buildConsole(scope, 0.6, 0.44, 1.0, wood);
    consoleGroup.position.set(-1.2, 0, -2.2);
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Run the machine', 0.6);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Run the machine',
      description:
        'Assembles the inserted blocks and renders the result. Entirely deterministic and entirely local — no external generation service is involved.',
      activate: () => this.run(),
    });
  }

  private constraintCount(): number {
    let n = 0;
    for (let i = 0; i < BLOCKS.length; i++) {
      if (this.inserted[i] && BLOCKS[i].kind === 'constraint') n++;
    }
    return n;
  }

  private run(): void {
    if (this.constraintCount() === 0) {
      this.ctx.announce(
        'The machine will not run. No constraint block is inserted, and a prompt without its constraint list is the part that does not survive reuse.',
      );
      return;
    }
    this.ran = true;
    const inserted = BLOCKS.filter((_b, i) => this.inserted[i]).map((b) => b.label);
    this.ctx.announce(`Run: ${inserted.join(', ')}. The scene beyond the glass answers.`);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 5);
    for (let i = 0; i < this.blocks.length; i++) {
      const target = this.inserted[i] ? this.slots[i] : this.homes[i];
      this.blocks[i].position.lerp(target, rate);
    }

    // The scene answers only what is actually in the machine.
    const subject = this.inserted[0];
    const dusk = this.inserted[1];
    const wide = this.inserted[2];
    const noPeople = this.inserted[3];

    const tower = this.sceneParts[1];
    tower.visible = this.ran && subject;

    for (let i = 2; i < this.sceneParts.length; i++) {
      this.sceneParts[i].visible = this.ran && !noPeople;
    }

    const ground = this.sceneParts[0].material as THREE.MeshStandardMaterial;
    ground.color.lerp(this.ran && dusk ? Promptcraft.DUSK : Promptcraft.DAY, rate);

    const targetScale = this.ran && wide ? 1.25 : 1;
    this.scene.scale.lerp(this.scratchScale.setScalar(targetScale), rate);

    if (!this.reducedMotion && this.ran) this.scene.rotation.y = Math.sin(this.elapsed * 0.3) * 0.12;
  }

  protected override onReset(): void {
    this.ran = false;
    for (let i = 0; i < this.inserted.length; i++) {
      this.inserted[i] = false;
      if (this.blocks[i]) this.blocks[i].position.copy(this.homes[i]);
    }
    if (this.scene) {
      this.scene.rotation.set(0, 0, 0);
      this.scene.scale.setScalar(1);
    }
    for (let i = 1; i < this.sceneParts.length; i++) this.sceneParts[i].visible = false;
  }

  protected override describeState(): string {
    const inserted = BLOCKS.filter((_b, i) => this.inserted[i]).map((b) => b.label);
    if (inserted.length === 0) return 'The machine is empty. Five blocks wait: three descriptions and two constraints.';
    const constraints = this.constraintCount();
    if (!this.ran) {
      return `Loaded with ${inserted.join(', ')}. ${constraints === 0 ? 'No constraint is inserted, so the machine will refuse to run.' : 'Ready to run.'}`;
    }
    return `Run with ${inserted.join(', ')}. The rendered scene shows the result — deterministic, and entirely local.`;
  }
}
