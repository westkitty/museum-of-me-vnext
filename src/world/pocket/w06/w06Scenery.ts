import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { addLightRig, gradientSkyDome, paintVertices, seededRandom, tierCount } from '../kit/worldKit';
import { CLOUD_SEA_Y } from './w06Layout';

/**
 * W06 backdrop: a bright morning sky over a sea of cloud, puffy clouds below
 * and around, and far floating islands for scale. The finale warms the sky to
 * golden hour and raises a rainbow behind the Summit Garden.
 */
export function buildW06Scenery(ctx: PocketWorldContext, fog: THREE.FogExp2) {
  const { scope, root } = ctx;
  gradientSkyDome(ctx, { zenith: 0x3f86d6, horizon: 0xd6e8f4, nadir: 0xf4f7fb, falloff: 0.5 });
  const goldDome = gradientSkyDome(ctx, { zenith: 0x4c5fae, horizon: 0xffb27a, nadir: 0xffe6cc, falloff: 0.55 }, 418);
  const goldMat = goldDome.material as THREE.MeshBasicMaterial;
  goldMat.transparent = true;
  goldMat.opacity = 0;
  goldDome.renderOrder = -9;
  const rig = addLightRig(ctx, { sky: 0xdcefff, ground: 0x8a9a70, hemiIntensity: 1.15, sun: 0xfff2dc, sunIntensity: 1.5, sunPosition: [60, 90, 30] });

  // Cloud sea: a broad disc with soft vertex shading.
  const seaGeo = scope.track(new THREE.CircleGeometry(400, 64, 0, Math.PI * 2));
  seaGeo.rotateX(-Math.PI / 2);
  paintVertices(seaGeo, (x, _y, z, out) => {
    const n = Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.5 + Math.sin((x + z) * 0.017) * 0.5;
    out.setHSL(0.58, 0.25, 0.9 + n * 0.05);
  });
  const sea = new THREE.Mesh(seaGeo, scope.track(new THREE.MeshBasicMaterial({ vertexColors: true })));
  sea.position.y = CLOUD_SEA_Y;
  sea.raycast = () => {};
  root.add(sea);

  // Puffy clouds: clusters of flat-shaded spheres, kept clear of every island and glide.
  const rand = seededRandom(606);
  const puffGeo = scope.track(new THREE.IcosahedronGeometry(1, 1));
  const puffMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, emissive: 0xb8c8dc, emissiveIntensity: 0.35 }));
  const clusters = tierCount(ctx, 60, 24);
  const puffs = new THREE.InstancedMesh(puffGeo, puffMat, clusters * 5);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  let n = 0;
  for (let c = 0; c < clusters; c++) {
    const a = rand() * Math.PI * 2;
    const d = 30 + rand() * 170;
    const x = Math.cos(a) * d, z = -20 + Math.sin(a) * d;
    const nearRoute = Math.abs(x) < 26 && z > -90 && z < 40;
    const y = nearRoute ? CLOUD_SEA_Y + 1 + rand() * 4 : CLOUD_SEA_Y + 2 + rand() * 40;
    for (let k = 0; k < 5; k++) {
      const size = 3 + rand() * 6;
      puffs.setMatrixAt(n++, m.compose(v.set(x + (rand() - 0.5) * size * 2.2, y + rand() * size * 0.4, z + (rand() - 0.5) * size * 1.4), q.identity(), s.set(size, size * 0.62, size)));
    }
  }
  puffs.count = n;
  puffs.raycast = () => {};
  root.add(puffs);

  // Far islands for scale: grass caps over rock cones, too far to reach.
  const farCap = scope.track(new THREE.CylinderGeometry(1, 0.9, 0.3, 14));
  const farRock = scope.track(new THREE.ConeGeometry(0.9, 1.6, 9));
  farRock.rotateX(Math.PI);
  farRock.translate(0, -0.95, 0);
  const capMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x6aa35a, roughness: 0.9 }));
  const rockMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x8a7462, roughness: 0.95 }));
  const farCount = tierCount(ctx, 18, 8);
  const caps = new THREE.InstancedMesh(farCap, capMat, farCount);
  const rocks = new THREE.InstancedMesh(farRock, rockMat, farCount);
  for (let i = 0; i < farCount; i++) {
    const a = (i / farCount) * Math.PI * 2 + rand() * 0.3;
    const d = 140 + rand() * 120;
    const size = 6 + rand() * 14;
    m.compose(v.set(Math.cos(a) * d, -2 + rand() * 50, -20 + Math.sin(a) * d), q.identity(), s.set(size, size, size));
    caps.setMatrixAt(i, m);
    rocks.setMatrixAt(i, m);
  }
  caps.raycast = () => {};
  rocks.raycast = () => {};
  root.add(caps, rocks);

  // The finale rainbow: a wide arc behind the Summit Garden.
  const bowGeo = scope.track(new THREE.TorusGeometry(70, 4.5, 8, 96, Math.PI));
  const bowCol = new Float32Array(bowGeo.getAttribute('position').count * 3);
  const bowPos = bowGeo.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < bowPos.count; i++) {
    const rad = Math.hypot(bowPos.getX(i), bowPos.getY(i));
    const t = Math.min(1, Math.max(0, (rad - 65.5) / 9));
    c.setHSL(0.78 * t, 0.85, 0.62);
    bowCol.set([c.r, c.g, c.b], i * 3);
  }
  bowGeo.setAttribute('color', new THREE.BufferAttribute(bowCol, 3));
  const bowMat = scope.track(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  const bow = new THREE.Mesh(bowGeo, bowMat);
  bow.position.set(0, -8, -150);
  bow.visible = false;
  bow.raycast = () => {};
  root.add(bow);

  const dayFog = new THREE.Color(0xd6e8f4);
  const goldFog = new THREE.Color(0xf4c9a4);
  return {
    update(time: number, finale: number, reducedMotion: boolean): void {
      goldMat.opacity = finale * 0.9;
      goldDome.visible = finale > 0.001;
      fog.color.copy(dayFog).lerp(goldFog, finale);
      rig.sun.color.setHex(0xfff2dc).lerp(c.setHex(0xffb070), finale);
      rig.hemi.intensity = 1.15 + finale * 0.25;
      bow.visible = finale > 0.02;
      bowMat.opacity = finale * 0.5;
      if (!reducedMotion) puffs.position.x = Math.sin(time * 0.02) * 4;
    },
  };
}
