import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { ringTransforms } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E02 — Drakken Terraforming Compendium. Tier B.
 *
 * A central Egg with five archetype stations around it. Choosing an archetype
 * opens the Egg into a projection of that strain's morphology and the stage of
 * terraforming it performs. Five representative forms stand in for thirty-five;
 * the full taxonomy stays in the interpretation, because building thirty-five
 * production models was cut before quality was.
 */

interface Archetype {
  readonly name: string;
  readonly stage: string;
  readonly colour: number;
  /** Rough silhouette: [body radius, elongation, limb count, spine count]. */
  readonly form: readonly [number, number, number, number];
  readonly note: string;
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: 'Gorevault', stage: 'collection and gathering', colour: 0x8a3a3a,
    form: [0.62, 1.5, 6, 3],
    note: 'Takes a hostile world apart and holds what it takes. The first stage, and the one most often confused with the last.',
  },
  {
    name: 'Rendering', stage: 'refinement into feedstock', colour: 0xb5643a,
    form: [0.5, 2.2, 4, 8],
    note: 'Reduces what the Gorevault gathered into feedstock. Refinement, not production.',
  },
  {
    name: 'Ringthroat', stage: 'feedstock into SKY', colour: 0x5f9bd6,
    form: [0.78, 1.1, 3, 12],
    note: 'The only strain that makes sky. Collapsing this with the Gorevault is the most common error in derivative work.',
  },
  {
    name: 'Seedwright', stage: 'establishment', colour: 0x6ba85f,
    form: [0.42, 1.7, 8, 2],
    note: 'Places what will grow once there is air to grow in.',
  },
  {
    name: 'Keeper', stage: 'maintenance', colour: 0x8a7ab5,
    form: [0.55, 1.3, 5, 5],
    note: 'Stays after the work is done. A finished world is not a stable one.',
  },
];

export class DrakkenCompendium extends ExhibitBase {
  private egg!: THREE.Mesh;
  private eggShell!: THREE.Group;
  private projection!: THREE.Group;
  private forms = this.tracked<THREE.Group>();
  private stations = this.tracked<THREE.Group>();
  private selected = -1;
  private openAmount = 0;

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
    lectern.position.set(3.4, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the Egg ──
    const eggMat = this.standard(0x4a3f52, { roughness: 0.45, metalness: 0.3 });
    this.eggShell = new THREE.Group();
    this.eggShell.position.set(0, 1.9, -3.4);
    this.group.add(this.eggShell);

    this.egg = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1.05, 28, 22)), eggMat);
    this.egg.scale.set(1, 1.42, 1);
    this.eggShell.add(this.egg);

    // Shell plates that part when an archetype is chosen.
    const plateGeo = scope.track(new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI / 2.4, 0, Math.PI));
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(plateGeo, eggMat);
      plate.rotation.y = (i / 4) * Math.PI * 2;
      plate.scale.set(1, 1.42, 1);
      this.eggShell.add(plate);
      this.forms.push(plate as unknown as THREE.Group);
    }

    const pedestal = new THREE.Mesh(
      scope.track(new THREE.CylinderGeometry(0.9, 1.25, 0.9, 8)),
      this.standard(0x2f2840, { roughness: 0.8 }),
    );
    pedestal.position.set(0, 0.45, -3.4);
    this.group.add(pedestal);

    // ── the projection that opens inside the Egg ──
    this.projection = new THREE.Group();
    this.projection.position.copy(this.eggShell.position);
    this.projection.visible = false;
    this.group.add(this.projection);

    // ── five archetype stations, arranged so the visitor walks the ring ──
    const transforms = ringTransforms(ARCHETYPES.length, 4.6);
    ARCHETYPES.forEach((archetype, i) => {
      const station = new THREE.Group();
      const m = transforms[i];
      station.position.setFromMatrixPosition(m).add(new THREE.Vector3(0, 0, -3.4));
      station.rotation.y = Math.atan2(station.position.x, station.position.z + 3.4);
      this.group.add(station);
      this.stations.push(station);

      const consoleGroup = buildConsole(scope, 0.58, 0.44, 0.98, this.standard(0x322b4d, { roughness: 0.7 }));
      station.add(consoleGroup);

      // A representative silhouette standing on each station.
      const specimen = this.buildForm(archetype);
      specimen.position.y = 1.06;
      specimen.scale.setScalar(0.5);
      station.add(specimen);

      const label = buildLabel(scope, archetype.name, 0.62);
      label.position.set(0, 1.0, 0.24);
      label.rotation.x = -Math.PI / 2.1;
      station.add(label);
      scope.track(label.geometry);

      this.control({
        object: consoleGroup,
        label: `Open the Egg: ${archetype.name}`,
        description: `${archetype.name} performs ${archetype.stage}. ${archetype.note}`,
        activate: () => this.select(i),
      });
    });

    // Mother, at architectural scale, visible beyond the chamber.
    const mother = this.buildForm(ARCHETYPES[2]);
    mother.scale.setScalar(3.4);
    mother.position.set(0, 6.4, -7.0);
    (mother.children as THREE.Mesh[]).forEach((child) => {
      const mesh = child;
      if (mesh.material) mesh.material = this.standard(0x3d3550, { roughness: 0.9 });
    });
    this.group.add(mother);

    const motherLabel = buildLabel(scope, 'Mother', 1.1);
    motherLabel.position.set(0, 4.4, -6.9);
    this.group.add(motherLabel);
    scope.track(motherLabel.geometry);
  }

  /** A silhouette built from the archetype's own numbers, not a generic blob. */
  private buildForm(archetype: Archetype): THREE.Group {
    const scope = this.ctx.scope;
    const [radius, elongation, limbs, spines] = archetype.form;
    const group = new THREE.Group();
    const mat = this.standard(archetype.colour, { roughness: 0.55, metalness: 0.2 });

    const body = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(radius, radius * elongation, 6, 14)), mat);
    body.rotation.z = Math.PI / 2;
    body.position.y = radius * 1.1;
    group.add(body);

    const limbGeo = scope.track(new THREE.CapsuleGeometry(radius * 0.13, radius * 1.5, 4, 8));
    for (let i = 0; i < this.scaled(limbs); i++) {
      const a = (i / limbs) * Math.PI * 2;
      const limb = new THREE.Mesh(limbGeo, mat);
      limb.position.set(Math.sin(a) * radius * 0.8, radius * 0.55, Math.cos(a) * radius * elongation * 0.5);
      limb.rotation.z = Math.sin(a) * 0.5;
      limb.rotation.x = Math.cos(a) * 0.4;
      group.add(limb);
    }

    const spineGeo = scope.track(new THREE.ConeGeometry(radius * 0.11, radius * 0.85, 6));
    for (let i = 0; i < this.scaled(spines); i++) {
      const t = (i + 0.5) / spines;
      const spine = new THREE.Mesh(spineGeo, mat);
      spine.position.set((t - 0.5) * radius * elongation * 1.6, radius * 1.9, 0);
      spine.rotation.z = (t - 0.5) * 0.5;
      group.add(spine);
    }

    const head = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(radius * 0.55, 1)), mat);
    head.position.set(radius * elongation * 0.85, radius * 1.25, 0);
    group.add(head);

    return group;
  }

  private select(index: number): void {
    const archetype = ARCHETYPES[index];
    if (this.selected === index) {
      this.selected = -1;
      this.ctx.announce('The Egg closes.');
      return;
    }
    this.selected = index;

    // Rebuild the projection's contents by reusing the station specimen forms.
    this.projection.clear();
    const form = this.buildForm(archetype);
    form.scale.setScalar(0.85);
    form.position.y = -0.4;
    this.projection.add(form);
    this.projection.visible = true;

    this.ctx.announce(`${archetype.name} — ${archetype.stage}. ${archetype.note}`);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const target = this.selected >= 0 ? 1 : 0;
    this.openAmount += (target - this.openAmount) * Math.min(1, dt * (this.reducedMotion ? 20 : 5));

    // The shell plates part, and the solid egg fades behind them.
    this.forms.forEach((plate, i) => {
      const a = (i / this.forms.length) * Math.PI * 2;
      plate.position.set(Math.sin(a) * this.openAmount * 1.5, 0, Math.cos(a) * this.openAmount * 1.5);
      plate.rotation.z = this.openAmount * 0.5 * (i % 2 === 0 ? 1 : -1);
    });
    this.egg.scale.set(1 - this.openAmount * 0.7, 1.42 * (1 - this.openAmount * 0.7), 1 - this.openAmount * 0.7);
    this.projection.visible = this.openAmount > 0.05;
    this.projection.scale.setScalar(Math.max(0.001, this.openAmount));

    if (!this.reducedMotion) {
      this.eggShell.rotation.y += dt * 0.12;
      this.projection.rotation.y -= dt * 0.25;
    }
  }

  protected override onReset(): void {
    this.selected = -1;
    this.openAmount = 0;
    if (this.projection) {
      this.projection.clear();
      this.projection.visible = false;
      this.projection.rotation.set(0, 0, 0);
    }
    if (this.eggShell) this.eggShell.rotation.set(0, 0, 0);
    if (this.egg) this.egg.scale.set(1, 1.42, 1);
  }

  protected override describeState(): string {
    if (this.selected < 0) {
      return 'The Egg is closed. Five archetype stations surround it, one for each stage of the terraforming process.';
    }
    const a = ARCHETYPES[this.selected];
    return `The Egg is open on ${a.name}, which performs ${a.stage}. ${a.note}`;
  }
}
