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
  readonly padY: number;
  readonly ringMat: THREE.MeshStandardMaterial;
  readonly reticle: THREE.Mesh;
  readonly warnRing: THREE.Mesh;
  readonly statusPlate: THREE.Mesh;
  readonly craterGroup: THREE.Group;
  readonly frostGroup: THREE.Group;
  readonly spireGroup: THREE.Group;
  readonly quenchGroup: THREE.Group;
  readonly flashGroup: THREE.Group;
  readonly vitrifiedGroup: THREE.Group;
  readonly cryoPrismGroup: THREE.Group;
  pulseBoost: number;
  lastScar: ScarKind | null;
}

interface SharedScarGeometries {
  readonly craterPlate: THREE.BufferGeometry;
  readonly craterRim: THREE.BufferGeometry;
  readonly craterCore: THREE.BufferGeometry;
  readonly frostSlab: THREE.BufferGeometry;
  readonly frostSpike: THREE.BufferGeometry;
  readonly spireMain: THREE.BufferGeometry;
  readonly spireSide: THREE.BufferGeometry;
  readonly trenchPlate: THREE.BufferGeometry;
  readonly trenchGlow: THREE.BufferGeometry;
  readonly geyserRing: THREE.BufferGeometry;
  readonly geyserPlume: THREE.BufferGeometry;
  readonly monolith: THREE.BufferGeometry;
  readonly vein: THREE.BufferGeometry;
  readonly cryoCollar: THREE.BufferGeometry;
}

const BURST_PARTICLES = 12;
const PARTICLE_COLORS = [0xff6b2c, 0x5cd6ff, 0xc97dff] as const;
const PAD_HEIGHTS: Readonly<Record<ZoneId, number>> = {
  rim: 0.9,
  conduit: 1.06,
  channel: 0.9,
};

export class SpellLeavesScarExhibit extends ExhibitBase {
  private state: ArenaState = createInitialArenaState();
  private zoneRigs = this.tracked<ZoneVisualRig>();
  private refractBeams = this.tracked<THREE.Mesh>();
  private refractTelegraphs = this.tracked<Filament>();

  private spellDial!: Dial;
  private zoneDial!: Dial;
  private castLever!: Lever;
  private undoLever!: Lever;
  private casterCrystal!: THREE.Mesh;
  private casterCrystalMat!: THREE.MeshStandardMaterial;
  private telegraphFilament!: Filament;
  private telegraphMat!: THREE.MeshStandardMaterial;
  private refractTelegraphMat!: THREE.MeshStandardMaterial;
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

  private readonly arcStart = new THREE.Vector3(0, 1.04, -1.86);
  private readonly arcMid = new THREE.Vector3(0, 2.25, -3.35);
  private readonly arcEnd = new THREE.Vector3(0, 1.14, -5.15);
  private readonly castCurve = new THREE.QuadraticBezierCurve3(this.arcStart, this.arcMid, this.arcEnd);

  private readonly refrStart = new THREE.Vector3();
  private readonly refrMid = new THREE.Vector3();
  private readonly refrEnd = new THREE.Vector3();
  private readonly refrCurve = new THREE.QuadraticBezierCurve3(this.refrStart, this.refrMid, this.refrEnd);

  private flightActive = false;
  private shockwaveTimer = 0;
  private burstTimer = 0;
  private beamTimer = 0;
  private readonly activeBeamFlags = [false, false] as [boolean, boolean];

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  protected override build(): void {
    const scope = this.ctx.scope;
    const detail = Math.max(0.45, Math.min(1, this.ctx.detailScale));

    // Shared containment palette
    const obsidian = this.standard(0x1b1922, { roughness: 0.78, metalness: 0.22 });
    const basalt = this.standard(0x282734, { roughness: 0.72, metalness: 0.16 });
    const slate = this.standard(0x323342, { roughness: 0.65, metalness: 0.2 });
    const brass = this.standard(0xc99c46, { roughness: 0.4, metalness: 0.7 });

    // Elevated stepped terrain dais (rises above front console sightlines, clear of PLINTH_BOX)
    const baseDeck = this.mesh(new THREE.CylinderGeometry(2.95, 3.15, 0.56, 8), obsidian);
    baseDeck.position.set(0, 0.28, -4.85);

    const upperDeck = this.mesh(new THREE.CylinderGeometry(2.68, 2.86, 0.28, 8), basalt);
    upperDeck.position.set(0, 0.68, -4.85);

    const arenaRim = this.mesh(new THREE.TorusGeometry(2.74, 0.045, 5, 16), brass);
    arenaRim.rotation.x = Math.PI / 2;
    arenaRim.position.set(0, 0.83, -4.85);

    // Terrain step ramps linking West Rim <-> Central Conduit <-> East Basin (AetherVFX surface geometry)
    const rampGeo = scope.track(new THREE.BoxGeometry(1.75, 0.18, 0.56));
    const leftRamp = this.mesh(rampGeo, slate);
    leftRamp.position.set(-0.92, 0.91, -4.8);
    leftRamp.rotation.y = 0.36;
    leftRamp.rotation.z = 0.08;

    const rightRamp = this.mesh(rampGeo, slate);
    rightRamp.position.set(0.92, 0.91, -4.8);
    rightRamp.rotation.y = -0.36;
    rightRamp.rotation.z = -0.08;

    // Containment rune pylons + top arch lintel
    const runeCyan = this.emissive(0x3a94c9, 0.9);
    const pylonGeo = scope.track(new THREE.BoxGeometry(0.38, 3.9, 0.38));
    const capGeo = scope.track(new THREE.BoxGeometry(0.52, 0.18, 0.52));
    const stripGeo = scope.track(new THREE.BoxGeometry(0.07, 3.0, 0.07));
    for (const side of [-1, 1] as const) {
      const pylon = this.mesh(pylonGeo, obsidian);
      pylon.position.set(side * 3.1, 1.95, -6.0);

      const cap = this.mesh(capGeo, brass);
      cap.position.set(side * 3.1, 3.96, -6.0);

      const wardStrip = this.mesh(stripGeo, runeCyan);
      wardStrip.position.set(side * 2.9, 2.0, -5.82);
    }

    const lintel = this.mesh(new THREE.BoxGeometry(6.8, 0.28, 0.44), obsidian);
    lintel.position.set(0, 4.12, -6.0);

    const archSign = buildLabel(scope, 'AETHERVFX — CAUSAL TERRAIN & SURFACE SCAR ARENA', 3.9, 0.17);
    archSign.position.set(0, 4.74, -5.77);
    this.group.add(archSign);

    this.archReadout = buildLabel(scope, 'CASTS: 0 · ACTIVE SCARS: 0/3 · REACTIONS: 0 · REFRACTIONS: 0', 4.1, 0.16);
    this.archReadout.position.set(0, 4.16, -5.74);
    this.group.add(this.archReadout);

    this.consoleReadout = buildLabel(scope, 'TELEGRAPH: CINDER LANCE -> CENTRAL CONDUIT', 3.8, 0.17);
    this.consoleReadout.position.set(0, 3.5, -5.74);
    this.group.add(this.consoleReadout);

    // Pre-allocate shared scar geometries & materials once across all 3 zones
    const sharedGeos: SharedScarGeometries = {
      craterPlate: scope.track(new THREE.CylinderGeometry(0.76, 0.84, 0.1, 8)),
      craterRim: scope.track(new THREE.TorusGeometry(0.58, 0.11, 5, 10)),
      craterCore: scope.track(new THREE.CylinderGeometry(0.46, 0.5, 0.08, 8)),
      frostSlab: scope.track(new THREE.CylinderGeometry(0.68, 0.76, 0.12, 6)),
      frostSpike: scope.track(new THREE.ConeGeometry(0.11, 0.54, 4)),
      spireMain: scope.track(new THREE.OctahedronGeometry(0.32, 0)),
      spireSide: scope.track(new THREE.OctahedronGeometry(0.19, 0)),
      trenchPlate: scope.track(new THREE.BoxGeometry(0.42, 0.16, 1.12)),
      trenchGlow: scope.track(new THREE.BoxGeometry(0.24, 0.12, 1.04)),
      geyserRing: scope.track(new THREE.TorusGeometry(0.6, 0.08, 5, 10)),
      geyserPlume: scope.track(new THREE.CylinderGeometry(0.4, 0.16, 0.82, 8)),
      monolith: scope.track(new THREE.BoxGeometry(0.38, 1.15, 0.38)),
      vein: scope.track(new THREE.BoxGeometry(0.42, 0.84, 0.14)),
      cryoCollar: scope.track(new THREE.TorusGeometry(0.46, 0.08, 5, 8)),
    };

    const scarMats = {
      obsidian,
      brass,
      magma: this.emissive(0xff521b, 1.9),
      ice: this.standard(0x8ae2ff, { emissive: 0x1a8cff, emissiveIntensity: 0.78, roughness: 0.25 }),
      crystal: this.emissive(0xb96bff, 1.55),
      quench: this.emissive(0x2ef0dc, 1.65),
      mist: this.emissive(0xffc96b, 1.5),
      amber: this.emissive(0xffaa2b, 1.5),
    };

    const padBaseGeo = scope.track(new THREE.CylinderGeometry(0.84, 0.94, 0.22, 8));
    const collarGeo = scope.track(new THREE.TorusGeometry(0.86, 0.04, 5, 12));
    const reticleGeo = scope.track(new THREE.TorusGeometry(0.96, 0.032, 5, 12));
    const warnGeo = scope.track(new THREE.TorusGeometry(1.04, 0.026, 5, 12));
    const warnMat = this.emissive(0xd87dff, 1.45);
    const reticleMat = this.emissive(0xf2c86b, 1.55);

    for (const zone of ZONES) {
      const rig = this.buildZoneRig(
        zone.id,
        zone.name,
        zone.x,
        zone.z,
        PAD_HEIGHTS[zone.id],
        padBaseGeo,
        collarGeo,
        reticleGeo,
        warnGeo,
        reticleMat,
        warnMat,
        sharedGeos,
        scarMats,
      );
      this.zoneRigs.push(rig);
    }

    // Elevated pad-to-pad refraction beams + preview bifurcated telegraph filaments
    const beamMat = this.emissive(0xe0a4ff, 1.9);
    const leftBeam = this.createBridgeBeam(
      ZONES[1].x,
      PAD_HEIGHTS.conduit + 0.48,
      ZONES[1].z,
      ZONES[0].x,
      PAD_HEIGHTS.rim + 0.36,
      ZONES[0].z,
      beamMat,
    );
    const rightBeam = this.createBridgeBeam(
      ZONES[1].x,
      PAD_HEIGHTS.conduit + 0.48,
      ZONES[1].z,
      ZONES[2].x,
      PAD_HEIGHTS.channel + 0.36,
      ZONES[2].z,
      beamMat,
    );
    this.refractBeams.push(leftBeam, rightBeam);

    this.refractTelegraphMat = this.emissive(0xd87dff, 1.45);
    const telSegs = this.scaled(8);
    const leftTel = new Filament(scope, telSegs, 0.02, this.refractTelegraphMat);
    this.refrStart.set(ZONES[1].x, PAD_HEIGHTS.conduit + 0.56, ZONES[1].z);
    this.refrEnd.set(ZONES[0].x, PAD_HEIGHTS.rim + 0.24, ZONES[0].z);
    this.refrMid.set((ZONES[1].x + ZONES[0].x) * 0.5, 2.02, (ZONES[1].z + ZONES[0].z) * 0.5);
    leftTel.follow(this.refrCurve);
    leftTel.group.visible = false;

    const rightTel = new Filament(scope, telSegs, 0.02, this.refractTelegraphMat);
    this.refrStart.set(ZONES[1].x, PAD_HEIGHTS.conduit + 0.56, ZONES[1].z);
    this.refrEnd.set(ZONES[2].x, PAD_HEIGHTS.channel + 0.24, ZONES[2].z);
    this.refrMid.set((ZONES[1].x + ZONES[2].x) * 0.5, 2.02, (ZONES[1].z + ZONES[2].z) * 0.5);
    rightTel.follow(this.refrCurve);
    rightTel.group.visible = false;

    this.group.add(leftTel.group, rightTel.group);
    this.refractTelegraphs.push(leftTel, rightTel);

    // Shockwave ring + bounded pooled impact burst
    this.shockwaveMat = this.emissive(0xff6b2c, 1.8);
    this.shockwaveRing = this.mesh(scope.track(new THREE.TorusGeometry(0.45, 0.045, 6, 18)), this.shockwaveMat);
    this.shockwaveRing.rotation.x = Math.PI / 2;
    this.shockwaveRing.position.set(0, 1.12, -5.15);
    this.shockwaveRing.visible = false;

    const shardGeom = scope.track(new THREE.OctahedronGeometry(0.085, 0));
    const shardMat = this.emissive(0xffaa55, 1.7);
    const count = Math.max(6, Math.round(BURST_PARTICLES * detail));
    this.burstMesh = scope.track(new THREE.InstancedMesh(shardGeom, shardMat, BURST_PARTICLES));
    this.burstMesh.name = 'e30-scar-burst-particles';
    this.burstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.burstMesh.position.set(0, 1.15, -5.15);
    this.burstMesh.visible = false;
    for (let i = 0; i < BURST_PARTICLES; i++) {
      this.burstPos.set(0, 0, i < count ? 0 : -0.2);
      this.burstScale.setScalar(0.01);
      this.burstMtx.compose(this.burstPos, this.burstQuat, this.burstScale);
      this.burstMesh.setMatrixAt(i, this.burstMtx);
    }
    this.burstMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.burstMesh);

    // Lowered streamlined caster rail at z = -1.85 so all 3 pads remain unobstructed
    const consoleGroup = buildConsole(scope, 2.55, 0.56, 0.68, slate);
    consoleGroup.position.set(0, 0, -1.85);
    this.group.add(consoleGroup);

    this.casterCrystalMat = this.emissive(SPELLS[0].emissiveHex, 1.6);
    this.casterCrystal = buildNode(scope, 0.13, this.casterCrystalMat);
    this.casterCrystal.position.set(0, 1.04, -1.85);
    this.group.add(this.casterCrystal);

    const crystalPedestal = this.mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.14, 6), brass);
    crystalPedestal.position.set(0, 0.78, -1.85);

    this.telegraphMat = this.emissive(SPELLS[0].emissiveHex, 1.25);
    this.telegraphFilament = new Filament(scope, this.scaled(10), 0.022, this.telegraphMat);
    this.group.add(this.telegraphFilament.group);

    this.projectileMat = this.emissive(SPELLS[0].emissiveHex, 2.2);
    this.projectile = new Pulse(scope, 0.12, this.projectileMat);
    this.projectile.mesh.position.set(0, 1.04, -1.85);
    this.group.add(this.projectile.mesh);

    this.spellDial = new Dial(scope, 3, 0.18, { handle: this.emissive(0xff8e42, 1.1) });
    this.spellDial.group.position.set(-0.98, 0.71, -1.84);
    this.group.add(this.spellDial.group);
    const spellLbl = buildLabel(scope, 'ELEMENT', 0.44, 0.24);
    spellLbl.position.set(-0.98, 0.76, -1.55);
    spellLbl.rotation.x = -0.5;
    this.group.add(spellLbl);

    this.zoneDial = new Dial(scope, 3, 0.18, { handle: this.emissive(0x52c7ff, 1.1) });
    this.zoneDial.group.position.set(-0.46, 0.71, -1.84);
    this.group.add(this.zoneDial.group);
    const zoneLbl = buildLabel(scope, 'TARGET', 0.44, 0.24);
    zoneLbl.position.set(-0.46, 0.76, -1.55);
    zoneLbl.rotation.x = -0.5;
    this.group.add(zoneLbl);

    this.castLever = new Lever(scope, 2, 0.34, { arm: this.emissive(0xffb84d, 1.3) });
    this.castLever.group.position.set(0.42, 0.71, -1.84);
    this.group.add(this.castLever.group);
    const castLbl = buildLabel(scope, 'CAST', 0.4, 0.24);
    castLbl.position.set(0.42, 0.76, -1.55);
    castLbl.rotation.x = -0.5;
    this.group.add(castLbl);

    this.undoLever = new Lever(scope, 2, 0.34, { arm: this.emissive(0xb4a4ff, 1.0) });
    this.undoLever.group.position.set(0.86, 0.71, -1.84);
    this.group.add(this.undoLever.group);
    const undoLbl = buildLabel(scope, 'UNDO', 0.4, 0.24);
    undoLbl.position.set(0.86, 0.76, -1.55);
    undoLbl.rotation.x = -0.5;
    this.group.add(undoLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 10), brass);
    resetPuck.position.set(1.16, 0.72, -1.84);
    const resetLbl = buildLabel(scope, 'RESET', 0.36, 0.24);
    resetLbl.position.set(1.16, 0.76, -1.55);
    resetLbl.rotation.x = -0.5;
    this.group.add(resetLbl);

    // Symmetrical outer wing placement for Plaque + Lectern so the terrain basin center is unobstructed
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
        this.ctx.announce(`Targeted ${next.name} (${SCAR_LABELS[this.state.zones[next.id].scar]}). ${previewCastOutcome(this.state).summary}`);
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
        this.activeBeamFlags[0] = false;
        this.activeBeamFlags[1] = false;
        this.beamTimer = 0;
        this.projectile.stop();
        this.projectile.mesh.position.set(0, 1.04, -1.85);
        this.syncVisualState();
        this.ctx.announce(`Undid last cast. ${countActiveScars(this.state)} scar(s) remain.`);
      },
    });

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
    name: string,
    x: number,
    z: number,
    padY: number,
    padBaseGeo: THREE.BufferGeometry,
    collarGeo: THREE.BufferGeometry,
    reticleGeo: THREE.BufferGeometry,
    warnGeo: THREE.BufferGeometry,
    reticleMat: THREE.Material,
    warnMat: THREE.Material,
    geos: SharedScarGeometries,
    mats: {
      obsidian: THREE.Material;
      brass: THREE.Material;
      magma: THREE.Material;
      ice: THREE.Material;
      crystal: THREE.Material;
      quench: THREE.Material;
      mist: THREE.Material;
      amber: THREE.Material;
    },
  ): ZoneVisualRig {
    const pad = this.mesh(padBaseGeo, mats.obsidian);
    pad.position.set(x, padY - 0.11, z);

    const ringMat = this.standard(0x525066, { roughness: 0.45, metalness: 0.5 });
    const collar = this.mesh(collarGeo, ringMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x, padY, z);

    const reticle = this.mesh(reticleGeo, reticleMat);
    reticle.rotation.x = Math.PI / 2;
    reticle.position.set(x, padY + 0.04, z);

    const warnRing = this.mesh(warnGeo, warnMat);
    warnRing.rotation.x = Math.PI / 2;
    warnRing.position.set(x, padY + 0.06, z);
    warnRing.visible = false;

    const statusPlate = buildLabel(this.ctx.scope, `${name.toUpperCase()}\nBARE BASALT`, 1.48, 0.17);
    statusPlate.position.set(x, padY + 1.66, z);
    this.group.add(statusPlate);

    const craterGroup = this.makeScarGroup(x, padY, z);
    this.meshInto(craterGroup, geos.craterPlate, mats.obsidian).position.y = 0.05;
    const craterRim = this.meshInto(craterGroup, geos.craterRim, mats.brass);
    craterRim.rotation.x = Math.PI / 2;
    craterRim.position.y = 0.1;
    this.meshInto(craterGroup, geos.craterCore, mats.magma).position.y = 0.09;

    const frostGroup = this.makeScarGroup(x, padY, z);
    this.meshInto(frostGroup, geos.frostSlab, mats.ice).position.y = 0.06;
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + 0.3;
      const spike = this.meshInto(frostGroup, geos.frostSpike, mats.ice);
      spike.position.set(Math.cos(ang) * 0.38, 0.29, Math.sin(ang) * 0.38);
      spike.rotation.z = Math.cos(ang) * 0.24;
    }

    const spireGroup = this.makeScarGroup(x, padY, z);
    const spireMain = this.meshInto(spireGroup, geos.spireMain, mats.crystal);
    spireMain.scale.set(0.68, 2.25, 0.68);
    spireMain.position.y = 0.48;
    const spireSide = this.meshInto(spireGroup, geos.spireSide, mats.crystal);
    spireSide.scale.set(0.58, 1.55, 0.58);
    spireSide.position.set(0.28, 0.28, -0.16);
    spireSide.rotation.z = -0.35;

    // Split trench plates + glowing teal thermal seam (unmistakable physical fracture)
    const quenchGroup = this.makeScarGroup(x, padY, z);
    const leftPlate = this.meshInto(quenchGroup, geos.trenchPlate, mats.obsidian);
    leftPlate.position.set(-0.34, 0.09, 0);
    leftPlate.rotation.z = 0.14;
    const rightPlate = this.meshInto(quenchGroup, geos.trenchPlate, mats.obsidian);
    rightPlate.position.set(0.34, 0.09, 0);
    rightPlate.rotation.z = -0.14;
    this.meshInto(quenchGroup, geos.trenchGlow, mats.quench).position.y = 0.14;

    const flashGroup = this.makeScarGroup(x, padY, z);
    const geyserRing = this.meshInto(flashGroup, geos.geyserRing, mats.ice);
    geyserRing.rotation.x = Math.PI / 2;
    geyserRing.position.y = 0.07;
    this.meshInto(flashGroup, geos.geyserPlume, mats.mist).position.y = 0.44;

    const vitrifiedGroup = this.makeScarGroup(x, padY, z);
    this.meshInto(vitrifiedGroup, geos.monolith, mats.obsidian).position.y = 0.58;
    this.meshInto(vitrifiedGroup, geos.vein, mats.amber).position.y = 0.62;

    const cryoPrismGroup = this.makeScarGroup(x, padY, z);
    const cryoCore = this.meshInto(cryoPrismGroup, geos.spireMain, mats.crystal);
    cryoCore.scale.set(0.7, 2.3, 0.7);
    cryoCore.position.y = 0.5;
    const cryoCollar = this.meshInto(cryoPrismGroup, geos.cryoCollar, mats.ice);
    cryoCollar.rotation.x = Math.PI / 2;
    cryoCollar.position.y = 0.26;

    return {
      id,
      padY,
      ringMat,
      reticle,
      warnRing,
      statusPlate,
      craterGroup,
      frostGroup,
      spireGroup,
      quenchGroup,
      flashGroup,
      vitrifiedGroup,
      cryoPrismGroup,
      pulseBoost: 0,
      lastScar: null,
    };
  }

  private makeScarGroup(x: number, padY: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, padY, z);
    g.visible = false;
    this.group.add(g);
    return g;
  }

  private meshInto(parent: THREE.Group, geom: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(geom, mat);
    parent.add(m);
    return m;
  }

  private createBridgeBeam(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    mat: THREE.Material,
  ): THREE.Mesh {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dy, dz);
    const beam = new THREE.Mesh(this.ctx.scope.track(new THREE.CylinderGeometry(0.055, 0.055, length, 8)), mat);
    beam.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
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
    const targetY = PAD_HEIGHTS[targetZone.id] + 0.14;

    this.arcStart.set(0, 1.04, -1.85);
    this.arcEnd.set(targetZone.x, targetY, targetZone.z);
    this.arcMid.set(targetZone.x * 0.5, 2.32, -3.35);
    this.projectileMat.color.setHex(spell.colorHex);
    this.projectileMat.emissive.setHex(spell.emissiveHex);

    if (this.reducedMotion) {
      this.flightActive = false;
      this.projectile.stop();
      this.projectile.mesh.position.set(0, 1.04, -1.85);
      this.triggerImpact(targetZone.x, targetY, targetZone.z, spell.emissiveHex, next.lastOutcome?.refractedTargets ?? []);
      this.syncVisualState();
    } else {
      this.flightActive = true;
      this.projectile.start();
    }

    if (next.lastOutcome) {
      this.ctx.announce(next.lastOutcome.summary);
    }
  }

  private triggerImpact(x: number, y: number, z: number, emissiveHex: number, refracted: readonly ZoneId[]): void {
    this.shockwaveMat.color.setHex(emissiveHex);
    this.shockwaveMat.emissive.setHex(emissiveHex);
    this.shockwaveRing.position.set(x, y, z);
    this.shockwaveRing.scale.setScalar(0.35);
    this.shockwaveTimer = this.reducedMotion ? 0 : 0.55;
    this.shockwaveRing.visible = !this.reducedMotion;

    const spellIdx = SPELLS.findIndex((s) => s.id === this.state.selectedSpell);
    (this.burstMesh.material as THREE.MeshStandardMaterial).color.setHex(PARTICLE_COLORS[Math.max(0, spellIdx)]);
    (this.burstMesh.material as THREE.MeshStandardMaterial).emissive.setHex(emissiveHex);
    this.burstMesh.position.set(x, y + 0.08, z);
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
      this.beamTimer = this.reducedMotion ? 0 : 1.25;
    }
    const rig = this.zoneRigs.find((r) => r.id === this.state.selectedZone);
    if (rig) rig.pulseBoost = 1;
    for (const rId of refracted) {
      const nRig = this.zoneRigs.find((r) => r.id === rId);
      if (nRig) nRig.pulseBoost = 0.9;
    }
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
    this.refractTelegraphMat.color.setHex(spell.colorHex);
    this.refractTelegraphMat.emissive.setHex(spell.emissiveHex);

    this.arcStart.set(0, 1.04, -1.85);
    this.arcEnd.set(zone.x, PAD_HEIGHTS[zone.id] + 0.1, zone.z);
    this.arcMid.set(zone.x * 0.5, 2.28, -3.35);
    this.telegraphFilament.follow(this.castCurve);

    const preview = previewCastOutcome(this.state);
    const hasRefract = preview.refractedTargets.length > 0;

    // Bifurcated preview telegraph arcs showing second spell curving into neighbor scars BEFORE casting
    const leftFil = this.refractTelegraphs[0];
    const rightFil = this.refractTelegraphs[1];
    if (leftFil && rightFil) {
      const refractLeft = hasRefract && (preview.refractedTargets.includes('rim') || (zone.id === 'rim' && preview.refractedTargets.includes('conduit')));
      const refractRight = hasRefract && (preview.refractedTargets.includes('channel') || (zone.id === 'channel' && preview.refractedTargets.includes('conduit')));

      leftFil.group.visible = refractLeft;
      if (refractLeft) {
        this.refrStart.set(ZONES[1].x, PAD_HEIGHTS.conduit + 0.56, ZONES[1].z);
        this.refrEnd.set(ZONES[0].x, PAD_HEIGHTS.rim + 0.24, ZONES[0].z);
        this.refrMid.set((ZONES[1].x + ZONES[0].x) * 0.5, 2.02, (ZONES[1].z + ZONES[0].z) * 0.5);
        leftFil.follow(this.refrCurve);
      }

      rightFil.group.visible = refractRight;
      if (refractRight) {
        this.refrStart.set(ZONES[1].x, PAD_HEIGHTS.conduit + 0.56, ZONES[1].z);
        this.refrEnd.set(ZONES[2].x, PAD_HEIGHTS.channel + 0.24, ZONES[2].z);
        this.refrMid.set((ZONES[1].x + ZONES[2].x) * 0.5, 2.02, (ZONES[1].z + ZONES[2].z) * 0.5);
        rightFil.follow(this.refrCurve);
      }
    }

    for (const rig of this.zoneRigs) {
      const zState = this.state.zones[rig.id];
      const zSpec = ZONES.find((z) => z.id === rig.id)!;
      rig.reticle.visible = rig.id === this.state.selectedZone;
      rig.warnRing.visible = preview.refractedTargets.includes(rig.id);
      const scale = 0.86 + zState.intensity * 0.12;
      this.applyScarVisibility(rig, zState.scar, scale);

      if (rig.lastScar !== zState.scar) {
        rig.lastScar = zState.scar;
        updateLabel(scope, rig.statusPlate, `${zSpec.name.toUpperCase()}\n${SCAR_LABELS[zState.scar].toUpperCase()}`);
      }
    }

    if (this.refractBeams.length >= 2) {
      const activeConduitCrystal =
        this.state.zones.conduit.scar === 'spire' ||
        this.state.zones.conduit.scar === 'cryoprism' ||
        this.state.zones.conduit.scar === 'vitrified';
      const showRefract = this.state.refractionCount > 0 && (this.beamTimer > 0 || activeConduitCrystal);
      this.refractBeams[0].visible = showRefract && (this.activeBeamFlags[0] || this.state.zones.rim.scar !== 'none');
      this.refractBeams[1].visible = showRefract && (this.activeBeamFlags[1] || this.state.zones.channel.scar !== 'none');
    }

    const prefix = preview.refractedTargets.length > 0 ? 'REFRACT TELEGRAPH' : preview.reaction !== 'baseline' ? `REACTION [${preview.reaction.toUpperCase()}]` : 'TELEGRAPH';
    updateLabel(scope, this.consoleReadout, `${prefix}: ${preview.summary.toUpperCase()}`);
    const scarCount = countActiveScars(this.state);
    updateLabel(
      scope,
      this.archReadout,
      `CASTS: ${this.state.castCount} · ACTIVE SCARS: ${scarCount}/3 · REACTIONS: ${this.state.reactionCount} · REFRACTIONS: ${this.state.refractionCount}`,
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
      this.casterCrystal.position.y = 1.04 + Math.sin(this.elapsed * 2.2) * 0.025;
    }

    if (this.flightActive) {
      const done = this.projectile.update(dt, this.castCurve, 1.9);
      if (done) {
        this.flightActive = false;
        this.projectile.mesh.position.set(0, 1.04, -1.85);
        const spell = SPELLS.find((s) => s.id === this.state.selectedSpell) ?? SPELLS[0];
        const zone = ZONES.find((z) => z.id === this.state.selectedZone) ?? ZONES[1];
        this.triggerImpact(
          zone.x,
          PAD_HEIGHTS[zone.id] + 0.14,
          zone.z,
          spell.emissiveHex,
          this.state.lastOutcome?.refractedTargets ?? [],
        );
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
      if (!instant && (rig.spireGroup.visible || rig.cryoPrismGroup.visible)) {
        rig.spireGroup.rotation.y += dt * 0.4;
        rig.cryoPrismGroup.rotation.y += dt * 0.4;
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
      this.projectile.mesh.position.set(0, 1.04, -1.85);
      this.shockwaveRing.visible = false;
      this.burstMesh.visible = false;
      this.syncVisualState();
    }
  }

  protected override describeState(): string {
    const spell = SPELLS.find((s) => s.id === this.state.selectedSpell) ?? SPELLS[0];
    const zone = ZONES.find((z) => z.id === this.state.selectedZone) ?? ZONES[1];
    const outcome = this.state.lastOutcome ? ` Last outcome: ${this.state.lastOutcome.summary}` : '';
    const preview = previewCastOutcome(this.state);
    return (
      `Armed ${spell.name} on ${zone.name}. Casts=${this.state.castCount}, ` +
      `ActiveScars=${countActiveScars(this.state)}/3, Reactions=${this.state.reactionCount}, ` +
      `Refractions=${this.state.refractionCount}, PredictedRefract=${preview.refractedTargets.length}.${outcome}`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new SpellLeavesScarExhibit(def);
}
