import * as THREE from 'three';
import { ExhibitBase } from '../ExhibitBase';
import { buildPlaque, buildLectern, buildLabel } from '../Furniture';
import { buildConsole, Pulse, Filament } from '../parts';
import type { ExhibitDefinition, ExhibitUpdateContext } from '../contract';

/**
 * E34 — BigMac Backbone. Tier A.
 *
 * A room-scale network sculpture. Six projects become physical nodes and the
 * visitor sends a workflow through them, watching which machine actually does
 * the work and where nothing is permitted to go.
 *
 * PRIVACY RULE — load-bearing. Every hostname, address, volume name and
 * identifier in this room is a synthetic example authored for the museum. No
 * live credential, key, real address or operational configuration appears here
 * or anywhere else in this building. The exhibit teaches the architecture; it
 * does not document a deployment.
 */

interface Node {
  readonly id: string;
  readonly name: string;
  /** Synthetic example identifier. Never a real one. */
  readonly example: string;
  readonly at: readonly [number, number, number];
  readonly colour: number;
  readonly note: string;
}

const NODES: readonly Node[] = [
  { id: 'laptop', name: 'Portable machine', example: 'host: notebook.example', at: [-3.4, 1.3, -2.4], colour: 0x9fd48c,
    note: 'The control surface. Light, always with you, and deliberately not where the work happens.' },
  { id: 'route', name: 'Access route', example: 'user: service@compute.example', at: [-1.6, 2.2, -3.4], colour: 0x76a566,
    note: 'One canonical key-authenticated route to a scoped service account. Multiple ad-hoc paths accumulate until nobody can say what is reachable.' },
  { id: 'compute', name: 'Compute host', example: 'host: compute.example', at: [0.4, 1.9, -4.6], colour: 0x5f8a52,
    note: 'Where inference actually runs. The whole architecture is a decision about which machine does the work.' },
  { id: 'storage', name: 'Attached storage', example: 'volumes: vol-a, vol-b', at: [2.6, 1.2, -4.4], colour: 0x8ec37c,
    note: 'Directly attached, shared over a private network, with no public route and no cloud tier. The absence is the security control.' },
  { id: 'models', name: 'Model engine', example: 'endpoint: local loopback via tunnel', at: [1.4, 3.0, -3.2], colour: 0x6b9a5c,
    note: 'A tunnel makes a remote service look local, which is simpler than teaching every tool that remote services exist.' },
  { id: 'daemon', name: 'Persistent daemon', example: 'process: daemon.example', at: [-0.8, 3.4, -5.2], colour: 0xb0d49c,
    note: 'Runs continuously rather than being invoked. It has a soul file, behavioural drift, and real permadeath.' },
];

interface Workflow {
  readonly name: string;
  readonly path: readonly string[];
  readonly note: string;
}

const WORKFLOWS: readonly Workflow[] = [
  { name: 'Local inference', path: ['laptop', 'route', 'compute', 'models'],
    note: 'A coding tool on the laptop calls a model on the compute host through an encrypted tunnel. Costs nothing per token and leaves no request log outside the household.' },
  { name: 'Large file access', path: ['laptop', 'route', 'storage'],
    note: 'Storage reached over a private network. There is no public path to it at all, which is the cheapest security control available.' },
  { name: 'Daemon heartbeat', path: ['compute', 'daemon', 'models'],
    note: 'The daemon never touches the portable machine. It lives on the compute host and keeps running whether anyone is watching or not.' },
];

export class BigMacBackbone extends ExhibitBase {
  private nodeMeshes = this.tracked<THREE.Mesh>();
  private nodeIds = this.tracked<string>();
  private pulse!: Pulse;
  private segment = -1;
  private workflow = -1;
  private path = this.tracked<THREE.CatmullRomCurve3>();
  private boundary!: THREE.Mesh;

  constructor(def: ExhibitDefinition) {
    super(def);
  }

  private nodeAt(id: string): THREE.Vector3 {
    const node = NODES.find((n) => n.id === id)!;
    return new THREE.Vector3(...node.at);
  }

  protected override build(): void {
    const scope = this.ctx.scope;

    const plaque = buildPlaque(scope, this.ctx.record);
    plaque.position.set(0, 2.3, -7.6);
    this.group.add(plaque);
    scope.trackObject(plaque);

    const lectern = buildLectern(scope, this.ctx.record, this.ctx.projects);
    lectern.position.set(4.0, 0, -5.2);
    lectern.rotation.y = -0.6;
    this.group.add(lectern);
    scope.trackObject(lectern);

    const metal = this.standard(0x4b5748, { roughness: 0.42, metalness: 0.6 });

    // ── the trust boundary: a physical plane nothing crosses ──
    this.boundary = new THREE.Mesh(
      scope.track(new THREE.PlaneGeometry(9.0, 5.4)),
      scope.track(new THREE.MeshStandardMaterial({
        color: 0x9fd48c, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, roughness: 0.4, depthWrite: false,
      })),
    );
    this.boundary.position.set(0, 2.6, -1.2);
    this.group.add(this.boundary);

    const boundaryLabel = buildLabel(scope, 'Nothing crosses this plane. No public route exists.', 3.4);
    boundaryLabel.position.set(0, 5.0, -1.2);
    this.group.add(boundaryLabel);
    scope.track(boundaryLabel.geometry);

    // ── the nodes ──
    NODES.forEach((node) => {
      const mesh = new THREE.Mesh(
        scope.track(new THREE.IcosahedronGeometry(0.34, 1)),
        this.emissive(node.colour, 0.3),
      );
      mesh.position.set(...node.at);
      this.group.add(mesh);
      this.nodeMeshes.push(mesh);
      this.nodeIds.push(node.id);

      // A stand so the sculpture reads as installed rather than floating.
      const stand = new THREE.Mesh(
        scope.track(new THREE.CylinderGeometry(0.035, 0.05, node.at[1], 6)),
        metal,
      );
      stand.position.set(node.at[0], node.at[1] / 2, node.at[2]);
      this.group.add(stand);

      const label = buildLabel(scope, node.name, 1.1);
      label.position.set(node.at[0], node.at[1] + 0.6, node.at[2]);
      this.group.add(label);
      scope.track(label.geometry);

      // The synthetic example identifier, shown as such.
      const example = buildLabel(scope, node.example, 1.2);
      example.position.set(node.at[0], node.at[1] - 0.55, node.at[2]);
      this.group.add(example);
      scope.track(example.geometry);
    });

    // ── static links between nodes ──
    const linkMat = this.standard(0x3d493b, { roughness: 0.75 });
    const links: [string, string][] = [
      ['laptop', 'route'], ['route', 'compute'], ['compute', 'storage'],
      ['compute', 'models'], ['compute', 'daemon'], ['models', 'daemon'],
    ];
    for (const [a, b] of links) {
      const link = new Filament(scope, this.scaled(12), 0.018, linkMat);
      link.follow(new THREE.CatmullRomCurve3([this.nodeAt(a), this.nodeAt(b)]));
      this.group.add(link.group);
    }

    this.pulse = new Pulse(scope, 0.12, this.emissive(0xf2ffe8, 1.9));
    this.group.add(this.pulse.mesh);

    // ── one console per workflow ──
    WORKFLOWS.forEach((workflow, i) => {
      const consoleGroup = buildConsole(scope, 0.66, 0.48, 1.0, metal);
      consoleGroup.position.set(-2.4 + i * 2.4, 0, -0.4);
      this.group.add(consoleGroup);

      const label = buildLabel(scope, workflow.name, 0.68);
      label.position.set(0, 1.02, 0.22);
      label.rotation.x = -Math.PI / 2.1;
      consoleGroup.add(label);
      scope.track(label.geometry);

      this.control({
        object: consoleGroup,
        label: `Send a pulse: ${workflow.name}`,
        description: `${workflow.note} Every address and identifier shown in this room is a synthetic example.`,
        activate: () => {
          this.workflow = i;
          this.segment = 0;
          this.buildPath(workflow);
          this.pulse.start();
          this.ctx.announce(`${workflow.name}. ${workflow.note}`);
        },
      });
    });

    // ── the privacy notice, stated as a rule of the room ──
    const notice = buildLabel(
      scope,
      'Synthetic examples only. No credential, key or real address appears in this museum.',
      4.0,
    );
    notice.position.set(0, 0.9, -7.4);
    this.group.add(notice);
    scope.track(notice.geometry);
  }

  private buildPath(workflow: Workflow): void {
    this.path.length = 0;
    for (let i = 0; i < workflow.path.length - 1; i++) {
      const a = this.nodeAt(workflow.path[i]);
      const b = this.nodeAt(workflow.path[i + 1]);
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.28, 0));
      this.path.push(new THREE.CatmullRomCurve3([a, mid, b]));
    }
  }

  protected override onUpdate(dt: number, _ctx: ExhibitUpdateContext): void {
    if (this.segment >= 0 && this.segment < this.path.length && this.pulse.isRunning) {
      if (this.pulse.update(dt, this.path[this.segment], this.reducedMotion ? 5 : 1.0)) {
        this.segment++;
        if (this.segment < this.path.length) {
          this.pulse.start();
        } else {
          const workflow = WORKFLOWS[this.workflow];
          this.ctx.announce(
            `${workflow.name} complete. The pulse touched ${workflow.path.length} nodes and never crossed the boundary plane.`,
          );
        }
      }
    }

    // Nodes on the active path glow.
    const active = this.workflow >= 0 ? WORKFLOWS[this.workflow].path : [];
    for (let i = 0; i < this.nodeMeshes.length; i++) {
      const mat = this.nodeMeshes[i].material as THREE.MeshStandardMaterial;
      const onPath = active.includes(this.nodeIds[i]);
      const target = onPath ? 1.3 : 0.28;
      mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 4);
      if (!this.reducedMotion) this.nodeMeshes[i].rotation.y += dt * (onPath ? 0.6 : 0.12);
    }

    if (!this.reducedMotion) {
      const bm = this.boundary.material as THREE.MeshStandardMaterial;
      bm.opacity = 0.05 + Math.sin(this.elapsed * 0.5) * 0.02;
    }
  }

  protected override onReset(): void {
    this.workflow = -1;
    this.segment = -1;
    this.path.length = 0;
    this.pulse.stop();
    for (const mesh of this.nodeMeshes) {
      (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
      mesh.rotation.set(0, 0, 0);
    }
  }

  protected override describeState(): string {
    if (this.workflow < 0) {
      return `Six nodes stand in the room: ${NODES.map((n) => n.name).join(', ')}. No workflow is running. Every identifier shown is a synthetic example.`;
    }
    const workflow = WORKFLOWS[this.workflow];
    const done = this.segment >= this.path.length;
    return `${workflow.name}: ${workflow.path.map((id) => NODES.find((n) => n.id === id)!.name).join(' → ')}. ${done ? 'The pulse has completed and never crossed the boundary plane.' : 'The pulse is travelling.'}`;
  }
}
