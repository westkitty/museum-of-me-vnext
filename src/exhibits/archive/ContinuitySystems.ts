import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E11 — Continuity Systems. Tier C.
 *
 * A documentation chain: evidence blocks feed a claim stage, an approval gate,
 * and finally an append-only record. The gate physically refuses a claim with
 * no evidence attached, because an automated summary that is ninety per cent
 * right is worse than useless — the wrong ten per cent is indistinguishable
 * from the rest.
 */

interface Block {
  readonly claim: string;
  readonly evidence: string | null;
  readonly note: string;
}

const BLOCKS: readonly Block[] = [
  { claim: 'The build script signs and installs in one step', evidence: 'build.sh, lines 12–34',
    note: 'A checkable claim. The link makes review take seconds instead of minutes.' },
  { claim: 'The audio race condition is resolved', evidence: 'the serial queue and actor isolation',
    note: 'Checkable, and worth checking — this one was wrong for months before it was right.' },
  { claim: 'The project is roughly eighty per cent complete', evidence: null,
    note: 'Plausible, unsupported, and exactly the kind of claim that quietly poisons a handoff.' },
  { claim: 'Two repositories exist and neither is canonical', evidence: 'both repository URLs',
    note: 'An uncomfortable fact with evidence. It belongs in the record precisely because it is unresolved.' },
];

const STAGES = ['Evidence', 'Claim', 'Approval', 'Record'] as const;

export class ContinuitySystems extends ExhibitBase {
  private blocks = this.tracked<THREE.Group>();
  private homes = this.tracked<THREE.Vector3>();
  private stage = this.tracked<number>();
  private stageAnchors = this.tracked<THREE.Vector3>();
  private rejected = this.tracked<boolean>();
  private chain!: Filament;

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
    lectern.position.set(3.2, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const bronze = this.standard(0x8a6a42, { roughness: 0.4, metalness: 0.6 });
    const violet = this.standard(0x5d4d70, { roughness: 0.8 });

    // ── the four stages, left to right ──
    STAGES.forEach((name, i) => {
      const x = -3.0 + i * 2.0;
      const anchor = new THREE.Vector3(x, 1.2, -4.0);
      this.stageAnchors.push(anchor);

      const station = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.1, 1.0, 0.8)), violet);
      station.position.set(x, 0.5, -4.0);
      this.group.add(station);

      const head = new THREE.Mesh(
        scope.track(i === 2 ? new THREE.TorusGeometry(0.3, 0.07, 8, 20) : new THREE.BoxGeometry(0.8, 0.14, 0.6)),
        bronze,
      );
      head.position.set(x, 1.06, -4.0);
      if (i === 2) head.rotation.x = Math.PI / 2;
      this.group.add(head);

      const label = buildLabel(scope, name, 0.9);
      label.position.set(x, 1.55, -4.0);
      this.group.add(label);
      scope.track(label.geometry);
    });

    // ── the conveying chain ──
    this.chain = new Filament(scope, this.scaled(24), 0.02, bronze);
    this.chain.follow(new THREE.CatmullRomCurve3(this.stageAnchors.map((a) => a.clone().setY(0.98))));
    this.group.add(this.chain.group);

    // ── the claim blocks ──
    BLOCKS.forEach((block, i) => {
      const g = new THREE.Group();
      const home = new THREE.Vector3(-3.0 + i * 0.42, 1.28, -3.2);
      g.position.copy(home);
      this.group.add(g);
      this.blocks.push(g);
      this.homes.push(home);
      this.stage.push(0);
      this.rejected.push(false);

      const body = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.34, 0.12, 0.26)),
        this.standard(0xd6c9ab, { roughness: 0.9 }),
      );
      g.add(body);

      // The evidence tag: present or visibly absent.
      const tag = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.1, 0.02, 0.14)),
        this.emissive(block.evidence ? 0x7fd67f : 0xd9543a, block.evidence ? 1.1 : 0.9),
      );
      tag.position.set(0.2, 0, 0);
      g.add(tag);

      this.control({
        object: g,
        label: `Advance: ${block.claim.slice(0, 34)}…`,
        description: `${block.note} ${block.evidence ? `Evidence: ${block.evidence}.` : 'This claim has no evidence attached and the approval gate will refuse it.'}`,
        activate: () => this.advance(i),
      });
    });

    // ── the record ──
    const record = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.0, 1.6, 0.7)), violet);
    record.position.set(3.0, 0.8, -5.0);
    this.group.add(record);

    const recordLabel = buildLabel(scope, 'Append-only. Corrections are added, never overwritten.', 2.4);
    recordLabel.position.set(3.0, 1.95, -5.0);
    this.group.add(recordLabel);
    scope.track(recordLabel.geometry);

    const consoleGroup = buildConsole(scope, 0.6, 0.44, 1.0, violet);
    consoleGroup.position.set(-3.6, 0, -2.0);
    consoleGroup.rotation.y = 0.5;
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Run the whole chain', 0.62);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Run the whole chain at once',
      description:
        'Advances every block as far as it can legitimately go. The claim with no evidence stops at the approval gate while the others pass — which is the entire reason the gate exists.',
      activate: () => {
        let passed = 0;
        let stopped = 0;
        for (let i = 0; i < this.stage.length; i++) {
          if (!BLOCKS[i].evidence) {
            this.stage[i] = Math.max(this.stage[i], 1);
            this.rejected[i] = true;
            stopped++;
            continue;
          }
          this.stage[i] = STAGES.length - 1;
          this.rejected[i] = false;
          passed++;
        }
        this.ctx.announce(
          `${passed} claim${passed === 1 ? '' : 's'} reached the record. ${stopped} stopped at the gate for having no evidence — a plausible wrong claim is more expensive than no claim.`,
        );
      },
    });
  }

  private advance(index: number): void {
    const block = BLOCKS[index];
    const at = this.stage[index];

    if (at >= STAGES.length - 1) {
      this.ctx.announce(`“${block.claim}” is already in the record.`);
      return;
    }
    // The approval gate is where an unsupported claim stops.
    if (at === 1 && !block.evidence) {
      this.rejected[index] = true;
      this.ctx.announce(
        `The gate refuses “${block.claim}”. ${block.note} Nothing enters the record without evidence a person can check.`,
      );
      return;
    }
    this.stage[index] = at + 1;
    this.rejected[index] = false;
    const name = STAGES[this.stage[index]];
    this.ctx.announce(
      this.stage[index] === STAGES.length - 1
        ? `“${block.claim}” is written to the record, with ${block.evidence} attached.`
        : `“${block.claim}” advances to ${name}.`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 4);
    for (let i = 0; i < this.blocks.length; i++) {
      const anchor = this.stageAnchors[this.stage[i]];
      const target = anchor.clone().add(new THREE.Vector3((i - 1.5) * 0.24, 0.1, 0));
      this.blocks[i].position.lerp(target, rate);
      // A rejected block visibly recoils at the gate.
      if (this.rejected[i] && !this.reducedMotion) {
        this.blocks[i].position.x -= Math.sin(this.elapsed * 18) * 0.02;
        this.blocks[i].rotation.z = Math.sin(this.elapsed * 14) * 0.12;
      } else {
        this.blocks[i].rotation.z += (0 - this.blocks[i].rotation.z) * rate;
      }
    }
  }

  protected override onReset(): void {
    for (let i = 0; i < this.stage.length; i++) {
      this.stage[i] = 0;
      this.rejected[i] = false;
      if (this.blocks[i]) {
        this.blocks[i].position.copy(this.homes[i]);
        this.blocks[i].rotation.set(0, 0, 0);
      }
    }
  }

  protected override describeState(): string {
    // Report where each block actually is, not just how many finished — a
    // handoff that has moved but not landed is exactly the state worth seeing.
    const positions = STAGES.map((name, s) => {
      const n = this.stage.filter((v) => v === s).length;
      return n > 0 ? `${n} at ${name}` : null;
    }).filter(Boolean);
    const refused = this.rejected.filter(Boolean).length;
    const note = refused > 0
      ? ` ${refused} claim${refused === 1 ? ' is' : 's are'} being refused at the approval gate for having no evidence a person can check.`
      : '';
    return `Chain: ${positions.join(', ')}.${note}`;
  }
}
