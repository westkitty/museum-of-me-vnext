import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLectern, buildLabel, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, buildNode, Dial, Filament, Lever, Pulse } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  applyCast,
  countActiveScars,
  createInitialArenaState,
  previewCastOutcome,
  SCAR_LABELS,
  SPELLS,
  undoLastCast,
  ZONES,
  type ArenaState,
  type ScarKind,
  type ZoneId,
} from './model';

interface ZoneVisualRig {
  readonly id: ZoneId;
  readonly ringMat: THREE.MeshStandardMaterial;
  readonly reticle: THREE.Mesh;
  readonly craterGroup: THREE.Group;
  readonly frostGroup: THREE.Group;
  readonly spireGroup: THREE.Group;
  readonly quenchGroup: THREE.Group;
  readonly flashGroup: THREE.Group;
  readonly vitrifiedGroup: THREE.Group;
  readonly cryoPrismGroup: THREE.Group;
  pulseBoost: number;
}

const BURST_PARTICLES = 18;
const PARTICLE_COLORS = [0xff6b2c, 0x5cd6ff, 0xc97dff] as const;

export class SpellLeavesScarExhibit extends ExhibitBase {
  private state: ArenaState = createInitialArenaState();
  private zoneRigs = this.tracked<ZoneVisualRig>();
  private refractBeams = this.tracked<THREE.Mesh>();

  private spellDial!: Dial;
  private zoneDial!: Dial;
  private castLever!: Lever;
  private undoLever!: Lever;
  private casterCrystal!: THREE.Mesh;
  private casterCrystalMat!: THREE.MeshStandardMaterial;
  private telegraphFilament!: Filament;
  private telegraphMat!: THREE.MeshStandardMaterial;
  private projectile!: Pulse;
  private projectileMat!: THREE.MeshStandardMaterial;
  private shockwaveRing!: THREE.Mesh;
  private shockwaveMat!: THREE.MeshStandardMaterial;
  private burstMesh!: THREE.InstancedMesh;
  private consoleReadout!: THREE.Mesh;
  private archReadout!: THREE.Mesh;

  private readonly burstPx = new Float32Array(BURST_PARTICLES);
  private readonly burstPy = new Float32Array(BURST_PARTICLES);
  private readonly burstPz = new Float32Array(BURST_PARTICLES);
  private readonly burstVx = new Float32Array(BURST_PARTICLES);
  private readonly burstVy = new Float32Array(BURST_PARTICLES);
  private readonly burstVz = new Float32Array(BURST_PARTICLES);
  private readonly burstMtx = new THREE.Matrix4();
  private readonly burstPos = new THREE.Vector3();
  private readonly burstQuat = new THREE.Quaternion();
  private readonly burstScale = new THREE.Vector3(1, 1, 1);

  private readonly arcStart = new THREE.Vector3(0, 1.32, -2.05);
  private readonly arcMid = new THREE.Vector3(0, 2.35, -3.6);
  private readonly arcEnd = new THREE.Vector3(0, 0.55, -5.15);
  private readonly castCurve = new THREE.QuadraticBezierCurve3(this.arcStart, this.arcMid, this.arcEnd);

  private flightActive = false;
  private shockwaveTimer = 0;
  private burstTimer = 0;
  private beamTimer = 0;
  private readonly activeBeamFlags = [false, false] as [boolean, boolean];

  protected override build(): void {
    const scope = this.ctx.scope;
    const detail = Math.max(0.45, Math.min(1, this.ctx.detailScale));

    // ── Stepped containment arena (anchored z in [-8.0, -1.7], clear of plinth) ──
    const obsidian = this.standard(0x1b1922, { roughness: 0.78, metalness: 0.22 });
    const slate = this.standard(0x282633, { roughness: 0.72, metalness: 0.16 });
    const brass = this.standard(0xc99c46, { roughness: 0.4, metalness: 0.7 });

    const baseDeck = this.mesh(new THREE.CylinderGeometry(2.95, 3.15, 0.24, 8), obsidian);
    baseDeck.position.set(0, 0.12, -4.85);

    const upperDeck = this.mesh(new THREE.CylinderGeometry(2.65, 2.82, 0.14, 8), slate);
    upperDeck.position.set(0, 0.31, -4.85);

    const arenaRim = this.mesh(new THREE.TorusGeometry(2.74, 0.055, 8, 32), brass);
    arenaRim.rotation.x = Math.PI / 2;
    arenaRim.position.set(0, 0.38, -4.85);

    // Containment rune pylons + arch frame (bounded below bay roof)
    const runeCyan = this.emissive(0x3a94c9, 0.9);
    for (const side of [-1, 1] as const) {
      const pylon = this.mesh(new THREE.BoxGeometry(0.42, 3.7, 0.42), obsidian);
      pylon.position.set(side * 3.05, 1.85, -6.0);

      const cap = this.mesh(new THREE.BoxGeometry(0.56, 0.2, 0.56), brass);
      cap.position.set(side * 3.05, 3.75, -6.0);

      const wardStrip = this.mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), runeCyan);
      wardStrip.position.set(side * 2.85, 1.9, -5.8);
    }

    const lintel = this.mesh(new THREE.BoxGeometry(6.7, 0.3, 0.46), obsidian);
    lintel.position.set(0, 3.92, -6.0);

    const archSign = buildLabel(scope, 'CONTAINMENT BAY — CAUSAL SCAR ARENA', 3.4, 0.16);
    archSign.position.set(0, 4.55, -5.77);
    this.group.add(archSign);

    this.archReadout = buildLabel(scope, 'SURFACE: ALL BARE BASALT · 0 SCARS', 3.4, 0.16);
    this.archReadout.position.set(0, 3.92, -5.74);
    this.group.add(this.archReadout);

    // Build 3 interactive ritual zones inside the basin
    for (const zone of ZONES) {
      const rig = this.buildZoneRig(zone.id, zone.x, zone.z, obsidian, brass);
      this.zoneRigs.push(rig);
    }

    // Dual pre-allocated refraction beam bridges (conduit <-> rim, conduit <-> channel)
    const beamMat = this.emissive(0xe0a4ff, 1.8);
    const leftBeam = this.createBridgeBeam(ZONES[1].x, ZONES[1].z, ZONES[0].x, ZONES[0].z, beamMat);
    const rightBeam = this.createBridgeBeam(ZONES[1].x, ZONES[1].z, ZONES[2].x, ZONES[2].z, beamMat);
    this.refractBeams.push(leftBeam, rightBeam);

    // ── Shockwave ring + pooled impact particles (parked at arena center) ───
    this.shockwaveMat = this.emissive(0xff6b2c, 1.8);
    this.shockwaveRing = this.mesh(new THREE.TorusGeometry(0.45, 0.045, 8, 24), this.shockwaveMat);
    this.shockwaveRing.rotation.x = Math.PI / 2;
    this.shockwaveRing.position.set(0, 0.42, -4.85);
    this.shockwaveRing.visible = false;

    const shardGeom = scope.track(new THREE.OctahedronGeometry(0.08, 0));
    const shardMat = this.emissive(0xffaa55, 1.7);
    const count = Math.max(8, Math.round(BURST_PARTICLES * detail));
    this.burstMesh = scope.track(new THREE.InstancedMesh(shardGeom, shardMat, BURST_PARTICLES));
    this.burstMesh.name = 'e30-scar-burst-particles';
    this.burstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.burstMesh.position.set(0, 0.55, -4.55);
    this.burstMesh.visible = false;
    for (let i = 0; i < BURST_PARTICLES; i++) {
      this.burstPos.set(0, 0, i < count ? 0 : -0.2);
      this.burstScale.setScalar(0.01);
      this.burstMtx.compose(this.burstPos, this.burstQuat, this.burstScale);
      this.burstMesh.setMatrixAt(i, this.burstMtx);
    }
    this.burstMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.burstMesh);

    // ── Caster Console at z = -2.05 (safely outside central bay plinth) ─────
    const consoleGroup = buildConsole(scope, 2.45, 0.72, 1.0, slate);
    consoleGroup.position.set(0, 0, -2.05);
    this.group.add(consoleGroup);

    this.casterCrystalMat = this.emissive(SPELLS[0].emissiveHex, 1.6);
    this.casterCrystal = buildNode(scope, 0.16, this.casterCrystalMat);
    this.casterCrystal.position.set(0, 1.32, -2.05);
    this.group.add(this.casterCrystal);

    const crystalPedestal = this.mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.16, 6), brass);
    crystalPedestal.position.set(0, 1.08, -2.05);

    this.telegraphMat = this.emissive(SPELLS[0].emissiveHex, 1.1);
    this.telegraphFilament = new Filament(scope, 16, 0.022, this.telegraphMat);
    this.group.add(this.telegraphFilament.group);

    this.projectileMat = this.emissive(SPELLS[0].emissiveHex, 2.2);
    this.projectile = new Pulse(scope, 0.12, this.projectileMat);
    this.projectile.mesh.position.set(0, 1.32, -2.05);
    this.group.add(this.projectile.mesh);

    // Controls mounted along the console top
    this.spellDial = new Dial(scope, 3, 0.2, { handle: this.emissive(0xff8e42, 1.1) });
    this.spellDial.group.position.set(-0.92, 1.03, -2.02);
    this.group.add(this.spellDial.group);
    const spellLbl = buildLabel(scope, 'ELEMENT', 0.46, 0.28);
    spellLbl.position.set(-0.92, 1.14, -1.72);
    spellLbl.rotation.x = -0.35;
    this.group.add(spellLbl);

    this.zoneDial = new Dial(scope, 3, 0.2, { handle: this.emissive(0x52c7ff, 1.1) });
    this.zoneDial.group.position.set(-0.38, 1.03, -2.02);
    this.group.add(this.zoneDial.group);
    const zoneLbl = buildLabel(scope, 'TARGET', 0.46, 0.28);
    zoneLbl.position.set(-0.38, 1.14, -1.72);
    zoneLbl.rotation.x = -0.35;
    this.group.add(zoneLbl);

    this.castLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xffb84d, 1.3) });
    this.castLever.group.position.set(0.38, 1.03, -2.02);
    this.group.add(this.castLever.group);
    const castLbl = buildLabel(scope, 'CAST', 0.46, 0.28);
    castLbl.position.set(0.38, 1.14, -1.72);
    castLbl.rotation.x = -0.35;
    this.group.add(castLbl);

    this.undoLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xb4a4ff, 1.0) });
    this.undoLever.group.position.set(0.92, 1.03, -2.02);
    this.group.add(this.undoLever.group);
    const undoLbl = buildLabel(scope, 'UNDO', 0.46, 0.28);
    undoLbl.position.set(0.92, 1.14, -1.72);
    undoLbl.rotation.x = -0.35;
    this.group.add(undoLbl);

    // Dynamic readout plate mounted vertically on console back
    this.consoleReadout = buildLabel(scope, 'READY: CINDER LANCE -> CENTRAL CONDUIT', 2.4, 0.22);
    this.consoleReadout.position.set(0, 1.62, -2.35);
    this.group.add(this.consoleReadout);

    // ── Interpretation furniture (Wall Plaque + Lectern) ─────────────────────
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.35, -7.25);
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.6, 0, -4.4);
    lectern.rotation.y = -0.45;
    this.group.add(lectern);

    // ── Register 5 Accessible Interactive Controls ───────────────────────────
    this.control({
      object: this.spellDial.group,
      label: () => {
        const spell = SPELLS.find((s) => s.id === this.state.selectedSpell) ?? SPELLS[0];
        return `Cycle Spell (${spell.name})`;
      },
      description: 'Switch between Cinder Lance (pyro), Rime Surge (cryo), and Prism Lattice (crystal).',
      activate: () => {
        const idx = SPELLS.findIndex((s) => s.id === this.state.selectedSpell);
        const next = SPELLS[(idx + 1) % SPELLS.length];
        this.state = { ...this.state, selectedSpell: next.id };
        this.syncVisualState();
        this.ctx.announce(`Selected spell: ${next.name}. ${previewCastOutcome(this.state).summary}`);
      },
    });

    this.control({
      object: this.zoneDial.group,
      label: () => {
        const zone = ZONES.find((z) => z.id === this.state.selectedZone) ?? ZONES[1];
        return `Target Zone (${zone.name})`;
      },
      description: 'Aim projectile trajectory across West Basalt Rim, Central Conduit, or East Quench Basin.',
      activate: () => {
        const idx = ZONES.findIndex((z) => z.id === this.state.selectedZone);
        const next = ZONES[(idx + 1) % ZONES.length];
        this.state = { ...this.state, selectedZone: next.id };
        this.syncVisualState();
        this.ctx.announce(`Targeted ${next.name} (${SCAR_LABELS[this.state.zones[next.id].scar]}).`);
      },
    });

    this.control({
      object: this.castLever.group,
      label: () => {
        const spell = SPELLS.find((s) => s.id === this.state.selectedSpell) ?? SPELLS[0];
        return `Cast ${spell.shortLabel}`;
      },
      description: 'Launch contained spell into the selected zone; leaves a persistent scar that alters later spells.',
      activate: () => {
        this.performCast();
      },
    });

    this.control({
      object: this.undoLever.group,
      label: () => `Undo Last Cast (${this.state.history.length} saved)`,
      description: 'Atomically revert the most recent spell cast and its resulting terrain scar.',
      activate: () => {
        if (this.state.history.length === 0) {
          this.ctx.announce('No cast history to undo; arena is bare.');
          return;
        }
        this.state = undoLastCast(this.state);
        this.flightActive = false;
        this.projectile.stop();
        this.projectile.mesh.position.set(0, 1.32, -2.05);
        this.syncVisualState();
        this.ctx.announce(`Undid last cast. ${countActiveScars(this.state)} scar(s) remain.`);
      },
    });

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12), brass);
    resetPuck.position.set(1.1, 1.04, -2.02);
    this.control({
      object: resetPuck,
      label: 'Reset Arena',
      description: 'Clear all terrain scars and restore baseline basalt chamber.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Arena reset to pristine bare basalt (0 scars).');
      },
    });

    this.syncVisualState();
  }

  private buildZoneRig(
    id: ZoneId,
    x: number,
    z: number,
    obsidian: THREE.Material,
    brass: THREE.Material,
  ): ZoneVisualRig {
    const pad = this.mesh(new THREE.CylinderGeometry(0.86, 0.96, 0.14, 16), obsidian);
    pad.position.set(x, 0.45, z);

    const ringMat = this.standard(0x4c485c, { roughness: 0.45, metalness: 0.5 });
    const collar = this.mesh(new THREE.TorusGeometry(0.88, 0.04, 8, 24), ringMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x, 0.52, z);

    const reticle = this.mesh(
      new THREE.TorusGeometry(0.98, 0.032, 8, 24),
      this.emissive(0xf2c86b, 1.5),
    );
    reticle.rotation.x = Math.PI / 2;
    reticle.position.set(x, 0.56, z);

    const craterGroup = this.makeScarGroup(x, z);
    const magmaMat = this.emissive(0xff521b, 1.9);
    const craterRim = this.meshInto(craterGroup, new THREE.TorusGeometry(0.56, 0.1, 8, 16), brass);
    craterRim.rotation.x = Math.PI / 2;
    craterRim.position.y = 0.04;
    const craterCore = this.meshInto(craterGroup, new THREE.CylinderGeometry(0.5, 0.54, 0.05, 16), magmaMat);
    craterCore.position.y = 0.025;

    const frostGroup = this.makeScarGroup(x, z);
    const iceMat = this.standard(0x8ae2ff, { emissive: 0x1a8cff, emissiveIntensity: 0.75, roughness: 0.25 });
    const iceSlab = this.meshInto(frostGroup, new THREE.CylinderGeometry(0.68, 0.72, 0.06, 6), iceMat);
    iceSlab.position.y = 0.03;
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.35;
      const spike = this.meshInto(frostGroup, new THREE.ConeGeometry(0.11, 0.42, 5), iceMat);
      spike.position.set(Math.cos(ang) * 0.4, 0.22, Math.sin(ang) * 0.4);
      spike.rotation.z = Math.cos(ang) * 0.22;
    }

    const spireGroup = this.makeScarGroup(x, z);
    const crystalMat = this.emissive(0xb96bff, 1.5);
    const spireMain = this.meshInto(spireGroup, new THREE.OctahedronGeometry(0.32, 0), crystalMat);
    spireMain.scale.set(0.65, 2.2, 0.65);
    spireMain.position.y = 0.46;
    const spireSide = this.meshInto(spireGroup, new THREE.OctahedronGeometry(0.2, 0), crystalMat);
    spireSide.scale.set(0.55, 1.5, 0.55);
    spireSide.position.set(0.28, 0.28, -0.18);
    spireSide.rotation.z = -0.35;

    const quenchGroup = this.makeScarGroup(x, z);
    const quenchMat = this.emissive(0x3be0d0, 1.4);
    const ventBase = this.meshInto(quenchGroup, new THREE.TorusGeometry(0.54, 0.09, 6, 12), obsidian);
    ventBase.rotation.x = Math.PI / 2;
    ventBase.position.y = 0.05;
    const ventCore = this.meshInto(quenchGroup, new THREE.CylinderGeometry(0.18, 0.34, 0.72, 8), quenchMat);
    ventCore.position.y = 0.36;

    const flashGroup = this.makeScarGroup(x, z);
    const mistMat = this.emissive(0xffc96b, 1.5);
    const geyserRing = this.meshInto(flashGroup, new THREE.TorusGeometry(0.6, 0.08, 8, 16), iceMat);
    geyserRing.rotation.x = Math.PI / 2;
    geyserRing.position.y = 0.05;
    const geyserPlume = this.meshInto(flashGroup, new THREE.CylinderGeometry(0.42, 0.18, 0.8, 10), mistMat);
    geyserPlume.position.y = 0.4;

    const vitrifiedGroup = this.makeScarGroup(x, z);
    const amberMat = this.emissive(0xffaa2b, 1.45);
    const monolith = this.meshInto(vitrifiedGroup, new THREE.BoxGeometry(0.36, 1.1, 0.36), obsidian);
    monolith.position.y = 0.55;
    const vein = this.meshInto(vitrifiedGroup, new THREE.BoxGeometry(0.4, 0.72, 0.14), amberMat);
    vein.position.y = 0.58;

    const cryoPrismGroup = this.makeScarGroup(x, z);
    const cryoCore = this.meshInto(cryoPrismGroup, new THREE.OctahedronGeometry(0.34, 0), crystalMat);
    cryoCore.scale.set(0.7, 2.3, 0.7);
    cryoCore.position.y = 0.48;
    const cryoCollar = this.meshInto(cryoPrismGroup, new THREE.TorusGeometry(0.46, 0.08, 6, 12), iceMat);
    cryoCollar.rotation.x = Math.PI / 2;
    cryoCollar.position.y = 0.25;

    return {
      id,
      ringMat,
      reticle,
      craterGroup,
      frostGroup,
      spireGroup,
      quenchGroup,
      flashGroup,
      vitrifiedGroup,
      cryoPrismGroup,
      pulseBoost: 0,
    };
  }

  private makeScarGroup(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0.52, z);
    g.visible = false;
    this.group.add(g);
    return g;
  }

  private meshInto(parent: THREE.Group, geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.ctx.scope.track(geom), mat);
    parent.add(m);
    return m;
  }

  private createBridgeBeam(x1: number, z1: number, x2: number, z2: number, mat: THREE.Material): THREE.Mesh {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const beam = new THREE.Mesh(this.ctx.scope.track(new THREE.CylinderGeometry(0.05, 0.05, length, 8)), mat);
    beam.position.set((x1 + x2) / 2, 0.92, (z1 + z2) / 2);
    beam.rotation.z = Math.PI / 2;
    beam.rotation.y = -Math.atan2(dz, dx);
    beam.visible = false;
    this.group.add(beam);
    return beam;
  }

  private performCast(): void {
    const previous = this.state;
    const next = applyCast(previous);
    this.state = next;
    this.castLever.advance();

    const spell = SPELLS.find((s) => s.id === next.selectedSpell) ?? SPELLS[0];
    const targetZone = ZONES.find((z) => z.id === next.selectedZone) ?? ZONES[1];

    this.arcEnd.set(targetZone.x, 0.62, targetZone.z);
    this.arcMid.set(targetZone.x * 0.5, 2.35, -3.35);
    this.projectileMat.color.setHex(spell.colorHex);
    this.projectileMat.emissive.setHex(spell.emissiveHex);

    if (this.reducedMotion) {
      this.flightActive = false;
      this.projectile.stop();
      this.projectile.mesh.position.set(0, 1.32, -2.05);
      this.triggerImpact(targetZone.x, targetZone.z, spell.emissiveHex, next.lastOutcome?.refractedTargets ?? []);
      this.syncVisualState();
    } else {
      this.flightActive = true;
      this.projectile.start();
    }

    if (next.lastOutcome) {
      this.ctx.announce(next.lastOutcome.summary);
    }
  }

  private triggerImpact(x: number, z: number, emissiveHex: number, refracted: readonly ZoneId[]): void {
    this.shockwaveMat.color.setHex(emissiveHex);
    this.shockwaveMat.emissive.setHex(emissiveHex);
    this.shockwaveRing.position.set(x, 0.56, z);
    this.shockwaveRing.scale.setScalar(0.35);
    this.shockwaveTimer = this.reducedMotion ? 0 : 0.55;
    this.shockwaveRing.visible = !this.reducedMotion;

    const spellIdx = SPELLS.findIndex((s) => s.id === this.state.selectedSpell);
    (this.burstMesh.material as THREE.MeshStandardMaterial).color.setHex(PARTICLE_COLORS[Math.max(0, spellIdx)]);
    (this.burstMesh.material as THREE.MeshStandardMaterial).emissive.setHex(emissiveHex);
    this.burstMesh.position.set(x, 0.65, z);
    this.burstTimer = this.reducedMotion ? 0 : 0.65;
    this.burstMesh.visible = !this.reducedMotion;

    for (let i = 0; i < BURST_PARTICLES; i++) {
      const ang = (i / BURST_PARTICLES) * Math.PI * 2;
      const spd = 0.8 + ((i * 37) % 10) * 0.08;
      this.burstPx[i] = 0;
      this.burstPy[i] = 0.05;
      this.burstPz[i] = 0;
      this.burstVx[i] = Math.cos(ang) * spd;
      this.burstVy[i] = 1.4 + (i % 3) * 0.45;
      this.burstVz[i] = Math.sin(ang) * spd;
    }

    this.activeBeamFlags[0] = refracted.includes('rim') || (this.state.selectedZone === 'rim' && refracted.includes('conduit'));
    this.activeBeamFlags[1] = refracted.includes('channel') || (this.state.selectedZone === 'channel' && refracted.includes('conduit'));
    if (this.activeBeamFlags[0] || this.activeBeamFlags[1]) {
      this.beamTimer = this.reducedMotion ? 0 : 1.1;
    }
    const rig = this.zoneRigs.find((r) => r.id === this.state.selectedZone);
    if (rig) rig.pulseBoost = 1;
  }

  private syncVisualState(): void {
    const scope = this.ctx.scope;
    const spellIndex = Math.max(0, SPELLS.findIndex((s) => s.id === this.state.selectedSpell));
    const zoneIndex = Math.max(0, ZONES.findIndex((z) => z.id === this.state.selectedZone));
    const spell = SPELLS[spellIndex];
    const zone = ZONES[zoneIndex];

    this.spellDial.value = spellIndex;
    this.zoneDial.value = zoneIndex;
    this.casterCrystalMat.color.setHex(spell.colorHex);
    this.casterCrystalMat.emissive.setHex(spell.emissiveHex);
    this.telegraphMat.color.setHex(spell.colorHex);
    this.telegraphMat.emissive.setHex(spell.emissiveHex);

    this.arcEnd.set(zone.x, 0.58, zone.z);
    this.arcMid.set(zone.x * 0.5, 2.2, -3.45);
    this.telegraphFilament.follow(this.castCurve);

    for (const rig of this.zoneRigs) {
      const zState = this.state.zones[rig.id];
      rig.reticle.visible = rig.id === this.state.selectedZone;
      const scale = 0.82 + zState.intensity * 0.14;
      this.applyScarVisibility(rig, zState.scar, scale);
    }

    if (this.refractBeams.length >= 2) {
      const showAll = this.beamTimer > 0 || this.state.refractionCount > 0;
      this.refractBeams[0].visible = showAll && (this.activeBeamFlags[0] || this.state.zones.rim.scar !== 'none' && this.state.zones.conduit.scar === 'spire');
      this.refractBeams[1].visible = showAll && (this.activeBeamFlags[1] || this.state.zones.channel.scar !== 'none' && this.state.zones.conduit.scar === 'spire');
    }

    const preview = previewCastOutcome(this.state);
    updateLabel(scope, this.consoleReadout, preview.summary.toUpperCase());
    const scarCount = countActiveScars(this.state);
    updateLabel(
      scope,
      this.archReadout,
      `CASTS: ${this.state.castCount} · ACTIVE SCARS: ${scarCount}/3 · REACTIONS: ${this.state.reactionCount}`,
    );
  }

  private applyScarVisibility(rig: ZoneVisualRig, scar: ScarKind, scale: number): void {
    rig.craterGroup.visible = scar === 'crater';
    rig.frostGroup.visible = scar === 'frost';
    rig.spireGroup.visible = scar === 'spire';
    rig.quenchGroup.visible = scar === 'quench';
    rig.flashGroup.visible = scar === 'flashover';
    rig.vitrifiedGroup.visible = scar === 'vitrified';
    rig.cryoPrismGroup.visible = scar === 'cryoprism';

    rig.craterGroup.scale.setScalar(scale);
    rig.frostGroup.scale.setScalar(scale);
    rig.spireGroup.scale.setScalar(scale);
    rig.quenchGroup.scale.setScalar(scale);
    rig.flashGroup.scale.setScalar(scale);
    rig.vitrifiedGroup.scale.setScalar(scale);
    rig.cryoPrismGroup.scale.setScalar(scale);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.spellDial.update(dt, instant);
    this.zoneDial.update(dt, instant);
    this.castLever.update(dt, instant);
    this.undoLever.update(dt, instant);

    if (!instant) {
      this.casterCrystal.rotation.y += dt * 0.9;
      this.casterCrystal.position.y = 1.32 + Math.sin(this.elapsed * 2.2) * 0.03;
    }

    if (this.flightActive) {
      const done = this.projectile.update(dt, this.castCurve, 1.85);
      if (done) {
        this.flightActive = false;
        this.projectile.mesh.position.set(0, 1.32, -2.05);
        const spell = SPELLS.find((s) => s.id === this.state.selectedSpell) ?? SPELLS[0];
        const zone = ZONES.find((z) => z.id === this.state.selectedZone) ?? ZONES[1];
        this.triggerImpact(zone.x, zone.z, spell.emissiveHex, this.state.lastOutcome?.refractedTargets ?? []);
        this.syncVisualState();
      }
    }

    if (this.shockwaveTimer > 0) {
      this.shockwaveTimer = Math.max(0, this.shockwaveTimer - dt);
      const t = 1 - this.shockwaveTimer / 0.55;
      this.shockwaveRing.scale.setScalar(0.35 + t * 1.45);
      this.shockwaveMat.emissiveIntensity = (1 - t) * 2.2;
      if (this.shockwaveTimer === 0) this.shockwaveRing.visible = false;
    }

    if (this.burstTimer > 0) {
      this.burstTimer = Math.max(0, this.burstTimer - dt);
      const fade = Math.max(0.01, this.burstTimer / 0.65);
      for (let i = 0; i < BURST_PARTICLES; i++) {
        this.burstVy[i] -= 4.2 * dt;
        this.burstPx[i] += this.burstVx[i] * dt;
        this.burstPy[i] = Math.max(0, this.burstPy[i] + this.burstVy[i] * dt);
        this.burstPz[i] += this.burstVz[i] * dt;
        this.burstPos.set(this.burstPx[i], this.burstPy[i], this.burstPz[i]);
        this.burstScale.setScalar(fade);
        this.burstMtx.compose(this.burstPos, this.burstQuat, this.burstScale);
        this.burstMesh.setMatrixAt(i, this.burstMtx);
      }
      this.burstMesh.instanceMatrix.needsUpdate = true;
      if (this.burstTimer === 0) this.burstMesh.visible = false;
    }

    if (this.beamTimer > 0) {
      this.beamTimer = Math.max(0, this.beamTimer - dt);
      if (this.beamTimer === 0) {
        this.syncVisualState();
      }
    }

    for (const rig of this.zoneRigs) {
      if (rig.pulseBoost > 0) {
        rig.pulseBoost = Math.max(0, rig.pulseBoost - dt * 2.4);
      }
      rig.ringMat.emissiveIntensity = 0.25 + rig.pulseBoost * 1.4;
      if (!instant && rig.spireGroup.visible) {
        rig.spireGroup.rotation.y += dt * 0.4;
      }
    }
  }

  protected override onReset(): void {
    this.state = createInitialArenaState();
    this.flightActive = false;
    this.shockwaveTimer = 0;
    this.burstTimer = 0;
    this.beamTimer = 0;
    this.activeBeamFlags[0] = false;
    this.activeBeamFlags[1] = false;
    if (this.built) {
      this.projectile.stop();
      this.projectile.mesh.position.set(0, 1.32, -2.05);
      this.shockwaveRing.visible = false;
      this.burstMesh.visible = false;
      this.syncVisualState();
    }
  }

  protected override describeState(): string {
    const spell = SPELLS.find((s) => s.id === this.state.selectedSpell) ?? SPELLS[0];
    const zone = ZONES.find((z) => z.id === this.state.selectedZone) ?? ZONES[1];
    const outcome = this.state.lastOutcome ? ` Last outcome: ${this.state.lastOutcome.summary}` : '';
    return (
      `Armed ${spell.name} on ${zone.name}. Casts=${this.state.castCount}, ` +
      `ActiveScars=${countActiveScars(this.state)}/3, Reactions=${this.state.reactionCount}, ` +
      `Refractions=${this.state.refractionCount}.${outcome}`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new SpellLeavesScarExhibit(def);
}
