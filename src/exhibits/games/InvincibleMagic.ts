import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Filament } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E24 — Era of Invincible Magic: Lands Unknown. Tier A.
 *
 * A campaign map table. Selecting a region raises its terrain and lights the
 * campaign paths that lead there. Underneath, every region, unit and path is a
 * record with an identifier — which is the project's actual method: a campaign
 * this size is a database problem wearing a narrative costume, and the
 * identifiers are what keep it consistent.
 */

interface Region {
  readonly id: string;
  readonly name: string;
  readonly terrain: 'hills' | 'marsh' | 'forest' | 'keep';
  readonly x: number;
  readonly z: number;
  readonly units: readonly string[];
  readonly note: string;
}

const REGIONS: readonly Region[] = [
  { id: 'reg_westmarch', name: 'Westmarch', terrain: 'hills', x: -1.5, z: 0.6,
    units: ['unit_march_warden', 'unit_hill_archer'],
    note: 'The opening scenario. Two unit identifiers, referenced in dialogue, balance tables and the map.' },
  { id: 'reg_saltfen', name: 'Saltfen', terrain: 'marsh', x: -0.4, z: -0.7,
    units: ['unit_fen_walker'],
    note: 'Movement costs are the mechanic here, so the terrain identifier does real work.' },
  { id: 'reg_thornwood', name: 'Thornwood', terrain: 'forest', x: 0.9, z: 0.2,
    units: ['unit_thorn_ranger', 'unit_briar_adept', 'unit_grove_elder'],
    note: 'Three units, each cross-referenced from four files. Rename one and the campaign breaks silently.' },
  { id: 'reg_lastkeep', name: 'Last Keep', terrain: 'keep', x: 1.7, z: -0.9,
    units: ['unit_keep_castellan'],
    note: 'The finale. Its identifier appears in every prior scenario as a foreshadowed destination.' },
];

export class InvincibleMagic extends ExhibitBase {
  private table!: THREE.Group;
  private terrains = this.tracked<THREE.Group>();
  private paths = this.tracked<Filament>();
  private markers = this.tracked<THREE.Mesh>();
  private selected = -1;

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
    lectern.position.set(3.5, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x6b4a30, { roughness: 0.72 });
    const cloth = this.standard(0x4a4030, { roughness: 0.95 });

    // ── the map table ──
    this.table = new THREE.Group();
    this.table.position.set(0, 0, -4.0);
    this.group.add(this.table);

    const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.8, 0.12, 3.2)), wood);
    top.position.y = 0.9;
    this.table.add(top);

    const surface = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.5, 0.02, 2.9)), cloth);
    surface.position.y = 0.97;
    this.table.add(surface);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.16, 0.9, 0.16)), wood);
        leg.position.set(sx * 2.1, 0.45, sz * 1.35);
        this.table.add(leg);
      }
    }

    // ── regions ──
    const random = rng(24024);
    REGIONS.forEach((region, i) => {
      const terrain = this.buildTerrain(region, random);
      terrain.position.set(region.x, 0.98, region.z);
      terrain.scale.y = 0.001;
      this.table.add(terrain);
      this.terrains.push(terrain);

      const marker = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(0.16, 0.19, 0.05, 12)),
        this.emissive(0xd97a4e, 0.3),
      );
      marker.position.set(region.x, 0.99, region.z);
      this.table.add(marker);
      this.markers.push(marker);

      const label = buildLabel(scope, region.name, 0.72);
      label.position.set(region.x, 0.995, region.z + 0.42);
      label.rotation.x = -Math.PI / 2;
      this.table.add(label);
      scope.track(label.geometry);

      const consoleGroup = buildConsole(scope, 0.54, 0.42, 1.0, wood);
      const a = -0.7 + (i / (REGIONS.length - 1)) * 1.4;
      consoleGroup.position.set(Math.sin(a) * 3.4, 0, Math.cos(a) * 3.4 - 4.0 + 3.0);
      consoleGroup.rotation.y = a + Math.PI;
      this.group.add(consoleGroup);

      const consoleLabel = buildLabel(scope, region.name, 0.56);
      consoleLabel.position.set(0, 1.02, 0.2);
      consoleLabel.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(consoleLabel);
      scope.track(consoleLabel.geometry);

      this.control({
        object: consoleGroup,
        label: `Select region: ${region.name}`,
        description: `${region.note} Identifier ${region.id}, ${region.units.length} unit record${region.units.length === 1 ? '' : 's'}.`,
        activate: () => this.select(i),
      });
    });

    // ── campaign paths between regions ──
    const pathMat = this.emissive(0xe8c65a, 0.15);
    for (let i = 0; i < REGIONS.length - 1; i++) {
      const a = new THREE.Vector3(REGIONS[i].x, 1.03, REGIONS[i].z);
      const b = new THREE.Vector3(REGIONS[i + 1].x, 1.03, REGIONS[i + 1].z);
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.22, 0));
      const path = new Filament(scope, 12, 0.018, pathMat);
      path.follow(new THREE.CatmullRomCurve3([a, mid, b]));
      this.table.add(path.group);
      this.paths.push(path);
    }
  }

  /** Terrain built from the region's own type, not a generic bump. */
  private buildTerrain(region: Region, random: () => number): THREE.Group {
    const scope = this.ctx.scope;
    const group = new THREE.Group();
    const colours = { hills: 0x7a8a52, marsh: 0x4a5a48, forest: 0x3f6b42, keep: 0x8a8276 };
    const mat = this.standard(colours[region.terrain], { roughness: 0.9 });

    if (region.terrain === 'keep') {
      const keep = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.3, 0.5, 0.3)), mat);
      keep.position.y = 0.25;
      group.add(keep);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const tower = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.07, 0.08, 0.66, 8)), mat);
          tower.position.set(sx * 0.16, 0.33, sz * 0.16);
          group.add(tower);
        }
      }
    } else if (region.terrain === 'forest') {
      for (let i = 0; i < this.scaled(9); i++) {
        const tree = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.07, 0.28, 6)), mat);
        tree.position.set((random() - 0.5) * 0.6, 0.14, (random() - 0.5) * 0.6);
        group.add(tree);
      }
    } else if (region.terrain === 'marsh') {
      for (let i = 0; i < this.scaled(6); i++) {
        const pool = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10)), mat);
        pool.position.set((random() - 0.5) * 0.6, 0.02, (random() - 0.5) * 0.6);
        group.add(pool);
      }
    } else {
      for (let i = 0; i < this.scaled(5); i++) {
        const hill = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), mat);
        hill.position.set((random() - 0.5) * 0.55, 0, (random() - 0.5) * 0.55);
        hill.scale.y = 0.6 + random() * 0.6;
        group.add(hill);
      }
    }
    return group;
  }

  private select(index: number): void {
    this.selected = this.selected === index ? -1 : index;
    if (this.selected < 0) {
      this.ctx.announce('Region cleared. The campaign map is flat again.');
      return;
    }
    const region = REGIONS[index];
    this.ctx.announce(
      `${region.name} (${region.id}). ${region.units.length} unit record${region.units.length === 1 ? '' : 's'}: ${region.units.join(', ')}. ${region.note}`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 4);
    for (let i = 0; i < this.terrains.length; i++) {
      const target = i === this.selected ? 1 : 0.001;
      this.terrains[i].scale.y += (target - this.terrains[i].scale.y) * rate;

      const marker = this.markers[i].material as THREE.MeshStandardMaterial;
      const want = i === this.selected ? 1.5 : 0.3;
      marker.emissiveIntensity += (want - marker.emissiveIntensity) * rate;
    }

    // Paths touching the selected region light up.
    for (let i = 0; i < this.paths.length; i++) {
      const active = this.selected === i || this.selected === i + 1;
      this.paths[i].group.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity += ((active ? 1.3 : 0.15) - m.emissiveIntensity) * rate;
      });
    }
  }

  protected override onReset(): void {
    this.selected = -1;
    for (const terrain of this.terrains) terrain.scale.y = 0.001;
  }

  protected override describeState(): string {
    if (this.selected < 0) {
      return `The campaign map is flat. Four regions are marked: ${REGIONS.map((r) => r.name).join(', ')}.`;
    }
    const r = REGIONS[this.selected];
    return `${r.name} is raised, showing ${r.terrain} terrain. ${r.units.length} unit record${r.units.length === 1 ? '' : 's'} belong to it, and the campaign paths that reach it are lit.`;
  }
}
