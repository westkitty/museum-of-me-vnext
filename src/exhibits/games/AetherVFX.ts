import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Lever } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E30 — AetherVFX. Tier B.
 *
 * A transparent chamber with a live particle effect and five faders. There is
 * no apply step: every change reshapes the effect on the next frame, because
 * anything judged by eye must have a feedback loop of zero.
 *
 * The particle system runs on the museum's single frame loop like everything
 * else — this exhibit has no loop of its own, which is the law the project it
 * represents shares with the museum.
 */

const CONTROLS = [
  { name: 'Emitter', note: 'How many particles are born per second.' },
  { name: 'Force', note: 'The steady push acting on every particle.' },
  { name: 'Lifetime', note: 'How long a particle survives. Changes the shape more than anything else.' },
  { name: 'Turbulence', note: 'Chaotic displacement. Small amounts read as life; large amounts read as noise.' },
  { name: 'Colour shift', note: 'How far the colour travels over a particle life.' },
] as const;

const PARTICLES = 220;

export class AetherVFX extends ExhibitBase {
  private particles!: THREE.InstancedMesh;
  private positions = this.tracked<THREE.Vector3>();
  private velocities = this.tracked<THREE.Vector3>();
  private ages = this.tracked<number>();
  private seeds = this.tracked<number>();
  private levers = this.tracked<Lever>();
  private values = this.tracked<number>();
  private chamber!: THREE.Mesh;

  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scaleVec = new THREE.Vector3();
  private readonly colour = new THREE.Color();

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
    lectern.position.set(3.3, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const frame = this.standard(0x3a3f44, { roughness: 0.4, metalness: 0.6 });

    // ── the chamber, transparent on every side ──
    this.chamber = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(3.2, 3.2, 3.2)),
      scope.track(new THREE.MeshStandardMaterial({
        color: 0xa8d0e0, transparent: true, opacity: 0.06,
        roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
      })),
    );
    this.chamber.position.set(0, 2.4, -4.2);
    this.group.add(this.chamber);

    const edgeGeo = scope.track(new THREE.BoxGeometry(0.06, 3.24, 0.06));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(edgeGeo, frame);
        post.position.set(sx * 1.6, 2.4, -4.2 + sz * 1.6);
        this.group.add(post);
      }
    }

    const base = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.4, 0.75, 3.4)), frame);
    base.position.set(0, 0.38, -4.2);
    this.group.add(base);

    // ── the particle system ──
    const random = rng(30303);
    this.particles = new THREE.InstancedMesh(
      scope.track(new THREE.TetrahedronGeometry(0.06, 0)),
      scope.track(new THREE.MeshStandardMaterial({
        vertexColors: false, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.3,
      })),
      this.scaled(PARTICLES),
    );
    this.particles.position.set(0, 2.4, -4.2);
    this.particles.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.particles.count * 3),
      3,
    );
    this.group.add(this.particles);

    for (let i = 0; i < this.particles.count; i++) {
      this.positions.push(new THREE.Vector3());
      this.velocities.push(new THREE.Vector3());
      this.ages.push(random());
      this.seeds.push(random());
    }

    // ── five faders ──
    const desk = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.6, 0.09, 0.7)), frame);
    desk.position.set(0, 0.98, -1.9);
    desk.rotation.x = -0.14;
    this.group.add(desk);

    CONTROLS.forEach((control, i) => {
      const x = -1.0 + i * 0.5;
      const lever = new Lever(scope, 3, 0.3, { arm: this.emissive(0x5fd0e8, 0.8) });
      lever.value = 1;
      lever.group.position.set(x, 1.02, -1.9);
      this.group.add(lever.group);
      this.levers.push(lever);
      this.values.push(1);

      const label = buildLabel(scope, control.name, 0.46);
      label.position.set(x, 1.0, -1.55);
      label.rotation.x = -Math.PI / 2.2;
      this.group.add(label);
      scope.track(label.geometry);

      this.control({
        object: lever.group,
        label: `Adjust ${control.name}`,
        description: `${control.note} There is no apply step — the chamber answers on the next frame.`,
        activate: () => {
          this.values[i] = (this.values[i] + 1) % 3;
          lever.value = this.values[i];
          this.ctx.announce(
            `${control.name} ${['low', 'mid', 'high'][this.values[i]]}. ${control.note}`,
          );
        },
      });
    });

    const note = buildLabel(scope, 'No apply button. Everything is immediate.', 2.2);
    note.position.set(0, 4.6, -6.4);
    this.group.add(note);
    scope.track(note.geometry);

    this.seedParticles();
  }

  private seedParticles(): void {
    for (let i = 0; i < this.positions.length; i++) {
      this.positions[i].set(0, -1.4, 0);
      this.velocities[i].set(0, 0, 0);
      this.ages[i] = (i / this.positions.length) * 2;
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    for (const lever of this.levers) lever.update(dt);

    const [emitter, force, lifetime, turbulence, colourShift] = this.values;
    const rate = 0.35 + emitter * 0.5;
    const push = 0.35 + force * 0.75;
    const life = 0.9 + lifetime * 1.1;
    const chaos = turbulence * 0.55;
    const step = this.reducedMotion ? 0 : dt;

    for (let i = 0; i < this.positions.length; i++) {
      this.ages[i] += step * (1 / life) * rate;
      if (this.ages[i] >= 1) {
        this.ages[i] = 0;
        const seed = this.seeds[i];
        this.positions[i].set((seed - 0.5) * 0.28, -1.45, (this.seeds[(i + 7) % this.seeds.length] - 0.5) * 0.28);
        this.velocities[i].set(
          (this.seeds[(i + 3) % this.seeds.length] - 0.5) * 0.5,
          push,
          (this.seeds[(i + 11) % this.seeds.length] - 0.5) * 0.5,
        );
      }

      if (step > 0) {
        const t = this.elapsed * 1.4 + this.seeds[i] * 10;
        this.velocities[i].x += Math.sin(t) * chaos * step * 3;
        this.velocities[i].z += Math.cos(t * 1.3) * chaos * step * 3;
        this.velocities[i].y += (push - this.velocities[i].y) * step * 1.6;
        this.positions[i].addScaledVector(this.velocities[i], step);
      }

      const age = this.ages[i];
      const size = (1 - Math.abs(age - 0.5) * 2) * 1.4 + 0.15;
      this.scaleVec.setScalar(Math.max(0.05, size));
      this.matrix.compose(this.positions[i], this.quaternion, this.scaleVec);
      this.particles.setMatrixAt(i, this.matrix);

      // Colour travels over a particle's life by however far the fader says.
      const hue = 0.52 + age * colourShift * 0.22;
      this.colour.setHSL(hue % 1, 0.75, 0.55);
      this.particles.setColorAt(i, this.colour);
    }

    this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
  }

  protected override onReset(): void {
    for (let i = 0; i < this.values.length; i++) {
      this.values[i] = 1;
      this.levers[i].value = 1;
      this.levers[i].update(0, true);
    }
    if (this.positions.length) this.seedParticles();
  }

  protected override describeState(): string {
    const names = ['low', 'mid', 'high'];
    const mix = CONTROLS.map((c, i) => `${c.name} ${names[this.values[i]]}`).join(', ');
    return `The chamber is running with ${mix}. Every change takes effect immediately — there is no apply step.`;
  }
}
