import * as THREE from 'three';
import type { ResourceScope } from '../../../assets/ResourceScope';
import type { CollisionWorld } from '../../CollisionWorld';
import type { Vec3 } from '../../layout';
import type { W01ReefId } from './types';

export interface ReefAnchorNodes {
  readonly departurePylons: Record<W01ReefId, THREE.Object3D>;
  readonly returnBeacons: Record<W01ReefId, THREE.Object3D>;
  readonly envObjects: Record<W01ReefId, THREE.Object3D>;
  readonly musicianObjects: Record<W01ReefId, THREE.Object3D>;
  readonly cathedralAltar: THREE.Object3D;
}

export interface ReefVisualControls {
  setEnvActivated(reef: W01ReefId): void;
  setMusicianAwakened(reef: W01ReefId): void;
  setCathedralReady(ready: boolean): void;
  update(dt: number, reducedMotion: boolean): void;
}

export const W01_SPAWN_POSITION: Vec3 = [0, 0, 7];
export const W01_SPAWN_YAW = 0;

export const REEF_TERRACES: Record<W01ReefId, { readonly center: Vec3; readonly radius: number }> = {
  turtle: { center: [-68, 4, -54], radius: 14 },
  ray: { center: [68, 12, -52], radius: 14 },
  whale: { center: [0, -10, -112], radius: 16 },
};

/**
 * Builds the underwater ocean backdrop, caustic light shafts, Central Current
 * Station, and the three distinct coral habitats (Turtle, Ray, Whale Reefs)
 * with generous collision-supported walkable terraces.
 */
export function buildW01Environment(
  scope: ResourceScope,
  collision: CollisionWorld,
): { readonly root: THREE.Group; readonly anchors: ReefAnchorNodes; readonly visuals: ReefVisualControls } {
  const root = new THREE.Group();
  root.name = 'w01-ocean-environment';

  // Efficient underwater lighting: 1 Hemisphere + 1 Directional sunlight from above
  const hemi = new THREE.HemisphereLight(0x5ae2ff, 0x061b2e, 1.35);
  const sun = new THREE.DirectionalLight(0xaef7ff, 1.25);
  sun.position.set(18, 70, 24);
  root.add(hemi, sun);

  // Deep ocean gradient dome
  const skyMat = scope.track(new THREE.MeshBasicMaterial({
    color: 0x052136,
    side: THREE.BackSide,
    fog: false,
  }));
  const skyDome = new THREE.Mesh(scope.track(new THREE.SphereGeometry(260, 20, 14)), skyMat);
  skyDome.name = 'w01-ocean-dome';
  root.add(skyDome);

  // Distant ocean floor below all terraces (visual depth only)
  const abyssMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x071d30,
    roughness: 0.95,
  }));
  const abyssFloor = new THREE.Mesh(scope.track(new THREE.CircleGeometry(240, 32)), abyssMat);
  abyssFloor.rotation.x = -Math.PI / 2;
  abyssFloor.position.y = -24;
  root.add(abyssFloor);

  // Volumetric-style caustic light shafts descending from the lagoon surface
  const shaftGeo = scope.track(new THREE.CylinderGeometry(1.6, 5.5, 68, 10, 1, true));
  const shaftMat = scope.track(new THREE.MeshBasicMaterial({
    color: 0x7df5ff,
    transparent: true,
    opacity: 0.065,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  const shaftCoords: readonly [number, number][] = [
    [0, -18], [-32, -26], [34, -22], [-68, -54], [68, -52], [0, -108],
  ];
  for (const [sx, sz] of shaftCoords) {
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.set(sx, 16, sz);
    root.add(shaft);
  }

  // ── Central Current Station ([0, 0, 0], radius 13 m) ─────────────────────
  buildTerrace(root, scope, collision, 'central-station', [0, 0, 0], 13, 0x1d4d63, 0x2fd1c2);

  const pylonTurtle = buildControlPillar(root, scope, 'w01-pylon-turtle', [-7.5, 0, -2.5], 0x38e4ae, 2.2);
  const pylonRay = buildControlPillar(root, scope, 'w01-pylon-ray', [7.5, 0, -2.5], 0x67d4ff, 2.2);
  const pylonWhale = buildControlPillar(root, scope, 'w01-pylon-whale', [0, 0, -8.5], 0xffca6b, 2.2);

  const crystalMats: Record<W01ReefId, THREE.MeshStandardMaterial> = {
    turtle: buildResonanceCrystal(root, scope, [-3.2, 0, 2.2], 0x38e4ae),
    ray: buildResonanceCrystal(root, scope, [3.2, 0, 2.2], 0x67d4ff),
    whale: buildResonanceCrystal(root, scope, [0, 0, 3.8], 0xffca6b),
  };

  // Cathedral Convergence Altar at [0, 0, -3.5]
  const altarGroup = new THREE.Group();
  altarGroup.name = 'w01-cathedral-altar';
  altarGroup.position.set(0, 0, -3.5);
  const altarBaseMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x26546b,
    roughness: 0.7,
  }));
  const altarOrbMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x8ef7ff,
    emissive: 0x1e607a,
    emissiveIntensity: 0.35,
    roughness: 0.25,
  }));
  const altarPedestal = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.1, 1.45, 1.0, 12)), altarBaseMat);
  altarPedestal.position.y = 0.5;
  const altarOrb = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.55, 1)), altarOrbMat);
  altarOrb.position.y = 1.65;
  altarGroup.add(altarPedestal, altarOrb);
  root.add(altarGroup);

  // ── Turtle Reef ([-68, 4, -54], radius 14 m) ─────────────────────────────
  const tCenter = REEF_TERRACES.turtle.center;
  buildTerrace(root, scope, collision, 'turtle-reef', tCenter, REEF_TERRACES.turtle.radius, 0x255956, 0x38e4ae);
  // Rounded coral-stone terraces & resonance ring
  const turtleArchMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x2f7568,
    emissive: 0x0c2e26,
    emissiveIntensity: 0.2,
    roughness: 0.65,
  }));
  const turtleArch = new THREE.Mesh(scope.track(new THREE.TorusGeometry(6.5, 0.65, 10, 24, Math.PI)), turtleArchMat);
  turtleArch.position.set(tCenter[0], tCenter[1] + 0.2, tCenter[2] - 6);
  root.add(turtleArch);

  const envTurtle = buildControlPillar(root, scope, 'w01-env-turtle', [-72, 4, -54], 0x7effcf, 1.9);
  const musTurtle = buildControlPillar(root, scope, 'w01-musician-beacon-turtle', [-68, 4, -60], 0x38e4ae, 2.3);
  const retTurtle = buildControlPillar(root, scope, 'w01-return-turtle', [-60, 4, -54], 0x9ef7ff, 1.8);

  // ── Ray Reef ([68, 12, -52], radius 14 m) ────────────────────────────────
  const rCenter = REEF_TERRACES.ray.center;
  buildTerrace(root, scope, collision, 'ray-reef', rCenter, REEF_TERRACES.ray.radius, 0x204d73, 0x67d4ff);
  // Towering coral sails & translucent luminous arches
  const raySailMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x4fb4f2,
    emissive: 0x164a78,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.78,
    roughness: 0.3,
  }));
  const sailGeo = scope.track(new THREE.ConeGeometry(2.4, 11, 5));
  for (const offset of [-7, 7]) {
    const sail = new THREE.Mesh(sailGeo, raySailMat);
    sail.position.set(rCenter[0] + offset, rCenter[1] + 5.2, rCenter[2] - 5);
    sail.rotation.z = offset < 0 ? 0.14 : -0.14;
    root.add(sail);
  }

  const envRay = buildControlPillar(root, scope, 'w01-env-ray', [72, 12, -52], 0x91e4ff, 1.9);
  const musRay = buildControlPillar(root, scope, 'w01-musician-beacon-ray', [68, 12, -58], 0x67d4ff, 2.3);
  const retRay = buildControlPillar(root, scope, 'w01-return-ray', [60, 12, -52], 0x9ef7ff, 1.8);

  // ── Whale Reef ([0, -10, -112], radius 16 m) ─────────────────────────────
  const wCenter = REEF_TERRACES.whale.center;
  buildTerrace(root, scope, collision, 'whale-reef', wCenter, REEF_TERRACES.whale.radius, 0x1e3559, 0xffca6b);
  // Heavy fluted stone columns framing the deep illuminated chamber
  const colMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x2c476e,
    emissive: 0x14223b,
    emissiveIntensity: 0.25,
    roughness: 0.75,
  }));
  const colGeo = scope.track(new THREE.CylinderGeometry(1.1, 1.4, 15, 10));
  for (const [cx, cz] of [[-12, -106], [12, -106], [-13, -120], [13, -120]]) {
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(cx, wCenter[1] + 7.5, cz);
    root.add(col);
  }

  const envWhale = buildControlPillar(root, scope, 'w01-env-whale', [-6, -10, -112], 0xffe099, 1.9);
  const musWhale = buildControlPillar(root, scope, 'w01-musician-beacon-whale', [0, -10, -118], 0xffca6b, 2.3);
  const retWhale = buildControlPillar(root, scope, 'w01-return-whale', [6, -10, -104], 0x9ef7ff, 1.8);

  let pulseTime = 0;
  let cathedralReady = false;

  return {
    root,
    anchors: {
      departurePylons: { turtle: pylonTurtle.group, ray: pylonRay.group, whale: pylonWhale.group },
      returnBeacons: { turtle: retTurtle.group, ray: retRay.group, whale: retWhale.group },
      envObjects: { turtle: envTurtle.group, ray: envRay.group, whale: envWhale.group },
      musicianObjects: { turtle: musTurtle.group, ray: musRay.group, whale: musWhale.group },
      cathedralAltar: altarGroup,
    },
    visuals: {
      setEnvActivated(reef) {
        if (reef === 'turtle') {
          envTurtle.orbMat.emissiveIntensity = 1.6;
          turtleArchMat.emissiveIntensity = 0.75;
        } else if (reef === 'ray') {
          envRay.orbMat.emissiveIntensity = 1.6;
          raySailMat.emissiveIntensity = 0.85;
        } else {
          envWhale.orbMat.emissiveIntensity = 1.6;
          colMat.emissiveIntensity = 0.7;
        }
      },
      setMusicianAwakened(reef) {
        crystalMats[reef].emissiveIntensity = 1.65;
        if (reef === 'turtle') musTurtle.orbMat.emissiveIntensity = 1.65;
        if (reef === 'ray') musRay.orbMat.emissiveIntensity = 1.65;
        if (reef === 'whale') musWhale.orbMat.emissiveIntensity = 1.65;
      },
      setCathedralReady(ready) {
        cathedralReady = ready;
        altarOrbMat.emissiveIntensity = ready ? 1.55 : 0.35;
      },
      update(dt, reducedMotion) {
        if (reducedMotion) return;
        pulseTime += Math.max(0, dt);
        altarOrb.rotation.y = pulseTime * 0.75;
        altarOrb.position.y = 1.65 + Math.sin(pulseTime * 1.8) * (cathedralReady ? 0.16 : 0.06);
      },
    },
  };
}

function buildTerrace(
  root: THREE.Group,
  scope: ResourceScope,
  collision: CollisionWorld,
  name: string,
  center: Vec3,
  radius: number,
  stoneColor: number,
  trimColor: number,
): void {
  const [cx, cy, cz] = center;
  const stoneMat = scope.track(new THREE.MeshStandardMaterial({
    color: stoneColor,
    roughness: 0.82,
    metalness: 0.08,
  }));
  const trimMat = scope.track(new THREE.MeshStandardMaterial({
    color: trimColor,
    emissive: trimColor,
    emissiveIntensity: 0.32,
    roughness: 0.45,
  }));

  const slab = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(radius, radius + 1.4, 2.2, 24)), stoneMat);
  slab.name = `w01-terrace:${name}`;
  slab.position.set(cx, cy - 1.1, cz);
  slab.receiveShadow = true;
  root.add(slab);

  const rim = new THREE.Mesh(scope.track(new THREE.TorusGeometry(radius - 0.35, 0.22, 8, 32)), trimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(cx, cy + 0.05, cz);
  root.add(rim);

  // Circular masked floor collider matching the exact visible terrace
  const r2 = (radius - 0.15) * (radius - 0.15);
  collision.addMaskedFloor(
    cx - radius,
    cx + radius,
    cz - radius,
    cz + radius,
    cy,
    (x, z) => {
      const dx = x - cx;
      const dz = z - cz;
      return dx * dx + dz * dz <= r2;
    },
  );
}

function buildControlPillar(
  root: THREE.Group,
  scope: ResourceScope,
  name: string,
  pos: Vec3,
  color: number,
  height: number,
): { readonly group: THREE.Group; readonly orbMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(pos[0], pos[1], pos[2]);

  const baseMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x2a4e63,
    roughness: 0.72,
  }));
  const orbMat = scope.track(new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.65,
    roughness: 0.25,
  }));

  const plinth = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.42, 0.56, height * 0.65, 10)), baseMat);
  plinth.position.y = height * 0.325;
  const orb = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.38, 1)), orbMat);
  orb.position.y = height * 0.82;
  group.add(plinth, orb);
  root.add(group);
  return { group, orbMat };
}

function buildResonanceCrystal(
  root: THREE.Group,
  scope: ResourceScope,
  pos: Vec3,
  color: number,
): THREE.MeshStandardMaterial {
  const mat = scope.track(new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.18,
    roughness: 0.25,
  }));
  const crystal = new THREE.Mesh(scope.track(new THREE.OctahedronGeometry(0.42, 0)), mat);
  crystal.position.set(pos[0], pos[1] + 1.15, pos[2]);
  crystal.scale.set(0.75, 1.5, 0.75);
  root.add(crystal);
  return mat;
}
