import * as THREE from 'three';
import { ExhibitBase } from './ExhibitBase';
import { buildPlaque, buildLectern } from './Furniture';
import type { ExhibitDefinition, ExhibitUpdateContext } from './contract';

/**
 * CONSTRUCTION SCAFFOLDING — not a shipping exhibit.
 *
 * Stands in for an exhibit whose bespoke module has not been built yet, so the
 * museum is walkable, streamable and testable end to end from Phase 3 onward
 * rather than only after every wing is finished.
 *
 * It carries real interpretation (the plaque and lectern are the permanent
 * implementations) and a real inspect interaction, but its hero form is a
 * generic study model rather than the exhibit's own.
 *
 * `npm run validate:exhibits` fails the build if any exhibit still resolves to
 * this class once Phase 9 declares content complete.
 */
export class ProvisionalExhibit extends ExhibitBase {
  static readonly IS_SCAFFOLDING = true;

  private hero: THREE.Group | null = null;
  private opened = false;
  private spin = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const record = this.ctx.record;

    const plaque = buildPlaque(this.ctx.scope, record);
    plaque.position.set(0, 2.2, -6.4);
    this.group.add(plaque);
    this.ctx.scope.trackObject(plaque);

    const lectern = buildLectern(this.ctx.scope, record, this.ctx.projects);
    lectern.position.set(2.6, 0, -3.2);
    lectern.rotation.y = -0.5;
    this.group.add(lectern);
    this.ctx.scope.trackObject(lectern);

    // Generic study model: a tiered form whose proportions vary by tier so the
    // wing still reads as having different-sized rooms while under construction.
    const hero = new THREE.Group();
    hero.name = 'provisional-hero';
    const scale = this.def.tier === 'A' ? 1.5 : this.def.tier === 'B' ? 1.15 : 0.9;
    const shell = this.standard(0x6b6152, { roughness: 0.7, metalness: 0.12 });
    const core = this.emissive(0xc9a227, 0.5);

    const base = new THREE.Mesh(this.ctx.scope.track(new THREE.CylinderGeometry(1.4 * scale, 1.7 * scale, 0.5, 8)), shell);
    base.position.y = 0.25;
    hero.add(base);

    const body = new THREE.Mesh(this.ctx.scope.track(new THREE.OctahedronGeometry(1.05 * scale, 1)), shell);
    body.position.y = 1.6 * scale;
    hero.add(body);

    const ring = new THREE.Mesh(this.ctx.scope.track(new THREE.TorusGeometry(1.5 * scale, 0.05, 8, 40)), core);
    ring.position.y = 1.6 * scale;
    ring.rotation.x = Math.PI / 2.5;
    hero.add(ring);

    this.group.add(hero);
    this.hero = hero;

    this.control({
      object: body,
      label: 'Inspect',
      description: `${record.title}: ${record.copy.interaction}`,
      activate: () => {
        this.opened = !this.opened;
        this.ctx.announce(
          this.opened
            ? `${record.title} opened. ${record.copy.interaction}`
            : `${record.title} closed.`,
        );
      },
    });
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (!this.hero) return;
    if (!this.reducedMotion) this.spin += dt * (this.opened ? 0.5 : 0.14);
    this.hero.rotation.y = this.spin;
    const target = this.opened ? 2.1 : 1.6;
    const current = this.hero.children[1].position.y;
    this.hero.children[1].position.y += (target - current) * Math.min(1, dt * 4);
  }

  protected override onReset(): void {
    this.opened = false;
    this.spin = 0;
    if (this.hero) {
      this.hero.rotation.y = 0;
      this.hero.children[1].position.y = 1.6;
    }
  }

  protected override describeState(): string {
    return this.opened
      ? 'The study model is open, showing its internal structure.'
      : 'The study model is closed.';
  }
}
