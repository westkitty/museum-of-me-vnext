import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';

/**
 * Procedural night sky for the museum grounds. Stars live in a camera-following
 * dome; the Blood Ring is a separate world-relative orbital structure.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly bloodRing: THREE.Mesh;
  readonly horizon = new THREE.Color(0x17304b);

  // The surface-view composition needs a broad sky sweep, not a distant
  // hairline or a heavy torus hidden behind the building.
  static readonly BLOOD_RING_ORBIT_RADIUS = 285;
  static readonly BLOOD_RING_TUBE_RADIUS = 5.2;
  static readonly BLOOD_RING_HEIGHT = 255;

  constructor(scope: ResourceScope) {
    const geometry = scope.track(new THREE.SphereGeometry(420, 32, 20));
    const material = scope.track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x050914) },
          horizon: { value: this.horizon },
          ground: { value: new THREE.Color(0x071522) },
          offset: { value: 0.02 },
          parallax: { value: new THREE.Vector2() },
        },
        vertexShader: /* glsl */ `
          varying vec3 vRay;
          void main() {
            // Dome-local direction keeps the distant sky fixed while nearer
            // layers can shift slightly as the visitor crosses the grounds.
            vRay = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top;
          uniform vec3 horizon;
          uniform vec3 ground;
          uniform float offset;
          uniform vec2 parallax;
          varying vec3 vRay;

          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          vec2 skyUv(vec3 ray) {
            return vec2(atan(ray.z, ray.x) * 0.159154943 + 0.5, asin(clamp(ray.y, -1.0, 1.0)) * 0.318309886 + 0.5);
          }
          float starLayer(vec2 sky, float density, float threshold, float depth, vec2 seed) {
            vec2 uv = fract(sky + parallax * depth);
            vec2 gridSize = vec2(density, density * 0.66);
            vec2 cell = floor(uv * gridSize);
            cell.x = mod(cell.x, gridSize.x);
            vec2 local = fract(uv * gridSize) - 0.5;
            float chance = hash(cell + seed);
            vec2 pointOffset = vec2(hash(cell + seed + 13.7), hash(cell + seed + 41.3)) - 0.5;
            float radius = mix(0.025, 0.085, hash(cell + seed + 77.1));
            float point = 1.0 - smoothstep(radius, radius * 1.7, length(local - pointOffset * 0.72));
            return point * step(threshold, chance);
          }
          void main() {
            vec3 ray = normalize(vRay);
            float h = ray.y;
            vec2 sky = skyUv(ray);
            vec3 colour = h > offset
              ? mix(horizon, top, clamp((h - offset) * 1.55, 0.0, 1.0))
              : mix(horizon, ground, clamp((offset - h) * 2.6, 0.0, 1.0));

            // Independent density, offset, scale, and parallax values make
            // distant dust, mid-field stars, and near points read as depth.
            float distant = starLayer(sky, 118.0, 0.918, 0.010, vec2(7.1, 19.4));
            float middle = starLayer(sky, 176.0, 0.962, 0.026, vec2(31.6, 4.8));
            float near = starLayer(sky, 62.0, 0.948, 0.065, vec2(53.2, 72.9));
            float visibleSky = smoothstep(-0.035, 0.16, h);
            colour += vec3(0.62, 0.68, 0.76) * distant * 0.28 * visibleSky;
            colour += vec3(0.96, 0.88, 0.72) * middle * 0.68 * visibleSky;
            colour += vec3(1.0, 0.79, 0.63) * near * 0.90 * visibleSky;

            gl_FragColor = vec4(colour, 1.0);
          }
        `,
      }),
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'night-sky-layered-stars';
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;

    // The Blood Ring is one planet-scale orbit. A low-poly cross-section and
    // flat shading expose crystal planes without breaking its silhouette into
    // separate beads.
    const ringGeometry = scope.track(new THREE.TorusGeometry(
      Sky.BLOOD_RING_ORBIT_RADIUS,
      Sky.BLOOD_RING_TUBE_RADIUS,
      8,
      144,
    ));
    // No `transmission` here. Three.js enters `renderTransmissionPass()` when
    // any visible material has transmission > 0, then submits the visible opaque
    // render list again to a multisampled target and regenerates its mipmaps.
    // A controlled, same-artifact 45-frame SwiftShader profile measured the
    // Rotunda at 520 calls / 571.9 ms p50 with transmission 0, versus 996 calls
    // / 1321.6 ms with a diagnostic 0.03 override. See
    // validation/metrics/runtime-profile.json and
    // runtime-profile-transmission-control.json. This isolates submissions in
    // this software renderer; it is not representative-device FPS and the subtle
    // visual difference remains a human-approval question. The retained red
    // emissive facet colour and clearcoat are the intentional identity anchors.
    const ringMaterial = scope.track(new THREE.MeshPhysicalMaterial({
      color: 0xc30d36,
      emissive: 0x650012,
      emissiveIntensity: 0.9,
      roughness: 0.12,
      metalness: 0.12,
      ior: 1.52,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      flatShading: true,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: true,
      // The orbit sits at the scene fog boundary. Fog was replacing the red
      // crystal with the blue horizon colour, producing the reported hoop.
      fog: false,
      toneMapped: false,
    }));
    this.bloodRing = new THREE.Mesh(ringGeometry, ringMaterial);
    this.bloodRing.name = 'blood-ring-complete-orbital-structure';
    this.bloodRing.position.y = Sky.BLOOD_RING_HEIGHT;
    this.bloodRing.rotation.set(
      // TorusGeometry starts in a vertical XY plane. A surface viewpoint
      // needs the orbit nearly horizontal so it reads as an overhead sweep,
      // not as a circular hoop facing the visitor.
      THREE.MathUtils.degToRad(78),
      THREE.MathUtils.degToRad(-8),
      THREE.MathUtils.degToRad(16),
    );
    // The arrival canopy writes depth across the apparent sky. Keep this
    // celestial landmark in the sky pass so the planetary sweep remains
    // visible from the surface viewpoint.
    this.bloodRing.renderOrder = -0.5;
    ringMaterial.depthTest = false;
    ringMaterial.depthWrite = false;
    this.bloodRing.frustumCulled = false;
  }

  /** Keep the dome centred on the visitor so it never has an edge. */
  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
    const parallax = (this.mesh.material as THREE.ShaderMaterial).uniforms.parallax.value as THREE.Vector2;
    parallax.set(camera.position.x, camera.position.z).multiplyScalar(0.00075);
  }
}
