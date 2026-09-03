import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { Filament, buildConsole, buildNode } from '../parts';
import { fibonacciSphere } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E04 — Starsilk Possibility Cartographer. Tier B.
 *
 * A volumetric graph the visitor walks into. Selecting a canon fact lights the
 * possibilities it permits, closes the ones it contradicts, and leaves the rest
 * dark — because absence of a rule is not permission. That last category is the
 * whole argument of the project, so it is the one rendered most carefully:
 * unresolved nodes stay visibly unresolved rather than defaulting to allowed.
 */

type State = 'legal' | 'forbidden' | 'contradictory' | 'unresolved' | 'used';

const STATE_COLOUR: Record<State, number> = {
  used: 0x8878e8,
  legal: 0x7fd67f,
  forbidden: 0xd9543a,
  contradictory: 0xe8a33a,
  unresolved: 0x4a4560,
};

const FACTS = [
  {
    name: 'Syrin is fixed',
    note: 'A hard canon lock. Everything downstream of it is decided.',
    resolve: (i: number): State => (i % 7 === 0 ? 'used' : i % 5 === 0 ? 'forbidden' : i % 3 === 0 ? 'legal' : 'unresolved'),
  },
  {
    name: 'The Siege Wall is an absence',
    note: 'A visual law. It forbids a whole family of depictions without permitting their opposites.',
    resolve: (i: number): State => (i % 4 === 0 ? 'forbidden' : i % 6 === 0 ? 'contradictory' : i % 3 === 1 ? 'legal' : 'unresolved'),
  },
  {
    name: 'Starsilk is programmable',
    note: 'The founding premise. It opens more than it closes, which is unusual.',
    resolve: (i: number): State => (i % 2 === 0 ? 'legal' : i % 5 === 0 ? 'used' : 'unresolved'),
  },
  {
    name: 'Gorevault ≠ Ringthroat',
    note: 'A correction. It marks a set of existing claims as contradictory.',
    resolve: (i: number): State => (i % 3 === 0 ? 'contradictory' : i % 4 === 0 ? 'legal' : 'unresolved'),
  },
] as const;

const NODE_COUNT = 90;

export class PossibilityCartographer extends ExhibitBase {
  private nodes = this.tracked<THREE.Mesh>();
  private states = this.tracked<State>();
  private materials: Map<State, THREE.MeshStandardMaterial> | null = null;
  private links = this.tracked<Filament>();
  private graph!: THREE.Group;
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
    lectern.position.set(3.3, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    // ── the graph: a volume the visitor stands inside ──
    this.graph = new THREE.Group();
    this.graph.position.set(0, 2.9, -3.6);
    this.group.add(this.graph);

    const count = this.scaled(NODE_COUNT);
    const points = fibonacciSphere(count, 2.9);
    const materials = new Map<State, THREE.MeshStandardMaterial>();
    for (const state of Object.keys(STATE_COLOUR) as State[]) {
      materials.set(state, this.emissive(STATE_COLOUR[state], state === 'unresolved' ? 0.08 : 0.9));
    }
    this.materials = materials;

    for (let i = 0; i < count; i++) {
      const node = buildNode(scope, 0.075, materials.get('unresolved')!);
      node.position.copy(points[i]);
      this.graph.add(node);
      this.nodes.push(node);
      this.states.push('unresolved');
    }

    // Sparse links, so the graph reads as a structure rather than a cloud.
    const linkMat = this.standard(0x3a3358, { roughness: 0.8 });
    for (let i = 0; i < count; i += 3) {
      const j = (i * 7 + 11) % count;
      const filament = new Filament(scope, 4, 0.012, linkMat);
      filament.follow(new THREE.CatmullRomCurve3([points[i], points[i].clone().lerp(points[j], 0.5).multiplyScalar(0.75), points[j]]));
      this.graph.add(filament.group);
      this.links.push(filament);
    }

    // ── a legend, because five states need naming to be readable ──
    const legendEntries: [State, string][] = [
      ['used', 'used by canon'],
      ['legal', 'still legal'],
      ['forbidden', 'forbidden'],
      ['contradictory', 'contradictory'],
      ['unresolved', 'unresolved — not permitted'],
    ];
    legendEntries.forEach(([state, text], i) => {
      const swatch = buildNode(scope, 0.09, materials.get(state)!);
      swatch.position.set(-4.1, 2.4 - i * 0.42, -6.2);
      this.group.add(swatch);
      const label = buildLabel(scope, text, 1.5);
      label.position.set(-2.9, 2.4 - i * 0.42, -6.2);
      this.group.add(label);
      scope.track(label.geometry);
    });

    // ── one console per canon fact ──
    FACTS.forEach((fact, i) => {
      const a = (i / FACTS.length) * Math.PI * 2 + Math.PI / 4;
      const consoleGroup = buildConsole(scope, 0.6, 0.44, 1.0, this.standard(0x322b4d, { roughness: 0.7 }));
      consoleGroup.position.set(Math.sin(a) * 5.0, 0, Math.cos(a) * 5.0 - 3.6);
      consoleGroup.rotation.y = a + Math.PI;
      this.group.add(consoleGroup);

      const label = buildLabel(scope, fact.name, 0.62);
      label.position.set(0, 1.02, 0.2);
      label.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(label);
      scope.track(label.geometry);

      this.control({
        object: consoleGroup,
        label: `Select: ${fact.name}`,
        description: `${fact.note} Watch how much of the graph stays dark — those regions are unresolved, and unresolved does not mean allowed.`,
        activate: () => this.select(i, materials),
      });
    });

    this.applyStates(materials);
  }

  private select(index: number, materials: Map<State, THREE.MeshStandardMaterial>): void {
    if (this.selected === index) {
      this.selected = -1;
      for (let i = 0; i < this.states.length; i++) this.states[i] = 'unresolved';
      this.ctx.announce('Selection cleared. Every region returns to unresolved.');
    } else {
      this.selected = index;
      const fact = FACTS[index];
      for (let i = 0; i < this.states.length; i++) this.states[i] = fact.resolve(i);
      const counts = this.counts();
      this.ctx.announce(
        `${fact.name}. ${counts.legal} regions still legal, ${counts.forbidden} forbidden, ${counts.contradictory} contradictory, ${counts.unresolved} unresolved. ${fact.note}`,
      );
    }
    this.applyStates(materials);
  }

  private counts(): Record<State, number> {
    const out: Record<State, number> = { used: 0, legal: 0, forbidden: 0, contradictory: 0, unresolved: 0 };
    for (const s of this.states) out[s]++;
    return out;
  }

  private applyStates(materials: Map<State, THREE.MeshStandardMaterial>): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const state = this.states[i];
      this.nodes[i].material = materials.get(state)!;
      const scale = state === 'unresolved' ? 0.7 : state === 'forbidden' ? 0.85 : 1.25;
      this.nodes[i].scale.setScalar(scale);
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.reducedMotion) return;
    this.graph.rotation.y += dt * 0.06;
    // Forbidden regions pulse closed; unresolved ones stay inert.
    const pulse = 0.85 + Math.sin(this.elapsed * 2) * 0.12;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.states[i] === 'forbidden') this.nodes[i].scale.setScalar(pulse * 0.85);
    }
  }

  protected override onReset(): void {
    this.selected = -1;
    for (let i = 0; i < this.states.length; i++) this.states[i] = 'unresolved';
    if (this.graph) this.graph.rotation.set(0, 0, 0);
    // select()/applyStates() recolour every node's material by state. Without
    // reassigning it here too, a node stayed whatever colour the last
    // selected fact left it at forever -- describeState() would report every
    // region unresolved while the graph kept showing the previous answer.
    const unresolved = this.materials?.get('unresolved');
    for (const node of this.nodes) {
      node.scale.setScalar(0.7);
      if (unresolved) node.material = unresolved;
    }
  }

  protected override describeState(): string {
    if (this.selected < 0) {
      return 'No canon fact is selected. Every region of the graph is unresolved — which is not the same as permitted.';
    }
    const fact = FACTS[this.selected];
    const c = this.counts();
    return `Selected: ${fact.name}. ${c.legal} regions still legal, ${c.forbidden} forbidden, ${c.contradictory} contradictory, ${c.used} already used, and ${c.unresolved} unresolved.`;
  }
}
