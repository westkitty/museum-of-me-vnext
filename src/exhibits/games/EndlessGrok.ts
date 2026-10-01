import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial, Filament } from '../parts';
import { rng } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E33 — Endless Grok / Void Ascendancy. Tier B.
 *
 * A galactic board generated from a seed. Claiming nodes and choosing one
 * technology plays the expansion consequences forward. Resetting the board
 * produces the identical galaxy — determinism is a testing feature first and a
 * player feature second, and this room lets a visitor verify that themselves.
 */

interface Tech {
  readonly name: string;
  readonly note: string;
  readonly reach: number;
  readonly colour: number;
}

const TECHS: readonly Tech[] = [
  { name: 'Jump range', reach: 3, colour: 0x5fb0e8, note: 'Expands fast and thin. Legible to opponents, which matters more than it sounds.' },
  { name: 'Industry', reach: 2, colour: 0xe8c65a, note: 'Slower, denser, and much harder to dislodge.' },
  { name: 'Diplomacy', reach: 4, colour: 0x7fd67f, note: 'Reaches furthest, and only holds while the AI empires can infer why you acted.' },
];

const NODE_COUNT = 34;
const SEED = 33033;

/** Reused every frame. Allocating these per node per frame churned the heap. */
const CLAIMED_SCALE = new THREE.Vector3(1.5, 1.5, 1.5);
const UNCLAIMED_SCALE = new THREE.Vector3(1, 1, 1);

export class EndlessGrok extends ExhibitBase {
  private board!: THREE.Group;
  private nodes = this.tracked<THREE.Mesh>();
  private nodePos = this.tracked<THREE.Vector3>();
  private claimed = this.tracked<boolean>();
  private lanes = this.tracked<Filament>();
  private dial!: Dial;
  private unclaimedMaterial!: THREE.MeshStandardMaterial;
  private claimedMaterial!: THREE.MeshStandardMaterial;
  private tech = 0;
  private crisis = false;

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

    const metal = this.standard(0x3f4650, { roughness: 0.4, metalness: 0.6 });

    // ── the board ──
    const frame = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.4, 0.12, 3.2)), metal);
    frame.position.set(0, 0.9, -4.0);
    this.group.add(frame);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.9, 2.8)), metal);
      leg.position.set(sx * 1.9, 0.45, -4.0);
      this.group.add(leg);
    }

    this.board = new THREE.Group();
    this.board.position.set(0, 0.98, -4.0);
    this.group.add(this.board);

    const field = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(4.1, 0.02, 2.9)),
      this.emissive(0x141b28, 0.25),
    );
    this.board.add(field);

    // ── deterministic galaxy from a fixed seed ──
    const random = rng(SEED);
    const nodeGeo = scope.track(new THREE.IcosahedronGeometry(0.07, 1));
    // Both materials are built here, not lazily during update(). Allocating in
    // the frame loop leaked one material into the exhibit's scope on every
    // reset-then-claim cycle.
    this.unclaimedMaterial = this.emissive(0x6a7a8a, 0.35);
    this.claimedMaterial = this.emissive(TECHS[0].colour, 1.3);
    for (let i = 0; i < this.scaled(NODE_COUNT); i++) {
      const p = new THREE.Vector3((random() - 0.5) * 3.8, 0.09, (random() - 0.5) * 2.6);
      const node = new THREE.Mesh(nodeGeo, this.unclaimedMaterial);
      node.position.copy(p);
      this.board.add(node);
      this.nodes.push(node);
      this.nodePos.push(p);
      this.claimed.push(false);
    }

    // Lanes between nearby nodes.
    const laneMat = this.standard(0x3a4552, { roughness: 0.8 });
    for (let i = 0; i < this.nodes.length; i++) {
      const j = (i * 5 + 3) % this.nodes.length;
      if (i === j) continue;
      const lane = new Filament(scope, 4, 0.008, laneMat);
      lane.follow(new THREE.CatmullRomCurve3([this.nodePos[i], this.nodePos[j]]));
      this.board.add(lane.group);
      this.lanes.push(lane);
    }

    const seedLabel = buildLabel(scope, `Seed ${SEED} — the same galaxy every time`, 2.4);
    seedLabel.position.set(0, 1.05, -1.7);
    this.board.add(seedLabel);
    scope.track(seedLabel.geometry);

    // ── controls ──
    const claimConsole = buildConsole(scope, 0.62, 0.46, 1.0, metal);
    claimConsole.position.set(-2.6, 0, -2.2);
    claimConsole.rotation.y = 0.5;
    this.group.add(claimConsole);

    const claimLabel = buildLabel(scope, 'Claim nodes', 0.6);
    claimLabel.position.set(0, 1.02, 0.2);
    claimLabel.rotation.x = -Math.PI / 2.1;
    claimConsole.add(claimLabel);
    scope.track(claimLabel.geometry);

    this.control({
      object: claimConsole,
      label: 'Claim the next wave of nodes',
      description:
        'Expands from what you already hold, as far as the chosen technology reaches. The expansion is deterministic — the same seed and the same choices always produce the same map.',
      activate: () => this.claim(),
    });

    const techConsole = buildConsole(scope, 0.62, 0.46, 1.0, metal);
    techConsole.position.set(2.6, 0, -2.2);
    techConsole.rotation.y = -0.5;
    this.group.add(techConsole);

    this.dial = new Dial(scope, TECHS.length, 0.22, { handle: this.emissive(0x5fb0e8, 0.8) });
    this.dial.group.position.set(0, 1.04, 0);
    techConsole.add(this.dial.group);

    const techLabel = buildLabel(scope, 'Technology', 0.6);
    techLabel.position.set(0, 1.02, 0.22);
    techLabel.rotation.x = -Math.PI / 2.1;
    techConsole.add(techLabel);
    scope.track(techLabel.geometry);

    this.control({
      object: techConsole,
      label: 'Choose a different technology',
      description:
        'One choice, and it changes how expansion behaves for the rest of the game. Crises exist to interrupt the plateau this genre reliably produces.',
      activate: () => {
        this.tech = this.dial.advance();
        const t = TECHS[this.tech];
        this.ctx.announce(`${t.name}. ${t.note}`);
      },
    });
  }

  private claimedCount(): number {
    return this.claimed.filter(Boolean).length;
  }

  private claim(): void {
    const tech = TECHS[this.tech];
    if (this.claimedCount() === 0) {
      this.claimed[0] = true;
      this.ctx.announce(`First node claimed under ${tech.name}. ${tech.note}`);
      return;
    }

    // Expand from the frontier, as far as the technology reaches.
    const frontier: number[] = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.claimed[i]) continue;
      for (let j = 0; j < this.nodes.length; j++) {
        if (this.claimed[j] || frontier.includes(j)) continue;
        if (this.nodePos[i].distanceTo(this.nodePos[j]) < tech.reach * 0.34) frontier.push(j);
      }
    }
    if (frontier.length === 0) {
      this.crisis = true;
      this.ctx.announce(
        'Nothing is within reach. This is the mid-game plateau the genre produces — and where a crisis event would fire.',
      );
      return;
    }
    for (const j of frontier.slice(0, tech.reach)) this.claimed[j] = true;
    this.crisis = false;
    this.ctx.announce(
      `${this.claimedCount()} of ${this.nodes.length} nodes claimed under ${tech.name}.`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.dial.update(dt, this.reducedMotion);
    const tech = TECHS[this.tech];
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 5);

    this.claimedMaterial.emissive.setHex(tech.colour);

    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (this.claimed[i]) {
        node.material = this.claimedMaterial;
        node.scale.lerp(CLAIMED_SCALE, rate);
      } else {
        // Restore the unclaimed material explicitly. Reading node.material here
        // and fading it would drive the *shared* claimed material's intensity
        // down for every other node once one had been claimed and reset.
        node.material = this.unclaimedMaterial;
        node.scale.lerp(UNCLAIMED_SCALE, rate);
      }
    }
    this.unclaimedMaterial.emissiveIntensity = 0.35;

    if (!this.reducedMotion) {
      this.board.rotation.y = Math.sin(this.elapsed * 0.12) * 0.03;
    }
  }

  protected override onReset(): void {
    this.tech = 0;
    this.crisis = false;
    for (let i = 0; i < this.claimed.length; i++) {
      this.claimed[i] = false;
      this.nodes[i].scale.setScalar(1);
      this.nodes[i].material = this.unclaimedMaterial;
    }
    if (this.claimedMaterial) {
      this.claimedMaterial.emissive.setHex(TECHS[0].colour);
      this.claimedMaterial.emissiveIntensity = 1.3;
    }
    if (this.dial) {
      this.dial.value = 0;
      this.dial.update(0, true);
    }
    if (this.board) this.board.rotation.set(0, 0, 0);
  }

  protected override describeState(): string {
    const tech = TECHS[this.tech];
    const claimed = this.claimedCount();
    const crisis = this.crisis ? ' Expansion has stalled — the mid-game plateau, where a crisis event fires.' : '';
    if (claimed === 0) {
      return `The galaxy is generated from seed ${SEED} and nothing is claimed. Technology: ${tech.name}.${crisis}`;
    }
    return `${claimed} of ${this.nodes.length} nodes claimed under ${tech.name}. The same seed always produces this same galaxy.${crisis}`;
  }
}
