import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import { fibonacciSphere, rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E07 — The Drakken Terraforming Laboratory. Tier A.
 *
 * A planetary sphere suspended over an engineering floor. The visitor deploys
 * strains in order and the world visibly changes. The process lock is enforced
 * by the exhibit, not merely described by it: Ringthroat will not run until
 * Gorevault has produced feedstock, and pressing it early says so.
 *
 * That refusal is the exhibit's argument. Writing the process down proves it is
 * describable; running it proves it is coherent, and only the second test found
 * the ordering constraint.
 */

interface Stage {
  readonly key: string;
  readonly name: string;
  readonly by: string;
  readonly produces: string;
  readonly colour: number;
  readonly note: string;
}

const CHAIN: readonly Stage[] = [
  { key: 'collection', name: 'Collection', by: 'Gorevault', produces: 'raw mass', colour: 0x8a3a3a,
    note: 'The world is taken apart and what is taken is held.' },
  { key: 'gathering', name: 'Gathering', by: 'Gorevault', produces: 'concentrated mass', colour: 0xa04a3a,
    note: 'Still Gorevault. Gathering is a distinct function from collection.' },
  { key: 'rendering', name: 'Rendering', by: 'Gorevault', produces: 'refined stock', colour: 0xb5643a,
    note: 'Refinement. This is where the compendium is most often misread.' },
  { key: 'feedstock', name: 'Feedstock', by: 'Gorevault', produces: 'feedstock', colour: 0xc98a4a,
    note: 'The end of the Gorevault chain. Feedstock is not sky.' },
  { key: 'sky', name: 'SKY', by: 'Ringthroat', produces: 'atmosphere', colour: 0x5f9bd6,
    note: 'Only Ringthroat makes sky, and only from feedstock. Collapsing this with the Gorevault chain is the canonical error.' },
];

export class TerraformingLaboratory extends ExhibitBase {
  private world!: THREE.Mesh;
  private atmosphere!: THREE.Mesh;
  private surface = this.tracked<THREE.Mesh>();
  private stagePulses = this.tracked<Pulse>();
  private stageCurves = this.tracked<THREE.CatmullRomCurve3>();
  private consoles = this.tracked<THREE.Group>();
  private lamps = this.tracked<THREE.Mesh>();
  private completed = 0;
  private refusals = 0;

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
    lectern.position.set(3.6, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the world ──
    this.world = new THREE.Mesh(
      scope.track(new THREE.IcosahedronGeometry(2.3, 3)),
      this.standard(0x6b4a3a, { roughness: 0.95 }),
    );
    this.world.position.set(0, 5.4, -3.8);
    this.group.add(this.world);

    this.atmosphere = new THREE.Mesh(
      scope.track(new THREE.SphereGeometry(2.62, 28, 20)),
      scope.track(new THREE.MeshStandardMaterial({
        color: 0x7fb8e0, transparent: true, opacity: 0, roughness: 0.1, side: THREE.DoubleSide,
      })),
    );
    this.atmosphere.position.copy(this.world.position);
    this.group.add(this.atmosphere);

    // Surface features that change as the chain runs.
    const random = rng(7070);
    const featureGeo = scope.track(new THREE.IcosahedronGeometry(0.16, 0));
    const featureMat = this.standard(0x8a6a4a, { roughness: 0.9 });
    for (const p of fibonacciSphere(this.scaled(70), 2.3)) {
      const feature = new THREE.Mesh(featureGeo, featureMat);
      feature.position.copy(p).multiplyScalar(1.02);
      feature.scale.setScalar(0.6 + random() * 0.8);
      feature.lookAt(0, 0, 0);
      this.world.add(feature);
      this.surface.push(feature);
    }

    // ── the engineering floor: five stations in a line the visitor walks ──
    const floor = new THREE.Mesh(
      scope.track(new THREE.RingGeometry(2.0, 5.4, 40)),
      this.standard(0x2f2840, { roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.04, -3.8);
    this.group.add(floor);

    CHAIN.forEach((stage, i) => {
      const a = -0.9 + (i / (CHAIN.length - 1)) * 1.8;
      const consoleGroup = buildConsole(scope, 0.6, 0.46, 1.0, this.standard(0x322b4d, { roughness: 0.7 }));
      consoleGroup.position.set(Math.sin(a) * 4.6, 0, Math.cos(a) * 4.6 - 3.8);
      consoleGroup.rotation.y = a + Math.PI;
      this.group.add(consoleGroup);
      this.consoles.push(consoleGroup);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14)),
        this.emissive(stage.colour, 0.08),
      );
      lamp.position.set(0, 1.03, -0.1);
      consoleGroup.add(lamp);
      this.lamps.push(lamp);

      const label = buildLabel(scope, `${i + 1}. ${stage.name}`, 0.58);
      label.position.set(0, 1.02, 0.22);
      label.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(label);
      scope.track(label.geometry);

      const byLabel = buildLabel(scope, stage.by, 0.44);
      byLabel.position.set(0, 1.55, 0);
      consoleGroup.add(byLabel);
      scope.track(byLabel.geometry);

      // A conduit from each console up to the world.
      const from = new THREE.Vector3(Math.sin(a) * 4.6, 1.1, Math.cos(a) * 4.6 - 3.8);
      const to = new THREE.Vector3(0, 5.4, -3.8);
      const curve = new THREE.CatmullRomCurve3([
        from,
        from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.7, 0)),
        to,
      ]);
      this.stageCurves.push(curve);

      const conduit = new Filament(scope, this.scaled(14), 0.024, this.standard(0x3a3358, { roughness: 0.8 }));
      conduit.follow(curve);
      this.group.add(conduit.group);

      const pulse = new Pulse(scope, 0.11, this.emissive(stage.colour, 1.6));
      this.group.add(pulse.mesh);
      this.stagePulses.push(pulse);

      this.control({
        object: consoleGroup,
        label: `Deploy: ${stage.name} (${stage.by})`,
        description: `${stage.note} Produces ${stage.produces}.`,
        activate: () => this.deploy(i),
      });
    });
  }

  private deploy(index: number): void {
    if (index === this.completed) {
      this.stagePulses[index].start();
      return;
    }
    if (index < this.completed) {
      this.ctx.announce(`${CHAIN[index].name} has already run. The chain does not repeat a stage.`);
      return;
    }
    // The refusal. This is the exhibit's argument, so it says why.
    this.refusals++;
    const needed = CHAIN[this.completed];
    this.ctx.announce(
      `${CHAIN[index].name} will not run yet. ${CHAIN[index].by} needs ${needed.produces === 'feedstock' ? 'feedstock' : `the output of ${needed.name}`} first. Run ${needed.name} (${needed.by}).`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    for (let i = 0; i < this.stagePulses.length; i++) {
      const pulse = this.stagePulses[i];
      if (!pulse.isRunning) continue;
      if (pulse.update(dt, this.stageCurves[i], this.reducedMotion ? 4 : 0.8)) {
        this.completed = Math.min(CHAIN.length, i + 1);
        const stage = CHAIN[i];
        (this.lamps[i].material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
        this.ctx.announce(
          this.completed === CHAIN.length
            ? `${stage.name} complete. The world has sky. ${stage.note}`
            : `${stage.name} complete — ${stage.produces}. ${stage.note}`,
        );
      }
    }

    // The world answers the chain's progress.
    const progress = this.completed / CHAIN.length;
    const worldMat = this.world.material as THREE.MeshStandardMaterial;
    worldMat.color.lerpColors(new THREE.Color(0x6b4a3a), new THREE.Color(0x3f7a52), progress);
    (this.atmosphere.material as THREE.MeshStandardMaterial).opacity =
      this.completed >= CHAIN.length ? 0.28 : progress * 0.08;

    for (let i = 0; i < this.surface.length; i++) {
      const target = 0.6 + progress * 0.9;
      this.surface[i].scale.lerp(
        new THREE.Vector3(target, target, target),
        this.reducedMotion ? 1 : Math.min(1, dt * 2),
      );
    }

    if (!this.reducedMotion) {
      this.world.rotation.y += dt * 0.09;
      this.atmosphere.rotation.y -= dt * 0.05;
    }
  }

  protected override onReset(): void {
    this.completed = 0;
    this.refusals = 0;
    for (const pulse of this.stagePulses) pulse.stop();
    for (const lamp of this.lamps) {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.08;
    }
    if (this.world) {
      this.world.rotation.set(0, 0, 0);
      (this.world.material as THREE.MeshStandardMaterial).color.setHex(0x6b4a3a);
    }
    if (this.atmosphere) {
      this.atmosphere.rotation.set(0, 0, 0);
      (this.atmosphere.material as THREE.MeshStandardMaterial).opacity = 0;
    }
    for (const feature of this.surface) feature.scale.setScalar(0.6);
  }

  protected override describeState(): string {
    if (this.completed === 0) {
      return 'The world is untouched. Five stations stand ready, and the chain must be run in order: collection, gathering, rendering, feedstock, then SKY.';
    }
    if (this.completed >= CHAIN.length) {
      return 'The chain is complete. Gorevault collected, gathered, rendered and produced feedstock; Ringthroat turned it into sky. The world is habitable.';
    }
    const done = CHAIN.slice(0, this.completed).map((s) => s.name).join(', ');
    const next = CHAIN[this.completed];
    const refused = this.refusals > 0 ? ` The process lock has refused an out-of-order deployment ${this.refusals} time${this.refusals === 1 ? '' : 's'}.` : '';
    return `Completed: ${done}. Next: ${next.name}, performed by ${next.by}.${refused}`;
  }
}
