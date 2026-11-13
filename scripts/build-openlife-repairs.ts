// Regenerates the repaired OpenLife Builder models from the pinned source copies.
// Source: assets-source/openlife/*.glb (byte-identical to Life_Sim at the pinned revision).
// Output: public/builder-assets/openlife/*.glb and the hashes in src/workshop/builderAssets.json.
// Only models listed in scripts/openlife-repair-plan.json change; all others are copied unchanged.
// Run: npm run build:openlife-repairs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { repairOpenLifeGlb, type OpenLifeRepairPlan } from './openlife-repair';

const CATALOG = 'src/workshop/builderAssets.json';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const plans = JSON.parse(readFileSync('scripts/openlife-repair-plan.json', 'utf8')) as Record<string, OpenLifeRepairPlan>;
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8')) as { models: Record<string, unknown>[] };
const used = new Set<string>();
let repaired = 0;
for (const model of catalog.models) {
  const label = String(model.id).replace('openlife:', '');
  const file = String(model.path).split('/').pop()!;
  const source = new Uint8Array(readFileSync(`assets-source/openlife/${file}`));
  const sourceSha = sha256(source);
  const pinned = (model.sourceSha256 as string | undefined) ?? (model.sha256 as string);
  if (sourceSha !== pinned) throw new Error(`${file}: source bytes do not match the pinned SHA-256`);
  const plan = plans[label];
  const bytes = plan ? repairOpenLifeGlb(source, plan).bytes : source;
  writeFileSync(`public/${model.path}`, bytes);
  if (plan) {
    used.add(label);
    repaired++;
    Object.assign(model, { sha256: sha256(bytes), bytes: bytes.byteLength, sourceSha256: sourceSha, sourceBytes: source.byteLength,
      repair: 'scripts/openlife-repair-plan.json' });
  } else {
    delete model.sourceSha256;
    delete model.sourceBytes;
    delete model.repair;
    Object.assign(model, { sha256: sourceSha, bytes: source.byteLength });
  }
}
const unknown = Object.keys(plans).filter((label) => !used.has(label));
if (unknown.length) throw new Error(`repair plan names models not in the catalog: ${unknown.join(', ')}`);
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n');
console.log(`OpenLife models: ${repaired} repaired, ${catalog.models.length - repaired} unchanged from source.`);
