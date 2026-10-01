import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E29 — Arkship Civilization. Tier A.
 *
 * A large suspended arkship. Exploding it reveals five modules, each with its
 * own failure behaviour; choosing a destination deploys one of them. The
 * exhibit is scoped exactly like the project it represents — one decision,
 * examined properly, rather than a survey of everything the ship could do.
 */

interface Module {
  readonly name: string;
  readonly colour: number;
  readonly length: number;
  readonly radius: number;
  readonly failure: string;
}

const MODULES: readonly Module[] = [
  { name: 'Command', colour: 0x5fb0e8, length: 1.3, radius: 0.55, failure: 'Fails by deciding too slowly. Nothing breaks; the ship simply stops choosing.' },
  { name: 'Habitation', colour: 0x7fd67f, length: 2.6, radius: 0.85, failure: 'Fails socially long before it fails structurally.' },
  { name: 'Logistics', colour: 0xe8c65a, length: 2.0, radius: 0.7, failure: 'Fails quietly, in inventory, months before anyone notices.' },
  { name: 'Energy', colour: 0xd97a4e, length: 1.6, radius: 0.6, failure: 'Fails all at once, and takes the other four with it.' },
  { name: 'Propulsion', colour: 0x9d8bff, length: 2.2, radius: 0.65, failure: 'Fails by degrees. The ship still moves, just never fast enough again.' },
];

const DESTINATIONS = ['Near anchorage', 'Deep drift', 'The long descent'] as const;

export class ArkshipCivilization extends ExhibitBase {
  private ship!: THREE.Group;
  private modules = this.tracked<THREE.Group>();
  private homes = this.tracked<THREE.Vector3>();
  private dial!: Dial;
  private exploded = false;
  private deployed = -1;
  private destination = 0;
  private amount = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.3, -7.3);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.5, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the ship, suspended along the bay's axis ──
    this.ship = new THREE.Group();
    this.ship.position.set(0, 4.6, -4.0);
    this.ship.rotation.y = Math.PI / 2;
    this.group.add(this.ship);

    const hullMat = this.standard(0x7a8088, { roughness: 0.45, metalness: 0.68 });
    const spine = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.22, 0.22, 10.2, 12)), hullMat);
    spine.rotation.z = Math.PI / 2;
    this.ship.add(spine);

    let offset = -4.6;
    MODULES.forEach((module) => {
      const g = new THREE.Group();
      const home = new THREE.Vector3(offset + module.length / 2, 0, 0);
      g.position.copy(home);
      this.ship.add(g);
      this.modules.push(g);
      this.homes.push(home);
      offset += module.length + 0.15;

      const body = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(module.radius, module.radius, module.length, 14)),
        this.standard(module.colour, { roughness: 0.5, metalness: 0.4 }),
      );
      body.rotation.z = Math.PI / 2;
      g.add(body);

      for (let r = 0; r < this.scaled(3); r++) {
        const band = new THREE.Mesh(
          scope.track(new THREE.TorusGeometry(module.radius * 1.04, 0.035, 6, 18)),
          hullMat,
        );
        band.position.x = -module.length / 2 + ((r + 0.5) / 3) * module.length;
        band.rotation.y = Math.PI / 2;
        g.add(band);
      }

      const label = buildLabel(scope, module.name, 0.9);
      label.position.set(0, module.radius + 0.42, 0);
      label.rotation.y = -Math.PI / 2;
      g.add(label);
      scope.track(label.geometry);
    });

    // Suspension.
    const cableMat = this.standard(0x4a4640, { roughness: 0.7 });
    for (const x of [-3.6, 0, 3.6]) {
      const cable = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.025, 0.025, 4.4, 5)), cableMat);
      cable.position.set(x, 2.2, 0);
      this.ship.add(cable);
    }

    // ── controls ──
    const explodeConsole = buildConsole(scope, 0.66, 0.48, 1.0, this.standard(0x4a4640, { roughness: 0.6 }));
    explodeConsole.position.set(-3.0, 0, -2.4);
    explodeConsole.rotation.y = 0.5;
    this.group.add(explodeConsole);

    const explodeLabel = buildLabel(scope, 'Exploded view', 0.62);
    explodeLabel.position.set(0, 1.02, 0.2);
    explodeLabel.rotation.x = -Math.PI / 2.1;
    explodeConsole.add(explodeLabel);
    scope.track(explodeLabel.geometry);

    this.control({
      object: explodeConsole,
      label: () => (this.exploded ? 'Close the exploded view' : 'Explode the ship'),
      description:
        'Separates the five modules. Each fails differently, and the differences are the simulation — a generation ship is a set of coupled failure modes.',
      activate: () => {
        this.exploded = !this.exploded;
        this.ctx.announce(
          this.exploded
            ? 'The ship opens into five modules: command, habitation, logistics, energy and propulsion.'
            : 'The modules close back into the hull.',
        );
      },
    });

    const deployConsole = buildConsole(scope, 0.66, 0.48, 1.0, this.standard(0x4a4640, { roughness: 0.6 }));
    deployConsole.position.set(3.0, 0, -2.4);
    deployConsole.rotation.y = -0.5;
    this.group.add(deployConsole);

    this.dial = new Dial(scope, DESTINATIONS.length, 0.24, { handle: this.emissive(0x9d8bff, 0.8) });
    this.dial.group.position.set(0, 1.04, 0);
    deployConsole.add(this.dial.group);

    const deployLabel = buildLabel(scope, 'Choose a destination', 0.66);
    deployLabel.position.set(0, 1.02, 0.22);
    deployLabel.rotation.x = -Math.PI / 2.1;
    deployConsole.add(deployLabel);
    scope.track(deployLabel.geometry);

    this.control({
      object: deployConsole,
      label: 'Choose a destination and deploy',
      description:
        'Each destination demands a different module first. The prototype this project is built around asks exactly one question like this — and is scoped so a negative answer is affordable.',
      activate: () => {
        this.destination = this.dial.advance();
        this.deployed = this.destination % MODULES.length;
        const module = MODULES[this.deployed];
        this.ctx.announce(
          `${DESTINATIONS[this.destination]}: the ${module.name.toLowerCase()} module deploys first. ${module.failure}`,
        );
      },
    });
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt, this.reducedMotion);

    const target = this.exploded ? 1 : 0;
    this.amount += (target - this.amount) * Math.min(1, dt * (this.reducedMotion ? 20 : 3));

    this.modules.forEach((module, i) => {
      const home = this.homes[i];
      const spread = (i - (MODULES.length - 1) / 2) * 0.9;
      module.position.set(home.x + spread * this.amount, home.y, home.z);
      const lift = i === this.deployed ? 0.55 : 0;
      module.position.y = home.y + lift * this.amount;
      if (!this.reducedMotion && i === this.deployed) {
        module.rotation.x += dt * 0.5;
      }
    });

    if (!this.reducedMotion) this.ship.rotation.z = Math.sin(this.elapsed * 0.25) * 0.015;
  }

  protected override onReset(): void {
    this.exploded = false;
    this.deployed = -1;
    this.destination = 0;
    this.amount = 0;
    if (this.dial) {
      this.dial.value = 0;
      this.dial.update(0, true);
    }
    this.modules.forEach((module, i) => {
      module.position.copy(this.homes[i]);
      module.rotation.set(0, 0, 0);
    });
    if (this.ship) this.ship.rotation.set(0, Math.PI / 2, 0);
  }

  protected override describeState(): string {
    const state = this.exploded ? 'The ship is in exploded view, showing all five modules' : 'The ship is closed';
    if (this.deployed < 0) return `${state}. No destination has been chosen.`;
    const module = MODULES[this.deployed];
    return `${state}. Destination: ${DESTINATIONS[this.destination]}, with the ${module.name.toLowerCase()} module deployed. ${module.failure}`;
  }
}
