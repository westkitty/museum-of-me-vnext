import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, buildNode, Dial, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  advanceCrisisPhase,
  createInitialCrisisState,
  cyclePowerPreset,
  presetFor,
  type StationCrisisState,
} from './model';

const TIMED_PHASE_INTERVAL_S = 2.5;

export class NinetySecondsExhibit extends ExhibitBase {
  private state: StationCrisisState = createInitialCrisisState();
  private timedAccumulator = 0;

  private powerDial!: Dial;
  private bulkheadLever!: Lever;
  private modeLever!: Lever;
  private stepLever!: Lever;

  private coreMat!: THREE.MeshStandardMaterial;
  private shieldMat!: THREE.MeshStandardMaterial;
  private outerWingMat!: THREE.MeshStandardMaterial;
  private coreSphere!: THREE.Mesh;
  private rotorRing!: THREE.Mesh;
  private fanBlades!: THREE.Group;
  private bulkheadShutter!: THREE.Mesh;
  private evacPodsGroup!: THREE.Group;
  private shieldBars = this.tracked<THREE.Mesh>();

  private statusReadout!: THREE.Mesh;
  private phaseReadout!: THREE.Mesh;

  private evacHeightCurrent = 2.38;
  private shutterXCurrent = -1.15;

  protected override build(): void {
    const scope = this.ctx.scope;
    const hullDark = this.standard(0x1f2430, { roughness: 0.6, metalness: 0.45 });
    const bulkheadSteel = this.standard(0x3a4354, { roughness: 0.5, metalness: 0.55 });
    const hazardAmber = this.standard(0xd48b28, { roughness: 0.4, metalness: 0.5 });

    this.coreMat = this.emissive(0x45c8ff, 1.45);
    this.shieldMat = this.emissive(0x39e5b6, 0.9);
    this.outerWingMat = this.standard(0x525a6a, { emissive: 0x3b1818, emissiveIntensity: 0.35, roughness: 0.55 });

    // ── Orbital Station Structural Support Pedestal (z in [-6.5, -3.5], clear of plinth) ──
    const basePad = this.mesh(new THREE.CylinderGeometry(2.35, 2.65, 0.22, 12), hullDark);
    basePad.position.set(0, 0.11, -5.05);

    const mast = this.mesh(new THREE.CylinderGeometry(0.32, 0.44, 1.35, 10), bulkheadSteel);
    mast.position.set(0, 0.78, -5.05);

    // Central Station Hub
    const coreHousing = this.mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.9, 8), bulkheadSteel);
    coreHousing.position.set(0, 1.8, -5.05);

    this.coreSphere = buildNode(scope, 0.42, this.coreMat);
    this.coreSphere.position.set(0, 1.85, -5.05);
    this.group.add(this.coreSphere);

    this.rotorRing = this.mesh(new THREE.TorusGeometry(0.84, 0.055, 8, 24), hazardAmber);
    this.rotorRing.rotation.x = Math.PI / 2;
    this.rotorRing.position.set(0, 1.85, -5.05);

    const shieldRing = this.mesh(new THREE.TorusGeometry(1.38, 0.04, 8, 32), this.shieldMat);
    shieldRing.rotation.x = Math.PI / 2;
    shieldRing.position.set(0, 1.85, -5.05);

    // West Life-Support Hab Module (x = -1.65)
    const westTunnel = this.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.95, 8), bulkheadSteel);
    westTunnel.rotation.z = Math.PI / 2;
    westTunnel.position.set(-1.12, 1.8, -5.05);

    const westHab = this.mesh(new THREE.BoxGeometry(1.05, 0.88, 1.1), hullDark);
    westHab.position.set(-1.9, 1.8, -5.05);

    this.fanBlades = new THREE.Group();
    this.fanBlades.position.set(-1.9, 1.8, -4.46);
    const fanMat = this.emissive(0x63d8ff, 1.1);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.46, 0.08, 0.04)), fanMat);
      blade.rotation.z = (i * Math.PI) / 3;
      this.fanBlades.add(blade);
    }
    this.group.add(this.fanBlades);

    // East Breached Outer Ring + Articulated Blast Bulkhead Shutter (x = +1.9)
    const eastTunnel = this.mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.95, 8), bulkheadSteel);
    eastTunnel.rotation.z = Math.PI / 2;
    eastTunnel.position.set(1.12, 1.8, -5.05);

    this.bulkheadShutter = this.mesh(new THREE.BoxGeometry(0.16, 0.72, 0.64), hazardAmber);
    this.bulkheadShutter.position.set(1.15, 2.35, -5.05);

    const eastWing = this.mesh(new THREE.BoxGeometry(1.15, 0.94, 1.2), this.outerWingMat);
    eastWing.position.set(1.98, 1.8, -5.05);

    const hullCrack = this.mesh(new THREE.BoxGeometry(0.12, 0.56, 0.65), this.emissive(0xff4a36, 1.5));
    hullCrack.position.set(2.54, 1.84, -5.05);

    // Vertical Launch Gantry & Evac Pod Assembly (ascends when evacuated)
    for (const side of [-0.42, 0.42] as const) {
      const rail = this.mesh(new THREE.BoxGeometry(0.08, 1.55, 0.08), bulkheadSteel);
      rail.position.set(side, 2.98, -5.05);
    }

    this.evacPodsGroup = new THREE.Group();
    this.evacPodsGroup.position.set(0, 2.38, -5.05);
    const podBody = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.24, 0.4, 4, 10)), hazardAmber);
    const podGlow = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 10)), this.coreMat);
    podGlow.position.y = -0.32;
    this.evacPodsGroup.add(podBody, podGlow);
    this.group.add(this.evacPodsGroup);

    // 4 Subsystem Allocation Pillars mounted beside the rear frame
    const pillarColors = [0x39e5b6, 0x45c8ff, 0x7eff9b, 0xffb84d];
    const pillarNames = ['SHLD', 'CORE', 'O2', 'EVAC'];
    for (let i = 0; i < 4; i++) {
      const x = -1.35 + i * 0.9;
      const plinth = this.mesh(new THREE.BoxGeometry(0.45, 0.14, 0.45), hullDark);
      plinth.position.set(x, 0.25, -6.2);
      const bar = this.mesh(new THREE.BoxGeometry(0.28, 1.0, 0.28), this.emissive(pillarColors[i], 1.2));
      bar.position.set(x, 0.85, -6.2);
      this.shieldBars.push(bar);
      const lbl = buildLabel(scope, pillarNames[i], 0.5, 0.28);
      lbl.position.set(x, 0.35, -5.92);
      this.group.add(lbl);
    }

    // Dynamic Status Displays cleanly above station gantry
    this.phaseReadout = buildLabel(scope, 'T-90S · STEP MODE · BALANCED [1/1/1/1]', 3.6, 0.16);
    this.phaseReadout.position.set(0, 4.65, -5.85);
    this.group.add(this.phaseReadout);

    this.statusReadout = buildLabel(scope, 'HULL 82% · O2 86% · CORE 78% · EVAC 15%', 3.6, 0.16);
    this.statusReadout.position.set(0, 4.1, -5.85);
    this.group.add(this.statusReadout);

    // ── Command Console at z = -2.0 (completely outside bay plinth) ───────────
    const consoleGroup = buildConsole(scope, 2.55, 0.72, 1.0, hullDark);
    consoleGroup.position.set(0, 0, -2.0);
    this.group.add(consoleGroup);

    this.powerDial = new Dial(scope, 4, 0.2, { handle: this.emissive(0x45c8ff, 1.1) });
    this.powerDial.group.position.set(-0.96, 1.03, -1.98);
    this.group.add(this.powerDial.group);
    const pwrLbl = buildLabel(scope, 'POWER', 0.44, 0.28);
    pwrLbl.position.set(-0.96, 1.14, -1.68);
    pwrLbl.rotation.x = -0.35;
    this.group.add(pwrLbl);

    this.bulkheadLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xd48b28, 1.1) });
    this.bulkheadLever.group.position.set(-0.42, 1.03, -1.98);
    this.group.add(this.bulkheadLever.group);
    const sealLbl = buildLabel(scope, 'SEAL BAY', 0.46, 0.28);
    sealLbl.position.set(-0.42, 1.14, -1.68);
    sealLbl.rotation.x = -0.35;
    this.group.add(sealLbl);

    this.modeLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0x7eff9b, 1.0) });
    this.modeLever.group.position.set(0.14, 1.03, -1.98);
    this.group.add(this.modeLever.group);
    const modeLbl = buildLabel(scope, 'TIMING', 0.46, 0.28);
    modeLbl.position.set(0.14, 1.14, -1.68);
    modeLbl.rotation.x = -0.35;
    this.group.add(modeLbl);

    this.stepLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xff6b57, 1.2) });
    this.stepLever.group.position.set(0.68, 1.03, -1.98);
    this.group.add(this.stepLever.group);
    const stepLbl = buildLabel(scope, 'ADV 30S', 0.46, 0.28);
    stepLbl.position.set(0.68, 1.14, -1.68);
    stepLbl.rotation.x = -0.35;
    this.group.add(stepLbl);

    const resetBtn = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12), hazardAmber);
    resetBtn.position.set(1.08, 1.04, -1.98);

    // Wall plaque & reading lectern
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-3.1, 2.35, -7.25);
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.6, 0, -4.4);
    lectern.rotation.y = -0.45;
    this.group.add(lectern);

    // ── Register 5 Accessible Controls ────────────────────────────────────────
    this.control({
      object: this.powerDial.group,
      label: () => `Power Priority (${presetFor(this.state.preset).label})`,
      description: 'Route 4 reactor power cells across Shielding, Core Cooling, O2 Life Support, and Evac Bay.',
      activate: () => {
        this.state = cyclePowerPreset(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastEvent);
      },
    });

    this.control({
      object: this.bulkheadLever.group,
      label: () => (this.state.outerBulkheadSealed ? 'Bulkhead: SEALED' : 'Bulkhead: OPEN'),
      description: 'Close the blast shutter to isolate the breached East wing; preserves hub pressure at oxygen cost.',
      activate: () => {
        const nextSeal = !this.state.outerBulkheadSealed;
        this.state = {
          ...this.state,
          outerBulkheadSealed: nextSeal,
          lastEvent: nextSeal ? 'Outer wing blast bulkhead SEALED.' : 'Outer wing blast bulkhead OPENED.',
        };
        this.syncVisuals();
        this.ctx.announce(this.state.lastEvent);
      },
    });

    this.control({
      object: this.modeLever.group,
      label: () => (this.state.timingMode === 'timed' ? 'Timing: TIMED SIM' : 'Timing: UNTIMED STEP'),
      description: 'Switch between manual untimed stepping and live 30s countdown simulation with identical crisis rules.',
      activate: () => {
        const nextMode = this.state.timingMode === 'step' ? 'timed' : 'step';
        this.timedAccumulator = 0;
        this.state = {
          ...this.state,
          timingMode: nextMode,
          lastEvent: nextMode === 'timed' ? 'Switched to live Timed Simulation.' : 'Switched to accessible Untimed Step mode.',
        };
        this.syncVisuals();
        this.ctx.announce(this.state.lastEvent);
      },
    });

    this.control({
      object: this.stepLever.group,
      label: () => (this.state.ending === 'NONE' ? `Advance 30s (T-${this.state.secondsRemaining}s)` : `Ended: ${this.state.ending}`),
      description: 'Resolve the next 30-second orbital crisis window using the current power allocation and bulkhead state.',
      activate: () => {
        if (this.state.ending !== 'NONE') {
          this.ctx.announce(`Crisis already resolved (${this.state.ending}). Reset Crisis to replay.`);
          return;
        }
        this.state = advanceCrisisPhase(this.state);
        this.timedAccumulator = 0;
        this.syncVisuals();
        this.ctx.announce(this.state.lastEvent);
      },
    });

    this.control({
      object: resetBtn,
      label: 'Reset Crisis',
      description: 'Restore station to T-90s pre-breach crisis state for another allocation run.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Orbital crisis reset to T-90s.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    const presetIdx = ['balanced', 'defense', 'evac', 'triage'].indexOf(this.state.preset);
    this.powerDial.value = Math.max(0, presetIdx);
    this.bulkheadLever.value = this.state.outerBulkheadSealed ? 1 : 0;
    this.modeLever.value = this.state.timingMode === 'timed' ? 1 : 0;
    this.stepLever.value = this.state.phase > 0 ? 1 : 0;

    const alloc = presetFor(this.state.preset).allocation;
    const vals = [alloc.shielding, alloc.reactor, alloc.lifeSupport, alloc.evacBay];
    for (let i = 0; i < this.shieldBars.length; i++) {
      const h = 0.25 + vals[i] * 0.55;
      this.shieldBars[i].scale.y = h;
      this.shieldBars[i].position.y = 0.35 + h * 0.5;
    }

    if (this.state.ending === 'CONTAINMENT_FAILURE') {
      this.coreMat.color.setHex(0xff3838);
      this.coreMat.emissive.setHex(0xff2222);
      this.shieldMat.emissive.setHex(0xff3838);
      this.outerWingMat.emissiveIntensity = 0.9;
    } else if (this.state.ending === 'CREW_EVACUATED_CORE_LOST') {
      this.coreMat.color.setHex(0xffa030);
      this.coreMat.emissive.setHex(0xff6b1a);
      this.shieldMat.emissive.setHex(0xffaa33);
      this.outerWingMat.emissiveIntensity = 0.7;
    } else if (this.state.ending === 'STATION_HELD_OUTER_VENTED') {
      this.coreMat.color.setHex(0x45f0ff);
      this.coreMat.emissive.setHex(0x1cd8ff);
      this.shieldMat.emissive.setHex(0x39e5b6);
      this.outerWingMat.emissiveIntensity = 0.25;
    } else {
      this.coreMat.color.setHex(0x45c8ff);
      this.coreMat.emissive.setHex(0x289cff);
      this.shieldMat.emissive.setHex(0x39e5b6);
      this.outerWingMat.emissiveIntensity = 0.4;
    }

    const modeTag = this.state.timingMode === 'timed' ? 'TIMED' : 'UNTIMED STEP';
    const sealTag = this.state.outerBulkheadSealed ? 'SEALED' : 'OPEN';
    updateLabel(
      scope,
      this.phaseReadout,
      `T-${this.state.secondsRemaining}S · ${modeTag} · BULKHEAD ${sealTag} · ${this.state.ending === 'NONE' ? presetFor(this.state.preset).label : this.state.ending}`,
    );
    updateLabel(
      scope,
      this.statusReadout,
      `HULL ${this.state.hullIntegrity}% · O2 ${this.state.oxygenPct}% · CORE ${this.state.coreStability}% · EVAC ${this.state.evacReadiness}% · CREW ${this.state.survivors}/12`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.powerDial.update(dt, instant);
    this.bulkheadLever.update(dt, instant);
    this.modeLever.update(dt, instant);
    this.stepLever.update(dt, instant);

    if (this.state.timingMode === 'timed' && this.state.ending === 'NONE') {
      this.timedAccumulator += dt;
      if (this.timedAccumulator >= TIMED_PHASE_INTERVAL_S) {
        this.timedAccumulator -= TIMED_PHASE_INTERVAL_S;
        this.state = advanceCrisisPhase(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastEvent);
      }
    }

    const targetEvacY = this.state.ending === 'CREW_EVACUATED_CORE_LOST' ? 3.42 : 2.38;
    const targetShutterY = this.state.outerBulkheadSealed ? 1.8 : 2.35;

    if (instant) {
      this.evacHeightCurrent = targetEvacY;
      this.shutterXCurrent = targetShutterY;
    } else {
      const k = Math.min(1, dt * 6);
      this.evacHeightCurrent += (targetEvacY - this.evacHeightCurrent) * k;
      this.shutterXCurrent += (targetShutterY - this.shutterXCurrent) * k;
      this.rotorRing.rotation.z += dt * (this.state.ending === 'CONTAINMENT_FAILURE' ? 2.4 : 0.7);
      this.fanBlades.rotation.z += dt * (0.4 + this.state.oxygenPct * 0.03);
      this.coreSphere.scale.setScalar(1 + Math.sin(this.elapsed * 3.1) * 0.04);
    }

    this.evacPodsGroup.position.y = this.evacHeightCurrent;
    this.bulkheadShutter.position.y = this.shutterXCurrent;
  }

  protected override onReset(): void {
    this.state = createInitialCrisisState();
    this.timedAccumulator = 0;
    this.evacHeightCurrent = 2.38;
    this.shutterXCurrent = 2.35;
    if (this.built) {
      this.evacPodsGroup.position.y = 2.38;
      this.bulkheadShutter.position.y = 2.35;
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    return (
      `T-${this.state.secondsRemaining}s (${this.state.timingMode}), ` +
      `Priority=${this.state.preset}, Bulkhead=${this.state.outerBulkheadSealed ? 'SEALED' : 'OPEN'}, ` +
      `Hull=${this.state.hullIntegrity}%, O2=${this.state.oxygenPct}%, ` +
      `Core=${this.state.coreStability}%, Evac=${this.state.evacReadiness}%, ` +
      `Survivors=${this.state.survivors}/12, Ending=${this.state.ending}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new NinetySecondsExhibit(def);
}
