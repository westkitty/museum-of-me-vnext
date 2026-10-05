import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import { INTERACTION_ONLY_LAYER, type InteractionManager } from '../interaction/InteractionManager';
import { SOURCE_VISITORS, visitorRouteForVNext, type SourceVisitor } from '../content/sourceParity';
import type { Vec3 } from './layout';

type VisitorGeometryKey = 'box' | 'torso' | 'upperArm' | 'lowerArm' | 'upperLeg' | 'lowerLeg' | 'head' | 'orb' | 'hair';

interface VisitorPart {
  readonly node: THREE.Object3D;
  readonly instanceId: number;
}

interface RuntimeVisitor {
  data: SourceVisitor;
  group: THREE.Group;
  hit: THREE.Object3D;
  route: Vec3[];
  routeIndex: number;
  pause: number;
  lineIndex: number;
  phase: number;
  farElapsed: number;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  anatomy: Set<string>;
  parts: VisitorPart[];
}

const FAR_VISITOR_DISTANCE_SQ = 70 * 70;
const FAR_VISITOR_UPDATE_INTERVAL = 0.1;
const SOURCE_VISITOR_INSTANCE_COUNT = SOURCE_VISITORS.reduce(
  (sum, visitor) => sum + 19 + (visitor.staff ? 1 : 0),
  0,
);

function rgb(c: number[] | undefined, fallback: number): number {
  if (!c || c.length < 3) return fallback;
  return (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);
}

/**
 * The 17 authored visitors/staff from the Reliquary source contract.
 * Ambient capsule walkers are not a substitute for these identities.
 *
 * Rendering law: authored identity stays object-per-visitor, but visible body
 * parts are submitted through one BatchedMesh. Semantic anatomy nodes remain
 * in each visitor hierarchy for inspection and animation; the GPU does not pay
 * one draw call per eye, hand, foot, prop, or torso.
 */
export class SourceVisitors {
  readonly group = new THREE.Group();
  readonly batch: THREE.BatchedMesh;
  private readonly visitors: RuntimeVisitor[] = [];
  private readonly unbind: (() => void)[] = [];
  private readonly collisionProbeX = { x: 0, y: 0, z: 0 };
  private readonly collisionProbeZ = { x: 0, y: 0, z: 0 };
  private readonly batchRootInverse = new THREE.Matrix4();
  private readonly batchMatrix = new THREE.Matrix4();
  private readonly colorScratch = new THREE.Color();
  private readonly geometryIds: Record<VisitorGeometryKey, number>;
  private readonly hitGeometry: THREE.CylinderGeometry;
  private readonly hitMaterial: THREE.MeshBasicMaterial;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collisions: CollisionWorld,
    interaction: InteractionManager,
    private readonly onSpeak: (visitor: SourceVisitor, line: string, thought?: string) => void,
  ) {
    this.group.name = 'source-visitors';

    const { batch, geometryIds } = this.buildBatch();
    this.batch = batch;
    this.geometryIds = geometryIds;
    this.group.add(this.batch);

    // One shared hit primitive replaces 17 duplicate cylinders/materials. The
    // camera never renders layer 1, but InteractionManager raycasts it.
    this.hitGeometry = this.scope.track(new THREE.CylinderGeometry(1, 1, 1, 8));
    this.hitMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.001,
      depthWrite: false,
    }));

    for (const data of SOURCE_VISITORS) {
      const runtime = this.build(data);
      this.visitors.push(runtime);
      this.group.add(runtime.group);
      this.syncVisitorVisual(runtime);
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

  positions(): Array<{ id: string; x: number; y: number; z: number; staff: boolean; kind: 'authored' }> {
    return this.visitors.map((v) => ({
      id: v.data.id,
      x: v.group.position.x,
      y: v.group.position.y,
      z: v.group.position.z,
      staff: !!v.data.staff,
      kind: 'authored' as const,
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
    const repeated = v.data.lines[v.lineIndex % v.data.lines.length] ?? null;
    return {
      role: `${v.data.title} · ${v.data.subtitle}`,
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
      // Preserve the proof surface as a physical-part count even though those
      // parts now share one renderer mesh.
      meshCount: v.parts.length + 1,
      interactive: !!v.hit.userData.interactive,
      heard: false,
    }));
  }

  update(dt: number, reducedMotion: boolean, viewerX?: number, viewerZ?: number): void {
    for (const v of this.visitors) {
      v.phase += dt;
      if (v.data.seated || reducedMotion) continue;

      let simDt = dt;
      if (viewerX !== undefined && viewerZ !== undefined) {
        const dxView = v.group.position.x - viewerX;
        const dzView = v.group.position.z - viewerZ;
        if (dxView * dxView + dzView * dzView > FAR_VISITOR_DISTANCE_SQ) {
          v.farElapsed += dt;
          if (v.farElapsed + Number.EPSILON * 8 < FAR_VISITOR_UPDATE_INTERVAL) continue;
          simDt = v.farElapsed;
          v.farElapsed = 0;
        } else if (v.farElapsed > 0) {
          simDt += v.farElapsed;
          v.farElapsed = 0;
        }
      }

      if (v.pause > 0) {
        v.pause -= simDt;
        continue;
      }
      const target = v.route[v.routeIndex];
      if (!target) continue;
      const dx = target[0] - v.group.position.x;
      const dz = target[2] - v.group.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < 0.18 * 0.18) {
        v.routeIndex = (v.routeIndex + 1) % v.route.length;
        const [min, max] = v.data.pause;
        v.pause = min + (max - min) * 0.5;
        continue;
      }
      const dist = Math.sqrt(distSq);
      const step = Math.min(dist, v.data.speed * simDt);
      const invDist = 1 / dist;
      const nx = v.group.position.x + dx * invDist * step;
      const nz = v.group.position.z + dz * invDist * step;
      const probe = this.collisionProbeX;
      probe.x = nx;
      probe.y = v.group.position.y;
      probe.z = v.group.position.z;
      this.collisions.resolveHorizontal(probe, 0.28, 1.6);
      const probeZ = this.collisionProbeZ;
      probeZ.x = v.group.position.x;
      probeZ.y = v.group.position.y;
      probeZ.z = nz;
      this.collisions.resolveHorizontal(probeZ, 0.28, 1.6);
      v.group.position.x = probe.x;
      v.group.position.z = probeZ.z;
      v.group.rotation.y = Math.atan2(dx, dz);
      const swing = Math.sin(v.phase * 7) * 0.34;
      v.leftLeg.rotation.x = swing;
      v.rightLeg.rotation.x = -swing;
      v.leftArm.rotation.x = -swing * 0.7;
      v.rightArm.rotation.x = swing * 0.7;
      this.syncVisitorVisual(v);
    }
  }

  private buildBatch(): {
    batch: THREE.BatchedMesh;
    geometryIds: Record<VisitorGeometryKey, number>;
  } {
    const geometries: Record<VisitorGeometryKey, THREE.BufferGeometry> = {
      box: new THREE.BoxGeometry(1, 1, 1),
      torso: new THREE.CylinderGeometry(0.23 / 0.30, 1, 1, 10),
      upperArm: new THREE.CylinderGeometry(0.052 / 0.057, 1, 1, 8),
      lowerArm: new THREE.CylinderGeometry(0.045 / 0.05, 1, 1, 8),
      upperLeg: new THREE.CylinderGeometry(0.067 / 0.073, 1, 1, 8),
      lowerLeg: new THREE.CylinderGeometry(0.06 / 0.065, 1, 1, 8),
      head: new THREE.SphereGeometry(1, 14, 10),
      orb: new THREE.SphereGeometry(1, 8, 6),
      hair: new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.54),
    };
    const all = Object.values(geometries);
    const maxVertexCount = all.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
    const maxIndexCount = all.reduce((sum, geometry) => sum + (geometry.index?.count ?? 0), 0);
    const material = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.74,
      metalness: 0.01,
    }));
    const batch = this.scope.track(new THREE.BatchedMesh(
      SOURCE_VISITOR_INSTANCE_COUNT,
      maxVertexCount,
      maxIndexCount,
      material,
    ));
    batch.name = 'source-visitors-batched-visuals';
    batch.castShadow = false;
    batch.receiveShadow = false;
    batch.perObjectFrustumCulled = true;

    const geometryIds = {} as Record<VisitorGeometryKey, number>;
    for (const [key, geometry] of Object.entries(geometries) as [VisitorGeometryKey, THREE.BufferGeometry][]) {
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometryIds[key] = batch.addGeometry(geometry);
      geometry.dispose();
    }
    return { batch, geometryIds };
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
    const parts: VisitorPart[] = [];
    const h = data.height;
    const w = data.width;
    const seated = !!data.seated;
    const coat = rgb(data.palette.coat, 0x4a5460);
    const trousers = rgb(data.palette.trousers, 0x3a3a44);
    const skin = rgb(data.palette.skin, 0xc4a07a);
    const hair = rgb(data.palette.hair, 0x2a2420);
    const shirt = rgb(data.palette.shirt, 0x6a5a52);
    const dark = 0x161616;

    this.part(parts, g, 'pelvis', 'box', trousers)
      .position.set(0, seated ? 0.78 : 0.88, 0);
    parts.at(-1)!.node.scale.set(0.31 * w, 0.24, 0.22);

    const torso = this.part(parts, g, 'torso', 'torso', coat);
    torso.position.y = seated ? 1.1 : 1.2;
    torso.scale.set(0.30 * w, 0.58 * h, 0.30 * w);

    const headY = seated ? 1.49 : 1.66;
    const head = this.part(parts, g, 'head', 'head', skin);
    head.position.y = headY;
    head.scale.setScalar(0.22 * w);

    const hairNode = this.part(parts, g, 'hair', 'hair', hair);
    hairNode.position.set(0, headY + 0.055, 0);
    hairNode.scale.setScalar(0.225 * w);

    for (const [name, sx] of [['eye-left', -1], ['eye-right', 1]] as const) {
      const eye = this.part(parts, g, name, 'orb', dark);
      eye.position.set(sx * 0.075 * w, headY + 0.015, 0.205 * w);
      eye.scale.setScalar(0.026);
    }

    if (data.staff) {
      const badge = this.part(parts, g, 'staff-badge', 'box', 0xb89a4a);
      badge.position.set(0.15, 1.28, 0.23);
      badge.scale.set(0.12, 0.16, 0.018);
      anatomy.add('staff-badge');
    }

    const makeArm = (side: number, name: string) => {
      const arm = new THREE.Group();
      arm.name = name;
      const suffix = side < 0 ? 'left' : 'right';

      const upper = this.part(parts, arm, `upper-arm-${suffix}`, 'upperArm', shirt);
      upper.position.y = -0.15 * h;
      upper.scale.set(0.057, 0.32 * h, 0.057);

      const lower = this.part(parts, arm, `lower-arm-${suffix}`, 'lowerArm', shirt);
      lower.position.y = -0.43 * h;
      lower.scale.set(0.05, 0.29 * h, 0.05);

      const hand = this.part(parts, arm, `hand-${suffix}`, 'orb', skin);
      hand.position.y = -0.61 * h;
      hand.scale.setScalar(0.058);

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
      const suffix = side < 0 ? 'left' : 'right';

      const upper = this.part(parts, leg, `upper-leg-${suffix}`, 'upperLeg', trousers);
      upper.scale.set(0.073, 0.36 * h, 0.073);

      const lower = this.part(parts, leg, `lower-leg-${suffix}`, 'lowerLeg', trousers);
      lower.scale.set(0.065, 0.35 * h, 0.065);

      const foot = this.part(parts, leg, `foot-${suffix}`, 'box', dark);
      foot.scale.set(0.13, 0.09, 0.25);

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
      leg.position.set(side * 0.12 * w, 0.83, 0);
      g.add(leg);
      return leg;
    };
    const leftLeg = makeLeg(-1, 'leg-left');
    const rightLeg = makeLeg(1, 'leg-right');

    const prop = this.part(parts, g, `prop:${data.prop || 'folio'}`, 'box', 0x2a2420);
    prop.position.set(seated ? 0 : 0.26, seated ? 1.08 : 1.04, seated ? 0.34 : 0.26);
    prop.scale.set(0.22, 0.04, 0.16);

    const hit = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
    hit.position.y = seated ? 0.72 : 0.92;
    hit.scale.set(0.36, seated ? 1.2 : 1.72, 0.36);
    hit.layers.set(INTERACTION_ONLY_LAYER);
    hit.userData = { kind: 'visitor', id: data.id };
    g.add(hit);

    return {
      data, group: g, hit, route, routeIndex: 1 % Math.max(1, route.length),
      pause: seated ? Infinity : 0, lineIndex: 0, phase: 0, farElapsed: 0,
      leftArm, rightArm, leftLeg, rightLeg, anatomy, parts,
    };
  }

  private part(
    parts: VisitorPart[],
    parent: THREE.Object3D,
    name: string,
    geometry: VisitorGeometryKey,
    color: number,
  ): THREE.Object3D {
    const node = new THREE.Object3D();
    node.name = name;
    parent.add(node);
    const instanceId = this.batch.addInstance(this.geometryIds[geometry]);
    this.batch.setColorAt(instanceId, this.colorScratch.setHex(color));
    parts.push({ node, instanceId });
    return node;
  }

  private syncVisitorVisual(visitor: RuntimeVisitor): void {
    this.group.updateWorldMatrix(true, false);
    visitor.group.updateWorldMatrix(true, true);
    this.batchRootInverse.copy(this.group.matrixWorld).invert();
    for (const part of visitor.parts) {
      this.batchMatrix.copy(this.batchRootInverse).multiply(part.node.matrixWorld);
      this.batch.setMatrixAt(part.instanceId, this.batchMatrix);
    }
  }

  dispose(): void {
    for (const fn of this.unbind) fn();
    this.group.removeFromParent();
  }
}
