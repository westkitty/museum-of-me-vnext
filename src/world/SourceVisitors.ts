import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import type { InteractionManager } from '../interaction/InteractionManager';
import { SOURCE_VISITORS, visitorRouteForVNext, type SourceVisitor } from '../content/sourceParity';
import type { Vec3 } from './layout';

interface RuntimeVisitor {
  data: SourceVisitor;
  group: THREE.Group;
  hit: THREE.Object3D;
  route: Vec3[];
  routeIndex: number;
  pause: number;
  lineIndex: number;
  phase: number;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  anatomy: Set<string>;
}

function rgb(c: number[] | undefined, fallback: number): number {
  if (!c || c.length < 3) return fallback;
  return (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
}

/**
 * The 17 authored visitors/staff from the Reliquary source contract.
 * Ambient capsule walkers are not a substitute for these identities.
 */
export class SourceVisitors {
  readonly group = new THREE.Group();
  private readonly visitors: RuntimeVisitor[] = [];
  private readonly unbind: (() => void)[] = [];

  constructor(
    private readonly scope: ResourceScope,
    private readonly collisions: CollisionWorld,
    interaction: InteractionManager,
    private readonly onSpeak: (visitor: SourceVisitor, line: string, thought?: string) => void,
  ) {
    this.group.name = 'source-visitors';
    for (const data of SOURCE_VISITORS) {
      const runtime = this.build(data);
      this.visitors.push(runtime);
      this.group.add(runtime.group);
      this.unbind.push(interaction.register(`visitor:${data.id}`, {
        object: runtime.hit,
        label: `Speak with ${data.title}`,
        description: `${data.title} · ${data.subtitle}. ${data.lines[0] ?? ''}`,
        activate: () => this.speak(data.id),
      }));
    }
  }

  get count(): number {
    return this.visitors.length;
  }

  identities(): readonly SourceVisitor[] {
    return SOURCE_VISITORS;
  }

  positions(): Array<{ id: string; x: number; z: number; staff: boolean }> {
    return this.visitors.map((v) => ({
      id: v.data.id, x: v.group.position.x, z: v.group.position.z, staff: !!v.data.staff,
    }));
  }

  speak(id: string): { role: string; line: string } | null {
    const v = this.visitors.find((item) => item.data.id === id);
    if (!v) return null;
    const line = v.data.lines[v.lineIndex % v.data.lines.length] ?? '';
    const thought = v.data.thoughts[v.lineIndex % Math.max(1, v.data.thoughts.length)];
    v.lineIndex += 1;
    this.onSpeak(v.data, line, thought);
    return { role: `${v.data.title} · ${v.data.subtitle}`, line };
  }

  anatomyOf(id: string): string[] {
    return [...(this.visitors.find((v) => v.data.id === id)?.anatomy ?? [])];
  }

  /**
   * Walk one visitor's whole authored conversation from its current point and
   * return every line in order. Source parity: Version B `VisitorSystem.speak`
   * cycles `lines`, so a full cycle is the complete authored conversation and
   * the next call after it re-enters at the first line.
   */
  conversation(id: string): { role: string; lines: string[]; repeated: string | null } | null {
    const v = this.visitors.find((item) => item.data.id === id);
    if (!v) return null;
    const lines: string[] = [];
    for (let i = 0; i < v.data.lines.length; i++) {
      const spoken = this.speak(id);
      if (!spoken) return null;
      lines.push(spoken.line);
    }
    // Re-entry: the next call must return the conversation's first line again.
    // This is a preview only -- calling speak() here would itself consume a
    // line and fire onSpeak(), permanently shifting v.lineIndex one line past
    // the full cycle every time a caller asks for this preview.
    const repeated = v.data.lines[v.lineIndex % v.data.lines.length] ?? null;
    return {
      role: `${v.data.title} \u00b7 ${v.data.subtitle}`,
      lines,
      repeated,
    };
  }

  /** Machine-readable proof surface for the seventeen authored identities. */
  snapshot(): Array<{
    id: string; title: string; subtitle: string; staff: boolean; seated: boolean;
    group: string | null; prop: string; gesture: string | null; dialogueMode: string | null;
    lineCount: number; thoughtCount: number; focusIds: string[]; reactsTo: string[];
    routePoints: number; position: [number, number, number]; anatomy: string[];
    meshCount: number; interactive: boolean; heard: boolean;
  }> {
    return this.visitors.map((v) => ({
      id: v.data.id,
      title: v.data.title,
      subtitle: v.data.subtitle,
      staff: !!v.data.staff,
      seated: !!v.data.seated,
      group: v.data.group ?? null,
      prop: v.data.prop ?? 'folio',
      gesture: v.data.gesture ?? null,
      dialogueMode: v.data.dialogueMode ?? null,
      lineCount: v.data.lines.length,
      thoughtCount: v.data.thoughts.length,
      focusIds: [...(v.data.focusIds ?? [])],
      reactsTo: [...(v.data.reactsTo ?? [])],
      routePoints: v.route.length,
      position: [v.group.position.x, v.group.position.y, v.group.position.z],
      anatomy: [...v.anatomy],
      meshCount: countMeshes(v.group),
      interactive: !!v.hit.userData.interactive,
      heard: false,
    }));
  }

  update(dt: number, reducedMotion: boolean): void {
    for (const v of this.visitors) {
      v.phase += dt;
      if (v.data.seated || reducedMotion) continue;
      if (v.pause > 0) {
        v.pause -= dt;
        continue;
      }
      const target = v.route[v.routeIndex];
      if (!target) continue;
      const dx = target[0] - v.group.position.x;
      const dz = target[2] - v.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.18) {
        v.routeIndex = (v.routeIndex + 1) % v.route.length;
        const [min, max] = v.data.pause;
        v.pause = min + (max - min) * 0.5;
        continue;
      }
      const step = Math.min(dist, v.data.speed * dt);
      const nx = v.group.position.x + (dx / dist) * step;
      const nz = v.group.position.z + (dz / dist) * step;
      const probe = { x: nx, y: v.group.position.y, z: v.group.position.z };
      this.collisions.resolveHorizontal(probe, 0.28, 1.6);
      const probeZ = { x: v.group.position.x, y: v.group.position.y, z: nz };
      this.collisions.resolveHorizontal(probeZ, 0.28, 1.6);
      v.group.position.x = probe.x;
      v.group.position.z = probeZ.z;
      v.group.rotation.y = Math.atan2(dx, dz);
      const swing = Math.sin(v.phase * 7) * 0.34;
      v.leftLeg.rotation.x = swing;
      v.rightLeg.rotation.x = -swing;
      v.leftArm.rotation.x = -swing * 0.7;
      v.rightArm.rotation.x = swing * 0.7;
    }
  }

  private build(data: SourceVisitor): RuntimeVisitor {
    const g = new THREE.Group();
    g.name = `visitor:${data.id}`;
    const route = visitorRouteForVNext(data.id);
    const start = route[0];
    g.position.set(start[0], start[1], start[2]);
    const anatomy = new Set<string>([
      'pelvis', 'torso', 'head', 'hair', 'eye-left', 'eye-right',
      'upper-arm-left', 'lower-arm-left', 'hand-left',
      'upper-arm-right', 'lower-arm-right', 'hand-right',
      'upper-leg-left', 'lower-leg-left', 'foot-left',
      'upper-leg-right', 'lower-leg-right', 'foot-right',
    ]);
    const h = data.height;
    const w = data.width;
    const seated = !!data.seated;
    const coat = this.mat(rgb(data.palette.coat, 0x4a5460));
    const trousers = this.mat(rgb(data.palette.trousers, 0x3a3a44));
    const skin = this.mat(rgb(data.palette.skin, 0xc4a07a));
    const hair = this.mat(rgb(data.palette.hair, 0x2a2420));
    const shirt = this.mat(rgb(data.palette.shirt, 0x6a5a52));
    const dark = this.mat(0x161616);

    const pelvis = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.31 * w, 0.24, 0.22)), trousers);
    pelvis.name = 'pelvis';
    pelvis.position.y = seated ? 0.78 : 0.88;
    g.add(pelvis);
    const torso = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.23 * w, 0.30 * w, 0.58 * h, 10)), coat);
    torso.name = 'torso';
    torso.position.y = seated ? 1.1 : 1.2;
    g.add(torso);
    const headY = seated ? 1.49 : 1.66;
    const head = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.22 * w, 14, 10)), skin);
    head.name = 'head';
    head.position.y = headY;
    g.add(head);
    const hairMesh = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.225 * w, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.54)), hair);
    hairMesh.name = 'hair';
    hairMesh.position.set(0, headY + 0.055, 0);
    g.add(hairMesh);
    for (const [name, sx] of [['eye-left', -1], ['eye-right', 1]] as const) {
      const eye = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.026, 8, 6)), dark);
      eye.name = name;
      eye.position.set(sx * 0.075 * w, headY + 0.015, 0.205 * w);
      g.add(eye);
    }
    if (data.staff) {
      const badge = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.12, 0.16, 0.018)), this.mat(0xb89a4a));
      badge.name = 'staff-badge';
      badge.position.set(0.15, 1.28, 0.23);
      g.add(badge);
      anatomy.add('staff-badge');
    }

    const makeArm = (side: number, name: string) => {
      const arm = new THREE.Group();
      arm.name = name;
      const upper = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.052, 0.057, 0.32 * h, 8)), shirt);
      upper.name = `upper-arm-${side < 0 ? 'left' : 'right'}`;
      upper.position.y = -0.15 * h;
      const lower = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.045, 0.05, 0.29 * h, 8)), shirt);
      lower.name = `lower-arm-${side < 0 ? 'left' : 'right'}`;
      lower.position.y = -0.43 * h;
      const hand = new THREE.Mesh(this.scope.track(new THREE.SphereGeometry(0.058, 8, 6)), skin);
      hand.name = `hand-${side < 0 ? 'left' : 'right'}`;
      hand.position.y = -0.61 * h;
      arm.add(upper, lower, hand);
      arm.position.set(side * 0.31 * w, 1.38 * h, 0);
      arm.rotation.z = side * 0.09;
      g.add(arm);
      return arm;
    };
    const leftArm = makeArm(-1, 'arm-left');
    const rightArm = makeArm(1, 'arm-right');

    const makeLeg = (side: number, name: string) => {
      const leg = new THREE.Group();
      leg.name = name;
      const upper = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.067, 0.073, 0.36 * h, 8)), trousers);
      upper.name = `upper-leg-${side < 0 ? 'left' : 'right'}`;
      const lower = new THREE.Mesh(this.scope.track(new THREE.CylinderGeometry(0.06, 0.065, 0.35 * h, 8)), trousers);
      lower.name = `lower-leg-${side < 0 ? 'left' : 'right'}`;
      const foot = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.13, 0.09, 0.25)), dark);
      foot.name = `foot-${side < 0 ? 'left' : 'right'}`;
      if (seated) {
        upper.rotation.x = -Math.PI / 2;
        upper.position.set(0, -0.02, 0.17);
        lower.position.set(0, -0.31, 0.35);
        foot.position.set(0, -0.51, 0.43);
      } else {
        upper.position.y = -0.17 * h;
        lower.position.y = -0.52 * h;
        foot.position.set(0, -0.73 * h, 0.07);
      }
      leg.add(upper, lower, foot);
      leg.position.set(side * 0.12 * w, seated ? 0.83 : 0.83, 0);
      g.add(leg);
      return leg;
    };
    const leftLeg = makeLeg(-1, 'leg-left');
    const rightLeg = makeLeg(1, 'leg-right');

    const prop = new THREE.Mesh(this.scope.track(new THREE.BoxGeometry(0.22, 0.04, 0.16)), this.mat(0x2a2420));
    prop.name = `prop:${data.prop || 'folio'}`;
    prop.position.set(seated ? 0 : 0.26, seated ? 1.08 : 1.04, seated ? 0.34 : 0.26);
    g.add(prop);

    const hit = new THREE.Mesh(
      this.scope.track(new THREE.CylinderGeometry(0.36, 0.36, seated ? 1.2 : 1.72, 8)),
      this.scope.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false })),
    );
    hit.position.y = seated ? 0.72 : 0.92;
    hit.userData = { kind: 'visitor', id: data.id };
    g.add(hit);

    return {
      data, group: g, hit, route, routeIndex: 1 % Math.max(1, route.length),
      pause: seated ? Infinity : 0, lineIndex: 0, phase: 0,
      leftArm, rightArm, leftLeg, rightLeg, anatomy,
    };
  }

  private mat(color: number): THREE.MeshStandardMaterial {
    return this.scope.track(new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.01 }));
  }

  dispose(): void {
    for (const fn of this.unbind) fn();
    this.group.removeFromParent();
  }
}

function countMeshes(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((node) => { if ((node as THREE.Mesh).isMesh) n += 1; });
  return n;
}
