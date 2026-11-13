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

export class ImpossibleCleanupExhibit extends ExhibitBase {
  private state: CleanupAuditState = createInitialCleanupState();

  private binClaimBars = this.tracked<THREE.Mesh>();
  private binClaimMats = this.tracked<THREE.MeshStandardMaterial>();
  private binBaseHeights = new Float32Array(SYNTHETIC_BINS.length);
  private headlineBar!: THREE.Mesh;
  private headlineBarMat!: THREE.MeshStandardMaterial;
  private protectedBar!: THREE.Mesh;

  private levers = this.tracked<Lever>();
  private meterLabel!: THREE.Mesh;
  private planLabel!: THREE.Mesh;

  private headlineHeightCurrent = 2.4;
  private protectedHeightCurrent = 0.08;

  protected override build(): void {
    const scope = this.ctx.scope;
    const slate = this.standard(0x20242c, { roughness: 0.78 });
    const brass = this.standard(0xc99c46, { roughness: 0.4, metalness: 0.68 });

    // ── Synthetic Storage Warehouse Bench (z = -5.0, clear of plinth) ────────
    const floorDeck = this.mesh(new THREE.BoxGeometry(5.5, 0.28, 2.3), slate);
    floorDeck.position.set(0, 0.14, -5.0);

    const wallBack = this.mesh(new THREE.BoxGeometry(5.5, 3.25, 0.16), slate);
    wallBack.position.set(0, 1.9, -6.15);

    // 4 Synthetic Bin Warehouse Silos (left of center)
    const xs = [-2.05, -1.05, -0.05, 0.95] as const;
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      const bin = SYNTHETIC_BINS[i];
      const baseH = 0.55 + (bin.claimedMB / TOTAL_SYNTHETIC_CLAIMED_MB) * 3.8;
      const mat = this.emissive(0x47e896, 1.0);
      this.binClaimMats.push(mat);

      const bar = this.mesh(new THREE.BoxGeometry(0.62, baseH, 0.62), mat);
      bar.position.set(xs[i], 0.28 + baseH * 0.5, -5.1);
      this.binClaimBars.push(bar);
      this.binBaseHeights[i] = baseH;

      const capLbl = buildLabel(scope, `${bin.label.toUpperCase()} (${(bin.claimedMB / 1000).toFixed(0)}GB)`, 0.88, 0.26);
      capLbl.position.set(xs[i], 0.42, -4.45);
      capLbl.rotation.x = -0.35;
      this.group.add(capLbl);
    }

    // Far-right Dual Meter Columns: Shrinking Net Savings vs Rising Protected Mass
    this.headlineBarMat = this.emissive(0x52ff9b, 1.25);
    this.headlineBar = this.mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.0, 12), this.headlineBarMat);
    this.headlineBar.position.set(1.95, 1.48, -5.1);

    this.protectedBar = this.mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.0, 12), this.emissive(0xffaa44, 1.1));
    this.protectedBar.position.set(2.48, 0.32, -5.1);

    const colLbl = buildLabel(scope, 'SAFE vs LOCKED', 0.96, 0.24);
    colLbl.position.set(2.22, 0.42, -4.45);
    colLbl.rotation.x = -0.35;
    this.group.add(colLbl);

    // Top Warehouse Signage (Synthetic Ledger Disclaimer + Exact MB Readout)
    this.meterLabel = buildLabel(scope, 'HEADLINE SAVINGS: 64.0 GB (0/4 CONSTRAINTS AUDITED)', 3.6, 0.16);
    this.meterLabel.position.set(0, 3.85, -6.02);
    this.group.add(this.meterLabel);

    this.planLabel = buildLabel(scope, 'SYNTHETIC STORAGE MODEL · ZERO DISK ACCESS · ZERO DELETE LEVER', 3.6, 0.16);
    this.planLabel.position.set(0, 3.25, -6.02);
    this.group.add(this.planLabel);

    // ── Console at z = -1.95 (clear of plinth) ──────────────────────────────
    const consoleGroup = buildConsole(scope, 2.75, 0.7, 1.0, slate);
    consoleGroup.position.set(0, 0, -1.95);
    this.group.add(consoleGroup);

    const leverXs = [-1.05, -0.52, 0.0, 0.52] as const;
    const leverShort = ['BACKUP', 'DUPES', 'CACHE', 'ROLLBK'] as const;
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
    planPuck.position.set(0.95, 1.04, -1.93);
    const planLbl = buildLabel(scope, 'STAGE', 0.38, 0.28);
    planLbl.position.set(0.95, 1.14, -1.64);
    planLbl.rotation.x = -0.35;
    this.group.add(planLbl);

    const resetPuck = this.mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.08, 12), brass);
    resetPuck.position.set(1.26, 1.04, -1.93);

    // Wall plaque & reading lectern
    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(-4.1, 2.35, -7.25);
    this.group.add(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(3.55, 0, -4.4);
    lectern.rotation.y = -0.45;
    this.group.add(lectern);

    // ── Register 6 Accessible Controls (4 Audits + Safe Stage + Reset) ─────────
    for (let i = 0; i < SYNTHETIC_BINS.length; i++) {
      const bin = SYNTHETIC_BINS[i];
      this.control({
        object: this.levers[i].group,
        label: () =>
          this.state.inspected[bin.id]
            ? `Audited ${bin.label} (-${(bin.nonReclaimableMB / 1000).toFixed(1)} GB)`
            : `Audit ${bin.label} (${(bin.claimedMB / 1000).toFixed(1)} GB)`,
        description: `Inspect ${bin.label} reclaimability rules without modifying any files.`,
        activate: () => {
          this.state = toggleAuditGate(this.state, bin.id);
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
      description: 'Verify all 4 safety gates and stage only reversible quarantine candidates (zero delete action).',
      activate: () => {
        this.state = assembleSafePlan(this.state);
        this.syncVisuals();
        this.ctx.announce(this.state.lastAuditLog);
      },
    });

    this.control({
      object: resetPuck,
      label: 'Reset Cleanup Audit',
      description: 'Clear inspected audit gates back to initial 64.0 GB claimed baseline.',
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

      const reclaimFraction = audited
        ? (bin.claimedMB - bin.nonReclaimableMB) / bin.claimedMB
        : 1.0;
      const scaleY = Math.max(0.14, reclaimFraction);
      this.binClaimBars[i].scale.y = scaleY;
      this.binClaimBars[i].position.y = 0.28 + this.binBaseHeights[i] * scaleY * 0.5;
      this.binClaimMats[i].color.setHex(audited ? 0xffb347 : 0x47e896);
      this.binClaimMats[i].emissive.setHex(audited ? 0xd98018 : 0x20a860);
    }

    const auditedCount = countAuditedGates(this.state);
    this.headlineBarMat.color.setHex(this.state.safePlanAssembled ? 0x52c7ff : 0x52ff9b);
    this.headlineBarMat.emissive.setHex(this.state.safePlanAssembled ? 0x1e90e0 : 0x22c866);

    updateLabel(
      scope,
      this.meterLabel,
      `RECLAIMABLE: ${(this.state.netReclaimableMB / 1000).toFixed(1)} GB · PROTECTED: ${(this.state.protectedMB / 1000).toFixed(1)} GB · (${auditedCount}/4 AUDITED)`,
    );
    updateLabel(
      scope,
      this.planLabel,
      this.state.safePlanAssembled
        ? `SAFE QUARANTINE PLAN: ${(this.state.netReclaimableMB / 1000).toFixed(1)} GB STAGED · ZERO DELETE`
        : 'SYNTHETIC STORAGE MODEL · INSPECT EVIDENCE TO REVEAL HIDDEN LOCKS',
    );
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    const instant = this.reducedMotion;
    for (const lev of this.levers) lev.update(dt, instant);

    const targetHeadlineH = Math.max(0.18, (this.state.netReclaimableMB / TOTAL_SYNTHETIC_CLAIMED_MB) * 2.4);
    const targetProtectedH = Math.max(0.08, (this.state.protectedMB / TOTAL_SYNTHETIC_CLAIMED_MB) * 2.4);

    if (instant) {
      this.headlineHeightCurrent = targetHeadlineH;
      this.protectedHeightCurrent = targetProtectedH;
    } else {
      const k = Math.min(1, dt * 8);
      this.headlineHeightCurrent += (targetHeadlineH - this.headlineHeightCurrent) * k;
      this.protectedHeightCurrent += (targetProtectedH - this.protectedHeightCurrent) * k;
    }

    this.headlineBar.scale.y = this.headlineHeightCurrent;
    this.headlineBar.position.y = 0.28 + this.headlineHeightCurrent * 0.5;
    this.protectedBar.scale.y = this.protectedHeightCurrent;
    this.protectedBar.position.y = 0.28 + this.protectedHeightCurrent * 0.5;
  }

  protected override onReset(): void {
    this.state = createInitialCleanupState();
    this.headlineHeightCurrent = 2.4;
    this.protectedHeightCurrent = 0.08;
    if (this.built) {
      this.syncVisuals();
    }
  }

  protected override describeState(): string {
    return (
      `NetReclaimable=${this.state.netReclaimableMB}MB, Protected=${this.state.protectedMB}MB, ` +
      `Audited=${countAuditedGates(this.state)}/4, SafePlan=${this.state.safePlanAssembled}.`
    );
  }
}

export function createCandidate(def: ExhibitDefinition): ExhibitModule {
  return new ImpossibleCleanupExhibit(def);
}
