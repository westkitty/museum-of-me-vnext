import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E12 — Rhetorical InDEX. Tier B.
 *
 * An evidence table. The visitor sorts sample statements into five categories,
 * and the table shows what the tool would classify them as and why. The
 * interesting result is how often a single sentence is doing two things at
 * once.
 *
 * SOURCE RULE: every statement here is invented for the museum. No real
 * dispute, publication or person is analysed in this room.
 */

type Kind = 'evidence' | 'interpretation' | 'framing' | 'inference' | 'unsupported';

const KINDS: readonly { key: Kind; name: string; colour: number; note: string }[] = [
  { key: 'evidence', name: 'Evidence', colour: 0x7fd67f, note: 'A statement of what was observed or recorded.' },
  { key: 'interpretation', name: 'Interpretation', colour: 0x5fb0e8, note: 'What the evidence is taken to mean.' },
  { key: 'framing', name: 'Framing', colour: 0xe8c65a, note: 'Which facts are placed in view, and in what order. Persuasion mostly lives here.' },
  { key: 'inference', name: 'Inference', colour: 0x9d8bff, note: 'A conclusion drawn beyond what was stated.' },
  { key: 'unsupported', name: 'Unsupported', colour: 0xd9543a, note: 'Asserted with nothing behind it.' },
];

/** All invented for the exhibit. */
const STATEMENTS: readonly { text: string; answer: Kind; why: string }[] = [
  { text: 'The gauge read 41 at 09:12.', answer: 'evidence',
    why: 'A recorded observation with a time attached. Nothing is claimed about what it means.' },
  { text: 'A reading of 41 indicates the seal had already failed.', answer: 'interpretation',
    why: 'The same number, now assigned a meaning. The number is not in dispute; the meaning is.' },
  { text: 'Even after three prior warnings, the gauge read 41.', answer: 'framing',
    why: 'The reading is unchanged. What changed is what was placed beside it.' },
  { text: 'So the crew must have known for weeks.', answer: 'inference',
    why: 'A conclusion reaching well past anything stated. It may be right; it is not established.' },
  { text: 'Everyone involved knew this would happen.', answer: 'unsupported',
    why: 'A confident claim with nothing behind it at all — and the hardest to notice in a paragraph of the others.' },
];

export class RhetoricalIndex extends ExhibitBase {
  /** Reused by onUpdate; classification counts must not allocate every frame. */
  private readonly binCounts = new Uint8Array(KINDS.length);
  private cards = this.tracked<THREE.Group>();
  private homes = this.tracked<THREE.Vector3>();
  private sorted = this.tracked<number>();
  private binSlots = this.tracked<THREE.Vector3>();
  private revealed = false;

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
    lectern.position.set(3.2, 0, -4.6);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x5d4d70, { roughness: 0.78 });
    const bronze = this.standard(0x8a6a42, { roughness: 0.4, metalness: 0.6 });

    // ── the table ──
    const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5.0, 0.1, 2.4)), wood);
    top.position.set(0, 0.92, -4.0);
    this.group.add(top);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.14, 0.92, 2.0)), bronze);
      leg.position.set(sx * 2.2, 0.46, -4.0);
      this.group.add(leg);
    }

    // ── five bins ──
    KINDS.forEach((kind, i) => {
      const x = -2.0 + i * 1.0;
      const tray = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.85, 0.05, 0.6)),
        this.standard(kind.colour, { roughness: 0.6 }),
      );
      tray.position.set(x, 0.99, -4.5);
      this.group.add(tray);
      this.binSlots.push(new THREE.Vector3(x, 1.04, -4.5));

      const label = buildLabel(scope, kind.name, 0.8);
      label.position.set(x, 1.0, -3.95);
      label.rotation.x = -Math.PI / 2;
      this.group.add(label);
      scope.track(label.geometry);
    });

    // ── the statement cards ──
    STATEMENTS.forEach((statement, i) => {
      const g = new THREE.Group();
      const home = new THREE.Vector3(-1.9 + i * 0.95, 1.03, -3.3);
      g.position.copy(home);
      this.group.add(g);
      this.cards.push(g);
      this.homes.push(home);
      this.sorted.push(-1);

      const card = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.72, 0.02, 0.5)),
        this.standard(0xefe8d8, { roughness: 0.9 }),
      );
      g.add(card);

      const text = buildLabel(scope, statement.text, 0.68);
      text.position.set(0, 0.015, 0);
      text.rotation.x = -Math.PI / 2;
      g.add(text);
      scope.track(text.geometry);

      this.control({
        object: g,
        label: `Classify: “${statement.text.slice(0, 30)}…”`,
        description:
          'Cycles this statement through the five categories. Compare your reading with the tool’s — the useful question is rarely whether a claim is true, but what kind of move it is making.',
        activate: () => {
          this.sorted[i] = (this.sorted[i] + 1) % KINDS.length;
          const chosen = KINDS[this.sorted[i]];
          const correct = chosen.key === statement.answer;
          this.ctx.announce(
            this.revealed
              ? `${chosen.name}. The tool says ${KINDS.find((k) => k.key === statement.answer)!.name}: ${statement.why}`
              : `Sorted as ${chosen.name}. ${chosen.note}${correct ? '' : ''}`,
          );
        },
      });
    });

    // ── the reveal ──
    const consoleGroup = buildConsole(scope, 0.64, 0.46, 1.0, wood);
    consoleGroup.position.set(-3.4, 0, -2.2);
    consoleGroup.rotation.y = 0.5;
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Show the analysis', 0.64);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: () => (this.revealed ? 'Hide the analysis' : 'Show what the tool says'),
      description:
        'Reveals the tool’s classification and its reasoning for each statement. Every statement here is invented for the museum.',
      activate: () => {
        this.revealed = !this.revealed;
        this.ctx.announce(
          this.revealed
            ? `Analysis shown. ${this.correctCount()} of ${STATEMENTS.length} of your classifications match the tool.`
            : 'Analysis hidden.',
        );
      },
    });

    const notice = buildLabel(scope, 'Every statement here is invented. No real dispute is analysed.', 3.0);
    notice.position.set(0, 2.7, -6.6);
    this.group.add(notice);
    scope.track(notice.geometry);
  }

  private correctCount(): number {
    let n = 0;
    for (let i = 0; i < STATEMENTS.length; i++) {
      if (this.sorted[i] >= 0 && KINDS[this.sorted[i]].key === STATEMENTS[i].answer) n++;
    }
    return n;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 4);
    this.binCounts.fill(0);

    for (let i = 0; i < this.cards.length; i++) {
      const bin = this.sorted[i];
      let target: THREE.Vector3;
      if (bin < 0) {
        target = this.homes[i];
      } else {
        target = this.scratchTarget.copy(this.binSlots[bin]);
        target.y += this.binCounts[bin]++ * 0.03;
      }
      this.cards[i].position.lerp(target, rate);

      // Under the reveal, a correct classification lifts slightly.
      if (this.revealed && bin >= 0) {
        const correct = KINDS[bin].key === STATEMENTS[i].answer;
        this.cards[i].position.y += correct ? 0.06 : 0;
        this.cards[i].rotation.z += ((correct ? 0 : 0.12) - this.cards[i].rotation.z) * rate;
      } else {
        this.cards[i].rotation.z += (0 - this.cards[i].rotation.z) * rate;
      }
    }
  }

  protected override onReset(): void {
    this.revealed = false;
    for (let i = 0; i < this.sorted.length; i++) {
      this.sorted[i] = -1;
      if (this.cards[i]) {
        this.cards[i].position.copy(this.homes[i]);
        this.cards[i].rotation.set(0, 0, 0);
      }
    }
  }

  protected override describeState(): string {
    const placed = this.sorted.filter((s) => s >= 0).length;
    if (placed === 0) {
      return `Five invented statements lie unsorted on the table, with five categories to sort them into: ${KINDS.map((k) => k.name).join(', ')}.`;
    }
    if (!this.revealed) {
      return `${placed} of ${STATEMENTS.length} statements classified. The tool’s own analysis is hidden.`;
    }
    return `${placed} of ${STATEMENTS.length} classified, and ${this.correctCount()} match the tool’s reading. The analysis is shown.`;
  }
}
