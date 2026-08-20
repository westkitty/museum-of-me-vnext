import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E06 — Drakken Field Anatomy Archive. Tier B.
 *
 * Three forensic tables, each cycling through four anatomical layers. Two hold
 * canon specimens; the third holds a deliberately non-canon surrogate, and it is
 * marked as one in the geometry itself — a different table, a different plinth
 * colour, its own sign. Labelling teaching material at the point of creation
 * rather than at the point of publication is the archive's whole method.
 */

const LAYERS = [
  { name: 'External', note: 'The form as it is found in the field.' },
  { name: 'Skeletal', note: 'The frame that carries the process organs.' },
  { name: 'Energy and process', note: 'Where the terraforming work actually happens.' },
  { name: 'Section', note: 'Cut through, so the stages can be counted.' },
] as const;

interface Specimen {
  readonly name: string;
  readonly canon: boolean;
  readonly colour: number;
  readonly note: string;
}

const SPECIMENS: readonly Specimen[] = [
  { name: 'Gorevault, juvenile', canon: true, colour: 0x8a3a3a, note: 'Canon specimen. Collection-stage anatomy, before the gathering organs mature.' },
  { name: 'Ringthroat, adult', canon: true, colour: 0x5f9bd6, note: 'Canon specimen. The sky-making apparatus occupies most of the body cavity.' },
  { name: 'Teaching surrogate', canon: false, colour: 0x8a8a6a, note: 'NOT CANON. Invented for instruction, because teaching a structure sometimes needs an example canon does not contain.' },
];

export class FieldAnatomy extends ExhibitBase {
  private tables = this.tracked<THREE.Group>();
  private layerGroups = this.tracked<THREE.Group[]>();
  private dials = this.tracked<Dial>();
  private layers = this.tracked<number>();

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
    lectern.position.set(3.4, 0, -1.8);
    lectern.rotation.y = -0.8;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const steel = this.standard(0x8f96a0, { roughness: 0.35, metalness: 0.7 });
    // The surrogate's table is deliberately a different material. The separation
    // between canon and teaching material is physical, not typographic.
    const surrogateSteel = this.standard(0x6a6a52, { roughness: 0.8, metalness: 0.15 });

    SPECIMENS.forEach((specimen, i) => {
      const table = new THREE.Group();
      table.position.set(-3.6 + i * 3.6, 0, -4.2);
      this.group.add(table);
      this.tables.push(table);
      this.layers.push(0);

      const mat = specimen.canon ? steel : surrogateSteel;
      const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.0, 0.08, 1.1)), mat);
      top.position.y = 0.94;
      table.add(top);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.09, 0.94, 0.9)), mat);
        leg.position.set(s * 0.85, 0.47, 0);
        table.add(leg);
      }

      // Four stacked layers, one visible at a time.
      const groups: THREE.Group[] = [];
      LAYERS.forEach((_layer, li) => {
        const g = this.buildLayer(specimen, li);
        g.position.y = 1.05;
        g.visible = li === 0;
        table.add(g);
        groups.push(g);
      });
      this.layerGroups.push(groups);

      const nameLabel = buildLabel(scope, specimen.name, 1.55);
      nameLabel.position.set(0, 0.99, 0.42);
      nameLabel.rotation.x = -Math.PI / 2;
      table.add(nameLabel);
      scope.track(nameLabel.geometry);

      if (!specimen.canon) {
        const warning = buildLabel(scope, 'NON-CANON — teaching specimen', 1.7);
        warning.position.set(0, 1.9, -0.5);
        table.add(warning);
        scope.track(warning.geometry);
      }

      const consoleGroup = buildConsole(scope, 0.5, 0.4, 0.98, this.standard(0x322b4d, { roughness: 0.7 }));
      consoleGroup.position.set(0, 0, 1.3);
      table.add(consoleGroup);

      const dial = new Dial(scope, LAYERS.length, 0.19, { handle: this.emissive(specimen.colour, 0.8) });
      dial.group.position.set(0, 1.02, 0);
      consoleGroup.add(dial.group);
      this.dials.push(dial);

      this.control({
        object: consoleGroup,
        label: `${specimen.name}: next layer`,
        description: `${specimen.note} Cycles external, skeletal, energy and process, and section.`,
        activate: () => {
          this.layers[i] = dial.advance();
          groups.forEach((g, li) => (g.visible = li === this.layers[i]));
          this.ctx.announce(
            `${specimen.name} — ${LAYERS[this.layers[i]].name}. ${LAYERS[this.layers[i]].note}`,
          );
        },
      });
    });
  }

  /** Each layer is genuinely different geometry, not the same mesh recoloured. */
  private buildLayer(specimen: Specimen, layer: number): THREE.Group {
    const scope = this.ctx.scope;
    const group = new THREE.Group();
    const flesh = this.standard(specimen.colour, { roughness: 0.6 });
    const bone = this.standard(0xd8d0bc, { roughness: 0.75 });
    const energy = this.emissive(specimen.canon ? 0x7fd0ff : 0xb5b57a, 1.2);

    if (layer === 0) {
      const body = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.3, 0.9, 6, 14)), flesh);
      body.rotation.z = Math.PI / 2;
      group.add(body);
      for (let i = 0; i < this.scaled(6); i++) {
        const a = (i / 6) * Math.PI * 2;
        const limb = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8)), flesh);
        limb.position.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.45);
        limb.rotation.z = Math.sin(a) * 0.9;
        group.add(limb);
      }
    } else if (layer === 1) {
      const spine = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8)), bone);
      spine.rotation.z = Math.PI / 2;
      group.add(spine);
      for (let i = 0; i < this.scaled(9); i++) {
        const rib = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.26, 0.022, 5, 14, Math.PI)), bone);
        rib.position.x = -0.6 + i * 0.15;
        rib.rotation.y = Math.PI / 2;
        group.add(rib);
      }
    } else if (layer === 2) {
      // Process organs: one node per terraforming stage, chained.
      for (let i = 0; i < 4; i++) {
        const organ = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.13 + i * 0.03, 1)), energy);
        organ.position.set(-0.55 + i * 0.37, Math.sin(i) * 0.1, 0);
        group.add(organ);
        if (i > 0) {
          const duct = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.025, 0.025, 0.37, 6)), energy);
          duct.rotation.z = Math.PI / 2;
          duct.position.set(-0.73 + i * 0.37, Math.sin(i - 0.5) * 0.08, 0);
          group.add(duct);
        }
      }
    } else {
      const half = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.42, 20, 16, 0, Math.PI)),
        flesh,
      );
      half.rotation.y = -Math.PI / 2;
      half.scale.set(1, 0.8, 1.6);
      group.add(half);
      for (let i = 0; i < 4; i++) {
        const chamber = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 10)), energy);
        chamber.position.set(-0.45 + i * 0.32, 0.02, 0);
        group.add(chamber);
      }
    }
    return group;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    for (const dial of this.dials) dial.update(dt);
    if (this.reducedMotion) return;
    // Only the currently visible layer turns, so the tables read as inspectable.
    this.layerGroups.forEach((groups, i) => {
      groups[this.layers[i]].rotation.y += dt * 0.22;
    });
  }

  protected override onReset(): void {
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i] = 0;
      this.dials[i].value = 0;
      this.dials[i].update(0, true);
      this.layerGroups[i].forEach((g, li) => {
        g.visible = li === 0;
        g.rotation.set(0, 0, 0);
      });
    }
  }

  protected override describeState(): string {
    const parts = SPECIMENS.map((s, i) => `${s.name} showing ${LAYERS[this.layers[i]].name.toLowerCase()}`);
    return `Three tables: ${parts.join('; ')}. The third is a marked non-canon teaching specimen and is kept on a different table.`;
  }
}
