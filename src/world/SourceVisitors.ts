import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { CollisionWorld } from './CollisionWorld';
import { INTERACTION_ONLY_LAYER, type InteractionManager } from '../interaction/InteractionManager';
import { SOURCE_VISITORS, visitorRouteForVNext, type SourceVisitor } from '../content/sourceParity';
import type { Vec3 } from './layout';
import { radialFloorMask } from './RadialFloorMask';

import { createVisitorGeometry, visitorColor, visitorStyle } from './VisitorVisuals';
import { bakedVisitorGeometry } from './VisitorGeometryBake';

interface VisitorPart {
  readonly node: THREE.Object3D;
  readonly instanceId: number;
}

interface RuntimeVisitor {
  shadowIndex: number;
  data: SourceVisitor;
  group: THREE.Group;
  hit: THREE.Object3D;
  route: Vec3[];
  routeIndex: number;
  pause: number;
  lineIndex: number;
  phase: number;
  farElapsed: number;
  visualElapsed: number;
  armRest: number;
  holdsProp: boolean;
  followsSlope: boolean;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  anatomy: Set<string>;
  parts: VisitorPart[];
}

const FAR_VISITOR_DISTANCE_SQ = 70 * 70;
const FAR_VISITOR_UPDATE_INTERVAL = 0.1;
const NEAR_VISUAL_INTERVAL = 1 / 30;
const CONVERSATION_VISUAL_INTERVAL = 1 / 60;
const CONVERSATION_DISTANCE_SQ = 12 * 12;
const SOURCE_VISITOR_INSTANCE_COUNT = SOURCE_VISITORS.reduce(
  (sum, visitor) => sum + 19 + (visitor.staff ? 1 : 0),
  0,
);

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
  readonly shadows: THREE.InstancedMesh;
  private readonly visitors: RuntimeVisitor[] = [];
  private readonly unbind: (() => void)[] = [];
  private disposed = false;
  private readonly collisionProbeX = { x: 0, y: 0, z: 0 };
  private readonly collisionProbeZ = { x: 0, y: 0, z: 0 };
  private readonly batchRootInverse = new THREE.Matrix4();
  private readonly batchMatrix = new THREE.Matrix4();
  private readonly colorScratch = new THREE.Color();
  private readonly shadowPose = new THREE.Object3D();
  private readonly geometryIds: Record<string, number>;
  private readonly hitGeometry: THREE.CylinderGeometry;
  private readonly hitMaterial: THREE.MeshBasicMaterial;

  constructor(
    private readonly scope: ResourceScope,
    private readonly collisions: CollisionWorld,
    interaction: InteractionManager,
    private readonly onSpeak: (visitor: SourceVisitor, line: string, thought?: string) => void,
    /** Kits prepared ahead by prepareVisitorGeometry; this class takes ownership. */
    preparedGeometries?: Record<string, THREE.BufferGeometry>,
  ) {
    this.group.name = 'source-visitors';

    const { batch, geometryIds } = this.buildBatch(preparedGeometries ?? bakedVisitorGeometry() ?? createVisitorGeometry(SOURCE_VISITORS));
    this.batch = batch;
    this.geometryIds = geometryIds;

    // One faint, grounded contact shadow per visitor. Instance transforms
    // follow the established body-visual cadence; collision and 60Hz paths
    // remain untouched. The same procedural alpha texture serves galleries.
    const shadowGeometry = this.scope.track(new THREE.PlaneGeometry(1.55, 1.12));
    shadowGeometry.rotateX(-Math.PI / 2);
    const shadowMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      color: 0x091017, alphaMap: radialFloorMask(this.scope),
      transparent: true, opacity: 0.43, depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this.shadows = this.scope.track(new THREE.InstancedMesh(
      shadowGeometry, shadowMaterial, SOURCE_VISITORS.length,
    ));
    this.shadows.name = 'authored-visitor-contact-shadows';
    this.shadows.renderOrder = 1;
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Visitors follow existing authored routes; avoid a stale shared bounding
    // sphere clipping shadow instances as they migrate between gallery zones.
    this.shadows.frustumCulled = false;
    this.group.add(this.batch, this.shadows);
    this.group.updateWorldMatrix(true, false);
    this.batchRootInverse.copy(this.group.matrixWorld).invert();

    // One shared hit primitive replaces 17 duplicate cylinders/materials. The
    // camera never renders layer 1, but InteractionManager raycasts it.
    this.hitGeometry = this.scope.track(new THREE.CylinderGeometry(1, 1, 1, 8));
    this.hitMaterial = this.scope.track(new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.001,
      depthWrite: false,
    }));

    const routes = SOURCE_VISITORS.map(({ id }) => visitorRouteForVNext(id));
    const usedStarts = new Map<string, number>();
    // A seated actor keeps their original anchor. Walkers sharing an anchor
    // start a little further along the same segment so all can be addressed
    // immediately, including when reduced motion leaves every actor at rest.
    for (const [index, data] of SOURCE_VISITORS.entries()) {
      if (data.seated) usedStarts.set(routes[index][0].join(','), 1);
    }
    try {
      for (const [index, data] of SOURCE_VISITORS.entries()) {
        const route = routes[index];
        const key = route[0].join(',');
        const rank = usedStarts.get(key) ?? 0;
        if (!data.seated) usedStarts.set(key, rank + 1);
        const runtime = this.build(data, index, route, data.seated ? 0 : rank);
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
    } catch (error) {
      // A failed build must leave nothing interactive behind.
      for (const unbind of this.unbind) unbind();
      this.unbind.length = 0;
      this.group.removeFromParent();
      throw error;
    }
  }

  /**
   * Builds from a kit prepared ahead of time. On any failure (including a scope
   * disposed while the kit was being prepared) the kit is released here, so the
   * caller cannot leak it and no partially built visitor stays registered.
   */
  static fromKit(
    scope: ResourceScope,
    collisions: CollisionWorld,
    interaction: InteractionManager,
    onSpeak: (visitor: SourceVisitor, line: string, thought?: string) => void,
    kit: Record<string, THREE.BufferGeometry>,
  ): SourceVisitors {
    try {
      return new SourceVisitors(scope, collisions, interaction, onSpeak, kit);
    } catch (error) {
      for (const geometry of Object.values(kit)) geometry.dispose();
      throw error;
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
    if (this.disposed) return null;
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
    if (this.disposed) return;
    let rootInverseCurrent = false;
    for (const v of this.visitors) {
      v.phase += dt;
      if (v.data.seated || reducedMotion) continue;

      let simDt = dt;
      let visualInterval = NEAR_VISUAL_INTERVAL;
      if (viewerX !== undefined && viewerZ !== undefined) {
        const dxView = v.group.position.x - viewerX;
        const dzView = v.group.position.z - viewerZ;
        const distanceSq = dxView * dxView + dzView * dzView;
        // Preserve expressive 60Hz animation in conversational proximity.
        if (distanceSq <= CONVERSATION_DISTANCE_SQ) visualInterval = CONVERSATION_VISUAL_INTERVAL;
        if (distanceSq > FAR_VISITOR_DISTANCE_SQ) {
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
      const moved = Math.hypot(probe.x - v.group.position.x, probeZ.z - v.group.position.z);
      v.group.position.x = probe.x;
      v.group.position.z = probeZ.z;
      if (v.followsSlope) {
        const feet = v.group.position;
        feet.y = this.collisions.supportHeight(feet.x, feet.z, feet.y, 0.25) ?? feet.y;
      }
      v.group.rotation.y = Math.atan2(dx, dz);
      const swing = Math.sin(v.phase * 7) * 0.27 * Math.min(1, moved / step);
      v.leftLeg.rotation.x = swing;
      v.rightLeg.rotation.x = -swing;
      v.leftArm.rotation.x = (v.data.gesture === 'point' ? -0.27 : 0) - swing * 0.62;
      v.rightArm.rotation.x = v.armRest + (v.holdsProp ? 0 : swing * 0.62);
      // Movement, collision and interaction proxies stay at fixed 60Hz.
      // Rewriting ~19 body matrices per visitor is presentation-only and
      // becomes a 30Hz near-field update, while far visitors stay ~10Hz.
      v.visualElapsed += simDt;
      if (v.visualElapsed + Number.EPSILON * 8 >= visualInterval) {
        if (!rootInverseCurrent) {
          this.group.updateWorldMatrix(true, false);
          this.batchRootInverse.copy(this.group.matrixWorld).invert();
          rootInverseCurrent = true;
        }
        this.syncVisitorVisual(v);
        v.visualElapsed = 0;
      }
    }
  }

  private buildBatch(geometries: Record<string, THREE.BufferGeometry>): {
    batch: THREE.BatchedMesh;
    geometryIds: Record<string, number>;
  } {
    const all = Object.values(geometries);
    const maxVertexCount = all.reduce((sum, geometry) => sum + geometry.getAttribute('position').count, 0);
    const maxIndexCount = all.reduce((sum, geometry) => sum + (geometry.index?.count ?? 0), 0);
    const material = this.scope.track(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
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

    const geometryIds: Record<string, number> = {};
    for (const [key, geometry] of Object.entries(geometries)) {
      // Prepared kits arrive with bounds; BatchedMesh computes any that are missing.
      geometryIds[key] = batch.addGeometry(geometry);
      geometry.dispose();
    }
    return { batch, geometryIds };
  }

  private build(data: SourceVisitor, shadowIndex: number, route: Vec3[], startRank: number): RuntimeVisitor {
    const g = new THREE.Group();
    g.name = `visitor:${data.id}`;
    const start = route[0];
    const next = route[1] ?? start;
    const segmentLength = Math.hypot(next[0] - start[0], next[2] - start[2]);
    const fraction = segmentLength > 0 ? Math.min(0.5, startRank * 1.25 / segmentLength) : 0;
    const x = THREE.MathUtils.lerp(start[0], next[0], fraction);
    const z = THREE.MathUtils.lerp(start[2], next[2], fraction);
    const floor = this.collisions.supportHeight(x, z, start[1], 0.075);
    const spawn = { x, y: floor ?? start[1], z };
    this.collisions.resolveHorizontal(spawn, 0.28, 1.6);
    if (floor !== null && Math.hypot(spawn.x - x, spawn.z - z) < 0.02) {
      g.position.set(x, floor, z);
    } else {
      g.position.set(start[0], this.collisions.supportHeight(start[0], start[2], start[1], 0.075) ?? start[1], start[2]);
    }
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
    const style = visitorStyle(data.id);
    const coat = visitorColor(data.palette.coat, 0x4a5460);
    const trousers = visitorColor(data.palette.trousers, 0x3a3a44);
    const skin = visitorColor(data.palette.skin, 0xc4a07a);
    const shirt = visitorColor(data.palette.shirt, 0x6a5a52);
    const dark = 0x302a26;
    const shoulderY = seated ? 1.02 : 1.47 * h;
    const armOffset = 0.213 * w * style.shoulder;
    const holdsProp = data.prop !== 'radio' && style.carry !== 'chest';
    const armRest = seated ? -0.72 : data.prop === 'cane' ? -0.08 : style.carry === 'low' ? -0.16 : -0.37;

    const pelvis = this.part(parts, g, 'pelvis', seated ? 'sketcher-seat' : 'pelvis', trousers);
    pelvis.position.y = seated ? 0.65 : 0.84 * h;
    if (!seated) pelvis.scale.set(0.159 * w, 0.118 * h, 0.125 * w);

    const torso = this.part(parts, g, 'torso', data.id + ':torso');
    const torsoLength = (seated ? 0.48 : 0.61 * h) * style.length;
    torso.position.y = shoulderY + 0.035 - torsoLength * 0.5;
    torso.scale.set(0.238 * w * style.shoulder, torsoLength, 0.236 * w);
    if (seated) torso.rotation.x = -0.12;

    const headY = seated ? 1.215 : 1.65 * h;
    const headWidth = 0.125 * w * style.face;
    const headHeight = 0.151 * h;
    const headDepth = 0.131 * w;
    for (const key of ['head', 'hair'] as const) {
      const node = this.part(parts, g, key, data.id + ':' + key);
      node.position.set(0, headY, seated ? 0.075 : 0);
      node.scale.set(headWidth, headHeight, headDepth);
      if (seated) node.rotation.x = 0.17;
    }
    for (const [name, sx] of [['eye-left', -1], ['eye-right', 1]] as const) {
      const eye = this.part(parts, g, name, 'eye');
      eye.position.set(sx * 0.38 * headWidth, headY + (seated ? 0 : 0.015), 0.80 * headDepth + (seated ? 0.075 : 0));
      eye.scale.set(0.022, 0.018, 0.024);
    }

    if (data.staff) {
      const badge = this.part(parts, g, 'staff-badge', 'box', 0xb89a4a);
      badge.position.set(-0.103 * w, shoulderY - 0.18, 0.147 * w);
      badge.scale.set(0.063, 0.083, 0.012);
      anatomy.add('staff-badge');
    }

    const makeArm = (side: number, name: string) => {
      const arm = new THREE.Group();
      arm.name = name;
      const suffix = side < 0 ? 'left' : 'right';

      const sleeve = style.garment === 'vest' ? shirt : coat;
      const upper = this.part(parts, arm, `upper-arm-${suffix}`, 'upperArm', sleeve);
      upper.position.y = -0.13 * h;
      upper.scale.set(0.067 * w, 0.29 * h, 0.067 * w);

      const lower = this.part(parts, arm, `lower-arm-${suffix}`, 'lowerArm', sleeve);
      lower.position.set(0, -0.382 * h, 0.027);
      lower.rotation.x = -0.18;
      lower.scale.set(0.051 * w, 0.265 * h, 0.051 * w);

      const hand = this.part(parts, arm, `hand-${suffix}`, 'round', skin);
      hand.position.set(0, -0.54 * h, 0.049);
      hand.scale.set(0.042 * w, 0.061 * h, 0.031);

      arm.position.set(side * armOffset, shoulderY, seated ? 0.06 : 0);
      arm.rotation.z = side * (seated ? -0.27 : 0.12);
      arm.rotation.x = seated || side > 0 ? armRest : data.gesture === 'point' ? -0.27 : 0;

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

      const foot = this.part(parts, leg, `foot-${suffix}`, 'shoe', dark);
      foot.scale.set(0.13, 0.09, 0.25);

      if (seated) {
        upper.rotation.x = -Math.PI / 2;
        upper.position.set(0, -0.01, 0.145);
        lower.position.set(0, -0.287, 0.30);
        lower.scale.y = 0.55;
        foot.position.set(0, -0.59, 0.37);
      } else {
        upper.position.y = -0.165 * h;
        lower.position.y = -0.532 * h;
        lower.scale.y = 0.39 * h;
        foot.position.set(0, -0.78 * h, 0.055);
      }
      leg.position.set(side * 0.098 * w, seated ? 0.635 : 0.83 * h, 0);
      g.add(leg);
      return leg;
    };
    const leftLeg = makeLeg(-1, 'leg-left');
    const rightLeg = makeLeg(1, 'leg-right');

    const prop = this.part(parts, holdsProp && !seated && data.prop !== 'cane' ? rightArm : g,
      `prop:${data.prop || 'folio'}`, data.id + ':prop');
    if (seated) {
      prop.position.set(0, 0.719, 0.386);
      prop.rotation.x = -1.20;
    } else if (data.prop === 'cane') {
      prop.position.set(armOffset + 0.06, 0.766, 0.094);
      // Keep the cane within reach with its ferrule on the floor.
      rightArm.position.y -= 0.09;
    } else if (style.carry === 'chest') {
      prop.position.set(data.prop === 'radio' ? 0.10 : 0, shoulderY - 0.209, 0.173);
    } else {
      prop.position.set(-0.036, -0.54 * h, 0.073);
      if (data.prop !== 'toolkit' && data.prop !== 'lantern') prop.rotation.x = 0.46;
    }

    const hit = new THREE.Mesh(this.hitGeometry, this.hitMaterial);
    hit.position.y = seated ? 0.72 : 0.92;
    hit.scale.set(0.36, seated ? 1.2 : 1.72, 0.36);
    hit.layers.set(INTERACTION_ONLY_LAYER);
    hit.userData = { kind: 'visitor', id: data.id };
    g.add(hit);

    return {
      shadowIndex, data, group: g, hit, route, routeIndex: 1 % Math.max(1, route.length),
      pause: seated ? Infinity : 0, lineIndex: 0, phase: 0, farElapsed: 0, visualElapsed: 0,
      leftArm, rightArm, leftLeg, rightLeg, anatomy, parts, armRest, holdsProp,
      followsSlope: route.some((point) => point[1] !== start[1]),
    };
  }

  private part(
    parts: VisitorPart[],
    parent: THREE.Object3D,
    name: string,
    geometry: string,
    color = 0xffffff,
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
    visitor.group.updateWorldMatrix(true, true);
    for (const part of visitor.parts) {
      this.batchMatrix.copy(this.batchRootInverse).multiply(part.node.matrixWorld);
      this.batch.setMatrixAt(part.instanceId, this.batchMatrix);
    }

    const position = visitor.group.position;
    this.shadowPose.position.set(position.x, position.y + 0.028, position.z);
    this.shadowPose.scale.set(visitor.data.width, 1, visitor.data.width);
    this.shadowPose.updateMatrix();
    this.shadows.setMatrixAt(visitor.shadowIndex, this.shadowPose.matrix);
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    // Idempotent: a second call (or a scope teardown after this) is a no-op.
    this.disposed = true;
    for (const fn of this.unbind.splice(0)) fn();
    this.group.removeFromParent();
  }
}
