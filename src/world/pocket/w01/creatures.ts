import * as THREE from 'three';
import type { ResourceScope } from '../../../assets/ResourceScope';
import type { QualitySettings } from '../../../render/QualityTiers';

export interface W01CreatureRig {
  readonly group: THREE.Group;
  setAwakened(awakened: boolean): void;
  setCathedralProcession(active: boolean): void;
  update(time: number, reducedMotion: boolean): void;
}

/**
 * Articulated, anatomically recognizable marine musicians built from
 * layered procedural geometry (no generic cubes/boxes) + distant ambient life.
 */
export class W01MarineLife {
  readonly group = new THREE.Group();
  readonly turtle: W01CreatureRig;
  readonly ray: W01CreatureRig;
  readonly whale: W01CreatureRig;

  private readonly schoolFish: THREE.InstancedMesh;
  private readonly schoolCount: number;
  private readonly motes: THREE.InstancedMesh;
  private readonly moteCount: number;
  private readonly dummy = new THREE.Object3D();
  private elapsed = 0;

  constructor(scope: ResourceScope, quality: QualitySettings) {
    this.group.name = 'w01-marine-life';

    this.turtle = buildSeaTurtle(scope);
    this.ray = buildMantaRay(scope);
    this.whale = buildBaleenWhale(scope);

    this.group.add(this.turtle.group, this.ray.group, this.whale.group);

    // Distant schooling fish silhouettes (no spiders, recognizable streamlined fish)
    this.schoolCount = quality.tier === 'low' ? 36 : quality.tier === 'medium' ? 64 : 96;
    const fishGeo = scope.track(new THREE.ConeGeometry(0.18, 0.75, 6));
    fishGeo.rotateX(Math.PI / 2);
    const fishMat = scope.track(new THREE.MeshStandardMaterial({
      color: 0x5be3d8,
      emissive: 0x165e73,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }));
    this.schoolFish = new THREE.InstancedMesh(fishGeo, fishMat, this.schoolCount);
    this.schoolFish.name = 'w01-schooling-fish';
    this.schoolFish.frustumCulled = false;
    this.group.add(this.schoolFish);

    // Suspended luminous ocean motes
    this.moteCount = quality.tier === 'low' ? 80 : 180;
    const moteGeo = scope.track(new THREE.OctahedronGeometry(0.09, 0));
    const moteMat = scope.track(new THREE.MeshBasicMaterial({
      color: 0x9ef7ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }));
    this.motes = new THREE.InstancedMesh(moteGeo, moteMat, this.moteCount);
    this.motes.name = 'w01-suspended-motes';
    this.motes.frustumCulled = false;
    this.group.add(this.motes);

    this.updateAmbientLife(0);
  }

  update(dt: number, reducedMotion: boolean): void {
    if (!reducedMotion) {
      this.elapsed += Math.max(0, dt);
    }
    this.turtle.update(this.elapsed, reducedMotion);
    this.ray.update(this.elapsed, reducedMotion);
    this.whale.update(this.elapsed, reducedMotion);
    if (!reducedMotion) {
      this.updateAmbientLife(this.elapsed);
    }
  }

  private updateAmbientLife(time: number): void {
    for (let i = 0; i < this.schoolCount; i++) {
      const ring = 24 + (i % 4) * 18;
      const angle = (i / this.schoolCount) * Math.PI * 2 + time * (0.06 + (i % 3) * 0.015);
      const y = -6 + ((i * 7) % 24) + Math.sin(time * 0.9 + i) * 0.6;
      const x = Math.cos(angle) * ring;
      const z = -42 + Math.sin(angle) * ring;
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(0, -angle, 0);
      this.dummy.scale.set(1, 0.85, 1.3);
      this.dummy.updateMatrix();
      this.schoolFish.setMatrixAt(i, this.dummy.matrix);
    }
    this.schoolFish.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.moteCount; i++) {
      const seed = i * 1.6180339;
      const x = Math.sin(seed * 3.1) * 90;
      const z = -48 + Math.cos(seed * 2.7) * 85;
      const y = -14 + ((i * 1.7 + time * 0.22) % 34);
      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(0, time * 0.4 + seed, 0);
      this.dummy.scale.setScalar(0.8 + (i % 3) * 0.35);
      this.dummy.updateMatrix();
      this.motes.setMatrixAt(i, this.dummy.matrix);
    }
    this.motes.instanceMatrix.needsUpdate = true;
  }
}

function buildSeaTurtle(scope: ResourceScope): W01CreatureRig {
  const root = new THREE.Group();
  root.name = 'w01-musician-turtle';
  const body = new THREE.Group();
  root.add(body);

  const shellMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x2f7d6b,
    emissive: 0x0c2e28,
    emissiveIntensity: 0.35,
    roughness: 0.55,
    metalness: 0.1,
  }));
  const skinMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x56a68c,
    emissive: 0x10332b,
    emissiveIntensity: 0.25,
    roughness: 0.65,
  }));
  const auraMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x4ef5c5,
    emissive: 0x2ae0ae,
    emissiveIntensity: 0.4,
    roughness: 0.3,
  }));

  // Domed carapace + plastron
  const carapace = new THREE.Mesh(scope.track(new THREE.SphereGeometry(2.1, 18, 12)), shellMat);
  carapace.scale.set(1.05, 0.52, 1.38);
  carapace.position.y = 0.22;
  body.add(carapace);

  const plastron = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(1.75, 1.55, 0.32, 16)), skinMat);
  plastron.scale.set(1.0, 1, 1.32);
  plastron.position.y = -0.18;
  body.add(plastron);

  // Scute ridge plates along the shell
  const scuteGeo = scope.track(new THREE.CylinderGeometry(0.55, 0.72, 0.22, 6));
  for (let i = -1; i <= 1; i++) {
    const scute = new THREE.Mesh(scuteGeo, auraMat);
    scute.position.set(0, 1.12 - Math.abs(i) * 0.12, i * 1.05);
    body.add(scute);
  }

  // Head & neck
  const neck = new THREE.Mesh(scope.track(new THREE.CylinderGeometry(0.42, 0.52, 1.1, 10)), skinMat);
  neck.rotation.x = Math.PI / 2 - 0.15;
  neck.position.set(0, 0.15, 2.75);
  body.add(neck);

  const head = new THREE.Mesh(scope.track(new THREE.SphereGeometry(0.62, 12, 10)), skinMat);
  head.scale.set(0.85, 0.78, 1.28);
  head.position.set(0, 0.28, 3.45);
  body.add(head);

  const eyeGeo = scope.track(new THREE.SphereGeometry(0.11, 8, 8));
  const eyeMat = scope.track(new THREE.MeshBasicMaterial({ color: 0xf7ffcb }));
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.44, 0.42, 3.72);
    body.add(eye);
  }

  // 4 articulated paddle flippers
  const frontFlipperGeo = scope.track(new THREE.SphereGeometry(1, 10, 8));
  const frontPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.75, -0.05, 1.45);
    const blade = new THREE.Mesh(frontFlipperGeo, skinMat);
    blade.scale.set(1.45, 0.14, 0.55);
    blade.position.set(side * 1.25, 0, -0.25);
    blade.rotation.y = side * -0.4;
    pivot.add(blade);
    body.add(pivot);
    frontPivots.push(pivot);
  }

  const rearPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.3, -0.1, -2.05);
    const blade = new THREE.Mesh(frontFlipperGeo, skinMat);
    blade.scale.set(0.85, 0.12, 0.45);
    blade.position.set(side * 0.65, 0, -0.35);
    blade.rotation.y = side * 0.5;
    pivot.add(blade);
    body.add(pivot);
    rearPivots.push(pivot);
  }

  let awakened = false;
  let procession = false;
  const homeCenter = new THREE.Vector3(-68, 9.5, -66);
  const cathedralCenter = new THREE.Vector3(0, 13, -34);

  return {
    group: root,
    setAwakened(val) {
      awakened = val;
      auraMat.emissiveIntensity = val ? 1.35 : 0.4;
      shellMat.emissiveIntensity = val ? 0.65 : 0.35;
    },
    setCathedralProcession(active) {
      procession = active;
    },
    update(time, reducedMotion) {
      const center = procession ? cathedralCenter : homeCenter;
      const radius = procession ? 24 : 9.5;
      const speed = awakened ? 0.22 : 0.1;
      const angle = reducedMotion ? 0.6 : time * speed;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const y = center.y + (reducedMotion ? 0 : Math.sin(time * 0.65) * 0.9);
      body.position.set(x, y, z);
      body.rotation.y = -angle;
      const flap = reducedMotion ? 0.15 : Math.sin(time * (awakened ? 2.4 : 1.4)) * 0.38;
      frontPivots[0].rotation.z = flap;
      frontPivots[1].rotation.z = -flap;
      rearPivots[0].rotation.z = -flap * 0.45;
      rearPivots[1].rotation.z = flap * 0.45;
    },
  };
}

function buildMantaRay(scope: ResourceScope): W01CreatureRig {
  const root = new THREE.Group();
  root.name = 'w01-musician-ray';
  const body = new THREE.Group();
  root.add(body);

  const dorsalMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x1e4c7a,
    emissive: 0x155d87,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  }));
  const bellyMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0xc2f2ff,
    emissive: 0x3ec2e6,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  }));

  // Central torso disc
  const torso = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1.5, 16, 12)), dorsalMat);
  torso.scale.set(1.3, 0.34, 1.85);
  body.add(torso);

  const belly = new THREE.Mesh(scope.track(new THREE.SphereGeometry(1.25, 14, 10)), bellyMat);
  belly.scale.set(1.2, 0.2, 1.55);
  belly.position.y = -0.18;
  body.add(belly);

  // Sweeping articulated pectoral wings (inner + outer segments)
  const wingGeo = scope.track(new THREE.ConeGeometry(1.45, 3.4, 4));
  wingGeo.rotateZ(Math.PI / 2);
  const innerWings: THREE.Group[] = [];
  const outerWings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const inner = new THREE.Group();
    inner.position.set(side * 1.1, 0, 0.1);
    const innerMesh = new THREE.Mesh(wingGeo, dorsalMat);
    innerMesh.scale.set(1, 0.18, 1.2);
    innerMesh.rotation.z = side === 1 ? Math.PI : 0;
    innerMesh.position.set(side * 1.5, 0, -0.2);
    inner.add(innerMesh);

    const outer = new THREE.Group();
    outer.position.set(side * 2.4, 0, -0.45);
    const outerMesh = new THREE.Mesh(wingGeo, bellyMat);
    outerMesh.scale.set(0.7, 0.12, 0.75);
    outerMesh.rotation.z = side === 1 ? Math.PI : 0;
    outerMesh.position.set(side * 0.9, 0, -0.25);
    outer.add(outerMesh);
    inner.add(outer);

    body.add(inner);
    innerWings.push(inner);
    outerWings.push(outer);
  }

  // Cephalic lobes
  const lobeGeo = scope.track(new THREE.ConeGeometry(0.24, 1.1, 8));
  lobeGeo.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const lobe = new THREE.Mesh(lobeGeo, dorsalMat);
    lobe.position.set(side * 0.78, -0.04, 2.55);
    lobe.rotation.y = side * -0.18;
    body.add(lobe);
  }

  // Slender whip tail
  const tail = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.16, 4.6, 8)), dorsalMat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -4.3);
  body.add(tail);

  let awakened = false;
  let procession = false;
  const homeCenter = new THREE.Vector3(68, 17, -64);
  const cathedralCenter = new THREE.Vector3(0, 17.5, -34);

  return {
    group: root,
    setAwakened(val) {
      awakened = val;
      bellyMat.emissiveIntensity = val ? 1.25 : 0.35;
      dorsalMat.emissiveIntensity = val ? 0.85 : 0.45;
    },
    setCathedralProcession(active) {
      procession = active;
    },
    update(time, reducedMotion) {
      const center = procession ? cathedralCenter : homeCenter;
      const radius = procession ? 29 : 11;
      const speed = awakened ? 0.34 : 0.16;
      const angle = reducedMotion ? -0.7 : -time * speed;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const y = center.y + (reducedMotion ? 0 : Math.sin(time * 0.85) * 1.4);
      body.position.set(x, y, z);
      body.rotation.y = -angle + Math.PI;
      body.rotation.z = reducedMotion ? 0.12 : 0.22;

      const phase = reducedMotion ? 0.2 : time * (awakened ? 2.6 : 1.7);
      innerWings[0].rotation.z = Math.sin(phase) * 0.28;
      innerWings[1].rotation.z = -Math.sin(phase) * 0.28;
      outerWings[0].rotation.z = Math.sin(phase - 0.65) * 0.36;
      outerWings[1].rotation.z = -Math.sin(phase - 0.65) * 0.36;
    },
  };
}

function buildBaleenWhale(scope: ResourceScope): W01CreatureRig {
  const root = new THREE.Group();
  root.name = 'w01-musician-whale';
  const body = new THREE.Group();
  root.add(body);

  const whaleBackMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0x203b66,
    emissive: 0x102952,
    emissiveIntensity: 0.45,
    roughness: 0.48,
    metalness: 0.12,
  }));
  const whaleBellyMat = scope.track(new THREE.MeshStandardMaterial({
    color: 0xd9c28c,
    emissive: 0x705825,
    emissiveIntensity: 0.25,
    roughness: 0.55,
  }));

  // Main hull (~22 m total length)
  const hull = new THREE.Mesh(scope.track(new THREE.SphereGeometry(3.2, 20, 14)), whaleBackMat);
  hull.scale.set(0.95, 0.85, 3.05);
  body.add(hull);

  // Pleated ventral throat
  const throat = new THREE.Mesh(scope.track(new THREE.SphereGeometry(2.65, 16, 12)), whaleBellyMat);
  throat.scale.set(0.86, 0.55, 2.4);
  throat.position.set(0, -1.05, 1.8);
  body.add(throat);

  // Sculpted rostrum
  const rostrum = new THREE.Mesh(scope.track(new THREE.ConeGeometry(2.1, 4.8, 14)), whaleBackMat);
  rostrum.rotation.x = Math.PI / 2;
  rostrum.scale.set(1.05, 1, 0.65);
  rostrum.position.set(0, 0.15, 8.2);
  body.add(rostrum);

  // Dorsal ridge
  const dorsal = new THREE.Mesh(scope.track(new THREE.ConeGeometry(0.55, 1.5, 8)), whaleBackMat);
  dorsal.rotation.x = -0.35;
  dorsal.position.set(0, 2.75, -3.5);
  body.add(dorsal);

  // Long sweeping pectoral fins
  const finGeo = scope.track(new THREE.SphereGeometry(1, 10, 8));
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(finGeo, whaleBackMat);
    fin.scale.set(3.2, 0.18, 0.95);
    fin.position.set(side * 4.2, -1.1, 2.4);
    fin.rotation.y = side * -0.45;
    fin.rotation.z = side * -0.25;
    body.add(fin);
  }

  // Articulated tail peduncle + broad horizontal flukes
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -8.8);
  const peduncle = new THREE.Mesh(scope.track(new THREE.ConeGeometry(1.5, 4.8, 12)), whaleBackMat);
  peduncle.rotation.x = -Math.PI / 2;
  peduncle.position.set(0, 0, -2.2);
  tailPivot.add(peduncle);

  const flukeGeo = scope.track(new THREE.ConeGeometry(1.8, 4.2, 6));
  flukeGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const fluke = new THREE.Mesh(flukeGeo, whaleBackMat);
    fluke.scale.set(1, 0.16, 0.85);
    fluke.rotation.z = side === 1 ? Math.PI : 0;
    fluke.position.set(side * 1.9, 0, -4.4);
    tailPivot.add(fluke);
  }
  body.add(tailPivot);

  let awakened = false;
  let procession = false;
  const homeCenter = new THREE.Vector3(0, 3, -132);
  const cathedralCenter = new THREE.Vector3(0, 23, -36);

  return {
    group: root,
    setAwakened(val) {
      awakened = val;
      whaleBellyMat.emissiveIntensity = val ? 0.95 : 0.25;
      whaleBackMat.emissiveIntensity = val ? 0.72 : 0.45;
    },
    setCathedralProcession(active) {
      procession = active;
    },
    update(time, reducedMotion) {
      const center = procession ? cathedralCenter : homeCenter;
      const radius = procession ? 36 : 19;
      const speed = awakened ? 0.14 : 0.07;
      const angle = reducedMotion ? 0.4 : time * speed;
      const x = center.x + Math.cos(angle) * radius;
      const z = center.z + Math.sin(angle) * radius;
      const y = center.y + (reducedMotion ? 0 : Math.sin(time * 0.45) * 1.6);
      body.position.set(x, y, z);
      body.rotation.y = -angle;
      tailPivot.rotation.x = reducedMotion ? 0 : Math.sin(time * (awakened ? 1.8 : 1.1)) * 0.22;
    },
  };
}
