import { expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { ExhibitHost } from '../../../../src/exhibits/ExhibitHost';
import { definitionFor } from '../../../../src/exhibits/registry';
import { resolveExhibitLabel, type ExhibitControl, type ExhibitDefinition, type ExhibitModule } from '../../../../src/exhibits/contract';
import { InteractionManager } from '../../../../src/interaction/InteractionManager';
import { AssetManager } from '../../../../src/assets/AssetManager';
import { EXHIBITS_BY_ID } from '../../../../src/content/collection.generated';
import { PLACEMENT_BY_EXHIBIT } from '../../../../src/world/layout';
import type { ResourceScope } from '../../../../src/assets/ResourceScope';

export type CandidateFactory = (def: ExhibitDefinition) => ExhibitModule;

export interface CandidateMetrics {
  readonly id: string;
  readonly tier: string;
  readonly budgetMB: number;
  readonly resources: number;
  readonly meshes: number;
  readonly triangles: number;
  readonly controls: number;
  readonly size: readonly [number, number, number];
  readonly plinthIntersections: number;
}

const PLINTH_BOX = new THREE.Box3(
  new THREE.Vector3(-1.3, 0, -1.3),
  new THREE.Vector3(1.3, 0.9, 1.3),
);

const HOTPATH_FORBIDDEN = /\bnew\s+(?:THREE\.)?(?:Vector2|Vector3|Color|Euler|Quaternion|Matrix3|Matrix4|CatmullRomCurve3|SplineCurve|Array|Map|Set|Object)\b/g;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.e2e.ts')) {
      out.push(full);
    }
  }
  return out;
}

function methodBody(source: string, start: number): string {
  const open = source.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  return '';
}

export function createCandidateHarness(
  factory: CandidateFactory,
  exhibitId: string,
  opts: { reducedMotion?: boolean; detailScale?: number } = {},
): {
  host: ExhibitHost;
  interaction: InteractionManager;
  controls: ExhibitControl[];
  announcements: string[];
} {
  const interaction = new InteractionManager();
  const assets = new AssetManager();
  const controls: ExhibitControl[] = [];
  const announcements: string[] = [];
  const def = definitionFor(exhibitId);
  const record = EXHIBITS_BY_ID.get(exhibitId);
  if (!record) throw new Error(`Unknown exhibit record "${exhibitId}"`);

  const module = factory(def);
  const host = new ExhibitHost(module, record, {
    addControl: (id, control) => {
      controls.push(control);
      return interaction.register(id, control);
    },
    announce: (_id, message) => {
      announcements.push(message);
    },
    reducedMotion: () => opts.reducedMotion ?? false,
    detailScale: () => opts.detailScale ?? 1,
    loadAsset: async (assetId: string, scope: ResourceScope, detail: number) =>
      (await assets.load(assetId, scope, { detail })).object,
  });

  return { host, interaction, controls, announcements };
}

export function countPlinthIntersections(root: THREE.Object3D): string[] {
  root.updateMatrixWorld(true);
  const groupInverse = root.matrixWorld.clone().invert();
  const hits: string[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const meshToGroup = mesh.matrixWorld.clone().premultiply(groupInverse);
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const im = mesh as THREE.InstancedMesh;
      im.computeBoundingBox();
      if (!im.boundingBox) return;
      const box = im.boundingBox.clone().applyMatrix4(meshToGroup);
      if (box.intersectsBox(PLINTH_BOX)) hits.push(mesh.name || mesh.parent?.name || '(instanced)');
      return;
    }
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    if (!mesh.geometry.boundingBox) return;
    const box = mesh.geometry.boundingBox.clone().applyMatrix4(meshToGroup);
    if (box.intersectsBox(PLINTH_BOX)) hits.push(mesh.name || mesh.parent?.name || '(mesh)');
  });
  return hits;
}

export function measureHost(host: ExhibitHost, controlCount: number): CandidateMetrics {
  let meshes = 0;
  let triangles = 0;
  const box = new THREE.Box3().setFromObject(host.group);
  const size = new THREE.Vector3();
  box.getSize(size);
  host.group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const geo = mesh.geometry;
    if (geo.index) triangles += geo.index.count / 3;
    else if (geo.attributes?.position) triangles += geo.attributes.position.count / 3;
  });
  const plinthHits = countPlinthIntersections(host.group);
  return {
    id: host.id,
    tier: host.module.def.tier,
    budgetMB: host.module.def.budgetMB,
    resources: host.resourceCount,
    meshes,
    triangles: Math.round(triangles),
    controls: controlCount,
    size: [Number(size.x.toFixed(2)), Number(size.y.toFixed(2)), Number(size.z.toFixed(2))],
    plinthIntersections: plinthHits.length,
  };
}

export function assertStaticModuleDiscipline(candidateDir: string): void {
  const files = walkTsFiles(candidateDir);
  expect(files.length, `No source files found in ${candidateDir}`).toBeGreaterThan(0);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    expect(/\brequestAnimationFrame\s*\(/.test(source), `${file} uses requestAnimationFrame`).toBe(false);
    expect(/\bsetInterval\s*\(/.test(source), `${file} uses setInterval`).toBe(false);

    const onUpdatePattern = /(?:protected\s+override\s+)?onUpdate\s*(?:\([^)]*\)\s*:\s*void\s*\{|=\s*\([^)]*\)\s*:\s*void\s*=>\s*\{)/g;
    for (const match of source.matchAll(onUpdatePattern)) {
      const body = methodBody(source, match.index ?? 0);
      const found = [...body.matchAll(HOTPATH_FORBIDDEN)].map((m) => m[0]);
      expect(found, `${file} allocates inside onUpdate: ${found.join(', ')}`).toEqual([]);
    }
  }
}

export async function assertCandidateContract(
  factory: CandidateFactory,
  exhibitId: string,
  candidateDir: string,
): Promise<CandidateMetrics> {
  assertStaticModuleDiscipline(candidateDir);

  // 1. Full lifecycle + 3x reload/disposal stability
  const { host, controls } = createCandidateHarness(factory, exhibitId);
  let firstCount = 0;
  let metrics!: CandidateMetrics;

  for (let cycle = 0; cycle < 3; cycle++) {
    await host.preload();
    expect(host.currentState).toBe('loaded');
    host.mount();
    expect(host.currentState).toBe('mounted');
    expect(host.group.children.length).toBeGreaterThan(0);
    expect(host.resourceCount).toBeGreaterThan(0);

    host.activate(0);
    expect(host.currentState).toBe('active');
    for (let f = 0; f < 20; f++) host.update(1 / 60, [0, 1.6, 4], f / 60);

    if (cycle === 0) {
      firstCount = host.resourceCount;
      metrics = measureHost(host, controls.length);
    } else {
      expect(host.resourceCount, `cycle ${cycle} resource count drifted`).toBe(firstCount);
    }

    host.unmount();
    expect(host.lastLeakCount, `cycle ${cycle} leaked resources`).toBe(0);
    expect(host.resourceCount, `cycle ${cycle} scope did not drain`).toBe(0);
    expect(host.group.children.length).toBe(0);
  }
  host.dispose();
  expect(host.currentState).toBe('unloaded');

  // 2. Physical presence, bay bounds, plinth clearance, controls & deterministic reset
  const live = createCandidateHarness(factory, exhibitId);
  await live.host.preload();
  live.host.mount();
  live.host.activate(0);

  const placement = PLACEMENT_BY_EXHIBIT.get(exhibitId)!;
  const bayHalf = placement.bounds.h;
  const limitXZ = Math.max(bayHalf[0], bayHalf[2]) * 2 + 2;

  expect(metrics.size[0], 'width > 1.5m').toBeGreaterThan(1.5);
  expect(metrics.size[1], 'height > 1.5m').toBeGreaterThan(1.5);
  expect(metrics.size[2], 'depth > 1.0m').toBeGreaterThan(1.0);
  expect(metrics.size[0], 'fits inside bay width').toBeLessThanOrEqual(limitXZ);
  expect(metrics.size[2], 'fits inside bay depth').toBeLessThanOrEqual(limitXZ);
  expect(metrics.meshes, 'physical mesh richness (>12)').toBeGreaterThan(12);
  expect(metrics.plinthIntersections, 'zero central bay plinth intersections').toBe(0);

  expect(live.controls.length).toBeGreaterThan(0);
  for (const c of live.controls) {
    expect(resolveExhibitLabel(c.label).length).toBeGreaterThan(3);
    expect((c.description ?? '').length).toBeGreaterThan(20);
  }

  const initialState = live.host.module.getAccessibleContent().state;
  const initialLabels = live.controls.map((c) => resolveExhibitLabel(c.label));
  for (const c of live.controls) {
    c.activate();
    for (let f = 0; f < 25; f++) live.host.update(1 / 60, [0, 1.6, 4], f / 60);
  }
  const disturbedState = live.host.module.getAccessibleContent().state;
  expect(disturbedState).not.toBe(initialState);

  live.host.reset();
  for (let f = 0; f < 10; f++) live.host.update(1 / 60, [0, 1.6, 4], f / 60);
  expect(live.host.module.getAccessibleContent().state).toBe(initialState);
  expect(live.controls.map((c) => resolveExhibitLabel(c.label))).toEqual(initialLabels);
  live.host.dispose();

  // 3. Reduced motion & low detail parity
  const reduced = createCandidateHarness(factory, exhibitId, {
    reducedMotion: true,
    detailScale: 0.5,
  });
  await reduced.host.preload();
  reduced.host.mount();
  reduced.host.activate(0);
  const rBefore = reduced.host.module.getAccessibleContent().state;
  for (const c of reduced.controls) {
    c.activate();
    reduced.host.update(1 / 60, [0, 1.6, 4], 0.1);
  }
  expect(reduced.host.module.getAccessibleContent().state).not.toBe(rBefore);
  reduced.host.reset();
  expect(reduced.host.module.getAccessibleContent().state).toBe(rBefore);
  reduced.host.unmount();
  expect(reduced.host.lastLeakCount).toBe(0);
  reduced.host.dispose();

  return metrics;
}
