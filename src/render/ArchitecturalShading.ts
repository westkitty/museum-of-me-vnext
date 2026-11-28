import * as THREE from 'three';
import { WING_BY_ID, faceDirection, ATRIUM_HEIGHT, LEVEL_1_Y, SANCTUARY_FLOOR_Y, type ZoneId } from '../world/layout';
import type { WingId } from '../content/types';

/**
 * Museum-wide architectural shading, written into the existing PBR materials.
 *
 * Every mineral wall, floor and ceiling shares this one shader patch. It reads
 * world position, so the stone never stretches across a large plane, and it
 * derives panel joints, slab variation, contact shading and cove light from
 * the same layout numbers that built the room. Nothing is baked or loaded:
 * no extra draw call, texture, light or render pass, and every material that
 * uses it resolves to the same program.
 */

/** How a zone's walls are built. Panel sizes are metres. */
interface FinishStyle {
  readonly panel: readonly [number, number];
  /** Alternate courses shift by half a panel (ashlar) when 1. */
  readonly stagger: number;
  readonly joint: number;
  /** Strength of vertical fluting (acoustic ribs), 0 for plain panels. */
  readonly flute: number;
  readonly slab: number;
  /** Multiplies floor roughness; lower reads as a polished floor. */
  readonly polish: number;
  readonly cove: number;
  readonly radial?: boolean;
}

const PLAIN: FinishStyle = { panel: [2.4, 1.2], stagger: 1, joint: 0.008, flute: 0, slab: 2, polish: 0.62, cove: 0.1 };

const STYLES: Partial<Record<FinishZone, FinishStyle>> = {
  rotunda: { panel: [2.6, 1.3], stagger: 1, joint: 0.007, flute: 0, slab: 2, polish: 0.5, cove: 0.05, radial: true },
  balcony: { panel: [2.6, 1.3], stagger: 1, joint: 0.007, flute: 0, slab: 1.6, polish: 0.55, cove: 0.06 },
  north: { panel: [1.5, 4.6], stagger: 0, joint: 0.012, flute: 0, slab: 3, polish: 0.4, cove: 0.34 },
  east: { panel: [2.25, 2.25], stagger: 0, joint: 0.012, flute: 0, slab: 2.25, polish: 0.46, cove: 0.2 },
  south: { panel: [3.6, 1.5], stagger: 1, joint: 0.01, flute: 0, slab: 2.4, polish: 0.58, cove: 0.15 },
  west: { panel: [1.8, 3.1], stagger: 0, joint: 0.014, flute: 0, slab: 1.8, polish: 0.54, cove: 0.17 },
  media: { panel: [2.4, 2.7], stagger: 0, joint: 0.01, flute: 1, slab: 1.8, polish: 0.56, cove: 0.17 },
  infra: { panel: [1.2, 2.4], stagger: 0, joint: 0.012, flute: 0, slab: 1.2, polish: 0.56, cove: 0.16 },
  sanctuary: { panel: [2.2, 1.1], stagger: 1, joint: 0.008, flute: 0, slab: 1.6, polish: 0.7, cove: 0.16 },
  // The atrium waits in the dark: no cove light of its own before it is lit.
  atrium: { panel: [3.4, 1.7], stagger: 1, joint: 0.012, flute: 0, slab: 3.4, polish: 0.55, cove: 0 },
};

export type FinishZone = ZoneId | 'shell' | 'atrium';
/** `surface` is a wall/floor/ceiling; `runner` is the woven hall runner; `inlay` a ribbed wall panel. */
export type FinishKind = 'surface' | 'runner' | 'inlay';

interface FinishUniforms { [name: string]: THREE.IUniform }

function floorOf(zone: FinishZone): number {
  if (zone === 'balcony') return LEVEL_1_Y;
  if (zone === 'sanctuary') return SANCTUARY_FLOOR_Y;
  return WING_BY_ID.get(zone as WingId)?.floorY ?? 0;
}

/** Zone numbers for the shader, from the layout that built the zone. */
export function finishUniforms(zone: FinishZone, accent: THREE.Color, kind: FinishKind = 'surface'): FinishUniforms {
  const style = STYLES[zone] ?? PLAIN;
  const wing = WING_BY_ID.get(zone as WingId);
  const dir = wing ? faceDirection(wing.face) : ([0, 0, -1] as const);
  return {
    finAxis: { value: new THREE.Vector2(dir[0], dir[2]) },
    finFloorY: { value: floorOf(zone) },
    // x: along of the hall start, y: along of its end, z: half width, w: height (0 disables hall terms).
    finHall: { value: wing
      ? new THREE.Vector4(wing.hallFrom, wing.hallTo, wing.hallHalfWidth, wing.hallHeight)
      : new THREE.Vector4(0, 0, 0, zone === 'rotunda' ? LEVEL_1_Y : zone === 'atrium' ? ATRIUM_HEIGHT : 9) },
    // x: along of the first bay, y: bay pitch, z: half opening, w: bay depth.
    finBay: { value: wing
      ? new THREE.Vector4(wing.hallFrom + wing.bayLead, wing.bayPitch, wing.bayOpening / 2, wing.bayDepth)
      : new THREE.Vector4(0, 1, 0, 0) },
    finBayRoom: { value: wing ? new THREE.Vector2(wing.bayHalfAlong, wing.bayHeight) : new THREE.Vector2(1, 9) },
    finPanel: { value: new THREE.Vector4(style.panel[0], style.panel[1], style.stagger, kind === 'inlay' ? 0.0001 : style.joint) },
    finLook: { value: new THREE.Vector4(kind === 'inlay' ? 1 : style.flute, style.slab, style.polish, style.cove) },
    finAccent: { value: accent.clone() },
    finMode: { value: new THREE.Vector2(kind === 'runner' ? 1 : kind === 'inlay' ? 2 : 0, style.radial ? 1 : 0) },
  };
}

const VERTEX_PARS = /* glsl */ `
varying vec3 vFinPos;
varying vec3 vFinNormal;
`;

const VERTEX_MAIN = /* glsl */ `
{
  vec4 finLocal = vec4(transformed, 1.0);
  vec3 finObjectNormal = objectNormal;
  #ifdef USE_INSTANCING
    finLocal = instanceMatrix * finLocal;
    finObjectNormal = mat3(instanceMatrix) * finObjectNormal;
  #endif
  vFinPos = (modelMatrix * finLocal).xyz;
  vFinNormal = mat3(modelMatrix) * finObjectNormal;
}
`;

const FRAGMENT_PARS = /* glsl */ `
varying vec3 vFinPos;
varying vec3 vFinNormal;
uniform vec2 finAxis;
uniform float finFloorY;
uniform vec4 finHall;
uniform vec4 finBay;
uniform vec2 finBayRoom;
uniform vec4 finPanel;
uniform vec4 finLook;
uniform vec3 finAccent;
uniform vec2 finMode;

float finHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
/** Signed distance (m) to the nearest joint of a repeating panel edge. */
float finEdge(float x, float period) {
  return (fract(x / period + 0.5) - 0.5) * period;
}
/** Anti-aliased joint coverage that fades out once it is thinner than a pixel. */
float finLine(float d, float halfWidth, float px) {
  float cover = 1.0 - smoothstep(max(0.0, halfWidth - px), halfWidth + px, abs(d));
  return cover * min(1.0, halfWidth * 2.0 / max(px, 1e-4));
}
/** Slope across a bevel either side of a joint. */
float finBevel(float d, float width, float px) {
  float t = clamp(abs(d) / width, 0.0, 1.0);
  return sign(d) * (1.0 - t) * smoothstep(width * 0.9, width * 0.15, px);
}
float finOccluded(float d, float reach) { return exp(-max(d, 0.0) / reach); }

struct Finish { vec3 tint; float occlusion; float rough; vec3 bump; vec3 glow; };

Finish finishSurface() {
  Finish f;
  f.tint = vec3(1.0);
  f.occlusion = 1.0;
  f.rough = 1.0;
  f.bump = vec3(0.0);
  f.glow = vec3(0.0);
  vec3 n = normalize(vFinNormal);
  float along = dot(vFinPos.xz, finAxis);
  float across = dot(vFinPos.xz, vec2(-finAxis.y, finAxis.x));
  float lateral = abs(across);
  float height = vFinPos.y - finFloorY;
  bool inWing = finHall.z > 0.0;
  bool inBay = inWing && lateral > finHall.z + 0.02;
  float bayAlong = finEdge(along - finBay.x, finBay.y);
  float doorway = 1.0 - smoothstep(finBay.z - 0.15, finBay.z + 0.15, abs(bayAlong));
  float roomHeight = inBay ? finBayRoom.y : finHall.w;

  if (abs(n.y) < 0.6) {
    // ── Walls ──────────────────────────────────────────────────────────
    vec3 t = normalize(vec3(n.z, 0.0, -n.x));
    float u = dot(vFinPos, t);
    vec2 uv = vec2(u, height);
    f.tint *= texture2D(map, uv * 0.19).g;
    float grain = texture2D(map, uv * 0.061 + 0.37).g;
    f.tint *= mix(0.94, 1.05, smoothstep(0.86, 1.0, grain));
    vec2 px = fwidth(uv);
    float course = floor(height / finPanel.y);
    float du = finEdge(u + finPanel.z * 0.5 * finPanel.x * mod(course, 2.0), finPanel.x);
    float dv = finEdge(height, finPanel.y);
    vec2 cell = vec2(floor((u + finPanel.z * 0.5 * finPanel.x * mod(course, 2.0)) / finPanel.x + 0.5), course);
    float tone = finHash(cell + floor(n.xz * 7.0));
    float joint = max(finLine(du, finPanel.w, px.x), finLine(dv, finPanel.w, px.y));
    f.tint *= (0.965 + 0.07 * tone) * (1.0 - 0.42 * joint);
    f.rough = mix(0.82, 1.06, tone);
    float bu = finBevel(du, 0.045, px.x);
    float bv = finBevel(dv, 0.045, px.y);
    f.bump += t * bu * 0.34 + vec3(0.0, 1.0, 0.0) * bv * 0.34;
    if (finLook.x > 0.0 && (height > 1.15 || finMode.x > 1.5)) {
      float ribPhase = u * 17.95;
      float ribFade = smoothstep(0.14, 0.03, px.x);
      f.bump += t * cos(ribPhase) * 0.42 * ribFade * finLook.x;
      f.tint *= 1.0 - 0.22 * ribFade * (0.5 - 0.5 * sin(ribPhase)) * finLook.x;
    }
    // Dado: a shade deeper below hand height, closed by one fine reveal.
    float dado = 1.0 - smoothstep(1.06, 1.1, height);
    f.tint *= 1.0 - 0.1 * dado;
    float reveal = finLine(height - 1.12, 0.014, px.y);
    f.tint *= 1.0 - 0.5 * reveal;
    f.bump.y += finBevel(height - 1.12, 0.05, px.y) * 0.5;

    f.occlusion *= 1.0 - 0.42 * finOccluded(height, 0.42) - 0.16 * finOccluded(height, 1.9);
    f.occlusion *= 1.0 - 0.34 * finOccluded(roomHeight - height, 0.55);
    if (inBay) {
      bool facesAlong = abs(dot(n.xz, finAxis)) > 0.7;
      float corner = facesAlong
        ? min(finHall.z + finBay.w - lateral, 4.0)
        : finBayRoom.x - abs(bayAlong);
      f.occlusion *= 1.0 - 0.36 * finOccluded(corner, 0.5) - 0.14 * finOccluded(corner, 2.0);
    }
    // Concealed cove light washing down from the cornice.
    float wash = finOccluded(roomHeight - 0.5 - height, 1.7) * smoothstep(-0.2, 0.5, roomHeight - height);
    f.glow += finAccent * wash * finLook.w;
  } else if (n.y > 0.0) {
    // ── Floors ─────────────────────────────────────────────────────────
    vec2 uv = vec2(across, along);
    vec2 px = fwidth(uv);
    if (finMode.x > 0.5 && finMode.x < 1.5) {
      // Woven runner: deep field, two-line border and a quiet centre motif.
      float edge = finHall.z * 0.45 - lateral;
      float fibre = texture2D(map, vec2(uv.x * 1.9, uv.y * 0.45)).g;
      float cross_ = texture2D(map, vec2(uv.x * 0.33, uv.y * 1.4) + 0.5).g;
      f.tint *= 0.44 * (0.55 + 0.5 * fibre) * (0.7 + 0.34 * cross_);
      float pw = max(px.x, px.y);
      float border = finLine(edge - 0.42, 0.05, pw) + 0.7 * finLine(edge - 0.58, 0.014, pw);
      float diamond = abs(finEdge(uv.y, 4.0)) * 0.62 + lateral;
      float motif = 0.8 * finLine(diamond - 0.92, 0.022, pw) + 0.6 * finLine(diamond - 0.5, 0.016, pw)
        + 0.5 * (1.0 - smoothstep(0.1, 0.13 + pw, diamond));
      f.tint = mix(f.tint, finAccent * 0.62, clamp(border * 0.6 + motif * 0.5, 0.0, 0.7));
      f.tint *= mix(0.62, 1.0, smoothstep(0.0, 0.42, edge));
      f.rough = 1.5;
      return f;
    }
    f.tint *= texture2D(map, uv * 0.21).g;
    float grain = texture2D(map, uv * 0.047 + 0.19).g;
    f.tint *= mix(0.93, 1.05, smoothstep(0.86, 1.0, grain));
    if (finMode.y > 0.5 && dot(vFinPos.xz, vFinPos.xz) < 250.0) {
      // Rotunda: radial slabs in three courses around the oculus.
      float r = length(vFinPos.xz);
      float ringIndex = floor(r / 2.12);
      float sectors = r < 6.4 ? 16.0 : 32.0;
      float a = atan(vFinPos.z, vFinPos.x) / 6.2831853 * sectors + 0.5 * mod(ringIndex, 2.0);
      float arc = finEdge(a, 1.0) * 6.2831853 * r / sectors;
      float ringD = finEdge(r, 2.12);
      float pr = max(px.x, px.y);
      float tone = finHash(vec2(floor(a + 0.5), ringIndex));
      float joint = max(finLine(arc, 0.008, pr), finLine(ringD, 0.008, pr)) * step(1.0, r);
      f.tint *= (0.93 + 0.085 * tone) * (1.0 - 0.4 * joint);
      float inlay = mod(ringIndex, 2.0) * step(0.5, fract(a * 0.5));
      f.tint *= 1.0 - 0.07 * inlay;
      f.rough = finLook.z * mix(0.75, 1.15, tone);
      f.occlusion *= 1.0 - 0.3 * finOccluded(15.4 - max(max(abs(vFinPos.x), abs(vFinPos.z)), (abs(vFinPos.x) + abs(vFinPos.z)) * 0.70710678), 0.9);
      f.occlusion *= 1.0 - 0.36 * finOccluded(r - 4.1, 0.35) * step(4.0, r);
      return f;
    }
    float du = finEdge(uv.x, finLook.y);
    float dv = finEdge(uv.y, finLook.y);
    vec2 cell = floor(uv / finLook.y + 0.5);
    float tone = finHash(cell);
    float joint = max(finLine(du, 0.007, px.x), finLine(dv, 0.007, px.y));
    f.tint *= (0.93 + 0.12 * tone) * (1.0 - 0.45 * joint);
    f.rough = finLook.z * mix(0.72, 1.2, tone) + 0.25 * joint;
    if (inWing) {
      float wall = finHall.z - lateral;
      if (inBay) {
        float back = finHall.z + finBay.w - lateral;
        float side = finBayRoom.x - abs(bayAlong);
        f.occlusion *= 1.0 - 0.4 * finOccluded(back, 0.6) - 0.1 * finOccluded(back, 2.4);
        f.occlusion *= 1.0 - 0.4 * finOccluded(side, 0.6) - 0.1 * finOccluded(side, 2.4);
        f.occlusion *= 1.0 - 0.4 * finOccluded(-wall, 0.6) * (1.0 - doorway);
      } else if (along > finHall.x) {
        f.occlusion *= 1.0 - (0.44 * finOccluded(wall, 0.55) + 0.14 * finOccluded(wall, 2.2)) * (1.0 - doorway);
        f.glow += finAccent * finLook.w * 0.16 * finOccluded(wall, 1.3) * (1.0 - doorway);
      }
    }
  } else {
    // ── Ceilings ───────────────────────────────────────────────────────
    vec2 uv = vec2(across, along);
    vec2 px = fwidth(uv);
    f.tint *= texture2D(map, uv * 0.12).g;
    vec2 d = vec2(finEdge(uv.x, 3.0), finEdge(uv.y, 3.0));
    float beam = 0.3;
    vec2 inner = abs(d) - beam;
    float rib = 1.0 - smoothstep(-0.02 - px.x, 0.02 + px.x, min(inner.x, inner.y));
    f.tint *= mix(0.72, 1.3, rib);
    float recess = min(inner.x, inner.y);
    f.occlusion *= mix(1.0 - 0.5 * finOccluded(recess, 0.28), 1.0, rib);
    float nearRib = smoothstep(0.14, 0.0, abs(recess)) * smoothstep(0.2, 0.03, px.x + px.y);
    vec2 side = inner.x < inner.y ? vec2(sign(d.x), 0.0) : vec2(0.0, sign(d.y));
    vec3 right = vec3(-finAxis.y, 0.0, finAxis.x);
    vec3 fwd = vec3(finAxis.x, 0.0, finAxis.y);
    f.bump += (right * side.x + fwd * side.y) * nearRib * 0.5;
    f.rough = 1.0;
    if (inWing) {
      float wall = inBay ? min(finHall.z + finBay.w - lateral, finBayRoom.x - abs(bayAlong)) : finHall.z - lateral;
      f.glow += finAccent * finLook.w * (0.75 * finOccluded(wall, 1.4) + 0.1);
      f.occlusion *= 1.0 - 0.25 * finOccluded(wall, 0.35);
    }
  }
  return f;
}
`;

const FINISH_KEY = 'museum-architectural-finish-1';

/** Adds the architectural finish to a standard material that carries the shared stone `map`. */
export function applyArchitecturalFinish(
  material: THREE.MeshStandardMaterial, zone: FinishZone, accent: THREE.Color, kind: FinishKind = 'surface',
): THREE.MeshStandardMaterial {
  if (!material.map) return material;
  const uniforms = finishUniforms(zone, accent, kind);
  material.userData.architecturalFinish = zone;
  material.customProgramCacheKey = () => FINISH_KEY;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', 'Finish fin = finishSurface();\ndiffuseColor.rgb *= fin.tint;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(roughness * fin.rough, 0.08, 1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(normal + (viewMatrix * vec4(fin.bump, 0.0)).xyz);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += fin.glow * (0.25 + diffuseColor.rgb);`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
reflectedLight.indirectDiffuse *= fin.occlusion;
reflectedLight.indirectSpecular *= fin.occlusion * fin.occlusion;
reflectedLight.directDiffuse *= mix(1.0, fin.occlusion, 0.6);
reflectedLight.directSpecular *= fin.occlusion;`);
  };
  return material;
}
