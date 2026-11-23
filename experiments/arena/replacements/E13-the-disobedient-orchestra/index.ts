import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Dial, Filament, Lever } from '../../../../src/exhibits/parts';
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

const STAGE_Y = 0.72;
const LAYER_XS = [-2.05, -0.68, 0.68, 2.05] as const;
const LAYER_ZS = [-4.6, -5.25, -5.25, -4.6] as const;
const OBS_COLORS = [0xff6b57, 0xffb347, 0x52c7ff, 0xc77dff] as const;
const LAYER_RATIOS = [1.0, 1.5, 2.02, 3.01] as const;

export class DisobedientOrchestraExhibit extends ExhibitBase {
  private state: OrchestraState = createInitialOrchestraState();

  private readonly targetRings: THREE.Mesh[] = [];
  private readonly observedColumns: THREE.Mesh[] = [];
  private readonly observedMats: THREE.MeshStandardMaterial[] = [];
  private readonly orbitPucks: THREE.Mesh[] = [];
  private readonly diffTethers: Filament[] = [];
  private readonly diffMats: THREE.MeshStandardMaterial[] = [];
  private readonly waveBars: THREE.Mesh[] = [];
  private waveMat!: THREE.MeshStandardMaterial;
  private cueArc!: Filament;
  private cueArcMat!: THREE.MeshStandardMaterial;

  private readonly observedHeights = new Float32Array(4);
  private readonly tetherStart = new THREE.Vector3();
  private readonly tetherMid = new THREE.Vector3();
  private readonly tetherEnd = new THREE.Vector3();
  private readonly tetherCurve = new THREE.QuadraticBezierCurve3(this.tetherStart, this.tetherMid, this.tetherEnd);

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
    const brass = this.standard(0xcfa14a, { roughness: 0.34, metalness: 0.74 });
    const stageWood = this.standard(0x3a2a20, { roughness: 0.68 });
    const caliperSteel = this.standard(0x636b7d, { roughness: 0.55, metalness: 0.45 });

    // ── Elevated Amphitheater Orchestra Stage (clears low console cleanly) ─
    const riser = this.mesh(new THREE.CylinderGeometry(3.25, 3.5, 0.62, 16), stageWood);
    riser.position.set(0, 0.31, -5.0);

    const conductorArc = this.mesh(new THREE.TorusGeometry(2.85, 0.055, 8, 28, Math.PI), brass);
    conductorArc.rotation.x = Math.PI / 2;
    conductorArc.rotation.z = Math.PI;
    conductorArc.position.set(0, STAGE_Y - 0.04, -4.65);

    // Bracket-Cue Bridge Arc framing all 4 stations from overhead
    this.cueArcMat = this.emissive(0x6b7285, 0.55);
    this.cueArc = new Filament(scope, 18, 0.028, this.cueArcMat);
    this.tetherStart.set(LAYER_XS[0], STAGE_Y + 2.35, LAYER_ZS[0]);
    this.tetherMid.set(0, STAGE_Y + 3.05, -5.45);
    this.tetherEnd.set(LAYER_XS[3], STAGE_Y + 2.35, LAYER_ZS[3]);
    this.cueArc.follow(this.tetherCurve);
    this.group.add(this.cueArc.group);

    this.targetRings.length = 0;
    this.observedColumns.length = 0;
    this.observedMats.length = 0;
    this.orbitPucks.length = 0;
    this.diffTethers.length = 0;
    this.diffMats.length = 0;

    // 4 Spatial Choir Stations with Caliper Posts + Intended Ring + Observed Column + Error Tether
    const sharedPostGeo = scope.track(new THREE.BoxGeometry(0.045, 2.0, 0.045));
    const sharedColGeo = scope.track(new THREE.CylinderGeometry(0.22, 0.25, 1.0, 10));
    const sharedRingGeo = scope.track(new THREE.TorusGeometry(0.46, 0.045, 6, 20));
    const sharedPuckGeo = scope.track(new THREE.OctahedronGeometry(0.13, 0));

    for (let i = 0; i < 4; i++) {
      const layer = this.state.layers[i];
      const x = LAYER_XS[i];
      const z = LAYER_ZS[i];

      const pedestal = this.mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.22, 12), ebony);
      pedestal.position.set(x, STAGE_Y + 0.02, z);

      // Twin Scale Caliper Rails showing 0..4 dynamic range next to column
      if (this.ctx.detailScale >= 0.75) {
        for (const sx of [-0.46, 0.46]) {
          const post = new THREE.Mesh(sharedPostGeo, caliperSteel);
          post.position.set(x + sx, STAGE_Y + 1.12, z);
          this.group.add(post);
        }
      }

      // Gold Intended Target Ring
      const ring = new THREE.Mesh(sharedRingGeo, this.emissive(0xffe17a, 1.4));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, STAGE_Y + 0.35 + layer.intended * 0.42, z);
      this.group.add(ring);
      this.targetRings.push(ring);

      // Observed Output Harmonic Column
      const obsMat = this.emissive(OBS_COLORS[i], 1.25);
      this.observedMats.push(obsMat);
      const col = new THREE.Mesh(sharedColGeo, obsMat);
      col.position.set(x, STAGE_Y + 0.6, z);
      this.group.add(col);
      this.observedColumns.push(col);
      this.observedHeights[i] = 0.22 + layer.observed * 0.42;

      // Live Vertical Drift Tether between Intended Ring height & Observed Output top
      const dMat = this.emissive(0xff3e33, 1.6);
      this.diffMats.push(dMat);
      const tether = new Filament(scope, 10, 0.022, dMat);
      this.tetherStart.set(x, STAGE_Y + 0.35 + layer.intended * 0.42, z);
      this.tetherEnd.set(x, STAGE_Y + 0.35 + layer.observed * 0.42, z);
      this.tetherMid.set(x + (i < 2 ? -0.18 : 0.18), (this.tetherStart.y + this.tetherEnd.y) * 0.5, z + 0.22);
      tether.follow(this.tetherCurve);
      this.group.add(tether.group);
      this.diffTethers.push(tether);

      // Orbiting Tempo / Pitch Beacon above observed top
      const puck = new THREE.Mesh(sharedPuckGeo, brass);
      puck.position.set(x, STAGE_Y + 2.5, z);
      this.group.add(puck);
      this.orbitPucks.push(puck);

      const lbl = buildLabel(scope, layer.name.toUpperCase(), 0.78, 0.23);
      lbl.position.set(x, STAGE_Y + 0.14, z + 0.55);
      lbl.rotation.x = -0.45;
      this.group.add(lbl);
    }

    // ── Silent-Mode Harmonic Output Waveform Ribbon (re-anchors mix physics) ──
    const waveBarCount = this.scaled(24);
    const sharedBarGeo = scope.track(new THREE.BoxGeometry(0.09, 1.0, 0.09));
    this.waveMat = this.emissive(0xff6b57, 1.2);
    this.waveBars.length = 0;
    for (let i = 0; i < waveBarCount; i++) {
      const bar = new THREE.Mesh(sharedBarGeo, this.waveMat);
      const bx = (i / (waveBarCount - 1) - 0.5) * 4.2;
      bar.position.set(bx, 3.25, -6.05);
      bar.scale.y = 0.25;
      this.group.add(bar);
      this.waveBars.push(bar);
    }

    // Back Harmonic Readout Banners clear above Waveform Ribbon
    this.topBanner = buildLabel(scope, 'TAKE #1 · SPARSE VERSE · DRIFT = 7 (RAW PROMPT)', 3.9, 0.16);
    this.topBanner.position.set(0, 4.48, -6.22);
    this.group.add(this.topBanner);

    this.subBanner = buildLabel(scope, 'SYNTHETIC SPECTRUM PROBE · AUDIO MUTED · 3D SIGHT ACTIVE', 3.9, 0.16);
    this.subBanner.position.set(0, 3.92, -6.22);
    this.group.add(this.subBanner);

    // ── Low Foreground Conductor Console (z = -1.78, h = 0.56 -> Zero stage occlusion!) ──
    const consoleGroup = buildConsole(scope, 2.65, 0.62, 0.56, ebony);
    consoleGroup.position.set(0, 0, -1.78);
    this.group.add(consoleGroup);

    this.directiveDial = new Dial(scope, 3, 0.19, { handle: this.emissive(0xffe17a, 1.2) });
    this.directiveDial.group.position.set(-0.98, 0.59, -1.76);
    this.group.add(this.directiveDial.group);
    const dirLbl = buildLabel(scope, 'SCORE', 0.42, 0.24);
    dirLbl.position.set(-0.98, 0.65, -1.48);
    dirLbl.rotation.x = -0.45;
    this.group.add(dirLbl);

    this.cueLever = new Lever(scope, 2, 0.32, { arm: this.emissive(0x52c7ff, 1.25) });
    this.cueLever.group.position.set(-0.42, 0.59, -1.76);
    this.group.add(this.cueLever.group);
    const cueLbl = buildLabel(scope, 'CUES', 0.42, 0.24);
    cueLbl.position.set(-0.42, 0.65, -1.48);
    cueLbl.rotation.x = -0.45;
    this.group.add(cueLbl);

    const takePuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), this.emissive(0xc77dff, 1.25));
    takePuck.position.set(0.18, 0.6, -1.76);
    const takeLbl = buildLabel(scope, 'NEW TAKE', 0.46, 0.24);
    takeLbl.position.set(0.18, 0.65, -1.48);
    takeLbl.rotation.x = -0.45;
    this.group.add(takeLbl);

    this.audioLever = new Lever(scope, 2, 0.32, { arm: this.emissive(0x47f0a6, 1.1) });
    this.audioLever.group.position.set(0.75, 0.59, -1.76);
    this.group.add(this.audioLever.group);
    const audLbl = buildLabel(scope, 'AUDIO', 0.42, 0.24);
    audLbl.position.set(0.75, 0.65, -1.48);
    audLbl.rotation.x = -0.45;
    this.group.add(audLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), brass);
    resetPuck.position.set(1.16, 0.6, -1.76);
    const rstLbl = buildLabel(scope, 'RESET', 0.36, 0.24);
    rstLbl.position.set(1.16, 0.65, -1.48);
    rstLbl.rotation.x = -0.45;
    this.group.add(rstLbl);

    // Symmetrical Wall Plaque & Reading Lectern
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-3.85, 2.25, -4.45);
    plaque.rotation.y = 0.46;
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.85, 0, -4.4);
    lectern.rotation.y = -0.46;
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
    const strict = this.state.steering === 'strict_cues';

    this.directiveDial.value = Math.max(0, dirIdx);
    this.cueLever.value = strict ? 1 : 0;
    this.audioLever.value = this.state.audioEnabled ? 1 : 0;

    // Bracket-Cue Overhead Bridge glows cerulean-gold when strict meta-tags hold structure
    if (strict) {
      this.cueArcMat.color.setHex(0x52e0c4);
      this.cueArcMat.emissive.setHex(0x3ad18c);
      this.cueArcMat.emissiveIntensity = 1.45;
    } else {
      this.cueArcMat.color.setHex(0x6b7285);
      this.cueArcMat.emissive.setHex(0x2a2f3b);
      this.cueArcMat.emissiveIntensity = 0.45;
    }

    // Harmonic waveform color reflects drift lock
    if (this.state.totalDrift <= 1) {
      this.waveMat.color.setHex(0x52e0c4);
      this.waveMat.emissive.setHex(0x2fb899);
    } else {
      this.waveMat.color.setHex(0xff784f);
      this.waveMat.emissive.setHex(0xe83b28);
    }

    for (let i = 0; i < 4; i++) {
      const layer = this.state.layers[i];
      const intendedY = STAGE_Y + 0.35 + layer.intended * 0.42;
      const observedY = STAGE_Y + 0.35 + layer.observed * 0.42;
      this.targetRings[i].position.y = intendedY;

      const err = Math.abs(layer.observed - layer.intended);
      this.observedMats[i].emissiveIntensity = err === 0 ? 1.05 : 1.35 + err * 0.25;

      // Update error tether between Intended Ring and Observed Column top
      const x = LAYER_XS[i];
      const z = LAYER_ZS[i];
      this.tetherStart.set(x, intendedY, z);
      this.tetherEnd.set(x, observedY, z);
      this.tetherMid.set(x + (i < 2 ? -0.22 : 0.22), (intendedY + observedY) * 0.5, z + 0.28);
      this.diffTethers[i].follow(this.tetherCurve);
      this.diffTethers[i].group.visible = err > 0;
      if (err > 0) {
        this.diffMats[i].color.setHex(err >= 2 ? 0xff3e33 : 0xf2c86b);
        this.diffMats[i].emissive.setHex(err >= 2 ? 0xff1e10 : 0xd49b28);
      }
    }

    const dirSpec = DIRECTIVES.find((d) => d.id === this.state.directive) ?? DIRECTIVES[0];
    const cueTag = strict ? '[STRICT META-CUES]' : 'RAW PROMPT (IGNORED ADJECTIVES)';
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
      const targetH = Math.max(0.18, 0.22 + layer.observed * 0.42);
      if (instant) {
        this.observedHeights[i] = targetH;
      } else {
        this.observedHeights[i] += (targetH - this.observedHeights[i]) * Math.min(1, dt * 8);
      }
      const h = this.observedHeights[i];
      this.observedColumns[i].scale.y = h;
      this.observedColumns[i].position.y = STAGE_Y + 0.13 + h * 0.5;
      this.orbitPucks[i].position.y = STAGE_Y + 0.18 + h + 0.22;
      if (!instant) {
        this.orbitPucks[i].rotation.y += dt * (0.6 + layer.observed * 0.45);
      }
    }

    // Silent-mode live harmonic wave summed across 4 observed layers (zero allocations)
    const nBars = this.waveBars.length;
    const t = instant ? 0.35 : this.elapsed;
    const driftJagged = this.state.totalDrift > 1 ? 0.18 : 0;
    for (let b = 0; b < nBars; b++) {
      const nx = b / Math.max(1, nBars - 1);
      let sum = 0;
      let w = 0;
      for (let i = 0; i < 4; i++) {
        const amp = Math.max(0.1, this.state.layers[i].observed * 0.25);
        sum += Math.sin((nx * LAYER_RATIOS[i] * 5 + t * (1 + i * 0.35)) * Math.PI) * amp;
        w += amp;
      }
      const jitter = driftJagged * Math.sin(b * 3.7 + t * 5.0);
      const barH = Math.max(0.12, Math.abs(sum / Math.max(0.1, w) + jitter) * 0.72 + 0.12);
      this.waveBars[b].scale.y = barH;
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
      this.observedHeights[i] = Math.max(0.18, 0.22 + this.state.layers[i].observed * 0.42);
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
