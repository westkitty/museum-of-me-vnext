import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E11 — Selfsame: Continuity & Authority Systems. */

type EvidenceState = 'claimed' | 'observed' | 'verified' | 'superseded';
interface RecordCard {
  readonly text: string;
  readonly state: EvidenceState;
  readonly source: string;
}

const RECORDS: readonly RecordCard[] = [
  { text: 'The museum is release-ready.', state: 'superseded', source: 'older milestone claim' },
  { text: 'The browser journey completed.', state: 'verified', source: 'named automated evidence' },
  { text: 'The water looks finished.', state: 'claimed', source: 'no human visual evidence' },
  { text: 'The project is in active development.', state: 'observed', source: 'current owner direction' },
];

const CAPSULES = [
  { name: 'LOCAL ONLY', blocks: 'remote operation', note: 'A local-only constraint is active. Remote execution is not a clever fallback.' },
  { name: 'PRESERVE THE BOUNDARY', blocks: 'authority expansion', note: 'The system may not widen an operation merely because the wider path is convenient.' },
  { name: 'DO NOT OMIT', blocks: 'unsupported summary', note: 'Known contradictions remain visible instead of being smoothed into one confident answer.' },
] as const;

export class ContinuitySystems extends ExhibitBase {
  private cards = this.tracked<THREE.Mesh>();
  private cardHomes = this.tracked<THREE.Vector3>();
  private authorityIndex = 3;
  private capsule = -1;
  private stopped = false;
  private gate!: THREE.Mesh;

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.2);
    this.group.add(plaque); scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.3, 0, -4.7); lectern.rotation.y = -0.6;
    this.group.add(lectern); scope.trackObject(lectern);

    const bronze = this.standard(0x8a6a42, { roughness: 0.4, metalness: 0.6 });
    const violet = this.standard(0x4b3f62, { roughness: 0.75 });

    const desk = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5.0, 0.12, 2.0)), violet);
    desk.position.set(0, 0.92, -4.2); this.group.add(desk);

    RECORDS.forEach((record, i) => {
      const card = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(1.02, 0.05, 0.72)),
        this.standard(record.state === 'verified' ? 0x87b986 : record.state === 'superseded' ? 0x9b695f : 0xd8cfb7, { roughness: 0.85 }),
      );
      const home = new THREE.Vector3(-1.8 + i * 1.2, 1.03, -4.2);
      card.position.copy(home); this.group.add(card);
      this.cards.push(card); this.cardHomes.push(home);

      const label = buildLabel(scope, `${record.state.toUpperCase()}\n${record.text}`, 0.9);
      label.position.set(home.x, 1.1, home.z); label.rotation.x = -Math.PI / 2;
      this.group.add(label); scope.track(label.geometry);

      this.control({
        object: card,
        label: `Use as governing record: ${record.text}`,
        description: `Source: ${record.source}. Selecting a record does not change its evidence state; it only asks whether it should govern this decision.`,
        activate: () => {
          this.authorityIndex = i;
          const warning = record.state === 'superseded' || record.state === 'claimed'
            ? ' That is not strong enough to govern current state.'
            : ' This record may govern within its stated scope.';
          this.ctx.announce(`${record.state}: ${record.text} Source: ${record.source}.${warning}`);
        },
      });
    });

    this.gate = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(2.2, 2.0, 0.14)),
      this.emissive(0x7fd67f, 0.25),
    );
    this.gate.position.set(0, 1.6, -6.1); this.group.add(this.gate);
    const gateLabel = buildLabel(scope, 'PREFLIGHT / HARD STOP', 1.7);
    gateLabel.position.set(0, 2.85, -6.0); this.group.add(gateLabel); scope.track(gateLabel.geometry);

    CAPSULES.forEach((capsule, i) => {
      const c = buildConsole(scope, 0.62, 0.44, 1.0, violet);
      c.position.set(-2.2 + i * 2.2, 0, -1.9); this.group.add(c);
      const label = buildLabel(scope, capsule.name, 0.64);
      label.position.set(0, 1.02, 0.2); label.rotation.x = -Math.PI / 2.1;
      c.add(label); scope.track(label.geometry);
      this.control({
        object: c,
        label: `Activate ${capsule.name}`,
        description: capsule.note,
        activate: () => {
          this.capsule = this.capsule === i ? -1 : i;
          this.stopped = false;
          this.ctx.announce(this.capsule === i ? `${capsule.name} active. ${capsule.note}` : `${capsule.name} cleared.`);
        },
      });
    });

    const attempt = buildConsole(scope, 0.78, 0.5, 1.0, bronze);
    attempt.position.set(0, 0, -0.55); this.group.add(attempt);
    const attemptLabel = buildLabel(scope, 'TRY OPERATION', 0.72);
    attemptLabel.position.set(0, 1.02, 0.2); attemptLabel.rotation.x = -Math.PI / 2.1;
    attempt.add(attemptLabel); scope.track(attemptLabel.geometry);
    this.control({
      object: attempt,
      label: 'Run the preflight',
      description: 'Tests a fictional remote mutation against the selected authority record and any active temporary constraint.',
      activate: () => this.preflight(),
    });

    const lineage = buildLabel(scope, 'KinDex → Bible Repo → Selfsame    Project Sentinel → recovery packet', 3.8);
    lineage.position.set(0, 4.25, -6.4); this.group.add(lineage); scope.track(lineage.geometry);
  }

  private preflight(): void {
    const record = RECORDS[this.authorityIndex];
    const capsule = this.capsule >= 0 ? CAPSULES[this.capsule] : null;
    const weakAuthority = record.state === 'claimed' || record.state === 'superseded';
    this.stopped = weakAuthority || capsule !== null;
    if (weakAuthority) {
      this.ctx.announce(`HARD STOP. “${record.text}” is ${record.state} and cannot authorize a consequential current-state operation.`);
      return;
    }
    if (capsule) {
      this.ctx.announce(`HARD STOP. ${capsule.name} blocks ${capsule.blocks}. One required next action: choose a route that preserves the active constraint.`);
      return;
    }
    this.ctx.announce(`PROCEED within scope. Authority: “${record.text}” (${record.state}). No active constraint blocks this fictional operation.`);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const mat = this.gate.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(this.stopped ? 0xd9543a : 0x7fd67f);
    mat.emissiveIntensity += ((this.stopped ? 1.5 : 0.25) - mat.emissiveIntensity) * Math.min(1, dt * 5);
    for (let i = 0; i < this.cards.length; i++) {
      const lift = i === this.authorityIndex ? 0.13 : 0;
      this.cards[i].position.y += ((this.cardHomes[i].y + lift) - this.cards[i].position.y) * (this.reducedMotion ? 1 : Math.min(1, dt * 6));
    }
  }

  protected override onReset(): void {
    this.authorityIndex = 3; this.capsule = -1; this.stopped = false;
    for (let i = 0; i < this.cards.length; i++) this.cards[i].position.copy(this.cardHomes[i]);
  }

  protected override describeState(): string {
    const record = RECORDS[this.authorityIndex];
    const capsule = this.capsule >= 0 ? ` Active constraint: ${CAPSULES[this.capsule].name}.` : ' No temporary constraint is active.';
    const stop = this.stopped ? ' The most recent preflight stopped.' : '';
    return `Authority desk currently selects a ${record.state} record: “${record.text}”.${capsule}${stop}`;
  }
}
