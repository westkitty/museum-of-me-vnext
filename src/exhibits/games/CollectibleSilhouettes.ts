import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourceScope } from '../../assets/ResourceScope';

/**
 * Five source-faithful, coloured single-draw pickup silhouettes. Shared tier
 * geometries serve all 54 S'mores collectibles. No runtime model downloads,
 * no extra per-pickup material draws, and unchanged pickup radius semantics.
 */
const LABELS = ['bottle-caps', 'garden-gnomes', 'mailboxes', 'parked-cars', 'sheds'] as const;

export function buildCollectibleSilhouette(scope: ResourceScope, tier: number, size: number): THREE.BufferGeometry {
  if (!Number.isInteger(tier) || tier < 0 || tier >= LABELS.length || !Number.isFinite(size) || size <= 0) {
    throw new RangeError('Invalid Smores collectible tier or size');
  }
  const parts: THREE.BufferGeometry[] = [];
  const add = (
    geometry: THREE.BufferGeometry, hex: number,
    x = 0, y = 0, z = 0, rotation: [number, number, number] = [0, 0, 0],
  ): void => {
    geometry.rotateX(rotation[0]);
    geometry.rotateY(rotation[1]);
    geometry.rotateZ(rotation[2]);
    geometry.translate(x, y, z);
    const count = geometry.getAttribute('position').count;
    const colour = new THREE.Color(hex);
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      colours[j] = colour.r;
      colours[j + 1] = colour.g;
      colours[j + 2] = colour.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    parts.push(geometry);
  };
  const box = (w: number, h: number, d: number, colour: number, x = 0, y = 0, z = 0) =>
    add(new THREE.BoxGeometry(w, h, d), colour, x, y, z);
  const ball = (radius: number, colour: number, x = 0, y = 0, z = 0) =>
    add(new THREE.SphereGeometry(radius, 8, 6), colour, x, y, z);

  switch (tier) {
    case 0: {
      add(new THREE.CylinderGeometry(0.76, 0.76, 0.28, 12), 0xd6aa5d);
      add(new THREE.CylinderGeometry(0.60, 0.60, 0.03, 12), 0xffdfa0, 0, 0.16);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        box(0.14, 0.25, 0.13, 0x8a623a, Math.sin(a) * 0.72, 0, Math.cos(a) * 0.72);
      }
      break;
    }
    case 1: {
      add(new THREE.ConeGeometry(0.44, 0.88, 9), 0x477d68, 0, -0.19);
      ball(0.29, 0xecc39f, 0, 0.12, 0.10);
      add(new THREE.ConeGeometry(0.49, 0.70, 10), 0xc84d42, 0, 0.58);
      add(new THREE.ConeGeometry(0.32, 0.56, 8), 0xf2e9d2, 0, -0.16, 0.33, [Math.PI, 0, 0]);
      ball(0.12, 0xf0a585, 0, 0.12, 0.37);
      box(0.32, 0.15, 0.30, 0x282b36, -0.22, -0.68, 0.08);
      box(0.32, 0.15, 0.30, 0x282b36, 0.22, -0.68, 0.08);
      break;
    }
    case 2: {
      add(new THREE.CylinderGeometry(0.115, 0.14, 1.18, 8), 0x71675a, 0, -0.12);
      box(1.13, 0.48, 0.62, 0x509ec2, 0, 0.48, 0);
      add(new THREE.CylinderGeometry(0.31, 0.31, 1.13, 10, 1, false, 0, Math.PI), 0x77c1df,
        0, 0.72, 0, [0, 0, Math.PI / 2]);
      box(0.06, 0.52, 0.075, 0xd8a665, 0.64, 0.56, 0.25);
      box(0.25, 0.17, 0.08, 0xe15e4c, 0.72, 0.79, 0.25);
      break;
    }
    case 3: {
      box(1.70, 0.36, 0.85, 0x558cb6, 0, -0.20);
      box(0.91, 0.44, 0.72, 0xa8c3cc, -0.12, 0.20);
      box(0.60, 0.10, 0.87, 0x27516b, 0.55, -0.28);
      for (const x of [-0.53, 0.53]) {
        for (const z of [-0.48, 0.48]) {
          add(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), 0x272c33,
            x, -0.38, z, [Math.PI / 2, 0, 0]);
        }
      }
      break;
    }
    case 4: {
      box(1.15, 1.10, 0.98, 0x78a48d, 0, -0.11);
      add(new THREE.ConeGeometry(0.93, 0.42, 4), 0x8e4d43, 0, 0.62, 0, [0, Math.PI / 4, 0]);
      box(0.38, 0.78, 0.05, 0x445851, 0.19, -0.24, 0.52);
      ball(0.055, 0xf0d28b, 0.35, -0.23, 0.57);
      box(0.17, 0.20, 0.04, 0xf5d798, -0.28, 0.18, 0.52);
      break;
    }
  }

  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Could not compile Smores collectible silhouette');
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 0;
  if (radius <= 0) {
    geometry.dispose();
    throw new Error('Smores collectible silhouette has empty bounds');
  }
  geometry.scale(size / radius, size / radius, size / radius);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = 'smores-collectible:' + LABELS[tier];
  return scope.track(geometry);
}
