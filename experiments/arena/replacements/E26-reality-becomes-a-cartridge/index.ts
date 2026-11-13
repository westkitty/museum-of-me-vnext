import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  COURSE_NODES,
  createInitialCartridgeState,
  cycleOverlayMode,
  moveRunnerStep,
  toggleCartridgeMode,
  type CartridgeState,
} from './model';

export class RealityCartridgeExhibit extends ExhibitBase {
  private state: CartridgeState = createInitialCartridgeState();

  private blocks = this.tracked<THREE.Mesh>();
  private blockHeights = new Float32Array(COURSE_NODES.length);
  private runnerGroup!: THREE.Group;
  private beaconMesh!: THREE.Mesh;
  private beaconMat!: THREE.MeshStandardMaterial;
  private overlayGlass!: THREE.Mesh;
  private overlayFrame!: THREE.Group;
  private overlayGlassMat!: THREE.MeshStandardMaterial;

  private foldLever!: Lever;
  private overlayLever!: Lever;
  private headerReadout!: THREE.Mesh;

  private foldBlend = 0;
  private runnerX = COURSE_NODES[0].x;
  private runnerY = COURSE_NODES[0].dioramaY + 0.22;
  private jumpArcT = 0;
  private jumping = false;

  protected override build(): void {
    const scope = this.ctx.scope;

    const mapSlate = this.standard(0x202733, { roughness: 0.72, metalness: 0.2 });
    const brass = this.standard(0xc99c42, { roughness: 0.4, metalness: 0.65 });
    const waterMat = this.standard(0x163854, { emissive: 0x0b2238, emissiveIntensity: 0.35, roughness: 0.35 });
    const terrainPalette = [0x4c6f52, 0x5c7d52, 0x6f8558, 0x8a7d60, 0xb2986c];

    // ── Isometric Map Table / Cartridge Frame at z = -4.95 (clear of plinth) ──
    const tableBase = this.mesh(new THREE.BoxGeometry(5.3, 0.55, 2.55), mapSlate);
    tableBase.position.set(0, 0.275, -4.95);

    const seaBed = this.mesh(new THREE.BoxGeometry(4.9, 0.08, 2.2), waterMat);
    seaBed.position.set(0, 0.59, -4.95);

    for (const sx of [-2.55, 2.55] as const) {
      for (const sz of [-6.12, -3.78] as const) {
        const post = this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 8), brass);
        post.position.set(sx, 0.36, sz);
      }
    }

    // Back Cartridge Shell Arch framing behind table
    const shellBack = this.mesh(new THREE.BoxGeometry(5.5, 3.1, 0.24), mapSlate);
    shellBack.position.set(0, 2.05, -6.28);

    const cartridgeTop = this.mesh(new THREE.BoxGeometry(5.7, 0.22, 0.38), brass);
    cartridgeTop.position.set(0, 3.68, -6.26);

    this.headerReadout = buildLabel(scope, 'DIORAMA MODE · OVERLAY OFF · STAGE 1/5', 3.4, 0.17);
    this.headerReadout.position.set(0, 4.15, -6.12);
    this.group.add(this.headerReadout);

    const sourceTag = buildLabel(scope, 'SYNTHETIC COASTAL STAGE · HONEST SCOPE', 2.6, 0.16);
    sourceTag.position.set(0, 3.68, -6.04);
    this.group.add(sourceTag);

    // 5 Transforming Terrain / Platform Columns
    for (let i = 0; i < COURSE_NODES.length; i++) {
      const node = COURSE_NODES[i];
      const col = this.mesh(
        new THREE.BoxGeometry(0.76, 1.0, 1.35),
        this.standard(terrainPalette[i], { roughness: 0.65 }),
      );
      col.position.set(node.x, node.dioramaY * 0.5 + 0.25, -4.95);
      this.blocks.push(col);
      this.blockHeights[i] = node.dioramaY;
    }

    // East Coast Lighthouse Goal Beacon on rightmost block
    this.beaconMat = this.emissive(0xffe17a, 1.1);
    this.beaconMesh = this.mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.55, 8), this.beaconMat);
    this.beaconMesh.position.set(COURSE_NODES[4].x, COURSE_NODES[4].dioramaY + 0.28, -4.95);

    // WestCat Articulated Runner Pawn (simple crisp voxel capsule figure)
    this.runnerGroup = new THREE.Group();
    this.runnerGroup.position.set(this.runnerX, this.runnerY, -4.75);
    const coatMat = this.emissive(0xff8c42, 0.9);
    const body = new THREE.Mesh(scope.track(new THREE.CapsuleGeometry(0.11, 0.18, 4, 8)), coatMat);
    body.position.y = 0.2;
    const brim = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10)), brass);
    brim.position.y = 0.36;
    const crown = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8)), brass);
    crown.position.y = 0.43;
    this.runnerGroup.add(body, brim, crown);
    this.group.add(this.runnerGroup);

    // Independent Translucent Non-Blocking WESTCAT Overlay (P037, click-through)
    this.overlayFrame = new THREE.Group();
    this.overlayFrame.position.set(0, 1.85, -3.55);
    this.overlayGlassMat = scope.track(
      new THREE.MeshStandardMaterial({
        color: 0x39e5ff,
        emissive: 0x16a8cc,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        roughness: 0.2,
      }),
    );
    this.overlayGlass = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(4.9, 2.35)), this.overlayGlassMat);
    this.overlayFrame.add(this.overlayGlass);

    const reticleMat = this.emissive(0x52f2ff, 1.2);
    for (const rx of [-2.2, 2.2] as const) {
      const rail = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.04, 2.35, 0.04)), reticleMat);
      rail.position.x = rx;
      this.overlayFrame.add(rail);
    }
    const hudCaption = buildLabel(scope, 'WESTCAT OVERLAY · CLICK-THROUGH TELEMETRY', 2.4, 0.16);
    hudCaption.position.set(0, 1.02, 0.02);
    this.overlayFrame.add(hudCaption);
    this.overlayFrame.visible = false;
    this.group.add(this.overlayFrame);

    // ── Console at z = -1.95 (safely outside PLINTH_BOX) ─────────────────────
    const consoleGroup = buildConsole(scope, 2.55, 0.7, 1.0, mapSlate);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    this.foldLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xffe17a, 1.2) });
    this.foldLever.group.position.set(-0.94, 1.03, -1.93);
    this.group.add(this.foldLever.group);
    const foldLbl = buildLabel(scope, 'FOLD MODE', 0.46, 0.28);
    foldLbl.position.set(-0.94, 1.14, -1.64);
    foldLbl.rotation.x = -0.35;
    this.group.add(foldLbl);

    this.overlayLever = new Lever(scope, 3, 0.36, { arm: this.emissive(0x52f2ff, 1.2) });
    this.overlayLever.group.position.set(-0.38, 1.03, -1.93);
    this.group.add(this.overlayLever.group);
    const ovLbl = buildLabel(scope, 'OVERLAY', 0.46, 0.28);
    ovLbl.position.set(-0.38, 1.14, -1.64);
    ovLbl.rotation.x = -0.35;
    this.group.add(ovLbl);

    const stepPuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), this.emissive(0x6be888, 1.0));
    stepPuck.position.set(0.24, 1.04, -1.93);
    const stepLbl = buildLabel(scope, 'STEP', 0.42, 0.28);
    stepLbl.position.set(0.24, 1.14, -1.64);
    stepLbl.rotation.x = -0.35;
    this.group.add(stepLbl);

    const leapPuck = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 12), this.emissive(0xff8c42, 1.1));
    leapPuck.position.set(0.72, 1.04, -1.93);
    const leapLbl = buildLabel(scope, 'LEAP', 0.42, 0.28);
    leapLbl.position.set(0.72, 1.14, -1.64);
    leapLbl.rotation.x = -0.35;
    this.group.add(leapLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), brass);
    resetPuck.position.set(1.12, 1.04, -1.93);

    // Wall plaque & reading lectern
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-4.15, 2.35, -7.25);
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.55, 0, -4.4);
    lectern.rotation.y = -0.45;
    this.group.add(lectern);

    // ── Register 5 Accessible Controls ────────────────────────────────────────
    this.control({
      object: this.foldLever.group,
      label: () => (this.state.mode === 'cartridge' ? 'Collapse to Diorama' : 'Fold into Cartridge'),
      description: 'Fold topographic relief into a bounded 5-stage 3D platformer cartridge or reverse back to map diorama.',
      activate: () => {
        this.state = toggleCartridgeMode(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.overlayLever.group,
      label: () => `WESTCAT Overlay (${this.state.overlay.toUpperCase()})`,
      description: 'Toggle independent translucent click-through telemetry overlay across either diorama or cartridge mode.',
      activate: () => {
        this.state = cycleOverlayMode(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: stepPuck,
      label: () => (this.state.mode === 'cartridge' ? 'Step Forward' : 'Survey Next Landmark'),
      description: 'Advance runner right across adjacent platforms; falls into tidal gap if gap requires Leap.',
      activate: () => {
        this.state = moveRunnerStep(this.state, false);
        this.jumping = false;
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: leapPuck,
      label: () => `Leap Gap (${this.state.leapsUsed} jumps)`,
      description: 'Execute high arc jump across tidal hazard channels to reach Sea Stack and East Lighthouse.',
      activate: () => {
        this.state = moveRunnerStep(this.state, true);
        if (this.state.mode === 'cartridge' && !this.reducedMotion) {
          this.jumping = true;
          this.jumpArcT = 0;
        }
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Cartridge',
      description: 'Return table cleanly to coastal diorama, clear overlay, and reset runner to West Pier.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E26 back to baseline coastal diorama.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    this.foldLever.value = this.state.mode === 'cartridge' ? 1 : 0;
    this.overlayLever.value = this.state.overlay === 'off' ? 0 : this.state.overlay === 'telemetry' ? 1 : 2;

    this.overlayFrame.visible = this.state.overlay !== 'off';
    if (this.state.overlay === 'contours') {
      this.overlayGlassMat.color.setHex(0xffc96b);
      this.overlayGlassMat.emissive.setHex(0xd48b28);
      this.overlayGlassMat.opacity = 0.28;
    } else {
      this.overlayGlassMat.color.setHex(0x39e5ff);
      this.overlayGlassMat.emissive.setHex(0x16a8cc);
      this.overlayGlassMat.opacity = 0.22;
    }

    this.beaconMat.emissive.setHex(this.state.goalReached ? 0x62ff96 : 0xffe17a);
    this.beaconMat.emissiveIntensity = this.state.goalReached ? 2.1 : 1.0;

    const node = COURSE_NODES[this.state.runnerIndex] ?? COURSE_NODES[0];
    updateLabel(
      scope,
      this.headerReadout,
      `${this.state.mode.toUpperCase()} · OVERLAY ${this.state.overlay.toUpperCase()} · ${node.label.toUpperCase()} (${node.index + 1}/5) · CLEARS ${this.state.clears}`,
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.foldLever.update(dt, instant);
    this.overlayLever.update(dt, instant);

    const targetFold = this.state.mode === 'cartridge' ? 1 : 0;
    if (instant) {
      this.foldBlend = targetFold;
    } else {
      this.foldBlend += (targetFold - this.foldBlend) * Math.min(1, dt * 6);
    }

    for (let i = 0; i < COURSE_NODES.length; i++) {
      const node = COURSE_NODES[i];
      const h = node.dioramaY + (node.cartridgeY - node.dioramaY) * this.foldBlend;
      this.blockHeights[i] = h;
      this.blocks[i].scale.y = h;
      this.blocks[i].position.y = 0.58 + h * 0.5;
    }

    this.beaconMesh.position.y = 0.58 + this.blockHeights[4] + 0.27;

    const targetNode = COURSE_NODES[this.state.runnerIndex] ?? COURSE_NODES[0];
    const targetX = targetNode.x;
    const groundY = 0.58 + this.blockHeights[this.state.runnerIndex];
    let arcLift = 0;
    if (this.jumping) {
      this.jumpArcT += dt * 3.0;
      if (this.jumpArcT >= 1) {
        this.jumping = false;
        this.jumpArcT = 0;
      } else {
        arcLift = Math.sin(this.jumpArcT * Math.PI) * 0.58;
      }
    }

    if (instant) {
      this.runnerX = targetX;
      this.runnerY = groundY;
    } else {
      this.runnerX += (targetX - this.runnerX) * Math.min(1, dt * 8);
      this.runnerY += (groundY - this.runnerY) * Math.min(1, dt * 10);
    }

    this.runnerGroup.position.set(this.runnerX, this.runnerY + arcLift, -4.75);
  }

  protected override onReset(): void {
    this.state = createInitialCartridgeState();
    this.foldBlend = 0;
    this.jumping = false;
    this.jumpArcT = 0;
    this.runnerX = COURSE_NODES[0].x;
    this.runnerY = 0.58 + COURSE_NODES[0].dioramaY;
    if (this.built) {
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    const node = COURSE_NODES[this.state.runnerIndex] ?? COURSE_NODES[0];
    return (
      `Mode=${this.state.mode}, Overlay=${this.state.overlay} (click-through), ` +
      `Stage=${node.index + 1}/${COURSE_NODES.length} (${node.label}), ` +
      `Clears=${this.state.clears}, Slips=${this.state.slips}, Goal=${this.state.goalReached}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new RealityCartridgeExhibit(def);
}
