import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Dial, Filament, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  createInitialFramingState,
  cycleEmphasis,
  cyclePinnedObservation,
  FRAME_HEADLINES,
  SHARED_OBSERVATIONS,
  toggleDissolveToSource,
  toggleStripInferences,
  type FramingState,
} from './model';

const LOG_ROW_YS = [1.38, 1.88, 2.38] as const;

export class HeadlineTwoCitiesExhibit extends ExhibitBase {
  private state: FramingState = createInitialFramingState();

  private cityAGroup!: THREE.Group;
  private cityBGroup!: THREE.Group;
  private framingColonnadeA!: THREE.Group;
  private framingColonnadeB!: THREE.Group;
  private cityACourses = this.tracked<THREE.MeshStandardMaterial>();
  private cityBCourses = this.tracked<THREE.MeshStandardMaterial>();
  private cityAInferences = this.tracked<THREE.Mesh>();
  private cityBInferences = this.tracked<THREE.Mesh>();
  private sourcePips = this.tracked<THREE.MeshStandardMaterial>();
  private tethersA = this.tracked<Filament>();
  private tethersB = this.tracked<Filament>();

  private scannerLensGroup!: THREE.Group;
  private scannerBeamMat!: THREE.MeshStandardMaterial;

  private emphasisDial!: Dial;
  private pinDial!: Dial;
  private stripLever!: Lever;
  private dissolveLever!: Lever;

  private headlineALabel!: THREE.Mesh;
  private headlineBLabel!: THREE.Mesh;
  private spanTagA!: THREE.Mesh;
  private spanTagB!: THREE.Mesh;
  private statusReadout!: THREE.Mesh;

  private cityAX = -2.1;
  private cityBX = 2.1;
  private frameAScale = 1.0;
  private frameBScale = 1.0;
  private lensY = 1.88;
  private infPhase = 0;

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpMid = new THREE.Vector3();
  private readonly curve = new THREE.QuadraticBezierCurve3(this.tmpA, this.tmpMid, this.tmpB);

  protected override build(): void {
    const scope = this.ctx.scope;
    const bronze = this.standard(0x9a7b42, { roughness: 0.4, metalness: 0.65 });
    const slate = this.standard(0x1f2430, { roughness: 0.78 });
    const bedrockStone = this.standard(0x525763, { roughness: 0.85 });
    const frameAMat = this.standard(0xd9923b, { emissive: 0x522a08, emissiveIntensity: 0.3, roughness: 0.48 });
    const frameBMat = this.standard(0x4c82b8, { emissive: 0x0c2848, emissiveIntensity: 0.3, roughness: 0.48 });
    const inferenceAMat = scope.track(
      new THREE.MeshStandardMaterial({
        color: 0xffc46b,
        emissive: 0xff8f24,
        emissiveIntensity: 1.05,
        transparent: true,
        opacity: 0.82,
        roughness: 0.25,
      }),
    );
    const inferenceBMat = scope.track(
      new THREE.MeshStandardMaterial({
        color: 0x7ec2ff,
        emissive: 0x3b8eff,
        emissiveIntensity: 1.05,
        transparent: true,
        opacity: 0.82,
        roughness: 0.25,
      }),
    );

    // ── Shared Center Foundation Plinth (z = -5.0, clear of PLINTH_BOX) ───────
    const plinthBase = this.mesh(new THREE.BoxGeometry(5.8, 0.34, 2.35), slate);
    plinthBase.position.set(0, 0.17, -5.0);

    const centralLedger = this.mesh(new THREE.BoxGeometry(1.48, 0.64, 1.38), bronze);
    centralLedger.position.set(0, 0.66, -5.0);

    const ledgerHeader = buildLabel(scope, 'IMMUTABLE SOURCE LOGS (3)', 1.48, 0.18);
    ledgerHeader.position.set(0, 2.92, -4.46);
    this.group.add(ledgerHeader);

    // 3 Spaced Immutable Source Observation Slabs (y = 1.38, 1.88, 2.38 — zero collisions!)
    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const obs = SHARED_OBSERVATIONS[i];
      const y = LOG_ROW_YS[i];
      const pipMat = this.emissive(0xffe7a8, 1.15);
      this.sourcePips.push(pipMat);
      const pip = this.mesh(new THREE.BoxGeometry(1.06, 0.18, 0.92), pipMat);
      pip.position.set(0, y, -5.0);

      const obsLbl = buildLabel(scope, `${obs.timestamp} · ${obs.metric}`, 1.38, 0.17);
      obsLbl.position.set(0, y, -4.46);
      this.group.add(obsLbl);
    }

    // Back Instrument Arch
    const archBack = this.mesh(new THREE.BoxGeometry(5.8, 0.18, 0.18), slate);
    archBack.position.set(0, 4.24, -5.95);
    for (const ax of [-2.75, 2.75] as const) {
      const pillar = this.mesh(new THREE.BoxGeometry(0.18, 4.02, 0.18), slate);
      pillar.position.set(ax, 2.21, -5.95);
    }

    // ── Rhetorical InDEX Horizontal Scanner Lens (tight aperture per row) ──
    this.scannerLensGroup = new THREE.Group();
    this.scannerLensGroup.position.set(0, LOG_ROW_YS[1], -4.42);
    this.scannerBeamMat = scope.track(
      new THREE.MeshStandardMaterial({
        color: 0xb995db,
        emissive: 0x9968d9,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    const reticleGlow = this.emissive(0xb995db, 1.3);
    for (const ry of [-0.17, 0.17] as const) {
      const rail = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.56, 0.03, 0.04)), reticleGlow);
      rail.position.set(0, ry, 0.04);
      this.scannerLensGroup.add(rail);
    }
    for (const rx of [-0.76, 0.76] as const) {
      const cap = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.035, 0.36, 0.04)), reticleGlow);
      cap.position.set(rx, 0, 0.04);
      this.scannerLensGroup.add(cap);
    }
    const scanBar = new THREE.Mesh(scope.track(new THREE.BoxGeometry(4.8, 0.04, 0.03)), this.scannerBeamMat);
    this.scannerLensGroup.add(scanBar);
    this.group.add(this.scannerLensGroup);

    // ── City A (Left) & City B (Right): 3-Stratum Rhetorical Architecture ───
    const pillarCount = this.scaled(4);

    // City A: Amber Civic Tribune
    this.cityAGroup = new THREE.Group();
    this.cityAGroup.position.set(this.cityAX, 0.34, -5.0);
    // Stratum 1: Evidence Bedrock (3 courses, never exaggerated)
    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const cMat = this.standard(0x6d5f4c, { emissive: 0xd9923b, emissiveIntensity: 0.2, roughness: 0.72 });
      this.cityACourses.push(cMat);
      const course = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.52 - i * 0.08, 0.24, 1.28)), cMat);
      course.position.y = 0.14 + i * 0.27;
      this.cityAGroup.add(course);
    }
    // Stratum 2: Framing Colonnade + Cornice (scales under Emphasis, retracts on Dissolve)
    this.framingColonnadeA = new THREE.Group();
    this.framingColonnadeA.position.y = 0.92;
    const plinthA = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.26, 0.14, 1.04)), frameAMat);
    plinthA.position.y = 0.07;
    this.framingColonnadeA.add(plinthA);
    for (let p = 0; p < pillarCount; p++) {
      const px = pillarCount === 1 ? 0 : -0.42 + (p / (pillarCount - 1)) * 0.84;
      const col = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 8)), frameAMat);
      col.position.set(px, 0.66, 0.26);
      const backCol = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 8)), frameAMat);
      backCol.position.set(px, 0.66, -0.26);
      this.framingColonnadeA.add(col, backCol);
    }
    const corniceA = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.36, 0.22, 1.1)), frameAMat);
    corniceA.position.y = 1.28;
    this.framingColonnadeA.add(corniceA);

    // Stratum 3: Floating Unsupported Inference Obelisks (un-tethered!)
    for (let i = 0; i < 2; i++) {
      const inf = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.24, 0)), inferenceAMat);
      inf.scale.set(0.85, 2.05, 0.85);
      inf.position.set(i === 0 ? -0.36 : 0.36, 1.98, 0);
      this.cityAInferences.push(inf);
      this.framingColonnadeA.add(inf);
    }
    this.cityAGroup.add(this.framingColonnadeA);
    this.group.add(this.cityAGroup);

    this.headlineALabel = buildLabel(scope, FRAME_HEADLINES.balanced.a, 2.05, 0.21);
    this.headlineALabel.position.set(-2.1, 3.92, -5.0);
    this.group.add(this.headlineALabel);

    this.spanTagA = buildLabel(scope, 'MOVES: EVIDENCE + FRAMING + INFERENCE', 1.85, 0.15);
    this.spanTagA.position.set(-2.1, 1.32, -4.18);
    this.group.add(this.spanTagA);

    // City B: Steel-Blue Inquiry Bastion
    this.cityBGroup = new THREE.Group();
    this.cityBGroup.position.set(this.cityBX, 0.34, -5.0);
    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const cMat = this.standard(bedrockStone.color.getHex(), {
        emissive: 0x4c82b8,
        emissiveIntensity: 0.2,
        roughness: 0.72,
      });
      this.cityBCourses.push(cMat);
      const course = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.52 - i * 0.08, 0.24, 1.28)), cMat);
      course.position.y = 0.14 + i * 0.27;
      this.cityBGroup.add(course);
    }
    this.framingColonnadeB = new THREE.Group();
    this.framingColonnadeB.position.y = 0.92;
    const plinthB = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.26, 0.14, 1.04)), frameBMat);
    plinthB.position.y = 0.07;
    this.framingColonnadeB.add(plinthB);
    for (let p = 0; p < pillarCount; p++) {
      const px = pillarCount === 1 ? 0 : -0.42 + (p / (pillarCount - 1)) * 0.84;
      const buttress = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.18, 1.05, 0.22)), frameBMat);
      buttress.position.set(px, 0.66, 0.26);
      const backButtress = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.18, 1.05, 0.22)), frameBMat);
      backButtress.position.set(px, 0.66, -0.26);
      this.framingColonnadeB.add(buttress, backButtress);
    }
    const corniceB = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.36, 0.22, 1.1)), frameBMat);
    corniceB.position.y = 1.28;
    this.framingColonnadeB.add(corniceB);

    for (let i = 0; i < 2; i++) {
      const inf = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.28, 0.88, 0.28)), inferenceBMat);
      inf.position.set(i === 0 ? -0.36 : 0.36, 1.98, 0);
      this.cityBInferences.push(inf);
      this.framingColonnadeB.add(inf);
    }
    this.cityBGroup.add(this.framingColonnadeB);
    this.group.add(this.cityBGroup);

    this.headlineBLabel = buildLabel(scope, FRAME_HEADLINES.balanced.b, 2.05, 0.21);
    this.headlineBLabel.position.set(2.1, 3.92, -5.0);
    this.group.add(this.headlineBLabel);

    this.spanTagB = buildLabel(scope, 'MOVES: FRAMING + INFERENCE + BLAME', 1.85, 0.15);
    this.spanTagB.position.set(2.1, 1.32, -4.18);
    this.group.add(this.spanTagB);

    // Bilateral Evidence Filaments linking each central source slab -> exact bedrock course
    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const ySrc = LOG_ROW_YS[i];
      const yDst = 0.48 + i * 0.27;
      const fa = new Filament(scope, 8, 0.018, this.emissive(0xffc96b, 1.1));
      this.tmpA.set(-0.54, ySrc, -5.0);
      this.tmpB.set(-1.38, yDst, -5.0);
      this.tmpMid.set(-0.96, Math.max(ySrc, yDst) + 0.15, -5.0);
      fa.follow(this.curve);
      this.tethersA.push(fa);
      this.group.add(fa.group);

      const fb = new Filament(scope, 8, 0.018, this.emissive(0x6ec3ff, 1.1));
      this.tmpA.set(0.54, ySrc, -5.0);
      this.tmpB.set(1.38, yDst, -5.0);
      this.tmpMid.set(0.96, Math.max(ySrc, yDst) + 0.15, -5.0);
      fb.follow(this.curve);
      this.tethersB.push(fb);
      this.group.add(fb.group);
    }

    // Status Banner cleanly above arch
    this.statusReadout = buildLabel(scope, 'EMPHASIS: BALANCED · INFERENCES VISIBLE · 3 IMMUTABLE LOGS', 3.9, 0.16);
    this.statusReadout.position.set(0, 4.56, -5.9);
    this.group.add(this.statusReadout);

    // ── Console at z = -1.95 (clear of plinth) ──────────────────────────────
    const consoleGroup = buildConsole(scope, 2.55, 0.7, 1.0, slate);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    this.emphasisDial = new Dial(scope, 3, 0.2, { handle: this.emissive(0xffaa42, 1.05) });
    this.emphasisDial.group.position.set(-0.94, 1.03, -1.93);
    this.group.add(this.emphasisDial.group);
    const empLbl = buildLabel(scope, 'EMPHASIS', 0.46, 0.28);
    empLbl.position.set(-0.94, 1.14, -1.64);
    empLbl.rotation.x = -0.35;
    this.group.add(empLbl);

    this.pinDial = new Dial(scope, 4, 0.2, { handle: this.emissive(0xb995db, 1.1) });
    this.pinDial.group.position.set(-0.38, 1.03, -1.93);
    this.group.add(this.pinDial.group);
    const pinLbl = buildLabel(scope, 'LENS ROW', 0.46, 0.28);
    pinLbl.position.set(-0.38, 1.14, -1.64);
    pinLbl.rotation.x = -0.35;
    this.group.add(pinLbl);

    this.stripLever = new Lever(scope, 2, 0.36, { arm: bronze });
    this.stripLever.group.position.set(0.22, 1.03, -1.93);
    this.group.add(this.stripLever.group);
    const strLbl = buildLabel(scope, 'STRIP INF', 0.46, 0.28);
    strLbl.position.set(0.22, 1.14, -1.64);
    strLbl.rotation.x = -0.35;
    this.group.add(strLbl);

    this.dissolveLever = new Lever(scope, 2, 0.36, { arm: this.emissive(0xffe7a8, 1.1) });
    this.dissolveLever.group.position.set(0.76, 1.03, -1.93);
    this.group.add(this.dissolveLever.group);
    const disLbl = buildLabel(scope, 'DISSOLVE', 0.46, 0.28);
    disLbl.position.set(0.76, 1.14, -1.64);
    disLbl.rotation.x = -0.35;
    this.group.add(disLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 12), bronze);
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
      object: this.emphasisDial.group,
      label: () => `Shift Framing (${this.state.emphasis.toUpperCase()})`,
      description: 'Shift framing colonnades between Balanced, City A (Rescue), and City B (Failure) while bedrock stays equal.',
      activate: () => {
        this.state = cycleEmphasis(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.pinDial.group,
      label: () => `Pin Evidence (${this.state.pinned})`,
      description: 'Sweep optical InDEX reticle across 08:00, 08:04, or 08:09 to reveal how opposite stories classify the exact same fact.',
      activate: () => {
        this.state = cyclePinnedObservation(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.stripLever.group,
      label: () => (this.state.inferencesStripped ? 'Inferences: STRIPPED' : 'Strip Unsupported Inferences'),
      description: 'Remove untethered inference spires perched above both framing cornices.',
      activate: () => {
        this.state = toggleStripInferences(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: this.dissolveLever.group,
      label: () => (this.state.dissolvedToSource ? 'Restore Divergent Frames' : 'Dissolve to Shared Source'),
      description: 'Retract both framing colonnades onto the shared bedrock so only the 3 immutable logs remain.',
      activate: () => {
        this.state = toggleDissolveToSource(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAction);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Framing',
      description: 'Restore balanced dual cities and optical lens over the unmodified harbor logs.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E12 narrative cities cleanly.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    const empIdx = ['balanced', 'frameA', 'frameB'].indexOf(this.state.emphasis);
    const pinIdx = ['all', 'obs_flow', 'obs_seal', 'obs_bypass'].indexOf(this.state.pinned);

    this.emphasisDial.value = Math.max(0, empIdx);
    this.pinDial.value = Math.max(0, pinIdx);
    this.stripLever.value = this.state.inferencesStripped ? 1 : 0;
    this.dissolveLever.value = this.state.dissolvedToSource ? 1 : 0;

    const showInf = !this.state.inferencesStripped && !this.state.dissolvedToSource;
    for (const m of this.cityAInferences) m.visible = showInf;
    for (const m of this.cityBInferences) m.visible = showInf;

    for (let i = 0; i < SHARED_OBSERVATIONS.length; i++) {
      const obs = SHARED_OBSERVATIONS[i];
      const active = this.state.pinned === 'all' || this.state.pinned === obs.id;
      this.sourcePips[i].emissiveIntensity = active ? 1.85 : 0.35;
      this.cityACourses[i].emissiveIntensity = active ? 1.05 : 0.15;
      this.cityBCourses[i].emissiveIntensity = active ? 1.05 : 0.15;
      this.tethersA[i].setVisible(active);
      this.tethersB[i].setVisible(active);
    }

    this.headlineALabel.visible = !this.state.dissolvedToSource;
    this.headlineBLabel.visible = !this.state.dissolvedToSource;

    const headlines = FRAME_HEADLINES[this.state.emphasis];
    updateLabel(scope, this.headlineALabel, headlines.a);
    updateLabel(scope, this.headlineBLabel, headlines.b);

    const pinnedObs =
      this.state.pinned === 'all'
        ? null
        : SHARED_OBSERVATIONS.find((o) => o.id === this.state.pinned) ?? null;

    if (this.state.dissolvedToSource) {
      updateLabel(scope, this.spanTagA, 'BEDROCK ONLY · SHARED SOURCE');
      updateLabel(scope, this.spanTagB, 'BEDROCK ONLY · SHARED SOURCE');
    } else if (pinnedObs) {
      updateLabel(scope, this.spanTagA, `${pinnedObs.moveA.toUpperCase()}: ${pinnedObs.framingA}`);
      updateLabel(scope, this.spanTagB, `${pinnedObs.moveB.toUpperCase()}: ${pinnedObs.framingB}`);
    } else {
      updateLabel(
        scope,
        this.spanTagA,
        this.state.inferencesStripped ? 'FRAMING ONLY · INFERENCE STRIPPED' : 'EVIDENCE + FRAMING + INFERENCE',
      );
      updateLabel(
        scope,
        this.spanTagB,
        this.state.inferencesStripped ? 'FRAMING ONLY · INFERENCE STRIPPED' : 'EVIDENCE + INTERPRETATION + INFERENCE',
      );
    }

    const status = this.state.dissolvedToSource
      ? 'DISSOLVED TO SHARED SOURCE · IDENTICAL 3 LOGS REMAIN'
      : pinnedObs
        ? `LENS ON ${pinnedObs.timestamp} (${pinnedObs.metric}) · A[${pinnedObs.moveA.toUpperCase()}] vs B[${pinnedObs.moveB.toUpperCase()}]`
        : `EMPHASIS: ${this.state.emphasis.toUpperCase()} · PIN: ALL · ${this.state.inferencesStripped ? 'INFERENCES STRIPPED' : 'WITH INFERENCES'}`;
    updateLabel(scope, this.statusReadout, status);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    this.emphasisDial.update(dt, instant);
    this.pinDial.update(dt, instant);
    this.stripLever.update(dt, instant);
    this.dissolveLever.update(dt, instant);

    // Non-clipping dissolution: slide gently toward center pedestals while clearing central ledger (-0.74..0.74)
    const targetAX = this.state.dissolvedToSource ? -1.68 : -2.1;
    const targetBX = this.state.dissolvedToSource ? 1.68 : 2.1;
    const targetAScale = this.state.dissolvedToSource
      ? 0.03
      : this.state.emphasis === 'frameA'
        ? 1.24
        : this.state.emphasis === 'frameB'
          ? 0.78
          : 1.0;
    const targetBScale = this.state.dissolvedToSource
      ? 0.03
      : this.state.emphasis === 'frameB'
        ? 1.24
        : this.state.emphasis === 'frameA'
          ? 0.78
          : 1.0;

    const pinIdx =
      this.state.pinned === 'obs_flow'
        ? 0
        : this.state.pinned === 'obs_seal'
          ? 1
          : this.state.pinned === 'obs_bypass'
            ? 2
            : 1;
    const targetLensY = LOG_ROW_YS[pinIdx];

    if (instant) {
      this.cityAX = targetAX;
      this.cityBX = targetBX;
      this.frameAScale = targetAScale;
      this.frameBScale = targetBScale;
      this.lensY = targetLensY;
    } else {
      const k = Math.min(1, dt * 7);
      this.cityAX += (targetAX - this.cityAX) * k;
      this.cityBX += (targetBX - this.cityBX) * k;
      this.frameAScale += (targetAScale - this.frameAScale) * k;
      this.frameBScale += (targetBScale - this.frameBScale) * k;
      this.lensY += (targetLensY - this.lensY) * k;

      this.infPhase += dt;
      const hover = Math.sin(this.infPhase * 2.4) * 0.04;
      for (let i = 0; i < this.cityAInferences.length; i++) {
        this.cityAInferences[i].position.y = 1.98 + hover;
        this.cityBInferences[i].position.y = 1.98 - hover;
      }
    }

    this.cityAGroup.position.x = this.cityAX;
    this.cityBGroup.position.x = this.cityBX;
    this.framingColonnadeA.scale.y = this.frameAScale;
    this.framingColonnadeB.scale.y = this.frameBScale;
    this.scannerLensGroup.position.y = this.lensY;
    this.scannerBeamMat.opacity = this.state.pinned === 'all' ? 0.18 : 0.42;
  }

  protected override onReset(): void {
    this.state = createInitialFramingState();
    this.cityAX = -2.1;
    this.cityBX = 2.1;
    this.frameAScale = 1.0;
    this.frameBScale = 1.0;
    this.lensY = LOG_ROW_YS[1];
    if (this.built) {
      this.cityAGroup.position.x = -2.1;
      this.cityBGroup.position.x = 2.1;
      this.framingColonnadeA.scale.y = 1.0;
      this.framingColonnadeB.scale.y = 1.0;
      this.scannerLensGroup.position.y = LOG_ROW_YS[1];
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    return (
      `Emphasis=${this.state.emphasis}, Pinned=${this.state.pinned}, ` +
      `InferencesStripped=${this.state.inferencesStripped}, Dissolved=${this.state.dissolvedToSource}, ` +
      `SourceLogs=${this.state.observations.length} (immutable).`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new HeadlineTwoCitiesExhibit(def);
}
