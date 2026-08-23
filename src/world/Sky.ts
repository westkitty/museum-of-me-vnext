import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * Canonical procedural night sky for the museum grounds.
 *
 * The starfield and Blood Ring live in the same sky-dome shader: no texture
 * download, no extra renderer, and no horizon seam when the dome follows the
 * visitor. The ring is an angular band on the dome rather than red fog, so it
 * remains a distinct celestial feature at every exterior viewpoint.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly horizon = new THREE.Color(0x071323);

  constructor(scope: ResourceScope) {
    const geometry = scope.track(new THREE.SphereGeometry(420, 32, 20));
    const material = scope.track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x01030b) },
          horizon: { value: this.horizon },
          ground: { value: new THREE.Color(0x020813) },
          offset: { value: 0.02 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          uniform vec3 ground;
          uniform float offset;
          varying vec3 vWorld;
          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          void main() {
            float h = normalize(vWorld).y;
            vec3 colour = h > offset
              ? mix(horizon, top, clamp((h - offset) * 1.55, 0.0, 1.0))
              : mix(horizon, ground, clamp((offset - h) * 2.6, 0.0, 1.0));

            vec3 ray = normalize(vWorld);
            vec2 starCell = floor(vec2(atan(ray.z, ray.x), asin(clamp(ray.y, -1.0, 1.0))) * vec2(95.0, 118.0));
            float star = step(0.986, hash(starCell));
            float bright = hash(starCell + 17.0);
            colour += vec3(0.20, 0.50, 0.92) * star * (0.45 + bright * 0.85) * smoothstep(-0.04, 0.18, h);

            // A celestial ring centred north-west and above the horizon. The
            // angular distance creates a literal red halo in sky space.
            vec3 ringCenter = normalize(vec3(-0.36, 0.58, -0.73));
            float ringAngle = acos(clamp(dot(ray, ringCenter), -1.0, 1.0));
            float ring = 1.0 - smoothstep(0.016, 0.034, abs(ringAngle - 0.43));
            colour = mix(colour, vec3(0.76, 0.025, 0.035), ring * 0.92);
            colour += vec3(0.33, 0.006, 0.012) * ring;
            gl_FragColor = vec4(colour, 1.0);
          }
        `,
      }),
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'night-sky-starfield-blood-ring';
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  /** Keep the dome centred on the visitor so it never has an edge. */
  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }
}
