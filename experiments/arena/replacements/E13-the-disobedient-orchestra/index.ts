import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Dial, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  createInitialOrchestraState,
  cycleDirective,
  DIRECTIVES,
  generateNextTake,
  toggleSteeringMode,
  type OrchestraState,
} from './model';

interface SynthVoice {
  readonly osc: OscillatorNode;
  readonly gain: GainNode;
}

export class DisobedientOrchestraExhibit extends ExhibitBase {
  private state: OrchestraState = createInitialOrchestraState();

  private targetRings = this.tracked<THREE.Mesh>();
  private observedColumns = this.tracked<THREE.Mesh>();
  private observedMats = this.tracked<THREE.MeshStandardMaterial>();
  private orbitPucks = this.tracked<THREE.Mesh>();
  private observedHeights = new Float32Array(4);

  private directiveDial!: Dial;
  private cueLever!: Lever;
  private audioLever!: Lever;
  private topBanner!: THREE.Mesh;
  private subBanner!: THREE.Mesh;

  private audioCtx: AudioContext | null = null;
  private voices: SynthVoice[] = [];

  protected override build(): void {
    const scope = this.ctx.scope;
    const ebony = this.standard(0x1a1c24, { roughness: 0.72, metalness: 0.25 });
    const brass = this.standard(0xc99c46, { roughness: 0.36, metalness: 0.72 });
    const stageWood = this.standard(0x3a2a20, { roughness: 0.68 });

    // ── Amphitheater Orchestra Stage at z = -5.0 (clear of central plinth) ───
    const amphitheater = this.mesh(new THREE.CylinderGeometry(3.1, 3.35, 0.28, 16), stageWood);
    amphitheater.position.set(0, 0.14, -5.05);

    const conductorArc = this.mesh(new THREE.TorusGeometry(2.8, 0.06, 8, 32, Math.PI), brass);
    conductorArc.rotation.x = Math.PI / 2;
    conductorArc.rotation.z = Math.PI;
    conductorArc.position.set(0, 0.32, -4.7);

    // 4 Spatial Choir Stations across semicircular arc
    const layerXs = [-2.1, -0.7, 0.7, 2.1] as const;
    const layerZs = [-4.6, -5.35, -5.35, -4.6] as const;
    const obsColors = [0xff6b57, 0xffb347, 0x52c7ff, 0xc77dff] as const;

    for (let i = 0; i < 4; i++) {
      const layer = this.state.layers[i];
      const x = layerXs[i];
      const z = layerZs[i];

      const pedestal = this.mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.34, 12), ebony);
      pedestal.position.set(x, 0.45, z);

      // Gold Score Intention Marker Ring hovering at target height
      const ring = this.mesh(new THREE.TorusGeometry(0.48, 0.045, 8, 24), this.emissive(0xffe17a, 1.3));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.8 + layer.intended * 0.45, z);
      this.targetRings.push(ring);

      // Observed Output Harmonic Column
      const obsMat = this.emissive(obsColors[i], 1.3);
      this.observedMats.push(obsMat);
      const col = this.mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.0, 12), obsMat);
      col.position.set(x, 1.12, z);
      this.observedColumns.push(col);
      this.observedHeights[i] = 0.25 + layer.observed * 0.45;

      // Orbiting visual tuning puck (no audio required for full legibility)
      const puck = this.mesh(new THREE.OctahedronGeometry(0.14, 0), brass);
      puck.position.set(x, 2.9, z);
      this.orbitPucks.push(puck);

      const lbl = buildLabel(scope, layer.name.toUpperCase(), 0.76, 0.24);
      lbl.position.set(x, 0.52, z + 0.56);
      lbl.rotation.x = -0.4;
      this.group.add(lbl);
    }

    // Back Harmonic Readout Arch (capped well below media wing ceiling)
    this.topBanner = buildLabel(scope, 'TAKE #1 · SPARSE VERSE · DRIFT = 7 (RAW PROMPT)', 3.8, 0.16);
    this.topBanner.position.set(0, 4.15, -6.2);
    this.group.add(this.topBanner);

    this.subBanner = buildLabel(scope, 'SYNTHETIC LOCAL SPECTRUM PROBE · AUDIO MUTED · 3D SIGHT ACTIVE', 3.8, 0.16);
    this.subBanner.position.set(0, 3.55, -6.2);
    this.group.add(this.subBanner);

    // ── Conductor Console at z = -1.95 (clear of bay plinth) ─────────────────
    const consoleGroup = buildConsole(scope, 2.65, 0.7, 1.0, ebony);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    this.directiveDial = new Dial(scope, 3, 0.2, { handle: this.emissive(0xffe17a, 1.1) });
    this.directiveDial.group.position.set(-0.98, 1.03, -1.93);
    this.group.add(this.directiveDial.group);
    const dirLbl = buildLabel(scope, 'SCORE', 0.42, 0.28);
    dirLbl.position.set(-0.98, 1.14, -1.64);
    dirLbl.rotation.x = -0.35;
    this.group.add(dirLbl);

    this.cueLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0x52c7ff, 1.2) });
    this.cueLever.group.position.set(-0.42, 1.03, -1.93);
    this.group.add(this.cueLever.group);
    const cueLbl = buildLabel(scope, 'CUES', 0.42, 0.28);
    cueLbl.position.set(-0.42, 1.14, -1.64);
    cueLbl.rotation.x = -0.35;
    this.group.add(cueLbl);

    const takePuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), this.emissive(0xc77dff, 1.2));
    takePuck.position.set(0.18, 1.04, -1.93);
    const takeLbl = buildLabel(scope, 'NEW TAKE', 0.46, 0.28);
    takeLbl.position.set(0.18, 1.14, -1.64);
    takeLbl.rotation.x = -0.35;
    this.group.add(takeLbl);

    this.audioLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0x47f0a6, 1.0) });
    this.audioLever.group.position.set(0.75, 1.03, -1.93);
    this.group.add(this.audioLever.group);
    const audLbl = buildLabel(scope, 'AUDIO', 0.42, 0.28);
    audLbl.position.set(0.75, 1.14, -1.64);
    audLbl.rotation.x = -0.35;
    this.group.add(audLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), brass);
    resetPuck.position.set(1.16, 1.04, -1.93);

    // Wall plaque & reading lectern
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-4.1, 2.35, -7.25);
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.55, 0, -4.4);
    lectern.rotation.y = -0.45;
    this.group.add(lectern);

    // ── Register 5 Accessible Controls ────────────────────────────────────────
    this.control({
      object: this.directiveDial.group,
      label: () => {
        const d = DIRECTIVES.find((x) => x.id === this.state.directive) ?? DIRECTIVES[0];
        return `Score Directive (${d.label})`;
      },
      description: 'Cycle intended 4-layer vocal and instrumental density across Verse, Chorus, and Bridge.',
      activate: () => {
        this.state = cycleDirective(this.state);
        this.syncVisuals();
        this.updateAudioProbe();
        this.ctx.announce(this.state.lastNote);
      },
    });

    this.control({
      object: this.cueLever.group,
      label: () => (this.state.steering === 'strict_cues' ? 'Steering: STRICT CUES' : 'Steering: RAW PROMPT'),
      description: 'Toggle structured meta-tag bracketing to pull disobedient model layers back toward intended levels.',
      activate: () => {
        this.state = toggleSteeringMode(this.state);
        this.syncVisuals();
        this.updateAudioProbe();
        this.ctx.announce(this.state.lastNote);
      },
    });

    this.control({
      object: takePuck,
      label: () => `Generate Take (#${this.state.takeNumber})`,
      description: 'Compare deterministic generation takes to inspect where unbracketed layers drift.',
      activate: () => {
        this.state = generateNextTake(this.state);
        this.syncVisuals();
        this.updateAudioProbe();
        this.ctx.announce(this.state.lastNote);
      },
    });

    this.control({
      object: this.audioLever.group,
      label: () => (this.state.audioEnabled ? 'Audio Probe: ON (Synth)' : 'Audio Probe: MUTED'),
      description: 'Toggle optional local WebAudio harmonic probe modeling observed layer divergence (muted by default).',
      activate: () => {
        this.state = {
          ...this.state,
          audioEnabled: !this.state.audioEnabled,
          lastNote: !this.state.audioEnabled
            ? 'Enabled local WebAudio synth probe (modeling observed layer balance).'
            : 'Muted local WebAudio synth probe (visual spectrum comparison remains active).',
        };
        this.syncVisuals();
        this.updateAudioProbe();
        this.ctx.announce(this.state.lastNote);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Orchestra',
      description: 'Restore Take #1, sparse verse directive, raw prompt, and muted audio state.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E13 orchestra to Take #1 and muted probe.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    const dirIdx = DIRECTIVES.findIndex((d) => d.id === this.state.directive);
    this.directiveDial.value = Math.max(0, dirIdx);
    this.cueLever.value = this.state.steering === 'strict_cues' ? 1 : 0;
    this.audioLever.value = this.state.audioEnabled ? 1 : 0;

    for (let i = 0; i < 4; i++) {
      const layer = this.state.layers[i];
      this.targetRings[i].position.y = 0.72 + layer.intended * 0.45;
      const err = Math.abs(layer.observed - layer.intended);
      this.observedMats[i].emissiveIntensity = err === 0 ? 0.95 : 1.35 + err * 0.25;
    }

    const dirSpec = DIRECTIVES.find((d) => d.id === this.state.directive) ?? DIRECTIVES[0];
    const cueTag = this.state.steering === 'strict_cues' ? 'STRICT CUES' : 'RAW PROMPT';
    updateLabel(
      scope,
      this.topBanner,
      `TAKE #${this.state.takeNumber} · ${dirSpec.label.toUpperCase()} · ${cueTag} · DRIFT=${this.state.totalDrift}`,
    );
    updateLabel(
      scope,
      this.subBanner,
      `SYNTHETIC SPECTRUM PROBE · AUDIO ${this.state.audioEnabled ? 'UNMUTED' : 'MUTED'} · FOUNDATION/MOTION/VOICE/AIR`,
    );
  }

  private updateAudioProbe(): void {
    if (!this.state.audioEnabled) {
      this.stopAudio();
      return;
    }

    const ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!ctor) return;

    if (!this.audioCtx) {
      try {
        this.audioCtx = new ctor();
        for (let i = 0; i < 4; i++) {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = i === 0 ? 'triangle' : 'sine';
          osc.frequency.value = this.state.layers[i].freqHz;
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          this.voices.push({ osc, gain });
        }
      } catch {
        this.stopAudio();
        return;
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }

    for (let i = 0; i < this.voices.length; i++) {
      const level = this.state.layers[i].observed;
      this.voices[i].gain.gain.setTargetAtTime(level * 0.015, this.audioCtx.currentTime, 0.04);
    }
  }

  private stopAudio(): void {
    for (const v of this.voices.splice(0)) {
      try {
        v.osc.stop();
        v.osc.disconnect();
        v.gain.disconnect();
      } catch {
        // Ignore already-stopped oscillator nodes
      }
    }
    if (this.audioCtx) {
      const ctx = this.audioCtx;
      this.audioCtx = null;
      void ctx.close().catch(() => {});
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.directiveDial.update(dt, instant);
    this.cueLever.update(dt, instant);
    this.audioLever.update(dt, instant);

    for (let i = 0; i < 4; i++) {
      const layer = this.state.layers[i];
      const targetH = Math.max(0.18, 0.25 + layer.observed * 0.45);
      if (instant) {
        this.observedHeights[i] = targetH;
      } else {
        this.observedHeights[i] += (targetH - this.observedHeights[i]) * Math.min(1, dt * 8);
      }
      const h = this.observedHeights[i];
      this.observedColumns[i].scale.y = h;
      this.observedColumns[i].position.y = 0.62 + h * 0.5;
      this.orbitPucks[i].position.y = 0.72 + h + 0.22;
      if (!instant) {
        this.orbitPucks[i].rotation.y += dt * (0.6 + layer.observed * 0.45);
      }
    }
  }

  protected override onDeactivate(): void {
    this.stopAudio();
  }

  protected override onUnmount(): void {
    this.stopAudio();
  }

  protected override onDispose(): void {
    this.stopAudio();
  }

  protected override onReset(): void {
    this.state = createInitialOrchestraState();
    this.stopAudio();
    for (let i = 0; i < 4; i++) {
      this.observedHeights[i] = Math.max(0.18, 0.25 + this.state.layers[i].observed * 0.45);
    }
    if (this.built) {
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    return (
      `Take=#${this.state.takeNumber}, Directive=${this.state.directive}, ` +
      `Steering=${this.state.steering}, TotalDrift=${this.state.totalDrift}, ` +
      `Audio=${this.state.audioEnabled ? 'UNMUTED_SYNTH' : 'MUTED'}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new DisobedientOrchestraExhibit(def);
}
