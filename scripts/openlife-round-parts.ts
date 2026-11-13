// Development report: defect lint before and after the OpenLife repair, per model.
// Run: npx vite-node scripts/openlife-round-parts.ts
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BUILDER_MODELS } from '../src/workshop/builderAssetCatalog';
import { modelMeshBounds } from '../src/workshop/modelBounds';
import { findModelDefects, type MeshBounds } from '../src/workshop/modelDefects';
import { repairOpenLifeGlb, type OpenLifeRepairPlan } from './openlife-repair';

async function bounds(bytes: Uint8Array): Promise<MeshBounds[]> {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '');
  return modelMeshBounds(gltf.scene);
}

const plans = JSON.parse(readFileSync('scripts/openlife-repair-plan.json', 'utf8')) as Record<string, OpenLifeRepairPlan>;
const totals = { clean: 0, fixed: 0, remaining: 0, broke: 0 };
for (const model of BUILDER_MODELS) {
  const label = model.id.replace('openlife:', '');
  const source = new Uint8Array(readFileSync(`assets-source/openlife/${model.path.split('/').pop()}`));
  // Only models listed in the plan are repaired; every other model stays byte-identical.
  const result = plans[label] ? repairOpenLifeGlb(source, plans[label]) : { bytes: source, upright: [], moved: [], placed: [], copied: [], removed: [] };
  const before = findModelDefects(await bounds(source));
  const after = findModelDefects(await bounds(result.bytes), { floating: Object.keys(plans[label]?.floating ?? {}) });
  const status = after.length ? (before.length ? 'REMAINING' : 'BROKE') : before.length ? 'fixed' : 'clean';
  totals[status === 'REMAINING' ? 'remaining' : status === 'BROKE' ? 'broke' : status]++;
  if (process.env.DUMP?.split(',').includes(label)) {
    for (const part of await bounds(process.env.DUMP_SOURCE ? source : result.bytes)) console.log(`   ${label} ${part.name} min ${part.min.map((v) => v.toFixed(3))} max ${part.max.map((v) => v.toFixed(3))}`);
  }
  if (status !== 'clean' || result.upright.length) {
    const ops = [['upright', result.upright], ['moved', result.moved], ['placed', result.placed], ['copied', result.copied], ['removed', result.removed]]
      .filter(([, list]) => list.length).map(([op, list]) => `${op}[${(list as string[]).join(',')}]`).join(' ');
    console.log(`${status.padEnd(9)} ${label.padEnd(26)} ${ops} ${before.length}->${after.length}${after.length ? ' | ' + after.join('; ') : ''}`);
  }
}
console.log(totals);
