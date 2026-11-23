import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, buildNode, Dial, Filament, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  advanceCrisisPhase,
  createInitialCrisisState,
  cyclePowerPreset,
  presetFor,
  type StationCrisisState,
} from './model';

const TIMED_PHASE_INTERVAL_S = 2.5;
const BASE_EVAC_Y = 2.58;
const LAUNCH_EVAC_Y = 3.44;
const OPEN_SHUTTER_Y = 2.62;
const SEALED_SHUTTER_Y = 2.05;

export class NinetySecondsExhibit extends ExhibitBase {
  private state: StationCrisisState = createInitialCrisisState();
  private timedAccumulator = 0;

  private powerDial!: Dial;
  private bulkheadLever!: Lever;
  private modeLever!: Lever;
  private stepLever!: Lever;

  private coreMat!: THREE.MeshStandardMaterial;
  private shieldMat!: THREE.MeshStandardMaterial;
  private westHabMat!: THREE.MeshStandardMaterial;
  private fanMat!: THREE.MeshStandardMaterial;
  private outerWingMat!: THREE.MeshStandardMaterial;
  private hullCrackMat!: THREE.MeshStandardMaterial;
  private podPlumeMat!: THREE.MeshStandardMaterial;

  private coreSphere!: THREE.Mesh;
  private rotorRing!: THREE.Mesh;
  private fanBlades!: THREE.Group;
  private bulkheadShutter!: THREE.Mesh;
  private evacPodsGroup!: THREE.Group;
  private eastWingGroup!: THREE.Group;
  private podPlume!: THREE.Mesh;

  private shieldArcs = this.tracked<THREE.Mesh>();
  private powerBars = this.tracked<THREE.Mesh>();
  private conduitMats = this.tracked<THREE.MeshStandardMaterial>();

  private statusReadout!: THREE.Mesh;
  private phaseReadout!: THREE.Mesh;
  private westModuleTag!: THREE.Mesh;
  private eastModuleTag!: THREE.Mesh;

  private evacHeightCurrent = BASE_EVAC_Y;
  private shutterYCurrent = OPEN_SHUTTER_Y;
  private eastOffsetCurrent = 0;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;
    const hullDark = this.standard(0x1f2430, { roughness: 0.6, metalness: 0.45 });
    const bulkheadSteel = this.standard(0x3a4354, { roughness: 0.5, metalness: 0.55 });
    const hazardAmber = this.standard(0xd48b28, { roughness: 0.4, metalness: 0.5 });

    this.coreMat = this.emissive(0x45c8ff, 1.55);
    this.shieldMat = this.emissive(0x39e5b6, 1.1);
    this.westHabMat = this.standard(0x283546, { emissive: 0x164a5e, emissiveIntensity: 0.4, roughness: 0.5 });
    this.outerWingMat = this.standard(0x4f5666, { emissive: 0x3b1818, emissiveIntensity: 0.35, roughness: 0.55 });
    this.hullCrackMat = this.emissive(0xff4a36, 1.6);
    this.podPlumeMat = this.emissive(0xffb84d, 1.7);

    // ── Orbital Station Support Deck (z in [-6.5, -3.4], clear of plinth) ──
    const basePad = this.mesh(new THREE.CylinderGeometry(2.55, 2.85, 0.24, 12), hullDark);
    basePad.position.set(0, 0.12, -4.85);

    const mast = this.mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.48, 8), bulkheadSteel);
    mast.position.set(0, 0.9, -5.15);

    // Open-Cage Reactor Core Hub (cutaway 4 struts so core condition is 100% visible)
    const hubFloor = this.mesh(new THREE.CylinderGeometry(0.88, 0.92, 0.14, 10), bulkheadSteel);
    hubFloor.position.set(0, 1.62, -5.15);
    const hubRoof = this.mesh(new THREE.CylinderGeometry(0.88, 0.92, 0.14, 10), bulkheadSteel);
    hubRoof.position.set(0, 2.48, -5.15);

    const strutGeo = scope.track(new THREE.BoxGeometry(0.11, 0.86, 0.11));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const strut = this.mesh(strutGeo, bulkheadSteel);
      strut.position.set(Math.cos(a) * 0.72, 2.05, -5.15 + Math.sin(a) * 0.72);
    }

    this.coreSphere = buildNode(scope, 0.38, this.coreMat);
    this.coreSphere.position.set(0, 2.05, -5.15);
    this.group.add(this.coreSphere);

    this.rotorRing = this.mesh(new THREE.TorusGeometry(0.68, 0.048, 6, 16), hazardAmber);
    this.rotorRing.rotation.x = Math.PI / 2;
    this.rotorRing.position.set(0, 2.05, -5.15);

    // Segmented 3-arc Shield Perimeter (arcs drop/shrink when Hull degrades)
    const arcGeo = scope.track(new THREE.BoxGeometry(1.02, 0.1, 0.1));
    for (let i = 0; i < 3; i++) {
      const a = -0.9 + i * 0.9;
      const arc = this.mesh(arcGeo, this.shieldMat);
      arc.position.set(Math.sin(a) * 1.15, 2.05, -5.15 + Math.cos(a) * 1.15);
      arc.rotation.y = a;
      this.shieldArcs.push(arc);
    }

    // West Life-Support Hab Module (x = -1.98)
    const westTunnel = this.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.96, 8), bulkheadSteel);
    westTunnel.rotation.z = Math.PI / 2;
    westTunnel.position.set(-1.14, 2.05, -5.15);

    const westHab = this.mesh(new THREE.BoxGeometry(1.06, 0.88, 1.04), this.westHabMat);
    westHab.position.set(-1.98, 2.05, -5.15);

    this.fanBlades = new THREE.Group();
    this.fanBlades.position.set(-1.98, 2.05, -4.58);
    this.fanMat = this.emissive(0x63d8ff, 1.15);
    const bladeGeo = scope.track(new THREE.BoxGeometry(0.48, 0.08, 0.04));
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeo, this.fanMat);
      blade.rotation.z = (i * Math.PI) / 3;
      this.fanBlades.add(blade);
    }
    this.group.add(this.fanBlades);

    this.westModuleTag = buildLabel(scope, 'HAB O2: 86%', 1.24, 0.16);
    this.westModuleTag.position.set(-1.98, 2.84, -5.1);
    this.group.add(this.westModuleTag);

    // East Breached Outer Ring + Articulated Blast Bulkhead Shutter (decouples when sealed)
    const eastTunnel = this.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.95, 8), bulkheadSteel);
    eastTunnel.rotation.z = Math.PI / 2;
    eastTunnel.position.set(1.12, 2.05, -5.15);

    this.bulkheadShutter = this.mesh(new THREE.BoxGeometry(0.18, 0.72, 0.62), hazardAmber);
    this.bulkheadShutter.position.set(1.22, OPEN_SHUTTER_Y, -5.15);

    this.eastWingGroup = new THREE.Group();
    this.eastWingGroup.position.set(2.02, 2.05, -5.15);
    const eastWing = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.12, 0.92, 1.12)), this.outerWingMat);
    const hullCrack = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.12, 0.56, 0.66)), this.hullCrackMat);
    hullCrack.position.set(0.54, 0.04, 0);
    this.eastWingGroup.add(eastWing, hullCrack);
    this.group.add(this.eastWingGroup);

    this.eastModuleTag = buildLabel(scope, 'OUTER SEAL: OPEN', 1.38, 0.16);
    this.eastModuleTag.position.set(2.02, 2.84, -5.1);
    this.group.add(this.eastModuleTag);

    // Vertical Evac Launch Gantry & Pod Assembly
    const railGeo = scope.track(new THREE.BoxGeometry(0.08, 1.48, 0.08));
    for (const side of [-0.38, 0.38] as const) {
      const rail = this.mesh(railGeo, bulkheadSteel);
      rail.position.set(side, 3.22, -5.15);
    }

    this.evacPodsGroup = new THREE.Group();
    this.evacPodsGroup.position.set(0, BASE_EVAC_Y, -5.15);
    const podBody = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.22, 0.36, 4, 8)), hazardAmber);
    this.podPlume = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.18, 0.42, 8)), this.podPlumeMat);
    this.podPlume.position.y = -0.44;
    this.podPlume.visible = false;
    this.evacPodsGroup.add(podBody, this.podPlume);
    this.group.add(this.evacPodsGroup);

    // 4 Foreground Power-to-Module Allocation Rails + Curved Conduit Filaments (O2, SHLD, CORE, EVAC)
    // Order matches left-to-right physical targets so conduits never cross!
    const railDefs = [
      { name: 'O2', x: -2.05, color: 0x7eff9b, target: new THREE.Vector3(-1.98, 1.62, -5.15) },
      { name: 'SHLD', x: -0.7, color: 0x39e5b6, target: new THREE.Vector3(-0.68, 1.8, -4.45) },
      { name: 'CORE', x: 0.7, color: 0x45c8ff, target: new THREE.Vector3(0.32, 1.85, -4.85) },
      { name: 'EVAC', x: 2.05, color: 0xffb84d, target: new THREE.Vector3(0.38, 2.55, -5.15) },
    ] as const;

    const meterFrameGeo = scope.track(new THREE.BoxGeometry(0.42, 0.14, 0.42));
    const meterBarGeo = scope.track(new THREE.BoxGeometry(0.26, 0.78, 0.26));
    for (const def of railDefs) {
      const plinth = this.mesh(meterFrameGeo, hullDark);
      plinth.position.set(def.x, 0.36, -3.72);

      const barMat = this.emissive(def.color, 1.2);
      const bar = this.mesh(meterBarGeo, barMat);
      bar.position.set(def.x, 0.82, -3.72);
      this.powerBars.push(bar);

      const lbl = buildLabel(scope, def.name, 0.5, 0.22);
      lbl.position.set(def.x, 1.3, -3.72);
      this.group.add(lbl);

      const condMat = this.emissive(def.color, 1.2);
      this.conduitMats.push(condMat);
      const fil = new Filament(scope, this.scaled(8), 0.022, condMat);
      const start = new THREE.Vector3(def.x, 0.96, -3.72);
      const mid = start.clone().lerp(def.target, 0.5).setY(1.5);
      fil.follow(new THREE.QuadraticBezierCurve3(start, mid, def.target));
      this.group.add(fil.group);
    }

    // Dynamic Status Displays cleanly framed above station gantry
    this.phaseReadout = buildLabel(scope, 'T-90S · UNTIMED STEP · BULKHEAD OPEN · Balanced [1/1/1/1]', 3.9, 0.16);
    this.phaseReadout.position.set(0, 4.86, -5.85);
    this.group.add(this.phaseReadout);

    this.statusReadout = buildLabel(scope, 'HULL 82% · O2 86% · CORE 78% · EVAC 15% · CREW 12/12', 3.9, 0.16);
    this.statusReadout.position.set(0, 4.34, -5.85);
    this.group.add(this.statusReadout);

    // Lowered streamlined Command Console at z = -1.92 so telemetry rails remain in full view
    const consoleGroup = buildConsole(scope, 2.55, 0.56, 0.68, hullDark);
    consoleGroup.position.set(0, 0, -1.92);
    this.group.add(consoleGroup);

    this.powerDial = new Dial(scope, 4, 0.18, { handle: this.emissive(0x45c8ff, 1.1) });
    this.powerDial.group.position.set(-0.98, 0.71, -1.9);
    this.group.add(this.powerDial.group);
    const pwrLbl = buildLabel(scope, 'POWER', 0.42, 0.24);
    pwrLbl.position.set(-0.98, 0.76, -1.62);
    pwrLbl.rotation.x = -0.5;
    this.group.add(pwrLbl);

    this.bulkheadLever = new Lever(scope, 2, 0.34, { arm: this.emissive(0xd48b28, 1.1) });
    this.bulkheadLever.group.position.set(-0.44, 0.71, -1.9);
    this.group.add(this.bulkheadLever.group);
    const sealLbl = buildLabel(scope, 'SEAL BAY', 0.44, 0.24);
    sealLbl.position.set(-0.44, 0.76, -1.62);
    sealLbl.rotation.x = -0.5;
    this.group.add(sealLbl);

    this.modeLever = new Lever(scope, 2, 0.34, { arm: this.emissive(0x7eff9b, 1.0) });
    this.modeLever.group.position.set(0.12, 0.71, -1.9);
    this.group.add(this.modeLever.group);
    const modeLbl = buildLabel(scope, 'TIMING', 0.42, 0.24);
    modeLbl.position.set(0.12, 0.76, -1.62);
    modeLbl.rotation.x = -0.5;
    this.group.add(modeLbl);

    this.stepLever = new Lever(scope, 2, 0.34, { arm: this.emissive(0xff6b57, 1.2) });
    this.stepLever.group.position.set(0.68, 0.71, -1.9);
    this.group.add(this.stepLever.group);
    const stepLbl = buildLabel(scope, 'ADV 30S', 0.42, 0.24);
    stepLbl.position.set(0.68, 0.76, -1.62);
    stepLbl.rotation.x = -0.5;
    this.group.add(stepLbl);

    const resetBtn = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 10), hazardAmber);
    resetBtn.position.set(1.1, 0.72, -1.9);
    const resetLbl = buildLabel(scope, 'RESET', 0.36, 0.24);
    resetLbl.position.set(1.1, 0.76, -1.62);
    resetLbl.rotation.x = -0.5;
    this.group.add(resetLbl);

    // Symmetrical outer Wall Plaque & Lectern keeping center gantry clear
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-3.85, 2.25, -4.45);
    plaque.rotation.y = 0.46;
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.85, 0, -4.4);
    lectern.rotation.y = -0.46;
    this.group.add(lectern);

    // 5 accessible controls
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

    // Power bars + coupled power conduits match O2, SHLD, CORE, EVAC
    const alloc = presetFor(this.state.preset).allocation;
    const vals = [alloc.lifeSupport, alloc.shielding, alloc.reactor, alloc.evacBay];
    const barColors = [0x7eff9b, 0x39e5b6, 0x45c8ff, 0xffb84d];
    for (let i = 0; i < this.powerBars.length; i++) {
      const cells = vals[i];
      const h = 0.22 + cells * 0.42;
      this.powerBars[i].scale.y = h;
      this.powerBars[i].position.y = 0.44 + h * 0.39;
      if (this.conduitMats[i]) {
        if (cells === 0) {
          this.conduitMats[i].color.setHex(0x4c3035);
          this.conduitMats[i].emissive.setHex(0x5a1c22);
          this.conduitMats[i].emissiveIntensity = 0.35;
        } else {
          this.conduitMats[i].color.setHex(barColors[i]);
          this.conduitMats[i].emissive.setHex(barColors[i]);
          this.conduitMats[i].emissiveIntensity = cells >= 2 ? 1.85 : 0.95;
        }
      }
    }

    // Shield perimeter arcs shrink and turn ember-red as hull weakens
    const shieldScale = Math.max(0.18, this.state.hullIntegrity / 100);
    for (const arc of this.shieldArcs) {
      arc.scale.set(shieldScale, 1, 1);
      arc.visible = this.state.hullIntegrity > 5;
    }

    // Core, West Hab, and Outer Wing reflect ending & systemic tradeoffs visibly
    const launched = this.state.ending === 'CREW_EVACUATED_CORE_LOST';
    const vented = this.state.ending === 'STATION_HELD_OUTER_VENTED';
    const failed = this.state.ending === 'CONTAINMENT_FAILURE';

    this.podPlume.visible = launched;
    if (failed) {
      this.coreMat.color.setHex(0xff3838);
      this.coreMat.emissive.setHex(0xff2222);
      this.coreMat.emissiveIntensity = 1.9;
      this.shieldMat.emissive.setHex(0xff3838);
      this.outerWingMat.emissiveIntensity = 1.1;
      this.hullCrackMat.emissiveIntensity = 2.2;
      this.westHabMat.emissiveIntensity = 0.15;
    } else if (launched) {
      // Crew escaped in pod, but unshielded central core scuttled dark/amber
      this.coreMat.color.setHex(0x5e2b20);
      this.coreMat.emissive.setHex(0xff4a1a);
      this.coreMat.emissiveIntensity = 0.55;
      this.shieldMat.emissive.setHex(0xff5238);
      this.outerWingMat.emissiveIntensity = 0.9;
      this.hullCrackMat.emissiveIntensity = 2.0;
      this.westHabMat.emissiveIntensity = 0.7;
    } else if (vented) {
      // Reactor core stabilized cool cyan, East wing vented dark behind blast shutter, West O2 low
      this.coreMat.color.setHex(0x45f0ff);
      this.coreMat.emissive.setHex(0x1cd8ff);
      this.coreMat.emissiveIntensity = 1.75;
      this.shieldMat.emissive.setHex(0x39e5b6);
      this.outerWingMat.emissive.setHex(0x141822);
      this.outerWingMat.emissiveIntensity = 0.08;
      this.hullCrackMat.emissiveIntensity = 0.25;
      this.westHabMat.emissiveIntensity = this.state.oxygenPct >= 30 ? 0.45 : 0.12;
    } else {
      this.coreMat.color.setHex(0x45c8ff);
      this.coreMat.emissive.setHex(0x289cff);
      this.coreMat.emissiveIntensity = 1.45;
      this.shieldMat.emissive.setHex(0x39e5b6);
      this.outerWingMat.emissive.setHex(0x3b1818);
      this.outerWingMat.emissiveIntensity = 0.4;
      this.hullCrackMat.emissiveIntensity = 1.6;
      this.westHabMat.emissiveIntensity = 0.2 + (this.state.oxygenPct / 100) * 0.45;
    }

    updateLabel(scope, this.westModuleTag, `HAB O2: ${this.state.oxygenPct}%`);
    if (this.state.oxygenPct < 20) {
      this.fanMat.color.setHex(0x6b2828);
      this.fanMat.emissive.setHex(0x8c2222);
      this.fanMat.emissiveIntensity = 0.35;
    } else {
      this.fanMat.color.setHex(0x63d8ff);
      this.fanMat.emissive.setHex(0x63d8ff);
      this.fanMat.emissiveIntensity = 0.45 + (this.state.oxygenPct / 100) * 0.85;
    }
    updateLabel(
      scope,
      this.eastModuleTag,
      vented
        ? 'OUTER VENTED · SEALED'
        : this.state.outerBulkheadSealed
          ? 'OUTER SEAL: CLOSED'
          : `OUTER HULL: ${this.state.hullIntegrity}%`,
    );

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

    const targetEvacY = this.state.ending === 'CREW_EVACUATED_CORE_LOST' ? LAUNCH_EVAC_Y : BASE_EVAC_Y;
    const targetShutterY = this.state.outerBulkheadSealed ? SEALED_SHUTTER_Y : OPEN_SHUTTER_Y;
    const targetEastOffset = this.state.ending === 'STATION_HELD_OUTER_VENTED' ? 0.36 : 0;

    if (instant) {
      this.evacHeightCurrent = targetEvacY;
      this.shutterYCurrent = targetShutterY;
      this.eastOffsetCurrent = targetEastOffset;
    } else {
      const k = Math.min(1, dt * 6);
      this.evacHeightCurrent += (targetEvacY - this.evacHeightCurrent) * k;
      this.shutterYCurrent += (targetShutterY - this.shutterYCurrent) * k;
      this.eastOffsetCurrent += (targetEastOffset - this.eastOffsetCurrent) * k;
      this.rotorRing.rotation.z += dt * (this.state.ending === 'CONTAINMENT_FAILURE' ? 2.4 : 0.7);
      this.fanBlades.rotation.z += dt * (0.3 + this.state.oxygenPct * 0.03);
      this.coreSphere.scale.setScalar(1 + Math.sin(this.elapsed * 3.1) * 0.04);
    }

    this.evacPodsGroup.position.y = this.evacHeightCurrent;
    this.bulkheadShutter.position.y = this.shutterYCurrent;
    this.eastWingGroup.position.x = 2.02 + this.eastOffsetCurrent;
    this.eastModuleTag.position.x = 2.02 + this.eastOffsetCurrent;
  }

  protected override onReset(): void {
    this.state = createInitialCrisisState();
    this.timedAccumulator = 0;
    this.evacHeightCurrent = BASE_EVAC_Y;
    this.shutterYCurrent = OPEN_SHUTTER_Y;
    this.eastOffsetCurrent = 0;
    if (this.built) {
      this.evacPodsGroup.position.y = BASE_EVAC_Y;
      this.bulkheadShutter.position.y = OPEN_SHUTTER_Y;
      this.eastWingGroup.position.x = 2.02;
      this.eastModuleTag.position.x = 2.02;
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
