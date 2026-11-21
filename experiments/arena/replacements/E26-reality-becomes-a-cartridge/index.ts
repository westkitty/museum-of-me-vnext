import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  COURSE_NODES,
  FRAGMENTED_REPOS,
  createInitialCartridgeState,
  cycleOverlayMode,
  moveRunnerStep,
  toggleCartridgeMode,
  type CartridgeState,
} from './model';

const SURFACE_BASE_Y = 0.58;

export class RealityCartridgeExhibit extends ExhibitBase {
  private state: CartridgeState = createInitialCartridgeState();

  private blocks = this.tracked<THREE.Mesh>();
  private ledgeCaps = this.tracked<THREE.Mesh>();
  private capMats = this.tracked<THREE.MeshStandardMaterial>();
  private nodeTopGroups = this.tracked<THREE.Group>();
  private cedarFoliage = this.tracked<THREE.Mesh>();
  private foamRing!: THREE.Mesh;
  private pinGroup!: THREE.Group;
  private cartridgePins = this.tracked<THREE.Mesh>();
  private lighthouseBeam!: THREE.Group;

  private blockHeights = new Float32Array(COURSE_NODES.length);
  private runnerGroup!: THREE.Group;
  private speechBubble!: THREE.Group;
  private speechRingMat!: THREE.MeshStandardMaterial;
  private beaconMat!: THREE.MeshStandardMaterial;
  private beaconLens!: THREE.Mesh;

  private overlayFrame!: THREE.Group;
  private overlayGlass!: THREE.Mesh;
  private overlayGlassMat!: THREE.MeshStandardMaterial;
  private overlayRailMat!: THREE.MeshStandardMaterial;
  private overlayHeader!: THREE.Mesh;
  private pollLabel!: THREE.Mesh;
  private pollBarFill!: THREE.Mesh;
  private pollBarMat!: THREE.MeshStandardMaterial;
  private cardMat!: THREE.MeshStandardMaterial;
  private passThroughRay!: THREE.Mesh;
  private passRayMat!: THREE.MeshStandardMaterial;

  private foldLever!: Lever;
  private overlayLever!: Lever;
  private headerReadout!: THREE.Mesh;

  private foldBlend = 0;
  private runnerX = COURSE_NODES[0].x;
  private runnerY = SURFACE_BASE_Y + COURSE_NODES[0].dioramaY;
  private jumpArcT = 0;
  private jumping = false;
  private misclickFlashT = 0;
  private orbitPhase = 0;

  protected override build(): void {
    const scope = this.ctx.scope;

    const mapSlate = this.standard(0x1d2633, { roughness: 0.72, metalness: 0.22 });
    const brass = this.standard(0xc99c42, { roughness: 0.38, metalness: 0.68 });
    const timberMat = this.standard(0x6d4a2e, { roughness: 0.85 });
    const railSteel = this.standard(0x90a3b5, { roughness: 0.35, metalness: 0.75 });
    const stoneMat = this.standard(0x4c5866, { roughness: 0.88 });
    const pineMat = this.standard(0x27593d, { roughness: 0.82 });
    const whitePaint = this.standard(0xebeff5, { roughness: 0.6 });
    const crimsonPaint = this.standard(0xb93832, { roughness: 0.55 });
    const waterMat = this.standard(0x11334d, {
      emissive: 0x0a253b,
      emissiveIntensity: 0.48,
      roughness: 0.28,
      metalness: 0.15,
    });
    const tideGlowMat = this.emissive(0x3cb4d8, 0.75);
    const dioramaPalette = [0x4c5b48, 0x4f614d, 0x47555e, 0x3b6344, 0x7b7565];

    // ── Coastal Basin Table & Retractable Cartridge Rim (z = -4.95) ─────────
    const tableBase = this.mesh(new THREE.BoxGeometry(5.5, 0.54, 2.65), mapSlate);
    tableBase.position.set(0, 0.27, -4.95);

    const seaBed = this.mesh(new THREE.BoxGeometry(5.12, 0.08, 2.26), waterMat);
    seaBed.position.set(0, 0.56, -4.95);

    // Highlighted tidal inlet cuts directly beneath the two leap gaps
    for (const gapX of [-0.47, 1.55] as const) {
      const channel = this.mesh(new THREE.BoxGeometry(0.24, 0.03, 2.18), tideGlowMat);
      channel.position.set(gapX, 0.59, -4.95);
    }

    for (const sx of [-2.65, 2.65] as const) {
      for (const sz of [-6.18, -3.72] as const) {
        const post = this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 8), brass);
        post.position.set(sx, 0.36, sz);
      }
    }

    // Cartridge brass edge-connector pins tucked inside the table's front lip
    this.pinGroup = new THREE.Group();
    this.pinGroup.position.set(0, 0.42, -3.72);
    for (let p = -4; p <= 4; p++) {
      const pin = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.24, 0.1, 0.26)), brass);
      pin.position.set(p * 0.46, 0, 0);
      this.pinGroup.add(pin);
      this.cartridgePins.push(pin);
    }
    this.group.add(this.pinGroup);

    // Back Cartridge Arch + Grounded Scope Tag
    const shellBack = this.mesh(new THREE.BoxGeometry(5.6, 3.15, 0.24), mapSlate);
    shellBack.position.set(0, 2.08, -6.32);

    const cartridgeTop = this.mesh(new THREE.BoxGeometry(5.8, 0.22, 0.38), brass);
    cartridgeTop.position.set(0, 3.74, -6.3);

    this.headerReadout = buildLabel(scope, 'DIORAMA · OVERLAY OFF · ISLAND TIMBER PIER', 3.65, 0.17);
    this.headerReadout.position.set(0, 4.22, -6.16);
    this.group.add(this.headerReadout);

    const sourceTag = buildLabel(
      scope,
      'P038 COASTAL STAGE (SYNTHETIC) · P037 OVERLAY RULE',
      3.15,
      0.16,
    );
    sourceTag.position.set(0, 3.74, -6.08);
    this.group.add(sourceTag);

    // ── 5 Sculpted Vancouver Island Landmarks -> Quantized 16-bit Platforms ──
    const ledgeGeo = scope.track(new THREE.BoxGeometry(0.82, 0.08, 1.4));
    const stakeGeo = scope.track(new THREE.CylinderGeometry(0.015, 0.015, 2.55, 6));
    const stakeMat = this.emissive(0x4bc8e8, 0.55);

    for (let i = 0; i < COURSE_NODES.length; i++) {
      const node = COURSE_NODES[i];
      const col = this.mesh(
        new THREE.BoxGeometry(0.76, 1.0, 1.32),
        this.standard(dioramaPalette[i], { roughness: 0.78 }),
      );
      col.position.set(node.x, SURFACE_BASE_Y + node.dioramaY * 0.5, -4.95);
      this.blocks.push(col);
      this.blockHeights[i] = node.dioramaY;

      // Vertical survey datum rod proving horizontal X/gaps stay pinned to coastline
      const stake = new THREE.Mesh(stakeGeo, stakeMat);
      stake.position.set(node.x, 1.85, -5.78);
      this.group.add(stake);

      // Quantized 16-bit top cap sliding cleanly with terrain height
      const topGroup = new THREE.Group();
      topGroup.position.set(node.x, SURFACE_BASE_Y + node.dioramaY, -4.95);
      this.group.add(topGroup);
      this.nodeTopGroups.push(topGroup);

      const capMat = this.standard(0x5d7255, {
        emissive: 0x173220,
        emissiveIntensity: 0.15,
        roughness: 0.65,
      });
      this.capMats.push(capMat);
      const cap = new THREE.Mesh(ledgeGeo, capMat);
      cap.position.y = 0.02;
      topGroup.add(cap);
      this.ledgeCaps.push(cap);

      // Landmark-specific silhouettes
      if (i === 0) {
        // West Timber Pier: planks + twin dock bollards
        for (const bz of [-0.45, 0.45] as const) {
          const bollard = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.06, 0.07, 0.22, 8)), timberMat);
          bollard.position.set(-0.26, 0.14, bz);
          topGroup.add(bollard);
        }
        const deck = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.72, 0.05, 0.96)), timberMat);
        deck.position.set(0, 0.08, 0);
        topGroup.add(deck);
      } else if (i === 1) {
        // Harbour Rail Spur: parallel steel rails + timber sleepers
        for (const rz of [-0.18, 0.18] as const) {
          const rail = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.78, 0.05, 0.05)), railSteel);
          rail.position.set(0, 0.11, rz);
          topGroup.add(rail);
        }
        const sleeperCount = this.scaled(3);
        for (let s = 0; s < sleeperCount; s++) {
          const sleeper = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.1, 0.04, 0.56)), timberMat);
          sleeper.position.set(-0.24 + s * 0.24, 0.07, 0);
          topGroup.add(sleeper);
        }
      } else if (i === 2) {
        // Tidal Narrows Stack: craggy basalt spire crown + water foam halo
        const rockCrown = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.24, 0.36, 0.2, 6)), stoneMat);
        rockCrown.position.set(0, 0.14, -0.35);
        topGroup.add(rockCrown);

        this.foamRing = new THREE.Mesh(
          scope.track(new THREE.RingGeometry(0.45, 0.62, 16)),
          this.emissive(0xbce8ff, 0.65),
        );
        this.foamRing.rotation.x = -Math.PI / 2;
        this.foamRing.position.set(node.x, 0.61, -4.95);
        this.group.add(this.foamRing);
      } else if (i === 3) {
        // Cedar Ridge Bluff: sculpted Vancouver Island evergreen trees
        const treeCount = this.scaled(2);
        for (let t = 0; t < treeCount; t++) {
          const tree = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.18, 0.48, 7)), pineMat);
          tree.position.set(t === 0 ? -0.2 : 0.22, 0.28, -0.34);
          topGroup.add(tree);
          this.cedarFoliage.push(tree);
        }
      } else {
        // Point Beacon: striped coastal lighthouse + rotating amber lens
        const towerBase = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 10)), whitePaint);
        towerBase.position.set(0.12, 0.19, -0.32);
        topGroup.add(towerBase);

        const redBand = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 10)), crimsonPaint);
        redBand.position.set(0.12, 0.44, -0.32);
        topGroup.add(redBand);

        this.beaconMat = this.emissive(0xffe17a, 1.35);
        this.beaconLens = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 8)), this.beaconMat);
        this.beaconLens.position.set(0.12, 0.62, -0.32);
        topGroup.add(this.beaconLens);

        this.lighthouseBeam = new THREE.Group();
        this.lighthouseBeam.position.set(0.12, 0.62, -0.32);
        const cone = new THREE.Mesh(
          scope.track(new THREE.ConeGeometry(0.2, 0.85, 8)),
          scope.track(
            new THREE.MeshStandardMaterial({
              color: 0xffe488,
              emissive: 0xffd25a,
              emissiveIntensity: 0.9,
              transparent: true,
              opacity: 0.28,
              depthWrite: false,
            }),
          ),
        );
        cone.rotation.z = Math.PI / 2;
        cone.position.x = -0.45;
        this.lighthouseBeam.add(cone);
        topGroup.add(this.lighthouseBeam);
      }
    }

    // ── WestCat Character + Floating Speech Bubble (P037/P038 motif) ────────
    this.runnerGroup = new THREE.Group();
    this.runnerGroup.position.set(this.runnerX, this.runnerY, -4.7);
    const catFur = this.standard(0xe88a38, { emissive: 0x8c3c08, emissiveIntensity: 0.35, roughness: 0.55 });
    const catBelly = this.standard(0xf7dfc2, { roughness: 0.6 });

    const body = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.22, 0.24, 0.18)), catFur);
    body.position.y = 0.16;
    const head = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.24, 0.2, 0.2)), catFur);
    head.position.y = 0.38;
    const muzzle = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.16, 0.08, 0.06)), catBelly);
    muzzle.position.set(0, 0.34, 0.09);

    const earGeo = scope.track(new THREE.ConeGeometry(0.055, 0.11, 4));
    for (const ex of [-0.075, 0.075] as const) {
      const ear = new THREE.Mesh(earGeo, catFur);
      ear.position.set(ex, 0.52, 0);
      ear.rotation.y = Math.PI / 4;
      this.runnerGroup.add(ear);
    }

    const tail = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.06, 0.22, 0.06)), catFur);
    tail.position.set(-0.15, 0.24, -0.04);
    tail.rotation.z = 0.45;

    // Signature cat-and-speech-bubble emblem above WestCat
    this.speechBubble = new THREE.Group();
    this.speechBubble.position.set(0.24, 0.72, 0.04);
    this.speechRingMat = this.standard(0xfafcff, {
      emissive: 0x52f2ff,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });
    const bubbleBody = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.28, 0.16, 0.05)), this.speechRingMat);
    const bubbleTail = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.045, 0.08, 4)), this.speechRingMat);
    bubbleTail.position.set(-0.08, -0.1, 0);
    bubbleTail.rotation.z = Math.PI * 0.85;
    this.speechBubble.add(bubbleBody, bubbleTail);

    this.runnerGroup.add(body, head, muzzle, tail, this.speechBubble);
    this.group.add(this.runnerGroup);

    // ── Live Broadcast WESTCAT Overlay (P037: Opaque Obstacle vs Click-Through)
    this.overlayFrame = new THREE.Group();
    this.overlayFrame.position.set(0, 2.22, -3.45);

    this.overlayGlassMat = scope.track(
      new THREE.MeshStandardMaterial({
        color: 0x203548,
        emissive: 0x163854,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
        roughness: 0.25,
      }),
    );
    this.overlayGlass = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(5.15, 2.02)), this.overlayGlassMat);
    this.overlayFrame.add(this.overlayGlass);

    this.overlayRailMat = this.emissive(0xffaa3b, 1.1);
    for (const rx of [-2.52, 2.52] as const) {
      const rail = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.06, 2.02, 0.06)), this.overlayRailMat);
      rail.position.x = rx;
      this.overlayFrame.add(rail);
    }

    // Broadcast cards inside the always-on-top overlay (opaque obstacle vs ghost pass-through)
    this.cardMat = scope.track(
      new THREE.MeshStandardMaterial({
        color: 0x14202e,
        emissive: 0x223850,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    const pollCard = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.75, 0.72, 0.04)), this.cardMat);
    pollCard.position.set(1.42, 0.08, 0.02);
    this.overlayFrame.add(pollCard);

    const chatCard = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.65, 0.72, 0.04)), this.cardMat);
    chatCard.position.set(-1.45, 0.08, 0.02);
    this.overlayFrame.add(chatCard);

    const chatLabel = buildLabel(scope, 'CAT SPEECH · PRODUCER SAFE', 1.45, 0.15);
    chatLabel.position.set(-1.45, 0.28, 0.05);
    this.overlayFrame.add(chatLabel);

    const bubbleSample = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.95, 0.18, 0.04)), this.emissive(0x6fd8ff, 0.75));
    bubbleSample.position.set(-1.45, -0.04, 0.05);
    this.overlayFrame.add(bubbleSample);

    // Live Poll meter bar (physically spikes when misclick hits overlay!)
    this.pollBarMat = this.emissive(0x52f2ff, 1.15);
    this.pollBarFill = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.3, 0.14, 0.06)), this.pollBarMat);
    this.pollBarFill.position.set(1.42, -0.02, 0.05);
    this.overlayFrame.add(this.pollBarFill);

    this.pollLabel = buildLabel(scope, 'LIVE POLL · CLICK STEALS FOCUS', 1.55, 0.15);
    this.pollLabel.position.set(1.42, 0.28, 0.06);
    this.overlayFrame.add(this.pollLabel);

    const reposText = FRAGMENTED_REPOS.join(' · ');
    const repoBadge = buildLabel(scope, reposText, 4.1, 0.13);
    repoBadge.position.set(0, -0.64, 0.04);
    this.overlayFrame.add(repoBadge);

    this.overlayHeader = buildLabel(scope, 'OPAQUE OVERLAY · BLOCKS INPUT', 3.4, 0.16);
    this.overlayHeader.position.set(0, 0.82, 0.04);
    this.overlayFrame.add(this.overlayHeader);

    // Pass-through cursor beam visible ONLY in click-through mode
    this.passRayMat = this.emissive(0x58f7ff, 1.45);
    this.passThroughRay = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 8)), this.passRayMat);
    this.passThroughRay.rotation.x = Math.PI * 0.36;
    this.passThroughRay.position.set(0, -0.1, -0.68);
    this.passThroughRay.visible = false;
    this.overlayFrame.add(this.passThroughRay);

    this.overlayFrame.visible = false;
    this.group.add(this.overlayFrame);

    // ── Console at z = -1.95 (safely clear of PLINTH_BOX) ────────────────────
    const consoleGroup = buildConsole(scope, 2.55, 0.7, 1.0, mapSlate);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    this.foldLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xffe17a, 1.2) });
    this.foldLever.group.position.set(-0.94, 1.03, -1.93);
    this.group.add(this.foldLever.group);
    const foldLbl = buildLabel(scope, 'CARTRIDGE', 0.5, 0.28);
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

    // ── 5 Accessible Controls ─────────────────────────────────────────────────
    this.control({
      object: this.foldLever.group,
      label: () => (this.state.mode === 'cartridge' ? 'Unfold Back to Diorama' : 'Fold into Cartridge'),
      description:
        'Transform the Vancouver Island coastal relief into a quantized 5-stage 16-bit cartridge while locking horizontal jumps to the real tidal cuts.',
      activate: () => {
        this.state = toggleCartridgeMode(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.overlayLever.group,
      label: () =>
        `WESTCAT Overlay (${
          this.state.overlay === 'off'
            ? 'OFF'
            : this.state.overlay === 'blocking'
              ? 'OPAQUE [BLOCKS]'
              : 'CLICK-THROUGH'
        })`,
      description:
        'Cycle the always-on-top P037 broadcast overlay: Off -> Opaque (blocks controls onto live poll) -> Click-Through (passes input cleanly).',
      activate: () => {
        this.state = cycleOverlayMode(this.state);
        this.misclickFlashT = 0;
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: stepPuck,
      label: () => (this.state.mode === 'cartridge' ? 'Step Forward' : 'Survey Next Landmark'),
      description:
        'Move WestCat across adjacent coastal stages. Blocked by Opaque overlay unless Click-Through is active; tidal channels require Leap.',
      activate: () => {
        this.state = moveRunnerStep(this.state, false);
        this.jumping = false;
        if (this.state.lastInputBlocked && !this.reducedMotion) {
          this.misclickFlashT = 1.0;
        }
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: leapPuck,
      label: () => `Leap Gap (${this.state.leapsUsed} jumps)`,
      description:
        'Jump WestCat across the Tidal Narrows or to Point Beacon. Blocked if the WESTCAT overlay is set Opaque.',
      activate: () => {
        this.state = moveRunnerStep(this.state, true);
        if (this.state.lastInputBlocked) {
          if (!this.reducedMotion) this.misclickFlashT = 1.0;
        } else if (this.state.mode === 'cartridge' && !this.reducedMotion) {
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
      description: 'Collapse back to coastal diorama, hide overlay, and return WestCat to Island Timber Pier.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E26 back to Vancouver Island coastal diorama.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    this.foldLever.value = this.state.mode === 'cartridge' ? 1 : 0;
    this.overlayLever.value = this.state.overlay === 'off' ? 0 : this.state.overlay === 'blocking' ? 1 : 2;

    this.overlayFrame.visible = this.state.overlay !== 'off';
    const isBlocking = this.state.overlay === 'blocking';
    const isPass = this.state.overlay === 'click_through';

    if (isBlocking) {
      if (this.state.lastInputBlocked) {
        this.overlayGlassMat.color.setHex(0x6e202c);
        this.overlayGlassMat.emissive.setHex(0xb82438);
        this.overlayRailMat.emissive.setHex(0xff5263);
        this.pollBarMat.emissive.setHex(0xff5e6c);
        this.speechRingMat.emissive.setHex(0xff4757);
        updateLabel(
          scope,
          this.overlayHeader,
          `MISCLICK ON AIR (POLL+${this.state.pollClicks}) · BLOCKED`,
        );
      } else {
        this.overlayGlassMat.color.setHex(0x203548);
        this.overlayGlassMat.emissive.setHex(0x183f61);
        this.overlayRailMat.emissive.setHex(0xffaa3b);
        this.pollBarMat.emissive.setHex(0xffb44c);
        this.speechRingMat.emissive.setHex(0x52f2ff);
        updateLabel(scope, this.overlayHeader, 'OPAQUE OVERLAY · BLOCKS INPUT');
      }
      this.overlayGlassMat.opacity = 0.72;
      this.cardMat.opacity = 0.88;
      this.cardMat.emissiveIntensity = 0.85;
      this.passThroughRay.visible = false;
      updateLabel(scope, this.pollLabel, 'LIVE POLL · CLICK STEALS FOCUS');
    } else if (isPass) {
      this.overlayGlassMat.color.setHex(0x2ae3ff);
      this.overlayGlassMat.emissive.setHex(0x169cc4);
      this.overlayGlassMat.opacity = 0.16;
      this.cardMat.opacity = 0.22;
      this.cardMat.emissiveIntensity = 0.25;
      this.overlayRailMat.emissive.setHex(0x52f2ff);
      this.pollBarMat.emissive.setHex(0x52f2ff);
      this.speechRingMat.emissive.setHex(0x52f2ff);
      this.passThroughRay.visible = true;
      updateLabel(scope, this.pollLabel, 'LIVE POLL · PASS-THROUGH SAFE');
      updateLabel(scope, this.overlayHeader, 'CLICK-THROUGH · PASSES INPUT');
    }

    const pollScale = Math.min(1.0, 0.25 + this.state.pollClicks * 0.18);
    this.pollBarFill.scale.x = pollScale;

    this.beaconMat.emissive.setHex(this.state.goalReached ? 0x62ff96 : 0xffe17a);
    this.beaconMat.emissiveIntensity = this.state.goalReached ? 2.2 : 1.25;

    const node = COURSE_NODES[this.state.runnerIndex] ?? COURSE_NODES[0];
    const ovTag =
      this.state.overlay === 'off'
        ? 'OFF'
        : this.state.overlay === 'blocking'
          ? `BLOCKING (MISCLICKS ${this.state.misclicksBlocked})`
          : 'CLICK-THROUGH';
    updateLabel(
      scope,
      this.headerReadout,
      `${this.state.mode.toUpperCase()} · OVERLAY ${ovTag} · ${node.label.toUpperCase()} · CLEARS ${this.state.clears}`,
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

    // Morph coastal landmarks vertically & crisp up 16-bit ledges when folded
    for (let i = 0; i < COURSE_NODES.length; i++) {
      const node = COURSE_NODES[i];
      const h = node.dioramaY + (node.cartridgeY - node.dioramaY) * this.foldBlend;
      this.blockHeights[i] = h;
      this.blocks[i].scale.y = h;
      this.blocks[i].position.y = SURFACE_BASE_Y + h * 0.5;
      this.nodeTopGroups[i].position.y = SURFACE_BASE_Y + h;

      const capMat = this.capMats[i];
      capMat.emissiveIntensity = 0.12 + this.foldBlend * 0.68;
      this.ledgeCaps[i].scale.set(0.94 + this.foldBlend * 0.1, 0.75 + this.foldBlend * 0.75, 1);
    }

    // Retract cedar cones slightly on cartridge quantize so platform tops read crisp
    for (let t = 0; t < this.cedarFoliage.length; t++) {
      const tree = this.cedarFoliage[t];
      const treeScale = 1 - this.foldBlend * 0.35;
      tree.scale.set(treeScale, treeScale, treeScale);
    }

    // Slide cartridge gold connector pins forward when in Cartridge mode
    this.pinGroup.position.z = -3.86 + this.foldBlend * 0.22;

    if (!instant) {
      this.orbitPhase += dt;
      if (this.lighthouseBeam) {
        this.lighthouseBeam.rotation.y = this.orbitPhase * 1.4;
      }
      if (this.foamRing) {
        const pulse = 1 + Math.sin(this.orbitPhase * 3.0) * 0.08;
        this.foamRing.scale.set(pulse, pulse, 1);
      }
      this.speechBubble.position.y = 0.72 + Math.sin(this.orbitPhase * 2.8) * 0.03;
      if (this.misclickFlashT > 0) {
        this.misclickFlashT = Math.max(0, this.misclickFlashT - dt * 1.8);
        this.overlayRailMat.emissiveIntensity = 1.1 + this.misclickFlashT * 1.8;
      } else {
        this.overlayRailMat.emissiveIntensity = 1.1;
      }
    }

    const targetNode = COURSE_NODES[this.state.runnerIndex] ?? COURSE_NODES[0];
    const targetX = targetNode.x;
    const groundY = SURFACE_BASE_Y + this.blockHeights[this.state.runnerIndex] + 0.06;
    let arcLift = 0;
    if (this.jumping) {
      this.jumpArcT += dt * 3.0;
      if (this.jumpArcT >= 1) {
        this.jumping = false;
        this.jumpArcT = 0;
      } else {
        arcLift = Math.sin(this.jumpArcT * Math.PI) * 0.62;
      }
    }

    if (instant) {
      this.runnerX = targetX;
      this.runnerY = groundY;
    } else {
      this.runnerX += (targetX - this.runnerX) * Math.min(1, dt * 8);
      this.runnerY += (groundY - this.runnerY) * Math.min(1, dt * 10);
    }

    this.runnerGroup.position.set(this.runnerX, this.runnerY + arcLift, -4.68);
    if (this.passThroughRay.visible) {
      this.passThroughRay.position.x = this.runnerX * 0.65;
    }
  }

  protected override onReset(): void {
    this.state = createInitialCartridgeState();
    this.foldBlend = 0;
    this.jumping = false;
    this.jumpArcT = 0;
    this.misclickFlashT = 0;
    this.runnerX = COURSE_NODES[0].x;
    this.runnerY = SURFACE_BASE_Y + COURSE_NODES[0].dioramaY + 0.06;
    if (this.built) {
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    const node = COURSE_NODES[this.state.runnerIndex] ?? COURSE_NODES[0];
    return (
      `Mode=${this.state.mode}, Overlay=${this.state.overlay} ` +
      `(${this.state.overlay === 'blocking' ? 'blocks input -> misclick on air' : this.state.overlay === 'click_through' ? 'passes input through' : 'hidden'}), ` +
      `Stage=${node.index + 1}/${COURSE_NODES.length} (${node.label}), ` +
      `Clears=${this.state.clears}, Slips=${this.state.slips}, MisclicksBlocked=${this.state.misclicksBlocked}, Goal=${this.state.goalReached}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new RealityCartridgeExhibit(def);
}
