import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E25 — DnDex / DM Hub. Tier B.
 *
 * A game master's table with one encounter round on it. Roll, move, resolve.
 * The round is deterministic and it is over in four steps, because the project's
 * design constraint was table speed: any interaction that costs more than the
 * mental arithmetic it replaces gets abandoned mid-session. This exhibit is
 * built to that same rule.
 */

interface Combatant {
  readonly name: string;
  readonly initiative: number;
  readonly colour: number;
  hp: number;
  readonly maxHp: number;
  cell: [number, number];
}

const GRID = 7;
const CELL = 0.34;
const STEPS = ['Roll initiative', 'Move the miniature', 'Resolve one action', 'Round complete'] as const;

export class DnDexTable extends ExhibitBase {
  private table!: THREE.Group;
  private minis = this.tracked<THREE.Mesh>();
  private hpBars = this.tracked<THREE.Mesh>();
  private die!: THREE.Mesh;
  private orderDial!: Dial;
  private combatants = this.tracked<Combatant>();
  private step = 0;
  private roll = 0;
  private dieSpin = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  private resetCombatants(): void {
    this.combatants.length = 0;
    this.combatants.push(
      { name: 'Warden', initiative: 18, colour: 0x5fb0e8, hp: 24, maxHp: 24, cell: [1, 3] },
      { name: 'Hollow', initiative: 12, colour: 0xb5543a, hp: 18, maxHp: 18, cell: [5, 3] },
      { name: 'Scribe', initiative: 9, colour: 0xe8c65a, hp: 14, maxHp: 14, cell: [1, 5] },
    );
  }

  protected override build(): void {
    const scope = this.ctx.scope;
    this.resetCombatants();

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.2);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.3, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x6b4a30, { roughness: 0.72 });
    const felt = this.standard(0x2f4436, { roughness: 0.95 });
    const brass = this.standard(0xb9822c, { roughness: 0.3, metalness: 0.75 });

    // ── the table ──
    this.table = new THREE.Group();
    this.table.position.set(0, 0, -3.6);
    this.group.add(this.table);

    const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.0, 0.1, 2.2)), wood);
    top.position.y = 0.86;
    this.table.add(top);

    const surface = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.7, 0.02, 1.9)), felt);
    surface.position.y = 0.92;
    this.table.add(surface);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.86, 0.12)), wood);
        leg.position.set(sx * 1.35, 0.43, sz * 0.95);
        this.table.add(leg);
      }
    }

    // ── tactical grid ──
    const lineMat = this.standard(0x8aa090, { roughness: 0.9 });
    const lineGeo = scope.track(new THREE.BoxGeometry(GRID * CELL, 0.004, 0.008));
    for (let i = 0; i <= GRID; i++) {
      const offset = (i - GRID / 2) * CELL;
      const row = new THREE.Mesh(lineGeo, lineMat);
      row.position.set(0, 0.935, offset);
      this.table.add(row);
      const col = new THREE.Mesh(lineGeo, lineMat);
      col.position.set(offset, 0.935, 0);
      col.rotation.y = Math.PI / 2;
      this.table.add(col);
    }

    // ── miniatures ──
    this.combatants.forEach((c) => {
      const mini = new THREE.Group();
      const base = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.11, 0.12, 0.03, 14)), brass);
      const body = new THREE.Mesh(
        scope.track(new THREE.ConeGeometry(0.085, 0.26, 10)),
        this.standard(c.colour, { roughness: 0.5, metalness: 0.2 }),
      );
      body.position.y = 0.16;
      const head = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.052, 10, 8)), this.standard(c.colour, { roughness: 0.5 }));
      head.position.y = 0.32;
      mini.add(base, body, head);

      const holder = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.001, 0.001, 0.001)), lineMat);
      holder.add(mini);
      holder.position.set(0, 0.95, 0);
      this.table.add(holder);
      this.minis.push(holder);

      // Hit points, shown as a bar rather than a number — readable at a glance.
      const bar = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.22, 0.022, 0.022)), this.emissive(0x7fd67f, 0.9));
      bar.position.set(0, 0.42, 0);
      holder.add(bar);
      this.hpBars.push(bar);

      const label = buildLabel(scope, c.name, 0.36);
      label.position.set(0, 0.5, 0);
      holder.add(label);
      scope.track(label.geometry);
    });
    this.placeMinis();

    // ── the die ──
    this.die = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.1, 0)), this.emissive(0xe8c65a, 0.6));
    this.die.position.set(-1.05, 0.99, 0.6);
    this.table.add(this.die);

    // ── initiative dial ──
    const consoleGroup = buildConsole(scope, 0.6, 0.44, 1.0, wood);
    consoleGroup.position.set(-2.4, 0, -2.4);
    consoleGroup.rotation.y = 0.55;
    this.group.add(consoleGroup);

    this.orderDial = new Dial(scope, this.combatants.length, 0.2, { handle: brass });
    this.orderDial.group.position.set(0, 1.02, 0);
    consoleGroup.add(this.orderDial.group);

    const dialLabel = buildLabel(scope, 'Initiative order', 0.56);
    dialLabel.position.set(0, 1.02, 0.2);
    dialLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(dialLabel);
    scope.track(dialLabel.geometry);

    // ── controls ──
    this.control({
      object: this.table,
      label: () => this.currentStepLabel(),
      description:
        'Runs one deterministic encounter round: roll, move, resolve. Four steps and it is over — the project was built for table speed, not completeness.',
      activate: () => this.advance(),
    });

    this.control({
      object: consoleGroup,
      label: 'Change whose turn it is',
      description: 'Steps the initiative order. The active miniature lifts.',
      activate: () => {
        const index = this.orderDial.advance();
        this.ctx.announce(`Initiative passes to ${this.combatants[index].name}.`);
      },
    });
  }

  private placeMinis(): void {
    this.combatants.forEach((c, i) => {
      const [gx, gz] = c.cell;
      this.minis[i].position.set((gx - GRID / 2 + 0.5) * CELL, 0.95, (gz - GRID / 2 + 0.5) * CELL);
    });
  }

  private currentStepLabel(): string {
    return STEPS[Math.min(this.step, STEPS.length - 1)];
  }

  private advance(): void {
    const random = rng(1000 + this.step * 7);
    switch (this.step) {
      case 0: {
        this.roll = 1 + Math.floor(random() * 20);
        this.dieSpin = this.reducedMotion ? 0 : 1.2;
        this.ctx.announce(`Rolled ${this.roll} on a d20. ${this.roll >= 11 ? 'It hits.' : 'It misses.'}`);
        this.step = 1;
        break;
      }
      case 1: {
        // The Hollow advances one square toward the Warden.
        const hollow = this.combatants[1];
        hollow.cell = [Math.max(0, hollow.cell[0] - 1), hollow.cell[1]];
        this.placeMinis();
        this.ctx.announce('Hollow advances one square toward the Warden.');
        this.step = 2;
        break;
      }
      case 2: {
        const target = this.combatants[0];
        if (this.roll >= 11) {
          const damage = 3 + Math.floor(random() * 6);
          target.hp = Math.max(0, target.hp - damage);
          this.ctx.announce(`Hollow hits the Warden for ${damage}. Warden is on ${target.hp} of ${target.maxHp}.`);
        } else {
          this.ctx.announce('Hollow misses. The Warden holds.');
        }
        this.updateHp();
        this.step = 3;
        break;
      }
      default: {
        this.ctx.announce('Round complete. Reset the table to run it again.');
        this.step = 0;
        this.resetCombatants();
        this.placeMinis();
        this.updateHp();
        break;
      }
    }
  }

  private updateHp(): void {
    this.combatants.forEach((c, i) => {
      const bar = this.hpBars[i];
      const fraction = c.hp / c.maxHp;
      bar.scale.x = Math.max(0.02, fraction);
      const mat = bar.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(fraction > 0.6 ? 0x7fd67f : fraction > 0.3 ? 0xe8c65a : 0xd9543a);
    });
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.orderDial.update(dt);

    if (this.dieSpin > 0) {
      this.dieSpin -= dt;
      this.die.rotation.x += dt * 9;
      this.die.rotation.y += dt * 7;
      this.die.position.y = 0.99 + Math.abs(Math.sin(this.elapsed * 12)) * 0.09;
      if (this.dieSpin <= 0) this.die.position.y = 0.99;
    }

    // The miniature whose turn it is lifts off the table.
    const active = this.orderDial.value;
    this.minis.forEach((mini, i) => {
      const lift = i === active ? 0.06 : 0;
      mini.position.y += (0.95 + lift - mini.position.y) * Math.min(1, dt * 8);
    });
  }

  protected override onReset(): void {
    this.step = 0;
    this.roll = 0;
    this.dieSpin = 0;
    this.resetCombatants();
    if (this.minis.length) {
      this.placeMinis();
      this.updateHp();
    }
    if (this.orderDial) {
      this.orderDial.value = 0;
      this.orderDial.update(0, true);
    }
    if (this.die) {
      this.die.rotation.set(0, 0, 0);
      this.die.position.set(-1.05, 0.99, 0.6);
    }
  }

  protected override describeState(): string {
    const hp = this.combatants.map((c) => `${c.name} ${c.hp}/${c.maxHp}`).join(', ');
    const turn = this.combatants[this.orderDial?.value ?? 0]?.name ?? 'nobody';
    if (this.step === 0 && this.roll === 0) {
      return `The encounter is set up and nothing has been rolled. ${hp}. It is ${turn}'s turn.`;
    }
    return `Next step: ${this.currentStepLabel()}. Last roll ${this.roll} on a d20. ${hp}. It is ${turn}'s turn.`;
  }
}
