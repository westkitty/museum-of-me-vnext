import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E16 — Media Application Lineage. Tier C.
 *
 * A workbench of four device generations, arranged chronologically and each
 * physically smaller in scope than the one before. A media job runs across all
 * of them — input, trim, convert, transcribe, output — and the differences in
 * how each generation handles the same job are the exhibit.
 */

interface Generation {
  readonly name: string;
  readonly surfaces: number;
  readonly width: number;
  readonly note: string;
  readonly colour: number;
}

const GENERATIONS: readonly Generation[] = [
  { name: 'Guy_Cast', surfaces: 3, width: 1.15, colour: 0x8a7a5c,
    note: 'Desktop, web and a browser extension. Three permission models and three update paths for one feature set.' },
  { name: 'Gay_Cast', surfaces: 1, width: 0.75, colour: 0x5fb0e8,
    note: 'One native platform. The feature set could finally develop instead of being ported.' },
  { name: 'He-Maker', surfaces: 1, width: 0.65, colour: 0xd97a4e,
    note: 'Recovered from a sync folder. Source without history is a backup, not a project.' },
  { name: 'Media Getter', surfaces: 1, width: 0.85, colour: 0xe8c65a,
    note: 'Native, with its command-line tools bundled — which removes the most common support problem this kind of utility has.' },
];

const STEPS = ['Input', 'Trim', 'Convert', 'Transcribe', 'Output'] as const;

export class MediaLineage extends ExhibitBase {
  private devices = this.tracked<THREE.Group>();
  private stepLamps = this.tracked<THREE.Mesh>();
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private pulse!: Pulse;
  private step = -1;
  private travelling = false;
  private generation = 0;

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

    const wood = this.standard(0x755c3d, { roughness: 0.75 });
    const brass = this.standard(0xb9822c, { roughness: 0.35, metalness: 0.7 });

    // ── the bench ──
    const bench = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5.0, 0.1, 1.3)), wood);
    bench.position.set(0, 0.94, -4.2);
    this.group.add(bench);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.94, 1.1)), brass);
      leg.position.set(sx * 2.2, 0.47, -4.2);
      this.group.add(leg);
    }

    // ── four device generations, chronological ──
    GENERATIONS.forEach((generation, i) => {
      const x = -1.9 + i * 1.25;
      const g = new THREE.Group();
      g.position.set(x, 1.0, -4.2);
      this.group.add(g);
      this.devices.push(g);

      // One body per delivery surface — the first generation is visibly three.
      for (let s = 0; s < generation.surfaces; s++) {
        const body = new THREE.Mesh(
          scope.track(new THREE.BoxGeometry(generation.width * 0.7, 0.42, 0.5)),
          this.standard(generation.colour, { roughness: 0.5, metalness: 0.25 }),
        );
        body.position.set((s - (generation.surfaces - 1) / 2) * 0.3, 0.21 + s * 0.06, s * -0.08);
        g.add(body);
      }

      const label = buildLabel(scope, generation.name, 0.95);
      label.position.set(0, 0.78, 0);
      g.add(label);
      scope.track(label.geometry);

      const consoleGroup = buildConsole(scope, 0.48, 0.38, 1.0, wood);
      consoleGroup.position.set(x, 0, -2.6);
      this.group.add(consoleGroup);

      this.control({
        object: consoleGroup,
        label: `Run the job on ${generation.name}`,
        description: `${generation.note} Runs the same input, trim, convert, transcribe and output job on this generation.`,
        activate: () => {
          this.generation = i;
          this.step = -1;
          this.travelling = false;
          this.pulse.stop();
          this.ctx.announce(`${generation.name}. ${generation.note}`);
        },
      });
    });

    // ── the five job steps, above the bench ──
    STEPS.forEach((step, i) => {
      const x = -2.0 + i * 1.0;
      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.06, 10, 8)),
        this.emissive(0xe8c65a, 0.08),
      );
      lamp.position.set(x, 1.85, -4.6);
      this.group.add(lamp);
      this.stepLamps.push(lamp);

      const label = buildLabel(scope, step, 0.6);
      label.position.set(x, 2.1, -4.6);
      this.group.add(label);
      scope.track(label.geometry);

      if (i > 0) {
        this.curves.push(
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(x - 1.0, 1.85, -4.6),
            new THREE.Vector3(x - 0.5, 2.0, -4.6),
            new THREE.Vector3(x, 1.85, -4.6),
          ]),
        );
      }
    });

    const rail = new Filament(scope, this.scaled(20), 0.014, brass);
    rail.follow(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.0, 1.85, -4.6),
      new THREE.Vector3(0, 1.85, -4.6),
      new THREE.Vector3(2.0, 1.85, -4.6),
    ]));
    this.group.add(rail.group);

    this.pulse = new Pulse(scope, 0.07, this.emissive(0xffffff, 1.8));
    this.group.add(this.pulse.mesh);

    // ── run control ──
    const runConsole = buildConsole(scope, 0.6, 0.44, 1.0, wood);
    runConsole.position.set(2.9, 0, -2.6);
    runConsole.rotation.y = -0.5;
    this.group.add(runConsole);

    const runLabel = buildLabel(scope, 'Advance the job', 0.6);
    runLabel.position.set(0, 1.02, 0.2);
    runLabel.rotation.x = -Math.PI / 2.1;
    runConsole.add(runLabel);
    scope.track(runLabel.geometry);

    this.control({
      object: runConsole,
      label: 'Advance the media job',
      description: 'Steps the job through input, trim, convert, transcribe and output on the selected generation.',
      activate: () => {
        if (this.travelling) return;
        if (this.step >= STEPS.length - 1) {
          this.step = -1;
          this.ctx.announce('Job complete and cleared. Choose another generation to compare.');
          return;
        }
        if (this.step < 0) {
          this.step = 0;
          this.ctx.announce(`Input on ${GENERATIONS[this.generation].name}.`);
          return;
        }
        this.travelling = true;
        this.pulse.start();
      },
    });
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.travelling && this.pulse.isRunning) {
      const index = Math.min(this.curves.length - 1, Math.max(0, this.step));
      if (this.pulse.update(dt, this.curves[index], this.reducedMotion ? 5 : 1.6)) {
        this.step = Math.min(STEPS.length - 1, this.step + 1);
        this.travelling = false;
        this.ctx.announce(
          this.step === STEPS.length - 1
            ? `Output on ${GENERATIONS[this.generation].name}. ${GENERATIONS[this.generation].note}`
            : `${STEPS[this.step]} on ${GENERATIONS[this.generation].name}.`,
        );
      }
    }

    for (let i = 0; i < this.stepLamps.length; i++) {
      const mat = this.stepLamps[i].material as THREE.MeshStandardMaterial;
      const target = i <= this.step ? 1.5 : 0.08;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
    }

    // The active generation lifts off the bench.
    for (let i = 0; i < this.devices.length; i++) {
      const lift = i === this.generation ? 0.1 : 0;
      this.devices[i].position.y += (1.0 + lift - this.devices[i].position.y) * Math.min(1, dt * 5);
      if (!this.reducedMotion && i === this.generation) {
        this.devices[i].rotation.y = Math.sin(this.elapsed * 0.6) * 0.1;
      }
    }
  }

  protected override onReset(): void {
    this.step = -1;
    this.travelling = false;
    this.generation = 0;
    this.pulse.stop();
    for (const lamp of this.stepLamps) {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.08;
    }
    for (const device of this.devices) {
      device.position.y = 1.0;
      device.rotation.set(0, 0, 0);
    }
  }

  protected override describeState(): string {
    const generation = GENERATIONS[this.generation];
    if (this.step < 0) {
      return `${generation.name} is selected, showing ${generation.surfaces} delivery surface${generation.surfaces === 1 ? '' : 's'}. No job is running.`;
    }
    return `Running on ${generation.name}, currently at ${STEPS[this.step]}. ${generation.note}`;
  }
}
