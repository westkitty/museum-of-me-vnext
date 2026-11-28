import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { addLightRig, gradientSkyDome, paintVertices, seededRandom, tierCount, type LightRig } from '../kit/worldKit';
import {
  clipCoast, expandedCoast, GORGE_EAST, GORGE_WEST, ISLAND_DEPTH, SEA_Y, type Point,
} from './w02Layout';

/**
 * The ancient island as a landscape: strata cliffs cut by the Veiled Gorge,
 * beach and shallows at the cliff foot, a smoking northern volcano, sea
 * stacks and far ridges for depth. Returns the handles the finale animates.
 */

export interface W02Landscape {
  readonly lights: LightRig;
  readonly mist: readonly THREE.Mesh[];
  readonly mistMaterial: THREE.MeshBasicMaterial;
  readonly smoke: THREE.InstancedMesh;
  readonly sky: THREE.Mesh;
  readonly sunDisc: THREE.Mesh;
  update(time: number, reveal: number, reducedMotion: boolean): void;
}

function shapeFrom(points: readonly Point[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  return shape;
}

/** Extrude a coast polygon into a solid whose top sits at `top`. */
function islandSlab(points: readonly Point[], top: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapeFrom(points), { depth, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, top - depth, 0);
  return geometry;
}

const STRATA = [0x6b5a43, 0x80694c, 0x5b4b3a, 0x8b7555, 0x4f4436, 0x75634a];

export function buildW02Landscape(ctx: PocketWorldContext, fog: THREE.FogExp2): W02Landscape {
  const { scope, root } = ctx;
  const random = seededRandom(0x5702);

  const sky = gradientSkyDome(ctx, { zenith: 0x2f6c86, horizon: 0xd3dcb4, nadir: 0x1c4a4e, falloff: 0.55 });
  const lights = addLightRig(ctx, {
    sky: 0xd8efe0, ground: 0x46532f, hemiIntensity: 1.25,
    sun: 0xffe0b2, sunIntensity: 2.4, sunPosition: [90, 70, -40],
  });
  const sunMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xfff1cf, fog: false }));
  const sunDisc = new THREE.Mesh(scope.track(new THREE.CircleGeometry(14, 24)), sunMat);
  sunDisc.position.set(270, 150, -120);
  sunDisc.lookAt(0, 0, 0);
  root.add(sunDisc);

  // Sea and shallows.
  const seaMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x1f5d66, roughness: 0.22, metalness: 0.12 }));
  const sea = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(900, 900)), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_Y;
  root.add(sea);
  const shallowsMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x4fa3a0, roughness: 0.3, transparent: true, opacity: 0.55, depthWrite: false }));
  const shallows = new THREE.Mesh(scope.track(new THREE.ShapeGeometry(shapeFrom(expandedCoast(1.2)))), shallowsMat);
  shallows.rotation.x = -Math.PI / 2;
  shallows.position.y = SEA_Y + 0.05;
  root.add(shallows);
  const beachGeo = scope.track(islandSlab(expandedCoast(1.12), SEA_Y + 0.45, 1.2));
  paintVertices(beachGeo, (x, _y, z, c) => c.setHex(0xd8c49a).offsetHSL(0, 0, (Math.sin(x * 0.7) * Math.cos(z * 0.5)) * 0.04));
  const beach = new THREE.Mesh(beachGeo, scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  beach.receiveShadow = true;
  root.add(beach);

  // Island halves: their cut faces ARE the gorge walls. Strata bands by height,
  // moss on top, damp darker rock low in the gorge.
  const rockMat = scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true }));
  const moss = new THREE.Color(0x3f6b3a);
  for (const points of [clipCoast(GORGE_WEST, true), clipCoast(GORGE_EAST, false)]) {
    const geometry = scope.track(islandSlab(points, 0, ISLAND_DEPTH));
    const band = new THREE.Color();
    paintVertices(geometry, (x, y, z, c) => {
      if (y > -0.05) {
        c.copy(moss).offsetHSL(0.01 * Math.sin(x * 0.3 + z * 0.2), 0, 0.05 * Math.sin(x * 0.11) * Math.cos(z * 0.13));
        return;
      }
      const i = Math.abs(Math.floor((y + Math.sin(x * 0.21 + z * 0.17) * 0.6) / 1.7)) % STRATA.length;
      band.setHex(STRATA[i]);
      const damp = Math.max(0, (-y - 7) / 6);
      c.copy(band).lerp(new THREE.Color(0x2c3a33), damp * 0.6);
    });
    const mesh = new THREE.Mesh(geometry, rockMat);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // A thin mossy turf cap sits just above the slab so the top reads as soil, not rock.
  const turfMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3d6a36, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  for (const points of [clipCoast(GORGE_WEST - 0.4, true), clipCoast(GORGE_EAST + 0.4, false)]) {
    const turf = new THREE.Mesh(scope.track(new THREE.ShapeGeometry(shapeFrom(points))), turfMat);
    turf.rotation.x = -Math.PI / 2;
    turf.position.y = 0.01;
    turf.receiveShadow = true;
    root.add(turf);
  }

  // Gorge veils: layered mist the finale lifts. Water glints at the bottom.
  const mistMaterial = scope.track(new THREE.MeshBasicMaterial({ color: 0xe8f1e2, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
  const mist: THREE.Mesh[] = [];
  const mistGeo = scope.track(new THREE.PlaneGeometry(GORGE_EAST - GORGE_WEST + 2, 104));
  for (const y of [-2.6, -5.2, -8.4]) {
    const sheet = new THREE.Mesh(mistGeo, mistMaterial);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set((GORGE_WEST + GORGE_EAST) / 2, y, 2);
    sheet.renderOrder = 2;
    root.add(sheet);
    mist.push(sheet);
  }
  const veilGeo = scope.track(new THREE.PlaneGeometry(GORGE_EAST - GORGE_WEST, 9));
  for (const z of [-30, -14, 22, 38]) {
    const veil = new THREE.Mesh(veilGeo, mistMaterial);
    veil.position.set((GORGE_WEST + GORGE_EAST) / 2, -4, z);
    veil.renderOrder = 2;
    root.add(veil);
    mist.push(veil);
  }

  // Northern volcano with a glowing crater and a smoke column.
  const volcanoGeo = scope.track(new THREE.ConeGeometry(70, 82, 28, 6, true));
  paintVertices(volcanoGeo, (_x, y, _z, c) => c.setHex(y > 30 ? 0x3c3530 : y > 0 ? 0x4c4637 : 0x3f5a3a));
  const volcano = new THREE.Mesh(volcanoGeo, scope.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
  volcano.position.set(-55, SEA_Y + 41 - 4, -175);
  root.add(volcano);
  const crater = new THREE.Mesh(scope.track(new THREE.TorusGeometry(9, 2.2, 6, 18)),
    scope.track(new THREE.MeshStandardMaterial({ color: 0x3b1d10, emissive: 0xff6a2a, emissiveIntensity: 1.6 })));
  crater.rotation.x = Math.PI / 2;
  crater.position.set(-55, SEA_Y + 78, -175);
  root.add(crater);
  const smokeCount = tierCount(ctx, 18, 8);
  const smoke = new THREE.InstancedMesh(scope.track(new THREE.IcosahedronGeometry(1, 1)),
    scope.track(new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false })), smokeCount);
  smoke.frustumCulled = false;
  root.add(smoke);

  // Sea stacks and far ridges give near/middle/far separation.
  const stackMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x5d5446, roughness: 1, flatShading: true }));
  const stackGeo = scope.track(new THREE.CylinderGeometry(2.2, 4.2, 1, 7, 3));
  for (const [x, z, h] of [[-72, 30, 26], [-66, 44, 18], [70, -36, 30], [78, 18, 22], [-20, 78, 20], [30, -72, 24]] as const) {
    const stack = new THREE.Mesh(stackGeo, stackMat);
    stack.scale.set(1 + random() * 0.6, h, 1 + random() * 0.6);
    stack.position.set(x, SEA_Y + h / 2 - 1, z);
    stack.rotation.y = random() * Math.PI;
    const cap = new THREE.Mesh(scope.track(new THREE.SphereGeometry(3.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), turfMat);
    cap.position.set(x, SEA_Y + h - 1.2, z);
    root.add(stack, cap);
  }
  const ridgeMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x5f7f78, roughness: 1, flatShading: true }));
  const ridgeGeo = scope.track(new THREE.ConeGeometry(1, 1, 9, 1));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4;
    if (Math.abs(a - 4.4) < 0.5) continue; // keep the volcano's silhouette clear
    const r = 230 + random() * 60;
    const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridge.scale.set(50 + random() * 40, 24 + random() * 26, 40 + random() * 30);
    ridge.position.set(Math.cos(a) * r, SEA_Y + ridge.scale.y / 2 - 3, Math.sin(a) * r);
    root.add(ridge);
  }

  const smokeMatrix = new THREE.Matrix4();
  const smokeQ = new THREE.Quaternion();
  const smokeP = new THREE.Vector3();
  const smokeS = new THREE.Vector3();
  const baseFogDensity = 0.0105;
  const update = (time: number, reveal: number, reducedMotion: boolean) => {
    for (let i = 0; i < smokeCount; i++) {
      const phase = reducedMotion ? i / smokeCount : ((time * 0.035) + i / smokeCount) % 1;
      const drift = phase * 46;
      smokeP.set(-55 + drift * 0.8 + Math.sin(i * 1.7) * 3, SEA_Y + 80 + drift, -175 + Math.cos(i * 2.3) * 3);
      const s = 5 + phase * 12;
      smokeS.set(s, s * 0.8, s);
      smokeMatrix.compose(smokeP, smokeQ, smokeS);
      smoke.setMatrixAt(i, smokeMatrix);
    }
    smoke.instanceMatrix.needsUpdate = true;
    mistMaterial.opacity = 0.32 * (1 - reveal);
    for (const sheet of mist) {
      sheet.visible = reveal < 0.999;
      if (!reducedMotion && sheet.rotation.x !== 0) sheet.position.z = 2 + Math.sin(time * 0.07 + sheet.position.y) * 3;
    }
    // Only this world's own fog object is ever touched, never the museum's.
    fog.density = baseFogDensity * (1 - 0.55 * reveal);
    lights.sun.intensity = 2.4 + 0.9 * reveal;
    lights.hemi.intensity = 1.25 + 0.25 * reveal;
  };
  update(0, 0, true);

  return { lights, mist, mistMaterial, smoke, sky, sunDisc, update };
}
