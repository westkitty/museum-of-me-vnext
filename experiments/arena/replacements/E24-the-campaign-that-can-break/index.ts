import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  countFortifiedRegions,
  createInitialCampaignState,
  fortifyCurrentRegion,
  injectBrokenReferenceId,
  marchUnitNext,
  REGIONS,
  regionSpecFor,
  repairBrokenReferenceId,
  type CampaignState,
} from './model';

export class CampaignBreakExhibit extends ExhibitBase {
  private state: CampaignState = createInitialCampaignState();

  private bridges = this.tracked<THREE.Mesh>();
  private bridgeMats = this.tracked<THREE.MeshStandardMaterial>();
  private beacons = this.tracked<THREE.MeshStandardMaterial>();
  private unitBanner!: THREE.Group;
  private faultBeaconMat!: THREE.MeshStandardMaterial;

  private fortifyLever!: Lever;
  private faultLever!: Lever;
  private headerReadout!: THREE.Mesh;
  private schemaReadout!: THREE.Mesh;

  private unitX = REGIONS[0].x;
  private unitZ = REGIONS[0].z;
  private brokenBridgeTilt = 0;

  protected override build(): void {
    const scope = this.ctx.scope;
    const oak = this.standard(0x3a2a1e, { roughness: 0.72 });
    const stone = this.standard(0x3b3e47, { roughness: 0.8 });
    const brass = this.standard(0xc99c46, { roughness: 0.35, metalness: 0.7 });
    const grass = this.standard(0x3c5842, { roughness: 0.82 });

    // ── Campaign Map Table (z in [-6.35, -3.55], clear of bay plinth) ─────────
    const tableLeg = this.mesh(new THREE.BoxGeometry(2.6, 0.76, 1.5), oak);
    tableLeg.position.set(0, 0.38, -4.95);

    const mapBoard = this.mesh(new THREE.BoxGeometry(5.2, 0.16, 2.5), grass);
    mapBoard.position.set(0, 0.84, -4.95);

    const frameRim = this.mesh(new THREE.BoxGeometry(5.38, 0.1, 2.68), oak);
    frameRim.position.set(0, 0.8, -4.95);

    // 4 Citadel Keeps
    for (let i = 0; i < REGIONS.length; i++) {
      const r = REGIONS[i];
      const keep = this.mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.5, 8), stone);
      keep.position.set(r.x, 1.15, r.z);

      const turret = this.mesh(new THREE.ConeGeometry(0.34, 0.3, 8), brass);
      turret.position.set(r.x, 1.55, r.z);

      const bMat = this.emissive(0x36c88a, 0.45);
      this.beacons.push(bMat);
      const ring = this.mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 20), bMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(r.x, 0.96, r.z);

      const lbl = buildLabel(scope, r.name.toUpperCase(), 0.72, 0.24);
      lbl.position.set(r.x, 1.0, r.z + 0.56);
      lbl.rotation.x = -0.5;
      this.group.add(lbl);
    }

    // 3 Illuminated Route Bridges connecting the 4 Citadels
    for (let i = 0; i < 3; i++) {
      const a = REGIONS[i];
      const b = REGIONS[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz) - 0.52;
      const bMat = this.emissive(0x52e0c4, 1.1);
      this.bridgeMats.push(bMat);
      const span = this.mesh(new THREE.BoxGeometry(dist, 0.08, 0.22), bMat);
      span.position.set((a.x + b.x) / 2, 0.96, (a.z + b.z) / 2);
      span.rotation.y = -Math.atan2(dz, dx);
      this.bridges.push(span);
    }

    // Controllable Herald Banner Pawn
    this.unitBanner = new THREE.Group();
    this.unitBanner.position.set(this.unitX, 1.4, this.unitZ);
    const pole = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.03, 0.035, 0.72, 8)), brass);
    pole.position.y = 0.36;
    const flag = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.32, 0.2, 0.04)), this.emissive(0xffc947, 1.5));
    flag.position.set(0.16, 0.58, 0);
    this.unitBanner.add(pole, flag);
    this.group.add(this.unitBanner);

    // Rear Schema Integrity Board + Status Beacon
    const archBack = this.mesh(new THREE.BoxGeometry(4.8, 1.5, 0.16), stone);
    archBack.position.set(0, 3.3, -6.35);

    this.faultBeaconMat = this.emissive(0x47f0a6, 1.4);
    const beaconOrb = this.mesh(new THREE.OctahedronGeometry(0.22, 0), this.faultBeaconMat);
    beaconOrb.position.set(-2.15, 3.3, -6.18);

    this.headerReadout = buildLabel(scope, 'BANNER: WESTMARCH · FORTIFIED 0/4 · SCHEMA INTACT', 3.6, 0.17);
    this.headerReadout.position.set(0.2, 3.62, -6.22);
    this.group.add(this.headerReadout);

    this.schemaReadout = buildLabel(scope, 'ROUTES LINKED: WESTMARCH -> SALTFEN -> THORNWOOD -> LAST KEEP', 3.6, 0.17);
    this.schemaReadout.position.set(0.2, 2.98, -6.22);
    this.group.add(this.schemaReadout);

    // ── Command Console at z = -1.95 (clear of plinth) ──────────────────────
    const consoleGroup = buildConsole(scope, 2.55, 0.7, 1.0, oak);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    const marchPuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), this.emissive(0xffc947, 1.1));
    marchPuck.position.set(-0.95, 1.04, -1.93);
    const marchLbl = buildLabel(scope, 'MARCH', 0.44, 0.28);
    marchLbl.position.set(-0.95, 1.14, -1.64);
    marchLbl.rotation.x = -0.35;
    this.group.add(marchLbl);

    this.fortifyLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0x47f0a6, 1.0) });
    this.fortifyLever.group.position.set(-0.42, 1.03, -1.93);
    this.group.add(this.fortifyLever.group);
    const fortLbl = buildLabel(scope, 'FORTIFY', 0.44, 0.28);
    fortLbl.position.set(-0.42, 1.14, -1.64);
    fortLbl.rotation.x = -0.35;
    this.group.add(fortLbl);

    this.faultLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xff4a3b, 1.2) });
    this.faultLever.group.position.set(0.18, 1.03, -1.93);
    this.group.add(this.faultLever.group);
    const brkLbl = buildLabel(scope, 'BREAK ID', 0.46, 0.28);
    brkLbl.position.set(0.18, 1.14, -1.64);
    brkLbl.rotation.x = -0.35;
    this.group.add(brkLbl);

    const fixPuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), this.emissive(0x4bc8ff, 1.2));
    fixPuck.position.set(0.72, 1.04, -1.93);
    const fixLbl = buildLabel(scope, 'REPAIR', 0.44, 0.28);
    fixLbl.position.set(0.72, 1.14, -1.64);
    fixLbl.rotation.x = -0.35;
    this.group.add(fixLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), brass);
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
      object: marchPuck,
      label: () => `March Route (at ${regionSpecFor(this.state.unitRegion).name})`,
      description: 'Advance Herald banner along validated campaign edges; halts if edge references a broken ID.',
      activate: () => {
        this.state = marchUnitNext(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: this.fortifyLever.group,
      label: () => `Fortify Citadel (${countFortifiedRegions(this.state)}/4)`,
      description: 'Toggle muster defenses on the active region citadel.',
      activate: () => {
        this.state = fortifyCurrentRegion(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: this.faultLever.group,
      label: () => (this.state.fault ? 'Fault Active: loc_thornwood_MISSING' : 'Inject Broken Reference ID'),
      description: 'Inject synthetic unlinked target ID ("loc_thornwood_MISSING") into route_salt_thorn to observe systemic collapse.',
      activate: () => {
        this.state = injectBrokenReferenceId(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: fixPuck,
      label: () => (this.state.fault ? 'Diagnose & Repair ID' : 'Verify Schema (Clean)'),
      description: 'Audit route IDs, replace missing target with canonical loc_thornwood, and rebuild severed bridge.',
      activate: () => {
        this.state = repairBrokenReferenceId(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Campaign',
      description: 'Restore clean campaign schema, reset banner to Westmarch, and clear muster flags.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E24 campaign board cleanly to Westmarch.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    this.fortifyLever.value = this.state.fortified[this.state.unitRegion] ? 1 : 0;
    this.faultLever.value = this.state.fault ? 1 : 0;

    for (let i = 0; i < REGIONS.length; i++) {
      const r = REGIONS[i];
      const lit = this.state.fortified[r.id];
      this.beacons[i].color.setHex(lit ? 0x62ff96 : 0x3b607a);
      this.beacons[i].emissive.setHex(lit ? 0x36e67a : 0x20405a);
      this.beacons[i].emissiveIntensity = lit ? 1.8 : 0.45;
    }

    const broken = Boolean(this.state.fault);
    this.faultBeaconMat.color.setHex(broken ? 0xff4238 : 0x47f0a6);
    this.faultBeaconMat.emissive.setHex(broken ? 0xff2218 : 0x28c882);

    if (this.bridgeMats.length >= 2) {
      this.bridgeMats[1].color.setHex(broken ? 0xff3b30 : 0x52e0c4);
      this.bridgeMats[1].emissive.setHex(broken ? 0xff1e10 : 0x22b89c);
    }

    const active = regionSpecFor(this.state.unitRegion);
    updateLabel(
      scope,
      this.headerReadout,
      `BANNER: ${active.name.toUpperCase()} · FORTIFIED ${countFortifiedRegions(this.state)}/4 · ${broken ? 'SCHEMA FAULT' : 'SCHEMA INTACT'}`,
    );
    updateLabel(
      scope,
      this.schemaReadout,
      broken
        ? `FAULT: route_salt_thorn -> ${this.state.fault!.missingId} (BRIDGE SEVERED)`
        : 'ROUTES VERIFIED: WESTMARCH -> SALTFEN -> THORNWOOD -> LAST KEEP',
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.fortifyLever.update(dt, instant);
    this.faultLever.update(dt, instant);

    const target = regionSpecFor(this.state.unitRegion);
    const targetTilt = this.state.fault ? 0.48 : 0;
    if (instant) {
      this.unitX = target.x;
      this.unitZ = target.z;
      this.brokenBridgeTilt = targetTilt;
    } else {
      const k = Math.min(1, dt * 8);
      this.unitX += (target.x - this.unitX) * k;
      this.unitZ += (target.z - this.unitZ) * k;
      this.brokenBridgeTilt += (targetTilt - this.brokenBridgeTilt) * k;
    }

    this.unitBanner.position.set(this.unitX, 1.4, this.unitZ);
    if (this.bridges.length >= 2) {
      this.bridges[1].rotation.x = this.brokenBridgeTilt;
      this.bridges[1].position.y = 0.96 - this.brokenBridgeTilt * 0.45;
    }
  }

  protected override onReset(): void {
    this.state = createInitialCampaignState();
    this.unitX = REGIONS[0].x;
    this.unitZ = REGIONS[0].z;
    this.brokenBridgeTilt = 0;
    if (this.built) {
      this.unitBanner.position.set(this.unitX, 1.4, this.unitZ);
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    const region = regionSpecFor(this.state.unitRegion);
    const faultLabel = this.state.fault ? `FAULT(${this.state.fault.missingId})` : 'INTACT';
    return (
      `Region=${region.id} (${region.name}), Fortified=${countFortifiedRegions(this.state)}/4, ` +
      `Marches=${this.state.marchCount}, Schema=${faultLabel}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new CampaignBreakExhibit(def);
}
