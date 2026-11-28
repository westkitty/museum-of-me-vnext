import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import { landscapeClock } from '../render/LandscapeShading';

/** Moon direction is shared by sky, water and the real exterior key light. */
export const NIGHT_MOON_DIRECTION = new THREE.Vector3(-0.43, 0.71, -0.56).normalize();

export interface SkyTimePreview {
  readonly daylight: number;
  readonly twilight: number;
  readonly sunDirection: THREE.Vector3;
}

/** The approved visitor sky is night; a developer may preview a clock hour. */
export function skyPreviewForHour(hour: number): SkyTimePreview {
  const safeHour = Number.isFinite(hour) ? hour : 22;
  const wrapped = ((safeHour % 24) + 24) % 24;
  const phase = (wrapped - 6) * Math.PI / 12;
  const altitude = Math.sin(phase);
  const progress = THREE.MathUtils.clamp((altitude + 0.35) / 0.53, 0, 1);
  const daylight = progress * progress * (3 - 2 * progress);
  const twilight = Math.max(0, 1 - Math.abs(altitude) / 0.5);
  const horizontal = Math.cos(phase);
  const sunDirection = new THREE.Vector3(-horizontal * 0.89, altitude, -horizontal * 0.46).normalize();
  return { daylight, twilight, sunDirection };
}

/** Radius (m) of the camera-following sky dome. Exceeds distant horizon silhouettes from any island viewpoint. */
export const SKY_DOME_RADIUS = 850;

/**
 * Procedural night sky for the museum grounds. The camera-following dome keeps
 * the exterior deep and legible without adding celestial geometry or draw calls.
 */
export class Sky {
  readonly mesh: THREE.Mesh;
  readonly horizon = new THREE.Color(0x17304b);
  private readonly nightHorizon = new THREE.Color(0x17304b);
  private readonly dayHorizon = new THREE.Color(0x9dc9ed);
  private lastParallaxX = Number.NaN;
  private lastParallaxZ = Number.NaN;

  constructor(scope: ResourceScope) {
    const geometry = scope.track(new THREE.SphereGeometry(SKY_DOME_RADIUS, 32, 20));
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
          moonDirection: { value: NIGHT_MOON_DIRECTION.clone() },
          sunDirection: { value: new THREE.Vector3(0, 1, 0) },
          daylight: { value: 0 },
          twilight: { value: 0 },
          time: landscapeClock,
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
          uniform vec3 moonDirection;
          uniform vec3 sunDirection;
          uniform float daylight;
          uniform float twilight;
          uniform float time;
          varying vec3 vRay;

          float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          vec2 skyUv(vec3 ray) {
            return vec2(atan(ray.z, ray.x) * 0.159154943 + 0.5, asin(clamp(ray.y, -1.0, 1.0)) * 0.318309886 + 0.5);
          }
          float skyNoise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            vec2 s = vec2(37.0, 17.0) * i.z;
            float a = mix(mix(hash(i.xy + s), hash(i.xy + s + vec2(1.0, 0.0)), f.x),
                          mix(hash(i.xy + s + vec2(0.0, 1.0)), hash(i.xy + s + vec2(1.0, 1.0)), f.x), f.y);
            s += vec2(37.0, 17.0);
            float b = mix(mix(hash(i.xy + s), hash(i.xy + s + vec2(1.0, 0.0)), f.x),
                          mix(hash(i.xy + s + vec2(0.0, 1.0)), hash(i.xy + s + vec2(1.0, 1.0)), f.x), f.y);
            return mix(a, b, f.z);
          }
          // Round, colour-temperature stars: cells are corrected for the
          // sky's own aspect so points never smear into ellipses.
          vec3 starLayer(vec2 sky, float density, float threshold, float depth, vec2 seed, float size) {
            vec2 uv = fract(sky + parallax * depth);
            vec2 gridSize = vec2(density, floor(density * 0.5));
            vec2 cell = floor(uv * gridSize);
            vec2 local = fract(uv * gridSize) - 0.5;
            float chance = hash(cell + seed);
            if (chance < threshold) return vec3(0.0);
            vec2 pointOffset = vec2(hash(cell + seed + 13.7), hash(cell + seed + 41.3)) - 0.5;
            vec2 d = (local - pointOffset * 0.6) * vec2(max(0.08, cos((uv.y - 0.5) * 3.14159265)), 1.0);
            float magnitude = hash(cell + seed + 77.1);
            float radius = size * mix(0.5, 1.5, magnitude * magnitude);
            float r = length(d) / radius;
            float point = exp(-r * r * 1.6) + 0.16 * exp(-r * 0.9) * magnitude;
            float twinkle = 0.82 + 0.18 * sin(time * mix(1.1, 3.4, magnitude) + chance * 900.0);
            vec3 tint = mix(vec3(0.66, 0.79, 1.0), vec3(1.0, 0.83, 0.64), hash(cell + seed + 5.3));
            return tint * point * mix(0.35, 1.0, magnitude) * twinkle;
          }
          void main() {
            vec3 ray = normalize(vRay);
            float h = ray.y;
            vec2 sky = skyUv(ray);
            vec3 colour = h > offset
              ? mix(horizon, top, clamp((h - offset) * 1.55, 0.0, 1.0))
              : mix(horizon, ground, smoothstep(0.16, 0.8, offset - h) * 0.6);

            // Independent density, offset, scale, and parallax values make
            // distant dust, mid-field stars, and near points read as depth.
            vec3 distant = starLayer(sky, 230.0, 0.80, 0.010, vec2(7.1, 19.4), 0.085);
            vec3 middle = starLayer(sky, 120.0, 0.90, 0.026, vec2(31.6, 4.8), 0.06);
            vec3 near = starLayer(sky, 58.0, 0.945, 0.065, vec2(53.2, 72.9), 0.042);
            float visibleSky = smoothstep(-0.035, 0.16, h);
            float bandCenter = 0.59 + sin(sky.x * 6.283 + 0.7) * 0.055;
            float galacticBand = exp(-pow((sky.y - bandCenter) * 9.0, 2.0));
            float broadDust = skyNoise(ray * 5.0);
            float fineDust = skyNoise(ray * 13.0 + 4.0);
            float dustKnots = smoothstep(0.25, 0.8, 0.62 * broadDust + 0.38 * fineDust);
            float darkLane = 1.0 - 0.75 * smoothstep(0.45, 0.72, skyNoise(ray * 8.0 + 21.0));
            float starCloud = galacticBand * (0.45 + dustKnots * 0.55) * darkLane;

            // Drakken Blood Ring: an enormous vitrified biospheric scar,
            // not a halo, portal, energy field, or Starsilk filament.
            // Gorevault produces atrocity feedstock; Ringthroat extrudes it
            // toward orbit. The sky shader is a distant *visual proxy* for
            // hard reflective deep-crimson matter, not a second 3D renderer.
            //
            // South arrival faces north: the scar climbs from the western
            // horizon through the north sky, like the supplied reference.
            float bloodRingElevation = 0.65 + 0.22 * sin((sky.x - 0.25) * 4.2 - 0.35);
            float bloodRingDistance = sky.y - bloodRingElevation;
            float scarGrain = sin(sky.x * 103.0) * 0.0017
                            + sin(sky.x * 273.0 + 0.9) * 0.0009;
            float scarHalfWidth = 0.014 + scarGrain;
            float bloodRingBody = 1.0 - smoothstep(
              scarHalfWidth * 0.67, scarHalfWidth, abs(bloodRingDistance)
            );
            float bloodRingVisibility = smoothstep(-0.025, 0.085, h)
              * (1.0 - smoothstep(0.30, 0.48, abs(sky.x - 0.25)));

            // Piecewise reflective red glass; fine fractures catch light along
            // the band, while sparse chips float just beyond the fracture edge.
            vec2 glassCell = floor(vec2(sky.x * 410.0,
              bloodRingDistance * 370.0));
            float glassFacet = hash(glassCell + vec2(11.0, 37.0));
            float glassSeam = pow(
              abs(sin(sky.x * 570.0 + bloodRingDistance * 155.0)), 24.0
            );
            float glassVein = exp(-pow(
              (bloodRingDistance - 0.004 * sin(sky.x * 160.0)) * 330.0, 2.0
            ));
            float floatingGlass = step(0.982, hash(glassCell + vec2(83.0, 5.0)))
              * (1.0 - smoothstep(scarHalfWidth * 1.2, scarHalfWidth * 3.3,
                abs(bloodRingDistance)));


            // One shader-space moon now anchors the same direction as the
            // exterior key light. It replaces the removed orbital geometry
            // without spending another draw call or creating a second sky pass.
            float moonDot = max(dot(ray, normalize(moonDirection)), 0.0);
            float moonDisk = smoothstep(0.99925, 0.99935, moonDot);
            float moonHalo = pow(moonDot, 96.0) * visibleSky;
            float horizonHaze = exp(-abs(h - offset) * 8.0);

            // A soft luminous Milky Way and its dark dust lanes remain behind
            // the orbital structure; this is still one GPU sky draw call.
            colour += vec3(0.10, 0.20, 0.41) * starCloud * 0.45 * visibleSky;
            colour += vec3(0.13, 0.11, 0.22) * galacticBand * (0.055 + dustKnots * 0.035) * visibleSky;
            colour += (distant * (0.34 + 0.5 * galacticBand) + middle * 0.8 + near * 1.15) * visibleSky;
            colour += vec3(0.035, 0.085, 0.13) * horizonHaze * 0.42;
            colour += vec3(0.30, 0.48, 0.72) * (moonHalo * 0.3 + pow(moonDot, 14.0) * 0.07 * visibleSky);
            // Blend only sky light; the vitrified Blood Ring stays present.
            vec3 dayColour = h > offset
              ? mix(vec3(0.62, 0.80, 0.96), vec3(0.13, 0.42, 0.80),
                  clamp((h - offset) * 1.45, 0.0, 1.0))
              : mix(vec3(0.62, 0.80, 0.96), vec3(0.34, 0.50, 0.64),
                  clamp((offset - h) * 2.0, 0.0, 1.0));
            float sunDot = max(dot(ray, normalize(sunDirection)), 0.0);
            float sunGlow = pow(sunDot, 42.0) * visibleSky;
            float sunDisk = smoothstep(0.9994, 0.99988, sunDot)
              * step(0.0, sunDirection.y);
            dayColour += vec3(1.0, 0.62, 0.28) * sunGlow * (0.18 + 0.26 * twilight);
            dayColour += vec3(0.75, 0.25, 0.08) * twilight * horizonHaze * 0.27;
            colour = mix(colour, dayColour, daylight);
            // Dark glass occludes the stars; seams and shard edges reflect
            // narrow red highlights. This is material, never a glowing halo.
            vec3 scarGlass = mix(
              vec3(0.075, 0.006, 0.012),
              vec3(0.22, 0.016, 0.025),
              glassFacet
            );
            colour = mix(colour, scarGlass,
              bloodRingBody * bloodRingVisibility * 0.88);
            colour += vec3(0.62, 0.055, 0.046) * bloodRingBody
              * bloodRingVisibility * (glassSeam * 0.3 + glassVein * 0.6);
            colour += vec3(0.46, 0.042, 0.035) * floatingGlass
              * bloodRingVisibility * 0.72;
            float maria = moonDisk > 0.0 ? skyNoise(ray * 95.0) * 0.6 + skyNoise(ray * 210.0) * 0.4 : 0.5;
            colour = mix(colour, vec3(0.86, 0.92, 1.0) * (0.72 + 0.34 * maria), moonDisk * 0.96 * (1.0 - daylight));
            colour = mix(colour, vec3(1.0, 0.95, 0.84), sunDisk * daylight);

            // Sea haze in display values: hides the edge of the fogged ocean
            // from the roofs and pads, and lifts a soft band at the shore.
            float seaHaze = 1.0 - smoothstep(-0.015, 0.085, h - offset);
            colour = mix(colour, vec3(0.072, 0.135, 0.208), seaHaze * 0.9 * (1.0 - daylight));
            // Ordered dither: the night gradient is too dark for eight bits alone.
            colour += (hash(gl_FragCoord.xy * 0.713) - 0.5) / 255.0;
            gl_FragColor = vec4(colour, 1.0);
          }
        `,
      }),
    );

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'night-sky-layered-stars';
    this.mesh.userData.canonicalFeature = 'starsilk-drakken-blood-ring';
    this.mesh.userData.bloodRingConstruction = 'vitrified-biospheric-scar';
    this.mesh.renderOrder = -1;
    this.mesh.frustumCulled = false;

  }

  /** Session preview; null restores the exact canonical night. */
  setTimeOfDay(hour: number | null): SkyTimePreview | null {
    const uniforms = (this.mesh.material as THREE.ShaderMaterial).uniforms;
    if (hour === null) {
      uniforms.daylight.value = 0;
      uniforms.twilight.value = 0;
      this.horizon.copy(this.nightHorizon);
      return null;
    }
    const profile = skyPreviewForHour(hour);
    uniforms.daylight.value = profile.daylight;
    uniforms.twilight.value = profile.twilight;
    (uniforms.sunDirection.value as THREE.Vector3).copy(profile.sunDirection);
    this.horizon.copy(this.nightHorizon).lerp(this.dayHorizon, profile.daylight);
    return profile;
  }

  /** Keep the dome centred on the visitor so it never has an edge. */
  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
    const dx = camera.position.x - this.lastParallaxX;
    const dz = camera.position.z - this.lastParallaxZ;
    if (dx * dx + dz * dz < 0.0625) return;
    this.lastParallaxX = camera.position.x;
    this.lastParallaxZ = camera.position.z;
    const parallax = (this.mesh.material as THREE.ShaderMaterial).uniforms.parallax.value as THREE.Vector2;
    parallax.set(camera.position.x, camera.position.z).multiplyScalar(0.00075);
  }
}
