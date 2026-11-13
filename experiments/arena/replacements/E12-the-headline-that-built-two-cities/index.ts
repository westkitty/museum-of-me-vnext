import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Dial, Filament, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  createInitialFramingState,
  cycleEmphasis,
  cyclePinnedObservation,
  FRAME_HEADLINES,
  SHARED_OBSERVATIONS,
  toggleDissolveToSource,
  toggleStripInferences,
  type FramingState,
} from './model';

export class HeadlineTwoCitiesExhibit extends ExhibitBase {
  private state: FramingState = createInitialFramingState();

  private cityAGroup!: THREE.Group;
  private cityBGroup!: THREE.Group;
  private cityAInferences = this.tracked<THREE.Mesh>();
  private cityBInferences = this.tracked<THREE.Mesh>();
  private sourcePips = this.tracked<THREE.MeshStandardMaterial>();
  private tethersA = this.tracked<Filament>();
  private tethersB = this.tracked<Filament>();

  private emphasisDial!: Dial;
  private pinDial!: Dial;
  private stripLever!: Lever;
  private dissolveLever!: Lever;

  private headlineALabel!: THREE.Mesh;
  private headlineBLabel!: THREE.Mesh;
  private statusReadout!: THREE.Mesh;

  private cityAX = -2.05;
  private cityBX = 2.05;
  private cityAYScale = 1.0;
  private cityBYScale = 1.0;

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpMid = new THREE.Vector3();
  private readonly curve = new THREE.QuadraticBezierCurve3(this.tmpA, this.tmpMid, this.tmpB);

  protected override build(): void {
    const scope = this.ctx.scope;
    const bronze = this.standard(0x8e723d, { roughness: 0.42, metalness: 0.65 });
    const slate = this.standard(0x232630, { roughness: 0.78 });
    const frameAMat = this.standard(0xd9923b, { emissive: 0x522a08, emissiveIntensity: 0.3, roughness: 0.48 });
    const frameBMat = this.standard(0x4c82b8, { emissive: 0x0c2848, emissiveIntensity: 0.3, roughness: 0.48 });
    const inferenceAMat = this.emissive(0xffaa42, 1.05);
    const inferenceBMat = this.emissive(0x55a8ff, 1.05);

    // ── Shared Center Foundation Plinth (z = -5.0, clear of PLINTH_BOX) ───────
    const plinthBase = this.mesh(new THREE.BoxGeometry(5.6, 0.34, 2.3), slate);
    plinthBase.position.set(0, 0.17, -5.0);

    const centralLedger = this.mesh(new THREE.BoxGeometry(1.45, 0.85, 1.35), bronze);
    centralLedger.position.set(0, 0.76, -5.0);

    const ledgerHeader = buildLabel(scope, 'IMMUTABLE SOURCE LOGS', 1.35, 0.24);
    ledgerHeader.position.set(0, 1.32, -4.3);
    this.group.add(ledgerHeader);

    // 3 Fixed Immutable Source Observation Pips stacked vertically on central ledger
    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const obs = SHARED_OBSERVATIONS[i];
      const pipMat = this.emissive(0xffe7a8, 1.2);
      this.sourcePips.push(pipMat);
      const pip = this.mesh(new THREE.BoxGeometry(0.95, 0.16, 0.95), pipMat);
      pip.position.set(0, 1.45 + i * 0.28, -5.0);

      const obsLbl = buildLabel(scope, `${obs.timestamp} ${obs.metric}`, 1.25, 0.18);
      obsLbl.position.set(0, 1.45 + i * 0.28, -4.42);
      this.group.add(obsLbl);
    }

    // ── Opposing Narrative City A (Left: Heroic Rescue Framing) ──────────────
    this.cityAGroup = new THREE.Group();
    this.cityAGroup.position.set(-2.05, 0.34, -5.0);
    const baseA = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.5, 0.9, 1.3)), frameAMat);
    baseA.position.y = 0.45;
    const towerA = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.95, 1.25, 0.95)), frameAMat);
    towerA.position.y = 1.45;
    this.cityAGroup.add(baseA, towerA);

    for (let i = 0; i < 2; i++) {
      const inf = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.24, 0)), inferenceAMat);
      inf.scale.set(0.85, 2.2, 0.85);
      inf.position.set(i === 0 ? -0.35 : 0.35, 2.55, 0);
      this.cityAInferences.push(inf);
      this.cityAGroup.add(inf);
    }
    this.group.add(this.cityAGroup);

    this.headlineALabel = buildLabel(scope, FRAME_HEADLINES.balanced.a, 2.0, 0.24);
    this.headlineALabel.position.set(-2.1, 3.65, -5.0);
    this.group.add(this.headlineALabel);

    // ── Opposing Narrative City B (Right: Concealment Framing) ───────────────
    this.cityBGroup = new THREE.Group();
    this.cityBGroup.position.set(2.05, 0.34, -5.0);
    const baseB = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.5, 0.9, 1.3)), frameBMat);
    baseB.position.y = 0.45;
    const towerB = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.95, 1.25, 0.95)), frameBMat);
    towerB.position.y = 1.45;
    this.cityBGroup.add(baseB, towerB);

    for (let i = 0; i < 2; i++) {
      const inf = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.28, 0.9, 0.28)), inferenceBMat);
      inf.position.set(i === 0 ? -0.35 : 0.35, 2.55, 0);
      this.cityBInferences.push(inf);
      this.cityBGroup.add(inf);
    }
    this.group.add(this.cityBGroup);

    this.headlineBLabel = buildLabel(scope, FRAME_HEADLINES.balanced.b, 2.0, 0.24);
    this.headlineBLabel.position.set(2.1, 3.65, -5.0);
    this.group.add(this.headlineBLabel);

    // Bilateral Evidence Tethers linking central observations -> City A and City B
    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const y = 1.45 + i * 0.28;
      const fa = new Filament(scope, 8, 0.018, this.emissive(0xffc96b, 1.1));
      this.tmpA.set(-0.48, y, -5.0);
      this.tmpB.set(-1.35, 0.8 + i * 0.4, -5.0);
      this.tmpMid.set(-0.92, y + 0.16, -5.0);
      fa.follow(this.curve);
      this.tethersA.push(fa);
      this.group.add(fa.group);

      const fb = new Filament(scope, 8, 0.018, this.emissive(0x6ec3ff, 1.1));
      this.tmpA.set(0.48, y, -5.0);
      this.tmpB.set(1.35, 0.8 + i * 0.4, -5.0);
      this.tmpMid.set(0.92, y + 0.16, -5.0);
      fb.follow(this.curve);
      this.tethersB.push(fb);
      this.group.add(fb.group);
    }

    // Status Banner cleanly above center
    this.statusReadout = buildLabel(scope, 'EMPHASIS: BALANCED · INFERENCES VISIBLE · 3 IMMUTABLE LOGS', 3.6, 0.16);
    this.statusReadout.position.set(0, 4.35, -5.9);
    this.group.add(this.statusReadout);

    // ── Console at z = -1.95 (clear of plinth) ──────────────────────────────
    const consoleGroup = buildConsole(scope, 2.55, 0.7, 1.0, slate);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    this.emphasisDial = new Dial(scope, 3, 0.2, { handle: inferenceAMat });
    this.emphasisDial.group.position.set(-0.94, 1.03, -1.93);
    this.group.add(this.emphasisDial.group);
    const empLbl = buildLabel(scope, 'EMPHASIS', 0.46, 0.28);
    empLbl.position.set(-0.94, 1.14, -1.64);
    empLbl.rotation.x = -0.35;
    this.group.add(empLbl);

    this.pinDial = new Dial(scope, 4, 0.2, { handle: inferenceBMat });
    this.pinDial.group.position.set(-0.38, 1.03, -1.93);
    this.group.add(this.pinDial.group);
    const pinLbl = buildLabel(scope, 'PIN LOG', 0.46, 0.28);
    pinLbl.position.set(-0.38, 1.14, -1.64);
    pinLbl.rotation.x = -0.35;
    this.group.add(pinLbl);

    this.stripLever = new Lever(scope, 2, 0.36, { arm: bronze });
    this.stripLever.group.position.set(0.22, 1.03, -1.93);
    this.group.add(this.stripLever.group);
    const strLbl = buildLabel(scope, 'STRIP INF', 0.46, 0.28);
    strLbl.position.set(0.22, 1.14, -1.64);
    strLbl.rotation.x = -0.35;
    this.group.add(strLbl);

    this.dissolveLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xffe7a8, 1.1) });
    this.dissolveLever.group.position.set(0.76, 1.03, -1.93);
    this.group.add(this.dissolveLever.group);
    const disLbl = buildLabel(scope, 'DISSOLVE', 0.46, 0.28);
    disLbl.position.set(0.76, 1.14, -1.64);
    disLbl.rotation.x = -0.35;
    this.group.add(disLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), bronze);
    resetPuck.position.set(1.14, 1.04, -1.93);

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
      object: this.emphasisDial.group,
      label: () => `Shift Framing (${this.state.emphasis.toUpperCase()})`,
      description: 'Shift framing emphasis between Balanced, City A (Rescue), and City B (Failure) over identical observations.',
      activate: () => {
        this.state = cycleEmphasis(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.pinDial.group,
      label: () => `Pin Evidence (${this.state.pinned})`,
      description: 'Highlight one immutable harbor log line and trace how both divergent frames anchor to it.',
      activate: () => {
        this.state = cyclePinnedObservation(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.stripLever.group,
      label: () => (this.state.inferencesStripped ? 'Inferences: STRIPPED' : 'Strip Unsupported Inferences'),
      description: 'Remove floating inference spires lacking source citations on both City A and City B.',
      activate: () => {
        this.state = toggleStripInferences(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.dissolveLever.group,
      label: () => (this.state.dissolvedToSource ? 'Restore Divergent Frames' : 'Dissolve to Shared Source'),
      description: 'Collapse both framing towers inward onto the shared immutable 3-line observation ledger.',
      activate: () => {
        this.state = toggleDissolveToSource(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Framing',
      description: 'Restore balanced dual cities over the unmodified harbor sensor logs.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E12 narrative cities cleanly.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    const empIdx = ['balanced', 'frameA', 'frameB'].indexOf(this.state.emphasis);
    const pinIdx = ['all', 'obs_flow', 'obs_seal', 'obs_bypass'].indexOf(this.state.pinned);

    this.emphasisDial.value = Math.max(0, empIdx);
    this.pinDial.value = Math.max(0, pinIdx);
    this.stripLever.value = this.state.inferencesStripped ? 1 : 0;
    this.dissolveLever.value = this.state.dissolvedToSource ? 1 : 0;

    const showInf = !this.state.inferencesStripped && !this.state.dissolvedToSource;
    for (const m of this.cityAInferences) m.visible = showInf;
    for (const m of this.cityBInferences) m.visible = showInf;

    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const obs = SHARED_OBSERVATIONS[i];
      const active = this.state.pinned === 'all' || this.state.pinned === obs.id;
      this.sourcePips[i].emissiveIntensity = active ? 1.8 : 0.35;
      this.tethersA[i].setVisible(active && !this.state.dissolvedToSource);
      this.tethersB[i].setVisible(active && !this.state.dissolvedToSource);
    }

    const headlines = FRAME_HEADLINES[this.state.emphasis];
    updateLabel(scope, this.headlineALabel, headlines.a);
    updateLabel(scope, this.headlineBLabel, headlines.b);

    const status = this.state.dissolvedToSource
      ? 'DISSOLVED TO SHARED SOURCE · IDENTICAL 3 LOGS REMAIN'
      : `EMPHASIS: ${this.state.emphasis.toUpperCase()} · PIN: ${this.state.pinned.toUpperCase()} · ${this.state.inferencesStripped ? 'PURE CITATIONS' : 'WITH INFERENCES'}`;
    updateLabel(scope, this.statusReadout, status);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.emphasisDial.update(dt, instant);
    this.pinDial.update(dt, instant);
    this.stripLever.update(dt, instant);
    this.dissolveLever.update(dt, instant);

    const targetAX = this.state.dissolvedToSource ? -0.35 : -2.05;
    const targetBX = this.state.dissolvedToSource ? 0.35 : 2.05;
    const targetAScale = this.state.dissolvedToSource
      ? 0.45
      : this.state.emphasis === 'frameA'
        ? 1.25
        : this.state.emphasis === 'frameB'
          ? 0.8
          : 1.0;
    const targetBScale = this.state.dissolvedToSource
      ? 0.45
      : this.state.emphasis === 'frameB'
        ? 1.25
        : this.state.emphasis === 'frameA'
          ? 0.8
          : 1.0;

    if (instant) {
      this.cityAX = targetAX;
      this.cityBX = targetBX;
      this.cityAYScale = targetAScale;
      this.cityBYScale = targetBScale;
    } else {
      const k = Math.min(1, dt * 7);
      this.cityAX += (targetAX - this.cityAX) * k;
      this.cityBX += (targetBX - this.cityBX) * k;
      this.cityAYScale += (targetAScale - this.cityAYScale) * k;
      this.cityBYScale += (targetBScale - this.cityBYScale) * k;
    }

    this.cityAGroup.position.x = this.cityAX;
    this.cityBGroup.position.x = this.cityBX;
    this.cityAGroup.scale.y = this.cityAYScale;
    this.cityBGroup.scale.y = this.cityBYScale;
  }

  protected override onReset(): void {
    this.state = createInitialFramingState();
    this.cityAX = -2.05;
    this.cityBX = 2.05;
    this.cityAYScale = 1.0;
    this.cityBYScale = 1.0;
    if (this.built) {
      this.cityAGroup.position.x = -2.05;
      this.cityBGroup.position.x = 2.05;
      this.cityAGroup.scale.y = 1.0;
      this.cityBGroup.scale.y = 1.0;
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    return (
      `Emphasis=${this.state.emphasis}, Pinned=${this.state.pinned}, ` +
      `InferencesStripped=${this.state.inferencesStripped}, Dissolved=${this.state.dissolvedToSource}, ` +
      `SourceLogs=${this.state.observations.length} (immutable).`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new HeadlineTwoCitiesExhibit(def);
}
