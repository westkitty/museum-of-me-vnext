import * as THREE from 'three';
import type { PocketWorldContext } from '../types';
import { gradientSkyDome, seededRandom, tierCount } from '../kit/worldKit';
import { DROP_CENTRE, DROP_RADIUS, MENISCUS_RADIUS } from './w08Layout';

/**
 * W08 visuals that are not gameplay: the drop's skin, the giant garden seen
 * through it, the meniscus floor, drifting water spheres and micro-bubbles,
 * and the fall-and-splash finale. No render targets and no real refraction:
 * the skin is a cheap fresnel shader with slow caustic bands, so the drop
 * reads as water without extra passes or bright flashes.
 */

const SKIN_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SKIN_FRAG = /* glsl */ `
uniform float uTime;
uniform float uMerge;
uniform vec3 uTint;
uniform vec3 uRim;
uniform vec3 uMergeTint;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float f = pow(1.0 - abs(dot(V, vN)), 2.2);
  float band = 0.5 + 0.5 * sin(vW.y * 0.32 + uTime * 0.5 + sin(vW.x * 0.18 + uTime * 0.27) * 2.2 + cos(vW.z * 0.21) * 1.4);
  float caustic = smoothstep(0.86, 1.0, band) * 0.22;
  vec3 tint = mix(uTint, uMergeTint, uMerge);
  vec3 col = mix(tint, uRim, f * 0.8) + caustic * uRim;
  float a = clamp(0.1 + uMerge * 0.22 + f * 0.4 + caustic * 0.25, 0.0, 0.8);
  gl_FragColor = vec4(col, a);
}`;

export interface W08Scenery {
  /** Moves with the fall: the garden, the rill surface and the splash. */
  readonly outside: THREE.Group;
  /** Gameplay-free update; `finale` runs 0..1 through the fall and splash. */
  update(time: number, finale: number, optional: boolean, reduced: boolean): void;
}

export function buildW08Scenery(ctx: PocketWorldContext): W08Scenery {
  const { scope, root } = ctx;
  const rand = seededRandom(808);
  const [cx, cy, cz] = DROP_CENTRE;

  // ---- The sky beyond the garden (a warm late-afternoon dome).
  gradientSkyDome(ctx, { zenith: 0x8fb8d8, horizon: 0xf1e3c2, nadir: 0x26402e, falloff: 0.7 });

  // ---- Outside: giant grass, the rill far below, its stone banks.
  const outside = new THREE.Group();
  outside.name = 'w08-outside';
  root.add(outside);
  const bladeGeo = scope.track(new THREE.PlaneGeometry(1, 1, 1, 6));
  {
    // Taper and bend each blade: widest at the root, curling at the tip.
    const pos = bladeGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + 0.5; // 0..1
      pos.setXYZ(i, pos.getX(i) * (1 - y * 0.92), y, Math.pow(y, 2) * 0.35);
    }
    bladeGeo.computeVertexNormals();
  }
  const bladeMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8, vertexColors: false }));
  const bladeCount = tierCount(ctx, 90, 40);
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < bladeCount; k++) {
    const a = (k / bladeCount) * Math.PI * 2 + rand() * 0.2;
    const d = 62 + rand() * 120;
    const h = 90 + rand() * 170;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    blades.setMatrixAt(k, mtx.compose(v.set(cx + Math.cos(a) * d, -95, cz + Math.sin(a) * d), q, s.set(6 + rand() * 8, h, 6)));
    blades.setColorAt(k, col.setHSL(0.25 + rand() * 0.07, 0.45, 0.24 + rand() * 0.16));
  }
  blades.raycast = () => {};
  outside.add(blades);

  const rillMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x3d6e74, roughness: 0.18, metalness: 0.1, emissive: 0x0e2a30, emissiveIntensity: 0.6 }));
  // A ring of water with a hole the size of the drop: when the drop sinks into
  // the rill the surface meets its skin instead of slicing through the inside.
  const rill = new THREE.Mesh(scope.track(new THREE.RingGeometry(DROP_RADIUS - 1.5, 700, 96, 2)), rillMat);
  rill.rotation.x = -Math.PI / 2;
  rill.position.set(cx, -95, cz);
  rill.raycast = () => {};
  outside.add(rill);
  const bankMat = scope.track(new THREE.MeshStandardMaterial({ color: 0x8c8478, roughness: 0.95, flatShading: true }));
  const bankGeo = scope.track(new THREE.DodecahedronGeometry(1, 0));
  const banks = new THREE.InstancedMesh(bankGeo, bankMat, 16);
  for (let k = 0; k < 16; k++) {
    const side = k % 2 ? 1 : -1;
    const along = (k >> 1) * 90 - 320;
    q.setFromAxisAngle(up, rand() * 3);
    banks.setMatrixAt(k, mtx.compose(v.set(cx + along, -100, cz + side * (150 + rand() * 20)), q, s.set(46, 26 + rand() * 12, 38)));
  }
  banks.raycast = () => {};
  outside.add(banks);

  // ---- The splash: ripple rings on the rill and a crown of spray.
  const rippleMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xd9f4ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const ripples: THREE.Mesh[] = [];
  const rippleGeo = scope.track(new THREE.RingGeometry(0.94, 1, 96));
  for (let k = 0; k < 4; k++) {
    const ring = new THREE.Mesh(rippleGeo, rippleMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, -94.6, cz);
    ring.visible = false;
    ring.raycast = () => {};
    outside.add(ring);
    ripples.push(ring);
  }
  const sprayCount = tierCount(ctx, 220, 80);
  const sprayMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xe6f8ff, transparent: true, opacity: 0.75, roughness: 0.1, emissive: 0x7fbfd6, emissiveIntensity: 0.3 }));
  const spray = new THREE.InstancedMesh(scope.track(new THREE.SphereGeometry(1, 8, 6)), sprayMat, sprayCount);
  const sprayDir = Array.from({ length: sprayCount }, () => {
    const a = rand() * Math.PI * 2;
    return { a, out: 40 + rand() * 60, up: 30 + rand() * 50, size: 1.5 + rand() * 3.5 };
  });
  spray.visible = false;
  spray.frustumCulled = false;
  spray.raycast = () => {};
  outside.add(spray);
  const rainbowArcs: THREE.Mesh[] = [];
  const arcColours = [0xff5a4a, 0xffa040, 0xffe060, 0x6ad86a, 0x5aa0ff, 0x8a6aff];
  arcColours.forEach((hex, k) => {
    const arc = new THREE.Mesh(
      scope.track(new THREE.TorusGeometry(150 + k * 5, 2.4, 6, 96, Math.PI)),
      scope.track(new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false, fog: false })),
    );
    arc.position.set(cx, -95, cz - 160);
    arc.visible = false;
    arc.raycast = () => {};
    outside.add(arc);
    rainbowArcs.push(arc);
  });

  // ---- The drop's skin.
  const skinMat = scope.track(new THREE.ShaderMaterial({
    vertexShader: SKIN_VERT,
    fragmentShader: SKIN_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uMerge: { value: 0 },
      uTint: { value: new THREE.Color(0x6fb8cc) },
      uRim: { value: new THREE.Color(0xf2fbff) },
      uMergeTint: { value: new THREE.Color(0x4f8f8c) },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  }));
  const skin = new THREE.Mesh(scope.track(new THREE.SphereGeometry(DROP_RADIUS, 64, 40)), skinMat);
  skin.position.set(cx, cy, cz);
  skin.renderOrder = 5;
  skin.raycast = () => {};
  root.add(skin);

  // ---- The meniscus floor and its rising lip.
  const floorGeo = scope.track(new THREE.CircleGeometry(MENISCUS_RADIUS, 72, 0, Math.PI * 2));
  {
    const pos = floorGeo.getAttribute('position');
    const colours = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const inner = new THREE.Color(0x3f8fa6);
    const outer = new THREE.Color(0x96d2e2);
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i)) / MENISCUS_RADIUS;
      c.copy(inner).lerp(outer, r * r);
      colours.set([c.r, c.g, c.b], i * 3);
    }
    floorGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  }
  const floor = new THREE.Mesh(floorGeo, scope.track(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.14, metalness: 0.05, emissive: 0x0c3440, emissiveIntensity: 0.35 })));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.raycast = () => {};
  root.add(floor);
  const lip = new THREE.Mesh(
    scope.track(new THREE.TorusGeometry(MENISCUS_RADIUS + 0.6, 1.1, 10, 96)),
    scope.track(new THREE.MeshStandardMaterial({ color: 0xcff0fa, transparent: true, opacity: 0.7, roughness: 0.1, emissive: 0x5fb0c8, emissiveIntensity: 0.4 })),
  );
  lip.rotation.x = -Math.PI / 2;
  lip.position.set(cx, 0.35, cz);
  lip.raycast = () => {};
  root.add(lip);

  // ---- Splash ripples across the meniscus, inside the drop.
  const innerRippleMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0, depthWrite: false }));
  const innerRipples: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const ring = new THREE.Mesh(scope.track(new THREE.RingGeometry(0.96, 1, 96)), innerRippleMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.04, cz);
    ring.visible = false;
    ring.raycast = () => {};
    root.add(ring);
    innerRipples.push(ring);
  }

  // ---- Drifting water spheres, high above the route.
  const orbCount = tierCount(ctx, 12, 6);
  const orbMat = scope.track(new THREE.MeshStandardMaterial({ color: 0xd4f4ff, transparent: true, opacity: 0.32, roughness: 0.05, emissive: 0x6ab8d0, emissiveIntensity: 0.25, depthWrite: false }));
  const orbs = new THREE.InstancedMesh(scope.track(new THREE.SphereGeometry(1, 24, 16)), orbMat, orbCount);
  const orbit = Array.from({ length: orbCount }, (_, k) => ({
    a: (k / orbCount) * Math.PI * 2, r: 24 + rand() * 5, y: 31 + rand() * 9, size: 1.2 + rand() * 1.8, speed: 0.025 + rand() * 0.03,
  }));
  orbs.raycast = () => {};
  orbs.frustumCulled = false;
  root.add(orbs);

  // ---- Micro-bubbles rising slowly through the drop.
  const bubbleCount = tierCount(ctx, 500, 160);
  const bubblePos = new Float32Array(bubbleCount * 3);
  const bubbleBase = Array.from({ length: bubbleCount }, () => {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 27;
    return { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, y: rand() * 40, speed: 0.3 + rand() * 0.6 };
  });
  const bubbleGeo = scope.track(new THREE.BufferGeometry());
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
  const sprite = (() => {
    const size = 32;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const ring = Math.max(0, 1 - Math.abs(d - 0.75) * 5) + Math.max(0, 0.35 - d) * 0.8;
      data.set([255, 255, 255, Math.round(Math.min(1, ring) * 220)], (y * size + x) * 4);
    }
    const tex = scope.track(new THREE.DataTexture(data, size, size));
    tex.needsUpdate = true;
    return tex;
  })();
  const microBubbles = new THREE.Points(bubbleGeo, scope.track(new THREE.PointsMaterial({ color: 0xffffff, map: sprite, size: 0.32, transparent: true, depthWrite: false, opacity: 0.8 })));
  microBubbles.frustumCulled = false;
  microBubbles.raycast = () => {};
  root.add(microBubbles);

  const placeBubbles = (time: number) => {
    bubbleBase.forEach((b, i) => {
      bubblePos[i * 3] = b.x + Math.sin(time * 0.7 + i) * 0.3;
      bubblePos[i * 3 + 1] = (b.y + time * b.speed) % 40;
      bubblePos[i * 3 + 2] = b.z;
    });
    bubbleGeo.attributes.position.needsUpdate = true;
  };
  const placeOrbs = (time: number) => {
    orbit.forEach((o, k) => {
      const a = o.a + time * o.speed;
      orbs.setMatrixAt(k, mtx.compose(v.set(cx + Math.cos(a) * o.r, o.y + Math.sin(time * 0.3 + k) * 0.8, cz + Math.sin(a) * o.r), q.identity(), s.setScalar(o.size)));
    });
    orbs.instanceMatrix.needsUpdate = true;
  };
  placeBubbles(0);
  placeOrbs(0);

  const ease = (t: number) => {
    const c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
  };

  return {
    outside,
    update(time, finale, optional, reduced) {
      const t = reduced ? 0 : time;
      skinMat.uniforms.uTime.value = t;
      if (!reduced) {
        placeBubbles(time);
        placeOrbs(time);
      }
      // Fall (0..0.6): the garden and the rill rush up until the rill meets the drop's base.
      const fall = ease(finale / 0.6);
      const sink = finale <= 0.6 ? 0 : ease((finale - 0.6) / 0.4);
      // The rill climbs to the drop's base, then a little above the meniscus as the drop settles into it.
      outside.position.y = fall * 72 + sink * 26;
      // Splash (0.6..1): rings spread, spray rises in a crown, the drop's skin takes on the rill's colour.
      const splash = finale <= 0.6 ? 0 : (finale - 0.6) / 0.4;
      skinMat.uniforms.uMerge.value = ease(splash) * 0.85;
      const showRipples = splash > 0;
      ripples.forEach((ring, k) => {
        ring.visible = showRipples;
        if (!showRipples) return;
        const local = reduced ? 0.55 : Math.min(1, Math.max(0, splash * 1.3 - k * 0.12));
        ring.scale.setScalar(40 + local * 220 + k * 18);
      });
      rippleMat.opacity = showRipples ? 0.55 * (1 - Math.max(0, splash - 0.5)) : 0;
      innerRipples.forEach((ring, k) => {
        ring.visible = showRipples;
        if (!showRipples) return;
        const local = reduced ? 0.5 + k * 0.15 : ((splash * 1.6 + k / 3) % 1);
        ring.scale.setScalar(2 + local * (MENISCUS_RADIUS - 3));
      });
      innerRippleMat.opacity = showRipples ? 0.5 * (1 - ease(Math.max(0, splash - 0.6) / 0.4)) : 0;
      spray.visible = showRipples && splash < 0.98;
      if (spray.visible) {
        const st = reduced ? 0.35 : splash;
        sprayDir.forEach((d, k) => {
          const out = 38 + d.out * st * 0.6;
          const y = -94 + d.up * 1.4 * Math.sin(Math.min(1, st * 1.15) * Math.PI);
          spray.setMatrixAt(k, mtx.compose(v.set(cx + Math.cos(d.a) * out, y, cz + Math.sin(d.a) * out), q.identity(), s.setScalar(d.size)));
        });
        spray.instanceMatrix.needsUpdate = true;
        sprayMat.opacity = 0.75 * (1 - st * 0.6);
      }
      rainbowArcs.forEach((arc) => {
        arc.visible = optional && splash > 0;
        (arc.material as THREE.MeshBasicMaterial).opacity = optional ? 0.38 * ease(splash * 1.6) : 0;
      });
    },
  };
}
