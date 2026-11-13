import * as THREE from 'three';
import { ExhibitBase } from '../../../../src/exhibits/ExhibitBase';
import { buildLabel, buildLectern, buildPlaque, updateLabel } from '../../../../src/exhibits/Furniture';
import { buildConsole, Lever } from '../../../../src/exhibits/parts';
import type { ExhibitDefinition, ExhibitModule, ExhibitUpdateContext } from '../../../../src/exhibits/contract';
import {
  assembleSafePlan,
  countAuditedGates,
  createInitialCleanupState,
  SYNTHETIC_BINS,
  toggleAuditGate,
  TOTAL_SYNTHETIC_CLAIMED_MB,
  type CleanupAuditState,
} from './model';

const BENCH_TOP_Y = 1.16;
const MAX_SILO_H = 1.92;

export class ImpossibleCleanupExhibit extends ExhibitBase {
  private state: CleanupAuditState = createInitialCleanupState();

  private claimShells = this.tracked<THREE.Mesh>();
  private claimShellMats = this.tracked<THREE.MeshStandardMaterial>();
  private safeCaps = this.tracked<THREE.Mesh>();
  private safeCapMats = this.tracked<THREE.MeshStandardMaterial>();
  private regenCoils = this.tracked<THREE.Mesh>();
  private claimHeights = new Float32Array(SYNTHETIC_BINS.length);
  private shellBlends = new Float32Array(SYNTHETIC_BINS.length);

  private headlineBar!: THREE.Mesh;
  private headlineBarMat!: THREE.MeshStandardMaterial;
  private protectedBar!: THREE.Mesh;
  private deletePlateMat!: THREE.MeshStandardMaterial;

  private levers = this.tracked<Lever>();
  private meterLabel!: THREE.Mesh;
  private planLabel!: THREE.Mesh;

  private headlineHeightCurrent = 1.92;
  private protectedHeightCurrent = 0.08;
  private refusalFlashT = 0;
  private pulsePhase = 0;

  protected override build(): void {
    const scope = this.ctx.scope;
    const slate = this.standard(0x1f252e, { roughness: 0.78 });
    const steel = this.standard(0x525e6b, { roughness: 0.42, metalness: 0.65 });
    const brass = this.standard(0xc99c46, { roughness: 0.36, metalness: 0.72 });
    const coreBronze = this.standard(0x9e632b, {
      emissive: 0x3b1f07,
      emissiveIntensity: 0.28,
      roughness: 0.55,
      metalness: 0.45,
    });
    const redSeal = this.standard(0x8c2a2a, { roughness: 0.5 });

    // ── Elevated Industrial Lab Workbench (y_top = 1.16, above console!) ────
    const benchTop = this.mesh(new THREE.BoxGeometry(5.6, 0.14, 2.25), slate);
    benchTop.position.set(0, BENCH_TOP_Y - 0.07, -5.0);

    for (const lx of [-2.55, 2.55] as const) {
      for (const lz of [-5.92, -4.08] as const) {
        const leg = this.mesh(new THREE.BoxGeometry(0.16, BENCH_TOP_Y - 0.14, 0.16), steel);
        leg.position.set(lx, (BENCH_TOP_Y - 0.14) * 0.5, lz);
      }
    }

    const wallBack = this.mesh(new THREE.BoxGeometry(5.7, 2.95, 0.16), slate);
    wallBack.position.set(0, 2.45, -6.18);

    const xs = [-2.08, -1.04, 0.0, 1.04] as const;
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      const bin = SYNTHETIC_BINS[i];
      const claimH = 0.48 + (bin.claimedMB / 24_000) * 1.44;
      const lockedFrac = bin.nonReclaimableMB / bin.claimedMB;
      const lockedH = Math.max(0.24, claimH * lockedFrac);
      const safeH = Math.max(0.14, claimH - lockedH);
      this.claimHeights[i] = claimH;
      this.shellBlends[i] = 1.0;

      // ── Physical Internal Trap Assembly (never shrinks when audited!) ─────
      if (i === 0) {
        // Silo 0 (Cold Media Vault / P032): armored on-device originals vault + severed cloud stub
        const vaultBody = this.mesh(new THREE.BoxGeometry(0.5, lockedH, 0.5), coreBronze);
        vaultBody.position.set(xs[i], BENCH_TOP_Y + lockedH * 0.5, -5.1);

        const clasp = this.mesh(new THREE.BoxGeometry(0.18, 0.28, 0.54), brass);
        clasp.position.set(xs[i], BENCH_TOP_Y + lockedH * 0.6, -5.1);

        const stubPipe = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8), redSeal);
        stubPipe.rotation.z = Math.PI / 2;
        stubPipe.position.set(xs[i] + 0.3, BENCH_TOP_Y + lockedH * 0.35, -5.1);
      } else if (i === 1) {
        // Silo 1 (Duplicate Cluster B): 2 top inode stubs bridged to ONE shared base block
        const sharedBaseH = lockedH * 0.55;
        const sharedBlock = this.mesh(new THREE.BoxGeometry(0.52, sharedBaseH, 0.48), coreBronze);
        sharedBlock.position.set(xs[i], BENCH_TOP_Y + sharedBaseH * 0.5, -5.1);

        for (const ox of [-0.16, 0.16] as const) {
          const stem = this.mesh(new THREE.CylinderGeometry(0.035, 0.035, lockedH * 0.45, 8), brass);
          stem.position.set(xs[i] + ox * 0.5, BENCH_TOP_Y + sharedBaseH + lockedH * 0.2, -5.1);
          const node = this.mesh(new THREE.BoxGeometry(0.18, 0.14, 0.32), steel);
          node.position.set(xs[i] + ox, BENCH_TOP_Y + lockedH - 0.08, -5.1);
        }
      } else if (i === 2) {
        // Silo 2 (Build & Shader Caches / P061): open frame with regen spring coils
        for (const px of [-0.22, 0.22] as const) {
          const post = this.mesh(new THREE.BoxGeometry(0.06, lockedH, 0.42), steel);
          post.position.set(xs[i] + px, BENCH_TOP_Y + lockedH * 0.5, -5.1);
        }
        const coilCount = this.scaled(3);
        const coilMat = this.emissive(0xffaa44, 0.95);
        for (let c = 0; c < coilCount; c++) {
          const coil = this.mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 12), coilMat);
          coil.rotation.x = Math.PI / 2;
          coil.position.set(xs[i], BENCH_TOP_Y + 0.2 + c * ((lockedH - 0.3) / Math.max(1, coilCount)), -5.1);
          this.regenCoils.push(coil);
        }
      } else {
        // Silo 3 (Snapshot Ledger / P024): pinned recovery padlock block
        const ledger = this.mesh(new THREE.BoxGeometry(0.48, lockedH * 0.72, 0.48), coreBronze);
        ledger.position.set(xs[i], BENCH_TOP_Y + lockedH * 0.36, -5.1);
        const shackle = this.mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI), brass);
        shackle.position.set(xs[i], BENCH_TOP_Y + lockedH * 0.72, -5.1);
      }

      // ── True Safely Reclaimable Crown (sits atop the immutable core) ──────
      const capMat = this.emissive(0x47e896, 0.55);
      this.safeCapMats.push(capMat);
      const safeCap = this.mesh(new THREE.BoxGeometry(0.5, safeH, 0.5), capMat);
      safeCap.position.set(xs[i], BENCH_TOP_Y + lockedH + safeH * 0.5, -5.1);
      this.safeCaps.push(safeCap);

      // ── Outer Translucent Green "Marketing Claim" Wrapper (peels away!) ───
      const shellMat = scope.track(
        new THREE.MeshStandardMaterial({
          color: 0x4ef59c,
          emissive: 0x1fc46e,
          emissiveIntensity: 0.75,
          transparent: true,
          opacity: 0.54,
          depthWrite: false,
          roughness: 0.22,
        }),
      );
      this.claimShellMats.push(shellMat);
      const shell = this.mesh(new THREE.BoxGeometry(0.7, claimH, 0.7), shellMat);
      shell.position.set(xs[i], BENCH_TOP_Y + claimH * 0.5, -5.1);
      this.claimShells.push(shell);

      // Silo placard cleanly mounted ABOVE the silo top (zero console occlusion!)
      const capLbl = buildLabel(scope, `${bin.shortTag} ${(bin.claimedMB / 1000).toFixed(0)}G`, 0.86, 0.2);
      capLbl.position.set(xs[i], BENCH_TOP_Y + claimH + 0.26, -5.1);
      this.group.add(capLbl);
    }

    // ── Far-Right Conservation Gauge + Bolted Absent Delete Plate ───────────
    const refOutline = this.mesh(
      new THREE.BoxGeometry(1.12, MAX_SILO_H, 0.66),
      scope.track(
        new THREE.MeshStandardMaterial({
          color: 0x3b4d63,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          wireframe: true,
        }),
      ),
    );
    refOutline.position.set(2.14, BENCH_TOP_Y + MAX_SILO_H * 0.5, -5.1);

    this.headlineBarMat = this.emissive(0x52ff9b, 1.2);
    this.headlineBar = this.mesh(new THREE.CylinderGeometry(0.21, 0.23, 1.0, 12), this.headlineBarMat);
    this.headlineBar.position.set(1.88, BENCH_TOP_Y + MAX_SILO_H * 0.5, -5.1);

    this.protectedBar = this.mesh(
      new THREE.CylinderGeometry(0.21, 0.23, 1.0, 12),
      this.emissive(0xff9c3b, 1.1),
    );
    this.protectedBar.position.set(2.38, BENCH_TOP_Y + 0.08, -5.1);

    const colLbl = buildLabel(scope, 'SAFE vs LOCKED', 0.96, 0.2);
    colLbl.position.set(2.14, BENCH_TOP_Y + MAX_SILO_H + 0.26, -5.1);
    this.group.add(colLbl);

    // Non-interactive bolted Blanking Plate mounted cleanly on the front bench fascia ("The absent control is the exhibit")
    this.deletePlateMat = this.standard(0x522126, { emissive: 0x360d12, emissiveIntensity: 0.4, roughness: 0.45 });
    const blankPlate = this.mesh(new THREE.BoxGeometry(1.12, 0.34, 0.12), this.deletePlateMat);
    blankPlate.position.set(2.14, BENCH_TOP_Y - 0.18, -3.84);
    blankPlate.rotation.x = -0.2;
    for (const bx of [-0.46, 0.46] as const) {
      for (const by of [-0.1, 0.1] as const) {
        const bolt = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 6), brass);
        bolt.rotation.x = Math.PI / 2 - 0.2;
        bolt.position.set(2.14 + bx, BENCH_TOP_Y - 0.18 + by, -3.84);
      }
    }
    const delPlateLbl = buildLabel(scope, 'DELETE ALL: OMITTED BY DESIGN', 1.02, 0.15);
    delPlateLbl.position.set(2.14, BENCH_TOP_Y - 0.18, -3.76);
    delPlateLbl.rotation.x = -0.2;
    this.group.add(delPlateLbl);

    // Top Signage (clear of all silos)
    this.meterLabel = buildLabel(scope, 'CLAIM: 64.0 GB · PROTECTED: 0.0 GB · 0/4 AUDITED', 3.7, 0.16);
    this.meterLabel.position.set(0, 4.24, -6.04);
    this.group.add(this.meterLabel);

    this.planLabel = buildLabel(scope, 'SYNTHETIC STORAGE MODEL · PEEL BACK SHELLS BEFORE STAGING', 3.7, 0.15);
    this.planLabel.position.set(0, 3.68, -6.04);
    this.group.add(this.planLabel);

    // ── Console at z = -1.95 (100% clear of PLINTH_BOX) ─────────────────────
    const consoleGroup = buildConsole(scope, 2.85, 0.7, 1.0, slate);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    const leverXs = [-1.08, -0.54, 0.0, 0.54] as const;
    const leverShort = ['VAULT', 'INODES', 'CACHE', 'ROLLBK'] as const;
    for (let i = 0; i < 4; i++) {
      const lev = new Lever(scope, 2, 0.35, { arm: this.emissive(0xffc96b, 1.0) });
      lev.group.position.set(leverXs[i], 1.03, -1.93);
      this.group.add(lev.group);
      this.levers.push(lev);

      const lbl = buildLabel(scope, leverShort[i], 0.44, 0.28);
      lbl.position.set(leverXs[i], 1.14, -1.64);
      lbl.rotation.x = -0.35;
      this.group.add(lbl);
    }

    const planPuck = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12), this.emissive(0x52c7ff, 1.1));
    planPuck.position.set(0.98, 1.04, -1.93);
    const planLbl = buildLabel(scope, 'STAGE', 0.38, 0.28);
    planLbl.position.set(0.98, 1.14, -1.64);
    planLbl.rotation.x = -0.35;
    this.group.add(planLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 12), brass);
    resetPuck.position.set(1.3, 1.04, -1.93);

    // Wall plaque & reading lectern
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-4.1, 2.35, -7.25);
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.55, 0, -4.4);
    lectern.rotation.y = -0.45;
    this.group.add(lectern);

    // ── Register 6 Accessible Controls (4 Audits + Honest Safe Stage + Reset) ─
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      const bin = SYNTHETIC_BINS[i];
      this.control({
        object: this.levers[i].group,
        label: () =>
          this.state.inspected[bin.id]
            ? `Audited ${bin.label} (-${(bin.nonReclaimableMB / 1000).toFixed(1)} GB)`
            : `Audit ${bin.label} (${(bin.claimedMB / 1000).toFixed(1)} GB)`,
        description: `Peel back ${bin.label} (${bin.sourceProject}) claim shell to inspect real non-reclaimable core without touching disk.`,
        activate: () => {
          this.state = toggleAuditGate(this.state, bin.id);
          this.refusalFlashT = 0;
          this.syncVisuals();
          this.ctx.announce(this.state.lastAuditLog);
        },
      });
    }

    this.control({
      object: planPuck,
      label: () =>
        this.state.safePlanAssembled
          ? `Safe Plan Ready (${(this.state.netReclaimableMB / 1000).toFixed(1)} GB)`
          : 'Assemble Safe Non-Delete Plan',
      description:
        'Refuses to certify speculative savings while unverified silos remain; stages 14.5 GB reversible quarantine only after all 4 audits.',
      activate: () => {
        this.state = assembleSafePlan(this.state);
        if (this.state.lastRefusalReason && !this.reducedMotion) {
          this.refusalFlashT = 1.0;
        }
        this.syncVisuals();
        this.ctx.announce(this.state.lastAuditLog);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Cleanup Audit',
      description: 'Restore translucent claim shells back to initial 64.0 GB unverified claim.',
      activate: () => {
        this.onReset();
        this.ctx.announce('Reset E20 synthetic storage ledger to 64.0 GB unverified claim.');
      },
    });

    this.syncVisuals();
  }

  private syncVisuals(): void {
    const scope = this.ctx.scope;
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      const bin = SYNTHETIC_BINS[i];
      const audited = this.state.inspected[bin.id];
      this.levers[i].value = audited ? 1 : 0;

      const capMat = this.safeCapMats[i];
      if (this.state.safePlanAssembled) {
        capMat.color.setHex(0x52c7ff);
        capMat.emissive.setHex(0x28b6ff);
        capMat.emissiveIntensity = 1.4;
      } else if (audited) {
        capMat.color.setHex(0x63ffa8);
        capMat.emissive.setHex(0x2ad979);
        capMat.emissiveIntensity = 1.05;
      } else {
        capMat.color.setHex(0x3a6b52);
        capMat.emissive.setHex(0x16422b);
        capMat.emissiveIntensity = 0.35;
      }

      const shellMat = this.claimShellMats[i];
      if (!audited && this.state.lastRefusalReason) {
        shellMat.color.setHex(0xff7252);
        shellMat.emissive.setHex(0xd93822);
      } else {
        shellMat.color.setHex(0x4ef59c);
        shellMat.emissive.setHex(0x1fc46e);
      }
    }

    const auditedCount = countAuditedGates(this.state);
    this.headlineBarMat.color.setHex(this.state.safePlanAssembled ? 0x52c7ff : 0x52ff9b);
    this.headlineBarMat.emissive.setHex(this.state.safePlanAssembled ? 0x1e90e0 : 0x22c866);

    updateLabel(
      scope,
      this.meterLabel,
      `RECLAIMABLE: ${(this.state.netReclaimableMB / 1000).toFixed(1)} GB · LOCKED: ${(this.state.protectedMB / 1000).toFixed(1)} GB · ${auditedCount}/4 EXPLAINED`,
    );

    if (this.state.lastRefusalReason) {
      updateLabel(scope, this.planLabel, this.state.lastRefusalReason);
    } else if (this.state.safePlanAssembled) {
      updateLabel(
        scope,
        this.planLabel,
        `SAFE QUARANTINE STAGED: ${(this.state.netReclaimableMB / 1000).toFixed(1)} GB REVERSIBLE · ZERO DELETE`,
      );
    } else {
      updateLabel(scope, this.planLabel, 'SYNTHETIC BENCH · PEEL ALL 4 CLAIM SHELLS TO EXPOSE LOCKED MASS');
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    for (const lev of this.levers) lev.update(dt, instant);

    // Peel away translucent claim wrappers smoothly as each silo is audited
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      const targetShell = this.state.inspected[SYNTHETIC_BINS[i].id] ? 0.04 : 1.0;
      if (instant) {
        this.shellBlends[i] = targetShell;
      } else {
        this.shellBlends[i] += (targetShell - this.shellBlends[i]) * Math.min(1, dt * 7);
      }
      const scaleY = this.shellBlends[i];
      const baseH = this.claimHeights[i];
      this.claimShells[i].scale.y = scaleY;
      this.claimShells[i].position.y = BENCH_TOP_Y + baseH * scaleY * 0.5;
      this.claimShellMats[i].opacity = 0.1 + scaleY * 0.44;
    }

    const targetHeadlineH = Math.max(0.14, (this.state.netReclaimableMB / TOTAL_SYNTHETIC_CLAIMED_MB) * MAX_SILO_H);
    const targetProtectedH = Math.max(0.08, (this.state.protectedMB / TOTAL_SYNTHETIC_CLAIMED_MB) * MAX_SILO_H);

    if (instant) {
      this.headlineHeightCurrent = targetHeadlineH;
      this.protectedHeightCurrent = targetProtectedH;
    } else {
      const k = Math.min(1, dt * 8);
      this.headlineHeightCurrent += (targetHeadlineH - this.headlineHeightCurrent) * k;
      this.protectedHeightCurrent += (targetProtectedH - this.protectedHeightCurrent) * k;

      this.pulsePhase += dt;
      for (let c = 0; c < this.regenCoils.length; c++) {
        const lift = Math.sin(this.pulsePhase * 3.4 + c * 0.9) * 0.025;
        this.regenCoils[c].scale.set(1 + lift, 1 + lift, 1);
      }
      if (this.refusalFlashT > 0) {
        this.refusalFlashT = Math.max(0, this.refusalFlashT - dt * 1.6);
        this.deletePlateMat.emissiveIntensity = 0.4 + this.refusalFlashT * 1.1;
      } else {
        this.deletePlateMat.emissiveIntensity = 0.4;
      }
    }

    this.headlineBar.scale.y = this.headlineHeightCurrent;
    this.headlineBar.position.y = BENCH_TOP_Y + this.headlineHeightCurrent * 0.5;
    this.protectedBar.scale.y = this.protectedHeightCurrent;
    this.protectedBar.position.y = BENCH_TOP_Y + this.protectedHeightCurrent * 0.5;
  }

  protected override onReset(): void {
    this.state = createInitialCleanupState();
    this.headlineHeightCurrent = MAX_SILO_H;
    this.protectedHeightCurrent = 0.08;
    this.refusalFlashT = 0;
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      this.shellBlends[i] = 1.0;
    }
    if (this.built) {
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    return (
      `NetReclaimable=${this.state.netReclaimableMB}MB, Protected=${this.state.protectedMB}MB, ` +
      `Audited=${countAuditedGates(this.state)}/4, Refusals=${this.state.refusals}, SafePlan=${this.state.safePlanAssembled}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new ImpossibleCleanupExhibit(def);
}
