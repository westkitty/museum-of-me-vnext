import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E06 — Starsilk Compendium: Character & Canon Archive.
 * A character/canon constellation rather than another Drakken anatomy table.
 */

interface Folio {
  readonly name: string;
  readonly role: string;
  readonly colour: number;
  readonly locks: readonly string[];
}

const FOLIOS: readonly Folio[] = [
  { name: 'Codec', role: 'principal character folio', colour: 0x4f8cff, locks: ['identity', 'visual law', 'chronology', 'relationships'] },
  { name: 'Tiger', role: 'principal character folio', colour: 0x78a8ff, locks: ['identity', 'visual law', 'cosmological role', 'chronology'] },
  { name: 'Syrin', role: 'canon-critical folio', colour: 0xbd78ff, locks: ['identity', 'nullification law', 'relationships', 'terminology'] },
  { name: 'Drakken Register', role: 'species and strain folios', colour: 0xd46b6b, locks: ['taxonomy', 'strain identity', 'process law', 'forbidden drift'] },
  { name: 'WorldsVault', role: 'supporting lore material', colour: 0xd1b46a, locks: ['source provenance', 'cross-reference', 'chronology', 'status'] },
];

export class StarsilkCompendium extends ExhibitBase {
  private nodes = this.tracked<THREE.Group>();
  private cores = this.tracked<THREE.Mesh>();
  private links = this.tracked<Filament>();
  private selected = 0;
  private canonView = false;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.2, -7.2); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(3.4, 0, -4.8); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const archive = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.62, 0.78, 1.0, 16)), this.standard(0x20243a, { roughness: 0.45, metalness: 0.5 }));
    archive.position.set(0, 0.5, -4.0); this.group.add(archive);
    const archiveCore = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.32, 2)), this.emissive(0x5aa8ff, 1.0));
    archiveCore.position.set(0, 1.45, -4.0); this.group.add(archiveCore);

    const centre = new THREE.Vector3(0, 1.45, -4.0);
    const positions = FOLIOS.map((_, i) => {
      const a = (i / FOLIOS.length) * Math.PI * 2 - Math.PI / 2;
      return new THREE.Vector3(Math.cos(a) * 2.5, 2.0 + (i % 2) * 0.45, -4.0 + Math.sin(a) * 1.9);
    });

    FOLIOS.forEach((folio, i) => {
      const g = new THREE.Group(); g.position.copy(positions[i]); this.group.add(g); this.nodes.push(g);
      const core = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(i < 3 ? 0.28 : 0.23, 1)), this.emissive(folio.colour, i === 0 ? 1.2 : 0.45));
      g.add(core); this.cores.push(core);
      const frame = new THREE.Mesh(scope.track(new THREE.TorusGeometry(i < 3 ? 0.46 : 0.39, 0.025, 8, 28)), this.standard(0x7780a4, { roughness: 0.4, metalness: 0.55 }));
      frame.rotation.x = Math.PI / 2; g.add(frame);
      const label = buildLabel(scope, folio.name, 1.25); label.position.set(0, 0.68, 0); g.add(label); scope.track(label.geometry);
      const role = buildLabel(scope, folio.role, 1.4); role.position.set(0, -0.58, 0); g.add(role); scope.track(role.geometry);

      const midpoint = positions[i].clone().lerp(centre, 0.45).add(new THREE.Vector3(0, 0.3, 0));
      const link = new Filament(scope, this.scaled(16), 0.018, this.standard(0x324d72, { roughness: 0.65 }));
      link.follow(new THREE.CatmullRomCurve3([centre, midpoint, positions[i]])); this.group.add(link.group); this.links.push(link);

      this.control({
        object: g,
        label: `Inspect ${folio.name}`,
        description: `Opens the ${folio.role}. Canon view exposes the invariant categories downstream work must preserve rather than treating the newest generated artifact as authority.`,
        activate: () => {
          this.selected = i;
          const mode = this.canonView ? ` Canon locks: ${folio.locks.join(', ')}.` : '';
          this.ctx.announce(`${folio.name} — ${folio.role}.${mode}`);
        },
      });
    });

    const consoleGroup = buildConsole(scope, 0.7, 0.5, 1.0, this.standard(0x252b45, { roughness: 0.65 }));
    consoleGroup.position.set(0, 0, -1.5); this.group.add(consoleGroup);
    const modeLabel = buildLabel(scope, 'CANON VIEW', 0.72); modeLabel.position.set(0, 1.02, 0.2); modeLabel.rotation.x = -Math.PI / 2.1; consoleGroup.add(modeLabel); scope.track(modeLabel.geometry);
    this.control({
      object: consoleGroup,
      label: () => (this.canonView ? 'Hide canon invariants' : 'Show canon invariants'),
      description: 'Switches the constellation from folio view to machine-readable canon-lock view.',
      activate: () => {
        this.canonView = !this.canonView;
        const folio = FOLIOS[this.selected];
        this.ctx.announce(this.canonView ? `Canon view. ${folio.name}: ${folio.locks.join(', ')}.` : 'Folio view. Generated presentation returns to the foreground; authority remains in the versioned sources.');
      },
    });

    const provenance = buildLabel(scope, 'Generated presentation ← versioned sources ← canon invariants', 3.2);
    provenance.position.set(0, 4.9, -6.4); this.group.add(provenance); scope.track(provenance.geometry);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const active = i === this.selected;
      const mat = this.cores[i].material as THREE.MeshStandardMaterial;
      const target = active ? (this.canonView ? 1.8 : 1.3) : (this.canonView ? 0.7 : 0.35);
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
      const targetScale = active ? 1.14 : 1;
      const amount = this.reducedMotion ? 1 : Math.min(1, dt * 4);
      const currentScale = this.nodes[i].scale.x;
      this.nodes[i].scale.setScalar(currentScale + (targetScale - currentScale) * amount);
      if (!this.reducedMotion) this.nodes[i].rotation.y += dt * (active ? 0.2 : 0.05);
    }
  }

  protected override onReset(): void {
    this.selected = 0; this.canonView = false;
    for (const node of this.nodes) { node.scale.setScalar(1); node.rotation.set(0, 0, 0); }
  }

  protected override describeState(): string {
    const folio = FOLIOS[this.selected];
    return this.canonView
      ? `Canon view is active on ${folio.name}. Locked categories: ${folio.locks.join(', ')}.`
      : `${folio.name} is selected in folio view. Five source-grounded archive nodes surround the generated-publication core.`;
  }
}
