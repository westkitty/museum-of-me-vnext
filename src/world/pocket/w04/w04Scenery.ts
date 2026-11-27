import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { addLightRig, gradientSkyDome, type Rect, seededRandom, tierCount } from '../kit/worldKit';

/** A rectangle of grid lines lying on a surface (LineSegments, one draw). */
export function rectGrid(ctx: PocketWorldContext, r: Rect, y: number, spacing: number, material: THREE.LineBasicMaterial): THREE.LineSegments {
  const pts: number[] = [];
  for (let x = r.minX; x <= r.maxX + 1e-6; x += spacing) pts.push(x, y, r.minZ, x, y, r.maxZ);
  for (let z = r.minZ; z <= r.maxZ + 1e-6; z += spacing) pts.push(r.minX, y, z, r.maxX, y, z);
  const g = ctx.scope.track(new THREE.BufferGeometry());
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(g, material);
  lines.raycast = () => {}; // decorative: never occlude the interaction ray
  ctx.root.add(lines);
  return lines;
}

const RING_POINTS = 256;

/**
 * W04 backdrop: a night-violet void with a neon floor grid far below, a
 * waveform horizon ring that follows the beat, drifting light cubes, and the
 * Drop: sky shift, sweeping stage beams and a larger waveform. Pulses are
 * smooth cosines at 1.6 Hz at most; reduced motion holds every element still.
 */
export function buildW04Scenery(ctx: PocketWorldContext, fog: THREE.FogExp2) {
  const { scope, root } = ctx;
  gradientSkyDome(ctx, { zenith: 0x060312, horizon: 0x2b1046, nadir: 0x020208, falloff: 0.5 });
  const dropDome = gradientSkyDome(ctx, { zenith: 0x1a0638, horizon: 0xb0307a, nadir: 0x0a0410, falloff: 0.55 }, 418);
  const dropMat = dropDome.material as THREE.MeshBasicMaterial;
  dropMat.transparent = true;
  dropMat.opacity = 0;
  dropDome.renderOrder = -9;
  const rig = addLightRig(ctx, { sky: 0x7d6cff, ground: 0x140a22, hemiIntensity: 1.1, sun: 0xc4b0ff, sunIntensity: 1.3, sunPosition: [40, 80, 60] });

  const floorGridMat = scope.track(new THREE.LineBasicMaterial({ color: 0x1fb6d6, transparent: true, opacity: 0.32 }));
  rectGrid(ctx, { minX: -200, maxX: 200, minZ: -240, maxZ: 160 }, -16, 8, floorGridMat);

  // Waveform horizon ring.
  const ringPos = new Float32Array(RING_POINTS * 3);
  const ringGeo = scope.track(new THREE.BufferGeometry());
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  const ringMat = scope.track(new THREE.LineBasicMaterial({ color: 0x55f2ff, fog: false, transparent: true, opacity: 0.85 }));
  const ring = new THREE.LineLoop(ringGeo, ringMat);
  ring.position.set(0, 4, -24);
  ring.frustumCulled = false;
  ring.raycast = () => {};
  root.add(ring);
  const ring2Mat = scope.track(new THREE.LineBasicMaterial({ color: 0xffb347, fog: false, transparent: true, opacity: 0 }));
  const ring2 = new THREE.LineLoop(ringGeo, ring2Mat);
  ring2.position.set(0, 4, -24);
  ring2.scale.setScalar(0.9);
  ring2.frustumCulled = false;
  ring2.raycast = () => {};
  root.add(ring2);

  // Drifting light cubes.
  const rand = seededRandom(404);
  const cubeCount = tierCount(ctx, 70, 24);
  const cubeMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0x7a4dff, emissiveIntensity: 1.1 }));
  const cubes = new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(1, 1, 1)), cubeMat, cubeCount);
  const cubeSeeds = Array.from({ length: cubeCount }, () => ({
    x: (rand() - 0.5) * 160, y: -10 + rand() * 50, z: -110 + rand() * 170, s: 0.6 + rand() * 2.2, phase: rand() * 6.28,
  })).filter((c) => !(Math.abs(c.x) < 16 && c.z > -70 && c.z < 34 && c.y > -4 && c.y < 16));
  cubes.count = cubeSeeds.length;
  root.add(cubes);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sv = new THREE.Vector3();

  // Stage beams for the Drop (additive cones, hidden until it starts).
  const beamMat = scope.track(new THREE.MeshBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  const beamGeo = scope.track(new THREE.ConeGeometry(3.2, 46, 18, 1, true));
  beamGeo.translate(0, -23, 0);
  const beams: THREE.Mesh[] = [];
  for (const [x, z] of [[-9, -65], [9, -65], [-9, -53], [9, -53]] as const) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(x, 10.2, z);
    beam.visible = false;
    root.add(beam);
    beams.push(beam);
  }

  const baseFog = new THREE.Color(0x0a0820);
  const dropFog = new THREE.Color(0x2a0a36);
  const fillWave = (time: number, amp: number) => {
    for (let i = 0; i < RING_POINTS; i++) {
      const a = (i / RING_POINTS) * Math.PI * 2;
      const r = 150;
      const y = amp * (Math.sin(a * 12 + time * 2.0) * 0.6 + Math.sin(a * 31 - time * 1.3) * 0.3 + Math.sin(a * 5 + time * 0.7) * 0.5);
      ringPos[i * 3] = Math.cos(a) * r;
      ringPos[i * 3 + 1] = y;
      ringPos[i * 3 + 2] = Math.sin(a) * r;
    }
    ringGeo.attributes.position.needsUpdate = true;
  };
  fillWave(0, 3);
  let lastStatic = false;

  return {
    update(time: number, pulse: number, drop: number, bside: boolean, reducedMotion: boolean): void {
      dropMat.opacity = drop * 0.9;
      dropDome.visible = drop > 0.001;
      fog.color.copy(baseFog).lerp(dropFog, drop);
      fog.density = 0.011 * (1 - drop * 0.35);
      rig.hemi.intensity = 1.1 + drop * 0.5;
      floorGridMat.opacity = 0.28 + pulse * 0.1 + drop * 0.25;
      ring2Mat.opacity = bside ? 0.35 + drop * 0.5 : 0;
      beams.forEach((b) => { b.visible = drop > 0.02; });
      beamMat.opacity = drop * 0.16;
      if (reducedMotion) {
        if (!lastStatic) fillWave(0, 3 + drop * 6);
        lastStatic = true;
        beams.forEach((b, i) => { b.rotation.set(0.35 * (i % 2 ? 1 : -1), 0, 0.25 * (i < 2 ? 1 : -1)); });
      } else {
        lastStatic = false;
        fillWave(time, 3 + pulse * 1.5 + drop * 7);
        beams.forEach((b, i) => {
          b.rotation.set(0.35 * Math.sin(time * 0.4 + i), 0, 0.3 * Math.cos(time * 0.33 + i * 1.7));
        });
      }
      cubeMat.emissiveIntensity = 0.9 + pulse * 0.5 + drop * 0.8;
      cubeSeeds.forEach((c, i) => {
        const t = reducedMotion ? 0 : time;
        e.set(t * 0.2 + c.phase, t * 0.3 + c.phase, 0);
        q.setFromEuler(e);
        const s = c.s * (1 + (reducedMotion ? 0 : pulse * 0.12));
        cubes.setMatrixAt(i, m.compose(v.set(c.x, c.y + Math.sin(t * 0.5 + c.phase) * 1.5, c.z), q, sv.set(s, s, s)));
      });
      cubes.instanceMatrix.needsUpdate = true;
    },
  };
}
