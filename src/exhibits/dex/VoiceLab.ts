import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Dial } from '../parts';
import { ringTransforms } from '../../assets/generators';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E17 — Dex Voice Lab. Tier A.
 *
 * A circular laboratory with four stations around a central waveform. The
 * visitor picks a prerecorded sample and compares what each stage of the
 * pipeline makes of it: raw transcription, refined transcription, synthesised
 * voice, and command interpretation.
 *
 * PRIVACY: no microphone permission is requested and none is needed. Every
 * sample in this room is prerecorded and every waveform is synthesised from a
 * fixed sequence, so the exhibit cannot capture anything even in principle.
 */

interface Sample {
  readonly label: string;
  readonly raw: string;
  readonly refined: string;
  readonly command: string;
  /** Waveform character: [base frequency, roughness, length]. */
  readonly shape: readonly [number, number, number];
}

const SAMPLES: readonly Sample[] = [
  {
    label: 'Dictation, quiet room',
    raw: 'set the the meeting for tuesday at for pm',
    refined: 'Set the meeting for Tuesday at four p.m.',
    command: 'calendar.create(day: Tuesday, time: 16:00)',
    shape: [1.0, 0.25, 1.0],
  },
  {
    label: 'Dictation, noisy room',
    raw: 'send a mess to marcus about the uh the invoice',
    refined: 'Send a message to Marcus about the invoice.',
    command: 'message.compose(to: Marcus, subject: invoice)',
    shape: [1.35, 0.75, 0.85],
  },
  {
    label: 'Technical vocabulary',
    raw: 'run the ktx two transcoder on the glb assets',
    refined: 'Run the KTX2 transcoder on the GLB assets.',
    command: 'shell.run(tool: ktx2, target: *.glb)',
    shape: [0.8, 0.4, 1.2],
  },
];

const STAGES = [
  { name: 'Raw transcription', note: 'What local recognition produced before any correction.', colour: 0x8a9aa0 },
  { name: 'Refined transcription', note: 'After punctuation, casing and vocabulary repair. Still entirely on the machine.', colour: 0x3fb9b2 },
  { name: 'Synthesised voice', note: 'The same text read back by a local synthesis engine.', colour: 0xe8c65a },
  { name: 'Command interpretation', note: 'What a system would actually do with it — the point of dictation that reaches the whole OS.', colour: 0xd97a4e },
] as const;

const WAVE_BARS = 56;

export class VoiceLab extends ExhibitBase {
  private waveBars = this.tracked<THREE.Mesh>();
  private stationPanels = this.tracked<THREE.Mesh>();
  private stationLamps = this.tracked<THREE.Mesh>();
  private sampleDial!: Dial;
  private sample = 0;
  private stage = 0;
  private playhead = 0;

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
    lectern.position.set(3.4, 0, -5.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const stone = this.standard(0xdde3e1, { roughness: 0.7 });
    const steel = this.standard(0x8f9a9c, { roughness: 0.3, metalness: 0.7 });

    // ── the circular floor of the lab ──
    const floor = new THREE.Mesh(
      scope.track(new THREE.CylinderGeometry(5.0, 5.0, 0.06, 40)),
      stone,
    );
    floor.position.set(0, 0.05, -3.6);
    this.group.add(floor);

    const rail = new THREE.Mesh(
      scope.track(new THREE.TorusGeometry(5.0, 0.05, 6, 48)),
      steel,
    );
    rail.position.set(0, 0.9, -3.6);
    rail.rotation.x = Math.PI / 2;
    this.group.add(rail);

    // ── central waveform column ──
    const column = new THREE.Mesh(
      scope.track(new THREE.CylinderGeometry(0.9, 1.15, 1.0, 24)),
      stone,
    );
    column.position.set(0, 0.5, -3.6);
    this.group.add(column);

    const waveGroup = new THREE.Group();
    waveGroup.position.set(0, 1.55, -3.6);
    this.group.add(waveGroup);
    this.waveGroup = waveGroup;

    const barGeo = scope.track(new THREE.BoxGeometry(0.05, 1, 0.05));
    const barMat = this.emissive(0x3fb9b2, 0.9);
    const bars = this.scaled(WAVE_BARS);
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2;
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(Math.sin(a) * 0.75, 0, Math.cos(a) * 0.75);
      bar.rotation.y = a;
      waveGroup.add(bar);
      this.waveBars.push(bar);
    }

    // ── four stations around the ring ──
    const transforms = ringTransforms(STAGES.length, 3.9);
    STAGES.forEach((stage, i) => {
      const station = new THREE.Group();
      station.position.setFromMatrixPosition(transforms[i]).add(new THREE.Vector3(0, 0, -3.6));
      station.rotation.y = Math.atan2(station.position.x, station.position.z + 3.6) + Math.PI;
      this.group.add(station);

      const consoleGroup = buildConsole(scope, 0.9, 0.5, 1.0, steel);
      station.add(consoleGroup);

      // A panel that shows this stage's output.
      const panel = new THREE.Mesh(
        scope.track(new THREE.PlaneGeometry(1.05, 0.5)),
        this.emissive(stage.colour, 0.22),
      );
      panel.position.set(0, 1.42, 0.06);
      panel.rotation.x = -0.32;
      station.add(panel);
      this.stationPanels.push(panel);

      const panelFrame = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(1.14, 0.58, 0.05)),
        steel,
      );
      panelFrame.position.set(0, 1.42, 0.02);
      panelFrame.rotation.x = -0.32;
      station.add(panelFrame);

      const lamp = new THREE.Mesh(
        scope.track(new THREE.SphereGeometry(0.055, 10, 8)),
        this.emissive(stage.colour, i === 0 ? 1.5 : 0.08),
      );
      lamp.position.set(0, 1.04, 0.16);
      station.add(lamp);
      this.stationLamps.push(lamp);

      const label = buildLabel(scope, stage.name, 1.0);
      label.position.set(0, 1.85, 0);
      station.add(label);
      scope.track(label.geometry);

      this.control({
        object: station,
        label: `Compare: ${stage.name}`,
        description: stage.note,
        activate: () => {
          this.stage = i;
          this.stationLamps.forEach((l, li) => {
            (l.material as THREE.MeshStandardMaterial).emissiveIntensity = li === i ? 1.5 : 0.08;
          });
          this.playhead = 0;
          this.ctx.announce(`${stage.name}: “${this.textFor(i)}”. ${stage.note}`);
        },
      });
    });

    // ── sample selector ──
    const selector = buildConsole(scope, 0.66, 0.5, 1.0, steel);
    selector.position.set(0, 0, 1.4);
    this.group.add(selector);

    this.sampleDial = new Dial(scope, SAMPLES.length, 0.22, { handle: this.emissive(0x3fb9b2, 0.8) });
    this.sampleDial.group.position.set(0, 1.04, 0);
    selector.add(this.sampleDial.group);

    const selectorLabel = buildLabel(scope, 'Prerecorded sample', 0.68);
    selectorLabel.position.set(0, 1.02, 0.22);
    selectorLabel.rotation.x = -Math.PI / 2.1;
    selector.add(selectorLabel);
    scope.track(selectorLabel.geometry);

    this.control({
      object: selector,
      label: 'Choose a different sample',
      description:
        'Three prerecorded samples: a quiet room, a noisy one, and technical vocabulary. No microphone permission is requested — nothing in this room listens.',
      activate: () => {
        this.sample = this.sampleDial.advance();
        this.playhead = 0;
        this.ctx.announce(`Sample: ${SAMPLES[this.sample].label}. ${this.textFor(this.stage)}`);
      },
    });

    // The privacy notice is a physical sign, because it is a design decision.
    const notice = buildLabel(scope, 'No microphone is used. All samples are prerecorded.', 3.0);
    notice.position.set(0, 3.1, -7.0);
    this.group.add(notice);
    scope.track(notice.geometry);
  }

  private waveGroup!: THREE.Group;

  private textFor(stage: number): string {
    const s = SAMPLES[this.sample];
    return [s.raw, s.refined, s.refined, s.command][stage];
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    this.sampleDial.update(dt, this.reducedMotion);

    const [base, roughness] = SAMPLES[this.sample].shape;
    if (!this.reducedMotion) this.playhead += dt * 0.55;

    const bars = this.waveBars.length;
    for (let i = 0; i < bars; i++) {
      const t = i / bars;
      // Later stages read as cleaner: less roughness in the waveform.
      const noise = roughness * (1 - this.stage * 0.28);
      const amplitude =
        0.18 +
        Math.abs(Math.sin((t * 8 + this.playhead) * base * Math.PI)) * 0.5 +
        Math.abs(Math.sin(t * 47 + this.playhead * 3)) * noise * 0.35;
      const bar = this.waveBars[i];
      bar.scale.y = amplitude;
      bar.position.y = amplitude / 2;
    }

    const stageColour = STAGES[this.stage].colour;
    const mat = this.waveBars[0]?.material as THREE.MeshStandardMaterial | undefined;
    if (mat) mat.emissive.setHex(stageColour);

    this.stationPanels.forEach((panel, i) => {
      const active = i === this.stage;
      const pm = panel.material as THREE.MeshStandardMaterial;
      pm.emissiveIntensity += ((active ? 0.85 : 0.18) - pm.emissiveIntensity) * Math.min(1, dt * 5);
    });

    if (!this.reducedMotion) this.waveGroup.rotation.y += dt * 0.07;
  }

  protected override onReset(): void {
    this.sample = 0;
    this.stage = 0;
    this.playhead = 0;
    if (this.sampleDial) {
      this.sampleDial.value = 0;
      this.sampleDial.update(0, true);
    }
    if (this.waveGroup) this.waveGroup.rotation.set(0, 0, 0);
    this.stationLamps.forEach((l, li) => {
      (l.material as THREE.MeshStandardMaterial).emissiveIntensity = li === 0 ? 1.5 : 0.08;
    });
  }

  protected override describeState(): string {
    const sample = SAMPLES[this.sample];
    const stage = STAGES[this.stage];
    return `Sample “${sample.label}”, shown at the ${stage.name.toLowerCase()} station: “${this.textFor(this.stage)}”. No microphone is in use.`;
  }
}
