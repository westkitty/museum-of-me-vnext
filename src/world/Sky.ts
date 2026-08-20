import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * The sky the museum sits under, and the light it casts inside.
 *
 * A gradient dome rather than a texture: nothing is fetched, it costs one
 * draw call, and the horizon colour is the same value the fog uses, so the
 * building never appears to float against a void.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly horizon = new THREE.Color(0x2a2836);

  constructor(scope: ResourceScope) {
    const geometry = scope.track(new THREE.SphereGeometry(420, 32, 20));
    const material = scope.track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x0a0a14) },
          horizon: { value: this.horizon },
          ground: { value: new THREE.Color(0x14121a) },
          offset: { value: 0.06 },
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
              ? mix(horizon, top, clamp((h - offset) * 1.9, 0.0, 1.0))
              : mix(horizon, ground, clamp((offset - h) * 3.2, 0.0, 1.0));
            gl_FragColor = vec4(colour, 1.0);
          }
        `,
      }),
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'sky';
    // The sky is always behind everything and never occludes.
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;
  }

  /** Keep the dome centred on the visitor so it never has an edge. */
  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }
}
