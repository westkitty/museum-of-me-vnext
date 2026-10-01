import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Filament, Lever, Pulse, buildConsole } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E10 — WorldsVault Lineage. Tier B.
 *
 * Three archival machines in a row, each a generation of the same idea. The
 * visitor feeds one lore record into the chain and watches it pass through all
 * three, and the machines get visibly smaller and simpler as it goes — because
 * that is what actually happened. Project evolution is the interaction.
 */

interface Generation {
  readonly name: string;
  readonly project: string;
  readonly width: number;
  readonly height: number;
  readonly complexity: number;
  readonly verdict: string;
}

const GENERATIONS: readonly Generation[] = [
  {
    name: 'WorldsVault Uplink', project: 'P047',
    width: 2.3, height: 2.5, complexity: 14,
    verdict: 'A platform. It produced architecture reports faster than it produced software.',
  },
  {
    name: 'CanonForge', project: 'P048',
    width: 1.6, height: 1.8, complexity: 7,
    verdict: 'One machine, plain files, a command line. Suddenly it ran.',
  },
  {
    name: 'WorldsVault', project: 'P049',
    width: 1.0, height: 1.25, complexity: 3,
    verdict: 'An editor someone else maintains, a folder, and Git. Still running.',
  },
];

const STAGES = ['idle', 'first machine', 'second machine', 'third machine', 'complete'] as const;

export class WorldsVaultLineage extends ExhibitBase {
  private machines = this.tracked<THREE.Group>();
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private pulse!: Pulse;
  private lever!: Lever;
  private stage = 0;
  private record!: THREE.Mesh;
  private readonly machinePositions = this.tracked<THREE.Vector3>();

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
    lectern.position.set(3.2, 0, -4.4);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const bronze = this.standard(0x7a6242, { roughness: 0.42, metalness: 0.62 });
    const parchment = this.standard(0xd6c9ab, { roughness: 0.9 });
    const dark = this.standard(0x2e2536, { roughness: 0.75 });

    // Three machines, left to right, each smaller than the one before it.
    GENERATIONS.forEach((gen, i) => {
      const machine = new THREE.Group();
      const x = -3.2 + i * 3.2;
      machine.position.set(x, 0, -3.6);
      this.group.add(machine);
      this.machines.push(machine);
      this.machinePositions.push(new THREE.Vector3(x, gen.height * 0.62, -3.6));

      const body = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(gen.width, gen.height, gen.width * 0.62)),
        dark,
      );
      body.position.y = gen.height / 2;
      machine.add(body);

      // Complexity made physical: the first machine bristles with apparatus.
      const partGeo = scope.track(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 8));
      for (let k = 0; k < this.scaled(gen.complexity); k++) {
        const a = (k / gen.complexity) * Math.PI * 2;
        const part = new THREE.Mesh(partGeo, bronze);
        part.position.set(
          Math.sin(a) * gen.width * 0.42,
          0.35 + (k % 4) * (gen.height / 5),
          Math.cos(a) * gen.width * 0.34,
        );
        part.rotation.z = Math.PI / 2;
        part.rotation.y = a;
        machine.add(part);
      }

      const platen = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(gen.width * 0.8, 0.05, gen.width * 0.5)),
        parchment,
      );
      platen.position.y = gen.height + 0.03;
      machine.add(platen);

      const label = buildLabel(scope, gen.name, 1.5);
      label.position.set(0, gen.height + 0.52, gen.width * 0.34);
      machine.add(label);
      scope.track(label.geometry);
    });

    // Connecting conduits between machines.
    const conduitMat = this.standard(0x5a4a36, { roughness: 0.5, metalness: 0.5 });
    for (let i = 0; i < this.machinePositions.length - 1; i++) {
      const a = this.machinePositions[i];
      const b = this.machinePositions[i + 1];
      const curve = new THREE.CatmullRomCurve3([
        a.clone(),
        new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.7, a.z + 0.3),
        b.clone(),
      ]);
      this.curves.push(curve);
      const filament = new Filament(scope, this.scaled(18), 0.05, conduitMat);
      filament.follow(curve);
      this.group.add(filament.group);
    }

    // The record itself: one sheet of lore, which is what actually travels.
    this.record = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(0.42, 0.02, 0.56)),
      this.emissive(0xe8c65a, 0.55),
    );
    this.record.position.copy(this.machinePositions[0]).setY(GENERATIONS[0].height + 0.09);
    this.group.add(this.record);

    this.pulse = new Pulse(scope, 0.1, this.emissive(0xe8c65a, 1.5));
    this.group.add(this.pulse.mesh);

    // Control console at the head of the line.
    const consoleGroup = buildConsole(scope, 0.66, 0.5, 1.02, this.standard(0x3a3040, { roughness: 0.7 }));
    consoleGroup.position.set(-5.0, 0, -1.6);
    consoleGroup.rotation.y = 0.5;
    this.group.add(consoleGroup);

    this.lever = new Lever(scope, 2, 0.4, { arm: this.emissive(0xe8c65a, 0.7) });
    this.lever.group.position.set(0, 1.02, 0);
    consoleGroup.add(this.lever.group);

    const label = buildLabel(scope, 'Send the record', 0.6);
    label.position.set(0, 1.04, 0.22);
    label.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(label);
    scope.track(label.geometry);

    this.control({
      object: consoleGroup,
      label: 'Send the record through',
      description:
        'Feeds one lore record into the first machine. It passes through all three generations; watch how much apparatus each one needs to do the same job.',
      activate: () => {
        if (this.stage === 0 || this.stage === STAGES.length - 1) {
          this.stage = 1;
          this.lever.advance();
          this.pulse.stop();
          this.record.position.copy(this.machinePositions[0]).setY(GENERATIONS[0].height + 0.09);
          this.ctx.announce(`The record enters ${GENERATIONS[0].name}. ${GENERATIONS[0].verdict}`);
        } else {
          this.advanceStage();
        }
      },
    });
  }

  private advanceStage(): void {
    // The pulse auto-chains into the next leg in onUpdate() without another
    // click; pressing interact again while one is still in flight used to
    // call pulse.start() a second time, resetting its progress to the start
    // of the current leg. Sibling exhibits (AgentHarness, MediaLineage) guard
    // their equivalent re-click the same way.
    if (this.pulse.isRunning) return;
    if (this.stage >= 1 && this.stage <= 3) {
      const from = this.stage - 1;
      if (from < this.curves.length) {
        this.pulse.start();
      } else {
        this.stage = STAGES.length - 1;
        this.ctx.announce(
          'The record arrives in the third generation intact. Each machine did the same job with less.',
        );
      }
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.lever.update(dt, this.reducedMotion);

    if (this.pulse.isRunning) {
      const index = Math.min(this.curves.length - 1, this.stage - 1);
      const finished = this.pulse.update(dt, this.curves[index], this.reducedMotion ? 3 : 0.55);
      this.record.position.copy(this.pulse.mesh.position);
      if (finished) {
        this.stage++;
        const gen = GENERATIONS[Math.min(GENERATIONS.length - 1, this.stage - 1)];
        this.record.position
          .copy(this.machinePositions[Math.min(2, this.stage - 1)])
          .setY(gen.height + 0.09);
        this.ctx.announce(`${gen.name}. ${gen.verdict}`);
        if (this.stage - 1 < this.curves.length) this.pulse.start();
        else this.stage = STAGES.length - 1;
      }
    }

    if (!this.reducedMotion) {
      this.record.rotation.y += dt * 0.4;
      this.machines.forEach((m, i) => {
        const active = this.stage - 1 === i;
        m.position.y = active ? Math.sin(this.elapsed * 4) * 0.012 : 0;
      });
    }
  }

  protected override onReset(): void {
    this.stage = 0;
    this.pulse.stop();
    this.lever.value = 0;
    this.lever.update(0, true);
    if (this.record) {
      this.record.position.copy(this.machinePositions[0]).setY(GENERATIONS[0].height + 0.09);
      this.record.rotation.set(0, 0, 0);
    }
    for (const m of this.machines) m.position.y = 0;
  }

  protected override describeState(): string {
    if (this.stage === 0) return 'The record waits on the first machine. Nothing has been sent yet.';
    if (this.stage >= STAGES.length - 1) {
      return 'The record has passed through all three generations and arrived intact in the smallest one.';
    }
    const gen = GENERATIONS[Math.min(GENERATIONS.length - 1, this.stage - 1)];
    return `The record is at ${gen.name}. ${gen.verdict}`;
  }
}
