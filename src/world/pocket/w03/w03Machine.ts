import * as THREE from 'three';
import type { Wall } from '../../CollisionWorld';
import type { PocketWorldContext } from '../types';
import { inRect } from '../kit/worldKit';
import {
  ARM_HALF_LENGTH, ARM_HALF_WIDTH, ARM_HUB, armAligned, armAngle, CROWN_RAMP, ESCAPEMENT_GALLERY, FORECAST_GALLERY,
  GEAR_CENTER, GEAR_RADIUS, gearAngle, LIFT, LIFT_TOP, liftPhase, liftY, ORRERY_LANDING, PLAZA,
  SHUTTLE_DOCK_A, SHUTTLE_DOCK_B, SHUTTLE_LENGTH, SHUTTLE_X, shuttleDock, shuttleZ,
} from './w03Layout';

export type Ride = 'arm' | 'lift' | 'shuttle' | 'gear' | null;

/** A toothed gear outline: `teeth` trapezoid teeth between `root` and `outer` radius. */
export function gearShape(outer: number, root: number, teeth: number, hole = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [root, a], [outer, a + step * 0.18], [outer, a + step * 0.5], [root, a + step * 0.68],
    ];
    pts.forEach(([r, ang], k) => {
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  return shape;
}

/** Extrude a shape downward from y=0 (top face at 0, bottom at -depth), shape y → world z. */
export function extrudeDown(shape: THREE.Shape, depth: number, curveSegments = 6): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.rotateX(Math.PI / 2);
  return g;
}

function orientedWall(cx: number, cz: number, halfX: number, halfZ: number, yaw: number, minY: number, maxY: number): Wall {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const ex = c * halfX + s * halfZ, ez = s * halfX + c * halfZ;
  return {
    kind: 'wall', minX: cx - ex, maxX: cx + ex, minY, maxY, minZ: cz - ez, maxZ: cz + ez,
    oriented: { centerX: cx, centerZ: cz, halfX, halfZ, yaw },
  };
}

function box(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Wall {
  return { kind: 'wall', minX, maxX, minY, maxY, minZ, maxZ };
}

export interface MachineMaterials {
  readonly brass: THREE.Material;
  readonly iron: THREE.Material;
  readonly plate: THREE.Material;
}

/**
 * The four moving supports of W03. Machine time advances only in the fixed
 * step; every collider, every visual and every forecast lamp is a function of
 * that one clock. A visitor standing on a moving support is carried with it
 * (position, and facing for rotating supports), and every edge that is not
 * meeting a landing is walled, so no timing mistake can drop anyone.
 *
 * Reduced motion: the turnstile stays aligned and the crown gear stops; the
 * lift and shuttle keep their gentle linear schedules (no camera rotation).
 */
export function buildW03Machine(ctx: PocketWorldContext, mats: MachineMaterials) {
  const { scope, collision, root, player } = ctx;
  let t = 0;
  let armA = 0;
  let reducedArm: number | null = null;
  let gearA = 0;
  let reducedGear: number | null = null;
  let liftAt = 0;
  let shuttleAt = SHUTTLE_DOCK_A;
  let riding: Ride = null;
  const [hx, hz] = ARM_HUB;

  // ---- Turnstile arm: a deck with arc ends so it never sweeps past radius 9.
  const armShape = new THREE.Shape();
  const endHalf = Math.asin(ARM_HALF_WIDTH / ARM_HALF_LENGTH);
  armShape.absarc(0, 0, ARM_HALF_LENGTH, -endHalf, endHalf, false);
  armShape.absarc(0, 0, ARM_HALF_LENGTH, Math.PI - endHalf, Math.PI + endHalf, false);
  armShape.closePath();
  const armDeck = new THREE.Mesh(scope.track(extrudeDown(armShape, 0.7, 12)), mats.plate);
  // Shape x runs along the arm; rotate so local +z is the arm direction at angle 0.
  armDeck.geometry.rotateY(-Math.PI / 2);
  const arm = new THREE.Group();
  arm.position.set(hx, 0, hz);
  arm.add(armDeck);
  const armRailGeo = scope.track(new THREE.BoxGeometry(0.14, 0.12, ARM_HALF_LENGTH * 1.92));
  const armPostGeo = scope.track(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 6));
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(armRailGeo, mats.brass);
    rail.position.set(side * (ARM_HALF_WIDTH + 0.1), 1.05, 0);
    arm.add(rail);
    for (let k = -4; k <= 4; k++) {
      const post = new THREE.Mesh(armPostGeo, mats.brass);
      post.position.set(side * (ARM_HALF_WIDTH + 0.1), 0.52, k * 2.05);
      arm.add(post);
    }
  }
  const hubCap = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 24)), mats.brass);
  hubCap.position.y = 0.06;
  arm.add(hubCap);
  const armColumn = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.0, 1.6, 30, 16)), mats.iron);
  armColumn.position.set(hx, -15.7, hz);
  root.add(arm, armColumn);
  const insideArm = (x: number, z: number, a: number) => {
    const dx = x - hx, dz = z - hz;
    const across = dx * Math.cos(a) - dz * Math.sin(a);
    return Math.abs(across) <= ARM_HALF_WIDTH && dx * dx + dz * dz <= ARM_HALF_LENGTH * ARM_HALF_LENGTH;
  };
  collision.setDynamicFloor('w03-arm', {
    kind: 'floor', minX: hx - ARM_HALF_LENGTH, maxX: hx + ARM_HALF_LENGTH, minZ: hz - ARM_HALF_LENGTH, maxZ: hz + ARM_HALF_LENGTH, y: 0,
    contains: (x, z) => insideArm(x, z, armA),
  });

  // ---- Piston lift.
  const liftDeck = new THREE.Mesh(scope.track(new THREE.BoxGeometry(LIFT.maxX - LIFT.minX, 0.5, LIFT.maxZ - LIFT.minZ)), mats.plate);
  const liftPiston = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.7, 0.7, 1, 14)), mats.brass);
  const liftSleeve = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.1, 1.3, 24, 14)), mats.iron);
  const liftCx = (LIFT.minX + LIFT.maxX) / 2, liftCz = (LIFT.minZ + LIFT.maxZ) / 2;
  liftSleeve.position.set(liftCx, -13, liftCz);
  root.add(liftDeck, liftPiston, liftSleeve);

  // ---- Escapement shuttle on twin rails.
  const shuttleDeck = new THREE.Mesh(scope.track(new THREE.BoxGeometry(SHUTTLE_X[1] - SHUTTLE_X[0], 0.5, SHUTTLE_LENGTH)), mats.plate);
  const shuttleCx = (SHUTTLE_X[0] + SHUTTLE_X[1]) / 2;
  root.add(shuttleDeck);
  const trackLen = Math.abs(SHUTTLE_DOCK_B - SHUTTLE_DOCK_A) + SHUTTLE_LENGTH;
  const trackGeo = scope.track(new THREE.BoxGeometry(0.22, 0.3, trackLen));
  for (const x of [SHUTTLE_X[0] + 0.5, SHUTTLE_X[1] - 0.5]) {
    const track = new THREE.Mesh(trackGeo, mats.iron);
    track.position.set(x, 4.45, (SHUTTLE_DOCK_A + SHUTTLE_DOCK_B) / 2);
    root.add(track);
  }

  // ---- Crown gear: a continuously turning toothed disc between landing and ramp.
  const gear = new THREE.Mesh(scope.track(extrudeDown(gearShape(GEAR_RADIUS, GEAR_RADIUS - 0.45, 40), 0.9, 4)), mats.plate);
  gear.position.set(GEAR_CENTER[0], 5, GEAR_CENTER[1]);
  const gearInlay = new THREE.Mesh(scope.track(new THREE.RingGeometry(2.2, 6.4, 40, 1)), mats.brass);
  gearInlay.rotation.x = -Math.PI / 2;
  gearInlay.position.y = 0.015;
  gear.add(gearInlay);
  const spokeGeo = scope.track(new THREE.BoxGeometry(0.35, 0.03, 6.2));
  for (let k = 0; k < 6; k++) {
    const spoke = new THREE.Mesh(spokeGeo, mats.iron);
    spoke.rotation.y = (k / 6) * Math.PI;
    spoke.position.y = 0.03;
    gear.add(spoke);
  }
  root.add(gear);
  collision.addMaskedFloor(GEAR_CENTER[0] - GEAR_RADIUS, GEAR_CENTER[0] + GEAR_RADIUS, GEAR_CENTER[1] - GEAR_RADIUS, GEAR_CENTER[1] + GEAR_RADIUS, 5,
    (x, z) => (x - GEAR_CENTER[0]) ** 2 + (z - GEAR_CENTER[1]) ** 2 <= GEAR_RADIUS * GEAR_RADIUS);
  // Static guard ring with openings toward the Orrery Landing (+z) and the crown ramp (-x).
  const ringSegs = 30;
  const ringPostGeo = scope.track(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6));
  const ringPosts = new THREE.InstancedMesh(ringPostGeo, mats.brass, ringSegs);
  const ringRails = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(0.12, 0.1, 1)), mats.brass, ringSegs);
  let ringPostCount = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < ringSegs; i++) {
    const a = ((i + 0.5) / ringSegs) * Math.PI * 2;
    const toLanding = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)));
    const toRamp = Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI)));
    if (toLanding < 0.42 || toRamp < 0.42) continue;
    const r = GEAR_RADIUS + 0.2;
    const cx = GEAR_CENTER[0] + Math.cos(a) * r, cz = GEAR_CENTER[1] + Math.sin(a) * r;
    const half = Math.PI * r / ringSegs;
    // Segment runs tangentially: local z along the tangent.
    // Oriented local z = (sin yaw, cos yaw); the tangent at bearing a is (-sin a, cos a), so yaw = -a.
    collision.add(orientedWall(cx, cz, 0.15, half, -a, 4.4, 6.2));
    ringRails.setMatrixAt(ringPostCount, m.compose(new THREE.Vector3(cx, 6.08, cz), q.setFromAxisAngle(yAxis, -a), new THREE.Vector3(1, 1, half * 2)));
    ringPosts.setMatrixAt(ringPostCount++, m.makeTranslation(cx, 5.55, cz));
  }
  ringPosts.count = ringPostCount;
  ringRails.count = ringPostCount;
  root.add(ringPosts, ringRails);

  const reduced = () => ctx.reducedMotion();
  const shuttleRect = (z: number) => ({ minX: SHUTTLE_X[0], maxX: SHUTTLE_X[1], minZ: z - SHUTTLE_LENGTH / 2, maxZ: z + SHUTTLE_LENGTH / 2 });

  const applyColliders = () => {
    const aligned = reduced() || armAligned(t);
    const ca = Math.cos(armA), sa = Math.sin(armA);
    for (const side of [-1, 1]) {
      const off = side * (ARM_HALF_WIDTH + 0.15);
      collision.setDynamicWall(`w03-arm-side-${side}`, orientedWall(hx + off * ca, hz - off * sa, 0.15, ARM_HALF_LENGTH - 0.3, armA, -1, 1.2));
      const along = side * (ARM_HALF_LENGTH - 0.15);
      collision.setDynamicWall(`w03-arm-end-${side}`, aligned ? null
        : orientedWall(hx + along * sa, hz + along * ca, ARM_HALF_WIDTH, 0.15, armA, -1, 1.2));
    }
    collision.setDynamicWall('w03-gate-plaza', aligned ? null : box(-2.2, 2.2, -1, 2.5, PLAZA.minZ, PLAZA.minZ + 0.3));
    collision.setDynamicWall('w03-gate-gallery', aligned ? null : box(-2.2, 2.2, -1, 2.5, FORECAST_GALLERY.maxZ - 0.3, FORECAST_GALLERY.maxZ));

    const ly = liftAt;
    const phase = liftPhase(t);
    collision.setDynamicFloor('w03-lift', { kind: 'floor', ...LIFT, y: ly });
    collision.setDynamicWall('w03-lift-n', box(LIFT.minX, LIFT.maxX, ly - 0.3, ly + 1.3, LIFT.minZ - 0.3, LIFT.minZ));
    collision.setDynamicWall('w03-lift-s', box(LIFT.minX, LIFT.maxX, ly - 0.3, ly + 1.3, LIFT.maxZ, LIFT.maxZ + 0.3));
    collision.setDynamicWall('w03-lift-w', phase === 'bottom' ? null : box(LIFT.minX, LIFT.minX + 0.25, ly - 0.3, ly + 1.3, LIFT.minZ, LIFT.maxZ));
    collision.setDynamicWall('w03-lift-e', phase === 'top' ? null : box(LIFT.maxX - 0.25, LIFT.maxX, ly - 0.3, ly + 1.3, LIFT.minZ, LIFT.maxZ));
    collision.setDynamicWall('w03-gate-lift-low', phase === 'bottom' ? null : box(LIFT.minX - 0.3, LIFT.minX, -1, 2.5, LIFT.minZ, LIFT.maxZ));
    collision.setDynamicWall('w03-gate-lift-high', phase === 'top' ? null : box(LIFT.maxX, LIFT.maxX + 0.3, LIFT_TOP - 0.5, LIFT_TOP + 2.5, LIFT.minZ, LIFT.maxZ));

    const sz = shuttleAt;
    const dock = shuttleDock(t);
    const r = shuttleRect(sz);
    collision.setDynamicFloor('w03-shuttle', { kind: 'floor', ...r, y: 5 });
    collision.setDynamicWall('w03-shuttle-w', box(r.minX - 0.3, r.minX, 4.4, 6.4, r.minZ, r.maxZ));
    collision.setDynamicWall('w03-shuttle-e', box(r.maxX, r.maxX + 0.3, 4.4, 6.4, r.minZ, r.maxZ));
    collision.setDynamicWall('w03-shuttle-n', dock === 'B' ? null : box(r.minX, r.maxX, 4.4, 6.4, r.minZ - 0.3, r.minZ));
    collision.setDynamicWall('w03-shuttle-s', dock === 'A' ? null : box(r.minX, r.maxX, 4.4, 6.4, r.maxZ, r.maxZ + 0.3));
    collision.setDynamicWall('w03-gate-escapement', dock === 'A' ? null
      : box(SHUTTLE_X[0], SHUTTLE_X[1], 4.4, 7.5, ESCAPEMENT_GALLERY.minZ, ESCAPEMENT_GALLERY.minZ + 0.3));
    collision.setDynamicWall('w03-gate-orrery', dock === 'B' ? null
      : box(SHUTTLE_X[0], SHUTTLE_X[1], 4.4, 7.5, ORRERY_LANDING.maxZ - 0.3, ORRERY_LANDING.maxZ));
  };

  const syncVisuals = () => {
    arm.rotation.y = armA;
    liftDeck.position.set(liftCx, liftAt - 0.25, liftCz);
    const pistonLen = Math.max(0.1, liftAt + 1.5);
    liftPiston.scale.y = pistonLen;
    liftPiston.position.set(liftCx, liftAt - 0.5 - pistonLen / 2, liftCz);
    shuttleDeck.position.set(shuttleCx, 4.75, shuttleAt);
    gear.rotation.y = gearA;
  };

  const sample = () => {
    const a = armAngle(t);
    if (reduced()) { reducedArm ??= Math.round(armA / Math.PI) * Math.PI; armA = reducedArm; } else { reducedArm = null; armA = a; }
    if (reduced()) { reducedGear ??= gearA; gearA = reducedGear; } else { reducedGear = null; gearA = gearAngle(t); }
    liftAt = liftY(t);
    shuttleAt = shuttleZ(t);
  };
  sample();
  applyColliders();
  syncVisuals();

  /** Rotate the rider about (cx, cz) by `delta`, turning their facing with the support. */
  const carryRotate = (cx: number, cz: number, delta: number) => {
    if (delta === 0) return;
    const p = player.position;
    const dx = p.x - cx, dz = p.z - cz;
    const c = Math.cos(delta), s = Math.sin(delta);
    player.shift(dx * c + dz * s - dx, 0, dz * c - dx * s - dz);
    player.yaw += delta;
  };

  return {
    get t() { return t; },
    get riding(): Ride { return riding; },
    get armAngle() { return armA; },
    get liftY() { return liftAt; },
    get shuttleZ() { return shuttleAt; },
    get gearAngle() { return gearA; },
    armAlignedNow: () => reduced() || armAligned(t),
    fixedUpdate(dt: number): void {
      const p = player.position;
      const prev = { armA, liftAt, shuttleAt, gearA };
      // Who is the visitor standing on, before the machine moves?
      riding = null;
      if (player.grounded) {
        const onLanding = inRect(PLAZA, p.x, p.z) || inRect(FORECAST_GALLERY, p.x, p.z);
        if (!onLanding && Math.abs(p.y) < 0.3 && insideArm(p.x, p.z, armA)) riding = 'arm';
        else if (inRect(LIFT, p.x, p.z) && Math.abs(p.y - liftAt) < 0.3) riding = 'lift';
        else if (inRect(shuttleRect(shuttleAt), p.x, p.z) && Math.abs(p.y - 5) < 0.3) riding = 'shuttle';
        else if (Math.abs(p.y - 5) < 0.3 && !inRect(ORRERY_LANDING, p.x, p.z) && !inRect(CROWN_RAMP, p.x, p.z)
          && (p.x - GEAR_CENTER[0]) ** 2 + (p.z - GEAR_CENTER[1]) ** 2 <= (GEAR_RADIUS - 0.2) ** 2) riding = 'gear';
      }
      t += dt;
      sample();
      if (riding === 'arm') carryRotate(hx, hz, armA - prev.armA);
      else if (riding === 'lift') player.shift(0, liftAt - prev.liftAt, 0);
      else if (riding === 'shuttle') player.shift(0, 0, shuttleAt - prev.shuttleAt);
      else if (riding === 'gear') carryRotate(GEAR_CENTER[0], GEAR_CENTER[1], gearA - prev.gearA);
      applyColliders();
    },
    syncVisuals,
    /** Pure collider probe for tests: the arm deck mask at the current angle. */
    insideArm: (x: number, z: number) => insideArm(x, z, armA),
    dispose(): void {
      for (const id of ['w03-arm', 'w03-lift', 'w03-shuttle']) collision.setDynamicFloor(id, null);
      for (const id of ['w03-arm-side--1', 'w03-arm-side-1', 'w03-arm-end--1', 'w03-arm-end-1', 'w03-gate-plaza', 'w03-gate-gallery',
        'w03-lift-n', 'w03-lift-s', 'w03-lift-w', 'w03-lift-e', 'w03-gate-lift-low', 'w03-gate-lift-high',
        'w03-shuttle-w', 'w03-shuttle-e', 'w03-shuttle-n', 'w03-shuttle-s', 'w03-gate-escapement', 'w03-gate-orrery']) {
        collision.setDynamicWall(id, null);
      }
    },
  };
}

export type W03Machine = ReturnType<typeof buildW03Machine>;
