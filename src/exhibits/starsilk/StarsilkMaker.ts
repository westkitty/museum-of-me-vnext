import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Filament, buildConsole, Dial } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E05 — StarSilk Maker. Tier B.
 *
 * A loom that turns a drawn path into a woven composition. The visitor traces a
 * path through the air; the mechanism follows the canon rules for how Starsilk
 * behaves under tension and interference, so the result is a legal
 * configuration of the material rather than decoration.
 */

const PATTERNS = [
  { name: 'Spiral draw', note: 'The simplest legal path. Tension rises evenly.', k: 1 },
  { name: 'Counter-wound', note: 'Two directions at once. Interference makes the pattern.', k: 2 },
  { name: 'Standing knot', note: 'A path that returns to itself. Holds tension without a frame.', k: 3 },
  { name: 'Drift', note: 'Threads given motion and allowed to settle rather than fixed.', k: 5 },
] as const;

const THREAD_COUNT = 12;
const SEGMENTS = 40;

export class StarsilkMaker extends ExhibitBase {
  private threads = this.tracked<Filament>();
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private loom!: THREE.Group;
  private sculpture!: THREE.Group;
  private dial!: Dial;
  private pattern = 0;
  private tension = 1;
  private woven = 0;

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

    const frameMat = this.standard(0x342c4e, { roughness: 0.45, metalness: 0.6 });

    // ── the loom: a standing frame the visitor works at ──
    this.loom = new THREE.Group();
    this.loom.position.set(0, 0, -4.0);
    this.group.add(this.loom);

    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.13, 0.16, 4.2, 10)), frameMat);
      post.position.set(s * 2.1, 2.1, 0);
      this.loom.add(post);
    }
    for (const y of [0.5, 4.1]) {
      const beam = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.1, 0.1, 4.3, 10)), frameMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(0, y, 0);
      this.loom.add(beam);
    }

    // ── the woven threads ──
    this.sculpture = new THREE.Group();
    this.sculpture.position.set(0, 2.3, -4.0);
    this.group.add(this.sculpture);

    const random = rng(50505);
    for (let i = 0; i < this.scaled(THREAD_COUNT); i++) {
      const hue = 0.66 + random() * 0.16;
      const colour = new THREE.Color().setHSL(hue, 0.55, 0.62).getHex();
      const filament = new Filament(scope, SEGMENTS, 0.022, this.emissive(colour, 0.85));
      this.sculpture.add(filament.group);
      this.threads.push(filament);
      this.curves.push(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]));
    }

    // ── controls ──
    const consoleGroup = buildConsole(scope, 0.74, 0.5, 1.0, this.standard(0x322b4d, { roughness: 0.7 }));
    consoleGroup.position.set(0, 0, -1.7);
    this.group.add(consoleGroup);

    this.dial = new Dial(scope, PATTERNS.length, 0.24, { handle: this.emissive(0xb0a0ff, 0.8) });
    this.dial.group.position.set(-0.18, 1.04, 0);
    consoleGroup.add(this.dial.group);

    const patternLabel = buildLabel(scope, 'Path', 0.44);
    patternLabel.position.set(-0.18, 1.02, 0.2);
    patternLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(patternLabel);
    scope.track(patternLabel.geometry);

    const tensionKnob = new THREE.Mesh(
      scope.track(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16)),
      this.emissive(0xe8c65a, 0.7),
    );
    tensionKnob.position.set(0.2, 1.03, 0);
    consoleGroup.add(tensionKnob);

    const tensionLabel = buildLabel(scope, 'Tension', 0.44);
    tensionLabel.position.set(0.2, 1.02, 0.2);
    tensionLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(tensionLabel);
    scope.track(tensionLabel.geometry);

    this.control({
      object: this.dial.group,
      label: 'Draw a different path',
      description:
        'Traces a new path through the loom. The mechanism follows the canon rules for how Starsilk behaves, so every result is a legal configuration of the material.',
      activate: () => {
        this.pattern = this.dial.advance();
        this.woven = 0;
        this.ctx.announce(`${PATTERNS[this.pattern].name}. ${PATTERNS[this.pattern].note}`);
      },
    });

    this.control({
      object: tensionKnob,
      label: 'Change the tension',
      description: 'Higher tension pulls the weave tight and narrow; lower tension lets it bloom outward.',
      activate: () => {
        this.tension = (this.tension + 1) % 3;
        this.ctx.announce(
          `Tension ${['slack', 'even', 'high'][this.tension]}. The same path yields a different composition.`,
        );
      },
    });

    this.weave(1);
  }

  /** Lay out every thread from the current path and tension. */
  private weave(progress: number): void {
    const p = PATTERNS[this.pattern];
    const tension = 0.6 + this.tension * 0.45;
    const count = this.threads.length;

    for (let i = 0; i < count; i++) {
      const phase = (i / count) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      const steps = 7;
      for (let s = 0; s <= steps; s++) {
        const t = (s / steps) * progress;
        const angle = phase + t * Math.PI * 2 * p.k;
        const radius = (0.35 + t * 1.55) / tension;
        points.push(
          new THREE.Vector3(
            Math.sin(angle) * radius,
            -1.5 + t * 3.0 + Math.sin(angle * 2) * 0.18 * (2 - tension),
            Math.cos(angle) * radius * (p.k === 3 ? Math.cos(t * Math.PI) : 1),
          ),
        );
      }
      if (points.length < 2) points.push(points[0].clone().add(new THREE.Vector3(0, 0.01, 0)));
      const curve = new THREE.CatmullRomCurve3(points);
      this.curves[i] = curve;
      this.threads[i].follow(curve);
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt, this.reducedMotion);

    // The weave grows as it is drawn, then holds.
    if (this.woven < 1) {
      this.woven = Math.min(1, this.woven + dt * (this.reducedMotion ? 10 : 0.6));
      this.weave(Math.max(0.06, this.woven));
    } else if (!this.reducedMotion && this.pattern === 3) {
      // Drift: the one pattern that keeps settling rather than holding.
      this.weave(1);
      this.sculpture.rotation.y += dt * 0.08;
    } else if (!this.reducedMotion) {
      this.sculpture.rotation.y += dt * 0.05;
    }
  }

  protected override onReset(): void {
    this.pattern = 0;
    this.tension = 1;
    this.woven = 0;
    if (this.dial) {
      this.dial.value = 0;
      this.dial.update(0, true);
    }
    if (this.sculpture) this.sculpture.rotation.set(0, 0, 0);
    if (this.threads.length) this.weave(1);
  }

  protected override describeState(): string {
    const p = PATTERNS[this.pattern];
    const t = ['slack', 'even', 'high'][this.tension];
    return `The loom is weaving a ${p.name.toLowerCase()} at ${t} tension. ${p.note}`;
  }
}
