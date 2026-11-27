import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { addLightRig, gradientSkyDome, seededRandom, tierCount } from '../kit/worldKit';
import { extrudeDown, gearShape } from './w03Machine';

/**
 * W03 backdrop: a dusk sky that turns to dawn at the finale, a starfield that
 * fades with it, an abyss of slow clockwork below the route, and three great
 * armillary bands circling the Sundial Crown. Decorative only: no colliders.
 */
export function buildW03Scenery(ctx: PocketWorldContext, fog: THREE.Fog) {
  const { scope, root } = ctx;
  gradientSkyDome(ctx, { zenith: 0x141a3a, horizon: 0xc0704a, nadir: 0x07070c, falloff: 0.45 });
  const dawn = gradientSkyDome(ctx, { zenith: 0x5d8fd0, horizon: 0xffd79a, nadir: 0x2a2018, falloff: 0.5 }, 418);
  const dawnMat = dawn.material as THREE.MeshBasicMaterial;
  dawnMat.transparent = true;
  dawnMat.opacity = 0;
  dawn.renderOrder = -9;

  const rig = addLightRig(ctx, {
    sky: 0x8a90c8, ground: 0x2b2118, hemiIntensity: 1.05,
    sun: 0xffb27a, sunIntensity: 1.6, sunPosition: [-120, 40, -60],
  });
  const duskSun = new THREE.Color(0xffb27a);
  const dawnSun = new THREE.Color(0xfff1d6);
  const duskFog = new THREE.Color(0x3a2f40);
  const dawnFog = new THREE.Color(0xd9c7a8);

  // Stars: a fixed seeded scatter on the upper dome.
  const rand = seededRandom(303);
  const starCount = tierCount(ctx, 900, 200);
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const y = 0.15 + rand() * 0.85;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(theta) * r * 380, y * 380, Math.sin(theta) * r * 380], i * 3);
  }
  const starGeo = scope.track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = scope.track(new THREE.PointsMaterial({ color: 0xfff4dc, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }));
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -8;
  stars.frustumCulled = false;
  root.add(stars);

  // Abyss of clockwork: large slow gears at depth, sharing one geometry.
  const abyssBrass = scope.track(new THREE.MeshStandardMaterial({ color: 0x6a4e2c, metalness: 0.8, roughness: 0.5 }));
  const abyssIron = scope.track(new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.7, roughness: 0.6 }));
  const bigGearGeo = scope.track(extrudeDown(gearShape(1, 0.93, 36, 0.32), 0.08, 4));
  const gears: { mesh: THREE.Mesh; speed: number }[] = [];
  const gearCount = tierCount(ctx, 14, 6);
  for (let i = 0; i < gearCount; i++) {
    const size = 7 + rand() * 16;
    const mesh = new THREE.Mesh(bigGearGeo, i % 3 === 0 ? abyssIron : abyssBrass);
    mesh.scale.set(size, size, size);
    mesh.rotation.order = 'ZYX'; // spin about the gear's own axle after standing it up
    mesh.position.set(-40 + rand() * 90, -12 - rand() * 26, -70 + rand() * 110);
    if (i % 4 === 1) { mesh.rotation.z = Math.PI / 2; mesh.position.y -= 6; }
    root.add(mesh);
    gears.push({ mesh, speed: (rand() < 0.5 ? -1 : 1) * (0.03 + rand() * 0.08) * (14 / size) });
  }
  const floorGlow = new THREE.Mesh(scope.track(new THREE.CircleGeometry(160, 40)),
    scope.track(new THREE.MeshBasicMaterial({ color: 0x1a120c })));
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, -44, -20);
  root.add(floorGlow);

  // Armillary bands circling the crown: the sundial's own sky rings.
  // Sky-scale rings beyond the fog: unlit-looking gold so they read as the sundial's heavens, not cables.
  const bandMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xc7944e, fog: false, transparent: true, opacity: 0.5, depthWrite: false }));
  const bands: THREE.Mesh[] = [];
  const bandSpecs: [number, number, number][] = [[230, 0.42, 0.35], [262, -0.3, 1.25], [300, 0.18, 2.4]];
  for (const [radius, tilt, yaw] of bandSpecs) {
    const band = new THREE.Mesh(scope.track(new THREE.TorusGeometry(radius, 4.5, 8, 160)), bandMat);
    band.position.set(-19, 18, -51);
    band.renderOrder = -7;
    band.rotation.set(Math.PI / 2 + tilt, yaw, 0);
    root.add(band);
    bands.push(band);
  }

  return {
    rig,
    update(time: number, dawnAmount: number, reducedMotion: boolean): void {
      dawnMat.opacity = dawnAmount;
      dawn.visible = dawnAmount > 0.001;
      starMat.opacity = 0.9 * (1 - dawnAmount);
      stars.visible = dawnAmount < 0.999;
      rig.sun.color.copy(duskSun).lerp(dawnSun, dawnAmount);
      rig.sun.intensity = 1.6 + dawnAmount * 1.4;
      rig.sun.position.set(-120 + dawnAmount * 40, 40 + dawnAmount * 90, -60);
      rig.hemi.intensity = 1.05 + dawnAmount * 0.55;
      fog.color.copy(duskFog).lerp(dawnFog, dawnAmount);
      fog.far = 260 + dawnAmount * 160;
      if (reducedMotion) return;
      for (const g of gears) g.mesh.rotation.y = time * g.speed;
      bands.forEach((b, i) => { b.rotation.z = time * (0.012 + i * 0.006) * (i % 2 ? -1 : 1); });
    },
  };
}
