import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E15 — Agent Harness Laboratory. Tier C.
 *
 * A routing rack. A task travels request → context → specialist → validation →
 * handoff, and persistence sits physically outside the rack on its own plinth,
 * joined by a single cable. That separation is the exhibit's argument: an
 * orchestration system that owns the memory it orchestrates becomes impossible
 * to replace, and these harnesses were replaced.
 */

const STAGES = [
  { name: 'Request', note: 'A task arrives with almost no context attached.', colour: 0x8a9aa0 },
  { name: 'Context', note: 'The harness decides what this task actually needs to know. This is the hard part.', colour: 0x5fd0e8 },
  { name: 'Specialist', note: 'Routed to a defined capability rather than re-described from scratch each session.', colour: 0xe8c65a },
  { name: 'Validation', note: 'Checked before it counts. Without this the harness produces confident nonsense.', colour: 0x7fd67f },
  { name: 'Handoff', note: 'A bounded description of state that another tool can consume.', colour: 0xd97a4e },
] as const;

export class AgentHarness extends ExhibitBase {
  private rack!: THREE.Group;
  private stageLamps = this.tracked<THREE.Mesh>();
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private pulse!: Pulse;
  private stage = -1;
  private travelling = -1;

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

    const metal = this.standard(0x4a4640, { roughness: 0.4, metalness: 0.6 });

    // ── the rack ──
    this.rack = new THREE.Group();
    this.rack.position.set(-0.8, 0, -4.2);
    this.group.add(this.rack);

    const frame = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.4, 2.6, 0.8)), metal);
    frame.position.y = 1.3;
    this.rack.add(frame);

    STAGES.forEach((stage, i) => {
      const y = 0.42 + i * 0.46;
      const unit = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(1.3, 0.36, 0.84)),
        this.standard(0x2f2b26, { roughness: 0.55, metalness: 0.4 }),
      );
      unit.position.set(0, y, 0.02);
      this.rack.add(unit);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.055, 10, 8)),
        this.emissive(stage.colour, 0.08),
      );
      lamp.position.set(-0.5, y, 0.45);
      this.rack.add(lamp);
      this.stageLamps.push(lamp);

      const label = buildLabel(scope, stage.name, 0.7);
      label.position.set(0.18, y, 0.46);
      this.rack.add(label);
      scope.track(label.geometry);

      this.curves.push(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.8, y - 0.46, -3.75),
          new THREE.Vector3(-0.4, y - 0.23, -3.6),
          new THREE.Vector3(-0.8, y, -3.75),
        ]),
      );
    });

    this.pulse = new Pulse(scope, 0.075, this.emissive(0xe8c65a, 1.8));
    this.group.add(this.pulse.mesh);

    // ── persistence, outside the rack ──
    const plinth = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 16)), metal);
    plinth.position.set(2.4, 0.45, -4.2);
    this.group.add(plinth);

    const store = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(0.7, 0.9, 0.7)),
      this.standard(0x755c3d, { roughness: 0.7 }),
    );
    store.position.set(2.4, 1.35, -4.2);
    this.group.add(store);

    const storeLabel = buildLabel(scope, 'Persistence — outside the harness', 1.6);
    storeLabel.position.set(2.4, 2.05, -4.2);
    this.group.add(storeLabel);
    scope.track(storeLabel.geometry);

    // The single cable. One connection, and that is the whole point.
    const cable = new Filament(scope, this.scaled(14), 0.022, this.standard(0x8a7a5c, { roughness: 0.6 }));
    cable.follow(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.15, 1.2, -3.9),
        new THREE.Vector3(1.1, 0.85, -3.8),
        new THREE.Vector3(2.05, 1.3, -4.1),
      ]),
    );
    this.group.add(cable.group);

    // ── controls ──
    const consoleGroup = buildConsole(scope, 0.62, 0.46, 1.0, metal);
    consoleGroup.position.set(-2.6, 0, -2.6);
    consoleGroup.rotation.y = 0.5;
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Route a task', 0.6);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Route a task through the rack',
      description:
        'Sends one fictional task up the rack, a stage at a time. Watch where it touches persistence — the store is outside the harness, joined by one cable, which is what let the harness be replaced without losing the record.',
      activate: () => this.advance(),
    });

    this.control({
      object: store,
      label: 'Inspect the persistence store',
      description:
        'The project record lives here, not in the harness. An orchestration system that owns the memory it orchestrates becomes impossible to replace.',
      activate: () => {
        this.ctx.announce(
          'The store holds the project record. Two harnesses have been built against it and one has already been retired — the record outlived both.',
        );
      },
    });
  }

  private advance(): void {
    if (this.travelling >= 0) return;
    const next = this.stage + 1;
    if (next >= STAGES.length) {
      this.stage = -1;
      this.ctx.announce('The rack is cleared. Route another task to run it again.');
      return;
    }
    this.travelling = next;
    this.pulse.start();
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.travelling >= 0 && this.pulse.isRunning) {
      if (this.pulse.update(dt, this.curves[this.travelling], this.reducedMotion ? 5 : 1.4)) {
        this.stage = this.travelling;
        this.travelling = -1;
        const stage = STAGES[this.stage];
        this.ctx.announce(`${stage.name}. ${stage.note}`);
      }
    }

    for (let i = 0; i < this.stageLamps.length; i++) {
      const mat = this.stageLamps[i].material as THREE.MeshStandardMaterial;
      const target = i <= this.stage ? 1.4 : 0.08;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
    }
  }

  protected override onReset(): void {
    this.stage = -1;
    this.travelling = -1;
    this.pulse.stop();
    for (const lamp of this.stageLamps) {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.08;
    }
  }

  protected override describeState(): string {
    if (this.stage < 0) return 'The rack is idle. Five stages wait: request, context, specialist, validation and handoff.';
    const stage = STAGES[this.stage];
    return `The task has reached ${stage.name}. ${stage.note}`;
  }
}
