import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E20 — Utility & Privacy Bench. Tier C.
 *
 * A workbench of synthetic files. The visitor can audit, sort and explain them
 * — and cannot delete them, because the mechanism has no such lever. The absent
 * control is the exhibit: all three projects represented here are defined by
 * what they refuse to do.
 *
 * SAFETY: every file on this bench is invented. The exhibit has no filesystem
 * access of any kind.
 */

type Category = 'photos' | 'caches' | 'downloads' | 'duplicates' | 'system';

interface Bin {
  readonly key: Category;
  readonly name: string;
  readonly note: string;
  readonly colour: number;
  readonly caption?: string;
}

const BINS: readonly Bin[] = [
  { key: 'photos', name: 'Photographs', colour: 0x3fb9b2, caption: 'Photos stay here',
    note: 'The archive itself. Never moved off the device and never deleted — the device is the source, not a cache.' },
  { key: 'duplicates', name: 'Duplicates', colour: 0xe8c65a,
    note: 'Marked, never removed. The tool tells you they exist; you decide what happens next.' },
  { key: 'caches', name: 'Caches', colour: 0xd97a4e, caption: 'The app can rebuild these',
    note: 'The application can rebuild these files when it needs them.' },
  { key: 'downloads', name: 'Downloads', colour: 0x9d8bff, caption: 'Only you know what matters here',
    note: 'Review these yourself. A download may be your only copy.' },
  { key: 'system', name: 'System', colour: 0x8f9a9c,
    note: 'Explained, never touched. Overstating what can be cleared here is why this category of tool is distrusted.' },
];

const FILE_COUNT = 36;

export class UtilityBench extends ExhibitBase {
  /** Reused by onUpdate; bin counts are transient values, not per-frame arrays. */
  private readonly binCounts = new Uint8Array(BINS.length);
  private files = this.tracked<THREE.Mesh>();
  private fileBins = this.tracked<number>();
  private homes = this.tracked<THREE.Vector3>();
  private binSlots = this.tracked<THREE.Vector3>();
  private sorted = false;
  private explained = -1;
  private meters = this.tracked<{ mesh: THREE.Mesh; left: number; count: number }>();

  /** Reused every frame; allocating these per element churned the heap. */
  private readonly scratchTarget = new THREE.Vector3();

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

    const steel = this.standard(0x9aa4a6, { roughness: 0.35, metalness: 0.6 });
    const top = this.standard(0xdde3e1, { roughness: 0.7 });

    // ── the bench ──
    const bench = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5.4, 0.1, 1.5)), top);
    bench.position.set(0, 0.94, -3.6);
    this.group.add(bench);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.11, 0.94, 1.3)), steel);
      leg.position.set(s * 2.4, 0.47, -3.6);
      this.group.add(leg);
    }

    // ── the bins ──
    const random = rng(20240);
    BINS.forEach((bin, i) => {
      const x = -2.2 + i * 1.1;
      const tray = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.9, 0.06, 0.75)),
        this.standard(bin.colour, { roughness: 0.55 }),
      );
      tray.position.set(x, 1.02, -3.9);
      this.group.add(tray);
      this.binSlots.push(new THREE.Vector3(x, 1.08, -3.9));

      const label = buildLabel(scope, bin.caption ? `${bin.name}\n${bin.caption}` : bin.name, 1.02, 0.4);
      label.position.set(x, 1.03, -3.35);
      label.rotation.x = -Math.PI / 2;
      this.group.add(label);
      scope.track(label.geometry);
    });

    // ── the synthetic files ──
    const fileGeo = scope.track(new THREE.BoxGeometry(0.16, 0.03, 0.2));
    for (let i = 0; i < this.scaled(FILE_COUNT); i++) {
      const bin = Math.floor(random() * BINS.length);
      const file = new THREE.Mesh(fileGeo, this.standard(0xf0f2f2, { roughness: 0.8 }));
      const home = new THREE.Vector3(
        -2.4 + random() * 4.8,
        1.02 + Math.floor(i / 12) * 0.035,
        -3.35 + random() * 0.5,
      );
      file.position.copy(home);
      file.rotation.y = random() * 0.5 - 0.25;
      this.group.add(file);
      this.files.push(file);
      this.fileBins.push(bin);
      this.homes.push(home);
    }

    // Track rebuildable files separately from files that need a person to decide.
    for (const [key, x, caption, color] of [
      ['caches', -1.25, 'Can be rebuilt', 0xd97a4e],
      ['downloads', 1.25, 'Needs your review', 0x9d8bff],
    ] as const) {
      const frame = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.9, 0.3, 0.08)), steel);
      frame.position.set(x, 1.42, -4.3);
      this.group.add(frame);

      const fill = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.7, 0.2, 0.06)), this.emissive(color, 0.9));
      const left = x - 0.85;
      fill.position.set(left, 1.42, -4.25);
      fill.scale.x = 0.001;
      this.group.add(fill);
      this.meters.push({
        mesh: fill,
        left,
        count: this.fileBins.filter((binIndex) => BINS[binIndex].key === key).length,
      });

      const label = buildLabel(scope, caption, 1.75, 0.18);
      label.position.set(x, 1.73, -4.3);
      this.group.add(label);
    }

    // ── controls ──
    const sortConsole = buildConsole(scope, 0.6, 0.44, 1.0, steel);
    sortConsole.position.set(-3.3, 0, -2.4);
    sortConsole.rotation.y = 0.5;
    this.group.add(sortConsole);

    const sortLabel = buildLabel(scope, 'Audit and sort', 0.6);
    sortLabel.position.set(0, 1.02, 0.2);
    sortLabel.rotation.x = -Math.PI / 2.1;
    sortConsole.add(sortLabel);
    scope.track(sortLabel.geometry);

    this.control({
      object: sortConsole,
      label: () => (this.sorted ? 'Return the files' : 'Audit and sort the files'),
      description:
        'Sorts the sample files and shows which can be rebuilt and which need a decision.',
      activate: () => {
        this.sorted = !this.sorted;
        this.ctx.announce(
          this.sorted
            ? `Sorted. ${this.fileSummary()}`
            : 'Files returned to the bench. Nothing was moved off the device and nothing was destroyed.',
        );
      },
    });

    BINS.forEach((bin, i) => {
      const x = -2.2 + i * 1.1;
      const probe = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10)),
        this.emissive(bin.colour, 0.5),
      );
      probe.position.set(x, 1.16, -4.28);
      this.group.add(probe);

      this.control({
        object: probe,
        label: `Explain: ${bin.name}`,
        description: bin.note,
        activate: () => {
          this.explained = i;
          this.ctx.announce(`${bin.name}. ${bin.note}`);
        },
      });
    });

    // The absent control, named. A gap the visitor can see is a design statement.
    const absent = buildLabel(scope, 'There is no delete lever on this bench.', 3.6, 0.14);
    absent.position.set(0, 3.75, -7.15);
    this.group.add(absent);
    scope.track(absent.geometry);
  }

  private fileSummary(): string {
    return `The app can rebuild ${this.meters[0].count} files. Review ${this.meters[1].count} downloads yourself. Photos stay here.`;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 3);
    this.binCounts.fill(0);

    for (let i = 0; i < this.files.length; i++) {
      let target: THREE.Vector3;
      if (this.sorted) {
        target = this.scratchTarget.copy(this.binSlots[this.fileBins[i]]);
        target.y += this.binCounts[this.fileBins[i]]++ * 0.035;
      } else {
        target = this.homes[i];
      }
      this.files[i].position.lerp(target, rate);
    }

    for (const { mesh, left, count } of this.meters) {
      const fraction = this.sorted ? count / Math.max(1, this.files.length) : 0;
      mesh.scale.x += (Math.max(0.001, fraction) - mesh.scale.x) * rate;
      mesh.position.x = left + (1.7 * mesh.scale.x) / 2;
    }
  }

  protected override onReset(): void {
    this.sorted = false;
    this.explained = -1;
    for (let i = 0; i < this.files.length; i++) this.files[i].position.copy(this.homes[i]);
    for (const { mesh, left } of this.meters) {
      mesh.scale.x = 0.001;
      mesh.position.x = left;
    }
  }

  protected override describeState(): string {
    const explained = this.explained >= 0 ? ` The ${BINS[this.explained].name.toLowerCase()} category is currently explained.` : '';
    if (!this.sorted) {
      return `${this.files.length} synthetic files lie unsorted on the bench. Nothing here touches a real filesystem.${explained}`;
    }
    return `Sorted into five categories. ${this.fileSummary()} There is no delete control.${explained}`;
  }
}
