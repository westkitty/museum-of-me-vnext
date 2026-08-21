import * as THREE from 'three';
import type { ResourceScope } from '../assets/ResourceScope';
import type { InstallationState } from '../content/installationState';
import { INSTALLATION_CONSTANTS } from '../content/installationState';

/**
 * THE FOURTEEN SOURCE INSTALLATION FORMS.
 *
 * Ported from Version B `src/exhibits/builders.ts`, corrected against the
 * higher authority both sources share: `INSTALLATION_THESES`, which is
 * byte-identical in the CURATED HTML (`INSTALLATION_THESES`) and Version B
 * (`source-data.json constants.installationTheses`). Each thesis names a
 * silhouette and five required parts. Version B's own builders drifted from
 * several of those names (`virgil` for `gas-giant`, `thread-ring-a/b` for
 * `thread-ribbon`, no `extraction-spine`, no `dismantled-fragment`,
 * `smudge-model` for `smudge-figure`, no `duncan-landmark`, no `scale-gate`,
 * no `record-rail`, no `evidence-drawer`, no `state-ear`, no `query-key`,
 * no `source-reliquary`, no `wave-tunnel`, no `data-bridge`,
 * no `provenance-branch`, no `manual-proof`, no `weather-field`,
 * no `forest-band`, no `steep-road`). The thesis contract governs, so the
 * required parts are present and named here.
 *
 * Every geometry, material and texture is tracked in the caller's
 * ResourceScope so the installations obey the museum's disposal budget.
 */

export interface InstallationVisual {
  readonly group: THREE.Group;
  update(state: InstallationState): void;
  tick(time: number, reducedMotion: boolean): void;
}

interface Kit {
  readonly scope: ResourceScope;
  readonly accent: number;
  mat(color: number, opts?: { emissive?: number; opacity?: number; rough?: number }): THREE.MeshStandardMaterial;
  box(g: THREE.Object3D, m: THREE.Material, size: [number, number, number], pos: [number, number, number], name: string): THREE.Mesh;
  sphere(g: THREE.Object3D, m: THREE.Material, r: number, pos: [number, number, number], name: string, seg?: number): THREE.Mesh;
  cyl(g: THREE.Object3D, m: THREE.Material, r: number, h: number, pos: [number, number, number], name: string, seg?: number): THREE.Mesh;
  torus(g: THREE.Object3D, m: THREE.Material, r: number, tube: number, pos: [number, number, number], rot: [number, number, number], name: string): THREE.Mesh;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function makeKit(scope: ResourceScope, accentRgb: readonly number[]): Kit {
  const accent = (Math.round(accentRgb[0] * 255) << 16)
    | (Math.round(accentRgb[1] * 255) << 8)
    | Math.round(accentRgb[2] * 255);
  const mat: Kit['mat'] = (color, opts = {}) => scope.track(new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.62,
    metalness: 0.08,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.55 : 0,
    transparent: opts.opacity !== undefined,
    opacity: opts.opacity ?? 1,
  }));
  const attach = (g: THREE.Object3D, m: THREE.Mesh, pos: [number, number, number], name: string): THREE.Mesh => {
    m.position.set(pos[0], pos[1], pos[2]);
    m.name = name;
    g.add(m);
    return m;
  };
  return {
    scope, accent, mat,
    box: (g, m, size, pos, name) =>
      attach(g, new THREE.Mesh(scope.track(new THREE.BoxGeometry(size[0], size[1], size[2])), m), pos, name),
    sphere: (g, m, r, pos, name, seg = 14) =>
      attach(g, new THREE.Mesh(scope.track(new THREE.SphereGeometry(r, seg, Math.max(8, Math.floor(seg * 0.65)))), m), pos, name),
    cyl: (g, m, r, h, pos, name, seg = 12) =>
      attach(g, new THREE.Mesh(scope.track(new THREE.CylinderGeometry(r, r * 1.02, h, seg)), m), pos, name),
    torus: (g, m, r, tube, pos, rot, name) => {
      const mesh = attach(g, new THREE.Mesh(scope.track(new THREE.TorusGeometry(r, tube, 8, 28)), m), pos, name);
      mesh.rotation.set(rot[0], rot[1], rot[2]);
      return mesh;
    },
  };
}

/** Shared plinth every installation stands on. */
function plinth(k: Kit, g: THREE.Group): void {
  k.box(g, k.mat(0x14131a, { rough: 0.85 }), [4.6, 0.42, 3.7], [0, 0.21, 0], 'plinth');
  k.box(g, k.mat(0xb89a4a, { rough: 0.4 }), [4.76, 0.08, 3.86], [0, 0.45, 0], 'plinth-trim');
}

type Builder = (k: Kit) => InstallationVisual;

// ── The fourteen ───────────────────────────────────────────────────────────

const atlas: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const accent = k.mat(k.accent);
  const violet = k.mat(0x6f5fa8);
  const red = k.mat(0xb2483c);
  k.box(g, gold, [4.0, 0.16, 1.7], [0, 0.78, 0], 'loom-table');
  for (const x of [-1.9, 1.9]) k.box(g, gold, [0.18, 2.6, 0.18], [x, 1.85, 0], `loom-frame:${x}`);
  k.box(g, gold, [3.9, 0.16, 0.18], [0, 3.12, 0], 'loom-frame:header');
  const core = k.sphere(g, k.mat(0x5fd0e8, { emissive: 0x123b46 }), 0.52, [0, 1.6, 0], 'starsilk-core', 18);
  const ribbonA = k.torus(g, accent, 0.9, 0.05, [0, 1.6, 0], [Math.PI / 2, 0, 0], 'thread-ribbon:a');
  const ribbonB = k.torus(g, gold, 1.18, 0.038, [0, 1.6, 0], [0, 0, 0], 'thread-ribbon:b');
  const spools: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const s = k.cyl(g, i === 2 ? accent : violet, 0.17, 0.55, [-1.44 + i * 0.72, 0.95, 0.7], `era-spool:${i}`, 10);
    s.rotation.z = Math.PI / 2;
    spools.push(s);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.sphere(g, i % 2 ? gold : accent, 0.085, [Math.cos(a) * 1.5, 1.6, Math.sin(a) * 0.68], `witness-node:${i}`, 8);
  }
  return {
    group: g,
    update(s) {
      spools.forEach((sp, i) => sp.scale.setScalar(i === num(s.era) ? 1.45 : 1));
      ribbonA.material = num(s.overlay) % 2 ? red : accent;
      core.scale.setScalar(1 + num(s.overlay) * 0.07);
    },
    tick(t, reduced) {
      if (reduced) return;
      ribbonA.rotation.z = t * 0.18;
      ribbonB.rotation.y = t * 0.12;
    },
  };
};

const drakken: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const dark = k.mat(0x2a2830);
  const red = k.mat(0xb2483c);
  const planet = k.sphere(g, k.mat(0x181820), 0.88, [0, 1.6, 0], 'planet-core', 22);
  const ring = new THREE.Group();
  ring.name = 'blood-ring';
  g.add(ring);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const seg = k.box(ring, red, [0.36, 0.12, 0.14], [Math.cos(a) * 1.38, 1.6 + Math.sin(i * 2.7) * 0.04, Math.sin(a) * 1.38], `blood-ring:segment-${i}`);
    seg.rotation.y = -a;
    seg.rotation.z = Math.sin(i * 1.9) * 0.11;
  }
  const pylons: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    pylons.push(k.cyl(g, i === 0 ? accent : dark, 0.11, 1.1, [Math.cos(a) * 1.82, 0.98, Math.sin(a) * 1.82], `strain-pylon:${i}`, 8));
  }
  // Thesis part Version B's builder omitted: the extraction spine that makes
  // the vivisection reading legible rather than decorative.
  const spine = k.cyl(g, k.mat(0x8d8a94, { rough: 0.35 }), 0.07, 2.5, [0, 2.2, 0], 'extraction-spine', 10);
  const mask = k.sphere(g, k.mat(0xd7dde8, { opacity: 0.14, rough: 0.1 }), 0.97, [0, 1.6, 0], 'official-mask', 18);
  return {
    group: g,
    update(s) {
      pylons.forEach((p, i) => {
        p.scale.y = i === num(s.strain) ? 1.45 : 1;
        p.material = i === num(s.strain) ? accent : dark;
      });
      ring.scale.setScalar(0.8 + num(s.step) * 0.06);
      spine.scale.y = 1 + num(s.step) * 0.12;
      (planet.material as THREE.MeshStandardMaterial).emissive.setHex(num(s.step) > 3 ? 0x31040a : 0x000000);
      (planet.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35;
      mask.visible = !!s.official;
    },
    tick(t, reduced) { if (!reduced) ring.rotation.y = t * 0.08; },
  };
};

const tomb: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const violet = k.mat(0x6f5fa8);
  const red = k.mat(0xb2483c);
  // Thesis names the body `gas-giant`; Version B called it `virgil`.
  k.sphere(g, violet, 0.74, [0, 1.22, 0], 'gas-giant', 22);
  const orbits: THREE.Mesh[] = [];
  const modules: THREE.Mesh[] = [];
  const fragments: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    orbits.push(k.torus(g, i % 2 ? gold : violet, 1.0 + i * 0.17, 0.024, [0, 1.22 + i * 0.24, 0], [Math.PI / 2, 0, i * 0.08], `month-orbit:${i}`));
    modules.push(k.box(g, k.mat(0x9a958c), [0.4, 0.16, 0.23], [1.0 + i * 0.17, 1.22 + i * 0.24, 0], `meridian-module:${i}`));
    // Thesis part Version B omitted: what the dismantling leaves behind.
    fragments.push(k.box(g, k.mat(0x5d5a63), [0.17, 0.1, 0.13], [-1.05 - i * 0.13, 0.72, 0.4 + i * 0.1], `dismantled-fragment:${i}`));
  }
  k.cyl(g, k.mat(0x5fd0e8, { emissive: 0x12414c }), 0.075, 1.7, [0, 0.92, -1.7], 'witness-beacon', 8);
  return {
    group: g,
    update(s) {
      const month = num(s.month);
      modules.forEach((m, i) => { m.visible = i >= month; });
      fragments.forEach((f, i) => { f.visible = i < month; });
      orbits.forEach((o, i) => { o.material = i < month ? red : violet; });
    },
    tick(t, reduced) { if (!reduced) orbits.forEach((o, i) => { o.rotation.z = t * (0.02 + i * 0.007); }); },
  };
};

const katamari: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const cyan = k.mat(0x5fd0e8);
  const violet = k.mat(0x6f5fa8);
  const wood = k.mat(0x7a5c3a, { rough: 0.85 });
  const accent = k.mat(k.accent);
  // Thesis: `duncan-landmark` — the compressed local landscape, not generic steps.
  for (let i = 0; i < 5; i++) {
    k.box(g, i % 2 ? k.mat(0x9a958c) : wood, [0.78 + i * 0.06, 0.14, 0.66], [-1.55 + i * 0.7, 0.58 + i * 0.16, -0.72], `duncan-landmark:${i}`);
  }
  const ball = k.sphere(g, accent, 0.4, [0, 1.0, 0.32], 'katamari-ball', 18);
  const items: THREE.Mesh[] = [];
  const source = INSTALLATION_CONSTANTS.katamariItems;
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2;
    const label = String(source[i]?.[2] ?? i);
    items.push(k.box(g, i % 3 === 0 ? gold : i % 3 === 1 ? cyan : violet, [0.15, 0.15, 0.15], [Math.cos(a) * 1.6, 0.62, Math.sin(a) * 1.3], `collection-item:${i}:${label}`));
  }
  // Thesis: `scale-gate` — what the current scale is allowed to collect.
  const gate = k.torus(g, gold, 0.5, 0.045, [1.7, 0.95, -0.2], [0, Math.PI / 2, 0], 'scale-gate');
  // Thesis: `smudge-figure` (Version B: `smudge-model`).
  const smudge = new THREE.Group();
  smudge.name = 'smudge-figure';
  smudge.position.set(-1.5, 0.46, 0.95);
  smudge.scale.setScalar(0.48);
  const lilac = k.mat(0xd8d0e4, { rough: 0.78 });
  const point = k.mat(0x847a91, { rough: 0.76 });
  const blue = k.mat(0x78bdf2, { rough: 0.25 });
  const body = k.sphere(smudge, lilac, 0.56, [0, 0.64, 0], 'smudge-figure:body', 14);
  body.scale.set(1.25, 0.78, 0.72);
  k.sphere(smudge, lilac, 0.37, [0.47, 1.0, 0], 'smudge-figure:head', 14);
  for (const z of [-0.24, 0.24]) {
    const ear = k.box(smudge, point, [0.17, 0.33, 0.11], [0.48, 1.33, z], `smudge-figure:ear${z > 0 ? 'R' : 'L'}`);
    ear.rotation.x = z > 0 ? 0.28 : -0.28;
    ear.rotation.z = -0.15;
  }
  for (const x of [-0.24, 0.28]) for (const z of [-0.3, 0.3]) k.cyl(smudge, point, 0.085, 0.56, [x, 0.3, z], 'smudge-figure:leg', 8);
  for (const z of [-0.14, 0.14]) k.sphere(smudge, blue, 0.044, [0.8, 1.06, z], `smudge-figure:eye${z > 0 ? 'R' : 'L'}`, 8);
  g.add(smudge);
  return {
    group: g,
    update(s) {
      const size = num(s.size);
      ball.scale.setScalar(size / 0.34);
      ball.position.x = num(s.x) * 0.72;
      ball.position.z = 0.32 + num(s.z) * 0.52;
      const collected = (s.collected as number[]) ?? [];
      items.forEach((m, i) => { m.visible = !collected.includes(i); });
      gate.scale.setScalar(0.85 + (size - 0.34) * 1.4);
    },
    tick(t, reduced) { if (!reduced) ball.rotation.set(t * 0.3, t * 0.42, t * 0.2); },
  };
};

const east: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const cyan = k.mat(0x5fd0e8, { opacity: 0.75 });
  const wood = k.mat(0x7a5c3a, { rough: 0.85 });
  const green = k.mat(0x4c7a4a, { rough: 0.86 });
  const road = new THREE.Group();
  road.name = 'steep-road';
  g.add(road);
  for (let i = 0; i < 7; i++) k.box(road, k.mat(0x4a4750), [0.86, 0.15, 0.7], [-2.3 + i * 0.78, 0.58 + i * 0.13, 0], `steep-road:step-${i}`);
  const forest = new THREE.Group();
  forest.name = 'forest-band';
  g.add(forest);
  for (let i = 0; i < 9; i++) {
    const x = -2.3 + i * 0.58;
    k.cyl(forest, wood, 0.055, 0.52, [x, 0.84, -1.15], `forest-band:trunk-${i}`, 6);
    k.sphere(forest, green, 0.23, [x, 1.15, -1.15], `forest-band:crown-${i}`, 8);
  }
  k.box(g, k.mat(0xb89a4a, { rough: 0.4 }), [1.3, 0.15, 1.15], [1.6, 0.55, 1.1], 'ferry-dock');
  const token = k.sphere(g, accent, 0.19, [-2.4, 0.9, 0], 'route-token', 12);
  const weather = new THREE.Group();
  weather.name = 'weather-field';
  g.add(weather);
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 18; i++) {
    drops.push(k.box(weather, cyan, [0.024, 0.36, 0.024], [-2.5 + (i % 5) * 1.25, 1.2 + Math.floor(i / 5) * 0.52, -0.68 + (i % 3) * 0.68], `weather-field:drop-${i}`));
  }
  return {
    group: g,
    update(s) {
      const d = num(s.distance);
      token.position.x = -2.4 + d * 0.46;
      token.position.y = 0.9 + Math.min(6, d) * 0.13;
      weather.visible = num(s.condition) === 1;
      road.rotation.z = num(s.condition) === 2 ? 0.035 : 0;
    },
    tick(t, reduced) { if (!reduced) drops.forEach((d, i) => { d.position.y = 0.6 + ((t * 1.5 + i * 0.23) % 2.4); }); },
  };
};

const parable: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const cyan = k.mat(0x5fd0e8);
  const orange = k.mat(0xe08a3c, { emissive: 0x3a1c06 });
  k.cyl(g, k.mat(0x4c7a4a, { rough: 0.86 }), 1.65, 0.26, [0, 0.66, 0], 'living-island', 24);
  const spiral = k.torus(g, accent, 0.82, 0.05, [0, 0.84, 0], [Math.PI / 2, 0, 0], 'ritual-spiral');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.box(g, k.mat(0x9a958c), [0.26, 0.32, 0.26], [Math.cos(a) * 1.06, 0.95, Math.sin(a) * 1.06], `village:${i}`);
  }
  k.box(g, k.mat(0xb89a4a, { rough: 0.4 }), [0.46, 0.84, 0.46], [1.12, 1.1, -0.52], 'shrine');
  k.box(g, k.mat(0xb2483c), [0.6, 1.1, 0.6], [-1.08, 1.22, 0.38], 'rival-citadel');
  const miracle = k.sphere(g, orange, 0.17, [0, 1.62, 0], 'miracle', 12);
  return {
    group: g,
    update(s) {
      spiral.material = s.armed ? cyan : accent;
      miracle.visible = s.miracle !== 'None';
      miracle.material = s.miracle === 'Rain' ? cyan : orange;
      miracle.scale.setScalar(1 + num(s.casts) * 0.08);
    },
    tick(t, reduced) { if (!reduced && miracle.visible) miracle.position.y = 1.62 + Math.sin(t * 2) * 0.12; },
  };
};

const nexus: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const cyan = k.mat(0x5fd0e8);
  const red = k.mat(0xb2483c);
  k.cyl(g, k.mat(0x6f5fa8), 0.68, 0.44, [-1.6, 0.8, 0], 'vibe-reservoir', 18);
  const core = k.sphere(g, accent, 0.47, [0, 1.15, 0], 'purpose-core', 16);
  const gates: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) gates.push(k.box(g, i % 2 ? gold : cyan, [0.12, 1.1, 1.1], [-0.82 + i * 0.46, 1.12, 0], `translation-gate:${i}`));
  const stack: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) stack.push(k.box(g, k.mat(0x9a958c), [0.68, 0.11, 0.68], [1.66, 0.62 + i * 0.17, 0], `spec-stack:${i}`));
  const chute = k.box(g, red, [0.52, 0.72, 0.52], [0, 0.76, -1.3], 'failure-chute');
  return {
    group: g,
    update(s) {
      const phase = num(s.phase);
      gates.forEach((gate, i) => {
        gate.visible = i <= phase;
        gate.material = num(s.route) === 1 ? red : (i === phase ? accent : gold);
      });
      stack.forEach((sl, i) => { sl.visible = i < phase; });
      chute.scale.y = 1 + num(s.failures) * 0.18;
    },
    tick(t, reduced) { if (!reduced) core.rotation.y = t * 0.45; },
  };
};

const familiar: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const cyan = k.mat(0x5fd0e8);
  const red = k.mat(0xb2483c);
  const lilac = k.mat(0xd8d0e4, { rough: 0.78 });
  const point = k.mat(0x847a91, { rough: 0.76 });
  const cat = new THREE.Group();
  cat.name = 'familiar-body';
  cat.position.set(0, 0.44, 0);
  cat.scale.setScalar(0.9);
  const body = k.sphere(cat, lilac, 0.55, [0, 0.62, 0], 'familiar-body:core', 16);
  body.scale.set(1.25, 0.78, 0.72);
  k.sphere(cat, lilac, 0.36, [0.46, 0.98, 0], 'familiar-body:head', 16);
  for (const x of [-0.24, 0.28]) for (const z of [-0.3, 0.3]) k.cyl(cat, point, 0.085, 0.55, [x, 0.3, z], 'familiar-body:leg', 8);
  g.add(cat);
  // Thesis: `state-ear` — the ears carry the mode reading, not just the eye.
  const ears: THREE.Mesh[] = [];
  for (const z of [-0.22, 0.22]) {
    const ear = k.box(cat, point, [0.16, 0.32, 0.11], [0.47, 1.3, z], `state-ear:${z > 0 ? 'R' : 'L'}`);
    ear.rotation.z = -0.15;
    ears.push(ear);
  }
  const eye = k.sphere(g, accent, 0.11, [0.66, 1.46, 0], 'attention-eye', 10);
  const orbit = new THREE.Group();
  orbit.name = 'tool-orbit';
  g.add(orbit);
  const tools: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    tools.push(k.box(orbit, i % 2 ? gold : cyan, [0.17, 0.17, 0.17], [Math.cos(a) * 1.3, 1.32, Math.sin(a) * 1.3], `tool-orbit:${i}`));
  }
  // Thesis: `evidence-drawer` — where what the familiar noticed is kept.
  const drawer = k.box(g, k.mat(0x7a5c3a, { rough: 0.85 }), [0.9, 0.3, 0.55], [-1.55, 0.7, 0.5], 'evidence-drawer');
  const blocked = k.box(g, red, [2.0, 0.11, 0.11], [0, 1.76, 0], 'blocked-signal');
  return {
    group: g,
    update(s) {
      const mode = num(s.mode);
      const states = INSTALLATION_CONSTANTS.familiarStates[mode] || [];
      const label = states[num(s.stateIndex)] || '';
      blocked.visible = label === 'blocked';
      eye.material = label === 'alert' || label === 'judging' ? red : accent;
      ears.forEach((ear, i) => { ear.rotation.x = (label === 'attentive' || label === 'alert') ? (i ? 0.34 : -0.34) : 0; });
      drawer.position.z = 0.5 - Math.min(0.35, num(s.stateIndex) * 0.18);
      cat.rotation.y = mode * Math.PI / 2;
    },
    tick(t, reduced) {
      if (reduced) return;
      tools.forEach((m, i) => {
        const a = t * 0.2 + (i / 6) * Math.PI * 2;
        m.position.x = Math.cos(a) * 1.3;
        m.position.z = Math.sin(a) * 1.3;
      });
    },
  };
};

const heliocide: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const red = k.mat(0xb2483c);
  const violet = k.mat(0x6f5fa8);
  const sun = k.sphere(g, k.mat(0xff9b54, { emissive: 0xff4a12, rough: 0.3 }), 0.64, [0, 1.38, 0], 'solar-core', 20);
  const cages: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    cages.push(k.torus(g, i === 2 ? red : gold, 1.0 + i * 0.32, 0.042, [0, 1.38, 0], [i % 2 ? 0 : Math.PI / 2, i * 0.25, 0], `orbit-cage:${i}`));
  }
  const spindle = k.cyl(g, accent, 0.11, 2.4, [0, 1.24, 0], 'command-spindle', 10);
  const keys: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) keys.push(k.box(g, i === 2 ? red : gold, [0.42, 0.11, 0.6], [-0.66 + i * 0.66, 0.58, 1.1], `authority-key:${i}`));
  // Thesis: `record-rail` — the log the command sequence writes onto.
  const rail = k.box(g, k.mat(0x4a4750), [2.4, 0.07, 0.16], [0, 0.62, -1.35], 'record-rail');
  const marks: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) marks.push(k.box(g, gold, [0.3, 0.06, 0.12], [-0.96 + i * 0.48, 0.7, -1.35], `record-rail:mark-${i}`));
  return {
    group: g,
    update(s) {
      const phase = num(s.phase);
      sun.scale.setScalar(1 + phase * 0.08);
      keys.forEach((key, i) => { key.position.y = 0.58 + (i < phase / 2 ? 0.18 : 0); });
      spindle.material = s.authorized ? red : s.holding ? violet : accent;
      const log = (s.log as string[]) ?? [];
      marks.forEach((m, i) => { m.visible = i < log.length; });
      rail.scale.z = 1 + log.length * 0.06;
    },
    tick(t, reduced) { if (!reduced) cages.forEach((c, i) => { c.rotation.z = t * (0.12 + i * 0.04); }); },
  };
};

const dictate: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const cyan = k.mat(0x5fd0e8);
  const green = k.mat(0x4c7a4a);
  const grey = k.mat(0x9a958c);
  const violet = k.mat(0x6f5fa8);
  const mic = k.cyl(g, grey, 0.26, 0.95, [-1.55, 1.08, 0], 'microphone-capsule', 16);
  mic.rotation.z = Math.PI / 2;
  // Thesis: `wave-tunnel` — the bars live inside a named tunnel, not loose.
  const tunnel = new THREE.Group();
  tunnel.name = 'wave-tunnel';
  g.add(tunnel);
  const wave: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const h = 0.2 + Math.abs(Math.sin(i * 0.9)) * 0.82;
    wave.push(k.box(tunnel, i % 2 ? cyan : accent, [0.075, h, 0.11], [-0.72 + i * 0.21, 1.03, 0], `wave-tunnel:bar-${i}`));
  }
  k.box(g, k.mat(0x181820), [0.95, 0.7, 0.62], [1.4, 1.0, 0], 'local-model');
  const ribbon = k.box(g, gold, [2.0, 0.1, 0.36], [0.62, 1.66, 0], 'text-ribbon');
  k.box(g, k.mat(0xd7dde8, { opacity: 0.1, rough: 0.12 }), [3.9, 1.75, 2.1], [0, 1.12, 0], 'privacy-shell');
  return {
    group: g,
    update(s) {
      const phase = num(s.phase);
      wave.forEach((w, i) => {
        w.scale.y = phase === 1 ? 1.4 + Math.sin(i) * 0.35 : phase === 2 ? 0.75 : phase === 3 ? 0.32 : 1;
      });
      ribbon.material = phase === 3 ? green : gold;
      mic.material = s.mode === 'toggle' ? violet : grey;
    },
    tick(t, reduced) { if (!reduced) wave.forEach((w, i) => { w.position.y = 1.03 + Math.sin(t * 4 + i) * 0.08; }); },
  };
};

const link: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const green = k.mat(0x4c7a4a);
  const red = k.mat(0xb2483c);
  k.box(g, k.mat(0x9a958c), [1.1, 0.7, 0.12], [-1.5, 1.12, 0], 'mac-terminal');
  k.box(g, k.mat(0x181820), [0.6, 1.05, 0.12], [1.55, 1.18, 0], 'android-terminal');
  const gate = k.box(g, gold, [0.28, 1.3, 0.28], [0, 1.18, 0], 'trust-gate');
  // Thesis: `data-bridge` (Version B: `bridge`).
  const bridgeGroup = new THREE.Group();
  bridgeGroup.name = 'data-bridge';
  g.add(bridgeGroup);
  const spans: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) spans.push(k.box(bridgeGroup, accent, [0.25, 0.08, 0.08], [-0.82 + i * 0.27, 1.18, 0], `data-bridge:span-${i}`));
  const queue = k.sphere(g, k.mat(0x6f5fa8), 0.15, [0, 0.72, 1.0], 'queue-token', 10);
  return {
    group: g,
    update(s) {
      const phase = num(s.phase);
      spans.forEach((b, i) => {
        b.visible = i < phase * 2;
        b.material = phase === 4 ? red : accent;
      });
      gate.material = phase >= 2 ? green : gold;
      queue.scale.setScalar(1 + phase * 0.16);
    },
    tick(t, reduced) { if (!reduced) queue.rotation.y = t * 0.8; },
  };
};

const osint: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const grey = k.mat(0x9a958c);
  k.cyl(g, k.mat(0x7a5c3a, { rough: 0.85 }), 0.23, 1.75, [0, 1.32, 0], 'source-root', 10);
  const branches: THREE.Mesh[] = [];
  const trays: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.6;
    const br = k.box(g, i % 2 ? gold : accent, [1.5, 0.09, 0.09], [Math.sin(a) * 0.68, 1.66 + i * 0.21, Math.cos(a) * 0.68], `provenance-branch:${i}`);
    br.rotation.y = a;
    branches.push(br);
    trays.push(k.box(g, grey, [0.55, 0.12, 0.42], [Math.sin(a) * 1.3, 0.72 + i * 0.17, Math.cos(a) * 1.3], `evidence-tray:${i}`));
  }
  const lens = k.torus(g, k.mat(0x5fd0e8), 0.4, 0.075, [0, 2.3, 0], [0, 0, 0], 'verification-lens');
  // Thesis: `manual-proof` (Version B: `manual-proof-tower`).
  k.box(g, gold, [0.33, 2.0, 0.33], [1.6, 1.38, -1.15], 'manual-proof');
  return {
    group: g,
    update(s) {
      const step = num(s.step);
      branches.forEach((b, i) => { b.visible = i <= step; });
      trays.forEach((t, i) => { t.material = i === num(s.seed) ? accent : grey; });
      lens.scale.setScalar(1 + step * 0.1);
    },
    tick(t, reduced) { if (!reduced) lens.rotation.y = t * 0.45; },
  };
};

const vault: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const wood = k.mat(0x7a5c3a, { rough: 0.85 });
  k.torus(g, gold, 1.4, 0.13, [0, 1.1, 0], [Math.PI / 2, 0, 0], 'vault-ring');
  // Thesis: `source-reliquary` (Version B: `source-cabinet`).
  const cabinets: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const c = k.box(g, i === 0 ? accent : wood, [0.4, 0.72, 0.32], [Math.cos(a) * 1.4, 1.0, Math.sin(a) * 1.4], `source-reliquary:${i}`);
    c.rotation.y = -a;
    cabinets.push(c);
  }
  const lantern = k.sphere(g, k.mat(0x5fd0e8, { emissive: 0x12414c }), 0.28, [0, 1.18, 0], 'retrieval-lantern', 14);
  // Thesis: `query-key` — which of the three queries is loaded.
  const keys: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) keys.push(k.box(g, gold, [0.3, 0.09, 0.5], [-0.6 + i * 0.6, 0.6, 1.55], `query-key:${i}`));
  const folio = k.box(g, k.mat(0x9a958c), [0.78, 0.08, 0.55], [0, 0.62, 1.9], 'evidence-folio');
  return {
    group: g,
    update(s) {
      const query = num(s.query);
      cabinets.forEach((c, i) => { c.material = i === query ? accent : wood; });
      keys.forEach((key, i) => { key.position.y = 0.6 + (i === query ? 0.14 : 0); });
      lantern.scale.setScalar(1 + num(s.step) * 0.14);
      folio.rotation.y = query * 0.18;
    },
    tick(t, reduced) { if (!reduced) lantern.position.y = 1.18 + Math.sin(t * 1.5) * 0.08; },
  };
};

const dexter: Builder = (k) => {
  const g = new THREE.Group();
  plinth(k, g);
  const accent = k.mat(k.accent);
  const gold = k.mat(0xb89a4a, { rough: 0.4 });
  const red = k.mat(0xb2483c);
  k.box(g, k.mat(0x7a5c3a, { rough: 0.85 }), [4.3, 0.24, 3.0], [0, 0.58, 0], 'witness-platform');
  // Thesis: the sanctuary installation's one required part is `dexter-model`.
  // Identity lock from the CURATED DEXTER_MODEL_LOCK: tricolor, quadrupedal,
  // hanging feathered ears, readable brown eyes, no fog cue.
  const dog = new THREE.Group();
  dog.name = 'dexter-model';
  dog.position.set(0, 0.7, 0);
  dog.scale.setScalar(1.05);
  const black = k.mat(0x181820, { rough: 0.76 });
  const white = k.mat(0xf2efe6, { rough: 0.86 });
  const tan = k.mat(0xa86538, { rough: 0.82 });
  const cream = k.mat(0xe8dfcd, { rough: 0.88 });
  const brownEye = k.mat(0x6b4322, { rough: 0.3 });
  const body = k.sphere(dog, black, 0.56, [-0.12, 0.66, 0], 'dexter-model:body', 18);
  body.scale.set(1.48, 0.66, 0.62);
  const chest = k.sphere(dog, white, 0.32, [0.33, 0.74, 0], 'dexter-model:white-chest-ruff', 14);
  chest.scale.set(0.68, 1.26, 0.88);
  const head = k.sphere(dog, black, 0.35, [0.55, 1.26, 0], 'dexter-model:head', 18);
  head.scale.set(1.02, 0.94, 0.86);
  const blaze = k.sphere(dog, white, 0.19, [0.68, 1.32, 0], 'dexter-model:white-blaze', 12);
  blaze.scale.set(0.68, 1.42, 0.66);
  const muzzle = k.sphere(dog, cream, 0.2, [0.86, 1.14, 0], 'dexter-model:muzzle', 14);
  muzzle.scale.set(1.38, 0.67, 0.93);
  k.sphere(dog, k.mat(0x17151a, { rough: 0.38 }), 0.07, [1.09, 1.16, 0], 'dexter-model:nose', 10);
  for (const side of [-1, 1]) {
    const z = side * 0.38;
    const root = k.sphere(dog, black, 0.27, [0.45, 1.29, z], `dexter-model:hanging-ear-root:${side}`, 14);
    root.scale.set(0.54, 0.98, 0.46);
    const drop = k.sphere(dog, black, 0.27, [0.38, 1.05, side * 0.47], `dexter-model:hanging-ear-drop:${side}`, 14);
    drop.scale.set(0.52, 1.22, 0.42);
    const fringe = k.sphere(dog, black, 0.21, [0.29, 0.88, side * 0.5], `dexter-model:feathered-ear-fringe:${side}`, 12);
    fringe.scale.set(0.56, 1.2, 0.38);
    const inner = k.sphere(dog, tan, 0.12, [0.47, 1.21, side * 0.4], `dexter-model:tan-inner-ear:${side}`, 10);
    inner.scale.set(0.36, 1.08, 0.25);
    const eye = k.sphere(dog, brownEye, 0.046, [0.84, 1.33, side * 0.14], `dexter-model:brown-eye:${side}`, 10);
    eye.scale.set(1, 0.82, 0.72);
    const brow = k.sphere(dog, tan, 0.063, [0.77, 1.44, side * 0.15], `dexter-model:tan-brow:${side}`, 10);
    brow.scale.set(1.3, 0.4, 0.78);
  }
  for (const x of [-0.42, 0.29]) for (const z of [-0.26, 0.26]) {
    k.cyl(dog, black, 0.075, 0.4, [x, 0.39, z], `dexter-model:upper-leg:${x}:${z}`, 8);
    k.cyl(dog, white, 0.068, 0.23, [x, 0.16, z], `dexter-model:white-lower-leg:${x}:${z}`, 8);
  }
  const tail = k.torus(dog, black, 0.46, 0.086, [-0.68, 0.8, 0], [0, Math.PI / 2, 0], 'dexter-model:tail-arc');
  tail.rotation.z = 0.58;
  for (let i = 0; i < 5; i++) {
    const tuft = k.sphere(dog, i >= 3 ? white : black, 0.14, [-0.8 - i * 0.1, 0.89 + i * 0.12, 0], `dexter-model:tail-plume:${i}`, 10);
    tuft.scale.set(1.26, 0.7, 0.72);
  }
  dog.userData = {
    identity: 'Dexter',
    species: 'tricolor Phalène / Papillon-like dog',
    stance: 'quadrupedal',
    ears: 'hanging feathered',
    eyes: 'readable brown',
    blindnessCue: 'scent route, deliberate orientation, readable brown eyes',
    speaks: false,
  };
  g.add(dog);
  const marker = k.sphere(g, accent, 0.08, [1.65, 0.74, -1.05], 'witness-state-marker', 10);
  // The thirteen-point scent path is the sanctuary's own contract; it is built
  // by DexterSanctuary. Here the installation carries only its own markers.
  const scent: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    scent.push(k.sphere(g, gold, 0.042, [Math.cos(a) * 1.62, 0.7, Math.sin(a) * 1.08], `scent-marker:${i}`, 6));
  }
  const inspect = k.torus(g, k.mat(0x5fd0e8), 1.42, 0.033, [0, 1.12, 0], [Math.PI / 2, 0, 0], 'inspection-ring');
  return {
    group: g,
    update(s) {
      inspect.visible = !!s.inspect;
      marker.material = num(s.mode) === 2 ? red : accent;
      dog.rotation.y = -Math.PI / 2 + ([0, 0.32, -0.32][num(s.mode)] || 0);
    },
    tick(t, reduced) { if (!reduced && inspect.visible) inspect.rotation.z = t * 0.12; },
  };
};

const BUILDERS: Record<string, Builder> = {
  atlas, drakken, tomb, katamari, east, parable, nexus,
  familiar, heliocide, dictate, link, osint, vault, dexter,
};

export function buildInstallationVisual(
  build: string,
  scope: ResourceScope,
  accent: readonly number[],
): InstallationVisual {
  const builder = BUILDERS[build];
  if (!builder) throw new Error(`No source installation builder for "${build}"`);
  return builder(makeKit(scope, accent));
}

export const INSTALLATION_BUILD_KINDS = Object.keys(BUILDERS);
