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

export class BattlefieldTableExhibit extends ExhibitBase {
  private state: TacticalState = createInitialTacticalState();

  private vanguardToken!: THREE.Group;
  private sightlineFilament!: Filament;
  private sightlineMat!: THREE.MeshStandardMaterial;
  private playerHpBar!: THREE.Mesh;
  private enemyHpBar!: THREE.Mesh;

  private squareDial!: Dial;
  private actionLever!: Lever;
  private turnLever!: Lever;
  private statusReadout!: THREE.Mesh;
  private battleBanner!: THREE.Mesh;

  private readonly rayStart = new THREE.Vector3(0.0, 1.38, -5.65);
  private readonly rayMid = new THREE.Vector3(0.0, 1.42, -5.05);
  private readonly rayEnd = new THREE.Vector3(0.0, 1.35, -4.45);
  private readonly sightCurve = new THREE.QuadraticBezierCurve3(this.rayStart, this.rayMid, this.rayEnd);

  private vanguardX = 0;
  private vanguardZ = -4.45;
  private strikePulse = 0;

  protected override build(): void {
    const scope = this.ctx.scope;
    const mahogany = this.standard(0x3a241a, { roughness: 0.65, metalness: 0.15 });
    const slate = this.standard(0x272a34, { roughness: 0.78 });
    const brass = this.standard(0xc99c46, { roughness: 0.38, metalness: 0.72 });
    const stoneCover = this.standard(0x6d6860, { roughness: 0.85 });

    // ── Tactical Battletable at z = -4.95 (clear of bay plinth) ─────────────
    const pedestal = this.mesh(new THREE.BoxGeometry(2.2, 0.78, 1.6), mahogany);
    pedestal.position.set(0, 0.39, -4.95);

    const tabletop = this.mesh(new THREE.BoxGeometry(3.8, 0.16, 2.7), slate);
    tabletop.position.set(0, 0.86, -4.95);

    const rim = this.mesh(new THREE.BoxGeometry(3.96, 0.08, 2.86), mahogany);
    rim.position.set(0, 0.82, -4.95);

    // Engraved Grid Tiles & High Ridge Dais
    const tileOdd = this.standard(0x323744, { roughness: 0.7 });
    const tileEven = this.standard(0x222630, { roughness: 0.7 });
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = 0; gz < 3; gz++) {
        const tile = this.mesh(
          new THREE.BoxGeometry(0.66, 0.04, 0.66),
          (gx + gz) % 2 === 0 ? tileOdd : tileEven,
        );
        tile.position.set(gx * 0.7, 0.96, -5.65 + gz * 0.6);
      }
    }

    // West Stone Cover Pillar at (-0.9, y, -5.05) directly blocking Marksman sightline to (-0.9, -4.45)
    const coverPillar = this.mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.85, 6), stoneCover);
    coverPillar.position.set(-0.9, 1.38, -5.05);

    // East High Ridge Platform at (+0.9, -4.95)
    const highRidge = this.mesh(new THREE.BoxGeometry(0.75, 0.24, 0.75), stoneCover);
    highRidge.position.set(0.9, 1.08, -4.95);

    // Enemy Marksman Miniature at North-West Bastion (-0.9, -5.75)
    const enemyMat = this.emissive(0xff4c3b, 1.25);
    const marksmanBase = this.mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 10), brass);
    marksmanBase.position.set(-0.9, 1.02, -5.75);
    const marksmanBody = this.mesh(new THREE.ConeGeometry(0.18, 0.56, 8), enemyMat);
    marksmanBody.position.set(-0.9, 1.35, -5.75);

    // Enemy Ironclad Miniature at Center North (0.35, -5.7)
    const ironBase = this.mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 10), brass);
    ironBase.position.set(0.35, 1.02, -5.7);
    const ironBody = this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.62, 6), this.standard(0x9a3228, { roughness: 0.45 }));
    ironBody.position.set(0.35, 1.38, -5.7);

    // Player Vanguard Controllable Token
    this.vanguardToken = new THREE.Group();
    const allyMat = this.emissive(0x4bc8ff, 1.35);
    const vBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.22, 0.25, 0.1, 12)), brass);
    vBase.position.y = 0.05;
    const vTorso = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.14, 0.18, 0.52, 8)), allyMat);
    vTorso.position.y = 0.36;
    const vShield = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.24, 0.38, 0.06)), brass);
    vShield.position.set(-0.14, 0.36, 0.12);
    this.vanguardToken.add(vBase, vTorso, vShield);
    this.vanguardToken.position.set(0, 0.98, -4.45);
    this.group.add(this.vanguardToken);

    // Ally Ranger Support Token flanking right (+1.4, -4.45)
    const rangerBase = this.mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.1, 10), brass);
    rangerBase.position.set(1.4, 1.02, -4.45);
    const rangerBody = this.mesh(new THREE.CapsuleGeometry(0.12, 0.28, 4, 8), this.emissive(0x52e09d, 1.0));
    rangerBody.position.set(1.4, 1.28, -4.45);

    // Sightline Beam (Marksman -> Vanguard or blocked at Cover Pillar!)
    this.sightlineMat = this.emissive(0xff5242, 1.6);
    this.sightlineFilament = new Filament(scope, 14, 0.025, this.sightlineMat);
    this.sightlineFilament.follow(this.sightCurve);
    this.group.add(this.sightlineFilament.group);

    // Rear Combat Metric Pillars (Player HP vs Hostile HP)
    this.playerHpBar = this.mesh(new THREE.BoxGeometry(0.32, 1.4, 0.32), allyMat);
    this.playerHpBar.position.set(-2.35, 1.65, -5.3);
    const pLbl = buildLabel(scope, 'SQUAD HP', 0.58, 0.26);
    pLbl.position.set(-2.35, 0.7, -5.05);
    this.group.add(pLbl);

    this.enemyHpBar = this.mesh(new THREE.BoxGeometry(0.32, 1.4, 0.32), enemyMat);
    this.enemyHpBar.position.set(2.35, 1.65, -5.3);
    const eLbl = buildLabel(scope, 'HOSTILE HP', 0.58, 0.26);
    eLbl.position.set(2.35, 0.7, -5.05);
    this.group.add(eLbl);

    // Readout Boards behind battletable
    this.battleBanner = buildLabel(scope, 'TURN 0/3 · CENTER OPEN (EXPOSED) · SIGHTLINE UNBLOCKED', 3.6, 0.17);
    this.battleBanner.position.set(0, 3.6, -6.35);
    this.group.add(this.battleBanner);

    this.statusReadout = buildLabel(scope, 'SQUAD 22/22 HP · HOSTILE 22/22 HP · ACTION: STRIKE', 3.6, 0.17);
    this.statusReadout.position.set(0, 2.95, -6.35);
    this.group.add(this.statusReadout);

    // ── Command Console at z = -1.95 (clear of plinth) ──────────────────────
    const consoleGroup = buildConsole(scope, 2.55, 0.7, 1.0, mahogany);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    this.squareDial = new Dial(scope, 3, 0.2, { handle: allyMat });
    this.squareDial.group.position.set(-0.92, 1.03, -1.93);
    this.group.add(this.squareDial.group);
    const sqLbl = buildLabel(scope, 'POSITION', 0.46, 0.28);
    sqLbl.position.set(-0.92, 1.14, -1.64);
    sqLbl.rotation.x = -0.35;
    this.group.add(sqLbl);

    this.actionLever = new Lever(scope, 2, 0.36, { arm: brass });
    this.actionLever.group.position.set(-0.36, 1.03, -1.93);
    this.group.add(this.actionLever.group);
    const actLbl = buildLabel(scope, 'ACTION', 0.46, 0.28);
    actLbl.position.set(-0.36, 1.14, -1.64);
    actLbl.rotation.x = -0.35;
    this.group.add(actLbl);

    this.turnLever = new Lever(scope, 2, 0.36, { arm: enemyMat });
    this.turnLever.group.position.set(0.26, 1.03, -1.93);
    this.group.add(this.turnLever.group);
    const turnLbl = buildLabel(scope, 'RESOLVE', 0.46, 0.28);
    turnLbl.position.set(0.26, 1.14, -1.64);
    turnLbl.rotation.x = -0.35;
    this.group.add(turnLbl);

    const initPuck = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12), this.emissive(0xf2c86b, 1.1));
    initPuck.position.set(0.75, 1.04, -1.93);
    const initLbl = buildLabel(scope, 'INIT ORDER', 0.48, 0.28);
    initLbl.position.set(0.75, 1.14, -1.64);
    initLbl.rotation.x = -0.35;
    this.group.add(initLbl);

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

    // Sightline beam starts at Marksman (-0.9, 1.38, -5.75) and stops at cover pillar if blocked!
    this.rayStart.set(-0.9, 1.38, -5.75);
    if (sq.sightlineBlocked) {
      this.rayEnd.set(-0.9, 1.38, -5.05);
      this.sightlineMat.color.setHex(0xf2c86b);
      this.sightlineMat.emissive.setHex(0xd49b28);
    } else {
      this.rayEnd.set(sq.x, 1.36, sq.z);
      this.sightlineMat.color.setHex(0xff4c3b);
      this.sightlineMat.emissive.setHex(0xff2a1a);
    }
    this.rayMid.set((this.rayStart.x + this.rayEnd.x) * 0.5, 1.44, (this.rayStart.z + this.rayEnd.z) * 0.5);
    this.sightlineFilament.follow(this.sightCurve);

    const pRatio = Math.max(0.05, this.state.playerHp / 22);
    const eRatio = Math.max(0.05, this.state.enemyHp / 22);
    this.playerHpBar.scale.y = pRatio;
    this.playerHpBar.position.y = 0.95 + 0.7 * pRatio;
    this.enemyHpBar.scale.y = eRatio;
    this.enemyHpBar.position.y = 0.95 + 0.7 * eRatio;

    const sightLabel = sq.sightlineBlocked ? 'SIGHTLINE BLOCKED BY PILLAR (+5 COVER)' : 'SIGHTLINE OPEN';
    updateLabel(
      scope,
      this.battleBanner,
      `TURN ${this.state.turn}/3 · ${sq.label.toUpperCase()} · ${sightLabel}`,
    );
    updateLabel(
      scope,
      this.statusReadout,
      `SQUAD ${this.state.playerHp}/22 HP · HOSTILE ${this.state.enemyHp}/22 HP · ${this.state.outcome}`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.squareDial.update(dt, instant);
    this.actionLever.update(dt, instant);
    this.turnLever.update(dt, instant);

    const sq = squareSpecFor(this.state.square);
    const elev = sq.id === 'east_ridge' ? 1.2 : 0.98;
    if (instant) {
      this.vanguardX = sq.x;
      this.vanguardZ = sq.z;
    } else {
      this.vanguardX += (sq.x - this.vanguardX) * Math.min(1, dt * 8);
      this.vanguardZ += (sq.z - this.vanguardZ) * Math.min(1, dt * 8);
    }

    let lunge = 0;
    if (this.strikePulse > 0) {
      this.strikePulse = Math.max(0, this.strikePulse - dt);
      lunge = Math.sin((this.strikePulse / 0.45) * Math.PI) * 0.16;
    }
    this.vanguardToken.position.set(this.vanguardX, elev, this.vanguardZ - lunge);
  }

  protected override onReset(): void {
    this.state = createInitialTacticalState();
    this.strikePulse = 0;
    this.vanguardX = 0;
    this.vanguardZ = -4.45;
    if (this.built) {
      this.vanguardToken.position.set(0, 0.98, -4.45);
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
