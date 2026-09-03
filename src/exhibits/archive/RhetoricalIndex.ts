import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E12 — Rhetorical InDEX: a movable passage lens, not a five-bin quiz. */

type Finding = { readonly family: string; readonly pressure: number; readonly confidence: number; readonly note: string };
type Passage = { readonly text: string; readonly findings: readonly Finding[] };

const PASSAGES: readonly Passage[] = [
  { text: 'The gauge read 41 at 09:12.', findings: [
    { family: 'evidence', pressure: 1, confidence: 5, note: 'A timestamped observation with no interpretation attached.' },
  ] },
  { text: 'Even after three prior warnings, the gauge read 41.', findings: [
    { family: 'evidence', pressure: 1, confidence: 5, note: 'The reading is still evidence.' },
    { family: 'framing', pressure: 4, confidence: 5, note: 'The prior warnings change the reader’s frame without changing the measurement.' },
  ] },
  { text: 'A reading of 41 shows the seal had already failed.', findings: [
    { family: 'interpretation', pressure: 3, confidence: 4, note: 'The observed value is assigned a meaning.' },
  ] },
  { text: 'So the crew must have known for weeks.', findings: [
    { family: 'inference', pressure: 4, confidence: 4, note: 'The conclusion reaches beyond what the preceding observations establish.' },
  ] },
  { text: 'Everyone involved knew this would happen.', findings: [
    { family: 'unsupported', pressure: 5, confidence: 5, note: 'A broad certainty claim arrives without supporting evidence in the fixture.' },
  ] },
] as const;

export class RhetoricalIndex extends ExhibitBase {
  private lens!: THREE.Group;
  private passagePanels = this.tracked<THREE.Mesh>();
  private index = 0;
  private patternMode = false;
  private pins = new Set<number>();

  constructor(def: ExhibitDefinition) { super(def); }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -7.2); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.25, 0, -4.8); lectern.rotation.y = -0.6;
    this.group.add(lectern); scope.trackObject(lectern);

    const article = new THREE.Mesh(
      scope.track(new THREE.BoxGeometry(5.2, 2.65, 0.12)),
      this.standard(0xeee6d3, { roughness: 0.95 }),
    );
    article.position.set(0, 2.15, -5.1); this.group.add(article);

    PASSAGES.forEach((passage, i) => {
      const y = 3.0 - i * 0.48;
      const panel = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(4.55, 0.34, 0.035)),
        this.standard(0xd8cfbb, { roughness: 0.9 }),
      );
      panel.position.set(0, y, -5.0); this.group.add(panel); this.passagePanels.push(panel);
      const text = buildLabel(scope, passage.text, 4.1);
      text.position.set(0, y, -4.965); this.group.add(text); scope.track(text.geometry);
      this.control({
        object: panel,
        label: `Place lens: ${passage.text}`,
        description: 'Moves the rhetoric lens to this passage. Findings may overlap; pressure and confidence are separate measurements.',
        activate: () => { this.index = i; this.announcePassage(); },
      });
    });

    this.lens = new THREE.Group(); this.lens.position.set(0, 3.0, -4.82); this.group.add(this.lens);
    const ring = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.72, 0.055, 10, 36)), this.emissive(0xb995db, 1.2));
    this.lens.add(ring);
    const crossH = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.2, 0.018, 0.018)), this.emissive(0xb995db, 0.7));
    const crossV = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.018, 0.45, 0.018)), this.emissive(0xb995db, 0.7));
    this.lens.add(crossH, crossV);

    const scanConsole = buildConsole(scope, 0.62, 0.44, 1.0, this.standard(0x4c3e61, { roughness: 0.7 }));
    scanConsole.position.set(-2.1, 0, -2.0); this.group.add(scanConsole);
    const scanLabel = buildLabel(scope, 'MOVE LENS', 0.6); scanLabel.position.set(0, 1.02, 0.2); scanLabel.rotation.x = -Math.PI / 2.1;
    scanConsole.add(scanLabel); scope.track(scanLabel.geometry);
    this.control({
      object: scanConsole,
      label: 'Move the rhetoric lens',
      description: 'Advances the lens passage by passage through the fictional article fixture.',
      activate: () => { this.index = (this.index + 1) % PASSAGES.length; this.announcePassage(); },
    });

    const pinConsole = buildConsole(scope, 0.62, 0.44, 1.0, this.standard(0x4c3e61, { roughness: 0.7 }));
    pinConsole.position.set(0, 0, -1.65); this.group.add(pinConsole);
    const pinLabel = buildLabel(scope, 'PIN PASSAGE', 0.62); pinLabel.position.set(0, 1.02, 0.2); pinLabel.rotation.x = -Math.PI / 2.1;
    pinConsole.add(pinLabel); scope.track(pinLabel.geometry);
    this.control({
      object: pinConsole,
      label: 'Pin or unpin current passage',
      description: 'Keeps a finding visible for pattern comparison without converting it into a verdict on the whole article.',
      activate: () => {
        if (this.pins.has(this.index)) this.pins.delete(this.index); else this.pins.add(this.index);
        this.ctx.announce(`${this.pins.has(this.index) ? 'Pinned' : 'Unpinned'} passage ${this.index + 1}. ${this.pins.size} passage${this.pins.size === 1 ? '' : 's'} pinned.`);
      },
    });

    const patternConsole = buildConsole(scope, 0.62, 0.44, 1.0, this.standard(0x4c3e61, { roughness: 0.7 }));
    patternConsole.position.set(2.1, 0, -2.0); this.group.add(patternConsole);
    const patternLabel = buildLabel(scope, 'PATTERN MODE', 0.62); patternLabel.position.set(0, 1.02, 0.2); patternLabel.rotation.x = -Math.PI / 2.1;
    patternConsole.add(patternLabel); scope.track(patternLabel.geometry);
    this.control({
      object: patternConsole,
      label: () => (this.patternMode ? 'Leave Pattern Mode' : 'Enter Pattern Mode'),
      description: 'Summarizes families found in pinned passages. It does not create a trust, ideology, truth, or harm score.',
      activate: () => {
        this.patternMode = !this.patternMode;
        this.ctx.announce(this.patternMode ? this.patternSummary() : 'Pattern Mode closed. The lens returns to the current passage.');
      },
    });

    const disclaimer = buildLabel(scope, 'FICTIONAL FIXTURE · NO LIVE FACT CHECK · PRESSURE ≠ CONFIDENCE', 3.9);
    disclaimer.position.set(0, 4.1, -5.0); this.group.add(disclaimer); scope.track(disclaimer.geometry);
  }

  private announcePassage(): void {
    const p = PASSAGES[this.index];
    const findings = p.findings.map((f) => `${f.family}: pressure ${f.pressure}/5, confidence ${f.confidence}/5 — ${f.note}`).join(' ');
    this.ctx.announce(`Passage ${this.index + 1}. ${findings}`);
  }

  private patternSummary(): string {
    if (this.pins.size === 0) return 'Pattern Mode. Nothing is pinned, so there is no pattern to summarize.';
    const counts = new Map<string, number>();
    for (const i of this.pins) for (const f of PASSAGES[i].findings) counts.set(f.family, (counts.get(f.family) ?? 0) + 1);
    return `Pattern Mode across ${this.pins.size} pinned passage${this.pins.size === 1 ? '' : 's'}: ${[...counts].map(([k, v]) => `${k} ×${v}`).join(', ')}. No article-level verdict is produced.`;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const y = 3.0 - this.index * 0.48;
    this.lens.position.y += (y - this.lens.position.y) * (this.reducedMotion ? 1 : Math.min(1, dt * 7));
    for (let i = 0; i < this.passagePanels.length; i++) {
      const mat = this.passagePanels[i].material as THREE.MeshStandardMaterial;
      const target = this.pins.has(i) ? 0xbba2d2 : i === this.index ? 0xe9d775 : 0xd8cfbb;
      mat.color.lerp(new THREE.Color(target), Math.min(1, dt * 5));
    }
    if (!this.reducedMotion) this.lens.rotation.z += dt * 0.08;
  }

  protected override onReset(): void { this.index = 0; this.patternMode = false; this.pins.clear(); if (this.lens) this.lens.position.y = 3.0; }

  protected override describeState(): string {
    const p = PASSAGES[this.index];
    const mode = this.patternMode ? ` ${this.patternSummary()}` : '';
    return `The rhetoric lens is on passage ${this.index + 1}: “${p.text}” ${p.findings.length} finding${p.findings.length === 1 ? '' : 's'} visible; ${this.pins.size} pinned.${mode}`;
  }
}
