import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E18 — Dex Companion & Agent Systems. Tier C.
 *
 * Three agent roles and a memory column. A request is routed to a role, and the
 * column shows exactly what that role is permitted to read and write — with a
 * forget operation that leaves a visible mark rather than erasing the record.
 *
 * These are systems named after Dexter. Dexter himself is in the Sanctuary
 * below the Rotunda, and this exhibit exists partly to make that boundary
 * legible: this room is about software.
 */

interface Role {
  readonly name: string;
  readonly project: string;
  readonly reads: number;
  readonly writes: boolean;
  readonly colour: number;
  readonly note: string;
}

const ROLES: readonly Role[] = [
  {
    name: 'Continuity', project: 'DexGPT', reads: 5, writes: true, colour: 0x3fb9b2,
    note: 'Governs voice, exactness and what must not be silently decided for you. Reads the whole record and writes to it.',
  },
  {
    name: 'Companion', project: 'DexClawdBot', reads: 3, writes: true, colour: 0xe8c65a,
    note: 'Append-only memory with provenance on every entry. You can inspect, correct, pin or forget — and forgetting leaves a mark.',
  },
  {
    name: 'Moderation', project: 'DexKeeper Bot', reads: 1, writes: false, colour: 0xd97a4e,
    note: 'One community, local storage, no public address. Reads only what it needs and writes nothing back to the record.',
  },
];

const MEMORY_ENTRIES = 6;

export class CompanionSystems extends ExhibitBase {
  private entries = this.tracked<THREE.Mesh>();
  private entryState = this.tracked<'live' | 'pinned' | 'forgotten'>();
  private roleLamps = this.tracked<THREE.Mesh>();
  private pulse!: Pulse;
  private curve!: THREE.CatmullRomCurve3;
  private column!: THREE.Group;
  private role = -1;

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

    const steel = this.standard(0x8f9a9c, { roughness: 0.35, metalness: 0.65 });
    const glass = this.standard(0xdde3e1, { roughness: 0.6 });

    // ── the memory column ──
    this.column = new THREE.Group();
    this.column.position.set(2.6, 0, -4.4);
    this.group.add(this.column);

    const spine = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.09, 0.12, 3.4, 12)), steel);
    spine.position.y = 1.7;
    this.column.add(spine);

    for (let i = 0; i < MEMORY_ENTRIES; i++) {
      const entry = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.7, 0.16, 0.42)),
        this.emissive(0x3fb9b2, 0.6),
      );
      entry.position.set(0, 0.55 + i * 0.44, 0);
      this.column.add(entry);
      this.entries.push(entry);
      this.entryState.push('live');
    }

    const columnLabel = buildLabel(scope, 'Append-only memory', 1.2);
    columnLabel.position.set(0, 3.3, 0);
    this.column.add(columnLabel);
    scope.track(columnLabel.geometry);

    // ── three role stations ──
    ROLES.forEach((role, i) => {
      const station = new THREE.Group();
      station.position.set(-3.2 + i * 1.9, 0, -3.0);
      this.group.add(station);

      const consoleGroup = buildConsole(scope, 0.62, 0.46, 1.0, steel);
      station.add(consoleGroup);

      const body = new THREE.Mesh(
        scope.track(new THREE.IcosahedronGeometry(0.28, 1)),
        this.standard(role.colour, { roughness: 0.45, metalness: 0.25 }),
      );
      body.position.y = 1.35;
      station.add(body);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.05, 10, 8)),
        this.emissive(role.colour, 0.08),
      );
      lamp.position.set(0, 1.03, 0.16);
      station.add(lamp);
      this.roleLamps.push(lamp);

      const label = buildLabel(scope, role.name, 0.7);
      label.position.set(0, 1.82, 0);
      station.add(label);
      scope.track(label.geometry);

      const projectLabel = buildLabel(scope, role.project, 0.62);
      projectLabel.position.set(0, 1.02, 0.22);
      projectLabel.rotation.x = -Math.PI / 2.1;
      station.add(projectLabel);
      scope.track(projectLabel.geometry);

      this.control({
        object: station,
        label: `Route the request to ${role.name}`,
        description: `${role.note} Reads ${role.reads} of ${MEMORY_ENTRIES} memory entries and ${role.writes ? 'writes back' : 'writes nothing'}.`,
        activate: () => this.route(i),
      });
    });

    // ── the conduit from the roles to the memory column ──
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.4, 1.3, -3.0),
      new THREE.Vector3(0.8, 2.4, -3.6),
      new THREE.Vector3(2.6, 1.8, -4.4),
    ]);
    const conduit = new Filament(scope, this.scaled(16), 0.025, glass);
    conduit.follow(this.curve);
    this.group.add(conduit.group);

    this.pulse = new Pulse(scope, 0.09, this.emissive(0xe8c65a, 1.6));
    this.group.add(this.pulse.mesh);

    // ── the forget control, physically separate from the roles ──
    const forgetConsole = buildConsole(scope, 0.56, 0.42, 1.0, this.standard(0x5a4a44, { roughness: 0.7 }));
    forgetConsole.position.set(2.6, 0, -1.5);
    this.group.add(forgetConsole);

    const forgetLabel = buildLabel(scope, 'Forget an entry', 0.6);
    forgetLabel.position.set(0, 1.02, 0.2);
    forgetLabel.rotation.x = -Math.PI / 2.1;
    forgetConsole.add(forgetLabel);
    scope.track(forgetLabel.geometry);

    this.control({
      object: forgetConsole,
      label: 'Forget the topmost entry',
      description:
        'Marks an entry forgotten. The entry does not vanish — the record shows that something was forgotten and when. A forget button that leaves no mark is not a memory control.',
      activate: () => this.forget(),
    });
  }

  private route(index: number): void {
    this.role = index;
    const role = ROLES[index];
    this.roleLamps.forEach((l, li) => {
      (l.material as THREE.MeshStandardMaterial).emissiveIntensity = li === index ? 1.5 : 0.08;
    });
    this.pulse.start();
    this.ctx.announce(
      `Routed to ${role.name} (${role.project}). It may read ${role.reads} of ${MEMORY_ENTRIES} entries and ${role.writes ? 'may write back' : 'may not write at all'}. ${role.note}`,
    );
  }

  private forget(): void {
    const index = this.entryState.findIndex((s) => s === 'live');
    if (index < 0) {
      this.ctx.announce('Every entry is already pinned or marked forgotten.');
      return;
    }
    this.entryState[index] = 'forgotten';
    this.ctx.announce(
      'Entry marked forgotten. It stays in the column, greyed and struck, so the record still shows that something was there.',
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.pulse.isRunning) {
      this.pulse.update(dt, this.curve, this.reducedMotion ? 4 : 1.1);
    }

    const readable = this.role >= 0 ? ROLES[this.role].reads : 0;
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const mat = entry.material as THREE.MeshStandardMaterial;
      if (this.entryState[i] === 'forgotten') {
        mat.emissive.setHex(0x2a2a2a);
        mat.emissiveIntensity = 0.05;
        entry.scale.set(1, 0.35, 1);
        continue;
      }
      entry.scale.set(1, 1, 1);
      const visible = i < readable;
      mat.emissive.setHex(visible ? (this.role >= 0 ? ROLES[this.role].colour : 0x3fb9b2) : 0x1e2628);
      const target = visible ? 0.9 : 0.08;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
    }

    if (!this.reducedMotion) this.column.rotation.y += dt * 0.12;
  }

  protected override onReset(): void {
    this.role = -1;
    this.pulse.stop();
    for (let i = 0; i < this.entryState.length; i++) {
      this.entryState[i] = 'live';
      this.entries[i].scale.set(1, 1, 1);
    }
    for (const lamp of this.roleLamps) {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.08;
    }
    if (this.column) this.column.rotation.set(0, 0, 0);
  }

  protected override describeState(): string {
    const forgotten = this.entryState.filter((s) => s === 'forgotten').length;
    const note = forgotten > 0 ? ` ${forgotten} entr${forgotten === 1 ? 'y is' : 'ies are'} marked forgotten and still visible in the column.` : '';
    if (this.role < 0) {
      return `No request is routed. The memory column holds ${MEMORY_ENTRIES} entries.${note}`;
    }
    const role = ROLES[this.role];
    return `The request is routed to ${role.name}, which may read ${role.reads} of ${MEMORY_ENTRIES} entries and ${role.writes ? 'may write back' : 'may not write'}.${note}`;
  }
}
