import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { easeInOut, seededRandom } from '../kit/worldKit';
import { ELDER_FERN_POS, FOSSIL_POS, HEART_POS, RETURN_GATE_POS, SEA_Y } from './w02Layout';

/**
 * Finale and discovery set pieces: the Elder Fern whose curled crown unfurls
 * over the summit, the fossil hollow, the herd and flyers that bring the
 * ancient island to life, and the root gate home.
 */

export interface W02Finale {
  readonly heart: THREE.Object3D;
  readonly fossil: THREE.Object3D;
  readonly gate: THREE.Object3D;
  markFossilStudied(): void;
  showGate(): void;
  /** `unfurl` and `herd` are 0..1 progress values owned by the world state. */
  update(time: number, unfurl: number, herdVisible: boolean, herdSize: number, reducedMotion: boolean): void;
}

function buildSauropod(ctx: PocketWorldContext, skin: THREE.Material, belly: THREE.Material): { group: THREE.Group; legs: THREE.Object3D[]; neck: THREE.Object3D } {
  const { scope } = ctx;
  const group = new THREE.Group();
  const body = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1, 14, 10)), skin);
  body.scale.set(3.4, 1.7, 1.6);
  body.position.y = 3.6;
  const under = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1, 12, 8)), belly);
  under.scale.set(3.1, 1.2, 1.35);
  under.position.y = 3.15;
  group.add(body, under);
  const neck = new THREE.Group();
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.6, 4.1, 0), new THREE.Vector3(4.4, 6.2, 0), new THREE.Vector3(5.4, 8.4, 0), new THREE.Vector3(6.2, 9.6, 0),
  ]);
  neck.add(new THREE.Mesh(scope.track(new THREE.TubeGeometry(neckCurve, 16, 0.55, 8, false)), skin));
  const head = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.62, 10, 8)), skin);
  head.scale.set(1.5, 0.8, 0.85);
  head.position.set(6.7, 9.7, 0);
  neck.add(head);
  group.add(neck);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.8, 3.9, 0), new THREE.Vector3(-5.4, 3.3, 0.4), new THREE.Vector3(-8.2, 2.4, -0.3), new THREE.Vector3(-10.6, 1.8, 0.5),
  ]);
  group.add(new THREE.Mesh(scope.track(new THREE.TubeGeometry(tailCurve, 18, 0.5, 7, false)), skin));
  const legGeo = scope.track(new THREE.CylinderGeometry(0.42, 0.5, 3.2, 7));
  legGeo.translate(0, -1.6, 0);
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[1.9, 0.9], [1.9, -0.9], [-1.9, 0.9], [-1.9, -0.9]] as const) {
    const leg = new THREE.Mesh(legGeo, skin);
    leg.position.set(x, 3.2, z);
    group.add(leg);
    legs.push(leg);
  }
  return { group, legs, neck };
}

export function buildW02Finale(ctx: PocketWorldContext, frondGeometry: THREE.BufferGeometry, frondMaterial: THREE.Material, rootMaterial: THREE.Material): W02Finale {
  const { scope, root, collision } = ctx;
  const random = seededRandom(0x0e1d);

  // ---- The Elder Fern: a monumental tree fern on the summit tor.
  const [ex, ey, ez] = ELDER_FERN_POS;
  const trunkGeo = scope.track(new THREE.CylinderGeometry(0.85, 1.45, 10, 12, 8));
  const trunkPos = trunkGeo.getAttribute('position');
  for (let i = 0; i < trunkPos.count; i++) {
    const y = trunkPos.getY(i);
    const a = Math.atan2(trunkPos.getZ(i), trunkPos.getX(i));
    const bump = 1 + 0.08 * Math.sin(y * 4 + a * 5);
    trunkPos.setX(i, trunkPos.getX(i) * bump);
    trunkPos.setZ(i, trunkPos.getZ(i) * bump);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, scope.track(new THREE.MeshStandardMaterial({ color: 0x4b3525, roughness: 1, flatShading: true })));
  trunk.position.set(ex, ey + 5, ez);
  trunk.castShadow = ctx.quality.shadows;
  root.add(trunk);
  collision.addBox([ex, ey + 3, ez], [1.5, 3, 1.5]);
  const crownCount = 18;
  const crown = new THREE.InstancedMesh(frondGeometry, frondMaterial, crownCount);
  crown.frustumCulled = false;
  root.add(crown);
  const crownYaw = Array.from({ length: crownCount }, (_, k) => (k / crownCount) * Math.PI * 2 + random() * 0.25);
  const crownLen = Array.from({ length: crownCount }, () => 8 + random() * 3);
  // Fiddleheads: glowing curled tips that brighten as the crown opens.
  const glowMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xc8f7a6, emissive: 0x5fdc7a, emissiveIntensity: 0.6 }));
  const fiddleGeo = scope.track(new THREE.TorusGeometry(0.42, 0.13, 6, 12, Math.PI * 1.6));
  const fiddles: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) {
    const f = new THREE.Mesh(fiddleGeo, glowMat);
    const a = (k / 6) * Math.PI * 2;
    f.position.set(ex + Math.cos(a) * 0.7, ey + 10.4, ez + Math.sin(a) * 0.7);
    f.rotation.set(Math.PI / 2, 0, a);
    root.add(f);
    fiddles.push(f);
  }

  // The heart pod at the Elder Fern's roots is the final objective.
  const heart = new THREE.Group();
  heart.position.set(...HEART_POS);
  const pod = new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(0.62, 2)), glowMat);
  heart.add(pod);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 1.6, -1.1, Math.sin(a) * 1.6),
      new THREE.Vector3(Math.cos(a) * 0.9, -0.3, Math.sin(a) * 0.9),
      new THREE.Vector3(Math.cos(a + 0.6) * 0.5, 0.5, Math.sin(a + 0.6) * 0.5),
    ]);
    heart.add(new THREE.Mesh(scope.track(new THREE.TubeGeometry(curve, 10, 0.12, 5, false)), rootMaterial));
  }
  root.add(heart);

  // ---- Fossil hollow: standing stones around an ammonite and a fish skeleton.
  const [fx, , fz] = FOSSIL_POS;
  const stoneMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x7c7460, roughness: 1, flatShading: true }));
  const stoneGeo = scope.track(new THREE.BoxGeometry(1, 1, 1));
  // Two openings (north-west and east) let the fossil loop pass through the ring.
  for (const a of [1.75, 3.2, 3.9, 4.6, 5.3, 6.0]) {
    const h = 1.6 + random() * 1.6;
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.scale.set(0.9, h, 0.6);
    stone.position.set(fx + Math.cos(a) * 5, h / 2, fz + Math.sin(a) * 5);
    stone.rotation.set((random() - 0.5) * 0.2, a, (random() - 0.5) * 0.2);
    root.add(stone);
    collision.addBox([stone.position.x, h / 2, stone.position.z], [0.55, h / 2, 0.55]);
  }
  const fossil = new THREE.Group();
  fossil.position.set(fx, 0, fz);
  const slab = new THREE.Mesh(scope.track(new THREE.BoxGeometry(3.2, 0.5, 2.4)), stoneMat);
  slab.position.y = 0.55;
  slab.rotation.x = -0.35;
  fossil.add(slab);
  const shellMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xd6c39a, emissive: 0x7fdc9a, emissiveIntensity: 0.35, roughness: 0.6 }));
  const spiral: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const r = 0.08 + t * 0.95;
    spiral.push(new THREE.Vector3(Math.cos(t * Math.PI * 5.2) * r, 0, Math.sin(t * Math.PI * 5.2) * r));
  }
  const ammonite = new THREE.Mesh(scope.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 120, 0.11, 6, false)), shellMat);
  ammonite.position.set(-0.5, 0.86, 0.1);
  ammonite.rotation.x = -0.35;
  fossil.add(ammonite);
  const spine = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5)), shellMat);
  spine.rotation.z = Math.PI / 2;
  spine.position.set(0.9, 0.86, -0.2);
  fossil.add(spine);
  for (let k = 0; k < 7; k++) {
    const rib = new THREE.Mesh(scope.track(new THREE.TorusGeometry(0.22 - k * 0.018, 0.025, 4, 8, Math.PI)), shellMat);
    rib.position.set(0.35 + k * 0.18, 0.86, -0.2);
    rib.rotation.set(-0.35 + Math.PI / 2, 0, 0);
    fossil.add(rib);
  }
  root.add(fossil);

  // ---- Wildlife: a sauropod herd in the southern shallows, flyers aloft.
  const skin = scope.track(new THREE.MeshStandardMaterial({ color: 0x6b7a5a, roughness: 0.85 }));
  const belly = scope.track(new THREE.MeshStandardMaterial({ color: 0x9a9a72, roughness: 0.9 }));
  const herd = Array.from({ length: 4 }, (_, i) => {
    const s = buildSauropod(ctx, skin, belly);
    s.group.scale.setScalar(i === 3 ? 0.55 : 1 - i * 0.08);
    s.group.visible = false;
    root.add(s.group);
    return s;
  });
  const flyerMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x8a5a3e, roughness: 0.8, side: THREE.DoubleSide }));
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0); wingShape.lineTo(3.2, 0.5); wingShape.lineTo(0.6, -1.2); wingShape.closePath();
  const wingGeo = scope.track(new THREE.ShapeGeometry(wingShape));
  wingGeo.rotateX(-Math.PI / 2);
  const flyers = Array.from({ length: 5 }, () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.3, 2.2, 6)), flyerMat);
    body.rotation.x = Math.PI / 2;
    const left = new THREE.Mesh(wingGeo, flyerMat);
    const right = new THREE.Mesh(wingGeo, flyerMat);
    right.scale.x = -1;
    g.add(body, left, right);
    root.add(g);
    return { g, left, right, phase: random() * Math.PI * 2, radius: 36 + random() * 30, height: 30 + random() * 14 };
  });

  // ---- Root gate home: appears once the island is revealed.
  const gate = new THREE.Group();
  gate.position.set(...RETURN_GATE_POS);
  gate.rotation.y = Math.PI / 2; // faces north, clear of the westward vista
  const gateCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, -1.9), new THREE.Vector3(0, 2.2, -2), new THREE.Vector3(0, 3.7, 0),
    new THREE.Vector3(0, 2.2, 2), new THREE.Vector3(0, -0.5, 1.9),
  ]);
  gate.add(new THREE.Mesh(scope.track(new THREE.TubeGeometry(gateCurve, 30, 0.32, 7, false)), rootMaterial));
  const membrane = new THREE.Mesh(scope.track(new THREE.CircleGeometry(1.7, 24)),
    scope.track(new THREE.MeshStandardMaterial({ color: 0xb8f0c8, emissive: 0x58c89a, emissiveIntensity: 1.2, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })));
  membrane.rotation.y = Math.PI / 2;
  membrane.position.y = 1.7;
  gate.add(membrane);
  gate.visible = false;
  root.add(gate);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let fossilStudied = false;

  return {
    heart, fossil, gate,
    markFossilStudied() {
      fossilStudied = true;
      shellMat.emissiveIntensity = 1.3;
    },
    showGate() { gate.visible = true; },
    update(time, unfurl, herdVisible, herdSize, reducedMotion) {
      const animTime = reducedMotion ? 0 : time;
      for (let k = 0; k < crownCount; k++) {
        const local = easeInOut((unfurl - (k % 6) * 0.05) / 0.7);
        // Curled: fronds held upright and short. Open: a broad arching canopy.
        const tilt = THREE.MathUtils.lerp(1.35, -0.12 + (k % 3) * 0.08, local);
        e.set(0, crownYaw[k] + (reducedMotion ? 0 : Math.sin(animTime * 0.5 + k) * 0.02 * local), tilt, 'YZX');
        q.setFromEuler(e);
        const len = crownLen[k] * (0.32 + 0.68 * local);
        crown.setMatrixAt(k, m.compose(p.set(ex, ey + 10.1, ez), q, s.set(len, len, len)));
      }
      crown.instanceMatrix.needsUpdate = true;
      glowMat.emissiveIntensity = 0.6 + unfurl * 1.4 + (reducedMotion ? 0 : Math.sin(time * 2) * 0.15 * (1 - unfurl));
      fiddles.forEach((f) => { f.visible = unfurl < 0.98; f.scale.setScalar(1 - unfurl * 0.7); });
      pod.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 2.4) * 0.06));

      const shown = herdVisible ? (fossilStudied ? herd.length : Math.max(1, herdSize)) : 0;
      herd.forEach((h, i) => {
        h.group.visible = i < shown;
        if (!h.group.visible) return;
        const along = reducedMotion ? 0.35 + i * 0.06 : ((animTime * 0.012) + i * 0.06) % 1;
        // Wading east through the southern shallows, beyond the beach.
        const x = -45 + along * 85;
        h.group.position.set(x, SEA_Y + 0.2, 68 + i * 1.8 - Math.abs(x) * 0.08);
        h.group.rotation.y = 0;
        h.legs.forEach((leg, j) => { leg.rotation.z = reducedMotion ? 0 : Math.sin(animTime * 1.6 + j * Math.PI * 0.5 + i) * 0.28; });
        h.neck.rotation.z = reducedMotion ? 0 : Math.sin(animTime * 0.3 + i) * 0.06;
      });
      for (const f of flyers) {
        const t = animTime * 0.06 + f.phase;
        f.g.position.set(Math.cos(t) * f.radius - 20, f.height + Math.sin(t * 2) * 2, Math.sin(t) * f.radius - 60);
        f.g.rotation.set(0, -t, Math.sin(t) * 0.1);
        const flap = reducedMotion ? 0.15 : Math.sin(animTime * 3 + f.phase) * 0.45;
        f.left.rotation.z = flap;
        f.right.rotation.z = -flap;
      }
      if (gate.visible) membrane.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 1.8) * 0.04));
    },
  };
}
