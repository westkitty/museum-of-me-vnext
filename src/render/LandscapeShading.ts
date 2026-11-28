import * as THREE from 'three';

/**
 * Island surfaces, written into the existing standard materials.
 *
 * Leaf clumps, grass, gravel, bark, rock, paving and obsidian are all one
 * world-space value-noise patch: no textures, no extra draws. Foliage has its
 * own program (wind sway and a ragged-edge discard); every ground kind shares
 * one program and picks its branch from a per-material uniform, because on
 * software WebGL each extra program costs a fraction of a second to compile.
 * Wind is a vertex offset driven by a single shared clock that the exterior
 * world advances; it holds still under reduced motion.
 */
export type LandscapeKind = 'foliage' | 'grass' | 'gravel' | 'bark' | 'rock' | 'paving' | 'obsidian';

/** Advanced by ExteriorWorld once per frame; every foliage material reads it. */
export const landscapeClock = { value: 0 };

/** 1 on medium and high, 0 on low: close-range octaves are skipped, not faded. */
export const landscapeDetail = { value: 1 };

const KIND_INDEX: Record<LandscapeKind, number> = {
  foliage: 0, grass: 1, gravel: 2, bark: 3, rock: 4, paving: 5, obsidian: 6,
};

const VERTEX_PARS = /* glsl */ `
varying vec3 vLandPos;
varying vec3 vLandNormal;
#if LAND_KIND == 0
uniform float landTime;
#endif
`;

const VERTEX_MAIN = /* glsl */ `
{
  vec4 landLocal = vec4(transformed, 1.0);
  vec3 landN = objectNormal;
  #ifdef USE_INSTANCING
    landLocal = instanceMatrix * landLocal;
    landN = mat3(instanceMatrix) * landN;
  #endif
  vLandPos = (modelMatrix * landLocal).xyz;
  vLandNormal = mat3(modelMatrix) * landN;
  #if LAND_KIND == 0
    float landLift = clamp((vLandPos.y + 0.4) * 0.16, 0.0, 1.0);
    float gust = 0.6 + 0.4 * sin(landTime * 0.31 + vLandPos.x * 0.021 + vLandPos.z * 0.017);
    vec3 sway = vec3(
      sin(landTime * 0.92 + vLandPos.x * 0.13 + vLandPos.z * 0.07),
      0.35 * sin(landTime * 1.7 + vLandPos.x * 0.41),
      cos(landTime * 0.77 + vLandPos.z * 0.12)
    ) * 0.13 * landLift * gust;
    sway += normalize(landN) * 0.035 * sin(landTime * 2.6 + dot(vLandPos, vec3(1.9, 1.3, 2.3))) * gust;
    mvPosition.xyz += (viewMatrix * vec4(sway, 0.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
  #endif
}
`;

const FRAGMENT_PARS = /* glsl */ `
varying vec3 vLandPos;
varying vec3 vLandNormal;
uniform vec3 landMoon;
#if LAND_KIND != 0
uniform float landKind;
#endif
uniform float landDetail;
float landHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
/** Value noise with analytic gradient: x is the value, yzw the slope. */
vec4 landNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  vec3 du = 6.0 * f * (1.0 - f);
  float a = landHash(i);
  float b = landHash(i + vec3(1.0, 0.0, 0.0));
  float c = landHash(i + vec3(0.0, 1.0, 0.0));
  float d = landHash(i + vec3(1.0, 1.0, 0.0));
  float e = landHash(i + vec3(0.0, 0.0, 1.0));
  float g = landHash(i + vec3(1.0, 0.0, 1.0));
  float h = landHash(i + vec3(0.0, 1.0, 1.0));
  float j = landHash(i + vec3(1.0, 1.0, 1.0));
  float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a;
  float k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g;
  float k7 = -a + b + c - d + e - g - h + j;
  return vec4(
    k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
    du * vec3(
      k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z,
      k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x,
      k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
}
/** A close-range octave. Far pixels and the low tier never evaluate it. */
vec4 landFine(vec3 x, float fade) {
  return fade * landDetail > 0.004 ? landNoise(x) : vec4(0.5, 0.0, 0.0, 0.0);
}
struct Land { vec3 tint; float rough; vec3 bump; float occlusion; vec3 glow; };
Land landSurface(vec3 base) {
  Land s;
  s.tint = vec3(1.0);
  s.rough = 1.0;
  s.bump = vec3(0.0);
  s.occlusion = 1.0;
  s.glow = vec3(0.0);
  vec3 n = normalize(vLandNormal);
  vec3 toEye = cameraPosition - vLandPos;
  float dist = length(toEye);
  toEye /= max(dist, 1e-3);
#if LAND_KIND == 0
  vec4 clump = landNoise(vLandPos * 1.15);
  float nearFade = 1.0 - smoothstep(22.0, 70.0, dist);
  vec4 leaf = landFine(vLandPos * 5.3, nearFade);
  float facing = abs(dot(n, toEye));
  // Ragged leaf edge: only the thin rim of each crown is ever cut away.
  float rim = 1.0 - smoothstep(0.0, 0.36, facing);
  if (rim * (0.55 * leaf.x + 0.45 * clump.x) > 0.4) discard;
  float lum = mix(clump.x, 0.6 * clump.x + 0.4 * leaf.x, nearFade);
  s.tint = mix(vec3(0.42, 0.5, 0.55), vec3(1.9, 1.75, 1.42), smoothstep(0.15, 0.92, lum));
  s.bump = -clump.yzw * 0.5 - leaf.yzw * 0.3 * nearFade;
  s.occlusion = mix(0.34, 1.0, smoothstep(-0.85, 0.5, n.y + (clump.x - 0.5) * 0.8));
  // Moonlight through the leaf edge.
  float back = pow(max(0.0, dot(-toEye, landMoon)), 2.0);
  s.glow = base * vec3(0.55, 0.78, 0.8) * (rim * 0.24 + back * 0.3) * smoothstep(0.2, 0.9, lum);
#else
  if (landKind < 1.5) {
    float nearFade = 1.0 - smoothstep(10.0, 46.0, dist);
    float broad = landNoise(vec3(vLandPos.xz * 0.045, 1.7).xzy).x;
    float patch_ = landNoise(vec3(vLandPos.xz * 0.31, 4.1).xzy).x;
    // Rotated and warped lattices: axis-aligned value noise bands at grazing angles.
    vec2 lawn = mat2(0.8, 0.6, -0.6, 0.8) * vLandPos.xz;
    vec4 tuft = landFine(vec3(lawn.x * 2.4, 0.0, lawn.y * 2.4), nearFade);
    vec2 bladeUv = mat2(0.36, 0.93, -0.93, 0.36) * vLandPos.xz + 0.05 * tuft.yw;
    vec4 blade = landFine(vec3(bladeUv.x * 13.0, 3.0, bladeUv.y * 13.0), nearFade);
    blade.x = mix(0.5, blade.x, 1.0 - smoothstep(0.02, 0.09, length(fwidth(vLandPos.xz)) * 0.5));
    float lum = 0.34 * broad + 0.36 * patch_ + 0.3 * mix(0.5, 0.55 * tuft.x + 0.45 * blade.x, nearFade);
    s.tint = mix(vec3(0.55, 0.66, 0.7), vec3(1.75, 1.66, 1.2), smoothstep(0.22, 0.78, lum));
    s.bump = vec3(-tuft.y, 0.0, -tuft.w) * 0.34 * nearFade + vec3(-blade.y, 0.0, -blade.w) * 0.3 * nearFade;
    s.occlusion = mix(1.0, 0.62 + 0.38 * blade.x, nearFade);
  } else if (landKind < 2.5) {
    float nearFade = 1.0 - smoothstep(8.0, 34.0, dist);
    float worn = landNoise(vec3(vLandPos.x * 0.22, 2.0, vLandPos.z * 0.22)).x;
    vec4 stone = landFine(vec3(vLandPos.x * 9.0, 0.0, vLandPos.z * 9.0), nearFade);
    vec4 grit = landFine(vec3(vLandPos.x * 23.0, 5.0, vLandPos.z * 23.0), nearFade);
    s.tint = vec3(0.66) * (0.8 + 0.34 * worn) * mix(1.0, 0.62 + 0.52 * stone.x + 0.28 * grit.x, nearFade);
    s.bump = (vec3(-stone.y, 0.0, -stone.w) * 0.55 + vec3(-grit.y, 0.0, -grit.w) * 0.25) * nearFade;
    s.rough = 1.0;
  } else if (landKind < 3.5) {
    vec4 plate = landNoise(vLandPos * vec3(5.2, 1.0, 5.2));
    float nearFade = 1.0 - smoothstep(14.0, 50.0, dist);
    vec4 fissure = landFine(vLandPos * vec3(13.0, 2.2, 13.0) + 7.0, nearFade);
    float lum = 0.6 * plate.x + 0.4 * fissure.x;
    s.tint = mix(vec3(0.55), vec3(1.75, 1.62, 1.45), smoothstep(0.2, 0.85, lum));
    s.bump = (-plate.yzw * vec3(1.0, 0.2, 1.0) * 0.6 - fissure.yzw * vec3(1.0, 0.2, 1.0) * 0.4) * nearFade;
    s.occlusion = mix(0.55, 1.0, smoothstep(-0.5, 1.6, vLandPos.y));
  } else if (landKind < 4.5) {
    float nearFade = 1.0 - smoothstep(16.0, 60.0, dist);
    vec4 mass = landNoise(vLandPos * 0.8);
    vec4 grain = landFine(vLandPos * vec3(3.4, 6.5, 3.4), nearFade);
    s.tint = mix(vec3(0.62, 0.66, 0.7), vec3(1.5, 1.46, 1.4), 0.55 * mass.x + 0.45 * grain.x);
    s.tint = mix(s.tint, s.tint * vec3(0.72, 1.05, 0.72), smoothstep(0.55, 0.95, n.y) * smoothstep(0.4, 0.7, mass.x));
    s.bump = -mass.yzw * 0.25 - grain.yzw * 0.34 * nearFade;
    s.occlusion = mix(0.6, 1.0, smoothstep(-0.8, 0.5, n.y));
  } else if (landKind < 5.5) {
    float nearFade = 1.0 - smoothstep(14.0, 70.0, dist);
    if (n.y > 0.6) {
      vec2 cell = vLandPos.xz / vec2(1.5, 1.0);
      cell.x += 0.5 * mod(floor(cell.y), 2.0);
      vec2 px = fwidth(cell);
      vec2 edge = (0.5 - abs(fract(cell) - 0.5)) * vec2(1.5, 1.0);
      float joint = (1.0 - smoothstep(0.006, 0.02 + px.y, min(edge.x, edge.y))) * (1.0 - smoothstep(0.1, 0.5, px.y));
      float tone = landHash(vec3(floor(cell), 3.0));
      float wear = landFine(vec3(vLandPos.x * 2.1, 0.0, vLandPos.z * 2.1), nearFade).x;
      s.tint = vec3(0.8 + 0.28 * tone + 0.16 * (wear - 0.5)) * (1.0 - 0.5 * joint);
      s.rough = mix(0.5, 0.95, wear) + 0.2 * joint;
  } else {
      vec4 grain = landFine(vLandPos * 3.0, nearFade);
      s.tint = vec3(0.82 + 0.3 * grain.x);
      s.bump = -grain.yzw * 0.12 * nearFade;
      float course = fract(vLandPos.y / 0.6);
      s.tint *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.03, min(course, 1.0 - course))) * nearFade;
    }
  } else {
    // Conchoidal volcanic glass: broad shallow scallops under a sharp polish.
    vec4 scallop = landNoise(vLandPos * 0.42);
    vec4 ripple = landNoise(vLandPos * 1.35 + 11.0);
    s.bump = -scallop.yzw * 0.32 - ripple.yzw * 0.13;
    s.rough = mix(0.42, 1.0, smoothstep(0.35, 0.75, ripple.x));
    float edge = pow(1.0 - abs(dot(n, toEye)), 3.0);
    s.glow = vec3(0.035, 0.085, 0.15) * edge;
  }
#endif
  return s;
}
`;

/** Gives an existing standard material the shared island surface finish. */
export function applyLandscape<T extends THREE.MeshStandardMaterial>(material: T, kind: LandscapeKind): T {
  const uniforms = {
    landTime: landscapeClock,
    landDetail: landscapeDetail,
    landMoon: { value: new THREE.Vector3(-0.43, 0.71, -0.56).normalize() },
    landKind: { value: KIND_INDEX[kind] },
  };
  const program = kind === 'foliage' ? 'foliage' : 'ground';
  material.userData.landscapeKind = kind;
  material.defines = { ...material.defines, LAND_KIND: kind === 'foliage' ? 0 : 1 };
  material.customProgramCacheKey = () => `museum-landscape-3:${program}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${FRAGMENT_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
Land land = landSurface(diffuseColor.rgb);
diffuseColor.rgb *= land.tint;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * land.rough, 0.06, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(normal + (viewMatrix * vec4(land.bump, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += land.glow;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= land.occlusion;
reflectedLight.indirectSpecular *= land.occlusion;
reflectedLight.directDiffuse *= mix(1.0, land.occlusion, 0.5);`);
  };
  return material;
}
