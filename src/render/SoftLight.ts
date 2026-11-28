import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { radialFloorMask } from '../world/RadialFloorMask';

/**
 * Light you can see without paying for a light: soft-edged beams, lamp halos
 * and the pools lamps leave on the ground. Beams keep their existing meshes
 * and materials; halos are one Points draw and pools one instanced draw.
 */

/** Fades a cone/cylinder beam at its silhouette and along its length (uv.y). */
export function softenBeam(material: THREE.MeshBasicMaterial, gain = 2.4, source: 'bottom' | 'top' = 'bottom'): THREE.MeshBasicMaterial {
  material.customProgramCacheKey = () => `museum-soft-beam-1:${source}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.beamGain = { value: gain };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBeamNormal;\nvarying vec3 vBeamView;\nvarying float vBeamAlong;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBeamNormal = normalMatrix * normal;
        vBeamView = -mvPosition.xyz;
        vBeamAlong = uv.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBeamNormal;\nvarying vec3 vBeamView;\nvarying float vBeamAlong;\nuniform float beamGain;')
      .replace('#include <opaque_fragment>', `
        float beamFacing = abs(dot(normalize(vBeamNormal), normalize(vBeamView)));
        float beamAlong = ${source === 'bottom' ? 'vBeamAlong' : '1.0 - vBeamAlong'};
        diffuseColor.a *= beamGain * pow(beamFacing, 1.8) * pow(1.0 - clamp(beamAlong, 0.0, 1.0), 1.35) * smoothstep(0.4, 3.5, length(vBeamView));
        #include <opaque_fragment>`);
  };
  return material;
}

export interface Lamp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Halo diameter in metres. */
  readonly size: number;
  readonly color: number;
  /** Ground height and radius of the pool it leaves, when it has one. */
  readonly pool?: { readonly y: number; readonly radius: number };
}

function haloGeometry(lamps: readonly Lamp[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array(lamps.length * 3);
  const color = new Float32Array(lamps.length * 3);
  const size = new Float32Array(lamps.length);
  const c = new THREE.Color();
  lamps.forEach((lamp, i) => {
    position.set([lamp.x, lamp.y, lamp.z], i * 3);
    c.setHex(lamp.color);
    color.set([c.r, c.g, c.b], i * 3);
    size[i] = lamp.size;
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geometry.setAttribute('haloSize', new THREE.BufferAttribute(size, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Halos and ground pools for a fixed set of lamps. Two draws, no lights. */
export function buildLampGlow(scope: ResourceScope, lamps: readonly Lamp[], name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const viewport = { value: 900 };
  const halos = new THREE.Points(
    scope.track(haloGeometry(lamps)),
    scope.track(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, toneMapped: false,
      uniforms: { viewportHeight: viewport },
      vertexShader: /* glsl */ `
        attribute float haloSize;
        uniform float viewportHeight;
        varying vec3 vHalo;
        varying float vFade;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float pixels = haloSize * projectionMatrix[1][1] * 0.5 * viewportHeight / max(0.5, -mv.z);
          gl_PointSize = clamp(pixels, 2.0, 220.0);
          // Distant lamps shrink to a dim point rather than a fog of sprites.
          vFade = smoothstep(260.0, 60.0, -mv.z) * smoothstep(0.8, 3.0, -mv.z);
          vHalo = color;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vHalo;
        varying float vFade;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r > 1.0) discard;
          float glow = pow(1.0 - r, 2.6) * 0.5 + pow(1.0 - r, 9.0) * 0.6;
          gl_FragColor = vec4(vHalo * glow * vFade, 1.0);
        }`,
    })),
  );
  halos.name = `${name}-halos`;
  halos.renderOrder = 3;
  halos.raycast = () => {};
  halos.onBeforeRender = (renderer) => { viewport.value = renderer.domElement.height; };
  group.add(halos);

  const pooled = lamps.filter((lamp) => lamp.pool);
  if (pooled.length) {
    const pools = scope.track(new THREE.InstancedMesh(
      scope.track(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
      scope.track(new THREE.MeshBasicMaterial({
        color: 0xffffff, alphaMap: radialFloorMask(scope), transparent: true, opacity: 0.34,
        depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2,
      })),
      pooled.length,
    ));
    pools.name = `${name}-pools`;
    pools.renderOrder = 1;
    pools.raycast = () => {};
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    pooled.forEach((lamp, i) => {
      const d = lamp.pool!.radius * 2;
      matrix.makeScale(d, 1, d).setPosition(lamp.x, lamp.pool!.y, lamp.z);
      pools.setMatrixAt(i, matrix);
      pools.setColorAt(i, color.setHex(lamp.color));
    });
    pools.instanceMatrix.needsUpdate = true;
    pools.computeBoundingSphere();
    group.add(pools);
  }
  return group;
}
