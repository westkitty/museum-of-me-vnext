import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E21 — Civic Support Studio. Tier B.
 *
 * A table where the visitor assembles a chronology, attaches evidence to each
 * event, and produces the next-action packet an institution would actually
 * accept. Events without evidence physically refuse to lock into the timeline,
 * which is the project's rule made mechanical.
 *
 * PRIVACY: the situation on this table is entirely invented for the museum.
 * No real case record, correspondence, housing document or personal detail
 * appears anywhere in this room.
 */

interface Event {
  readonly when: string;
  readonly what: string;
  readonly evidence: string;
  readonly note: string;
}

/** A fabricated situation. Every detail here was written for the exhibit. */
const TIMELINE: readonly Event[] = [
  { when: 'Day 1', what: 'Notice received', evidence: 'the notice itself, dated',
    note: 'The first document is usually the only one already in hand.' },
  { when: 'Day 3', what: 'Called the office', evidence: 'call log entry with time and duration',
    note: 'A call with no record did not happen, as far as the process is concerned.' },
  { when: 'Day 8', what: 'Submitted the form', evidence: 'submission receipt',
    note: 'The receipt matters more than the form. It is what proves the deadline was met.' },
  { when: 'Day 14', what: 'No response', evidence: 'the absence, dated and noted',
    note: 'An absence is evidence too, but only if it is recorded when it happens.' },
  { when: 'Day 15', what: 'Escalation letter', evidence: 'sent copy and delivery confirmation',
    note: 'The next action, derived from the state of the file rather than a generic checklist.' },
];

export class CivicSupport extends ExhibitBase {
  private cards = this.tracked<THREE.Group>();
  private slots = this.tracked<THREE.Vector3>();
  private attached = this.tracked<boolean>();
  private locked = this.tracked<boolean>();
  private packet!: THREE.Mesh;
  private rail!: Filament;

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

    const steel = this.standard(0x9aa4a6, { roughness: 0.35, metalness: 0.6 });
    const wood = this.standard(0xb08a5a, { roughness: 0.72 });
    const paper = this.standard(0xf2ede0, { roughness: 0.9 });

    // ── the table ──
    const top = new THREE.Mesh(scope.track(new THREE.BoxGeometry(5.6, 0.09, 1.7)), wood);
    top.position.set(0, 0.95, -3.8);
    this.group.add(top);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.1, 0.95, 1.5)), steel);
      leg.position.set(s * 2.5, 0.48, -3.8);
      this.group.add(leg);
    }

    // ── the chronology rail ──
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.4, 1.02, -3.8),
      new THREE.Vector3(0, 1.02, -3.8),
      new THREE.Vector3(2.4, 1.02, -3.8),
    ]);
    this.rail = new Filament(scope, 12, 0.02, steel);
    this.rail.follow(railCurve);
    this.group.add(this.rail.group);

    // ── one card per event ──
    TIMELINE.forEach((event, i) => {
      const x = -2.2 + (i / (TIMELINE.length - 1)) * 4.4;
      const card = new THREE.Group();
      card.position.set(x, 1.35, -3.4);
      this.group.add(card);
      this.cards.push(card);
      this.slots.push(new THREE.Vector3(x, 1.12, -3.8));
      this.attached.push(false);
      this.locked.push(false);

      const sheet = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.68, 0.02, 0.48)), paper);
      sheet.rotation.x = -0.35;
      card.add(sheet);

      const whenLabel = buildLabel(scope, event.when, 0.5);
      whenLabel.position.set(0, 0.28, 0);
      card.add(whenLabel);
      scope.track(whenLabel.geometry);

      const whatLabel = buildLabel(scope, event.what, 0.86);
      whatLabel.position.set(0, 0.03, 0.06);
      whatLabel.rotation.x = -Math.PI / 2 + 0.35;
      card.add(whatLabel);
      scope.track(whatLabel.geometry);

      // The evidence clip: visible, and empty until attached.
      const clip = new THREE.Mesh(
        scope.track(new THREE.TorusGeometry(0.08, 0.018, 6, 14)),
        this.emissive(0xd97a4e, 0.35),
      );
      clip.position.set(0.26, 0.06, -0.14);
      clip.rotation.x = Math.PI / 2;
      card.add(clip);
      (card.userData as { clip: THREE.Mesh }).clip = clip;

      this.control({
        object: card,
        label: this.attached[i] ? `Lock ${event.when} into the chronology` : `Attach evidence: ${event.evidence}`,
        description: `${event.note} An event with no evidence attached will not lock into the timeline.`,
        activate: () => this.step(i),
      });
    });

    // ── the next-action packet ──
    this.packet = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(0.9, 0.16, 0.62)),
      this.emissive(0x3fb9b2, 0.2),
    );
    this.packet.position.set(0, 1.12, -2.7);
    this.group.add(this.packet);

    const packetLabel = buildLabel(scope, 'Next-action packet', 1.0);
    packetLabel.position.set(0, 1.42, -2.7);
    this.group.add(packetLabel);
    scope.track(packetLabel.geometry);

    // ── the fiction notice, stated in the room ──
    const notice = buildLabel(scope, 'This situation is invented. No real case record appears here.', 3.2);
    notice.position.set(0, 2.7, -6.6);
    this.group.add(notice);
    scope.track(notice.geometry);

    const consoleGroup = buildConsole(scope, 0.62, 0.46, 1.0, steel);
    consoleGroup.position.set(-3.4, 0, -2.4);
    consoleGroup.rotation.y = 0.5;
    this.group.add(consoleGroup);

    const consoleLabel = buildLabel(scope, 'Produce the packet', 0.62);
    consoleLabel.position.set(0, 1.02, 0.2);
    consoleLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(consoleLabel);
    scope.track(consoleLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Produce the next-action packet',
      description:
        'Derives the next action from the state of the file rather than a generic checklist. It needs the whole chronology locked, because a partial timeline produces the wrong next step.',
      activate: () => this.produce(),
    });
  }

  private step(index: number): void {
    const event = TIMELINE[index];
    if (!this.attached[index]) {
      this.attached[index] = true;
      this.ctx.announce(`Evidence attached to ${event.when}: ${event.evidence}. ${event.note}`);
      return;
    }
    if (!this.locked[index]) {
      this.locked[index] = true;
      this.ctx.announce(`${event.when} locked into the chronology.`);
      return;
    }
    this.attached[index] = false;
    this.locked[index] = false;
    this.ctx.announce(`${event.when} removed from the chronology. Its evidence is detached.`);
  }

  private produce(): void {
    const lockedCount = this.locked.filter(Boolean).length;
    if (lockedCount < TIMELINE.length) {
      const missing = TIMELINE.filter((_e, i) => !this.locked[i]).map((e) => e.when).join(', ');
      this.ctx.announce(
        `The packet will not build yet. ${missing} ${lockedCount === TIMELINE.length - 1 ? 'is' : 'are'} not locked into the chronology, and a partial timeline produces the wrong next step.`,
      );
      return;
    }
    this.ctx.announce(
      'Packet produced: a dated chronology, the evidence attached to each event, and one defensible next action. This is the artifact the institution actually asks for.',
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const rate = this.reducedMotion ? 1 : Math.min(1, dt * 5);
    let lockedCount = 0;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const target = this.locked[i] ? this.slots[i] : new THREE.Vector3(this.slots[i].x, 1.35, -3.4);
      card.position.lerp(target, rate);
      if (this.locked[i]) lockedCount++;

      const clip = (card.userData as { clip: THREE.Mesh }).clip;
      const mat = clip.material as THREE.MeshStandardMaterial;
      const wanted = this.attached[i] ? 1.4 : 0.3;
      mat.emissiveIntensity += (wanted - mat.emissiveIntensity) * rate;
      mat.emissive.setHex(this.attached[i] ? 0x7fd67f : 0xd97a4e);
    }

    const complete = lockedCount === TIMELINE.length;
    const pm = this.packet.material as THREE.MeshStandardMaterial;
    pm.emissiveIntensity += ((complete ? 1.3 : 0.15) - pm.emissiveIntensity) * rate;
    if (!this.reducedMotion && complete) {
      this.packet.position.y = 1.12 + Math.sin(this.elapsed * 2) * 0.02;
    }
  }

  protected override onReset(): void {
    for (let i = 0; i < this.attached.length; i++) {
      this.attached[i] = false;
      this.locked[i] = false;
      if (this.cards[i]) this.cards[i].position.set(this.slots[i].x, 1.35, -3.4);
    }
    if (this.packet) this.packet.position.set(0, 1.12, -2.7);
  }

  protected override describeState(): string {
    const attached = this.attached.filter(Boolean).length;
    const locked = this.locked.filter(Boolean).length;
    if (locked === TIMELINE.length) {
      return `The chronology is complete: all ${TIMELINE.length} events locked with evidence attached, and the next-action packet is ready. The situation is invented for the museum.`;
    }
    return `${attached} of ${TIMELINE.length} events have evidence attached and ${locked} are locked into the chronology. Events without evidence will not lock.`;
  }
}
