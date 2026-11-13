import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Dial, Filament, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  createInitialTacticalState,
  cycleStanceSquare,
  INITIATIVE_ORDER,
  resolveCombatTurn,
  squareSpecFor,
  TACTICAL_SQUARES,
  toggleCombatAction,
  type TacticalState,
} from './model';

const BOARD_Y = 1.08;
const GRID_Y = 1.15;

export class BattlefieldTableExhibit extends ExhibitBase {
  private state: TacticalState = createInitialTacticalState();

  private vanguardToken!: THREE.Group;
  private vanguardShield!: THREE.Mesh;
  private guardWard!: THREE.Mesh;
  private vanguardRing!: THREE.Mesh;
  private vanguardRingMat!: THREE.MeshStandardMaterial;

  private marksmanGroup!: THREE.Group;
  private ironcladGroup!: THREE.Group;
  private rangerGroup!: THREE.Group;
  private coverWard!: THREE.Mesh;
  private coverWardMat!: THREE.MeshStandardMaterial;

  private sightlineFilament!: Filament;
  private sightlineMat!: THREE.MeshStandardMaterial;
  private advantageFilament!: Filament;
  private advantageMat!: THREE.MeshStandardMaterial;

  private playerHpBar!: THREE.Mesh;
  private enemyHpBar!: THREE.Mesh;
  private enemyHpMat!: THREE.MeshStandardMaterial;

  private readonly squarePadMats: THREE.MeshStandardMaterial[] = [];
  private readonly initPips: THREE.Mesh[] = [];
  private readonly initPipMats: THREE.MeshStandardMaterial[] = [];

  private squareDial!: Dial;
  private actionLever!: Lever;
  private turnLever!: Lever;
  private statusReadout!: THREE.Mesh;
  private battleBanner!: THREE.Mesh;

  private readonly rayStart = new THREE.Vector3(-0.9, 1.72, -5.85);
  private readonly rayMid = new THREE.Vector3(-0.45, 1.62, -5.15);
  private readonly rayEnd = new THREE.Vector3(0.0, 1.5, -4.45);
  private readonly sightCurve = new THREE.QuadraticBezierCurve3(this.rayStart, this.rayMid, this.rayEnd);

  private readonly advStart = new THREE.Vector3(0.0, 1.5, -4.45);
  private readonly advMid = new THREE.Vector3(0.2, 2.05, -5.05);
  private readonly advEnd = new THREE.Vector3(0.35, 1.56, -5.75);
  private readonly advCurve = new THREE.QuadraticBezierCurve3(this.advStart, this.advMid, this.advEnd);

  private vanguardX = 0;
  private vanguardZ = -4.45;
  private vanguardY = GRID_Y;
  private strikePulse = 0;

  protected override build(): void {
    const scope = this.ctx.scope;
    const mahogany = this.standard(0x3a241a, { roughness: 0.62, metalness: 0.16 });
    const slate = this.standard(0x232834, { roughness: 0.78, metalness: 0.12 });
    const brass = this.standard(0xcfa14a, { roughness: 0.34, metalness: 0.75 });
    const stoneCover = this.standard(0x757068, { roughness: 0.82 });
    const darkSlate = this.standard(0x161922, { roughness: 0.84 });

    const allyMat = this.emissive(0x4bc8ff, 1.35);
    const enemyMat = this.emissive(0xff4c3b, 1.3);
    const rangerMat = this.emissive(0x52e09d, 1.15);
    const goldMat = this.emissive(0xf2c86b, 1.2);

    // ── Elevated DM Battletable Stage at z = -5.0 (clears low foreground console) ──
    const plinth = this.mesh(new THREE.BoxGeometry(2.6, 0.94, 1.85), mahogany);
    plinth.position.set(0, 0.47, -5.0);

    const apron = this.mesh(new THREE.BoxGeometry(4.15, 0.12, 2.95), mahogany);
    apron.position.set(0, 1.0, -5.0);

    const tabletop = this.mesh(new THREE.BoxGeometry(3.96, 0.12, 2.76), slate);
    tabletop.position.set(0, BOARD_Y, -5.0);

    // Engraved 5x3 Battle Grid + Tactile Tactical Pads
    const tileOdd = this.standard(0x2e3443, { roughness: 0.72 });
    const tileEven = this.standard(0x1f2430, { roughness: 0.74 });
    const gridZRows = [-5.8, -5.15, -4.45];
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = 0; gz < 3; gz++) {
        const tile = this.mesh(
          new THREE.BoxGeometry(0.68, 0.04, 0.58),
          (gx + gz) % 2 === 0 ? tileOdd : tileEven,
        );
        tile.position.set(gx * 0.74, GRID_Y - 0.01, gridZRows[gz]);
      }
    }

    // Glowing Tactical Destination Pads matching TACTICAL_SQUARES
    const padCoords: Array<{ x: number; y: number; z: number; hex: number }> = [
      { x: 0.0, y: GRID_Y + 0.02, z: -4.45, hex: 0xff5242 }, // center_exposed
      { x: -0.9, y: GRID_Y + 0.02, z: -4.45, hex: 0x52e09d }, // west_cover
      { x: 0.9, y: GRID_Y + 0.25, z: -4.95, hex: 0xf2c86b }, // east_ridge
    ];
    this.squarePadMats.length = 0;
    for (const pad of padCoords) {
      const pMat = this.emissive(pad.hex, 0.75);
      this.squarePadMats.push(pMat);
      const padRing = this.mesh(new THREE.RingGeometry(0.24, 0.31, 20), pMat);
      padRing.rotation.x = -Math.PI / 2;
      padRing.position.set(pad.x, pad.y, pad.z);
    }

    // West Stone Cover Pillar monolith + Intercept Ward at (-0.9, -5.05)
    const coverBase = this.mesh(new THREE.BoxGeometry(0.64, 0.14, 0.42), stoneCover);
    coverBase.position.set(-0.9, GRID_Y + 0.07, -5.05);
    const coverPillar = this.mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.96, 6), stoneCover);
    coverPillar.position.set(-0.9, GRID_Y + 0.54, -5.05);
    const coverCap = this.mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.1, 6), brass);
    coverCap.position.set(-0.9, GRID_Y + 1.04, -5.05);

    this.coverWardMat = this.emissive(0xf2c86b, 1.5);
    this.coverWard = this.mesh(new THREE.RingGeometry(0.16, 0.28, 16), this.coverWardMat);
    this.coverWard.position.set(-0.9, 1.66, -5.35);

    // East High Ridge Stepped Terrace at (+0.9, -4.95)
    const ridgeStep = this.mesh(new THREE.BoxGeometry(0.84, 0.12, 0.84), darkSlate);
    ridgeStep.position.set(0.9, GRID_Y + 0.06, -4.95);
    const highRidge = this.mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), stoneCover);
    highRidge.position.set(0.9, GRID_Y + 0.17, -4.95);

    // Initiative Rail across north edge of tabletop: 18 VGD -> 15 MRK -> 12 RNG -> 9 IRN
    const railBar = this.mesh(new THREE.BoxGeometry(2.6, 0.06, 0.18), darkSlate);
    railBar.position.set(0, GRID_Y + 0.04, -6.22);
    this.initPips.length = 0;
    this.initPipMats.length = 0;
    const pipHexes = [0x4bc8ff, 0xff4c3b, 0x52e09d, 0xd8583f];
    for (let i = 0; i < 4; i++) {
      const pipMat = this.emissive(pipHexes[i], i === 0 ? 1.4 : 0.45);
      this.initPipMats.push(pipMat);
      const pip = this.mesh(new THREE.BoxGeometry(0.46, 0.1, 0.12), pipMat);
      pip.position.set(-0.9 + i * 0.6, GRID_Y + 0.11, -6.22);
      this.initPips.push(pip);
    }
    if (this.ctx.detailScale >= 0.75) {
      const initRailLbl = buildLabel(scope, 'INITIATIVE TRACK · 18 VGD · 15 MRK · 12 RNG · 9 IRN', 2.4, 0.15);
      initRailLbl.position.set(0, GRID_Y + 0.25, -6.26);
      this.group.add(initRailLbl);
    }

    // ── Articulated Tabletop Miniatures ──────────────────────────────────────
    // Hostile Marksman on raised North-West sniper plinth (-0.9, -5.85)
    this.marksmanGroup = new THREE.Group();
    const mPlinth = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.22, 0.26, 0.14, 10)), brass);
    mPlinth.position.y = 0.07;
    const mCloak = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.2, 0.62, 8)), enemyMat);
    mCloak.position.y = 0.44;
    const mHelm = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.11, 10, 8)), enemyMat);
    mHelm.position.y = 0.78;
    const mBow = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.38, 0.06, 0.1)), brass);
    mBow.position.set(0, 0.56, 0.2);
    this.marksmanGroup.add(mPlinth, mCloak, mHelm, mBow);
    this.marksmanGroup.position.set(-0.9, GRID_Y, -5.85);
    this.group.add(this.marksmanGroup);

    // Hostile Ironclad Heavy Sentinel at Center North (0.35, -5.75)
    this.ironcladGroup = new THREE.Group();
    const ironArmor = this.standard(0xa6382b, { roughness: 0.38, metalness: 0.52 });
    const iBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.25, 0.29, 0.12, 10)), brass);
    iBase.position.y = 0.06;
    const iBody = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.21, 0.24, 0.58, 6)), ironArmor);
    iBody.position.y = 0.4;
    const iHelm = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.22, 0.2, 0.22)), enemyMat);
    iHelm.position.y = 0.74;
    const iPauldrons = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.52, 0.12, 0.22)), brass);
    iPauldrons.position.y = 0.62;
    this.ironcladGroup.add(iBase, iBody, iHelm, iPauldrons);
    this.ironcladGroup.position.set(0.35, GRID_Y, -5.75);
    this.group.add(this.ironcladGroup);

    // Ally Ranger Support Miniature flanking right (+1.4, -4.45)
    this.rangerGroup = new THREE.Group();
    const rBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.19, 0.23, 0.1, 10)), brass);
    rBase.position.y = 0.05;
    const rBody = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8)), rangerMat);
    rBody.position.y = 0.34;
    const rHood = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.14, 0.22, 8)), rangerMat);
    rHood.position.y = 0.62;
    this.rangerGroup.add(rBase, rBody, rHood);
    this.rangerGroup.position.set(1.42, GRID_Y, -4.45);
    this.group.add(this.rangerGroup);

    // Player Vanguard Controllable Miniature (with dynamic Shield/Blade + Guard Ward!)
    this.vanguardToken = new THREE.Group();
    const vBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.23, 0.27, 0.11, 12)), brass);
    vBase.position.y = 0.055;
    const vTorso = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.15, 0.19, 0.48, 8)), allyMat);
    vTorso.position.y = 0.35;
    const vHelm = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.12, 10, 8)), allyMat);
    vHelm.position.y = 0.66;
    const vBlade = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.05, 0.44, 0.08)), goldMat);
    vBlade.position.set(0.2, 0.5, -0.06);
    vBlade.rotation.x = -0.35;
    this.vanguardShield = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.28, 0.4, 0.07)), brass);
    this.vanguardShield.position.set(-0.18, 0.42, 0.08);
    const wardMat = this.emissive(0x4bc8ff, 1.35);
    wardMat.transparent = true;
    wardMat.opacity = 0.32;
    this.guardWard = new THREE.Mesh(
      scope.track(new THREE.CylinderGeometry(0.36, 0.4, 0.56, 16, 1, true)),
      wardMat,
    );
    this.guardWard.position.y = 0.4;
    this.guardWard.visible = false;
    this.vanguardRingMat = this.emissive(0xff4c3b, 1.45);
    this.vanguardRing = new THREE.Mesh(scope.track(new THREE.RingGeometry(0.3, 0.38, 22)), this.vanguardRingMat);
    this.vanguardRing.rotation.x = -Math.PI / 2;
    this.vanguardRing.position.y = 0.03;
    this.vanguardToken.add(vBase, vTorso, vHelm, vBlade, this.vanguardShield, this.guardWard, this.vanguardRing);
    this.vanguardToken.position.set(0, GRID_Y, -4.45);
    this.group.add(this.vanguardToken);

    // ── Live Tactical Arcs (Marksman Sightline + Vanguard Advantage/Counter) ──
    this.sightlineMat = this.emissive(0xff4c3b, 1.7);
    this.sightlineFilament = new Filament(scope, 16, 0.032, this.sightlineMat);
    this.sightlineFilament.follow(this.sightCurve);
    this.group.add(this.sightlineFilament.group);

    this.advantageMat = this.emissive(0xf2c86b, 1.45);
    this.advantageFilament = new Filament(scope, 14, 0.022, this.advantageMat);
    this.advantageFilament.follow(this.advCurve);
    this.group.add(this.advantageFilament.group);

    // ── Symmetrical HP Totem Towers outside table (Labels elevated clear of console!) ──
    const pTowerBase = this.mesh(new THREE.BoxGeometry(0.56, 1.06, 0.56), darkSlate);
    pTowerBase.position.set(-2.45, 0.53, -5.05);
    this.playerHpBar = this.mesh(new THREE.BoxGeometry(0.32, 1.4, 0.32), allyMat);
    this.playerHpBar.position.set(-2.45, 1.76, -5.05);
    const pLbl = buildLabel(scope, 'SQUAD HP', 0.64, 0.25);
    pLbl.position.set(-2.45, 2.74, -5.05);
    this.group.add(pLbl);

    const eTowerBase = this.mesh(new THREE.BoxGeometry(0.56, 1.06, 0.56), darkSlate);
    eTowerBase.position.set(2.45, 0.53, -5.05);
    this.enemyHpMat = this.emissive(0xff4c3b, 1.3);
    this.enemyHpBar = this.mesh(new THREE.BoxGeometry(0.32, 1.4, 0.32), this.enemyHpMat);
    this.enemyHpBar.position.set(2.45, 1.76, -5.05);
    const eLbl = buildLabel(scope, 'HOSTILE HP', 0.64, 0.25);
    eLbl.position.set(2.45, 2.74, -5.05);
    this.group.add(eLbl);

    // Readout Banners framed cleanly above tabletop
    this.battleBanner = buildLabel(scope, 'TURN 0/3 · CENTER OPEN (EXPOSED) · SIGHTLINE OPEN', 3.9, 0.17);
    this.battleBanner.position.set(0, 3.68, -6.4);
    this.group.add(this.battleBanner);

    this.statusReadout = buildLabel(scope, 'SQUAD 22/22 HP · HOSTILE 22/22 HP · ACTION: STRIKE', 3.9, 0.17);
    this.statusReadout.position.set(0, 3.04, -6.4);
    this.group.add(this.statusReadout);

    // ── Streamlined Low Foreground Command Console (z = -1.78, h = 0.56 -> Zero board occlusion!) ──
    const consoleGroup = buildConsole(scope, 2.55, 0.62, 0.56, mahogany);
    consoleGroup.position.set(0, 0, -1.78);
    this.group.add(consoleGroup);

    this.squareDial = new Dial(scope, 3, 0.19, { handle: allyMat });
    this.squareDial.group.position.set(-0.92, 0.59, -1.76);
    this.group.add(this.squareDial.group);
    const sqLbl = buildLabel(scope, 'POSITION', 0.44, 0.24);
    sqLbl.position.set(-0.92, 0.65, -1.48);
    sqLbl.rotation.x = -0.45;
    this.group.add(sqLbl);

    this.actionLever = new Lever(scope, 2, 0.32, { arm: brass });
    this.actionLever.group.position.set(-0.36, 0.59, -1.76);
    this.group.add(this.actionLever.group);
    const actLbl = buildLabel(scope, 'ACTION', 0.44, 0.24);
    actLbl.position.set(-0.36, 0.65, -1.48);
    actLbl.rotation.x = -0.45;
    this.group.add(actLbl);

    this.turnLever = new Lever(scope, 2, 0.32, { arm: enemyMat });
    this.turnLever.group.position.set(0.26, 0.59, -1.76);
    this.group.add(this.turnLever.group);
    const turnLbl = buildLabel(scope, 'RESOLVE', 0.44, 0.24);
    turnLbl.position.set(0.26, 0.65, -1.48);
    turnLbl.rotation.x = -0.45;
    this.group.add(turnLbl);

    const initPuck = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12), goldMat);
    initPuck.position.set(0.75, 0.6, -1.76);
    const initLbl = buildLabel(scope, 'INIT ORDER', 0.46, 0.24);
    initLbl.position.set(0.75, 0.65, -1.48);
    initLbl.rotation.x = -0.45;
    this.group.add(initLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), brass);
    resetPuck.position.set(1.14, 0.6, -1.76);
    const rstLbl = buildLabel(scope, 'RESET', 0.36, 0.24);
    rstLbl.position.set(1.14, 0.65, -1.48);
    rstLbl.rotation.x = -0.45;
    this.group.add(rstLbl);

    // Symmetrical Wall Plaque & Lectern framing the bay
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
      object: this.squareDial.group,
      label: () => `Square: ${squareSpecFor(this.state.square).label}`,
      description: 'Shift Vanguard 1 square between exposed center, West Cover Pillar, or East High Ridge.',
      activate: () => {
        this.state = cycleStanceSquare(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: this.actionLever.group,
      label: () => `Action: ${this.state.action.toUpperCase()}`,
      description: 'Switch tactical stance between Strike & Press vs Guard & Brace (-4 incoming damage).',
      activate: () => {
        this.state = toggleCombatAction(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: this.turnLever.group,
      label: () =>
        this.state.outcome === 'IN_PROGRESS'
          ? `Resolve Turn ${this.state.turn + 1}/3`
          : `Result: ${this.state.outcome}`,
      description: 'Execute the next deterministic initiative round with live cover & sightline resolution.',
      activate: () => {
        if (this.state.outcome !== 'IN_PROGRESS') {
          this.ctx.announce(`Encounter complete (${this.state.outcome}). Reset Encounter to test a 1-square shift.`);
          return;
        }
        this.state = resolveCombatTurn(this.state);
        this.strikePulse = this.reducedMotion ? 0 : 0.45;
        this.syncVisuals();
        this.ctx.announce(this.state.lastLog);
      },
    });

    this.control({
      object: initPuck,
      label: 'Read Initiative Order',
      description: 'Announce turn order, cover AC bonus, and exact sightline state.',
      activate: () => {
        const sq = squareSpecFor(this.state.square);
        this.ctx.announce(
          `Initiative: ${INITIATIVE_ORDER}. ${sq.label}: Cover +${sq.coverAC} AC, Sightline ${sq.sightlineBlocked ? 'BLOCKED by pillar' : 'OPEN'}.`,
        );
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Encounter',
      description: 'Restore Turn 0 and full 22/22 HP to compare alternate starting positions.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Tactical encounter reset to Turn 0 (22/22 HP).');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    const sqIdx = TACTICAL_SQUARES.findIndex((s) => s.id === this.state.square);
    const sq = TACTICAL_SQUARES[Math.max(0, sqIdx)];

    this.squareDial.value = Math.max(0, sqIdx);
    this.actionLever.value = this.state.action === 'guard' ? 1 : 0;
    this.turnLever.value = this.state.turn > 0 ? 1 : 0;

    // Highlight selected pad on board
    for (let i = 0; i < this.squarePadMats.length; i++) {
      this.squarePadMats[i].emissiveIntensity = i === sqIdx ? 1.8 : 0.35;
    }

    // Stance feedback: Guard raises tower shield + projects ward dome
    const guarding = this.state.action === 'guard' && this.state.outcome !== 'DEFEAT';
    this.guardWard.visible = guarding;
    this.vanguardShield.position.set(guarding ? 0 : -0.18, guarding ? 0.48 : 0.42, guarding ? 0.22 : 0.08);
    this.vanguardShield.rotation.y = guarding ? 0.55 : 0;

    // Vanguard floor aura reflects survival rule before pressing Resolve!
    if (this.state.outcome === 'VICTORY') {
      this.vanguardRingMat.color.setHex(0x52e09d);
      this.vanguardRingMat.emissive.setHex(0x2fb878);
    } else if (sq.sightlineBlocked) {
      this.vanguardRingMat.color.setHex(0x52e09d);
      this.vanguardRingMat.emissive.setHex(0x3ad18c);
    } else if (sq.id === 'east_ridge') {
      this.vanguardRingMat.color.setHex(0xf2c86b);
      this.vanguardRingMat.emissive.setHex(0xd49b28);
    } else {
      this.vanguardRingMat.color.setHex(0xff4c3b);
      this.vanguardRingMat.emissive.setHex(0xff2a1a);
    }

    // Marksman Sightline Beam: stops & flares against West Cover Pillar vs pierces exposed Vanguard
    const enemyDown = this.state.outcome === 'VICTORY';
    const vanguardDown = this.state.outcome === 'DEFEAT';
    this.sightlineFilament.group.visible = !enemyDown;
    this.coverWard.visible = sq.sightlineBlocked && !enemyDown;

    this.rayStart.set(-0.9, 1.72, -5.85);
    if (sq.sightlineBlocked) {
      this.rayEnd.set(-0.9, 1.66, -5.34);
      this.sightlineMat.color.setHex(0xf2c86b);
      this.sightlineMat.emissive.setHex(0xe5a932);
    } else {
      const targetY = sq.id === 'east_ridge' ? GRID_Y + 0.72 : GRID_Y + 0.52;
      this.rayEnd.set(sq.x, targetY, sq.z);
      this.sightlineMat.color.setHex(0xff4c3b);
      this.sightlineMat.emissive.setHex(0xff2a1a);
    }
    this.rayMid.set((this.rayStart.x + this.rayEnd.x) * 0.5, 1.85, (this.rayStart.z + this.rayEnd.z) * 0.5);
    this.sightlineFilament.follow(this.sightCurve);

    // Advantage Strike Arc (Vanguard -> Ironclad): bright gold on East Ridge or Strike, muted on Guard
    const showStrikeArc = !vanguardDown && (this.state.action === 'strike' || sq.id === 'east_ridge');
    this.advantageFilament.group.visible = showStrikeArc;
    const originY = sq.id === 'east_ridge' ? GRID_Y + 0.72 : GRID_Y + 0.52;
    this.advStart.set(sq.x, originY, sq.z);
    this.advEnd.set(0.35, GRID_Y + 0.55, -5.75);
    this.advMid.set((this.advStart.x + this.advEnd.x) * 0.5, 2.28, (this.advStart.z + this.advEnd.z) * 0.5);
    this.advantageFilament.follow(this.advCurve);
    this.advantageMat.emissiveIntensity = sq.id === 'east_ridge' ? 1.8 : 0.95;

    // Physical unit defeat / victory reactions on tabletop
    if (enemyDown) {
      this.marksmanGroup.rotation.z = 1.25;
      this.marksmanGroup.position.y = GRID_Y + 0.14;
      this.ironcladGroup.rotation.z = -1.25;
      this.ironcladGroup.position.y = GRID_Y + 0.16;
      this.enemyHpMat.color.setHex(0x63302b);
      this.enemyHpMat.emissive.setHex(0x3a1814);
    } else {
      this.marksmanGroup.rotation.z = 0;
      this.marksmanGroup.position.y = GRID_Y;
      this.ironcladGroup.rotation.z = 0;
      this.ironcladGroup.position.y = GRID_Y;
      this.enemyHpMat.color.setHex(0xff4c3b);
      this.enemyHpMat.emissive.setHex(0xe83324);
    }

    this.vanguardToken.rotation.z = vanguardDown ? -1.25 : 0;

    // Initiative pip progression by turn phase
    const activePip = this.state.outcome === 'IN_PROGRESS' ? this.state.turn % 4 : -1;
    for (let i = 0; i < this.initPipMats.length; i++) {
      this.initPipMats[i].emissiveIntensity = i === activePip || enemyDown ? 1.75 : 0.4;
    }

    // HP Pillars scale upward cleanly from slate bases (y = 1.06 -> 2.46)
    const pRatio = Math.max(0.05, this.state.playerHp / 22);
    const eRatio = Math.max(0.05, this.state.enemyHp / 22);
    this.playerHpBar.scale.y = pRatio;
    this.playerHpBar.position.y = 1.06 + 0.7 * pRatio;
    this.enemyHpBar.scale.y = eRatio;
    this.enemyHpBar.position.y = 1.06 + 0.7 * eRatio;

    const sightLabel = sq.sightlineBlocked
      ? 'SIGHTLINE BLOCKED AT PILLAR (+5 AC)'
      : sq.id === 'east_ridge'
        ? 'HIGH RIDGE (+3 ATK / +2 AC)'
        : 'SIGHTLINE OPEN (LETHAL CROSSFIRE)';
    updateLabel(
      scope,
      this.battleBanner,
      `TURN ${this.state.turn}/3 · ${sq.label.toUpperCase()} · ${sightLabel}`,
    );
    updateLabel(
      scope,
      this.statusReadout,
      `SQUAD ${this.state.playerHp}/22 HP · HOSTILE ${this.state.enemyHp}/22 HP · ${this.state.action.toUpperCase()} · ${this.state.outcome}`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.squareDial.update(dt, instant);
    this.actionLever.update(dt, instant);
    this.turnLever.update(dt, instant);

    const sq = squareSpecFor(this.state.square);
    const targetElev = sq.id === 'east_ridge' ? GRID_Y + 0.24 : GRID_Y;
    if (instant) {
      this.vanguardX = sq.x;
      this.vanguardZ = sq.z;
      this.vanguardY = targetElev;
    } else {
      const k = Math.min(1, dt * 8);
      this.vanguardX += (sq.x - this.vanguardX) * k;
      this.vanguardZ += (sq.z - this.vanguardZ) * k;
      this.vanguardY += (targetElev - this.vanguardY) * k;
    }

    let lunge = 0;
    if (this.strikePulse > 0) {
      this.strikePulse = Math.max(0, this.strikePulse - dt);
      lunge = Math.sin((this.strikePulse / 0.45) * Math.PI) * 0.18;
    }
    const collapseLift = this.state.outcome === 'DEFEAT' ? 0.15 : 0;
    this.vanguardToken.position.set(this.vanguardX, this.vanguardY + collapseLift, this.vanguardZ - lunge);

    if (!instant && this.coverWard.visible) {
      const pulse = 1 + Math.sin(this.elapsed * 5.2) * 0.1;
      this.coverWard.scale.setScalar(pulse);
    } else {
      this.coverWard.scale.setScalar(1);
    }
  }

  protected override onReset(): void {
    this.state = createInitialTacticalState();
    this.strikePulse = 0;
    this.vanguardX = 0;
    this.vanguardZ = -4.45;
    this.vanguardY = GRID_Y;
    if (this.built) {
      this.vanguardToken.position.set(0, GRID_Y, -4.45);
      this.vanguardToken.rotation.z = 0;
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    const sq = squareSpecFor(this.state.square);
    return (
      `Turn=${this.state.turn}/3, Square=${sq.id}, Sightline=${sq.sightlineBlocked ? 'blocked' : 'open'}, ` +
      `Action=${this.state.action}, PlayerHP=${this.state.playerHp}/22, EnemyHP=${this.state.enemyHp}/22, ` +
      `Outcome=${this.state.outcome}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new BattlefieldTableExhibit(def);
}
