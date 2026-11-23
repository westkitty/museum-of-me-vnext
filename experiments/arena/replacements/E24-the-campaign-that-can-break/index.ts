import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Filament, Lever } from '../../../../src/exhibits/parts';
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

const MAP_Y = 1.04;
const KEEP_Y = 1.12;

export class CampaignBreakExhibit extends ExhibitBase {
  private state: CampaignState = createInitialCampaignState();

  private readonly regionGroups: THREE.Group[] = [];
  private readonly keepMats: THREE.MeshStandardMaterial[] = [];
  private readonly beacons: THREE.MeshStandardMaterial[] = [];
  private readonly musterFlags: THREE.Mesh[] = [];

  private readonly bridges: THREE.Mesh[] = [];
  private readonly bridgeMats: THREE.MeshStandardMaterial[] = [];
  private readonly keyArcs: Filament[] = [];
  private readonly keyArcMats: THREE.MeshStandardMaterial[] = [];

  private orphanArc!: Filament;
  private orphanShard!: THREE.Mesh;
  private hazardGate!: THREE.Mesh;
  private keystoneCrystal!: THREE.Mesh;
  private keystoneMat!: THREE.MeshStandardMaterial;

  private unitBanner!: THREE.Group;
  private faultBeaconMat!: THREE.MeshStandardMaterial;
  private fortifyLever!: Lever;
  private faultLever!: Lever;
  private headerReadout!: THREE.Mesh;
  private schemaReadout!: THREE.Mesh;

  private readonly arcStart = new THREE.Vector3();
  private readonly arcMid = new THREE.Vector3();
  private readonly arcEnd = new THREE.Vector3();
  private readonly arcCurve = new THREE.QuadraticBezierCurve3(this.arcStart, this.arcMid, this.arcEnd);

  private unitX = REGIONS[0].x;
  private unitZ = REGIONS[0].z;
  private brokenBridgeTilt = 0;
  private orphanSink = 0;

  protected override build(): void {
    const scope = this.ctx.scope;
    const oak = this.standard(0x3a281d, { roughness: 0.68, metalness: 0.14 });
    const darkSlate = this.standard(0x1b1f29, { roughness: 0.82 });
    const brass = this.standard(0xd1a34b, { roughness: 0.34, metalness: 0.74 });
    const mapFelt = this.standard(0x334d3a, { roughness: 0.85 });

    const hillMat = this.standard(0x6b7f48, { roughness: 0.88 });
    const marshMat = this.standard(0x2d5b5e, { roughness: 0.72 });
    const forestMat = this.standard(0x2d5e37, { roughness: 0.84 });
    const keepStone = this.standard(0x5b606e, { roughness: 0.75 });
    const faultRed = this.emissive(0xff3e33, 1.5);
    const goldMat = this.emissive(0xffc947, 1.45);
    const aquaMat = this.emissive(0x52e0c4, 1.2);

    // ── Elevated Campaign Map Table (clear above low foreground console) ─────
    const pedestal = this.mesh(new THREE.BoxGeometry(2.8, 0.9, 1.6), oak);
    pedestal.position.set(0, 0.45, -5.0);

    const frameRim = this.mesh(new THREE.BoxGeometry(5.55, 0.14, 2.75), oak);
    frameRim.position.set(0, 0.96, -5.0);

    const mapBoard = this.mesh(new THREE.BoxGeometry(5.32, 0.1, 2.52), mapFelt);
    mapBoard.position.set(0, MAP_Y, -5.0);

    // ── 4 Biome-Specific Region Citadels + Fortification Standards ────────────
    this.regionGroups.length = 0;
    this.keepMats.length = 0;
    this.beacons.length = 0;
    this.musterFlags.length = 0;

    for (let i = 0; i < REGIONS.length; i++) {
      const r = REGIONS[i];
      const rGroup = new THREE.Group();
      rGroup.position.set(r.x, KEEP_Y, r.z);

      const kMat = this.standard(0x474c59, { roughness: 0.72 });
      this.keepMats.push(kMat);

      if (r.id === 'loc_westmarch') {
        const hill = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.45, 0.56, 0.16, 8)), hillMat);
        hill.position.y = 0.08;
        rGroup.add(hill);
      } else if (r.id === 'loc_saltfen') {
        const bog = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.5, 0.52, 0.07, 10)), marshMat);
        bog.position.y = 0.035;
        rGroup.add(bog);
      } else if (r.id === 'loc_thornwood') {
        const pineCount = this.ctx.detailScale >= 0.75 ? 4 : 2;
        const offsets = [
          [-0.42, 0.18],
          [0.42, 0.14],
          [-0.36, -0.32],
          [0.36, -0.3],
        ];
        for (let t = 0; t < pineCount; t++) {
          const pine = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.14, 0.44, 6)), forestMat);
          pine.position.set(offsets[t][0], 0.22, offsets[t][1]);
          rGroup.add(pine);
        }
      } else {
        // Last Keep: 4 corner bastions
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const bastion = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.09, 0.11, 0.56, 6)), keepStone);
            bastion.position.set(sx * 0.28, 0.28, sz * 0.28);
            rGroup.add(bastion);
          }
        }
      }

      const keepBody = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.26, 0.34, 0.48, 8)), kMat);
      keepBody.position.y = 0.26;
      const turret = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.28, 0.26, 8)), brass);
      turret.position.y = 0.62;
      rGroup.add(keepBody, turret);

      // Rising Fortification Banner per Citadel
      const flagPole = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6)), brass);
      flagPole.position.set(-0.34, 0.38, 0.22);
      const musterPennant = new THREE.Mesh(
        scope.track(new THREE.BoxGeometry(0.24, 0.14, 0.03)),
        this.emissive(0x62ff96, 1.35),
      );
      musterPennant.position.set(-0.22, 0.52, 0.22);
      musterPennant.visible = false;
      this.musterFlags.push(musterPennant);
      rGroup.add(flagPole, musterPennant);

      const bMat = this.emissive(0x36c88a, 0.5);
      this.beacons.push(bMat);
      const ring = new THREE.Mesh(scope.track(new THREE.RingGeometry(0.36, 0.45, 20)), bMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      rGroup.add(ring);

      this.group.add(rGroup);
      this.regionGroups.push(rGroup);

      const lbl = buildLabel(scope, r.name.toUpperCase(), 0.72, 0.22);
      lbl.position.set(r.x, KEEP_Y + 0.04, r.z + 0.54);
      lbl.rotation.x = -0.58;
      this.group.add(lbl);
    }

    // ── Physical Route Bridges + Overhead Referential Integrity Arcs ──────────
    this.bridges.length = 0;
    this.bridgeMats.length = 0;
    this.keyArcs.length = 0;
    this.keyArcMats.length = 0;

    for (let i = 0; i < 3; i++) {
      const a = REGIONS[i];
      const b = REGIONS[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz) - 0.56;
      const bMat = this.emissive(0x52e0c4, 1.15);
      this.bridgeMats.push(bMat);
      const span = this.mesh(new THREE.BoxGeometry(dist, 0.07, 0.2), bMat);
      span.position.set((a.x + b.x) / 2, KEEP_Y + 0.06, (a.z + b.z) / 2);
      span.rotation.y = -Math.atan2(dz, dx);
      this.bridges.push(span);

      // Foreign-key schema arc from citadel up into Schema Keystone Spine
      const keyMat = this.emissive(0x47f0a6, 0.9);
      this.keyArcMats.push(keyMat);
      const arc = new Filament(scope, 14, 0.018, keyMat);
      this.arcStart.set(b.x, KEEP_Y + 0.68, b.z);
      this.arcEnd.set(0, 2.58, -6.2);
      this.arcMid.set(b.x * 0.45, 2.4, (b.z - 6.2) * 0.5);
      arc.follow(this.arcCurve);
      this.group.add(arc.group);
      this.keyArcs.push(arc);
    }

    // Severed Hazard Barrier + Dangling Orphan Foreign-Key Pointer (active on FAULT)
    const salt = REGIONS[1];
    const thorn = REGIONS[2];
    this.hazardGate = this.mesh(new THREE.BoxGeometry(0.1, 0.36, 0.44), faultRed);
    this.hazardGate.position.set((salt.x + thorn.x) * 0.5 - 0.14, KEEP_Y + 0.22, (salt.z + thorn.z) * 0.5);
    this.hazardGate.rotation.y = -Math.atan2(thorn.z - salt.z, thorn.x - salt.x);
    this.hazardGate.visible = false;

    this.orphanArc = new Filament(scope, 14, 0.028, faultRed);
    this.arcStart.set(salt.x, KEEP_Y + 0.55, salt.z);
    this.arcEnd.set(0.05, 2.25, -4.1);
    this.arcMid.set(-0.35, 1.98, -4.85);
    this.orphanArc.follow(this.arcCurve);
    this.orphanArc.group.visible = false;
    this.group.add(this.orphanArc.group);

    this.orphanShard = this.mesh(new THREE.OctahedronGeometry(0.14, 0), faultRed);
    this.orphanShard.position.set(0.05, 2.25, -4.1);
    this.orphanShard.visible = false;

    // Controllable Herald Banner Pawn
    this.unitBanner = new THREE.Group();
    this.unitBanner.position.set(this.unitX, KEEP_Y + 0.48, this.unitZ);
    const pole = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.032, 0.038, 0.78, 8)), brass);
    pole.position.y = 0.39;
    const flag = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.36, 0.22, 0.04)), goldMat);
    flag.position.set(0.18, 0.64, 0);
    this.unitBanner.add(pole, flag);
    this.group.add(this.unitBanner);

    // ── Rear Schema Keystone Arch & Dependency Matrix Readout ─────────────────
    const archBack = this.mesh(new THREE.BoxGeometry(4.9, 1.55, 0.14), darkSlate);
    archBack.position.set(0, 3.38, -6.38);

    this.faultBeaconMat = this.emissive(0x47f0a6, 1.45);
    this.keystoneMat = this.faultBeaconMat;
    this.keystoneCrystal = this.mesh(new THREE.OctahedronGeometry(0.24, 0), this.keystoneMat);
    this.keystoneCrystal.position.set(-2.15, 3.38, -6.2);

    this.headerReadout = buildLabel(scope, 'BANNER: WESTMARCH · FORTIFIED 0/4 · SCHEMA INTACT', 3.7, 0.17);
    this.headerReadout.position.set(0.22, 3.68, -6.24);
    this.group.add(this.headerReadout);

    this.schemaReadout = buildLabel(scope, 'SCENARIO / UNIT / DIALOGUE IDS LINKED -> THORNWOOD', 3.7, 0.17);
    this.schemaReadout.position.set(0.22, 3.04, -6.24);
    this.group.add(this.schemaReadout);

    // ── Low Foreground Command Console (z = -1.78, h = 0.56 -> Zero board occlusion!) ──
    const consoleGroup = buildConsole(scope, 2.55, 0.62, 0.56, oak);
    consoleGroup.position.set(0, 0, -1.78);
    this.group.add(consoleGroup);

    const marchPuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), goldMat);
    marchPuck.position.set(-0.95, 0.6, -1.76);
    const marchLbl = buildLabel(scope, 'MARCH', 0.44, 0.24);
    marchLbl.position.set(-0.95, 0.65, -1.48);
    marchLbl.rotation.x = -0.45;
    this.group.add(marchLbl);

    this.fortifyLever = new Lever(scope, 2, 0.32, { arm: this.emissive(0x47f0a6, 1.0) });
    this.fortifyLever.group.position.set(-0.42, 0.59, -1.76);
    this.group.add(this.fortifyLever.group);
    const fortLbl = buildLabel(scope, 'FORTIFY', 0.44, 0.24);
    fortLbl.position.set(-0.42, 0.65, -1.48);
    fortLbl.rotation.x = -0.45;
    this.group.add(fortLbl);

    this.faultLever = new Lever(scope, 2, 0.32, { arm: faultRed });
    this.faultLever.group.position.set(0.18, 0.59, -1.76);
    this.group.add(this.faultLever.group);
    const brkLbl = buildLabel(scope, 'BREAK ID', 0.46, 0.24);
    brkLbl.position.set(0.18, 0.65, -1.48);
    brkLbl.rotation.x = -0.45;
    this.group.add(brkLbl);

    const fixPuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), aquaMat);
    fixPuck.position.set(0.72, 0.6, -1.76);
    const fixLbl = buildLabel(scope, 'REPAIR', 0.44, 0.24);
    fixLbl.position.set(0.72, 0.65, -1.48);
    fixLbl.rotation.x = -0.45;
    this.group.add(fixLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), brass);
    resetPuck.position.set(1.14, 0.6, -1.76);
    const rstLbl = buildLabel(scope, 'RESET', 0.36, 0.24);
    rstLbl.position.set(1.14, 0.65, -1.48);
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
    const broken = Boolean(this.state.fault);
    this.fortifyLever.value = this.state.fortified[this.state.unitRegion] ? 1 : 0;
    this.faultLever.value = broken ? 1 : 0;

    for (let i = 0; i < REGIONS.length; i++) {
      const r = REGIONS[i];
      const lit = this.state.fortified[r.id];
      const orphaned = broken && i >= 2;

      this.musterFlags[i].visible = lit && !orphaned;
      if (orphaned) {
        this.keepMats[i].color.setHex(0x3a2024);
        this.beacons[i].color.setHex(0xff3e33);
        this.beacons[i].emissive.setHex(0xb81a14);
        this.beacons[i].emissiveIntensity = 0.65;
      } else {
        this.keepMats[i].color.setHex(0x474c59);
        this.beacons[i].color.setHex(lit ? 0x62ff96 : 0x3b607a);
        this.beacons[i].emissive.setHex(lit ? 0x36e67a : 0x20405a);
        this.beacons[i].emissiveIntensity = lit ? 1.8 : 0.45;
      }
    }

    this.faultBeaconMat.color.setHex(broken ? 0xff4238 : 0x47f0a6);
    this.faultBeaconMat.emissive.setHex(broken ? 0xff2218 : 0x28c882);

    this.hazardGate.visible = broken;
    this.orphanArc.group.visible = broken;
    this.orphanShard.visible = broken;

    // Downstream schema arcs break crimson when Saltfen -> Thornwood foreign key fails
    for (let i = 0; i < this.keyArcMats.length; i++) {
      const arcBroken = broken && i >= 1;
      this.keyArcMats[i].color.setHex(arcBroken ? 0xff4238 : 0x47f0a6);
      this.keyArcMats[i].emissive.setHex(arcBroken ? 0xff2218 : 0x28c882);
      this.keyArcMats[i].emissiveIntensity = arcBroken ? 1.25 : 0.85;
    }

    if (this.bridgeMats.length >= 3) {
      this.bridgeMats[1].color.setHex(broken ? 0xff3b30 : 0x52e0c4);
      this.bridgeMats[1].emissive.setHex(broken ? 0xff1e10 : 0x22b89c);
      this.bridgeMats[2].color.setHex(broken ? 0x522a2a : 0x52e0c4);
      this.bridgeMats[2].emissive.setHex(broken ? 0x2b1212 : 0x22b89c);
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
        ? `FAULT: route_salt_thorn -> ${this.state.fault!.missingId} (ORPHANED DOWNSTREAM)`
        : 'SCENARIO / UNIT / DIALOGUE IDS LINKED -> LAST KEEP',
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.fortifyLever.update(dt, instant);
    this.faultLever.update(dt, instant);

    const target = regionSpecFor(this.state.unitRegion);
    const targetTilt = this.state.fault ? 0.58 : 0;
    const targetSink = this.state.fault ? 1 : 0;
    if (instant) {
      this.unitX = target.x;
      this.unitZ = target.z;
      this.brokenBridgeTilt = targetTilt;
      this.orphanSink = targetSink;
    } else {
      const k = Math.min(1, dt * 8);
      this.unitX += (target.x - this.unitX) * k;
      this.unitZ += (target.z - this.unitZ) * k;
      this.brokenBridgeTilt += (targetTilt - this.brokenBridgeTilt) * k;
      this.orphanSink += (targetSink - this.orphanSink) * k;
    }

    this.unitBanner.position.set(this.unitX, KEEP_Y + 0.48, this.unitZ);
    if (this.bridges.length >= 2) {
      this.bridges[1].rotation.x = this.brokenBridgeTilt;
      this.bridges[1].position.y = KEEP_Y + 0.06 - this.brokenBridgeTilt * 0.42;
    }

    // Physically sink & tilt orphaned downstream citadels (Thornwood & Last Keep) when FK fails
    for (let i = 2; i < this.regionGroups.length; i++) {
      this.regionGroups[i].position.y = KEEP_Y - this.orphanSink * 0.14;
      this.regionGroups[i].rotation.z = this.orphanSink * (i === 2 ? -0.14 : 0.14);
    }

    if (!instant && this.orphanShard.visible) {
      this.orphanShard.rotation.y = this.elapsed * 2.2;
    } else {
      this.orphanShard.rotation.y = 0;
    }
  }

  protected override onReset(): void {
    this.state = createInitialCampaignState();
    this.unitX = REGIONS[0].x;
    this.unitZ = REGIONS[0].z;
    this.brokenBridgeTilt = 0;
    this.orphanSink = 0;
    if (this.built) {
      this.unitBanner.position.set(this.unitX, KEEP_Y + 0.48, this.unitZ);
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
