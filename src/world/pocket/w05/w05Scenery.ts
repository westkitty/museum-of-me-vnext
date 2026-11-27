import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { addLightRig, gradientSkyDome, seededRandom, tierCount } from '../kit/worldKit';

const VAULT_RADIUS = 46;
const VAULT_BASE_Y = -8;
const RIB_SPACING = 12;
const RIB_FIRST_Z = 40;

/** A leaf outline (length 1 along +y, widest at 0.4), as a flat shape. */
function leafShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.32, 0.18, 0.34, 0.62, 0, 1);
  s.bezierCurveTo(-0.34, 0.62, -0.32, 0.18, 0, 0);
  return s;
}

/**
 * W05 backdrop. The glasshouse is impossibly large inside: iron ribs and glass
 * repeat into the fog without end. Giant leaves and fronds fill the depths
 * below the terraces, pollen drifts in the air, and the Bloom's dawn slowly
 * replaces the green night. Reduced motion holds every decorative element.
 */
export function buildW05Scenery(ctx: PocketWorldContext, fog: THREE.FogExp2) {
  const { scope, root } = ctx;
  gradientSkyDome(ctx, { zenith: 0x05131a, horizon: 0x1c4a48, nadir: 0x030806, falloff: 0.55 });
  const dawnDome = gradientSkyDome(ctx, { zenith: 0x3a6494, horizon: 0xffc88a, nadir: 0x1d140c, falloff: 0.5 }, 418);
  const dawnMat = dawnDome.material as THREE.MeshBasicMaterial;
  dawnMat.transparent = true;
  dawnMat.opacity = 0;
  dawnDome.renderOrder = -9;
  const rig = addLightRig(ctx, { sky: 0xa8ecd6, ground: 0x1a2a14, hemiIntensity: 1.05, sun: 0xfff0c8, sunIntensity: 1.0, sunPosition: [-30, 90, 40] });

  // ---- The vault: ribs and glass repeating into the fog.
  const ribCount = tierCount(ctx, 32, 18);
  const ribMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x1d2a26, metalness: 0.7, roughness: 0.45, emissive: 0x2a5a48, emissiveIntensity: 0.05 }));
  const ribs = new THREE.InstancedMesh(scope.track(new THREE.TorusGeometry(VAULT_RADIUS, 0.45, 6, 64, Math.PI)), ribMat, ribCount);
  const m = new THREE.Matrix4();
  for (let i = 0; i < ribCount; i++) ribs.setMatrixAt(i, m.makeTranslation(0, VAULT_BASE_Y, RIB_FIRST_Z - i * RIB_SPACING));
  ribs.raycast = () => {};
  root.add(ribs);
  const vaultLength = ribCount * RIB_SPACING;
  const glassGeo = scope.track(new THREE.CylinderGeometry(VAULT_RADIUS - 0.2, VAULT_RADIUS - 0.2, vaultLength, 48, 1, true, -Math.PI / 2, Math.PI));
  glassGeo.rotateX(-Math.PI / 2);
  const glassMat = scope.track(new THREE.MeshBasicMaterial({ color: 0x9fe8d2, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }));
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, VAULT_BASE_Y, RIB_FIRST_Z - vaultLength / 2);
  glass.raycast = () => {};
  root.add(glass);
  // Purlins: lines along the vault at even angles.
  const purl: number[] = [];
  for (let k = 1; k < 12; k++) {
    const a = (k / 12) * Math.PI;
    const x = Math.cos(a) * (VAULT_RADIUS - 0.3), y = VAULT_BASE_Y + Math.sin(a) * (VAULT_RADIUS - 0.3);
    purl.push(x, y, RIB_FIRST_Z, x, y, RIB_FIRST_Z - vaultLength);
  }
  const purlGeo = scope.track(new THREE.BufferGeometry());
  purlGeo.setAttribute('position', new THREE.Float32BufferAttribute(purl, 3));
  const purlMat = scope.track(new THREE.LineBasicMaterial({ color: 0x3e6a5c, transparent: true, opacity: 0.55 }));
  const purlins = new THREE.LineSegments(purlGeo, purlMat);
  purlins.raycast = () => {};
  root.add(purlins);

  // ---- Giant leaves and fronds in the depths and along the vault walls.
  const rand = seededRandom(505);
  const leafGeo = scope.track(new THREE.ShapeGeometry(leafShape(), 6));
  const leafMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide, emissive: 0x0b2410, emissiveIntensity: 0.4 }));
  const leafCount = tierCount(ctx, 240, 90);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCount);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  let placed = 0;
  while (placed < leafCount) {
    const x = (rand() - 0.5) * 84;
    const z = 34 - rand() * 120;
    // Keep the walking terraces clear: leaves grow below them or beside them.
    const nearRoute = Math.abs(x) < 18 && z > -72 && z < 30;
    const y = nearRoute ? -16 + rand() * 4 : -10 + rand() * 26;
    if (Math.hypot(x, y - VAULT_BASE_Y) > VAULT_RADIUS - 3) continue;
    // Near the terraces a leaf, however tilted, stays well below the walking surfaces.
    const len = nearRoute ? 3 + rand() * 5 : 3 + rand() * 9;
    e.set(-0.4 - rand() * 1.0, rand() * Math.PI * 2, (rand() - 0.5) * 0.6, 'YXZ');
    leaves.setMatrixAt(placed, m.compose(v.set(x, y, z), q.setFromEuler(e), s.set(len, len, len)));
    leaves.setColorAt(placed, col.setHSL(0.26 + rand() * 0.08, 0.45 + rand() * 0.2, 0.2 + rand() * 0.15));
    placed++;
  }
  leaves.raycast = () => {};
  root.add(leaves);

  // Giant stalks rising from the depths, each crowned with a leaf rosette.
  const stalkMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3f6e34, roughness: 0.8 }));
  const stalkGeo = scope.track(new THREE.CylinderGeometry(0.6, 1.1, 1, 10));
  stalkGeo.translate(0, 0.5, 0);
  const stalkSpots: [number, number, number][] = [[-22, -6, 18], [24, 4, 10], [-26, -30, 24], [27, -44, 20], [-18, -78, 26], [20, -86, 22], [-30, 4, 16], [31, -18, 26]];
  const stalks = new THREE.InstancedMesh(stalkGeo, stalkMat, stalkSpots.length);
  const crowns = new THREE.InstancedMesh(leafGeo, leafMat, stalkSpots.length * 7);
  stalkSpots.forEach(([x, z, h], i) => {
    stalks.setMatrixAt(i, m.compose(v.set(x, -14, z), q.identity(), s.set(1, h + 14, 1)));
    for (let k = 0; k < 7; k++) {
      e.set(-0.9 - (k % 2) * 0.3, (k / 7) * Math.PI * 2 + i, 0, 'YXZ');
      crowns.setMatrixAt(i * 7 + k, m.compose(v.set(x, h, z), q.setFromEuler(e), s.set(7, 7, 7)));
      crowns.setColorAt(i * 7 + k, col.setHSL(0.28, 0.5, 0.22 + (k % 3) * 0.04));
    }
  });
  stalks.raycast = () => {};
  crowns.raycast = () => {};
  root.add(stalks, crowns);

  // Hanging vines from the vault (static lines).
  const vinePts: number[] = [];
  for (let i = 0; i < tierCount(ctx, 60, 24); i++) {
    const x = (rand() - 0.5) * 70;
    const z = 30 - rand() * 110;
    const top = VAULT_BASE_Y + Math.sqrt(Math.max(0, (VAULT_RADIUS - 1) ** 2 - x * x));
    const len = 6 + rand() * 14;
    if (Math.abs(x) < 12 && top - len < 16) continue;
    vinePts.push(x, top, z, x + (rand() - 0.5), top - len, z + (rand() - 0.5));
  }
  const vineGeo = scope.track(new THREE.BufferGeometry());
  vineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vinePts, 3));
  const vines = new THREE.LineSegments(vineGeo, scope.track(new THREE.LineBasicMaterial({ color: 0x3d7a3c, transparent: true, opacity: 0.7 })));
  vines.raycast = () => {};
  root.add(vines);

  // Mist over the depths.
  const mistMat = scope.track(new THREE.MeshBasicMaterial({ color: 0x8fd6bf, transparent: true, opacity: 0.12, depthWrite: false }));
  const mist = new THREE.Mesh(scope.track(new THREE.PlaneGeometry(90, 160)), mistMat);
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(0, -5, -30);
  mist.raycast = () => {};
  root.add(mist);

  // ---- Pollen: slow drifting points; they rise and brighten with the Bloom.
  const pollenCount = tierCount(ctx, 420, 140);
  const pollenPos = new Float32Array(pollenCount * 3);
  const pollenSeed = Array.from({ length: pollenCount }, () => ({
    x: (rand() - 0.5) * 60, y: -4 + rand() * 30, z: 30 - rand() * 105, phase: rand() * 6.28, speed: 0.15 + rand() * 0.3,
  }));
  const pollenGeo = scope.track(new THREE.BufferGeometry());
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  // A soft round sprite (generated, no asset): pollen reads as glowing motes, never squares.
  const SPRITE = 32;
  const spriteData = new Uint8Array(SPRITE * SPRITE * 4);
  for (let y = 0; y < SPRITE; y++) {
    for (let x = 0; x < SPRITE; x++) {
      const d = Math.hypot(x + 0.5 - SPRITE / 2, y + 0.5 - SPRITE / 2) / (SPRITE / 2);
      const a = Math.max(0, 1 - d) ** 2;
      spriteData.set([255, 255, 255, Math.round(a * 255)], (y * SPRITE + x) * 4);
    }
  }
  const sprite = scope.track(new THREE.DataTexture(spriteData, SPRITE, SPRITE));
  sprite.needsUpdate = true;
  const pollenMat = scope.track(new THREE.PointsMaterial({ color: 0xfff0a0, map: sprite, size: 0.22, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pollen = new THREE.Points(pollenGeo, pollenMat);
  pollen.frustumCulled = false;
  pollen.raycast = () => {};
  root.add(pollen);

  const nightFog = new THREE.Color(0x0c2422);
  const dawnFog = new THREE.Color(0x6e5a3e);
  const placePollen = (time: number, bloom: number) => {
    pollenSeed.forEach((p, i) => {
      const lift = ((p.y + 4 + time * p.speed * (1 + bloom * 3)) % 34) - 4;
      pollenPos[i * 3] = p.x + Math.sin(time * 0.3 + p.phase) * 0.8;
      pollenPos[i * 3 + 1] = lift;
      pollenPos[i * 3 + 2] = p.z + Math.cos(time * 0.25 + p.phase) * 0.8;
    });
    pollenGeo.attributes.position.needsUpdate = true;
  };
  placePollen(0, 0);
  let frozen = false;

  return {
    update(time: number, bloom: number, reducedMotion: boolean): void {
      dawnMat.opacity = bloom * 0.92;
      dawnDome.visible = bloom > 0.001;
      fog.color.copy(nightFog).lerp(dawnFog, bloom);
      fog.density = 0.012 * (1 - bloom * 0.4);
      rig.hemi.intensity = 1.05 + bloom * 0.55;
      rig.sun.intensity = 1.0 + bloom * 0.9;
      ribMat.emissiveIntensity = 0.05 + bloom * 0.5;
      glassMat.opacity = 0.06 + bloom * 0.06;
      pollenMat.opacity = 0.7 + bloom * 0.3;
      pollenMat.size = 0.22 + bloom * 0.12;
      if (reducedMotion) {
        if (!frozen) placePollen(0, 0);
        frozen = true;
      } else {
        frozen = false;
        placePollen(time, bloom);
      }
    },
  };
}
