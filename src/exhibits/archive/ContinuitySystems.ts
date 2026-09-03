import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E11 — Selfsame: Continuity, Authority & Recovery Systems. */

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

const RECOVERY_STAGES = [
  { name: 'Loose files', note: 'Cloud or sync-folder files are evidence, but they do not yet provide project history or stated intent.' },
  { name: 'Repository', note: 'Source is reconstructed into a versioned repository so the files have durable structure and change history.' },
  { name: 'Intent & history', note: 'Recovered purpose, decisions, and lineage explain what the source was meant to do and how it arrived here.' },
  { name: 'Durable record', note: 'A project record makes the reconstructed source resumable by a future person or tool without relying on chat memory.' },
] as const;

export class ContinuitySystems extends ExhibitBase {
  private cards = this.tracked<THREE.Mesh>();
  private cardHomes = this.tracked<THREE.Vector3>();
  private recoveryStations = this.tracked<THREE.Mesh>();
  private recoveryHomes = this.tracked<THREE.Vector3>();
  private authorityIndex = 3;
  private capsule = -1;
  private stopped = false;
  private recoveryStage = 0;
  private gate!: THREE.Mesh;
  private recoveryToken!: THREE.Mesh;

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

    // He-Maker is a concrete recovery case rather than a media-processing project.
    // The four stations make the recovery claim physical: loose files are only
    // evidence until repository structure, recovered intent/history, and a
    // durable project record make the work resumable again.
    const recoveryBase = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.4, 0.08, 1.05)), this.standard(0x352f3a, { roughness: 0.82 }));
    recoveryBase.position.set(2.45, 0.86, -2.65); this.group.add(recoveryBase);
    const recoveryTitle = buildLabel(scope, 'HE-MAKER · PROJECT RECOVERY', 3.2);
    recoveryTitle.position.set(2.45, 3.15, -2.68); this.group.add(recoveryTitle); scope.track(recoveryTitle.geometry);

    const recoveryXs = [1.05, 1.98, 2.91, 3.84] as const;
    RECOVERY_STAGES.forEach((stage, i) => {
      const station = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.68, i === 3 ? 0.86 : 0.6, 0.62)),
        this.emissive(i === 0 ? 0xd8cfb7 : i === 1 ? 0x7fa7c7 : i === 2 ? 0xb49ad8 : 0x87b986, 0.12),
      );
      station.name = `E11 recovery station ${i}`;
      const home = new THREE.Vector3(recoveryXs[i], 1.22 + (i === 3 ? 0.13 : 0), -2.65);
      station.position.copy(home); this.group.add(station); this.recoveryStations.push(station); this.recoveryHomes.push(home);

      const label = buildLabel(scope, stage.name.toUpperCase(), 0.78);
      label.position.set(home.x, 2.0, -2.62); this.group.add(label); scope.track(label.geometry);

      if (i === 0) {
        for (let f = 0; f < 3; f++) {
          const sheet = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.32, 0.025, 0.42)), this.standard(0xe4ddcb, { roughness: 0.95 }));
          sheet.position.set(home.x + (f - 1) * 0.1, 1.61 + f * 0.035, -2.58 + (f - 1) * 0.03); sheet.rotation.y = (f - 1) * 0.13; this.group.add(sheet);
        }
      } else if (i === 1) {
        for (let r = 0; r < 3; r++) {
          const row = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.42 - r * 0.05, 0.045, 0.08)), this.standard(0xb8d4e7, { roughness: 0.7 }));
          row.position.set(home.x, 1.42 + r * 0.12, -2.3); this.group.add(row);
        }
      } else if (i === 2) {
        for (let c = 0; c < 2; c++) {
          const card = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.27, 0.38, 0.035)), this.standard(c === 0 ? 0xd9c9ef : 0xe1d7bc, { roughness: 0.88 }));
          card.position.set(home.x + (c === 0 ? -0.16 : 0.16), 1.58, -2.3); this.group.add(card);
        }
      } else {
        const spine = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.58, 0.44)), this.standard(0x6b4f37, { roughness: 0.8 }));
        spine.position.set(home.x - 0.18, 1.52, -2.3); this.group.add(spine);
        const page = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.36, 0.54, 0.38)), this.standard(0xe8e0ca, { roughness: 0.95 }));
        page.position.set(home.x + 0.05, 1.52, -2.3); this.group.add(page);
      }
    });

    this.recoveryToken = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.12, 1)), this.emissive(0xf4d27a, 1.7));
    this.recoveryToken.name = 'E11 recovery token';
    this.recoveryToken.position.set(recoveryXs[0], 2.38, -2.62); this.group.add(this.recoveryToken);

    const recovery = buildConsole(scope, 0.62, 0.44, 1.0, bronze);
    recovery.position.set(3.15, 0, -0.9); recovery.rotation.y = -0.5;
    this.group.add(recovery);
    const recoveryLabel = buildLabel(scope, 'ADVANCE RECOVERY', 0.68);
    recoveryLabel.position.set(0, 1.02, 0.2); recoveryLabel.rotation.x = -Math.PI / 2.1;
    recovery.add(recoveryLabel); scope.track(recoveryLabel.geometry);
    this.control({
      object: recovery,
      label: 'Advance the He-Maker recovery case',
      description: 'Advances a visible recovery packet from loose cloud-folder evidence through repository reconstruction, recovered intent/history, and a durable resumable project record.',
      activate: () => {
        this.recoveryStage = (this.recoveryStage + 1) % RECOVERY_STAGES.length;
        this.applyRecoveryVisualState();
        const stage = RECOVERY_STAGES[this.recoveryStage];
        this.ctx.announce(`He-Maker recovery: ${stage.name}. ${stage.note}`);
      },
    });

    const lineage = buildLabel(scope, 'KinDex → Bible Repo → Selfsame    He-Maker / Project Sentinel → recovery evidence', 4.15);
    lineage.position.set(0, 4.25, -6.4); this.group.add(lineage); scope.track(lineage.geometry);

    this.applyRecoveryVisualState();
  }

  private applyRecoveryVisualState(): void {
    for (let i = 0; i < this.recoveryStations.length; i++) {
      const mat = this.recoveryStations[i].material as THREE.MeshStandardMaterial;
      const reached = i <= this.recoveryStage;
      mat.emissiveIntensity = i === this.recoveryStage ? 1.2 : reached ? 0.42 : 0.08;
    }
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
    const target = this.recoveryHomes[this.recoveryStage];
    const tokenTarget = new THREE.Vector3(target.x, 2.38, -2.62);
    if (this.reducedMotion) this.recoveryToken.position.copy(tokenTarget);
    else this.recoveryToken.position.lerp(tokenTarget, Math.min(1, dt * 6));
    for (let i = 0; i < this.recoveryStations.length; i++) {
      const lift = i === this.recoveryStage ? 0.1 : 0;
      this.recoveryStations[i].position.y += ((this.recoveryHomes[i].y + lift) - this.recoveryStations[i].position.y) * (this.reducedMotion ? 1 : Math.min(1, dt * 6));
    }
  }

  protected override onReset(): void {
    this.authorityIndex = 3; this.capsule = -1; this.stopped = false; this.recoveryStage = 0;
    for (let i = 0; i < this.cards.length; i++) this.cards[i].position.copy(this.cardHomes[i]);
    for (let i = 0; i < this.recoveryStations.length; i++) this.recoveryStations[i].position.copy(this.recoveryHomes[i]);
    this.recoveryToken.position.set(this.recoveryHomes[0].x, 2.38, -2.62);
    this.applyRecoveryVisualState();
  }

  protected override describeState(): string {
    const record = RECORDS[this.authorityIndex];
    const capsule = this.capsule >= 0 ? ` Active constraint: ${CAPSULES[this.capsule].name}.` : ' No temporary constraint is active.';
    const stop = this.stopped ? ' The most recent preflight stopped.' : '';
    const recovery = RECOVERY_STAGES[this.recoveryStage];
    return `Authority desk currently selects a ${record.state} record: “${record.text}”.${capsule}${stop} He-Maker recovery is at ${recovery.name}: ${recovery.note}`;
  }
}
