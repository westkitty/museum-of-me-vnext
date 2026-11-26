import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { landscapeClock } from './LandscapeShading';

const HALF_PIXEL = 'uniform float viewportHeight;';

function sizeToViewport(points: THREE.Points, uniform: { value: number }): void {
  points.onBeforeRender = (renderer) => { uniform.value = renderer.domElement.height; };
}

function seeded(i: number): number {
  const x = Math.sin(i * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Dust in the gallery light: one draw of a few hundred points that wrap around
 * the camera on the GPU. Nothing is updated per particle on the CPU.
 */
export class GalleryDust {
  readonly points: THREE.Points;
  private readonly total = 260;

  constructor(scope: ResourceScope) {
    const seeds = new Float32Array(this.total * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = seeded(i);
    const geometry = scope.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    const viewport = { value: 900 };
    const material = scope.track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: landscapeClock, viewportHeight: viewport },
      vertexShader: /* glsl */ `
        uniform float time;
        ${HALF_PIXEL}
        varying float vGlint;
        void main() {
          vec3 box = vec3(13.0, 6.0, 13.0);
          vec3 seed = position;
          vec3 drift = vec3(0.05 * time + 0.35 * sin(time * 0.13 + seed.y * 40.0),
                            -0.028 * time + 0.2 * sin(time * 0.21 + seed.x * 31.0),
                            0.3 * sin(time * 0.11 + seed.z * 47.0));
          vec3 rel = mod(seed * box + drift - cameraPosition, box) - 0.5 * box;
          vec4 mv = viewMatrix * vec4(cameraPosition + rel, 1.0);
          gl_Position = projectionMatrix * mv;
          float depth = max(0.2, -mv.z);
          gl_PointSize = clamp(mix(0.006, 0.013, seed.z) * projectionMatrix[1][1] * 0.5 * viewportHeight / depth, 1.0, 7.0);
          float edge = 1.0 - smoothstep(0.32, 0.5, max(max(abs(rel.x) / box.x, abs(rel.z) / box.z), abs(rel.y) / box.y));
          vGlint = edge * smoothstep(0.5, 1.6, depth) * (0.45 + 0.55 * sin(time * mix(0.5, 1.4, seed.x) + seed.y * 60.0));
        }`,
      fragmentShader: /* glsl */ `
        varying float vGlint;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r > 1.0 || vGlint <= 0.01) discard;
          gl_FragColor = vec4(vec3(1.0, 0.94, 0.84) * (1.0 - r) * vGlint * 0.26, 1.0);
        }`,
    }));
    this.points = new THREE.Points(geometry, material);
    this.points.name = 'gallery-dust';
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    this.points.raycast = () => {};
    sizeToViewport(this.points, viewport);
  }

  /** Follows the quality tier without reallocating anything. */
  setDetail(detailScale: number): void {
    this.points.geometry.setDrawRange(0, Math.round(this.total * detailScale));
  }
}

/** Fireflies over planted ground: one fixed draw, animated on the GPU. */
export function buildFireflies(scope: ResourceScope, sites: readonly (readonly [number, number, number])[]): THREE.Points {
  const position = new Float32Array(sites.length * 3);
  const phase = new Float32Array(sites.length);
  sites.forEach((site, i) => {
    position.set(site, i * 3);
    phase[i] = seeded(i + 91) * Math.PI * 2;
  });
  const geometry = scope.track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  geometry.computeBoundingSphere();
  const viewport = { value: 900 };
  const points = new THREE.Points(geometry, scope.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { time: landscapeClock, viewportHeight: viewport },
    vertexShader: /* glsl */ `
      attribute float phase;
      uniform float time;
      ${HALF_PIXEL}
      varying float vLit;
      void main() {
        vec3 p = position + vec3(
          1.3 * sin(time * 0.23 + phase) + 0.5 * sin(time * 0.71 + phase * 3.0),
          0.4 * sin(time * 0.47 + phase * 2.0),
          1.3 * cos(time * 0.19 + phase * 1.7));
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = max(0.3, -mv.z);
        gl_PointSize = clamp(0.16 * projectionMatrix[1][1] * 0.5 * viewportHeight / depth, 1.5, 26.0);
        vLit = pow(max(0.0, sin(time * 0.9 + phase * 5.0)), 3.0) * smoothstep(70.0, 30.0, depth);
      }`,
    fragmentShader: /* glsl */ `
      varying float vLit;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0 || vLit <= 0.01) discard;
        float glow = pow(1.0 - r, 2.0) * 0.55 + pow(1.0 - r, 8.0);
        gl_FragColor = vec4(vec3(0.78, 1.0, 0.5) * glow * vLit, 1.0);
      }`,
  })));
  points.name = 'garden-fireflies';
  points.renderOrder = 4;
  points.raycast = () => {};
  sizeToViewport(points, viewport);
  return points;
}

/** Deterministic scatter around known dry-land markers. */
export function scatterAround(anchors: readonly { readonly x: number; readonly z: number }[], perAnchor: number, groundY: number): [number, number, number][] {
  const sites: [number, number, number][] = [];
  anchors.forEach((anchor, i) => {
    for (let j = 0; j < perAnchor; j++) {
      const a = seeded(i * 17 + j * 5) * Math.PI * 2;
      const r = 2.2 + 3 * seeded(i * 23 + j * 7 + 3);
      sites.push([anchor.x + Math.cos(a) * r, groundY + 0.6 + 1.5 * seeded(i * 29 + j * 11 + 1), anchor.z + Math.sin(a) * r]);
    }
  });
  return sites;
}
