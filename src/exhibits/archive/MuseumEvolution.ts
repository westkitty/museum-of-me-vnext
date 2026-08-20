import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E09 — Museum Evolution. Tier C.
 *
 * A maquette table carrying the building's own history as layered models. The
 * final layer is the building the visitor is standing in, which is the only
 * moment this museum is allowed to be about itself — and it is presented as a
 * decision with a cost, not as an achievement.
 */

interface Generation {
  readonly name: string;
  readonly form: 'document' | 'rooms' | 'monolith' | 'building';
  readonly note: string;
  readonly colour: number;
}

const GENERATIONS: readonly Generation[] = [
  { name: 'Museum of Me, concept', form: 'document', colour: 0x8a7a9a,
    note: 'Closer to an interactive document than a building. Content organised by page rather than by space.' },
  { name: 'The Reliquary, early', form: 'rooms', colour: 0x9d8bff,
    note: 'Rooms appeared, but as separate scenes rather than one continuous place.' },
  { name: 'The Reliquary, restored', form: 'monolith', colour: 0xc3a8ec,
    note: 'One enormous single-file Three.js artifact. It proved the idea was possible and showed exactly why a single file could not carry thirty-five interactive exhibits.' },
  { name: 'vNext — this building', form: 'building', colour: 0xe8c65a,
    note: 'A separate lineage, not a restoration. The previous artifacts are preserved unmodified; nothing here overwrites them.' },
];

export class MuseumEvolution extends ExhibitBase {
  private models = this.tracked<THREE.Group>();
  private dial!: Dial;
  private index = 0;

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
    lectern.position.set(3.2, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x5d4d70, { roughness: 0.75 });
    const bronze = this.standard(0x8a6a42, { roughness: 0.35, metalness: 0.7 });

    // ── the maquette table ──
    const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.4, 0.1, 2.4)), wood);
    top.position.set(0, 0.9, -4.0);
    this.group.add(top);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.14, 0.9, 2.0)), bronze);
      leg.position.set(sx * 1.5, 0.45, -4.0);
      this.group.add(leg);
    }

    // ── one model per generation, stacked and revealed by the dial ──
    GENERATIONS.forEach((generation) => {
      const model = this.buildGeneration(generation);
      model.position.set(0, 0.98, -4.0);
      model.visible = false;
      this.group.add(model);
      this.models.push(model);
    });
    this.models[0].visible = true;

    // ── the timeline control ──
    const consoleGroup = buildConsole(scope, 0.64, 0.48, 1.0, wood);
    consoleGroup.position.set(0, 0, -1.9);
    this.group.add(consoleGroup);

    this.dial = new Dial(scope, GENERATIONS.length, 0.24, { handle: this.emissive(0xc3a8ec, 0.8) });
    this.dial.group.position.set(0, 1.04, 0);
    consoleGroup.add(this.dial.group);

    const label = buildLabel(scope, 'Turn the timeline', 0.64);
    label.position.set(0, 1.02, 0.22);
    label.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(label);
    scope.track(label.geometry);

    this.control({
      object: consoleGroup,
      label: 'Turn the timeline',
      description:
        'Steps through the museum’s own attempts, ending with the building you are standing in. The last step is a decision with a cost, not a victory.',
      activate: () => {
        this.index = this.dial.advance();
        const g = GENERATIONS[this.index];
        this.ctx.announce(`${g.name}. ${g.note}`);
      },
    });
  }

  /** Each generation has a genuinely different shape, because each one was. */
  private buildGeneration(generation: Generation): THREE.Group {
    const scope = this.ctx.scope;
    const group = new THREE.Group();
    const mat = this.standard(generation.colour, { roughness: 0.6, metalness: 0.15 });

    const seamMaterial = this.standard(0x6a5a42, { roughness: 0.5, metalness: 0.5 });

    if (generation.form === 'document') {
      for (let i = 0; i < this.scaled(7); i++) {
        const page = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.5, 0.012, 0.68)), mat);
        page.position.set(-0.9 + i * 0.3, 0.02 + i * 0.014, 0);
        page.rotation.y = i * 0.04;
        group.add(page);
      }
    } else if (generation.form === 'rooms') {
      for (let i = 0; i < this.scaled(6); i++) {
        const a = (i / 6) * Math.PI * 2;
        const room = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.34, 0.2, 0.34)), mat);
        room.position.set(Math.sin(a) * 0.75, 0.1, Math.cos(a) * 0.55);
        group.add(room);
      }
    } else if (generation.form === 'monolith') {
      const block = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.5, 0.62, 0.95)), mat);
      block.position.y = 0.31;
      group.add(block);
      // Every room crammed into one object, visible as seams.
      for (let i = 0; i < this.scaled(12); i++) {
        const seam = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.02, 0.64, 0.97)), seamMaterial);
        seam.position.set(-0.7 + i * 0.12, 0.31, 0);
        group.add(seam);
      }
    } else {
      // The building the visitor is in: octagon plus four wings and a dome.
      const rotunda = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.34, 0.38, 0.3, 8)), mat);
      rotunda.position.y = 0.15;
      group.add(rotunda);

      const dome = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat);
      dome.position.y = 0.3;
      group.add(dome);

      const wings: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      wings.forEach(([dx, dz], i) => {
        const length = i === 2 ? 1.15 : i === 0 ? 0.95 : i === 3 ? 0.5 : 0.95;
        const wing = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.3, 0.2, length)), mat);
        wing.position.set(dx * (0.32 + length / 2), 0.1, dz * (0.32 + length / 2));
        wing.rotation.y = dx !== 0 ? Math.PI / 2 : 0;
        group.add(wing);
      });

      // The Sanctuary, below and behind, kept visibly separate.
      const sanctuary = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16)), this.standard(0xd9c69a, { roughness: 0.9 }));
      sanctuary.position.set(-0.55, 0.03, -0.55);
      group.add(sanctuary);
    }

    const label = buildLabel(scope, generation.name, 1.5);
    label.position.set(0, 0.86, 0);
    group.add(label);
    scope.track(label.geometry);

    return group;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt);
    for (let i = 0; i < this.models.length; i++) {
      const active = i === this.index;
      this.models[i].visible = active;
      if (active && !this.reducedMotion) this.models[i].rotation.y += dt * 0.16;
    }
  }

  protected override onReset(): void {
    this.index = 0;
    if (this.dial) {
      this.dial.value = 0;
      this.dial.update(0, true);
    }
    this.models.forEach((model, i) => {
      model.visible = i === 0;
      model.rotation.set(0, 0, 0);
    });
  }

  protected override describeState(): string {
    const g = GENERATIONS[this.index];
    const last = this.index === GENERATIONS.length - 1 ? ' This is the building you are standing in.' : '';
    return `The maquette shows ${g.name}. ${g.note}${last}`;
  }
}
