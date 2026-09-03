import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/** E34 — BigMac Backbone / AndrewOS Control Plane. All identifiers are synthetic. */

interface Node {
  readonly id: string;
  readonly name: string;
  readonly example: string;
  readonly at: readonly [number, number, number];
  readonly colour: number;
}

const NODES: readonly Node[] = [
  { id: 'control', name: 'AndrewOS control plane', example: 'registry: museum.example', at: [-3.5, 1.7, -2.0], colour: 0x78c3d8 },
  { id: 'laptop', name: 'Portable machine', example: 'host: notebook.example', at: [-2.0, 2.6, -3.2], colour: 0x9fd48c },
  { id: 'route', name: 'Scoped access route', example: 'route: tunnel.example', at: [-0.5, 1.5, -4.2], colour: 0x76a566 },
  { id: 'compute', name: 'Compute host', example: 'host: compute.example', at: [1.2, 2.4, -4.8], colour: 0x5f8a52 },
  { id: 'storage', name: 'Attached storage', example: 'volume: archive.example', at: [3.2, 1.35, -4.1], colour: 0x8ec37c },
  { id: 'models', name: 'Model engine', example: 'endpoint: loopback.example', at: [2.7, 3.25, -2.8], colour: 0x6b9a5c },
  { id: 'daemon', name: 'Persistent daemon', example: 'process: daemon.example', at: [0.4, 3.55, -5.7], colour: 0xb0d49c },
];

interface Workflow {
  readonly name: string;
  readonly permission: 'read_only' | 'consequential';
  readonly path: readonly string[];
  readonly note: string;
}

const WORKFLOWS: readonly Workflow[] = [
  { name: 'Inspect project', permission: 'read_only', path: ['control', 'laptop'], note: 'A registered read-only inspection returns bounded Git and project evidence.' },
  { name: 'Run local inference', permission: 'read_only', path: ['control', 'laptop', 'route', 'compute', 'models'], note: 'The control plane invokes only a registered route; the model engine remains inside the private infrastructure.' },
  { name: 'Restart registered service', permission: 'consequential', path: ['control', 'laptop', 'route', 'compute', 'daemon'], note: 'A consequential action requires an exact preview transaction before the simulated route may execute.' },
  { name: 'Inspect storage route', permission: 'read_only', path: ['control', 'laptop', 'route', 'compute', 'storage'], note: 'The storage path is private and synthetic here; no live filesystem is exposed to the museum.' },
];

const RECEIPT_STATES = [
  { key: 'requested', label: 'REQUESTED', colour: 0x78c3d8 },
  { key: 'attempted', label: 'ATTEMPTED', colour: 0xe8c65a },
  { key: 'changed', label: 'CHANGED', colour: 0xd28b5c },
  { key: 'verified', label: 'VERIFIED', colour: 0x7fd67f },
  { key: 'failed', label: 'FAILED', colour: 0xd9543a },
  { key: 'unknown', label: 'UNKNOWN', colour: 0x8e83a7 },
] as const;

export class BigMacBackbone extends ExhibitBase {
  private nodeMeshes = this.tracked<THREE.Mesh>();
  private nodeIds = this.tracked<string>();
  private curves = this.tracked<THREE.CatmullRomCurve3>();
  private receiptLamps = this.tracked<THREE.Mesh>();
  private pulse!: Pulse;
  private workflow = -1;
  private segment = -1;
  private previewReady = false;
  private receiptRequested = false;
  private receiptAttempted = false;
  private receiptChanged = false;
  private receiptVerified = false;
  private gate!: THREE.Mesh;

  constructor(def: ExhibitDefinition) { super(def); }

  private nodeAt(id: string): THREE.Vector3 {
    const n = NODES.find((node) => node.id === id)!;
    return new THREE.Vector3(...n.at);
  }

  protected override build(): void {
    const scope = this.ctx.scope;
    const plaque = buildPlaque(scope, this.ctx.record); plaque.position.set(0, 2.3, -7.6); this.group.add(plaque); scope.trackObject(plaque);
    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects); lectern.position.set(4.0, 0, -5.2); lectern.rotation.y = -0.6; this.group.add(lectern); scope.trackObject(lectern);

    const metal = this.standard(0x465247, { roughness: 0.45, metalness: 0.6 });
    const boundary = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(9.2, 5.5)), scope.track(new THREE.MeshStandardMaterial({ color: 0x9fd48c, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false })));
    boundary.position.set(0, 2.65, -1.05); this.group.add(boundary);
    const boundaryLabel = buildLabel(scope, 'PRIVATE BOUNDARY · SYNTHETIC IDENTIFIERS ONLY', 3.7); boundaryLabel.position.set(0, 5.1, -1.05); this.group.add(boundaryLabel); scope.track(boundaryLabel.geometry);

    NODES.forEach((node) => {
      const mesh = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(node.id === 'control' ? 0.43 : 0.31, 1)), this.emissive(node.colour, node.id === 'control' ? 0.8 : 0.28));
      mesh.position.set(...node.at); this.group.add(mesh); this.nodeMeshes.push(mesh); this.nodeIds.push(node.id);
      const stand = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.035, 0.05, node.at[1], 6)), metal); stand.position.set(node.at[0], node.at[1] / 2, node.at[2]); this.group.add(stand);
      const label = buildLabel(scope, node.name, 1.15); label.position.set(node.at[0], node.at[1] + 0.58, node.at[2]); this.group.add(label); scope.track(label.geometry);
      const example = buildLabel(scope, node.example, 1.25); example.position.set(node.at[0], node.at[1] - 0.52, node.at[2]); this.group.add(example); scope.track(example.geometry);
    });

    const links: readonly [string, string][] = [['control','laptop'],['laptop','route'],['route','compute'],['compute','storage'],['compute','models'],['compute','daemon']];
    for (const [a, b] of links) {
      const f = new Filament(scope, this.scaled(12), 0.018, this.standard(0x3d493b, { roughness: 0.75 }));
      f.follow(new THREE.CatmullRomCurve3([this.nodeAt(a), this.nodeAt(b)])); this.group.add(f.group);
    }
    this.pulse = new Pulse(scope, 0.12, this.emissive(0xf2ffe8, 1.9)); this.group.add(this.pulse.mesh);

    WORKFLOWS.forEach((workflow, i) => {
      const c = buildConsole(scope, 0.62, 0.46, 1.0, metal); c.position.set(-3.0 + i * 2.0, 0, -0.4); this.group.add(c);
      const label = buildLabel(scope, workflow.name, 0.66); label.position.set(0, 1.02, 0.22); label.rotation.x = -Math.PI / 2.1; c.add(label); scope.track(label.geometry);
      this.control({ object: c, label: `Select ${workflow.name}`, description: `${workflow.note} Permission class: ${workflow.permission}.`, activate: () => {
        this.workflow = i; this.segment = -1; this.previewReady = false; this.curves.length = 0;
        this.receiptRequested = true; this.receiptAttempted = false; this.receiptChanged = false; this.receiptVerified = false;
        this.applyReceiptVisualState();
        this.ctx.announce(`${workflow.name}. ${workflow.note} Permission class: ${workflow.permission}. REQUESTED receipt state recorded.`);
      }});
    });

    this.gate = new THREE.Mesh(scope.track(new THREE.BoxGeometry(1.8, 1.55, 0.12)), this.emissive(0xd9543a, 0.3));
    this.gate.position.set(0, 1.65, -6.2); this.group.add(this.gate);
    const gateLabel = buildLabel(scope, 'THE DEXTER GATE', 1.55); gateLabel.position.set(0, 2.7, -6.15); this.group.add(gateLabel); scope.track(gateLabel.geometry);

    const preview = buildConsole(scope, 0.7, 0.48, 1.0, metal); preview.position.set(-1.1, 0, -1.35); this.group.add(preview);
    const previewLabel = buildLabel(scope, 'PREVIEW EXACT EFFECT', 0.8); previewLabel.position.set(0, 1.02, 0.2); previewLabel.rotation.x = -Math.PI / 2.1; preview.add(previewLabel); scope.track(previewLabel.geometry);
    this.control({ object: preview, label: 'Preview the selected operation', description: 'Consequential operations require this exact preview before execution. Read-only work may proceed without it.', activate: () => {
      if (this.workflow < 0) { this.ctx.announce('Select a registered operation first.'); return; }
      this.previewReady = true; const w = WORKFLOWS[this.workflow]; this.ctx.announce(`Preview bound: ${w.name}. Declared route: ${w.path.join(' → ')}. No other operation may use this preview.`);
    }});

    const execute = buildConsole(scope, 0.7, 0.48, 1.0, metal); execute.position.set(1.1, 0, -1.35); this.group.add(execute);
    const executeLabel = buildLabel(scope, 'EXECUTE REGISTERED', 0.76); executeLabel.position.set(0, 1.02, 0.2); executeLabel.rotation.x = -Math.PI / 2.1; execute.add(executeLabel); scope.track(executeLabel.geometry);
    this.control({ object: execute, label: 'Execute selected registered operation', description: 'Starts only the selected registered route and returns an evidence receipt when its museum simulation verifies.', activate: () => this.execute() });

    const receiptBoard = new THREE.Mesh(scope.track(new THREE.BoxGeometry(6.0, 0.08, 0.72)), this.standard(0x2f3635, { roughness: 0.82 }));
    receiptBoard.position.set(0, 0.72, -2.15); this.group.add(receiptBoard);
    const receiptTitle = buildLabel(scope, 'EVIDENCE RECEIPT · STATES DO NOT COLLAPSE INTO “DONE”', 3.8);
    receiptTitle.position.set(0, 1.62, -2.16); this.group.add(receiptTitle); scope.track(receiptTitle.geometry);

    RECEIPT_STATES.forEach((state, i) => {
      const lamp = new THREE.Mesh(scope.track(new THREE.BoxGeometry(0.42, 0.12, 0.28)), this.emissive(state.colour, 0.06));
      lamp.name = `E34 receipt ${state.key}`;
      lamp.position.set(-2.5 + i, 0.86, -2.15); this.group.add(lamp); this.receiptLamps.push(lamp);
      const label = buildLabel(scope, state.label, 0.72); label.position.set(-2.5 + i, 1.17, -2.13); this.group.add(label); scope.track(label.geometry);
    });

    const receipt = buildLabel(scope, 'REQUESTED → ATTEMPTED → CHANGED? → VERIFIED    FAILED / UNKNOWN stay distinct', 4.2);
    receipt.position.set(0, 4.45, -6.4); this.group.add(receipt); scope.track(receipt.geometry);
    this.applyReceiptVisualState();
  }

  private applyReceiptVisualState(): void {
    const active = [this.receiptRequested, this.receiptAttempted, this.receiptChanged, this.receiptVerified, false, false];
    for (let i = 0; i < this.receiptLamps.length; i++) {
      const mat = this.receiptLamps[i].material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = active[i] ? 1.45 : 0.06;
    }
  }

  private execute(): void {
    if (this.workflow < 0) { this.ctx.announce('Select a registered operation first.'); return; }
    const w = WORKFLOWS[this.workflow];
    this.receiptAttempted = true;
    this.receiptChanged = false;
    this.receiptVerified = false;
    this.applyReceiptVisualState();
    if (w.permission === 'consequential' && !this.previewReady) {
      this.ctx.announce(`BLOCKED at the Dexter Gate. ${w.name} is consequential and has no exact preview transaction. REQUESTED and ATTEMPTED remain recorded; CHANGED and VERIFIED do not light.`);
      return;
    }
    this.curves.length = 0;
    for (let i = 0; i < w.path.length - 1; i++) {
      const a = this.nodeAt(w.path[i]); const b = this.nodeAt(w.path[i + 1]);
      this.curves.push(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.25, 0)), b]));
    }
    this.segment = 0; this.previewReady = false; this.pulse.start();
    this.ctx.announce(`ATTEMPTED: ${w.name}. The route is executing against registered synthetic nodes.`);
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.segment >= 0 && this.segment < this.curves.length && this.pulse.isRunning) {
      if (this.pulse.update(dt, this.curves[this.segment], this.reducedMotion ? 5 : 1.0)) {
        this.segment++;
        if (this.segment < this.curves.length) this.pulse.start();
        else {
          const w = WORKFLOWS[this.workflow];
          this.receiptChanged = w.permission === 'consequential';
          this.receiptVerified = true;
          this.applyReceiptVisualState();
          this.ctx.announce(`VERIFIED receipt: ${w.name}. ${this.receiptChanged ? 'The simulated consequential operation records CHANGED separately. ' : 'This read-only operation has no CHANGED state. '}Requested, attempted, changed and verified remain distinct evidence states.`);
        }
      }
    }
    const active = this.workflow >= 0 ? WORKFLOWS[this.workflow].path : [];
    for (let i = 0; i < this.nodeMeshes.length; i++) {
      const mat = this.nodeMeshes[i].material as THREE.MeshStandardMaterial;
      const target = active.includes(this.nodeIds[i]) ? 1.25 : this.nodeIds[i] === 'control' ? 0.75 : 0.25;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 5);
      if (!this.reducedMotion) this.nodeMeshes[i].rotation.y += dt * (active.includes(this.nodeIds[i]) ? 0.5 : 0.08);
    }
    const gm = this.gate.material as THREE.MeshStandardMaterial;
    gm.emissive.setHex(this.previewReady ? 0x7fd67f : 0xd9543a); gm.emissiveIntensity = this.previewReady ? 1.2 : 0.35;
  }

  protected override onReset(): void {
    this.workflow = -1; this.segment = -1; this.previewReady = false; this.curves.length = 0; this.pulse.stop();
    this.receiptRequested = false; this.receiptAttempted = false; this.receiptChanged = false; this.receiptVerified = false;
    this.applyReceiptVisualState();
  }

  protected override describeState(): string {
    if (this.workflow < 0) return 'The AndrewOS control plane waits in front of six infrastructure nodes. No operation is selected; every identifier is synthetic. Evidence receipt lamps are clear.';
    const w = WORKFLOWS[this.workflow];
    const receipt = [
      this.receiptRequested ? 'requested' : null,
      this.receiptAttempted ? 'attempted' : null,
      this.receiptChanged ? 'changed' : null,
      this.receiptVerified ? 'verified' : null,
    ].filter(Boolean).join(' → ') || 'none';
    return `${w.name} selected (${w.permission}). Preview ${this.previewReady ? 'is bound' : 'is not bound'}. Receipt: ${receipt}. Route: ${w.path.map((id) => NODES.find((n) => n.id === id)!.name).join(' → ')}.`;
  }
}
