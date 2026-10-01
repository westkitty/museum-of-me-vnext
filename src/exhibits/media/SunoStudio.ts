import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Lever } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E13 — Suno Studio. Tier B, and the museum's visual mixing exhibit.
 *
 * Four arrangement layers can be raised or lowered, and the waveform sculpture
 * in front of the visitor answers — its form is the mix. Sound is deliberately
 * disabled across the museum during the current repair pass, so this exhibit
 * communicates through its controls, state text, and visual response alone.
 */

interface Layer {
  readonly name: string;
  readonly note: string;
  /** Relative frequency of this layer's tone. */
  readonly ratio: number;
  readonly colour: number;
}

const LAYERS: readonly Layer[] = [
  { name: 'Foundation', note: 'the structural bed a section is built on', ratio: 1, colour: 0x8a6bb5 },
  { name: 'Motion', note: 'the rhythmic figure that gives a section its pace', ratio: 1.5, colour: 0xb58b3a },
  { name: 'Voice', note: 'the melodic line the lyric actually sits on', ratio: 2.02, colour: 0xe8c65a },
  { name: 'Air', note: 'the texture that makes a section feel like a place', ratio: 3.01, colour: 0x5fd0e8 },
];

const EXCERPTS = ['Orbital Tomb', 'Heliocide', 'Starbinding'] as const;
const WAVE_POINTS = 72;

export class SunoStudio extends ExhibitBase {
  private levels = [2, 1, 2, 1];
  private excerpt = 0;
  private levers = this.tracked<Lever>();
  private waveBars = this.tracked<THREE.Mesh>();
  private waveGroup!: THREE.Group;
  private instruments = this.tracked<THREE.Mesh>();
  private excerptLabel!: THREE.Mesh;
  private mixChanged = false;

  /** Reused every frame; allocating these per element churned the heap. */
  private readonly scratchScale = new THREE.Vector3();

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.2, -6.4);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(2.9, 0, -4.0);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const wood = this.standard(0x5a4530, { roughness: 0.68 });
    const brass = this.standard(0xb9822c, { roughness: 0.3, metalness: 0.75 });
    const acoustic = this.standard(0x3a3028, { roughness: 1 });

    // ── acoustic treatment: the room is part of the exhibit ──
    const panelGeo = scope.track(new THREE.BoxGeometry(0.9, 1.4, 0.12));
    for (let i = 0; i < this.scaled(8); i++) {
      const panel = new THREE.Mesh(panelGeo, acoustic);
      const side = i % 2 === 0 ? -1 : 1;
      panel.position.set(side * 4.4, 1.6 + (i % 3) * 1.3, -2.2 - Math.floor(i / 2) * 1.5);
      panel.rotation.y = side * 0.35;
      this.group.add(panel);
    }

    // ── the mixing desk ──
    const desk = new THREE.Group();
    desk.position.set(0, 0, -2.0);
    this.group.add(desk);

    const surface = new THREE.Mesh(scope.track(new THREE.BoxGeometry(2.4, 0.1, 0.9)), wood);
    surface.position.y = 0.95;
    surface.rotation.x = -0.12;
    desk.add(surface);

    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.95, 0.7)), wood);
      leg.position.set(s * 1.05, 0.47, 0);
      desk.add(leg);
    }

    // ── one fader per arrangement layer ──
    LAYERS.forEach((layer, i) => {
      const x = -0.85 + i * 0.57;
      const lever = new Lever(scope, 3, 0.32, { arm: this.emissive(layer.colour, 0.8) });
      lever.value = this.levels[i];
      lever.group.position.set(x, 1.0, -0.05);
      desk.add(lever.group);
      this.levers.push(lever);

      const label = buildLabel(scope, layer.name, 0.5);
      label.position.set(x, 0.99, 0.3);
      label.rotation.x = -Math.PI / 2.2;
      desk.add(label);
      scope.track(label.geometry);

      this.control({
        object: lever.group,
        label: `Raise ${layer.name}`,
        description: `${layer.name} is ${layer.note}. Raising it changes the shape of the waveform in front of you.`,
        activate: () => {
          this.levels[i] = (this.levels[i] + 1) % 3;
          lever.value = this.levels[i];
          this.ctx.announce(
            `${layer.name} ${['muted', 'held back', 'forward'][this.levels[i]]}. ${layer.note}.`,
          );
          this.mixChanged = true;
        },
      });
    });

    // ── the waveform sculpture ──
    this.waveGroup = new THREE.Group();
    this.waveGroup.position.set(0, 1.9, -4.6);
    this.group.add(this.waveGroup);

    const barGeo = scope.track(new THREE.BoxGeometry(0.055, 1, 0.055));
    const barMat = this.emissive(0xe8c65a, 0.8);
    const count = this.scaled(WAVE_POINTS);
    for (let i = 0; i < count; i++) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.x = (i / (count - 1) - 0.5) * 4.4;
      this.waveGroup.add(bar);
      this.waveBars.push(bar);
    }

    // ── instrument forms that answer the mix spatially ──
    LAYERS.forEach((layer, i) => {
      const a = (i / LAYERS.length) * Math.PI * 2;
      const instrument = new THREE.Mesh(
        scope.track(new THREE.TorusGeometry(0.34 + i * 0.1, 0.05, 8, 28)),
        this.emissive(layer.colour, 0.6),
      );
      instrument.position.set(Math.sin(a) * 2.6, 2.6 + Math.cos(a) * 0.7, -5.6);
      instrument.rotation.set(Math.PI / 2.4, a, 0);
      this.group.add(instrument);
      this.instruments.push(instrument);
    });

    // ── excerpt selector ──
    const consoleGroup = buildConsole(scope, 0.62, 0.46, 1.0, wood);
    consoleGroup.position.set(-2.6, 0, -2.6);
    consoleGroup.rotation.y = 0.5;
    this.group.add(consoleGroup);

    const knob = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 18)), brass);
    knob.position.set(0, 1.03, 0);
    consoleGroup.add(knob);

    this.excerptLabel = buildLabel(scope, EXCERPTS[0], 0.62);
    this.excerptLabel.position.set(0, 1.02, 0.2);
    this.excerptLabel.rotation.x = -Math.PI / 2.1;
    consoleGroup.add(this.excerptLabel);
    scope.track(this.excerptLabel.geometry);

    this.control({
      object: consoleGroup,
      label: 'Change excerpt',
      description:
        'Switches between three project excerpts. Each has a different arrangement, so the same four faders read differently.',
      activate: () => {
        this.excerpt = (this.excerpt + 1) % EXCERPTS.length;
        this.ctx.announce(`Excerpt: ${EXCERPTS[this.excerpt]}. The arrangement changes under the same four faders.`);
        this.mixChanged = true;
      },
    });

    this.applyLevers(true);
  }

  private applyLevers(instant: boolean): void {
    for (let i = 0; i < this.levers.length; i++) this.levers[i].update(0, instant);
  }

  /** The waveform is a real sum of the enabled layers, not decoration. */
  private sampleWave(x: number, t: number): number {
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < LAYERS.length; i++) {
      const level = this.levels[i] / 2;
      if (level <= 0) continue;
      const layer = LAYERS[i];
      const phase = this.excerpt * 1.7;
      sum += Math.sin((x * layer.ratio * 6 + t * (1 + i * 0.35) + phase) * Math.PI) * level;
      weight += level;
    }
    return weight === 0 ? 0 : sum / weight;
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    for (const lever of this.levers) lever.update(dt, this.reducedMotion);

    const t = this.reducedMotion ? 0 : this.elapsed * 0.8;
    const count = this.waveBars.length;
    for (let i = 0; i < count; i++) {
      const x = i / (count - 1);
      const amplitude = Math.abs(this.sampleWave(x, t)) * 1.5 + 0.06;
      const bar = this.waveBars[i];
      bar.scale.y = amplitude;
      bar.position.y = amplitude / 2;
    }

    // Instruments answer their own layer's level.
    this.instruments.forEach((instrument, i) => {
      const level = this.levels[i] / 2;
      const target = 0.45 + level * 0.75;
      instrument.scale.lerp(this.scratchScale.setScalar(target), Math.min(1, dt * 4));
      const mat = instrument.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.12 + level * 0.9;
      if (!this.reducedMotion) instrument.rotation.z += dt * (0.1 + level * 0.5);
    });
  }

  protected override onReset(): void {
    this.levels = [2, 1, 2, 1];
    this.excerpt = 0;
    this.mixChanged = false;
    this.levers.forEach((lever, i) => {
      lever.value = this.levels[i];
      lever.update(0, true);
    });
    for (const instrument of this.instruments) instrument.rotation.z = 0;
  }

  protected override describeState(): string {
    const names = ['muted', 'held back', 'forward'];
    const mix = LAYERS.map((l, i) => `${l.name} ${names[this.levels[i]]}`).join(', ');
    const state = this.mixChanged ? 'The mix has been changed since you arrived.' : 'The desk is at its default mix.';
    return `Excerpt: ${EXCERPTS[this.excerpt]}. ${mix}. ${state}`;
  }
}
