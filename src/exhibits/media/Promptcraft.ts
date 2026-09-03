import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E14 — Promptcraft, Vibe Coding & DexEnhance. Tier B.
 *
 * The left side is a deterministic prompt assembly machine: reusable prompt
 * structure is made physical, with constraints treated as first-class parts.
 * The right side is a browser-extension isolation demonstration. A synthetic
 * host interface can redesign itself while the DexEnhance layer stays stable,
 * because the extension's own UI lives behind a Shadow DOM boundary.
 *
 * Everything here is local museum simulation. No external generation service,
 * ChatGPT page, Gemini page, account, browser extension, or remote API is used.
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
  private hostPieces = this.tracked<THREE.Mesh>();
  private dexEnhanceLayer!: THREE.Mesh;
  private ran = false;
  private hostVariant = 0;
  private dexEnhanceEnabled = true;

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

    // ── prompt assembly machine ──
    const body = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.6, 1.5, 1.0)), wood);
    body.position.set(-1.2, 0.75, -4.2);
    this.group.add(body);

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

    // ── deterministic rendered scene ──
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

    const runConsole = buildConsole(scope, 0.6, 0.44, 1.0, wood);
    runConsole.position.set(-1.2, 0, -2.2);
    this.group.add(runConsole);

    const runLabel = buildLabel(scope, 'Run the machine', 0.6);
    runLabel.position.set(0, 1.02, 0.2);
    runLabel.rotation.x = -Math.PI / 2.1;
    runConsole.add(runLabel);
    scope.track(runLabel.geometry);

    this.control({
      object: runConsole,
      label: 'Run the machine',
      description: 'Assembles the inserted blocks and renders the result. Entirely deterministic and local — no external generation service is involved.',
      activate: () => this.run(),
    });

    // ── DexEnhance: host-page isolation demonstration ──
    const hostFrame = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(2.45, 1.5, 0.08)),
      this.standard(0x30333a, { roughness: 0.55, metalness: 0.35 }),
    );
    hostFrame.position.set(2.25, 1.75, -2.75);
    this.group.add(hostFrame);

    const hostMat = this.standard(0x6b7484, { roughness: 0.72 });
    for (let i = 0; i < 3; i++) {
      const piece = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.72, 0.16, 0.035)), hostMat);
      piece.position.set(2.25, 2.12 - i * 0.35, -2.69);
      this.group.add(piece);
      this.hostPieces.push(piece);
    }

    this.dexEnhanceLayer = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(0.78, 0.52, 0.035)),
      this.emissive(0x5fd0e8, 0.9),
    );
    this.dexEnhanceLayer.position.set(2.83, 1.42, -2.64);
    this.group.add(this.dexEnhanceLayer);

    const isolationLabel = buildLabel(scope, 'DEXENHANCE · SHADOW DOM ISOLATION', 2.0);
    isolationLabel.position.set(2.25, 2.7, -2.72);
    this.group.add(isolationLabel);
    scope.track(isolationLabel.geometry);

    this.control({
      object: hostFrame,
      label: 'Redesign the synthetic host page',
      description: 'Moves the host interface into a different layout. The DexEnhance layer is a separate isolated surface, so the host redesign does not restyle or reposition it.',
      activate: () => {
        this.hostVariant = this.hostVariant === 0 ? 1 : 0;
        this.applyHostVariant();
        this.ctx.announce(
          this.hostVariant === 1
            ? 'Synthetic host redesign applied. The host controls moved; the DexEnhance layer stayed in place behind its own style boundary.'
            : 'Synthetic host returned to its first layout. The extension layer remained independent in both versions.',
        );
      },
    });

    const extensionConsole = buildConsole(scope, 0.55, 0.42, 1.0, wood);
    extensionConsole.position.set(3.25, 0, -1.75);
    extensionConsole.rotation.y = -0.45;
    this.group.add(extensionConsole);
    const extensionLabel = buildLabel(scope, 'DexEnhance layer', 0.58);
    extensionLabel.position.set(0, 1.02, 0.2);
    extensionLabel.rotation.x = -Math.PI / 2.1;
    extensionConsole.add(extensionLabel);
    scope.track(extensionLabel.geometry);

    this.control({
      object: extensionConsole,
      label: () => (this.dexEnhanceEnabled ? 'Disable the DexEnhance layer' : 'Enable the DexEnhance layer'),
      description: 'Toggles only the local extension surface. Its state is independent from the synthetic host layout and no remote account or service exists in this exhibit.',
      activate: () => {
        this.dexEnhanceEnabled = !this.dexEnhanceEnabled;
        this.dexEnhanceLayer.visible = this.dexEnhanceEnabled;
        this.ctx.announce(
          this.dexEnhanceEnabled
            ? 'DexEnhance layer enabled from local state. The synthetic host page was not modified.'
            : 'DexEnhance layer disabled. The host page remains exactly as it was.',
        );
      },
    });

    this.applyHostVariant();
  }

  private applyHostVariant(): void {
    if (this.hostPieces.length < 3) return;
    if (this.hostVariant === 0) {
      this.hostPieces[0].position.set(2.25, 2.12, -2.69);
      this.hostPieces[0].scale.set(2.45, 1, 1);
      this.hostPieces[1].position.set(1.58, 1.73, -2.69);
      this.hostPieces[1].scale.set(0.62, 2.5, 1);
      this.hostPieces[2].position.set(2.42, 1.72, -2.69);
      this.hostPieces[2].scale.set(1.25, 2.2, 1);
    } else {
      this.hostPieces[0].position.set(2.25, 1.32, -2.69);
      this.hostPieces[0].scale.set(2.45, 1, 1);
      this.hostPieces[1].position.set(2.92, 1.85, -2.69);
      this.hostPieces[1].scale.set(0.62, 2.5, 1);
      this.hostPieces[2].position.set(2.05, 1.88, -2.69);
      this.hostPieces[2].scale.set(1.25, 2.2, 1);
    }
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
      this.ctx.announce('The machine will not run. No constraint block is inserted, and a prompt without its constraint list is the part that does not survive reuse.');
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
    this.hostVariant = 0;
    this.dexEnhanceEnabled = true;
    for (let i = 0; i < this.inserted.length; i++) {
      this.inserted[i] = false;
      if (this.blocks[i]) this.blocks[i].position.copy(this.homes[i]);
    }
    if (this.scene) {
      this.scene.rotation.set(0, 0, 0);
      this.scene.scale.setScalar(1);
    }
    for (let i = 1; i < this.sceneParts.length; i++) this.sceneParts[i].visible = false;
    if (this.dexEnhanceLayer) this.dexEnhanceLayer.visible = true;
    this.applyHostVariant();
  }

  protected override describeState(): string {
    const inserted = BLOCKS.filter((_b, i) => this.inserted[i]).map((b) => b.label);
    const promptState = inserted.length === 0
      ? 'The prompt machine is empty.'
      : this.ran
        ? `The prompt machine has run with ${inserted.join(', ')}.`
        : `The prompt machine is loaded with ${inserted.join(', ')}.`;
    return `${promptState} Synthetic host layout ${this.hostVariant + 1} is visible; the DexEnhance Shadow DOM layer is ${this.dexEnhanceEnabled ? 'enabled and isolated from it' : 'disabled'}.`;
  }
}
