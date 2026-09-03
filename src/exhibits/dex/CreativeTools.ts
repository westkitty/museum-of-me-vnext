import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial, Filament } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E22 — Creative Tools Studio. Tier B.
 *
 * Three related creative-tool problems share the room:
 * - DexDraw makes a shared drawing surface into an operation-history problem.
 * - DexCraft demonstrates that prompt structure depends on the destination.
 * - 2D Game Factory turns user-owned assets into a real generated Phaser game
 *   through one governed workbench rather than an editor-side mock pipeline.
 *
 * The factory station is a museum-scale workflow model. It does not execute or
 * embed the external 2D Game Factory repository; its job is to make the actual
 * authority path legible: Import → Asset Lab → Role Map → Scene → Preview →
 * Validate → Build → Pack.
 */

const TARGETS = [
  { name: 'Chat assistant', note: 'Prose, context first, the request last.', k: 3, colour: 0x3fb9b2 },
  { name: 'Research tool', note: 'Claims and sources. Structure over voice.', k: 5, colour: 0x9d8bff },
  { name: 'Agentic IDE', note: 'Constraints, file paths and acceptance criteria. Almost no prose.', k: 8, colour: 0xe8c65a },
] as const;

const FACTORY_STAGES = [
  { name: 'Import', note: 'Stage user-owned source assets without surrendering source authority.' },
  { name: 'Asset Lab', note: 'Inspect and derive usable game assets while preserving their lineage.' },
  { name: 'Role Map', note: 'Assign semantic game roles so art connects to native theme and scene documents.' },
  { name: 'Scene', note: 'Compose the playable scene through the visual workbench.' },
  { name: 'Preview', note: 'Launch the actual generated Phaser game, not an editor-side imitation.' },
  { name: 'Validate', note: 'Run the project-native validation contract before build or pack.' },
  { name: 'Build', note: 'Build through the same canonical generator seam used by the workbench.' },
  { name: 'Pack', note: 'Package the validated game while retaining provenance and local-first boundaries.' },
] as const;

const STROKE_SEGMENTS = 26;
const MAX_STROKES = 6;

export class CreativeTools extends ExhibitBase {
  private strokes = this.tracked<Filament>();
  private strokeUsed = this.tracked<boolean>();
  private nodes = this.tracked<THREE.Mesh>();
  private factoryLamps = this.tracked<THREE.Mesh>();
  private target = 0;
  private dial!: Dial;
  private strokeCount = 0;
  private factoryStage = 0;
  private surface!: THREE.Mesh;

  /** Reused every frame; allocating these per element churned the heap. */
  private readonly scratchColour = new THREE.Color();

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
    lectern.position.set(3.4, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const steel = this.standard(0x9aa4a6, { roughness: 0.35, metalness: 0.6 });
    const darkSteel = this.standard(0x3a4148, { roughness: 0.62, metalness: 0.45 });

    // ── DexDraw: the design table ──
    const frame = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.6, 0.14, 3.0)), steel);
    frame.position.set(0, 0.9, -4.0);
    this.group.add(frame);

    this.surface = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(4.3, 0.02, 2.7)),
      this.emissive(0x14242a, 0.25),
    );
    this.surface.position.set(0, 0.98, -4.0);
    this.group.add(this.surface);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.9, 0.12)), steel);
        leg.position.set(sx * 2.0, 0.45, -4.0 + sz * 1.2);
        this.group.add(leg);
      }
    }

    // Strokes are pre-allocated so drawing never creates runtime resources.
    const random = rng(22022);
    for (let i = 0; i < MAX_STROKES; i++) {
      const hue = 0.45 + random() * 0.35;
      const colour = new THREE.Color().setHSL(hue, 0.7, 0.6).getHex();
      const stroke = new Filament(scope, STROKE_SEGMENTS, 0.016, this.emissive(colour, 1.2));
      stroke.setVisible(false);
      this.group.add(stroke.group);
      this.strokes.push(stroke);
      this.strokeUsed.push(false);
    }

    for (let i = 0; i < this.scaled(5); i++) {
      const a = (i / 5) * Math.PI * 2;
      const node = new THREE.Mesh(
        scope.track(new THREE.IcosahedronGeometry(0.14, 1)),
        this.standard(0xdde3e1, { roughness: 0.5, metalness: 0.2 }),
      );
      node.position.set(Math.sin(a) * 1.5, 1.12, -4.0 + Math.cos(a) * 0.95);
      this.group.add(node);
      this.nodes.push(node);
    }

    const drawConsole = buildConsole(scope, 0.62, 0.46, 1.0, steel);
    drawConsole.position.set(-3.0, 0, -2.6);
    drawConsole.rotation.y = 0.5;
    this.group.add(drawConsole);

    const drawLabel = buildLabel(scope, 'Draw on the table', 0.62);
    drawLabel.position.set(0, 1.02, 0.2);
    drawLabel.rotation.x = -Math.PI / 2.1;
    drawConsole.add(drawLabel);
    scope.track(drawLabel.geometry);

    this.control({
      object: drawConsole,
      label: 'Draw a connection',
      description:
        'Draws a stroke that binds two objects on the table. Marks stay for the length of your visit — a shared surface is a synchronisation problem, which is what three rewrites of DexDraw were about.',
      activate: () => this.draw(),
    });

    // ── DexCraft: target-specific prompt shaping ──
    const promptConsole = buildConsole(scope, 0.62, 0.46, 1.0, steel);
    promptConsole.position.set(3.0, 0, -2.6);
    promptConsole.rotation.y = -0.5;
    this.group.add(promptConsole);

    this.dial = new Dial(scope, TARGETS.length, 0.22, { handle: this.emissive(0xe8c65a, 0.8) });
    this.dial.group.position.set(0, 1.04, 0);
    promptConsole.add(this.dial.group);

    const promptLabel = buildLabel(scope, 'Shape for target', 0.62);
    promptLabel.position.set(0, 1.02, 0.22);
    promptLabel.rotation.x = -Math.PI / 2.1;
    promptConsole.add(promptLabel);
    scope.track(promptLabel.geometry);

    this.control({
      object: promptConsole,
      label: 'Change the prompt target',
      description:
        'Rewrites the same idea for a different destination. A prompt that works well in a research tool is badly shaped for an agentic coding environment, so there is no universal formatter.',
      activate: () => {
        this.target = this.dial.advance();
        const t = TARGETS[this.target];
        this.ctx.announce(`Shaping for ${t.name}. ${t.note}`);
        this.redraw();
      },
    });

    // ── 2D Game Factory: one governed path from assets to packaged game ──
    const factoryBoard = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(5.2, 0.78, 0.08)),
      darkSteel,
    );
    factoryBoard.position.set(0, 3.15, -6.1);
    this.group.add(factoryBoard);

    for (let i = 0; i < FACTORY_STAGES.length; i++) {
      const x = -2.15 + i * 0.615;
      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.07, 10, 8)),
        this.emissive(0x5fd0e8, i === 0 ? 1.35 : 0.08),
      );
      lamp.position.set(x, 3.28, -6.04);
      this.group.add(lamp);
      this.factoryLamps.push(lamp);

      const stageLabel = buildLabel(scope, FACTORY_STAGES[i].name, 0.5);
      stageLabel.position.set(x, 3.0, -6.03);
      this.group.add(stageLabel);
      scope.track(stageLabel.geometry);
    }

    const factoryTitle = buildLabel(scope, '2D GAME FACTORY · SAME RUNTIME PATH', 2.8);
    factoryTitle.position.set(0, 3.72, -6.05);
    this.group.add(factoryTitle);
    scope.track(factoryTitle.geometry);

    const factoryConsole = buildConsole(scope, 0.7, 0.48, 1.0, darkSteel);
    factoryConsole.position.set(0, 0, -1.45);
    this.group.add(factoryConsole);

    const factoryLabel = buildLabel(scope, 'Advance factory', 0.7);
    factoryLabel.position.set(0, 1.02, 0.2);
    factoryLabel.rotation.x = -Math.PI / 2.1;
    factoryConsole.add(factoryLabel);
    scope.track(factoryLabel.geometry);

    this.control({
      object: factoryConsole,
      label: () => `Advance 2D Game Factory: ${FACTORY_STAGES[this.factoryStage].name}`,
      description:
        'Advances a museum-scale model of the real workbench path. The actual project previews its generated Phaser game rather than an editor mock; this exhibit represents that contract without executing the external factory.',
      activate: () => this.advanceFactory(),
    });
  }

  private draw(): void {
    if (this.strokeCount >= MAX_STROKES) {
      for (let i = 0; i < this.strokeUsed.length; i++) {
        this.strokeUsed[i] = false;
        this.strokes[i].setVisible(false);
      }
      this.strokeCount = 0;
      this.ctx.announce('The table is cleared. Everything drawn on it is gone.');
      return;
    }
    this.strokeUsed[this.strokeCount] = true;
    this.strokes[this.strokeCount].setVisible(true);
    this.strokeCount++;
    this.redraw();
    this.ctx.announce(
      `Stroke ${this.strokeCount} of ${MAX_STROKES} drawn, shaped for ${TARGETS[this.target].name}. It stays on the table.`,
    );
  }

  private advanceFactory(): void {
    const current = FACTORY_STAGES[this.factoryStage];
    this.ctx.announce(`2D Game Factory — ${current.name}. ${current.note}`);
    if (this.factoryStage === FACTORY_STAGES.length - 1) {
      this.factoryStage = 0;
      this.ctx.announce('Package complete in the museum simulation. A new factory run begins at Import; no external repository or game was executed here.');
      return;
    }
    this.factoryStage++;
  }

  /** Lay every drawn stroke out for the current target's structure. */
  private redraw(): void {
    const t = TARGETS[this.target];
    for (let i = 0; i < this.strokes.length; i++) {
      if (!this.strokeUsed[i]) continue;
      const from = this.nodes[i % this.nodes.length].position;
      const to = this.nodes[(i + 2) % this.nodes.length].position;
      const points: THREE.Vector3[] = [];
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const p = from.clone().lerp(to, s / steps);
        const bend = Math.sin((s / steps) * Math.PI) * (0.42 - this.target * 0.16);
        p.y += bend + 0.02;
        p.x += Math.sin((s / steps) * t.k) * bend * 0.5;
        points.push(p);
      }
      this.strokes[i].follow(new THREE.CatmullRomCurve3(points));
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt);

    const t = TARGETS[this.target];
    const sm = this.surface.material as THREE.MeshStandardMaterial;
    sm.emissive.lerp(this.scratchColour.setHex(t.colour), Math.min(1, dt * 3));
    sm.emissiveIntensity = 0.12 + (this.strokeCount / MAX_STROKES) * 0.2;

    for (let i = 0; i < this.factoryLamps.length; i++) {
      const mat = this.factoryLamps[i].material as THREE.MeshStandardMaterial;
      const intensity = i === this.factoryStage ? 1.35 : i < this.factoryStage ? 0.55 : 0.08;
      mat.emissiveIntensity += (intensity - mat.emissiveIntensity) * Math.min(1, dt * 6);
    }

    if (!this.reducedMotion) {
      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].rotation.y += dt * (0.2 + i * 0.05);
        this.nodes[i].position.y = 1.12 + Math.sin(this.elapsed * 1.2 + i) * 0.015;
      }
      this.redraw();
    }
  }

  protected override onReset(): void {
    this.target = 0;
    this.strokeCount = 0;
    this.factoryStage = 0;
    for (let i = 0; i < this.strokeUsed.length; i++) {
      this.strokeUsed[i] = false;
      this.strokes[i].setVisible(false);
    }
    if (this.dial) {
      this.dial.value = 0;
      this.dial.update(0, true);
    }
    for (let i = 0; i < this.nodes.length; i++) this.nodes[i].position.y = 1.12;
  }

  protected override describeState(): string {
    const t = TARGETS[this.target];
    const drawing = this.strokeCount === 0
      ? `The DexDraw table is empty and shaping for ${t.name}.`
      : `${this.strokeCount} stroke${this.strokeCount === 1 ? '' : 's'} remain on the DexDraw table, shaped for ${t.name}.`;
    const factory = FACTORY_STAGES[this.factoryStage];
    return `${drawing} 2D Game Factory is at ${factory.name}: ${factory.note}`;
  }
}
