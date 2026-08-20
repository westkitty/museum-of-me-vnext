import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * Bright daylight sky for the museum grounds.
 *
 * A gradient dome rather than a texture: nothing is fetched, it costs one
 * draw call, and the horizon colour is the same value the fog uses, so the
 * garden and building recede into believable daylight instead of a dark void.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly horizon = new THREE.Color(0xc9e5f2);

  constructor(scope: ResourceScope) {
    const geometry = scope.track(new THREE.SphereGeometry(420, 32, 20));
    const material = scope.track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x4d9fe3) },
          horizon: { value: this.horizon },
          ground: { value: new THREE.Color(0xe8eadf) },
          offset: { value: 0.035 },
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
          void main() {
            float h = normalize(vWorld).y;
            vec3 colour = h > offset
              ? mix(horizon, top, clamp((h - offset) * 1.55, 0.0, 1.0))
              : mix(horizon, ground, clamp((offset - h) * 2.6, 0.0, 1.0));
            gl_FragColor = vec4(colour, 1.0);
          }
        `,
      }),
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'sky';
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  /** Keep the dome centred on the visitor so it never has an edge. */
  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }
}
